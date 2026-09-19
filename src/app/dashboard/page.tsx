"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CategorySelect } from "@/components/CategorySelect";
import { AccountSelect } from "@/components/AccountSelect";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { GlobalSettlementSection } from "@/components/GlobalSettlementSection";
import { LenaDenaRow } from "@/components/LenaDenaRow";
import { AppLayout } from "@/components/AppLayout";
import { ModalPortal } from "@/components/ModalPortal";
import { useCurrency } from "@/context/CurrencyContext";
import { useUser } from "@/context/UserContext";
import { calculateEqualSplits } from "@/lib/splits";
import { SharedExpenseQuickFields, Person } from "@/components/SharedExpenseQuickFields";
import { useSync } from "@/context/SyncContext";
import { PushNotificationManager } from "@/components/PushNotificationManager";

interface Expense {
  id: string;
  amount: string | number;
  description: string;
  category: string | null;
  date: string;
  createdAt?: string;
  isPersonal?: boolean;
  workspaceId?: string | null;
  workspaceName?: string | null;
  account?: { id: string; name: string; type: string; color: string | null; icon: string | null } | null;
  userShare?: number;
  userPaid?: number;
  paidBy?: { personId: string; name: string; amount: number; isSelf: boolean }[];
  splitWith?: { personId: string; name: string; amount: number; isSelf: boolean }[];
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
  const { user, loading: userLoading, refreshUser } = useUser();
  const { isOnline } = useSync();
  const [contacts, setContacts] = useState<Person[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<TrendDay[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string; balance: number | string }[]>([]);
  const [showBalance, setShowBalance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activityScope, setActivityScope] = useState<"all" | "personal">("all");
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [activityCollapsed, setActivityCollapsed] = useState(false);
  const [showAllDays, setShowAllDays] = useState(false);

  // Quick Entry State
  const [entryType, setEntryType] = useState<"expense" | "shared" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [incomeSource, setIncomeSource] = useState("Salary");
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expTime, setExpTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trendRange, setTrendRange] = useState<"week" | "month">("week");

