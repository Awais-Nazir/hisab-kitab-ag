"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CategorySelect } from "@/components/CategorySelect";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { GlobalSettlementSection } from "@/components/GlobalSettlementSection";
import { LenaDenaRow } from "@/components/LenaDenaRow";
import { AppLayout } from "@/components/AppLayout";
import { useCurrency } from "@/context/CurrencyContext";

interface User {
  id: string;
  email: string;
  name: string;
  selfPersonId: string;
}

interface Workspace {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  amount: string;
  description: string;
  category: string | null;
  date: string;
}

interface DayStat {
  count: number;
  total: number;
}

interface PersonNet {
  personId: string;
  name: string;
  netBalance: number;
}

interface Overview {
  today: DayStat;
  yesterday: DayStat;
  netByPerson: PersonNet[];
}

interface TrendDay {
  label: string;
  total: number;
}

function getCategoryIcon(cat: string | null) {
  const c = (cat || "").toLowerCase();
  if (c.includes("coffee") || c.includes("food") || c.includes("eat") || c.includes("din")) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />
      </svg>
    );
  }
  if (c.includes("uber") || c.includes("transport") || c.includes("auto") || c.includes("fuel") || c.includes("cab")) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    );
  }
  if (c.includes("grocer") || c.includes("shop") || c.includes("blink") || c.includes("mart")) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
      </svg>
    );
  }
  if (c.includes("bill") || c.includes("util") || c.includes("electr") || c.includes("rent")) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <circle cx="7" cy="7" r=".5" fill="currentColor" />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { symbol } = useCurrency();
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<TrendDay[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Entry State
  const [entryType, setEntryType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expTime, setExpTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Quick Workspace Modal State
  const [showGlobalSettle, setShowGlobalSettle] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const meRes = await apiFetch<{ user: User }>("/api/auth/me");
        setUser(meRes.user);

        const [wsRes, expRes, overviewRes, trendRes] = await Promise.all([
          apiFetch<{ workspaces: Workspace[] }>("/api/workspaces"),
          apiFetch<{ expenses: Expense[] }>("/api/expenses/personal"),
          apiFetch<Overview>("/api/stats/overview"),
          apiFetch<{ days: TrendDay[] }>("/api/stats/last7days"),
        ]);
        setWorkspaces(wsRes.workspaces);
        setExpenses(expRes.expenses);
        setOverview(overviewRes);
        setTrend(trendRes.days);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function refreshStats() {
    try {
      const [overviewRes, trendRes] = await Promise.all([
        apiFetch<Overview>("/api/stats/overview"),
        apiFetch<{ days: TrendDay[] }>("/api/stats/last7days"),
      ]);
      setOverview(overviewRes);
      setTrend(trendRes.days);
    } catch {
      // non-critical
    }
  }

  async function handleSubmitExpense(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        amount: parseFloat(amount),
        description,
        category: category || undefined,
        date: new Date(`${expDate}T${expTime}`).toISOString(),
      };
      if (editingId) {
        const res = await apiFetch<{ expense: Expense }>(`/api/expenses/personal/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setExpenses((prev) => prev.map((e) => (e.id === editingId ? res.expense : e)));
        setEditingId(null);
      } else {
        const res = await apiFetch<{ expense: Expense }>("/api/expenses/personal", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setExpenses((prev) =>
          [res.expense, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        );
      }
      setAmount("");
      setDescription("");
      setCategory("");
      setExpDate(new Date().toISOString().slice(0, 10));
      setExpTime(new Date().toTimeString().slice(0, 5));
      setQuickEntryOpen(false);
      await refreshStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEditClick(exp: Expense) {
    setEditingId(exp.id);
    setAmount(exp.amount);
    setDescription(exp.description);
    setCategory(exp.category ?? "");
    const d = new Date(exp.date);
    setExpDate(d.toISOString().slice(0, 10));
    setExpTime(d.toTimeString().slice(0, 5));
    setQuickEntryOpen(true);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setAmount("");
    setDescription("");
    setCategory("");
    setExpDate(new Date().toISOString().slice(0, 10));
    setExpTime(new Date().toTimeString().slice(0, 5));
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    try {
      await apiFetch(`/api/expenses/personal/${id}`, { method: "DELETE" });
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      await refreshStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  if (loading) {
    return (
      <AppLayout title="Dashboard" subtitle="Financial Pulse">
        <div className="py-16 text-center text-[#5A6863]">Loading your dashboard...</div>
      </AppLayout>
    );
  }

  if (!user) return null;

  const owedToYou = overview?.netByPerson.filter((p) => p.netBalance > 0) ?? [];
  const youOwe = overview?.netByPerson.filter((p) => p.netBalance < 0) ?? [];
  const totalYouOwe = Math.abs(youOwe.reduce((s, p) => s + p.netBalance, 0));
  const totalOwesYou = owedToYou.reduce((s, p) => s + p.netBalance, 0);
  const netTotal = (overview?.netByPerson ?? []).reduce((s, p) => s + p.netBalance, 0);

  // Group expenses into Today, Yesterday, and Older
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  const todayExpenses = expenses.filter((e) => e.date.startsWith(todayStr));
  const yesterdayExpenses = expenses.filter((e) => e.date.startsWith(yesterdayStr));
  const olderExpenses = expenses.filter(
    (e) => !e.date.startsWith(todayStr) && !e.date.startsWith(yesterdayStr)
  );

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Private Ledger #001"
      onAddEntry={() => setQuickEntryOpen(true)}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header Title Section matching Figma */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#5A6863]">
              Financial Pulse
            </div>
            <h1 className="font-serif font-bold text-3xl md:text-4xl text-[#162B27] tracking-tight">
              Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-[#5A6863]">
            <span>Today, {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0F5C53]" />
                Personal
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E5A93C]" />
                Shared
              </span>
            </div>
          </div>
        </div>

        {/* Top 3 Metric Cards matching Figma Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {/* Card 1: Net Balance */}
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6B7268] uppercase tracking-wider">
                Net Balance
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#FAF8F5] border border-[#E5E0D8] flex items-center justify-center text-[#0F5C53]">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className={`font-serif font-bold text-2xl md:text-3xl ${netTotal >= 0 ? "text-[#1E7D46]" : "text-[#A8441F]"}`}>
                {netTotal >= 0 ? "+" : ""}{symbol}{Math.abs(netTotal).toFixed(2)}
              </div>
              <p className="text-xs text-[#6B7268] mt-1">
                across all {overview?.netByPerson.length ?? 0} active contacts
              </p>
            </div>
          </div>

          {/* Card 2: Today's Spend */}
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6B7268] uppercase tracking-wider">
                Today&apos;s Spending
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#FAF8F5] border border-[#E5E0D8] flex items-center justify-center text-[#E5A93C]">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="font-serif font-bold text-2xl md:text-3xl text-[#162B27]">
                {symbol}{(overview?.today.total ?? 0).toFixed(2)}
              </div>
              <div className="mt-2 w-full bg-[#FAF8F5] border border-[#E5E0D8] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#E5A93C] h-full rounded-full w-2/5" />
              </div>
              <p className="text-xs text-[#6B7268] mt-1">
                {overview?.today.count ?? 0} {overview?.today.count === 1 ? "expense" : "expenses"} logged today
              </p>
            </div>
          </div>

          {/* Card 3: Next Settlement Card matching Figma Dark Green Card */}
          <div className="bg-[#0A3F38] text-white rounded-2xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-200/90">
                Next Settlement
              </span>
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              </div>
            </div>

            <div className="my-3">
              {youOwe.length > 0 ? (
                <>
                  <h4 className="font-serif font-bold text-lg text-white">
                    {workspaces[0]?.name || "Shared Workspace"}
                  </h4>
                  <p className="text-xs text-emerald-100/80 mt-0.5">
                    You owe {symbol}{Math.abs(youOwe[0].netBalance).toFixed(2)} to {youOwe[0].name}
                  </p>
                </>
              ) : owedToYou.length > 0 ? (
                <>
                  <h4 className="font-serif font-bold text-lg text-white">
                    Receivable
                  </h4>
                  <p className="text-xs text-emerald-100/80 mt-0.5">
                    {owedToYou[0].name} owes you {symbol}{owedToYou[0].netBalance.toFixed(2)}
                  </p>
                </>
              ) : (
                <>
                  <h4 className="font-serif font-bold text-lg text-white">
                    All Settled Up
                  </h4>
                  <p className="text-xs text-emerald-100/80 mt-0.5">
                    No outstanding balance across any contact.
                  </p>
                </>
              )}
            </div>

            <div>
              <button
                onClick={() => setShowGlobalSettle(true)}
                className="bg-white hover:bg-stone-100 text-[#0A3F38] text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Settle Now →
              </button>
            </div>
          </div>
        </div>

        {/* 7-Day Spending Trend Section matching Figma */}
        <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 mb-8 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif font-bold text-xl text-[#162B27]">
              7-Day Spending Trend
            </h2>
            <div className="flex items-center gap-1 bg-[#FAF8F5] border border-[#E5E0D8] p-1 rounded-xl text-xs font-medium">
              <span className="px-3 py-1 bg-white rounded-lg shadow-xs text-[#0F5C53] font-semibold">
                Week
              </span>
              <span className="px-3 py-1 text-[#6B7268]">
                Month
              </span>
            </div>
          </div>

          <div className="w-full h-56 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F5C53" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0F5C53" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7268" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7268" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E0D8",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [`${symbol}${Number(value ?? 0).toFixed(2)}`, "Spent"]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#0F5C53"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#spendGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Two-Column Grid: Left Activity Feed, Right Quick Entry & Settlements */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column (2 Cols wide on desktop): Recent Activity Feed */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-bold text-2xl text-[#162B27]">
                Recent Activity
              </h2>
              <span className="text-xs text-[#5A6863]">
                {expenses.length} personal entries
              </span>
            </div>

            {/* TODAY Group */}
            {todayExpenses.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-[#6B7268] mb-3 flex items-center gap-2">
                  <span>Today</span>
                  <span className="flex-1 h-[1px] bg-[#EBE8E1]" />
                </div>
                <div className="space-y-2.5">
                  {todayExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="bg-white border border-[#E5E0D8] rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-[#0F5C53]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] text-[#0F5C53] flex items-center justify-center flex-shrink-0">
                          {getCategoryIcon(exp.category)}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-[#162B27]">
                            {exp.description}
                          </p>
                          <p className="text-xs text-[#6B7268] mt-0.5">
                            {exp.category ? `• ${exp.category}` : "• Uncategorized"} • {new Date(exp.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-serif font-bold text-sm text-[#162B27]">
                          -{symbol}{Number(exp.amount).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditClick(exp)}
                            className="p-1 text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 text-xs cursor-pointer"
                            title="Delete"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* YESTERDAY Group */}
            {yesterdayExpenses.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-[#6B7268] mb-3 flex items-center gap-2">
                  <span>Yesterday</span>
                  <span className="flex-1 h-[1px] bg-[#EBE8E1]" />
                </div>
                <div className="space-y-2.5">
                  {yesterdayExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="bg-white border border-[#E5E0D8] rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-[#0F5C53]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] text-[#0F5C53] flex items-center justify-center flex-shrink-0">
                          {getCategoryIcon(exp.category)}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-[#162B27]">
                            {exp.description}
                          </p>
                          <p className="text-xs text-[#6B7268] mt-0.5">
                            {exp.category ? `• ${exp.category}` : "• Uncategorized"} • {new Date(exp.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-serif font-bold text-sm text-[#162B27]">
                          -{symbol}{Number(exp.amount).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditClick(exp)}
                            className="p-1 text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 text-xs cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OLDER Group */}
            {olderExpenses.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-[#6B7268] mb-3 flex items-center gap-2">
                  <span>Earlier Transactions</span>
                  <span className="flex-1 h-[1px] bg-[#EBE8E1]" />
                </div>
                <div className="space-y-2.5">
                  {olderExpenses.slice(0, 10).map((exp) => (
                    <div
                      key={exp.id}
                      className="bg-white border border-[#E5E0D8] rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-[#0F5C53]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] text-[#0F5C53] flex items-center justify-center flex-shrink-0">
                          {getCategoryIcon(exp.category)}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-[#162B27]">
                            {exp.description}
                          </p>
                          <p className="text-xs text-[#6B7268] mt-0.5">
                            {exp.category ? `• ${exp.category}` : "• Uncategorized"} • {new Date(exp.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-serif font-bold text-sm text-[#162B27]">
                          -{symbol}{Number(exp.amount).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditClick(exp)}
                            className="p-1 text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 text-xs cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expenses.length === 0 && (
              <div className="bg-white border border-dashed border-[#E5E0D8] rounded-2xl p-12 text-center text-[#6B7268]">
                <p className="font-serif font-semibold text-base text-[#162B27]">No personal expenses yet</p>
                <p className="text-xs mt-1">Use the Quick Entry form to log your first expenditure.</p>
              </div>
            )}
          </div>

          {/* Right Column: Quick Entry & Settlements Widgets */}
          <div className="space-y-6">
            {/* Quick Entry Card matching Figma */}
            <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 shadow-xs">
              <h3 className="font-serif font-bold text-xl text-[#162B27] mb-3">
                Quick Entry
              </h3>

              {/* Segmented type switcher */}
              <div className="flex bg-[#FAF8F5] border border-[#E5E0D8] p-1 rounded-xl mb-4 text-xs font-medium">
                {(["expense", "income", "transfer"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEntryType(t)}
                    className={`flex-1 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                      entryType === t
                        ? "bg-white text-[#0F5C53] font-bold shadow-xs"
                        : "text-[#6B7268]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmitExpense} className="space-y-3.5">
                <div>
                  <label className="text-[11px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">
                    Amount ({symbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full text-2xl font-serif font-bold text-[#162B27] bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-3.5 py-2 focus:bg-white focus:outline-none focus:border-[#0F5C53]"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">
                    What was this for?
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Groceries, Blue Tokai Coffee"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="w-full text-xs text-[#162B27] bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:border-[#0F5C53]"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">
                    Category
                  </label>
                  <CategorySelect value={category} onChange={setCategory} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">Date</label>
                    <input
                      type="date"
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      required
                      className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2 focus:bg-white focus:outline-none focus:border-[#0F5C53]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">Time</label>
                    <input
                      type="time"
                      value={expTime}
                      onChange={(e) => setExpTime(e.target.value)}
                      required
                      className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2 focus:bg-white focus:outline-none focus:border-[#0F5C53]"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-3 rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : editingId ? "Update Entry" : "+ Save Entry"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="w-full mt-2 text-xs text-[#6B7268] hover:text-[#162B27] underline cursor-pointer"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Settlements Card matching Figma */}
            <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-xl text-[#162B27]">
                  Settlements
                </h3>
                <Link
                  href="/workspaces"
                  className="text-xs font-semibold text-[#0F5C53] hover:underline"
                >
                  Workspaces →
                </Link>
              </div>

              {/* You Owe Section */}
              <div className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-[#6B7268]">
                    You Owe
                  </span>
                  <span className="font-serif font-bold text-base text-[#A8441F]">
                    {symbol}{totalYouOwe.toFixed(2)}
                  </span>
                </div>
                {youOwe.length === 0 ? (
                  <p className="text-xs text-[#6B7268]">You don&apos;t owe anyone.</p>
                ) : (
                  <div className="space-y-1.5">
                    {youOwe.map((p) => (
                      <div key={p.personId} className="flex items-center justify-between text-xs py-1 border-b border-[#FAF8F5]">
                        <span className="text-[#162B27] font-medium">• {p.name}</span>
                        <span className="font-semibold text-[#A8441F]">{symbol}{Math.abs(p.netBalance).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Owes You Section */}
              <div className="mb-5">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-[#6B7268]">
                    Owes You
                  </span>
                  <span className="font-serif font-bold text-base text-[#1E7D46]">
                    {symbol}{totalOwesYou.toFixed(2)}
                  </span>
                </div>
                {owedToYou.length === 0 ? (
                  <p className="text-xs text-[#6B7268]">Nobody owes you anything.</p>
                ) : (
                  <div className="space-y-1.5">
                    {owedToYou.map((p) => (
                      <div key={p.personId} className="flex items-center justify-between text-xs py-1 border-b border-[#FAF8F5]">
                        <span className="text-[#162B27] font-medium">• {p.name}</span>
                        <span className="font-semibold text-[#1E7D46]">{symbol}{p.netBalance.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#F0ECE6]">
                <button
                  onClick={() => setShowGlobalSettle(!showGlobalSettle)}
                  className="w-full bg-[#FAF8F5] hover:bg-[#F2EEE9] border border-[#E5E0D8] text-[#162B27] py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  {showGlobalSettle ? "Hide Global Settlement" : "Record Global Settlement"}
                </button>
              </div>

              {/* Collapsible Global Settlement Engine */}
              {showGlobalSettle && (
                <div className="mt-4 pt-4 border-t border-[#F0ECE6]">
                  <GlobalSettlementSection
                    selfPersonId={user.selfPersonId}
                    onSettled={refreshStats}
                  />
                </div>
              )}
            </div>

            {/* Lena / Dena Running Ledger per Contact */}
            <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-lg text-[#162B27]">
                  Lena / Dena History
                </h3>
                <Link href="/people" className="text-xs font-semibold text-[#0F5C53] hover:underline">
                  Contacts →
                </Link>
              </div>
              <p className="text-xs text-[#6B7268] mb-3">
                Click a contact to inspect running transaction deltas.
              </p>
              {overview?.netByPerson.length === 0 ? (
                <p className="text-xs text-[#6B7268]">All settled up.</p>
              ) : (
                <div className="divide-y divide-[#F0ECE6]">
                  {overview?.netByPerson.map((p) => (
                    <LenaDenaRow
                      key={p.personId}
                      personId={p.personId}
                      name={p.name}
                      netBalance={p.netBalance}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Action Button (+) matching Figma Dashboard.png */}
      <button
        onClick={() => setQuickEntryOpen(true)}
        className="fixed md:hidden bottom-20 right-5 w-14 h-14 rounded-2xl bg-[#0F5C53] text-white shadow-lg flex items-center justify-center z-40 active:scale-95 cursor-pointer"
        aria-label="Add expense"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Quick Entry Modal when triggered from Top Header "+ Add Entry" or Mobile "+" */}
      {quickEntryOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27]">
                {editingId ? "Edit Expense" : "New Entry"}
              </h3>
              <button
                onClick={() => {
                  setQuickEntryOpen(false);
                  if (editingId) handleCancelEdit();
                }}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-3.5">
              <div>
                <label className="text-[11px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">
                  Amount ({symbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  className="w-full text-2xl font-serif font-bold text-[#162B27] bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-3.5 py-2 focus:bg-white focus:outline-none focus:border-[#0F5C53]"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">
                  What was this for?
                </label>
                <input
                  type="text"
                  placeholder="e.g. Groceries, Blue Tokai Coffee"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full text-xs text-[#162B27] bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:border-[#0F5C53]"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">
                  Category
                </label>
                <CategorySelect value={category} onChange={setCategory} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">Date</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    required
                    className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2 focus:bg-white focus:outline-none focus:border-[#0F5C53]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">Time</label>
                  <input
                    type="time"
                    value={expTime}
                    onChange={(e) => setExpTime(e.target.value)}
                    required
                    className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2 focus:bg-white focus:outline-none focus:border-[#0F5C53]"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickEntryOpen(false);
                    if (editingId) handleCancelEdit();
                  }}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingId ? "Update Entry" : "+ Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}