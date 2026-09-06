"use client";

import React from "react";
import Link from "next/link";
import { AccountSelect } from "./AccountSelect";

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
  workspaces: Workspace[];
  selectedWsId: string;
  onSelectWsId: (id: string) => void;
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
  currentWorkspace: Workspace | null;
  currentMembers: WorkspaceMember[];
  equalSplitsMap: Record<string, number>;
  selfPaidAmount: number;
  totalCustomPaid: number;
  totalCustomSplit: number;
}

export function SharedExpenseQuickFields({
  workspaces,
  selectedWsId,
  onSelectWsId,
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
  currentWorkspace,
  currentMembers,
  equalSplitsMap,
  selfPaidAmount,
  totalCustomPaid,
  totalCustomSplit,
}: SharedExpenseQuickFieldsProps) {
  if (workspaces.length === 0) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-center">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">
          No shared workspaces found
        </p>
        <p className="text-[11px] text-amber-700 dark:text-amber-500 mt-1">
          Create a workspace first to split expenses with friends & family.
        </p>
        <Link
          href="/workspaces"
          className="inline-block mt-2 px-3 py-1.5 bg-[#0F5C53] hover:bg-[#0A3F38] text-white rounded-xl text-xs font-semibold"
        >
          Go to Workspaces →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Workspace Selection Dropdown */}
      <div>
        <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
          Select Workspace
        </label>
        <select
          value={selectedWsId}
          onChange={(e) => onSelectWsId(e.target.value)}
          required
          className="w-full text-xs font-medium text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name} ({ws.members?.length || 0} members)
            </option>
          ))}
        </select>
      </div>

      {/* Payer Section (Single vs Multiple / Custom Paid) */}
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
                const selfMem = currentMembers.find((m) => m.personId === selfPersonId);
                setPayerId(selfMem?.personId || currentMembers[0]?.personId || "");
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
                  currentMembers.forEach((m) => {
                    initial[m.personId] = m.personId === selfPersonId ? parsedAmount.toFixed(0) : "0";
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
              {currentMembers.map((m) => {
                const isSelf = m.personId === selfPersonId;
                return (
                  <option key={m.personId} value={m.personId}>
                    {isSelf ? "You (Paid full amount)" : `${m.person.name} (Paid full amount)`}
                  </option>
                );
              })}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {currentMembers.map((m) => {
                const isSelf = m.personId === selfPersonId;
                const val = customPayments[m.personId] || "";
                return (
                  <div
                    key={m.personId}
                    className="flex items-center gap-2 bg-white dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-2 rounded-xl"
                  >
                    <span className="text-xs font-medium text-[#162B27] dark:text-white flex-1 truncate">
                      {isSelf ? "You" : m.person.name}
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
                            [m.personId]: e.target.value,
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

      {/* Account Deduction: Shown whenever "Me" is paying (Kaha se hoyi ha) */}
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
            placeholder="Select payment source (Cash, NayaPay, Bank...)"
          />
          <p className="text-[10px] text-[#6B7268] dark:text-[#8E9C95]">
            Deducts {symbol}{Math.round(selfPaidAmount)} directly from this account balance.
          </p>
        </div>
      )}

      {/* Split Section (Equal vs Custom Amounts) */}
      <div className="p-3 bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-bold text-[#162B27] dark:text-white tracking-wider block">
            Split Between
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
                  currentMembers.forEach((m) => {
                    if (splitSelected.has(m.personId)) {
                      initial[m.personId] = (equalSplitsMap[m.personId] || 0).toString();
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
              {currentMembers.map((m) => {
                const isChecked = splitSelected.has(m.personId);
                const assignedShare = isChecked ? equalSplitsMap[m.personId] || 0 : 0;
                const isSelf = m.personId === selfPersonId;
                const baseShare = splitSelected.size > 0 ? Math.floor(parsedAmount / splitSelected.size) : 0;
                const hasExtraRupee = isSelf && isChecked && assignedShare > baseShare;

                return (
                  <label
                    key={m.personId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isChecked
                        ? "bg-white dark:bg-[#1A2229] border-[#0F5C53] dark:border-[#10B981] shadow-xs"
                        : "bg-[#FAF8F5] dark:bg-[#13191E] border-[#E5E0D8] dark:border-[#1E2824] text-stone-400 dark:text-stone-600 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const next = new Set(splitSelected);
                          if (next.has(m.personId)) next.delete(m.personId);
                          else next.add(m.personId);
                          setSplitSelected(next);
                        }}
                        className="w-3.5 h-3.5 accent-[#0F5C53] dark:accent-[#10B981]"
                      />
                      <span className="font-semibold text-[#162B27] dark:text-white truncate">
                        {isSelf ? "You" : m.person.name}
                      </span>
                    </div>

                    {isChecked && parsedAmount > 0 && (
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
                  </label>
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
              {currentMembers.map((m) => {
                const isSelf = m.personId === selfPersonId;
                const val = customSplits[m.personId] || "";
                return (
                  <div
                    key={m.personId}
                    className="flex items-center gap-2 bg-white dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-2 rounded-xl"
                  >
                    <span className="text-xs font-medium text-[#162B27] dark:text-white flex-1 truncate">
                      {isSelf ? "You" : m.person.name}
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
                            [m.personId]: e.target.value,
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