  // Shared Expense Entry State
  const [payerMode, setPayerMode] = useState<"single" | "multiple">("single");
  const [payerId, setPayerId] = useState<string>("");
  const [customPayments, setCustomPayments] = useState<Record<string, string>>({});
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [splitSelected, setSplitSelected] = useState<Set<string>>(new Set());
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  // Modals
  const [entryChoiceOpen, setEntryChoiceOpen] = useState(false);
  const [showGlobalSettle, setShowGlobalSettle] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);

  // Sync default payer and split selections when user is available
  useEffect(() => {
    if (user?.selfPersonId) {
      setPayerId((prev) => (!prev || prev === "self" ? user.selfPersonId! : prev));
      setSplitSelected((prev) => {
        if (prev.size === 0 || prev.has("self")) {
          const next = new Set(prev);
          next.delete("self");
          next.add(user.selfPersonId!);
          return next;
        }
        return prev;
      });
    }
  }, [user?.selfPersonId]);

  // Ensure user profile is re-fetched if absent on direct or client-side navigation
  useEffect(() => {
    if (!user && !userLoading) {
      refreshUser().then((u) => {
        if (!u && typeof navigator !== "undefined" && navigator.onLine) {
          router.push("/login");
        }
      });
    }
  }, [user, userLoading, refreshUser, router]);

  const parsedAmount = parseFloat(amount) || 0;
  const selfPersonId = user?.selfPersonId;
  const equalSplitsMap = useMemo(() => {
    return calculateEqualSplits(parsedAmount, Array.from(splitSelected), selfPersonId);
  }, [parsedAmount, splitSelected, selfPersonId]);

  const selfPaidAmount = useMemo(() => {
    if (payerMode === "single") {
      return (payerId === selfPersonId || payerId === "self" || !payerId) ? parsedAmount : 0;
    }
    return (
      parseFloat(customPayments[selfPersonId || ""] || customPayments["self"] || "0") || 0
    );
  }, [payerMode, payerId, selfPersonId, parsedAmount, customPayments]);

  const totalCustomPaid = useMemo(() => {
    return Object.values(customPayments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }, [customPayments]);

  const totalCustomSplit = useMemo(() => {
    return Object.values(customSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }, [customSplits]);

  // Quick Notes State
  const [dashboardNotes, setDashboardNotes] = useState<any[]>([]);
  const [quickNoteTitle, setQuickNoteTitle] = useState("");
  const [quickNoteSaving, setQuickNoteSaving] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteModalTitle, setNoteModalTitle] = useState("");
  const [noteModalContent, setNoteModalContent] = useState("");
  const [noteModalCategory, setNoteModalCategory] = useState("General");
  const [noteModalColor, setNoteModalColor] = useState("emerald");
  const [noteModalIsPinned, setNoteModalIsPinned] = useState(false);
  const [expandedDashboardNoteId, setExpandedDashboardNoteId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [peopleRes, expRes, overviewRes, trendRes, accRes, notesRes] = await Promise.all([
          apiFetch<{ people: Person[] }>("/api/people"),
          apiFetch<{ expenses: Expense[] }>("/api/expenses"),
          apiFetch<Overview>("/api/stats/overview"),
          apiFetch<{ days: TrendDay[] }>("/api/stats/last7days?range=week"),
          apiFetch<{ accounts: { id: string; name: string; type: string; balance: number | string }[] }>("/api/accounts"),
          apiFetch<{ notes: any[] }>("/api/notes").catch(() => ({ notes: [] })),
        ]);
        setContacts(peopleRes.people || []);
        setExpenses(expRes.expenses || []);
        setOverview(overviewRes);
        setTrend(trendRes.days || []);
        setAccounts(accRes.accounts || []);
        setDashboardNotes(notesRes.notes || []);
      } catch (err) {
        if (typeof navigator !== "undefined" && navigator.onLine) {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    }
    load();

    function handleSyncCompleted() {
      // Refresh with latest reconciled server data
      Promise.all([
        apiFetch<{ people: Person[] }>("/api/people"),
        apiFetch<{ expenses: Expense[] }>("/api/expenses"),
        apiFetch<Overview>("/api/stats/overview"),
        apiFetch<{ days: TrendDay[] }>("/api/stats/last7days?range=week"),
        apiFetch<{ accounts: { id: string; name: string; type: string; balance: number | string }[] }>("/api/accounts"),
        apiFetch<{ notes: any[] }>("/api/notes").catch(() => ({ notes: [] })),
      ])
        .then(([peopleRes, expRes, overviewRes, trendRes, accRes, notesRes]) => {
          if (peopleRes?.people) setContacts(peopleRes.people);
          if (expRes?.expenses) setExpenses(expRes.expenses);
          if (overviewRes) setOverview(overviewRes);
          if (trendRes?.days) setTrend(trendRes.days);
          if (accRes?.accounts) setAccounts(accRes.accounts || []);
          if (notesRes?.notes) setDashboardNotes(notesRes.notes);
        })
        .catch(() => {});
    }

    window.addEventListener("offline-sync-completed", handleSyncCompleted);
    return () => {
      window.removeEventListener("offline-sync-completed", handleSyncCompleted);
    };
  }, [router]);

  async function handleRangeChange(range: "week" | "month") {
    setTrendRange(range);
    try {
      const res = await apiFetch<{ days: TrendDay[] }>(`/api/stats/last7days?range=${range}`);
      setTrend(res.days);
    } catch {
      // non-critical
    }
  }

  async function refreshStats() {
    try {
      const [overviewRes, trendRes, accRes] = await Promise.all([
        apiFetch<Overview>("/api/stats/overview"),
        apiFetch<{ days: TrendDay[] }>(`/api/stats/last7days?range=${trendRange}`),
        apiFetch<{ accounts: { id: string; name: string; type: string; balance: number | string }[] }>("/api/accounts"),
      ]);
      setOverview(overviewRes);
      setTrend(trendRes.days);
      setAccounts(accRes.accounts || []);
    } catch {
      // non-critical
    }
  }

  async function handleQuickAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!quickNoteTitle.trim() || quickNoteSaving) return;
    setQuickNoteSaving(true);
    try {
      const res = await apiFetch<{ note: any }>("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title: quickNoteTitle.trim(),
          content: quickNoteTitle.trim(),
          category: "General",
          color: "emerald",
        }),
      });
      setDashboardNotes((prev) => [res.note, ...prev]);
      setQuickNoteTitle("");
    } catch {
      alert("Failed to save quick note");
    } finally {
      setQuickNoteSaving(false);
    }
  }

  async function handleCreateFullNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteModalTitle.trim() || !noteModalContent.trim() || quickNoteSaving) return;
    setQuickNoteSaving(true);
    try {
      const res = await apiFetch<{ note: any }>("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title: noteModalTitle.trim(),
          content: noteModalContent.trim(),
          category: noteModalCategory,
          color: noteModalColor,
          isPinned: noteModalIsPinned,
        }),
      });
      setDashboardNotes((prev) => [res.note, ...prev]);
      setNoteModalOpen(false);
      setNoteModalTitle("");
      setNoteModalContent("");
      setNoteModalCategory("General");
      setNoteModalColor("emerald");
      setNoteModalIsPinned(false);
    } catch {
      alert("Failed to save note");
    } finally {
      setQuickNoteSaving(false);
    }
  }

  async function handleSubmitQuickEntry(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      if (entryType === "income") {
        if (!accountId) {
          alert("Please select the destination account to deposit income");
          setSubmitting(false);
          return;
        }
        await apiFetch(`/api/accounts/${accountId}/deposit`, {
          method: "POST",
          body: JSON.stringify({
            amount: num,
            source: incomeSource,
            note: description.trim() || undefined,
            date: new Date(`${expDate}T${expTime}`).toISOString(),
          }),
        });
        alert(isOnline ? "Income deposited into account successfully!" : "Saved offline! Income will sync when back online.");
      } else if (entryType === "transfer") {
        if (!accountId) {
          alert("Please select From account");
          setSubmitting(false);
          return;
        }
        if (!toAccountId || accountId === toAccountId) {
          alert("Please select a different destination account");
          setSubmitting(false);
          return;
        }
        await apiFetch("/api/accounts/transfer", {
          method: "POST",
          body: JSON.stringify({
            fromAccountId: accountId,
            toAccountId: toAccountId,
            amount: num,
            note: description.trim() || undefined,
          }),
        });
        alert(isOnline ? "Transfer completed successfully!" : "Saved offline! Transfer will sync when back online.");
      } else if (entryType === "shared") {
        const myPersonId = user?.selfPersonId || "self";

        // Prepare payments
        let paymentsPayload: { personId: string; amount: number }[] = [];
        if (payerMode === "single") {
          const pid = payerId === "self" || payerId === myPersonId ? user?.selfPersonId : payerId;
          if (!pid) {
            alert("Please select who paid");
            setSubmitting(false);
            return;
          }
          paymentsPayload = [{ personId: pid, amount: num }];
        } else {
          paymentsPayload = Object.entries(customPayments)
            .map(([pid, amtStr]) => {
              const actualId = pid === "self" || pid === myPersonId ? user?.selfPersonId : pid;
              return {
                personId: actualId || "",
                amount: parseFloat(amtStr) || 0,
              };
            })
            .filter((p) => p.personId && p.amount > 0);

          const sumPaid = paymentsPayload.reduce((s, p) => s + p.amount, 0);
          if (Math.abs(sumPaid - num) > 0.01) {
            alert(
              `Total paid (${symbol}${sumPaid.toFixed(2)}) must equal total amount (${symbol}${num.toFixed(2)}). Difference: ${symbol}${Math.abs(sumPaid - num).toFixed(2)}`
            );
            setSubmitting(false);
            return;
          }
        }

        // Prepare splits
        let splitsPayload: { personId: string; amount: number }[] = [];
        if (splitMode === "equal") {
          const splitArray = Array.from(splitSelected)
            .map((pid) => (pid === "self" || pid === myPersonId ? user?.selfPersonId! : pid))
            .filter(Boolean);

          if (splitArray.length === 0) {
            alert("Select at least one contact to split with");
            setSubmitting(false);
            return;
          }
          const splitsMap = calculateEqualSplits(num, splitArray, user?.selfPersonId);
          splitsPayload = splitArray.map((personId) => ({
            personId,
            amount: splitsMap[personId] ?? 0,
          }));
        } else {
          splitsPayload = Object.entries(customSplits)
            .map(([pid, amtStr]) => {
              const actualId = pid === "self" || pid === myPersonId ? user?.selfPersonId : pid;
              return {
                personId: actualId || "",
                amount: parseFloat(amtStr) || 0,
              };
            })
            .filter((s) => s.personId && s.amount > 0);

          const sumSplit = splitsPayload.reduce((s, x) => s + x.amount, 0);
          if (Math.abs(sumSplit - num) > 0.01) {
            alert(
              `Total split (${symbol}${sumSplit.toFixed(2)}) must equal total amount (${symbol}${num.toFixed(2)}). Difference: ${symbol}${Math.abs(sumSplit - num).toFixed(2)}`
            );
            setSubmitting(false);
            return;
          }
        }

        const myPayment = paymentsPayload.find((p) => p.personId === user?.selfPersonId);
        if (myPayment && myPayment.amount > 0 && !accountId) {
          const confirmNoAccount = confirm(
            "You haven't selected an account (Kaha se hoyi ha). Proceed without deducting from an account?"
          );
          if (!confirmNoAccount) {
            setSubmitting(false);
            return;
          }
        }

        if (editingId) {
          await apiFetch(`/api/expenses/${editingId}`, {
            method: "PATCH",
            body: JSON.stringify({
              amount: num,
              description: description.trim() || "Shared Expense",
              category: category || undefined,
              accountId: myPayment && myPayment.amount > 0 && accountId ? accountId : null,
              date: new Date(`${expDate}T${expTime}`).toISOString(),
              payments: paymentsPayload,
              splits: splitsPayload,
            }),
          });
          alert("Shared expense updated successfully!");
        } else {
          await apiFetch("/api/expenses", {
            method: "POST",
            body: JSON.stringify({
              isShared: true,
              amount: num,
              description: description.trim() || "Shared Expense",
              category: category || undefined,
              accountId: myPayment && myPayment.amount > 0 && accountId ? accountId : undefined,
              date: new Date(`${expDate}T${expTime}`).toISOString(),
              payments: paymentsPayload,
              splits: splitsPayload,
            }),
          });
          alert("Shared expense logged successfully!");
        }
        setEditingId(null);

        // Refresh expenses
        try {
          const expRes = await apiFetch<{ expenses: Expense[] }>("/api/expenses");
          if (expRes?.expenses) setExpenses(expRes.expenses);
        } catch {}
      } else {
        // Personal Expense
        const payload = {
          amount: num,
          description: description.trim() || "Expense",
          category: category || undefined,
          accountId: accountId || null,
          date: new Date(`${expDate}T${expTime}`).toISOString(),
        };
        if (editingId) {
          await apiFetch(`/api/expenses/${editingId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          setEditingId(null);
        } else {
          await apiFetch("/api/expenses", {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              isShared: false,
            }),
          });
        }
        try {
          const expRes = await apiFetch<{ expenses: Expense[] }>("/api/expenses");
          if (expRes?.expenses) setExpenses(expRes.expenses);
        } catch {}
      }

      setAmount("");
      setDescription("");
      setCategory("");
      setAccountId("");
      setToAccountId("");
      setPayerMode("single");
      setCustomPayments({});
      setSplitMode("equal");
      setCustomSplits({});
      setExpDate(new Date().toISOString().slice(0, 10));
      setExpTime(new Date().toTimeString().slice(0, 5));
      setQuickEntryOpen(false);
      await refreshStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEditClick(exp: Expense) {
    setEditingId(exp.id);
    setAmount(String(exp.amount));
    if (exp.account?.id) setAccountId(exp.account.id);
    setDescription(exp.description);
    setCategory(exp.category ?? "");
    const d = new Date(exp.date);
    setExpDate(d.toISOString().slice(0, 10));
    setExpTime(d.toTimeString().slice(0, 5));

    if (exp.isPersonal === false) {
      setEntryType("shared");
      if (exp.paidBy && exp.paidBy.length > 0) {
        if (exp.paidBy.length === 1) {
          setPayerMode("single");
          setPayerId(exp.paidBy[0].isSelf ? (user?.selfPersonId || "self") : exp.paidBy[0].personId);
          setCustomPayments({});
        } else {
          setPayerMode("multiple");
          const cp: Record<string, string> = {};
          for (const p of exp.paidBy) {
            const pid = p.isSelf ? (user?.selfPersonId || "self") : p.personId;
            cp[pid] = String(p.amount);
          }
          setCustomPayments(cp);
        }
      }
      if (exp.splitWith && exp.splitWith.length > 0) {
        const splitIds = new Set(
          exp.splitWith.map((s) => (s.isSelf ? (user?.selfPersonId || "self") : s.personId))
        );
        setSplitSelected(splitIds);
        const cs: Record<string, string> = {};
        for (const s of exp.splitWith) {
          const pid = s.isSelf ? (user?.selfPersonId || "self") : s.personId;
          cs[pid] = String(s.amount);
        }
        setCustomSplits(cs);
      }
    } else {
      setEntryType("expense");
    }

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
      await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      await refreshStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  // Unified & Grouped Expenses (personal & shared) - MUST be called unconditionally before early returns
  const filteredActivityExpenses = useMemo(() => {
    if (activityScope === "personal") {
      return expenses.filter((e) => e.isPersonal !== false);
    }
    return expenses;
  }, [expenses, activityScope]);

  const groupedDays = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const map: Record<
      string,
      {
        dateStr: string;
        label: string;
        subLabel: string;
        items: Expense[];
        totalDayAmount: number;
        totalDayShare: number;
      }
    > = {};

    for (const exp of filteredActivityExpenses) {
      const dStr = exp.date.slice(0, 10);
      if (!map[dStr]) {
        let label = "";
        if (dStr === todayStr) {
          label = "Today";
        } else if (dStr === yesterdayStr) {
          label = "Yesterday";
        } else {
          const dObj = new Date(dStr + "T00:00:00");
          label = dObj.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
        }

        const dObj = new Date(dStr + "T00:00:00");
        const subLabel = dObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        map[dStr] = {
          dateStr: dStr,
          label,
          subLabel,
          items: [],
          totalDayAmount: 0,
          totalDayShare: 0,
        };
      }

      map[dStr].items.push(exp);
      const amt = Number(exp.amount) || 0;
      const share = typeof exp.userShare === "number" ? exp.userShare : (exp.isPersonal !== false ? amt : 0);
      map[dStr].totalDayAmount += amt;
      map[dStr].totalDayShare += share;
    }

    return Object.values(map).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [filteredActivityExpenses]);

  const toggleDayAccordion = (dateStr: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateStr]: prev[dateStr] === undefined ? false : !prev[dateStr],
    }));
  };

  const toggleAllAccordions = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    for (const g of groupedDays) {
      updated[g.dateStr] = expand;
    }
    setExpandedDays(updated);
  };

  if (loading || userLoading || !user) {
    return (
      <AppLayout title="Dashboard" subtitle="Financial Pulse">
        <div className="py-24 text-center text-[#5A6863] dark:text-[#8E9C95] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-[#0F5C53] dark:border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-medium">Loading your dashboard...</p>
        </div>
      </AppLayout>
    );
  }

  const owedToYou = overview?.netByPerson.filter((p) => p.netBalance > 0) ?? [];
  const youOwe = overview?.netByPerson.filter((p) => p.netBalance < 0) ?? [];
  const totalYouOwe = Math.abs(youOwe.reduce((s, p) => s + p.netBalance, 0));
  const totalOwesYou = owedToYou.reduce((s, p) => s + p.netBalance, 0);
  const netTotal = (overview?.netByPerson ?? []).reduce((s, p) => s + p.netBalance, 0);

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Private Ledger #001"
      onAddEntry={() => setEntryChoiceOpen(true)}
      addEntryLabel="Add Expense"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Title Section matching Figma */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#0F5C53] dark:text-[#10B981] flex items-center gap-2">
              <span>Financial Pulse</span>
              <span>•</span>
              <span className="text-[#5A6863] dark:text-[#8E9C95]">Private Ledger #001</span>
            </div>
            <h1 className="font-serif font-bold text-3xl md:text-4xl text-[#162B27] dark:text-white tracking-tight mt-0.5">
              Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-[#5A6863] dark:text-[#8E9C95]">
            <span>Today, {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0F5C53] dark:bg-[#10B981]" />
                Personal
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E5A93C]" />
                Shared
              </span>
            </div>
          </div>
        </div>

        {/* Push Notification Banner for PWA Reminders */}
        <PushNotificationManager variant="banner" />

        {/* Top 3 Metric Cards matching Figma Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Total Liquidity & Net Position */}
          <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#5A6863] dark:text-[#8E9C95] uppercase tracking-wider">
                  Total Liquidity
                </span>
                <button
                  type="button"
                  onClick={() => setShowBalance(!showBalance)}
                  className="p-1 text-stone-400 hover:text-[#162B27] dark:hover:text-white cursor-pointer rounded-lg hover:bg-stone-100 dark:hover:bg-[#1A2229]"
                  title={showBalance ? "Hide balance" : "Show balance"}
                >
                  {showBalance ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="w-8 h-8 rounded-xl bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] flex items-center justify-center text-[#0F5C53] dark:text-[#10B981]">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="font-serif font-bold text-3xl text-[#162B27] dark:text-white">
                {showBalance
                  ? `${symbol}${Math.round(
                      accounts.reduce((acc, a) => acc + parseFloat(a.balance.toString() || "0"), 0)
                    ).toLocaleString()}`
                  : "••••••"}
              </div>
              <p className="text-xs text-[#5A6863] dark:text-[#8E9C95] mt-1.5 flex items-center gap-1.5">
                <span>Shared net:</span>
                <span className={`font-semibold ${netTotal >= 0 ? "text-[#1E7D46] dark:text-emerald-400" : "text-[#A8441F] dark:text-rose-400"}`}>
                  {netTotal >= 0 ? "+" : ""}{symbol}{Math.round(Math.abs(netTotal)).toLocaleString()}
                </span>
                <span>across {overview?.netByPerson.length ?? 0} contacts</span>
              </p>
            </div>
          </div>

          {/* Card 2: Today's Spend */}
          <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#5A6863] dark:text-[#8E9C95] uppercase tracking-wider">
                Today&apos;s Spending
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] flex items-center justify-center text-[#E5A93C]">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <div className="font-serif font-bold text-3xl text-[#162B27] dark:text-white">
                {symbol}{Math.round(overview?.today.total ?? 0).toLocaleString()}
              </div>
              <div className="mt-2.5 w-full bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] h-2 rounded-full overflow-hidden">
                <div className="bg-[#E5A93C] h-full rounded-full w-2/5" />
              </div>
              <p className="text-xs text-[#5A6863] dark:text-[#8E9C95] mt-1.5">
                {overview?.today.count ?? 0} {overview?.today.count === 1 ? "expense" : "expenses"} logged today
              </p>
            </div>
          </div>

          {/* Card 3: Next Settlement Card matching Figma Dark Green Card */}
          <div className="bg-[#0B3B36] dark:bg-[#092823] text-white border border-[#145C50] dark:border-[#134D41] rounded-3xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-200/90">
                Next Settlement
              </span>
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              </div>
            </div>

            <div className="my-3 relative z-10">
              {youOwe.length > 0 ? (
                <>
                  <h4 className="font-serif font-bold text-lg text-white">
                    {youOwe[0]?.name || "Payable"}
                  </h4>
                  <p className="text-xs text-emerald-100/80 mt-0.5">
                    You owe {symbol}{Math.round(Math.abs(youOwe[0].netBalance)).toLocaleString()} to {youOwe[0].name}
                  </p>
                </>
              ) : owedToYou.length > 0 ? (
                <>
                  <h4 className="font-serif font-bold text-lg text-white">
                    Receivable
                  </h4>
                  <p className="text-xs text-emerald-100/80 mt-0.5">
                    {owedToYou[0].name} owes you {symbol}{Math.round(owedToYou[0].netBalance).toLocaleString()}
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

            <div className="relative z-10">
              <button
                type="button"
                onClick={() => {
                  setShowGlobalSettle(true);
                  document.getElementById("dashboard-settlements-card")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="bg-white hover:bg-stone-100 text-[#0B3B36] dark:text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
              >
                <span className="text-[#0B3B36] dark:text-white">Settle Now →</span>
              </button>
            </div>
          </div>
        </div>

        {/* 7-Day / 30-Day Spending Trend Section matching Figma */}
        <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                {trendRange === "week" ? "7-Day Spending Trend" : "30-Day Spending Trend"}
              </h2>
              <p className="text-xs text-[#5A6863] dark:text-[#8E9C95] mt-0.5">
                Daily expenditure aggregate
              </p>
            </div>
            <div className="flex items-center gap-1 bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-1 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => handleRangeChange("week")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  trendRange === "week"
                    ? "bg-white dark:bg-[#13191E] text-[#0F5C53] dark:text-[#10B981] font-bold shadow-xs"
                    : "text-[#5A6863] dark:text-[#8E9C95] hover:text-[#162B27] dark:hover:text-white"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => handleRangeChange("month")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  trendRange === "month"
                    ? "bg-white dark:bg-[#13191E] text-[#0F5C53] dark:text-[#10B981] font-bold shadow-xs"
                    : "text-[#5A6863] dark:text-[#8E9C95] hover:text-[#162B27] dark:hover:text-white"
                }`}
              >
                Month
              </button>
            </div>
          </div>

          <div className="w-full h-60 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F5C53" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0F5C53" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8E9C95" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8E9C95" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#13191E",
                    border: "1px solid #1E2824",
                    borderRadius: "14px",
                    fontSize: "12px",
                    color: "#FFFFFF",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
                  }}
                  formatter={(value) => [`${symbol}${Math.round(Number(value ?? 0)).toLocaleString()}`, "Spent"]}
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
          <div className="lg:col-span-2 space-y-5 order-2 lg:order-1">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl p-4 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                    Activity Ledger
                  </h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] text-[#5A6863] dark:text-[#8E9C95]">
                    {filteredActivityExpenses.length} {activityScope === "all" ? "entries (all)" : "personal"}
                  </span>
                </div>
                <p className="text-xs text-[#5A6863] dark:text-[#8E9C95] mt-0.5">
                  Day-by-day expenditure across your personal & shared expenses
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Scope Switcher */}
                <div className="flex bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-0.5 rounded-xl text-xs">
                  <button
                    onClick={() => setActivityScope("all")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      activityScope === "all"
                        ? "bg-[#0F5C53] text-white shadow-xs"
                        : "text-[#5A6863] dark:text-[#8E9C95] hover:text-[#162B27] dark:hover:text-white"
                    }`}
                  >
                    All Everywhere
                  </button>
                  <button
                    onClick={() => setActivityScope("personal")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      activityScope === "personal"
                        ? "bg-[#0F5C53] text-white shadow-xs"
                        : "text-[#5A6863] dark:text-[#8E9C95] hover:text-[#162B27] dark:hover:text-white"
                    }`}
                  >
                    Personal Only
                  </button>
                </div>

                {/* Master Collapse / Expand Button */}
                <button
                  type="button"
                  onClick={() => setActivityCollapsed(!activityCollapsed)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] dark:bg-[#1A2229] hover:bg-stone-200/60 dark:hover:bg-[#202A25] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl text-xs font-semibold text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
                  title={activityCollapsed ? "Expand Activity Ledger" : "Collapse Activity Ledger"}
                >
                  <span>{activityCollapsed ? "Expand" : "Collapse"}</span>
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${activityCollapsed ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>

                {/* Link to Full Page */}
                <Link
                  href="/expenses"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] dark:bg-[#1A2229] hover:bg-[#0F5C53]/10 dark:hover:bg-[#10B981]/10 text-[#0F5C53] dark:text-[#10B981] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl text-xs font-semibold transition-colors"
                >
                  <span>Full Ledger</span>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Activity Ledger Body: Collapsed view or Accordion groups */}
            {activityCollapsed ? (
              <div className="p-4 bg-white dark:bg-[#13191E] border border-dashed border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl flex items-center justify-between text-xs text-[#5A6863] dark:text-[#8E9C95] shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">📋</span>
                  <span>Activity ledger is currently collapsed ({groupedDays.length} days recorded).</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActivityCollapsed(false)}
                  className="px-3 py-1.5 bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl text-xs font-semibold text-[#0F5C53] dark:text-[#10B981] hover:underline cursor-pointer"
                >
                  Tap to Expand
                </button>
              </div>
            ) : (
              <>
                {/* Quick Expand/Collapse toggles if groups exist */}
                {groupedDays.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-[#5A6863] dark:text-[#8E9C95] px-1">
                    <span>
                      {showAllDays
                        ? `Showing all ${groupedDays.length} recorded days`
                        : `Showing recent ${Math.min(2, groupedDays.length)} of ${groupedDays.length} days`}
                    </span>
                    <div className="flex items-center gap-3 font-medium">
                      <button
                        onClick={() => toggleAllAccordions(true)}
                        className="hover:text-[#0F5C53] dark:hover:text-[#10B981] cursor-pointer"
                      >
                        Expand All
                      </button>
                      <span>•</span>
                      <button
                        onClick={() => toggleAllAccordions(false)}
                        className="hover:text-[#0F5C53] dark:hover:text-[#10B981] cursor-pointer"
                      >
                        Collapse All
                      </button>
                    </div>
                  </div>
                )}

                {/* Day-by-Day Accordion Groups */}
                <div className="space-y-4">
                  {(showAllDays ? groupedDays : groupedDays.slice(0, 2)).map((group) => {
                    const isOpen = expandedDays[group.dateStr] !== false; // default open

                    return (
                      <div
                        key={group.dateStr}
                        className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl overflow-hidden shadow-xs transition-all"
                      >
                        {/* Day Accordion Header Button */}
                        <button
                          type="button"
                          onClick={() => toggleDayAccordion(group.dateStr)}
                          className="w-full px-4 py-3.5 bg-[#FAF8F5]/60 dark:bg-[#1A2229]/40 hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229]/80 border-b border-[#E5E0D8]/60 dark:border-[#1E2824]/60 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-6 h-6 rounded-lg bg-stone-200/60 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300 transition-transform duration-200 ${
                                isOpen ? "rotate-90" : ""
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-serif font-bold text-sm text-[#162B27] dark:text-white">
                                  {group.label}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-200/50 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                                  {group.items.length} {group.items.length === 1 ? "expense" : "expenses"}
                                </span>
                              </div>
                              <div className="text-[11px] text-stone-500 dark:text-stone-400">
                                {group.subLabel}
                              </div>
                            </div>
                          </div>

                          {/* Day summary totals */}
                          <div className="text-right">
                            <div className="text-xs font-bold text-[#0F5C53] dark:text-[#10B981]">
                              {symbol} {group.totalDayShare.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </div>
                            {group.totalDayAmount !== group.totalDayShare && (
                              <div className="text-[10px] text-stone-400">
                                total: {symbol} {group.totalDayAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                        </button>

                        {/* Day Items List */}
                        {isOpen && (
                          <div className="divide-y divide-[#E5E0D8]/40 dark:divide-[#1E2824]/40">
                            {group.items.map((exp) => {
                              const amt = typeof exp.amount === "number" ? exp.amount : parseFloat(exp.amount) || 0;
                              const share = exp.userShare !== undefined ? exp.userShare : amt;
                              const paid = exp.userPaid !== undefined ? exp.userPaid : (exp.isPersonal !== false ? amt : 0);

                              return (
                                <div
                                  key={exp.id}
                                  className="p-4 hover:bg-[#FAF8F5]/40 dark:hover:bg-[#1A2229]/30 transition-colors flex items-center justify-between gap-3 group"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-[#1A2229] border border-[#E5E0D8]/60 dark:border-[#1E2824]/60 flex items-center justify-center text-stone-600 dark:text-stone-300 shrink-0">
                                      {getCategoryIcon(exp.category)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-xs sm:text-sm text-[#162B27] dark:text-white truncate">
                                          {exp.description}
                                        </span>

                                        {/* Workspace or Personal Badge */}
                                        {exp.isPersonal === false ? (
                                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                            {exp.workspaceName || "Shared"}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-[#0F5C53] dark:text-[#10B981] border border-emerald-200 dark:border-emerald-800/60">
                                            Personal
                                          </span>
                                        )}

                                        {/* Funding Account Badge */}
                                        {exp.account && (
                                          <span
                                            className="text-[9px] font-medium px-1.5 py-0.5 rounded border flex items-center gap-1"
                                            style={{
                                              backgroundColor: exp.account.color ? `${exp.account.color}15` : undefined,
                                              borderColor: exp.account.color ? `${exp.account.color}40` : undefined,
                                              color: exp.account.color || undefined,
                                            }}
                                          >
                                            <span>💳</span>
                                            <span>{exp.account.name}</span>
                                          </span>
                                        )}
                                      </div>

                                      {/* Who paid info */}
                                      <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-2 mt-0.5">
                                        <span>{exp.category || "General"}</span>
                                        <span>•</span>
                                        <span>
                                          {exp.isPersonal !== false
                                            ? "You paid in full"
                                            : paid > 0 && share > 0
                                            ? `You paid ${symbol} ${paid.toFixed(0)} • your share ${symbol} ${share.toFixed(0)}`
                                            : paid > 0
                                            ? `You paid ${symbol} ${paid.toFixed(0)} for others`
                                            : `Paid by others • your share ${symbol} ${share.toFixed(0)}`}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0 flex items-center gap-3">
                                    <div>
                                      <div className="font-mono font-bold text-xs sm:text-sm text-[#162B27] dark:text-white">
                                        {symbol} {share.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                      </div>
                                      {amt !== share && (
                                        <div className="text-[10px] text-stone-400">
                                          total: {symbol} {amt.toFixed(0)}
                                        </div>
                                      )}
                                    </div>

                                    {/* Action dropdown or delete */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteExpense(exp.id)}
                                        className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-stone-400 hover:text-rose-600 rounded transition-colors"
                                        title="Delete expense"
                                      >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <polyline points="3 6 5 6 21 6" />
                                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Show All Days Toggle Button */}
                {groupedDays.length > 2 && (
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAllDays(!showAllDays)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-[#13191E] hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl text-xs font-semibold text-[#0F5C53] dark:text-[#10B981] shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>
                        {showAllDays ? "Show Recent 2 Days Only" : `Show All ${groupedDays.length} Recorded Days`}
                      </span>
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllDays ? "rotate-180" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <Link
                      href="/expenses"
                      className="text-xs font-semibold text-stone-500 hover:text-[#0F5C53] dark:text-stone-400 dark:hover:text-[#10B981] transition-colors"
                    >
                      View Full Expenses Page →
                    </Link>
                  </div>
                )}
              </>
            )}

            {filteredActivityExpenses.length === 0 && (
              <div className="bg-white dark:bg-[#13191E] border border-dashed border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl p-12 text-center text-[#5A6863] dark:text-[#8E9C95]">
                <p className="font-serif font-semibold text-base text-[#162B27] dark:text-white">
                  No expenses found
                </p>
                <p className="text-xs mt-1">
                  {activityScope === "all"
                    ? "Log a personal expense or shared workspace expense to see it here."
                    : "No personal expenses yet. Switch to 'All Everywhere' or add a new entry."}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Quick Entry & Settlements Widgets */}
          <div className="space-y-6 order-1 lg:order-2">
            {/* Quick Entry Card matching Figma */}
            <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 shadow-xs">
              <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white mb-3">
                Quick Entry
              </h3>

              {/* Segmented type switcher */}
              <div className="flex bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-1 rounded-xl mb-4 text-xs font-medium">
                {[
                  { key: "expense", label: "Personal" },
                  { key: "shared", label: "Shared" },
                  { key: "income", label: "Income" },
                  { key: "transfer", label: "Transfer" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setEntryType(t.key as any)}
                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                      entryType === t.key
                        ? "bg-white dark:bg-[#13191E] text-[#0F5C53] dark:text-[#10B981] font-bold shadow-xs"
                        : "text-[#5A6863] dark:text-[#8E9C95]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmitQuickEntry} className="space-y-3.5">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                    Amount ({symbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full text-2xl font-serif font-bold text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                  />
                </div>

                {(entryType === "expense" || entryType === "shared") && (
                  <>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                        What was this for?
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Groceries, Chai, Dinner"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                        Category
                      </label>
                      <CategorySelect value={category} onChange={setCategory} />
                    </div>
                  </>
                )}

                {entryType === "expense" && (
                  <div>
                    <AccountSelect value={accountId} onChange={setAccountId} label="Paid From (Kaha se hoyi ha)" />
                  </div>
                )}

                {entryType === "shared" && (
                  <SharedExpenseQuickFields
                    contacts={contacts}
                    onContactCreated={(newPerson) => setContacts((prev) => [...prev, newPerson])}
                    payerMode={payerMode}
                    setPayerMode={setPayerMode}
                    payerId={payerId}
                    setPayerId={setPayerId}
                    customPayments={customPayments}
                    setCustomPayments={setCustomPayments}
                    splitMode={splitMode}
                    setSplitMode={setSplitMode}
                    splitSelected={splitSelected}
                    setSplitSelected={setSplitSelected}
                    customSplits={customSplits}
                    setCustomSplits={setCustomSplits}
                    accountId={accountId}
                    setAccountId={setAccountId}
                    parsedAmount={parsedAmount}
                    symbol={symbol}
                    selfPersonId={user?.selfPersonId}
                    equalSplitsMap={equalSplitsMap}
                    selfPaidAmount={selfPaidAmount}
                    totalCustomPaid={totalCustomPaid}
                    totalCustomSplit={totalCustomSplit}
                  />
                )}

                {entryType === "income" && (
                  <>
                    <div>
                      <AccountSelect
                        value={accountId}
                        onChange={setAccountId}
                        label="Deposit Into Account (Kaha aayenge)"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                        Income Source
                      </label>
                      <select
                        value={incomeSource}
                        onChange={(e) => setIncomeSource(e.target.value)}
                        className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                      >
                        <option value="Salary">Salary (تنخواہ)</option>
                        <option value="Freelance">Freelance / Contract</option>
                        <option value="Profit">Business Profit / Dividend</option>
                        <option value="Cash Deposit">Cash Deposit (کیش جمع)</option>
                        <option value="Gift">Gift / Transfer</option>
                        <option value="Other">Other Income</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                        Note / Description (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Monthly salary from TechCorp"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                      />
                    </div>
                  </>
                )}

                {entryType === "transfer" && (
                  <>
                    <div>
                      <AccountSelect
                        value={accountId}
                        onChange={setAccountId}
                        label="From Account (Kaha se)"
                        required
                      />
                    </div>

                    <div>
                      <AccountSelect
                        value={toAccountId}
                        onChange={setToAccountId}
                        label="To Account (Kaha par)"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                        Transfer Note (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ATM withdrawal to cash wallet"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                      />
                    </div>
                  </>
                )}

                {entryType !== "transfer" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">Date</label>
                      <input
                        type="date"
                        value={expDate}
                        onChange={(e) => setExpDate(e.target.value)}
                        required
                        className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">Time</label>
                      <input
                        type="time"
                        value={expTime}
                        onChange={(e) => setExpTime(e.target.value)}
                        required
                        className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-3 rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting
                      ? "Processing..."
                      : !isOnline
                      ? "💾 Save Offline"
                      : entryType === "income"
                      ? "+ Deposit Income"
                      : entryType === "transfer"
                      ? "Transfer Funds →"
                      : entryType === "shared"
                      ? "+ Log Shared Expense"
                      : editingId
                      ? "Update Entry"
                      : "+ Save Expense"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="w-full mt-2 text-xs text-[#5A6863] dark:text-[#8E9C95] hover:text-[#162B27] dark:hover:text-white underline cursor-pointer"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Settlements Card matching Figma */}
            <div id="dashboard-settlements-card" className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                  Settlements
                </h3>
                <Link
                  href="/people"
                  className="text-xs font-semibold text-[#0F5C53] dark:text-[#10B981] hover:underline"
                >
                  Contacts →
                </Link>
              </div>

              {/* You Owe Section */}
              <div className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#5A6863] dark:text-[#8E9C95]">
                    You Owe
                  </span>
                  <span className="font-serif font-bold text-base text-[#A8441F] dark:text-rose-400">
                    {symbol}{Math.round(totalYouOwe).toLocaleString()}
                  </span>
                </div>
                {youOwe.length === 0 ? (
                  <p className="text-xs text-[#5A6863] dark:text-[#8E9C95]">You don&apos;t owe anyone.</p>
                ) : (
                  <div className="space-y-1.5">
                    {youOwe.map((p) => (
                      <div key={p.personId} className="flex items-center justify-between text-xs py-1.5 border-b border-[#FAF8F5] dark:border-[#1E2824]">
                        <span className="text-[#162B27] dark:text-white font-medium">• {p.name}</span>
                        <span className="font-semibold text-[#A8441F] dark:text-rose-400">{symbol}{Math.round(Math.abs(p.netBalance)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Owes You Section */}
              <div className="mb-5">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#5A6863] dark:text-[#8E9C95]">
                    Owes You
                  </span>
                  <span className="font-serif font-bold text-base text-[#1E7D46] dark:text-emerald-400">
                    {symbol}{Math.round(totalOwesYou).toLocaleString()}
                  </span>
                </div>
                {owedToYou.length === 0 ? (
                  <p className="text-xs text-[#5A6863] dark:text-[#8E9C95]">Nobody owes you anything.</p>
                ) : (
                  <div className="space-y-1.5">
                    {owedToYou.map((p) => (
                      <div key={p.personId} className="flex items-center justify-between text-xs py-1.5 border-b border-[#FAF8F5] dark:border-[#1E2824]">
                        <span className="text-[#162B27] dark:text-white font-medium">• {p.name}</span>
                        <span className="font-semibold text-[#1E7D46] dark:text-emerald-400">{symbol}{Math.round(p.netBalance).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#F0ECE6] dark:border-[#1E2824]">
                <button
                  onClick={() => setShowGlobalSettle(!showGlobalSettle)}
                  className="w-full bg-[#FAF8F5] dark:bg-[#1A2229] hover:bg-[#F2EEE9] dark:hover:bg-[#202925] border border-[#E5E0D8] dark:border-[#1E2824] text-[#162B27] dark:text-white py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  {showGlobalSettle ? "Hide Global Settlement" : "Record Global Settlement"}
                </button>
              </div>

              {/* Collapsible Global Settlement Engine */}
              {showGlobalSettle && (
                <div className="mt-4 pt-4 border-t border-[#F0ECE6] dark:border-[#1E2824]">
                  <GlobalSettlementSection
                    selfPersonId={user.selfPersonId || ""}
                    onSettled={refreshStats}
                  />
                </div>
              )}
            </div>

            {/* Lena / Dena Running Ledger per Contact */}
            <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-lg text-[#162B27] dark:text-white">
                  Lena / Dena History
                </h3>
                <Link href="/people" className="text-xs font-semibold text-[#0F5C53] dark:text-[#10B981] hover:underline">
                  Contacts →
                </Link>
              </div>
              <p className="text-xs text-[#5A6863] dark:text-[#8E9C95] mb-3">
                Click a contact to inspect running transaction deltas.
              </p>
              {overview?.netByPerson.length === 0 ? (
                <p className="text-xs text-[#5A6863] dark:text-[#8E9C95]">All settled up.</p>
              ) : (
                <div className="divide-y divide-[#F0ECE6] dark:divide-[#1E2824]">
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

            {/* Quick Notes Card on Dashboard */}
            <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">📝</span>
                  <h3 className="font-serif font-bold text-lg text-[#162B27] dark:text-white">
                    Quick Notes
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNoteModalOpen(true)}
                    className="text-xs font-semibold text-[#0F5C53] dark:text-[#10B981] hover:underline cursor-pointer"
                  >
                    + Note
                  </button>
                  <span className="text-stone-300 dark:text-stone-700">•</span>
                  <Link
                    href="/notes"
                    className="text-xs font-semibold text-[#0F5C53] dark:text-[#10B981] hover:underline"
                  >
                    All Notes →
                  </Link>
                </div>
              </div>

              {/* Instant inline quick-add input */}
              <form onSubmit={handleQuickAddNote} className="flex items-center gap-2">
                <input
                  type="text"
                  value={quickNoteTitle}
                  onChange={(e) => setQuickNoteTitle(e.target.value)}
                  placeholder="Jot down a quick note & hit Enter..."
                  className="flex-1 bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2 text-xs text-[#162B27] dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                />
                <button
                  type="submit"
                  disabled={quickNoteSaving || !quickNoteTitle.trim()}
                  className="bg-[#0F5C53] hover:bg-[#0C4A43] text-white px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex-shrink-0"
                >
                  {quickNoteSaving ? "..." : "+ Add"}
                </button>
              </form>

              {/* Recent / Pinned Notes List */}
              {dashboardNotes.length === 0 ? (
                <p className="text-xs text-[#5A6863] dark:text-[#8E9C95] italic">
                  No notes yet. Type above to quickly record a reminder or agreement.
                </p>
              ) : (
                <div className="divide-y divide-[#F0ECE6] dark:divide-[#1E2824]">
                  {dashboardNotes.slice(0, 3).map((note) => {
                    const isExpanded = expandedDashboardNoteId === note.id;
                    return (
                      <div key={note.id} className="py-2.5 space-y-1">
                        <div
                          onClick={() => setExpandedDashboardNoteId(isExpanded ? null : note.id)}
                          className="flex items-center justify-between cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {note.isPinned && <span className="text-xs">📌</span>}
                            <span className="font-semibold text-xs text-[#162B27] dark:text-white truncate group-hover:text-[#0F5C53] dark:group-hover:text-[#34D399]">
                              {note.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#8E9C95] flex-shrink-0 ml-2">
                            {new Date(note.date || note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        {isExpanded ? (
                          <div className="text-xs text-[#5A6863] dark:text-[#9AA5A0] bg-[#FAF8F5] dark:bg-[#1A2229] p-2.5 rounded-xl whitespace-pre-wrap">
                            {note.content}
                          </div>
                        ) : (
                          <p
                            onClick={() => setExpandedDashboardNoteId(note.id)}
                            className="text-[11px] text-[#5A6863] dark:text-[#8E9C95] truncate cursor-pointer"
                          >
                            {note.content}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Action Button (+) matching Figma Dashboard.png */}
      <button
        onClick={() => setEntryChoiceOpen(true)}
        className="fixed md:hidden bottom-20 right-5 w-14 h-14 rounded-2xl bg-[#0F5C53] hover:bg-[#0A3F38] text-white shadow-lg flex items-center justify-center z-40 active:scale-95 cursor-pointer transition-all"
        aria-label="Add expense"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Dual-Choice Modal: Personal vs Shared Workspace Expense */}
      {entryChoiceOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEntryChoiceOpen(false);
            }}
          >
            <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-t-3xl sm:rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 my-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#162B27] dark:text-white">
                    Add New Entry
                  </h3>
                  <p className="text-xs text-[#5A6863] dark:text-[#8E9C95] mt-0.5">
                    How would you like to record this?
                  </p>
                </div>
                <button
                  onClick={() => setEntryChoiceOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer rounded-lg hover:bg-stone-100 dark:hover:bg-[#1A2229]"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {/* Option 1: Personal Expense */}
                <button
                  type="button"
                  onClick={() => {
                    setEntryType("expense");
                    setEntryChoiceOpen(false);
                    setQuickEntryOpen(true);
                  }}
                  className="w-full p-4 rounded-2xl border border-[#E5E0D8] dark:border-[#1E2824] bg-[#FAF8F5] dark:bg-[#182026] hover:border-[#0F5C53] dark:hover:border-[#10B981] flex items-center justify-between text-left group transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#0F5C53]/10 dark:bg-[#10B981]/20 border border-[#0F5C53]/20 flex items-center justify-center text-[#0F5C53] dark:text-[#34D399] flex-shrink-0 group-hover:scale-105 transition-transform">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#162B27] dark:text-white">
                        Personal Expense
                      </h4>
                      <p className="text-[11px] text-[#5A6863] dark:text-[#8E9C95] mt-0.5">
                        Your private transactions, food, fuel, bills
                      </p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-stone-400 group-hover:text-[#0F5C53] dark:group-hover:text-[#34D399] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* Option 2: Shared Expense */}
                <button
                  type="button"
                  onClick={() => {
                    setEntryType("shared");
                    setEntryChoiceOpen(false);
                    setQuickEntryOpen(true);
                  }}
                  className="w-full p-4 rounded-2xl border border-[#E5E0D8] dark:border-[#1E2824] bg-[#FAF8F5] dark:bg-[#182026] hover:border-amber-500 flex items-center justify-between text-left group transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#162B27] dark:text-white">
                        Shared Expense
                      </h4>
                      <p className="text-[11px] text-[#5A6863] dark:text-[#8E9C95] mt-0.5">
                        Split bill with contacts, friends, roommates
                      </p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-stone-400 group-hover:text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Quick Entry Modal when triggered from Top Header "+ Add Entry" or Mobile "+" */}
      {quickEntryOpen && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-t-3xl sm:rounded-3xl p-6 max-w-lg w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                {editingId ? "Edit Expense" : "New Entry"}
              </h3>
              <button
                onClick={() => {
                  setQuickEntryOpen(false);
                  if (editingId) handleCancelEdit();
                }}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Segmented control inside modal to switch type anytime */}
            {!editingId && (
              <div className="flex bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-1 rounded-xl mb-4 text-xs font-medium">
                {[
                  { key: "expense", label: "Personal" },
                  { key: "shared", label: "Shared" },
                  { key: "income", label: "Income" },
                  { key: "transfer", label: "Transfer" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setEntryType(t.key as any)}
                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                      entryType === t.key
                        ? "bg-white dark:bg-[#13191E] text-[#0F5C53] dark:text-[#10B981] font-bold shadow-xs"
                        : "text-[#5A6863] dark:text-[#8E9C95]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmitQuickEntry} className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                  Amount ({symbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  className="w-full text-2xl font-serif font-bold text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                />
              </div>

              {(entryType === "expense" || entryType === "shared") && (
                <>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                      What was this for?
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Groceries, Blue Tokai Coffee, Dinner"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                      Category
                    </label>
                    <CategorySelect value={category} onChange={setCategory} />
                  </div>
                </>
              )}

              {entryType === "expense" && (
                <div>
                  <AccountSelect value={accountId} onChange={setAccountId} label="Paid From (Kaha se hoyi ha)" />
                </div>
              )}

              {entryType === "shared" && (
                <SharedExpenseQuickFields
                  contacts={contacts}
                  onContactCreated={(newPerson) => setContacts((prev) => [...prev, newPerson])}
                  payerMode={payerMode}
                  setPayerMode={setPayerMode}
                  payerId={payerId}
                  setPayerId={setPayerId}
                  customPayments={customPayments}
                  setCustomPayments={setCustomPayments}
                  splitMode={splitMode}
                  setSplitMode={setSplitMode}
                  splitSelected={splitSelected}
                  setSplitSelected={setSplitSelected}
                  customSplits={customSplits}
                  setCustomSplits={setCustomSplits}
                  accountId={accountId}
                  setAccountId={setAccountId}
                  parsedAmount={parsedAmount}
                  symbol={symbol}
                  selfPersonId={user?.selfPersonId}
                  equalSplitsMap={equalSplitsMap}
                  selfPaidAmount={selfPaidAmount}
                  totalCustomPaid={totalCustomPaid}
                  totalCustomSplit={totalCustomSplit}
                />
              )}

              {entryType === "income" && (
                <>
                  <div>
                    <AccountSelect
                      value={accountId}
                      onChange={setAccountId}
                      label="Deposit Into Account (Kaha aayenge)"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                      Income Source
                    </label>
                    <select
                      value={incomeSource}
                      onChange={(e) => setIncomeSource(e.target.value)}
                      className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                    >
                      <option value="Salary">Salary (تنخواہ)</option>
                      <option value="Freelance">Freelance / Contract</option>
                      <option value="Profit">Business Profit / Dividend</option>
                      <option value="Cash Deposit">Cash Deposit (کیش جمع)</option>
                      <option value="Gift">Gift / Transfer</option>
                      <option value="Other">Other Income</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                      Note / Description (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Monthly salary from TechCorp"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                    />
                  </div>
                </>
              )}

              {entryType === "transfer" && (
                <>
                  <div>
                    <AccountSelect
                      value={accountId}
                      onChange={setAccountId}
                      label="From Account (Kaha se)"
                      required
                    />
                  </div>

                  <div>
                    <AccountSelect
                      value={toAccountId}
                      onChange={setToAccountId}
                      label="To Account (Kaha par)"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                      Transfer Note (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ATM withdrawal to cash wallet"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                    />
                  </div>
                </>
              )}

              {entryType !== "transfer" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">Date</label>
                    <input
                      type="date"
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      required
                      className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] text-[#162B27] dark:text-white border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">Time</label>
                    <input
                      type="time"
                      value={expTime}
                      onChange={(e) => setExpTime(e.target.value)}
                      required
                      className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] text-[#162B27] dark:text-white border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickEntryOpen(false);
                    if (editingId) handleCancelEdit();
                  }}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#5A6863] dark:text-[#8E9C95] hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : !isOnline
                    ? "💾 Save Offline"
                    : entryType === "income"
                    ? "+ Deposit Income"
                    : entryType === "transfer"
                    ? "Transfer Funds →"
                    : entryType === "shared"
                    ? "+ Log Shared Expense"
                    : editingId
                    ? "Update Entry"
                    : "+ Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Quick Note Modal on Dashboard */}
      {noteModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE6] dark:border-[#1E2824]">
                <div>
                  <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                    New Quick Note
                  </h3>
                  <p className="text-xs text-[#5A6863] dark:text-[#8E9C95] mt-0.5">
                    Save a memorandum, reminder, or agreement
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateFullNote} className="space-y-3.5">
                <div>
                  <label className="text-[11px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={noteModalTitle}
                    onChange={(e) => setNoteModalTitle(e.target.value)}
                    placeholder="e.g. Return 1000 to Razaq, Rent receipt"
                    className="w-full text-sm font-semibold text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53]"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                    Details
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={noteModalContent}
                    onChange={(e) => setNoteModalContent(e.target.value)}
                    placeholder="Write your note, commitments, or details..."
                    className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl p-3 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block mb-1">
                      Category
                    </label>
                    <select
                      value={noteModalCategory}
                      onChange={(e) => setNoteModalCategory(e.target.value)}
                      className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
                    >
                      <option value="General">General</option>
                      <option value="Financial">Financial</option>
                      <option value="Reminder">Reminder</option>
                      <option value="Agreement">Agreement</option>
                      <option value="Checklist">Checklist</option>
                      <option value="Personal">Personal</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noteModalIsPinned}
                        onChange={(e) => setNoteModalIsPinned(e.target.checked)}
                        className="w-4 h-4 text-[#0F5C53] rounded border-stone-300 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-[#162B27] dark:text-white">
                        Pin note 📌
                      </span>
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0ECE6] dark:border-[#1E2824] flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNoteModalOpen(false)}
                    className="w-1/3 py-2.5 text-xs font-semibold text-[#5A6863] dark:text-[#8E9C95] hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229] rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={quickNoteSaving}
                    className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {quickNoteSaving ? "Saving..." : "+ Save Note"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </AppLayout>
  );
}