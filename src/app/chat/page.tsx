"use client";

import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useUser } from "@/context/UserContext";
import { apiFetch } from "@/lib/api";
import {
  ChatMessage,
  PendingAction,
  ChatResponse,
  ActionResponse,
} from "@/types/agent";

const SUGGESTED_PROMPTS = [
  "Maine NayaPay se 250 PKR ka breakfast kiya hai. Category Food & Dining hai.",
  "Meezan Bank se 1500 fuel dalwaya.",
  "Hamza ko 2000 cash udhar diya.",
  "Aj ka mera total kharcha kitna hoa hai?",
];

export default function AgentChatPage() {
  const { user } = useUser();
  const userId = user?.id || user?.email;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [actionLoading, setActionLoading] = useState<"confirm" | "reject" | null>(null);
  const [showRawProposal, setShowRawProposal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getChatKey = (id?: string) => (id ? `hisab-ai-chat:${id}` : null);
  const getSessionKey = (id?: string) => (id ? `hisab-ai-session-id:${id}` : null);

  // 1 & 2. Reset chat state on user change/login/logout and load user-scoped chat
  useEffect(() => {
    setMessages([]);
    setSessionId(null);
    setPendingAction(null);
    setErrorMsg(null);

    if (!userId) return;

    try {
      const sessionKey = getSessionKey(userId);
      const chatKey = getChatKey(userId);

      const savedSession = sessionKey ? localStorage.getItem(sessionKey) : null;
      if (savedSession) setSessionId(savedSession);

      const savedMessages = chatKey ? localStorage.getItem(chatKey) : null;
      if (savedMessages) {
        const parsed: ChatMessage[] = JSON.parse(savedMessages);
        setMessages(parsed);

        // Check if the latest assistant message has a pending action
        const lastWithAction = parsed
          .slice()
          .reverse()
          .find((m) => m.pendingAction && m.pendingAction.status === "pending");
        if (lastWithAction?.pendingAction) {
          setPendingAction(lastWithAction.pendingAction);
        }
      }
    } catch (e) {
      console.error("Failed to read cached user chat session", e);
    }
  }, [userId]);

  // Save session & messages to user-scoped localStorage
  useEffect(() => {
    if (!userId) return;
    const sessionKey = getSessionKey(userId);
    if (!sessionKey) return;

    if (sessionId) {
      localStorage.setItem(sessionKey, sessionId);
    } else {
      localStorage.removeItem(sessionKey);
    }
  }, [sessionId, userId]);

  useEffect(() => {
    if (!userId) return;
    const chatKey = getChatKey(userId);
    if (!chatKey) return;

    if (messages.length > 0) {
      try {
        localStorage.setItem(chatKey, JSON.stringify(messages));
      } catch (e) {
        console.error("Failed to cache messages", e);
      }
    } else {
      localStorage.removeItem(chatKey);
    }
  }, [messages, userId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, pendingAction]);

  function clearCurrentUserChat() {
    setMessages([]);
    setSessionId(null);
    setPendingAction(null);
    setErrorMsg(null);
    if (userId) {
      const sessionKey = getSessionKey(userId);
      const chatKey = getChatKey(userId);
      if (sessionKey) localStorage.removeItem(sessionKey);
      if (chatKey) localStorage.removeItem(chatKey);
    }
  }

  function handleResetChat() {
    if (confirm("Start a new chat session? This will clear the chat history for this account.")) {
      clearCurrentUserChat();
    }
  }

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend ?? input).trim();
    if (!text || isSending) return;

    setErrorMsg(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: "usr_" + Date.now(),
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      let res: ChatResponse;
      try {
        res = await apiFetch<ChatResponse>("/api/agent/chat", {
          method: "POST",
          body: JSON.stringify({
            message: text,
            session_id: sessionId ?? null,
          }),
        });
      } catch (err: any) {
        // 5. Handle backend session mismatch (404 Session not found)
        const isSessionMismatch =
          err?.status === 404 &&
          (err?.data?.detail === "Session not found." ||
            err?.message?.includes("Session not found"));

        if (isSessionMismatch) {
          // Clear stale session
          clearCurrentUserChat();

          // Inform user and retry with fresh session
          setMessages([
            {
              id: "sys_reset_" + Date.now(),
              sender: "system",
              text: "⚠️ Session expired or belonged to another account. Started a fresh chat for this account.",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
            userMsg,
          ]);

          res = await apiFetch<ChatResponse>("/api/agent/chat", {
            method: "POST",
            body: JSON.stringify({
              message: text,
              session_id: null,
            }),
          });
        } else {
          throw err;
        }
      }

      if (res.session_id) {
        setSessionId(res.session_id);
      }

      const assistantMsg: ChatMessage = {
        id: "ast_" + Date.now(),
        sender: "assistant",
        text: res.reply || (res.pending_action ? "I've drafted this action for you. Please confirm below:" : "Done."),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        pendingAction: res.pending_action,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (res.pending_action) {
        setPendingAction(res.pending_action);
      } else {
        setPendingAction(null);
      }
    } catch (err: any) {
      const errorText = err?.message || "Failed to reach AI Agent service";
      setErrorMsg(errorText);

      setMessages((prev) => [
        ...prev,
        {
          id: "sys_" + Date.now(),
          sender: "system",
          text: `⚠️ Error: ${errorText}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleConfirmAction() {
    if (!pendingAction || !sessionId || actionLoading) return;
    setActionLoading("confirm");
    setErrorMsg(null);

    try {
      const res = await apiFetch<ActionResponse>("/api/agent/actions/confirm", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          action_id: pendingAction.action_id,
        }),
      });

      // Update message pending action status
      setMessages((prev) =>
        prev.map((m) =>
          m.pendingAction?.action_id === pendingAction.action_id
            ? {
                ...m,
                pendingAction: { ...m.pendingAction, status: "confirmed" },
              }
            : m
        )
      );

      // Add confirmation message
      const confMsg: ChatMessage = {
        id: "sys_" + Date.now(),
        sender: "system",
        text: `✅ Action Confirmed! Successfully logged ${pendingAction.type} into your Hisab Kitab.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, confMsg]);
      setPendingAction(null);
    } catch (err: any) {
      const isSessionMismatch =
        err?.status === 404 &&
        (err?.data?.detail === "Session not found." ||
          err?.message?.includes("Session not found"));

      if (isSessionMismatch) {
        clearCurrentUserChat();
        setMessages((prev) => [
          ...prev,
          {
            id: "sys_stale_" + Date.now(),
            sender: "system",
            text: "⚠️ This session is no longer active on the server. Chat session reset.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        const msg = err?.message || "Failed to confirm action";
        setErrorMsg(msg);
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectAction() {
    if (!pendingAction || !sessionId || actionLoading) return;
    setActionLoading("reject");
    setErrorMsg(null);

    try {
      await apiFetch<ActionResponse>("/api/agent/actions/reject", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          action_id: pendingAction.action_id,
        }),
      });

      // Update message pending action status
      setMessages((prev) =>
        prev.map((m) =>
          m.pendingAction?.action_id === pendingAction.action_id
            ? {
                ...m,
                pendingAction: { ...m.pendingAction, status: "rejected" },
              }
            : m
        )
      );

      // Add rejection message
      const rejMsg: ChatMessage = {
        id: "sys_" + Date.now(),
        sender: "system",
        text: "❌ Action Rejected. Nothing was written to your ledger.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, rejMsg]);
      setPendingAction(null);
    } catch (err: any) {
      const isSessionMismatch =
        err?.status === 404 &&
        (err?.data?.detail === "Session not found." ||
          err?.message?.includes("Session not found"));

      if (isSessionMismatch) {
        clearCurrentUserChat();
        setMessages((prev) => [
          ...prev,
          {
            id: "sys_stale_" + Date.now(),
            sender: "system",
            text: "⚠️ This session is no longer active on the server. Chat session reset.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        const msg = err?.message || "Failed to reject action";
        setErrorMsg(msg);
      }
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <AppLayout
      title="Hisab AI Agent"
      subtitle="Chat assistant to log expenses & manage ledger"
    >
      <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-110px)] pb-16 md:pb-4">
        {/* Chat Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-2xl mb-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
              ✨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#162B27] dark:text-white">
                  Hisab Assistant
                </h2>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  AI Live
                </span>
              </div>
              <p className="text-[11px] text-[#6B7268] dark:text-[#8E9C95]">
                {sessionId ? `Session: ${sessionId.slice(0, 8)}...` : "New session ready"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleResetChat}
                className="px-2.5 py-1 text-xs font-medium text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/60 rounded-lg transition-colors cursor-pointer"
                title="Clear current session"
              >
                New Chat
              </button>
            )}
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-1 space-y-4 pr-2">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-3xl shadow-lg shadow-emerald-500/20">
                💬
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                  Ask Hisab AI to log anything
                </h3>
                <p className="text-xs text-[#6B7268] dark:text-[#8E9C95]">
                  Type naturally in Roman Urdu or English. The agent will propose the entry for you to confirm before touching your ledger.
                </p>
              </div>

              {/* Suggestions */}
              <div className="w-full max-w-md space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 text-left">
                  Try asking:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      className="text-left p-3 rounded-xl border border-[#E5E0D8] dark:border-[#28332E] bg-white/70 dark:bg-[#19201D]/70 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-xs text-[#162B27] dark:text-stone-200 transition-all cursor-pointer shadow-2xs"
                    >
                      💡 {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === "user"
                    ? "items-end"
                    : msg.sender === "system"
                    ? "items-center"
                    : "items-start"
                }`}
              >
                {msg.sender === "system" ? (
                  <div className="my-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-[#202925] border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 max-w-md text-center">
                    {msg.text}
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-2xs space-y-2.5 ${
                      msg.sender === "user"
                        ? "bg-[#0F5C53] text-white rounded-br-xs"
                        : "bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] text-[#162B27] dark:text-white rounded-bl-xs"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </p>

                    {/* Pending Action Card (if attached to this assistant message) */}
                    {msg.pendingAction && (
                      <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                            📌 Proposal: {msg.pendingAction.type}
                          </span>
                          <span
                            className={`text-[11px] font-medium ${
                              msg.pendingAction.status === "confirmed"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : msg.pendingAction.status === "rejected"
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            Status: {msg.pendingAction.status}
                          </span>
                        </div>

                        {/* Proposal Content Highlights */}
                        <div className="bg-[#FAF8F5] dark:bg-[#111614] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl p-3 text-xs space-y-1.5 text-stone-800 dark:text-stone-200 font-mono">
                          {Boolean(msg.pendingAction.proposal.amount) && (
                            <div className="flex justify-between items-center text-sm font-sans font-bold text-[#0F5C53] dark:text-emerald-400">
                              <span>Amount:</span>
                              <span>PKR {Number(msg.pendingAction.proposal.amount).toLocaleString()}</span>
                            </div>
                          )}
                          {Boolean(msg.pendingAction.proposal.description) && (
                            <div className="flex justify-between items-center font-sans text-xs">
                              <span className="text-stone-500">Description:</span>
                              <span className="font-semibold">{String(msg.pendingAction.proposal.description)}</span>
                            </div>
                          )}
                          {Boolean(
                            msg.pendingAction.proposal.category_name ??
                            msg.pendingAction.proposal.category_id ??
                            msg.pendingAction.proposal.category
                          ) && (
                            <div className="flex justify-between items-center font-sans text-xs">
                              <span className="text-stone-500">Category:</span>
                              <span className="font-medium">
                                {String(
                                  msg.pendingAction.proposal.category_name ??
                                  msg.pendingAction.proposal.category_id ??
                                  msg.pendingAction.proposal.category
                                )}
                              </span>
                            </div>
                          )}
                          {Boolean(
                            msg.pendingAction.proposal.account_name ??
                            msg.pendingAction.proposal.account_id ??
                            msg.pendingAction.proposal.account
                          ) && (
                            <div className="flex justify-between items-center font-sans text-xs">
                              <span className="text-stone-500">Account:</span>
                              <span className="font-medium">
                                {String(
                                  msg.pendingAction.proposal.account_name ??
                                  msg.pendingAction.proposal.account_id ??
                                  msg.pendingAction.proposal.account
                                )}
                              </span>
                            </div>
                          )}
                          {Boolean(
                            msg.pendingAction.proposal.person_name ??
                            msg.pendingAction.proposal.person_id ??
                            msg.pendingAction.proposal.person
                          ) && (
                            <div className="flex justify-between items-center font-sans text-xs">
                              <span className="text-stone-500">Person:</span>
                              <span className="font-medium">
                                {String(
                                  msg.pendingAction.proposal.person_name ??
                                  msg.pendingAction.proposal.person_id ??
                                  msg.pendingAction.proposal.person
                                )}
                              </span>
                            </div>
                          )}

                          {/* Raw JSON toggle for power users */}
                          <div className="pt-1.5 border-t border-stone-200 dark:border-stone-800 font-sans">
                            <button
                              type="button"
                              onClick={() => setShowRawProposal((v) => !v)}
                              className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 underline cursor-pointer"
                            >
                              {showRawProposal ? "Hide JSON details" : "View raw proposal data"}
                            </button>
                            {showRawProposal && (
                              <pre className="mt-1.5 p-2 bg-black/5 dark:bg-black/30 rounded-lg text-[10px] overflow-x-auto whitespace-pre-wrap font-mono">
                                {JSON.stringify(msg.pendingAction.proposal, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>

                        {/* Interactive Confirm / Reject Buttons (only if still pending) */}
                        {msg.pendingAction.status === "pending" && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={actionLoading !== null}
                              onClick={handleConfirmAction}
                              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading === "confirm" ? (
                                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                "✓ Confirm & Save"
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={actionLoading !== null}
                              onClick={handleRejectAction}
                              className="flex-1 py-2 px-3 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading === "reject" ? (
                                <span className="inline-block w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                "✕ Reject"
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      className={`text-[10px] mt-1 text-right ${
                        msg.sender === "user" ? "text-emerald-100/75" : "text-[#6B7268] dark:text-[#8E9C95]"
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Typing Indicator */}
          {isSending && (
            <div className="flex items-start gap-2">
              <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-2xl p-3.5 shadow-2xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="mt-3 flex items-center gap-2 bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-2xl p-2 shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingAction
                ? "Please confirm or reject the pending action above..."
                : "Type in Urdu/English (e.g., Maine 250 ka breakfast kiya)..."
            }
            disabled={isSending}
            className="flex-1 bg-transparent px-3 py-1.5 text-sm text-[#162B27] dark:text-white placeholder-[#6B7268] dark:placeholder-[#8E9C95] focus:outline-hidden"
          />

          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="p-2.5 rounded-xl bg-[#0F5C53] hover:bg-[#0c4740] disabled:opacity-40 disabled:hover:bg-[#0F5C53] text-white transition-colors cursor-pointer shrink-0 shadow-xs"
            title="Send Message"
          >
            <svg
              className="w-4 h-4 transform rotate-90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
