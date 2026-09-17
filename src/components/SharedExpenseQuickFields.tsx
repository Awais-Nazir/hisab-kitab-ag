"use client";

import React, { useState } from "react";
import { AccountSelect } from "./AccountSelect";
import { apiFetch } from "@/lib/api";

export interface Person {
  id: string;
  name: string;
  email?: string | null;
  isSelf?: boolean;
}

// For backwards-compatibility with existing imports
export interface WorkspaceMember {
  personId: string;
  person: {
    id: string;
    name: string;
    email: string | null;
  };
}

export interface Workspace {
  id: string;
  name: string;
  members?: WorkspaceMember[];
}

interface SharedExpenseQuickFieldsProps {
  contacts: Person[];
  onContactCreated?: (newPerson: Person) => void;
  payerMode: "single" | "multiple";
  setPayerMode: (mode: "single" | "multiple") => void;
  payerId: string;
  setPayerId: (id: string) => void;
  customPayments: Record<string, string>;
  setCustomPayments: (val: Record<string, string>) => void;
  splitMode: "equal" | "custom";
  setSplitMode: (mode: "equal" | "custom") => void;
  splitSelected: Set<string>;
  setSplitSelected: (val: Set<string>) => void;
  customSplits: Record<string, string>;
  setCustomSplits: (val: Record<string, string>) => void;
  accountId: string;
  setAccountId: (id: string) => void;
  parsedAmount: number;
  symbol: string;
  selfPersonId?: string;
  equalSplitsMap: Record<string, number>;
  selfPaidAmount: number;
  totalCustomPaid: number;
  totalCustomSplit: number;
}

