"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
import { useCurrency } from "@/context/CurrencyContext";

interface SplitInfo {
  personId: string;
  name: string;
  amount: number;
  isSelf: boolean;
}

interface PaymentInfo {
  personId: string;
  name: string;
  amount: number;
  isSelf: boolean;
}

interface AccountInfo {
  id: string;
  name: string;
  type: string;
  color?: string | null;
  icon?: string | null;
}

interface ExpenseItem {
  id: string;
  amount: number;
  description: string;
  category: string | null;
  date: string;
  createdAt: string;
  isPersonal: boolean;
  workspaceId: string | null;
  workspaceName: string | null;
  account: AccountInfo | null;
  userShare: number;
  userPaid: number;
  paidBy: PaymentInfo[];
  splitWith: SplitInfo[];
}

interface WorkspaceOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

interface MetaData {
  totalCount: number;
  totalAmount: number;
  totalUserShare: number;
  totalUserPaid: number;
  categories: CategoryOption[];
  workspaces: WorkspaceOption[];
  accounts: AccountInfo[];
}

export default function ExpensesMasterPage() {
  const { symbol } = useCurrency();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all"); // "all" | "personal" | workspaceId
  const [payer, setPayer] = useState("all"); // "all" | "me" | "others"
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dateRangePreset, setDateRangePreset] = useState("all"); // "all" | "month" | "30days" | "week" | "custom"
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Collapsed Days State (Set of date strings that are collapsed)
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  // Expanded expense detail card (id of currently expanded item for full splits)
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (scope !== "all") params.set("scope", scope);
      if (payer !== "all") params.set("payer", payer);
      if (selectedAccountId !== "all") params.set("accountId", selectedAccountId);
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (search.trim()) params.set("search", search.trim());

      // Date calculations
      const now = new Date();
      if (dateRangePreset === "month") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        params.set("from", startOfMonth.toISOString().slice(0, 10));
      } else if (dateRangePreset === "30days") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.set("from", d.toISOString().slice(0, 10));
      } else if (dateRangePreset === "week") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.set("from", d.toISOString().slice(0, 10));
      } else if (dateRangePreset === "custom") {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      }

      const data = await apiFetch<{
        expenses: ExpenseItem[];
        meta: MetaData;
      }>(`/api/expenses?${params.toString()}`);
      if (data) {
        setExpenses(data.expenses || []);
        setMeta(data.meta || null);
      }
    } catch (err) {
      console.error("Failed to load expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [scope, payer, selectedAccountId, selectedCategory, dateRangePreset, customFrom, customTo, search]);

  // Group expenses by formatted date YYYY-MM-DD
  const groupedExpenses = useMemo(() => {
    const groups: { [dateStr: string]: ExpenseItem[] } = {};

    for (const exp of expenses) {
      const d = exp.date ? exp.date.slice(0, 10) : "Unknown";
      if (!groups[d]) groups[d] = [];
      groups[d].push(exp);
    }

    // Sort dates descending
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return sortedDates.map((dateStr) => ({
      dateStr,
      items: groups[dateStr],
      totalAmount: groups[dateStr].reduce((sum, item) => sum + item.amount, 0),
      totalUserShare: groups[dateStr].reduce((sum, item) => sum + item.userShare, 0),
      totalUserPaid: groups[dateStr].reduce((sum, item) => sum + item.userPaid, 0),
    }));
  }, [expenses]);

  const toggleDayCollapse = (dateStr: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const expandAllDays = () => {
    setCollapsedDates(new Set());
  };

  const collapseAllDays = () => {
    const all = new Set(groupedExpenses.map((g) => g.dateStr));
    setCollapsedDates(all);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    scope !== "all" ||
    payer !== "all" ||
    selectedAccountId !== "all" ||
    selectedCategory !== "all" ||
    dateRangePreset !== "all" ||
    customFrom !== "" ||
    customTo !== "";

  const clearAllFilters = () => {
    setSearch("");
    setScope("all");
    setPayer("all");
    setSelectedAccountId("all");
    setSelectedCategory("all");
    setDateRangePreset("all");
    setCustomFrom("");
    setCustomTo("");
  };

  // Format nice relative day label
  const formatDayHeader = (dateStr: string) => {
    if (dateStr === "Unknown") return { title: "Unknown Date", tag: "" };
    const [y, m, d] = dateStr.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    let tag = "";
    if (diffDays === 0) tag = "Today";
    else if (diffDays === 1) tag = "Yesterday";
    else if (diffDays < 7) {
      tag = target.toLocaleDateString("en-US", { weekday: "long" });
    }

    const formatted = target.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: target.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });

    return { title: formatted, tag };
  };

  return (
    <AppLayout
      title="All Expenses"
      subtitle="Master Consolidated Ledger"
    >
      <div className="space-y-6">
        {/* Top Header Card & Metrics */}
        <div className="bg-gradient-to-br from-[#162B27] via-[#0F5C53] to-[#0A3F38] text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-teal-300/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold mb-2">
                <span>📁 Master Transaction Journal</span>
                <span>•</span>
                <span>{meta?.totalCount ?? 0} Recorded Entries</span>
              </div>
              <h1 className="font-serif font-bold text-2xl md:text-3xl tracking-tight">
                All Expenses & Shared Costs
              </h1>
              <p className="text-emerald-100/80 text-xs md:text-sm mt-1 max-w-xl">
                Unified ledger grouping personal transactions and every workspace expense day by day, complete with payment source and split breakdowns.
              </p>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
                <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider block">
                  Total Flow
                </span>
                <span className="font-serif font-bold text-lg md:text-xl text-white mt-0.5 block">
                  {symbol}{Math.round(meta?.totalAmount ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-200/70">Sum of matched bills</span>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
                <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider block">
                  Your Share
                </span>
                <span className="font-serif font-bold text-lg md:text-xl text-emerald-300 mt-0.5 block">
                  {symbol}{Math.round(meta?.totalUserShare ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-200/70">Your actual cost</span>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider block">
                  Paid By You
                </span>
                <span className="font-serif font-bold text-lg md:text-xl text-white mt-0.5 block">
                  {symbol}{Math.round(meta?.totalUserPaid ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-200/70">Fronted from accounts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search description, category, person, or workspace..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl text-xs font-semibold text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Actions (Expand/Collapse All & Reset) */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={expandAllDays}
                className="px-3 py-2 bg-stone-100 dark:bg-[#1A2229] hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAllDays}
                className="px-3 py-2 bg-stone-100 dark:bg-[#1A2229] hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Collapse All
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Reset Filters ✕
                </button>
              )}
            </div>
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-[#F0ECE6] dark:border-[#1E2824]">
            {/* 1. Scope / Source */}
            <div>
              <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                Source
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full text-xs font-semibold bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
              >
                <option value="all">All (Personal & Shared)</option>
                <option value="personal">Personal Only</option>
                <option value="shared">Shared Only</option>
                {meta?.workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    Workspace: {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Payer Filter */}
            <div>
              <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                Who Paid
              </label>
              <select
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
                className="w-full text-xs font-semibold bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
              >
                <option value="all">All Payers</option>
                <option value="me">You Paid</option>
                <option value="others">Others Paid</option>
              </select>
            </div>

            {/* 3. Account Filter */}
            <div>
              <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                Funding Account
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full text-xs font-semibold bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
              >
                <option value="all">All Accounts</option>
                {meta?.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Category Filter */}
            <div>
              <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-xs font-semibold bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
              >
                <option value="all">All Categories</option>
                {meta?.categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Date Range Selector */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                Time Range
              </label>
              <select
                value={dateRangePreset}
                onChange={(e) => setDateRangePreset(e.target.value)}
                className="w-full text-xs font-semibold bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
              >
                <option value="all">All Time</option>
                <option value="month">This Month</option>
                <option value="30days">Last 30 Days</option>
                <option value="week">Past 7 Days</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>
          </div>

          {/* Custom Date Pickers when 'custom' selected */}
          {dateRangePreset === "custom" && (
            <div className="flex items-center gap-3 pt-2 border-t border-[#F0ECE6] dark:border-[#1E2824]">
              <div>
                <label className="text-[10px] text-stone-500 block mb-0.5 font-bold uppercase">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-xs bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-1.5 text-[#162B27] dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-stone-500 block mb-0.5 font-bold uppercase">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-xs bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-1.5 text-[#162B27] dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Expenses List Grouped by Date */}
        {loading ? (
          <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-12 text-center text-xs text-[#5A6863] dark:text-[#8E9C95] shadow-xs">
            <div className="w-8 h-8 border-2 border-[#0F5C53] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading comprehensive expense ledger...
          </div>
        ) : groupedExpenses.length === 0 ? (
          <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-[#182026] flex items-center justify-center text-xl mx-auto mb-3">
              🧾
            </div>
            <h3 className="font-serif font-bold text-lg text-[#162B27] dark:text-white">
              No Expenses Found
            </h3>
            <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-1 max-w-sm mx-auto">
              No personal or shared expenses match the active filter criteria. Try clearing filters or searching for something else.
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-4 px-4 py-2 bg-[#0F5C53] text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedExpenses.map((group) => {
              const isCollapsed = collapsedDates.has(group.dateStr);
              const { title, tag } = formatDayHeader(group.dateStr);

              return (
                <div
                  key={group.dateStr}
                  className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl overflow-hidden shadow-xs transition-all"
                >
                  {/* Day Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleDayCollapse(group.dateStr)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-stone-50/70 dark:hover:bg-[#182026]/50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      {/* Chevron */}
                      <span
                        className={`w-6 h-6 rounded-lg bg-stone-100 dark:bg-[#182026] flex items-center justify-center text-xs text-stone-500 transition-transform duration-200 ${
                          isCollapsed ? "-rotate-90" : "rotate-0"
                        }`}
                      >
                        ▼
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-base text-[#162B27] dark:text-white">
                            {title}
                          </span>
                          {tag && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                              {tag}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#6B7268] dark:text-[#8E9C95]">
                          {group.items.length} {group.items.length === 1 ? "expense" : "expenses"}
                        </span>
                      </div>
                    </div>

                    {/* Day Totals */}
                    <div className="text-right">
                      <div className="font-serif font-bold text-base text-[#162B27] dark:text-white">
                        {symbol}{Math.round(group.totalUserShare).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-[#6B7268] dark:text-[#8E9C95] font-medium">
                        Total: {symbol}{Math.round(group.totalAmount).toLocaleString()}
                      </div>
                    </div>
                  </button>

                  {/* Day Expense Items */}
                  {!isCollapsed && (
                    <div className="divide-y divide-[#F0ECE6] dark:divide-[#1E2824] border-t border-[#F0ECE6] dark:border-[#1E2824]">
                      {group.items.map((exp) => {
                        const isExpanded = expandedExpenseId === exp.id;
                        const timeStr = exp.date ? new Date(exp.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

                        return (
                          <div
                            key={exp.id}
                            className="p-4 sm:p-5 hover:bg-stone-50/40 dark:hover:bg-[#182026]/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              {/* Left details */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {/* Scope Badge */}
                                  {exp.isPersonal ? (
                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                      Personal
                                    </span>
                                  ) : (
                                    <Link
                                      href={`/workspaces/${exp.workspaceId}`}
                                      className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:underline"
                                    >
                                      {exp.workspaceName || "Shared Workspace"} ↗
                                    </Link>
                                  )}

                                  {/* Category Badge */}
                                  {exp.category && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-100 dark:bg-[#182026] text-stone-600 dark:text-stone-300 border border-[#E5E0D8] dark:border-[#1E2824]">
                                      {exp.category}
                                    </span>
                                  )}

                                  {/* Time */}
                                  <span className="text-[10px] text-[#6B7268] dark:text-[#8E9C95]">
                                    {timeStr}
                                  </span>
                                </div>

                                <h4 className="font-serif font-bold text-sm sm:text-base text-[#162B27] dark:text-white">
                                  {exp.description}
                                </h4>

                                {/* Secondary info: Who paid & Funding account */}
                                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-1.5 text-xs text-[#6B7268] dark:text-[#8E9C95]">
                                  {/* Funding Account */}
                                  {exp.account ? (
                                    <span className="inline-flex items-center gap-1.5 font-medium">
                                      <span
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: exp.account.color || "#0F5C53" }}
                                      />
                                      <span>Account: <strong className="text-[#162B27] dark:text-white">{exp.account.name}</strong></span>
                                    </span>
                                  ) : (
                                    <span className="text-stone-400 text-[11px]">No account linked</span>
                                  )}

                                  {/* Payer Summary */}
                                  <span className="inline-flex items-center gap-1">
                                    <span>Payer:</span>
                                    {exp.isPersonal ? (
                                      <strong className="text-emerald-700 dark:text-emerald-400">You</strong>
                                    ) : exp.paidBy.length === 1 ? (
                                      <strong className={exp.paidBy[0].isSelf ? "text-emerald-700 dark:text-emerald-400" : "text-[#162B27] dark:text-white"}>
                                        {exp.paidBy[0].name}
                                      </strong>
                                    ) : (
                                      <strong className="text-[#162B27] dark:text-white">
                                        Multiple ({exp.paidBy.map((p) => p.name).join(", ")})
                                      </strong>
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Right amounts */}
                              <div className="text-right flex-shrink-0">
                                <span className="font-serif font-bold text-base sm:text-lg text-[#162B27] dark:text-white block">
                                  {symbol}{Math.round(exp.amount).toLocaleString()}
                                </span>

                                {!exp.isPersonal && (
                                  <div className="mt-0.5">
                                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block">
                                      Your share: {symbol}{Math.round(exp.userShare).toLocaleString()}
                                    </span>
                                    {exp.userPaid > 0 && exp.userPaid !== exp.amount && (
                                      <span className="text-[10px] text-stone-500 block">
                                        You paid: {symbol}{Math.round(exp.userPaid).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {!exp.isPersonal && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedExpenseId(isExpanded ? null : exp.id)}
                                    className="text-[10px] font-semibold text-[#0F5C53] dark:text-[#34D399] hover:underline mt-1 cursor-pointer"
                                  >
                                    {isExpanded ? "Hide Splits ▲" : "View Splits ▼"}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Detailed Splits & Payments Drawer when toggled */}
                            {isExpanded && !exp.isPersonal && (
                              <div className="mt-4 p-3.5 rounded-2xl bg-stone-50 dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] space-y-3 animate-in fade-in duration-150">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {/* Who Paid */}
                                  <div>
                                    <span className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                                      Payment Breakdown
                                    </span>
                                    <div className="space-y-1">
                                      {exp.paidBy.map((p) => (
                                        <div key={p.personId} className="flex items-center justify-between text-xs">
                                          <span className={p.isSelf ? "font-bold text-emerald-700 dark:text-emerald-400" : "text-stone-700 dark:text-stone-300"}>
                                            {p.name}
                                          </span>
                                          <span className="font-serif font-bold text-stone-900 dark:text-white">
                                            {symbol}{Math.round(p.amount).toLocaleString()}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Who Split */}
                                  <div>
                                    <span className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                                      Split Breakdown
                                    </span>
                                    <div className="space-y-1">
                                      {exp.splitWith.map((s) => (
                                        <div key={s.personId} className="flex items-center justify-between text-xs">
                                          <span className={s.isSelf ? "font-bold text-emerald-700 dark:text-emerald-400" : "text-stone-700 dark:text-stone-300"}>
                                            {s.name}
                                          </span>
                                          <span className="font-serif font-bold text-stone-900 dark:text-white">
                                            {symbol}{Math.round(s.amount).toLocaleString()}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