export function SharedExpenseQuickFields({
  contacts,
  onContactCreated,
  payerMode,
  setPayerMode,
  payerId,
  setPayerId,
  customPayments,
  setCustomPayments,
  splitMode,
  setSplitMode,
  splitSelected,
  setSplitSelected,
  customSplits,
  setCustomSplits,
  accountId,
  setAccountId,
  parsedAmount,
  symbol,
  selfPersonId,
  equalSplitsMap,
  selfPaidAmount,
  totalCustomPaid,
  totalCustomSplit,
}: SharedExpenseQuickFieldsProps) {
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [addingContact, setAddingContact] = useState(false);

  // Combine You + Contacts
  const allParticipants: Person[] = [
    { id: selfPersonId || "self", name: "You", isSelf: true },
    ...contacts.filter((c) => !c.isSelf && c.id !== selfPersonId),
  ];

  async function handleQuickAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newContactName.trim()) return;
    setAddingContact(true);
    try {
      const res = await apiFetch<{ person: Person }>("/api/people", {
        method: "POST",
        body: JSON.stringify({ name: newContactName.trim() }),
      });
      if (res.person) {
        if (onContactCreated) {
          onContactCreated(res.person);
        }
        // Auto-select this contact for split
        const next = new Set(splitSelected);
        next.add(res.person.id);
        setSplitSelected(next);
        setNewContactName("");
        setShowAddContact(false);
      }
    } catch (err: any) {
      alert(err.message || "Failed to add contact");
    } finally {
      setAddingContact(false);
    }
  }

  return (
    <div className="space-y-3.5">
      {/* 1. Select People to Split With */}
      <div className="p-3 bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-bold text-[#162B27] dark:text-white tracking-wider block">
            Split With (Contacts)
          </label>
          <button
            type="button"
            onClick={() => setShowAddContact(!showAddContact)}
            className="text-[10px] font-semibold text-[#0F5C53] dark:text-[#34D399] hover:underline cursor-pointer"
          >
            {showAddContact ? "Cancel" : "+ Add New Person"}
          </button>
        </div>

        {showAddContact && (
          <form onSubmit={handleQuickAddContact} className="flex gap-2 pb-1">
            <input
              type="text"
              placeholder="Person name (e.g. Ali, Kaif)"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              className="flex-1 text-xs bg-white dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-1.5 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
              autoFocus
            />
            <button
              type="submit"
              disabled={addingContact || !newContactName.trim()}
              className="px-3 py-1.5 bg-[#0F5C53] hover:bg-[#0A3F38] text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {addingContact ? "Adding..." : "Add"}
            </button>
          </form>
        )}

        {/* Contact Selector Chips */}
        <div className="flex flex-wrap gap-1.5">
          {allParticipants.map((p) => {
            const isSelected = splitSelected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const next = new Set(splitSelected);
                  if (next.has(p.id)) {
                    if (next.size > 1) {
                      next.delete(p.id);
                    }
                  } else {
                    next.add(p.id);
                  }
                  setSplitSelected(next);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#0F5C53] text-white shadow-xs"
                    : "bg-white dark:bg-[#1A2229] text-[#5A6863] dark:text-[#8E9C95] border border-[#E5E0D8] dark:border-[#1E2824] hover:border-[#0F5C53]/50"
                }`}
              >
                <span>{p.name}</span>
                {isSelected && <span>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Payer Section (Single vs Multiple / Custom Paid) */}
      <div className="p-3 bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-bold text-[#162B27] dark:text-white tracking-wider block">
            Who Paid?
          </label>
          <div className="flex bg-stone-200/60 dark:bg-[#13191E] p-0.5 rounded-lg text-[10px] font-medium border border-transparent dark:border-[#1E2824]">
            <button
              type="button"
              onClick={() => {
                setPayerMode("single");
                setPayerId(selfPersonId || allParticipants[0]?.id || "");
                setCustomPayments({});
              }}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                payerMode === "single"
                  ? "bg-white dark:bg-[#1A2229] text-[#0F5C53] dark:text-[#34D399] font-bold shadow-xs"
                  : "text-[#6B7268] dark:text-[#8E9C95]"
              }`}
            >
              Single Payer
            </button>
            <button
              type="button"
              onClick={() => {
                setPayerMode("multiple");
                if (Object.keys(customPayments).length === 0) {
                  const initial: Record<string, string> = {};
                  allParticipants.forEach((p) => {
                    initial[p.id] = p.id === selfPersonId ? parsedAmount.toFixed(0) : "0";
                  });
                  setCustomPayments(initial);
                }
              }}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                payerMode === "multiple"
                  ? "bg-white dark:bg-[#1A2229] text-[#0F5C53] dark:text-[#34D399] font-bold shadow-xs"
                  : "text-[#6B7268] dark:text-[#8E9C95]"
              }`}
            >
              Multiple / Custom
            </button>
          </div>
        </div>

        {payerMode === "single" ? (
          <div>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="w-full text-xs bg-white dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-2 text-[#162B27] dark:text-white font-medium focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
            >
              {allParticipants.map((p) => {
                const isSelf = p.isSelf || p.id === selfPersonId;
                return (
                  <option key={p.id} value={p.id}>
                    {isSelf ? "You (Paid full amount)" : `${p.name} (Paid full amount)`}
                  </option>
                );
              })}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {allParticipants.map((p) => {
                const isSelf = p.isSelf || p.id === selfPersonId;
                const val = customPayments[p.id] || "";
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 bg-white dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-2 rounded-xl"
                  >
                    <span className="text-xs font-medium text-[#162B27] dark:text-white flex-1 truncate">
                      {isSelf ? "You" : p.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-[#6B7268] dark:text-[#8E9C95]">{symbol}</span>
                      <input
                        type="number"
                        step="1"
                        placeholder="0"
                        value={val}
                        onChange={(e) => {
                          setCustomPayments({
                            ...customPayments,
                            [p.id]: e.target.value,
                          });
                        }}
                        className="w-20 text-xs font-semibold text-right bg-[#FAF8F5] dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-lg px-2 py-1 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paid Validation status */}
            <div className="flex items-center justify-between text-[11px] pt-1 px-1">
              <span className="text-[#6B7268] dark:text-[#8E9C95]">
                Total Paid:{" "}
                <strong className="text-[#162B27] dark:text-white">
                  {symbol}{Math.round(totalCustomPaid)}
                </strong>{" "}
                / {symbol}{Math.round(parsedAmount)}
              </span>
              {Math.abs(totalCustomPaid - parsedAmount) < 0.01 && parsedAmount > 0 ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">✓ Matches total</span>
              ) : (
                selfPersonId && (
                  <button
                    type="button"
                    onClick={() => {
                      const otherPaid = Object.entries(customPayments).reduce(
                        (sum, [pid, v]) => (pid === selfPersonId ? sum : sum + (parseFloat(v) || 0)),
                        0
                      );
                      const rem = Math.max(0, parsedAmount - otherPaid);
                      setCustomPayments({
                        ...customPayments,
                        [selfPersonId]: rem.toFixed(0),
                      });
                    }}
                    className="text-[#0F5C53] dark:text-[#34D399] font-semibold underline cursor-pointer text-[10px]"
                  >
                    Remainder to You
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Account Deduction: Shown whenever "You" is paying */}
      {selfPaidAmount > 0 && (
        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-bold text-[#0F5C53] dark:text-[#34D399] tracking-wider">
              Paid From Account (Kaha se hoyi ha)
            </label>
            <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-medium">
              Your share: {symbol}{Math.round(selfPaidAmount)}
            </span>
          </div>
          <AccountSelect
            value={accountId}
            onChange={setAccountId}
            label=""
            placeholder="Select payment source (Cash, SadaPay, NayaPay...)"
          />
          <p className="text-[10px] text-[#6B7268] dark:text-[#8E9C95]">
            Deducts {symbol}{Math.round(selfPaidAmount)} directly from this account balance.
          </p>
        </div>
      )}

      {/* 4. Split Section (Equal vs Custom Amounts) */}
      <div className="p-3 bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-bold text-[#162B27] dark:text-white tracking-wider block">
            Split Breakdown
          </label>
          <div className="flex bg-stone-200/60 dark:bg-[#13191E] p-0.5 rounded-lg text-[10px] font-medium border border-transparent dark:border-[#1E2824]">
            <button
              type="button"
              onClick={() => setSplitMode("equal")}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                splitMode === "equal"
                  ? "bg-white dark:bg-[#1A2229] text-[#0F5C53] dark:text-[#34D399] font-bold shadow-xs"
                  : "text-[#6B7268] dark:text-[#8E9C95]"
              }`}
            >
              Equal (Integer)
            </button>
            <button
              type="button"
              onClick={() => {
                setSplitMode("custom");
                if (Object.keys(customSplits).length === 0) {
                  const initial: Record<string, string> = {};
                  allParticipants.forEach((p) => {
                    if (splitSelected.has(p.id)) {
                      initial[p.id] = (equalSplitsMap[p.id] || 0).toString();
                    }
                  });
                  setCustomSplits(initial);
                }
              }}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                splitMode === "custom"
                  ? "bg-white dark:bg-[#1A2229] text-[#0F5C53] dark:text-[#34D399] font-bold shadow-xs"
                  : "text-[#6B7268] dark:text-[#8E9C95]"
              }`}
            >
              Custom Amounts
            </button>
          </div>
        </div>

        {splitMode === "equal" ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {allParticipants
                .filter((p) => splitSelected.has(p.id))
                .map((p) => {
                  const assignedShare = equalSplitsMap[p.id] || 0;
                  const isSelf = p.isSelf || p.id === selfPersonId;
                  const baseShare =
                    splitSelected.size > 0 ? Math.floor(parsedAmount / splitSelected.size) : 0;
                  const hasExtraRupee = isSelf && assignedShare > baseShare;

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border text-xs bg-white dark:bg-[#1A2229] border-[#0F5C53] dark:border-[#10B981] shadow-xs"
                    >
                      <span className="font-semibold text-[#162B27] dark:text-white truncate">
                        {isSelf ? "You" : p.name}
                      </span>
                      {parsedAmount > 0 && (
                        <div className="text-right flex-shrink-0">
                          <span className="font-mono font-bold text-[#0F5C53] dark:text-[#34D399] text-xs">
                            {symbol}{assignedShare}
                          </span>
                          {hasExtraRupee && (
                            <span className="block text-[8px] font-bold text-amber-700 dark:text-amber-400">
                              (+{assignedShare - baseShare} to you)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            <p className="text-[10px] text-[#6B7268] dark:text-[#8E9C95]">
              Whole integers only. Remainder is allocated to You to keep sums exact.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {allParticipants
                .filter((p) => splitSelected.has(p.id))
                .map((p) => {
                  const isSelf = p.isSelf || p.id === selfPersonId;
                  const val = customSplits[p.id] || "";
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 bg-white dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-2 rounded-xl"
                    >
                      <span className="text-xs font-medium text-[#162B27] dark:text-white flex-1 truncate">
                        {isSelf ? "You" : p.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-[#6B7268] dark:text-[#8E9C95]">{symbol}</span>
                        <input
                          type="number"
                          step="1"
                          placeholder="0"
                          value={val}
                          onChange={(e) => {
                            setCustomSplits({
                              ...customSplits,
                              [p.id]: e.target.value,
                            });
                          }}
                          className="w-20 text-xs font-semibold text-right bg-[#FAF8F5] dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-lg px-2 py-1 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Split Validation status */}
            <div className="flex items-center justify-between text-[11px] pt-1 px-1">
              <span className="text-[#6B7268] dark:text-[#8E9C95]">
                Total Split:{" "}
                <strong className="text-[#162B27] dark:text-white">
                  {symbol}{Math.round(totalCustomSplit)}
                </strong>{" "}
                / {symbol}{Math.round(parsedAmount)}
              </span>
              {Math.abs(totalCustomSplit - parsedAmount) < 0.01 && parsedAmount > 0 ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">✓ Matches total</span>
              ) : (
                selfPersonId && (
                  <button
                    type="button"
                    onClick={() => {
                      const otherSplit = Object.entries(customSplits).reduce(
                        (sum, [pid, v]) => (pid === selfPersonId ? sum : sum + (parseFloat(v) || 0)),
                        0
                      );
                      const rem = Math.max(0, parsedAmount - otherSplit);
                      setCustomSplits({
                        ...customSplits,
                        [selfPersonId]: rem.toFixed(0),
                      });
                    }}
                    className="text-[#0F5C53] dark:text-[#34D399] font-semibold underline cursor-pointer text-[10px]"
                  >
                    Remainder to You
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
