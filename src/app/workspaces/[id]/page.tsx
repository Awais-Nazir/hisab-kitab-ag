"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { CategorySelect } from "@/components/CategorySelect";
import { AccountSelect } from "@/components/AccountSelect";
import { AppLayout } from "@/components/AppLayout";
import { useCurrency } from "@/context/CurrencyContext";
import { calculateEqualSplits } from "@/lib/splits";

interface Person {
  id: string;
  name: string;
  email: string | null;
  isSelf?: boolean;
}

interface Member {
  personId: string;
  person: Person;
}

interface Split {
  personId: string;
  shareAmount: string;
  person: Person;
}

interface Payment {
  personId: string;
  amountPaid: string;
  person: Person;
}

interface AccountInfo {
  id: string;
  name: string;
  type: string;
  color?: string | null;
  icon?: string | null;
}

interface Expense {
  id: string;
  amount: string;
  description: string;
  category: string | null;
  accountId?: string | null;
  account?: AccountInfo | null;
  date: string;
  splits: Split[];
  payments: Payment[];
}

interface Balance {
  personId: string;
  name: string;
  isSelf: boolean;
  netBalance: number;
}

interface Settlement {
  id: string;
  amount: string;
  date: string;
  note: string | null;
  accountId?: string | null;
  account?: AccountInfo | null;
  fromPerson: Person;
  toPerson: Person;
}

interface DateGroup {
  label: string;
  dateKey: string;
  expenses: Expense[];
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeStr() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

function getCategoryIcon(cat: string | null) {
  const c = (cat || "").toLowerCase();
  if (c.includes("grocer") || c.includes("shop") || c.includes("mart")) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
      </svg>
    );
  }
  if (c.includes("bill") || c.includes("util") || c.includes("electr") || c.includes("rent") || c.includes("wifi")) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    );
  }
  if (c.includes("food") || c.includes("eat") || c.includes("din") || c.includes("swiggy") || c.includes("zomato")) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />
      </svg>
    );
  }
  if (c.includes("travel") || c.includes("cab") || c.includes("fuel") || c.includes("transport") || c.includes("uber")) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
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

function groupExpensesByDate(expenses: Expense[]): DateGroup[] {
  const groups: Record<string, Expense[]> = {};
  const todayStr = new Date().toISOString().slice(0, 10);
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yestStr = yest.toISOString().slice(0, 10);

  for (const exp of expenses) {
    const key = exp.date ? exp.date.slice(0, 10) : todayStr;
    if (!groups[key]) groups[key] = [];
    groups[key].push(exp);
  }

  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((key) => {
    let label = key;
    if (key === todayStr) {
      label = "Today";
    } else if (key === yestStr) {
      label = "Yesterday";
    } else {
      const d = new Date(key + "T12:00:00");
      label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
      });
    }
    return {
      label,
      dateKey: key,
      expenses: groups[key],
    };
  });
}

interface SettlementDateGroup {
  label: string;
  dateKey: string;
  settlements: Settlement[];
}

function groupSettlementsByDate(settlements: Settlement[]): SettlementDateGroup[] {
  const groups: Record<string, Settlement[]> = {};
  const todayStr = new Date().toISOString().slice(0, 10);
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yestStr = yest.toISOString().slice(0, 10);

  for (const s of settlements) {
    const key = s.date ? s.date.slice(0, 10) : todayStr;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }

  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((key) => {
    let label = key;
    if (key === todayStr) {
      label = "Today";
    } else if (key === yestStr) {
      label = "Yesterday";
    } else {
      const d = new Date(key + "T12:00:00");
      label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
      });
    }
    return {
      label,
      dateKey: key,
      settlements: groups[key],
    };
  });
}

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { symbol } = useCurrency();

  const [workspaceName, setWorkspaceName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [contacts, setContacts] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab filter: all | expenses | settlements
  const [filterTab, setFilterTab] = useState<"all" | "expenses" | "settlements">("all");

  // Expense Modal / Form state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [expDate, setExpDate] = useState(todayDateStr);
  const [expTime, setExpTime] = useState(nowTimeStr);
  const [accountId, setAccountId] = useState("");
  const [submittingExp, setSubmittingExp] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Payer Configuration: "single" | "multiple"
  const [payerMode, setPayerMode] = useState<"single" | "multiple">("single");
  const [payerId, setPayerId] = useState("");
  const [customPayments, setCustomPayments] = useState<Record<string, string>>({});

  // Split Configuration: "equal" | "custom"
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [splitSelected, setSplitSelected] = useState<Set<string>>(new Set());
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  // Settlement Form State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [editingSettlementId, setEditingSettlementId] = useState<string | null>(null);
  const [settleFrom, setSettleFrom] = useState("");
  const [settleTo, setSettleTo] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDate, setSettleDate] = useState(todayDateStr);
  const [settleAccountId, setSettleAccountId] = useState("");
  const [settling, setSettling] = useState(false);

  // Add Member State
  const [selectedContactId, setSelectedContactId] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const selfMember = members.find((m) => m.person.isSelf);
  const selfPersonId = selfMember?.personId;

  async function loadData() {
    if (!id) return;
    try {
      const [wsRes, expRes, balRes, setRes, peopleRes] = await Promise.all([
        apiFetch<{ members: Member[]; workspace?: { name: string } }>(`/api/workspaces/${id}/members`),
        apiFetch<{ expenses: Expense[] }>(`/api/workspaces/${id}/expenses`),
        apiFetch<{ balances: Balance[] }>(`/api/workspaces/${id}/balances`),
        apiFetch<{ settlements: Settlement[] }>(`/api/workspaces/${id}/settlements`),
        apiFetch<{ people: Person[] }>("/api/people"),
      ]);
      setWorkspaceName(wsRes.workspace?.name || "Workspace");
      setMembers(wsRes.members || []);
      setExpenses(expRes.expenses || []);
      setBalances(balRes.balances || []);
      setSettlements(setRes.settlements || []);
      setContacts(peopleRes.people || []);

      // Default payer and splits if empty
      if (wsRes.members && wsRes.members.length > 0) {
        const selfMem = wsRes.members.find((m) => m.person.isSelf);
        if (!payerId) {
          setPayerId(selfMem?.personId || wsRes.members[0].personId);
        }
        if (splitSelected.size === 0) {
          setSplitSelected(new Set(wsRes.members.map((m) => m.personId)));
        }
      }
    } catch (err) {
      console.error("Failed to load workspace data:", err);
      if (err instanceof Error && (err.message.includes("404") || err.message.includes("Not found"))) {
        router.push("/workspaces");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Compute Tug of War position
  const selfBalanceObj = balances.find((b) => b.isSelf);
  const myNet = selfBalanceObj?.netBalance ?? 0;

  // Total workspace spending
  const totalSpend = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  // Fair share and amount paid by self
  let myPaid = 0;
  let myShare = 0;
  for (const exp of expenses) {
    const paidEntry = exp.payments.find((p) => p.person.isSelf);
    if (paidEntry) myPaid += parseFloat(paidEntry.amountPaid);

    const splitEntry = exp.splits.find((s) => s.person.isSelf);
    if (splitEntry) myShare += parseFloat(splitEntry.shareAmount);
  }

  // Max range for Tug of War balance slider
  const maxBalanceRange = Math.max(
    500,
    ...balances.map((b) => Math.abs(b.netBalance) * 1.3)
  );
  const tiltPercent = Math.max(5, Math.min(95, 50 + (myNet / maxBalanceRange) * 50));

  // Compute equal split map live (with integer rounding and extra remainder to "Me")
  const parsedAmount = parseFloat(amount) || 0;
  const equalSplitsMap = useMemo(() => {
    return calculateEqualSplits(parsedAmount, Array.from(splitSelected), selfPersonId);
  }, [parsedAmount, splitSelected, selfPersonId]);

  // Check how much "Me" paid in the modal
  const selfPaidAmountInModal = useMemo(() => {
    if (payerMode === "single") {
      return payerId === selfPersonId ? parsedAmount : 0;
    }
    return parseFloat(customPayments[selfPersonId || ""] || "0") || 0;
  }, [payerMode, payerId, selfPersonId, parsedAmount, customPayments]);

  // Custom Paid sum & difference
  const totalCustomPaid = useMemo(() => {
    return Object.values(customPayments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }, [customPayments]);

  // Custom Split sum & difference
  const totalCustomSplit = useMemo(() => {
    return Object.values(customSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }, [customSplits]);

  function resetExpenseForm() {
    setEditingExpenseId(null);
    setAmount("");
    setDescription("");
    setCategory("");
    setAccountId("");
    setExpDate(todayDateStr());
    setExpTime(nowTimeStr());
    setPayerMode("single");
    const selfMem = members.find((m) => m.person.isSelf);
    setPayerId(selfMem?.personId || (members[0]?.personId ?? ""));
    setCustomPayments({});
    setSplitMode("equal");
    setSplitSelected(new Set(members.map((m) => m.personId)));
    setCustomSplits({});
  }

  function handleOpenEdit(exp: Expense) {
    setEditingExpenseId(exp.id);
    setAmount(exp.amount);
    setDescription(exp.description);
    setCategory(exp.category || "");
    setAccountId(exp.accountId || "");
    setExpDate(exp.date.slice(0, 10));
    setExpTime(exp.date.slice(11, 16));

    // Configure Payer
    if (exp.payments.length === 1) {
      setPayerMode("single");
      setPayerId(exp.payments[0].personId);
      setCustomPayments({});
    } else {
      setPayerMode("multiple");
      const cPay: Record<string, string> = {};
      exp.payments.forEach((p) => {
        cPay[p.personId] = p.amountPaid;
      });
      setCustomPayments(cPay);
    }

    // Configure Split
    const expAmt = parseFloat(exp.amount) || 0;
    const splitIds = exp.splits.map((s) => s.personId);
    const expectedEqual = calculateEqualSplits(expAmt, splitIds, selfPersonId);
    const isExactEqual = exp.splits.every(
      (s) => Math.abs(parseFloat(s.shareAmount) - (expectedEqual[s.personId] ?? 0)) < 0.01
    );

    if (isExactEqual) {
      setSplitMode("equal");
      setSplitSelected(new Set(splitIds));
      setCustomSplits({});
    } else {
      setSplitMode("custom");
      const cSplit: Record<string, string> = {};
      exp.splits.forEach((s) => {
        cSplit[s.personId] = s.shareAmount;
      });
      setCustomSplits(cSplit);
      setSplitSelected(new Set(splitIds));
    }

    setIsExpenseModalOpen(true);
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (submittingExp) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    // Prepare payments
    let paymentsPayload: { personId: string; amount: number }[] = [];
    if (payerMode === "single") {
      if (!payerId) {
        alert("Please select who paid for the expense");
        return;
      }
      paymentsPayload = [{ personId: payerId, amount: numAmount }];
    } else {
      paymentsPayload = members
        .map((m) => ({
          personId: m.personId,
          amount: parseFloat(customPayments[m.personId] || "0") || 0,
        }))
        .filter((p) => p.amount > 0);

      const sumPaid = paymentsPayload.reduce((s, p) => s + p.amount, 0);
      if (Math.abs(sumPaid - numAmount) > 0.01) {
        alert(
          `Total paid (${symbol}${sumPaid.toFixed(2)}) must equal total amount (${symbol}${numAmount.toFixed(2)}). Difference: ${symbol}${Math.abs(sumPaid - numAmount).toFixed(2)}`
        );
        return;
      }
    }

    // Prepare splits
    let splitsPayload: { personId: string; amount: number }[] = [];
    if (splitMode === "equal") {
      const splitArray = Array.from(splitSelected);
      if (splitArray.length === 0) {
        alert("Select at least one member to split with");
        return;
      }
      const splitsMap = calculateEqualSplits(numAmount, splitArray, selfPersonId);
      splitsPayload = splitArray.map((personId) => ({
        personId,
        amount: splitsMap[personId] ?? 0,
      }));
    } else {
      splitsPayload = members
        .map((m) => ({
          personId: m.personId,
          amount: parseFloat(customSplits[m.personId] || "0") || 0,
        }))
        .filter((s) => s.amount > 0);

      const sumSplit = splitsPayload.reduce((s, x) => s + x.amount, 0);
      if (Math.abs(sumSplit - numAmount) > 0.01) {
        alert(
          `Total split (${symbol}${sumSplit.toFixed(2)}) must equal total amount (${symbol}${numAmount.toFixed(2)}). Difference: ${symbol}${Math.abs(sumSplit - numAmount).toFixed(2)}`
        );
        return;
      }
    }

    // Check if account is required when "Me" paid
    const myPayment = paymentsPayload.find((p) => p.personId === selfPersonId);
    if (myPayment && myPayment.amount > 0 && !accountId) {
      const confirmNoAccount = confirm("You haven't selected an account (Kaha se hoyi ha). Proceed without deducting from an account?");
      if (!confirmNoAccount) return;
    }

    setSubmittingExp(true);
    try {
      const payload = {
        amount: numAmount,
        description,
        category: category || undefined,
        accountId: myPayment && myPayment.amount > 0 && accountId ? accountId : undefined,
        date: new Date(`${expDate}T${expTime}`).toISOString(),
        payments: paymentsPayload,
        splits: splitsPayload,
      };

      if (editingExpenseId) {
        await apiFetch(`/api/workspaces/${id}/expenses/${editingExpenseId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/workspaces/${id}/expenses`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      resetExpenseForm();
      setIsExpenseModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save shared expense");
    } finally {
      setSubmittingExp(false);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!confirm("Delete this shared expense?")) return;
    try {
      await apiFetch(`/api/workspaces/${id}/expenses/${expenseId}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete expense");
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContactId || addingMember) return;
    setAddingMember(true);
    try {
      await apiFetch(`/api/workspaces/${id}/members`, {
        method: "POST",
        body: JSON.stringify({ personId: selectedContactId }),
      });
      setSelectedContactId("");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  }

  function handleOpenEditSettle(s: Settlement) {
    setEditingSettlementId(s.id);
    setSettleFrom(s.fromPerson.id);
    setSettleTo(s.toPerson.id);
    setSettleAmount(Math.round(parseFloat(s.amount)).toString());
    setSettleAccountId(s.accountId || "");
    setSettleDate(s.date ? s.date.slice(0, 10) : todayDateStr());
    setIsSettleModalOpen(true);
  }

  async function handleSubmitSettle(e: React.FormEvent) {
    e.preventDefault();
    if (settling || !settleFrom || !settleTo || settleFrom === settleTo) return;
    setSettling(true);
    try {
      const payload = {
        fromPersonId: settleFrom,
        toPersonId: settleTo,
        amount: parseFloat(settleAmount),
        accountId: settleAccountId || undefined,
        date: new Date(`${settleDate}T12:00:00`).toISOString(),
      };

      if (editingSettlementId) {
        await apiFetch(`/api/workspaces/${id}/settlements/${editingSettlementId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/workspaces/${id}/settlements`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setEditingSettlementId(null);
      setSettleAmount("");
      setSettleAccountId("");
      setSettleDate(todayDateStr());
      setIsSettleModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to record settlement");
    } finally {
      setSettling(false);
    }
  }

  async function handleDeleteSettle(settlementId: string) {
    if (!confirm("Delete this settlement record?")) return;
    try {
      await apiFetch(`/api/workspaces/${id}/settlements/${settlementId}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete settlement");
    }
  }

  const availableContacts = contacts.filter(
    (c) => !members.some((m) => m.personId === c.id)
  );

  const groupedExpenses = useMemo(() => groupExpensesByDate(expenses), [expenses]);
  const groupedSettlements = useMemo(() => groupSettlementsByDate(settlements), [settlements]);

  if (loading) {
    return (
      <AppLayout title="Workspace" subtitle="Shared Ledger">
        <div className="py-16 text-center text-[#5A6863]">Loading shared workspace...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={workspaceName || "Workspace"}
      subtitle="Shared Ledger"
      onAddEntry={() => {
        resetExpenseForm();
        setIsExpenseModalOpen(true);
      }}
      addEntryLabel="Add Expense"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/workspaces" className="text-xs font-semibold text-[#5A6863] dark:text-[#8E9C95] hover:text-[#0F5C53] dark:hover:text-[#10B981]">
                ← All Workspaces
              </Link>
              <span className="text-stone-300 dark:text-stone-700">•</span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#0F5C53] dark:text-[#10B981]">
                Shared Ledger
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="font-serif font-bold text-3xl md:text-4xl text-[#162B27] dark:text-white tracking-tight">
                {workspaceName}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                Math.abs(myNet) < 0.5
                  ? "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700"
                  : myNet > 0
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#0F5C53] dark:text-[#34D399] border-emerald-200 dark:border-emerald-900/50"
                  : "bg-rose-50 dark:bg-rose-950/40 text-[#A8441F] dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
              }`}>
                {Math.abs(myNet) < 0.5 ? "Equilibrium" : myNet > 0 ? "Owed" : "In Debt"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setSettleFrom(myNet < 0 ? (selfBalanceObj?.personId ?? "") : "");
                setSettleTo(myNet > 0 ? (selfBalanceObj?.personId ?? "") : "");
                setSettleAmount(Math.abs(myNet) > 0 ? Math.abs(myNet).toFixed(0) : "");
                setIsSettleModalOpen(true);
              }}
              className="bg-[#FAF8F5] dark:bg-[#1A2229] hover:bg-[#F2EEE9] dark:hover:bg-[#202925] border border-[#E5E0D8] dark:border-[#1E2824] text-[#162B27] dark:text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              Settle Up
            </button>
            <button
              onClick={() => {
                resetExpenseForm();
                setIsExpenseModalOpen(true);
              }}
              className="bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>+ Add Expense</span>
            </button>
          </div>
        </div>

        {/* Hero Tug-of-War Balance Equilibrium Card */}
        <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            {/* Left: Your Net Position */}
            <div className="min-w-[200px]">
              <span className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block">
                Your Net Position
              </span>
              <div className={`font-serif font-bold text-3xl sm:text-4xl mt-1 ${myNet > 0 ? "text-[#1E7D46] dark:text-emerald-400" : myNet < 0 ? "text-[#A8441F] dark:text-rose-400" : "text-[#162B27] dark:text-white"}`}>
                {myNet > 0 ? "+" : myNet < 0 ? "-" : ""}{symbol}{Math.round(Math.abs(myNet)).toLocaleString()}
              </div>
              <p className="text-xs text-[#5A6863] dark:text-[#8E9C95] mt-1">
                {myNet > 0
                  ? "You are owed by roommates"
                  : myNet < 0
                  ? "You owe the roommates"
                  : "All settled up in this ledger"}
              </p>
            </div>

            {/* Center: Balance Tug-of-War Slider */}
            <div className="flex-1 w-full max-w-xl bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-[#A8441F] dark:text-rose-400 flex items-center gap-1 text-[11px]">
                  ◀ You Owe
                </span>
                <span className="text-[#5A6863] dark:text-[#8E9C95] text-[10px] font-bold tracking-widest uppercase">
                  Equilibrium
                </span>
                <span className="text-[#1E7D46] dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                  Owed to You ▶
                </span>
              </div>

              {/* Equilibrium Track */}
              <div className="relative w-full h-3.5 bg-[#EAE5DC] dark:bg-[#25302A] rounded-full overflow-hidden my-2">
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-stone-400 dark:bg-stone-500 z-10" />
                {myNet >= 0 ? (
                  <div
                    className="absolute top-0 bottom-0 bg-[#0F5C53] dark:bg-[#10B981] rounded-r-full transition-all duration-500"
                    style={{ left: "50%", width: `${Math.min(50, (myNet / maxBalanceRange) * 50)}%` }}
                  />
                ) : (
                  <div
                    className="absolute top-0 bottom-0 bg-[#C94A29] dark:bg-rose-500 rounded-l-full transition-all duration-500"
                    style={{
                      right: "50%",
                      width: `${Math.min(50, (Math.abs(myNet) / maxBalanceRange) * 50)}%`,
                    }}
                  />
                )}
              </div>

              {/* Indicator marker pin */}
              <div className="relative w-full h-4">
                <div
                  className="absolute top-0 -translate-x-1/2 transition-all duration-500 flex flex-col items-center"
                  style={{ left: `${tiltPercent}%` }}
                >
                  <div className="w-2.5 h-2.5 bg-[#162B27] dark:bg-white rounded-full ring-2 ring-white dark:ring-[#13191E] shadow-xs" />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#5A6863] dark:text-[#8E9C95] mt-1 font-medium">
                <span>-{symbol}{Math.round(maxBalanceRange).toLocaleString()}</span>
                <span className="text-stone-400">0</span>
                <span>+{symbol}{Math.round(maxBalanceRange).toLocaleString()}</span>
              </div>
            </div>

            {/* Right: Summary Quick Stats */}
            <div className="flex lg:flex-col gap-4 sm:gap-6 border-t lg:border-t-0 lg:border-l border-[#F0ECE6] dark:border-[#1E2824] pt-4 lg:pt-0 lg:pl-8 min-w-[170px]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block">
                  Total Shared Spend
                </span>
                <span className="font-serif font-bold text-lg text-[#162B27] dark:text-white">
                  {symbol}{Math.round(totalSpend).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#5A6863] dark:text-[#8E9C95] tracking-wider block">
                  You Paid / Fair Share
                </span>
                <span className="text-xs font-semibold text-[#162B27] dark:text-white">
                  {symbol}{Math.round(myPaid).toLocaleString()} <span className="text-stone-400">/</span> {symbol}{Math.round(myShare).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content: 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Column (2 Cols): Transactions & Settlements Feed */}
          <div className="lg:col-span-2 space-y-5">
            {/* Filter Tabs */}
            <div className="flex items-center justify-between">
              <div className="flex bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-1 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={`px-3.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                    filterTab === "all"
                      ? "bg-white dark:bg-[#13191E] text-[#0F5C53] dark:text-[#10B981] font-bold shadow-xs"
                      : "text-[#5A6863] dark:text-[#8E9C95]"
                  }`}
                >
                  All Activity
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("expenses")}
                  className={`px-3.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                    filterTab === "expenses"
                      ? "bg-white dark:bg-[#13191E] text-[#0F5C53] dark:text-[#10B981] font-bold shadow-xs"
                      : "text-[#5A6863] dark:text-[#8E9C95]"
                  }`}
                >
                  Expenses ({expenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("settlements")}
                  className={`px-3.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                    filterTab === "settlements"
                      ? "bg-white dark:bg-[#13191E] text-[#0F5C53] dark:text-[#10B981] font-bold shadow-xs"
                      : "text-[#5A6863] dark:text-[#8E9C95]"
                  }`}
                >
                  Settlements ({settlements.length})
                </button>
              </div>

              <span className="text-xs text-[#5A6863] dark:text-[#8E9C95]">
                {filterTab === "settlements" ? settlements.length : expenses.length} items
              </span>
            </div>

            {/* Date-wise Grouped Expenses List */}
            {filterTab !== "settlements" && (
              <div className="space-y-6">
                {groupedExpenses.map((group) => (
                  <div key={group.dateKey} className="space-y-2.5">
                    {/* Date Header matching Dashboard */}
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6863] dark:text-[#8E9C95] bg-[#FAF8F5] dark:bg-[#1A2229] px-2.5 py-1 rounded-lg border border-[#E5E0D8] dark:border-[#1E2824]">
                        {group.label}
                      </span>
                      <div className="flex-1 h-[1px] bg-[#E5E0D8] dark:bg-[#1E2824]" />
                      <span className="text-[11px] text-[#5A6863] dark:text-[#8E9C95] font-medium">
                        {group.expenses.length} {group.expenses.length === 1 ? "expense" : "expenses"}
                      </span>
                    </div>

                    {/* Expenses under this date */}
                    <div className="space-y-2.5">
                      {group.expenses.map((exp) => {
                        const myPaidSplit = exp.payments.find((p) => p.person.isSelf);
                        const myShareSplit = exp.splits.find((s) => s.person.isSelf);
                        const paidByMe = myPaidSplit ? parseFloat(myPaidSplit.amountPaid) : 0;
                        const myShareAmt = myShareSplit ? parseFloat(myShareSplit.shareAmount) : 0;
                        const impact = Math.round(paidByMe - myShareAmt);

                        const payerText = exp.payments
                          .map((p) => {
                            const name = p.person.isSelf ? "You" : p.person.name;
                            return exp.payments.length > 1
                              ? `${name} (${symbol}${Math.round(parseFloat(p.amountPaid)).toLocaleString()})`
                              : name;
                          })
                          .join(", ");

                        return (
                          <div
                            key={exp.id}
                            className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between hover:border-[#0F5C53]/40 dark:hover:border-[#10B981]/40 transition-colors"
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] text-[#0F5C53] dark:text-[#10B981] flex items-center justify-center flex-shrink-0">
                                {getCategoryIcon(exp.category)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-sm text-[#162B27] dark:text-white">
                                    {exp.description}
                                  </p>
                                  {exp.account && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-[#0F5C53] dark:text-[#34D399] border border-emerald-200 dark:border-emerald-900/50">
                                      💳 {exp.account.name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#5A6863] dark:text-[#8E9C95] mt-0.5">
                                  Paid by <span className="font-medium text-[#162B27] dark:text-white">{payerText}</span> • Split between {exp.splits.length} {exp.splits.length === 1 ? "person" : "people"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <span className="font-serif font-bold text-sm text-[#162B27] dark:text-white block">
                                  {symbol}{Math.round(parseFloat(exp.amount)).toLocaleString()}
                                </span>
                                <span
                                  className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md mt-0.5 border ${
                                    impact > 0
                                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#1E7D46] dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                                      : impact < 0
                                      ? "bg-rose-50 dark:bg-rose-950/40 text-[#A8441F] dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
                                      : "bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700"
                                  }`}
                                >
                                  {impact > 0
                                    ? `+${symbol}${impact.toLocaleString()} to balance`
                                    : impact < 0
                                    ? `-${symbol}${Math.abs(impact).toLocaleString()} to balance`
                                    : "0 net"}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEdit(exp)}
                                  className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-white text-xs cursor-pointer rounded-lg hover:bg-stone-100 dark:hover:bg-[#1A2229]"
                                  title="Edit"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  className="p-1.5 text-stone-400 hover:text-rose-600 text-xs cursor-pointer rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
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
                        );
                      })}
                    </div>
                  </div>
                ))}

                {expenses.length === 0 && (
                  <div className="bg-white dark:bg-[#13191E] border border-dashed border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl p-12 text-center text-[#5A6863] dark:text-[#8E9C95]">
                    <p className="font-serif font-semibold text-base text-[#162B27] dark:text-white">No shared expenses yet</p>
                    <p className="text-xs mt-1">Add your first shared expense to start keeping balance.</p>
                  </div>
                )}
              </div>
            )}

            {/* Settlements List Grouped by Date */}
            {filterTab !== "expenses" && settlements.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#5A6863] dark:text-[#8E9C95] flex items-center gap-2">
                  <span>Settlement History</span>
                  <span className="flex-1 h-[1px] bg-[#E5E0D8] dark:bg-[#1E2824]" />
                </div>
                {groupedSettlements.map((group) => (
                  <div key={group.dateKey} className="space-y-2">
                    <div className="text-[10px] font-bold text-[#5A6863] dark:text-[#8E9C95] uppercase tracking-wider px-1">
                      {group.label}
                    </div>
                    <div className="space-y-2.5">
                      {group.settlements.map((s) => (
                        <div
                          key={s.id}
                          className="bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-[#0F5C53] dark:text-[#34D399] flex items-center justify-center font-bold text-xs">
                              ✓
                            </div>
                            <div>
                              <p className="font-medium text-xs text-[#162B27] dark:text-white">
                                <span className="font-bold">{s.fromPerson.isSelf ? "You" : s.fromPerson.name}</span> paid{" "}
                                <span className="font-bold">{s.toPerson.isSelf ? "You" : s.toPerson.name}</span>
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[11px] text-[#5A6863] dark:text-[#8E9C95]">
                                  {new Date(s.date).toLocaleDateString()}
                                </p>
                                {s.account && (
                                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#0F5C53] dark:text-[#34D399] border border-emerald-200 dark:border-emerald-900/50 font-medium">
                                    💳 {s.account.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-serif font-bold text-sm text-[#0F5C53] dark:text-[#10B981]">
                              {symbol}{Math.round(parseFloat(s.amount)).toLocaleString()}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEditSettle(s)}
                                className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-white text-xs cursor-pointer rounded-lg hover:bg-stone-100 dark:hover:bg-[#13191E]"
                                title="Edit settlement"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteSettle(s.id)}
                                className="p-1.5 text-stone-400 hover:text-rose-600 text-xs cursor-pointer rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                title="Delete settlement"
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
                ))}
              </div>
            )}
          </div>

          {/* Side Rail (1 Col): Members List & Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                  Members
                </h3>
                <span className="text-xs text-[#6B7268] dark:text-[#8E9C95]">
                  {members.length} people
                </span>
              </div>

              {/* Members List */}
              <div className="space-y-3">
                {balances.map((b) => (
                  <div
                    key={b.personId}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-[#0F5C53] dark:text-[#34D399] font-serif font-bold text-xs flex items-center justify-center">
                        {b.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#162B27] dark:text-white">
                          {b.isSelf ? `${b.name} (You)` : b.name}
                        </p>
                        <p className={`text-[11px] font-medium ${b.netBalance > 0 ? "text-[#1E7D46] dark:text-emerald-400" : b.netBalance < 0 ? "text-[#A8441F] dark:text-rose-400" : "text-stone-400 dark:text-stone-500"}`}>
                          {b.isSelf ? (
                            b.netBalance > 0
                              ? `You are owed ${symbol}${Math.round(b.netBalance)}`
                              : b.netBalance < 0
                              ? `You owe ${symbol}${Math.round(Math.abs(b.netBalance))}`
                              : "Settled"
                          ) : b.netBalance > 0 ? (
                            `Owes you ${symbol}${Math.round(b.netBalance)}`
                          ) : b.netBalance < 0 ? (
                            `You owe ${symbol}${Math.round(Math.abs(b.netBalance))}`
                          ) : (
                            "Settled"
                          )}
                        </p>
                      </div>
                    </div>

                    {!b.isSelf && Math.abs(b.netBalance) > 0.5 && (
                      <button
                        onClick={() => {
                          if (b.netBalance > 0) {
                            // They owe you money -> They pay (From), You receive (To)
                            setSettleFrom(b.personId);
                            setSettleTo(selfBalanceObj?.personId ?? "");
                          } else {
                            // You owe them money -> You pay (From), They receive (To)
                            setSettleFrom(selfBalanceObj?.personId ?? "");
                            setSettleTo(b.personId);
                          }
                          setSettleAmount(Math.round(Math.abs(b.netBalance)).toString());
                          setIsSettleModalOpen(true);
                        }}
                        className="text-[11px] font-semibold text-[#0F5C53] dark:text-[#34D399] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer bg-white dark:bg-[#13191E] px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 transition-all shadow-xs"
                      >
                        Settle
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Member to Workspace Form */}
              <div className="mt-5 pt-4 border-t border-[#F0ECE6] dark:border-[#1E2824]">
                <h4 className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider mb-2">
                  Add Member
                </h4>
                <form onSubmit={handleAddMember} className="flex gap-2">
                  <select
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    className="flex-1 text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                  >
                    <option value="">Select contact...</option>
                    {availableContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={addingMember || !selectedContactId}
                    className="bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
                  >
                    {addingMember ? "..." : "+ Add"}
                  </button>
                </form>

                {availableContacts.length === 0 && (
                  <p className="text-[11px] text-[#6B7268] dark:text-[#8E9C95] mt-2">
                    Need new contacts? <Link href="/people" className="text-[#0F5C53] dark:text-[#34D399] underline font-medium">Add in Contacts</Link>.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Shared Expense Modal with Custom Paid, Custom Split & Account Select */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                  {editingExpenseId ? "Edit Shared Expense" : "Add Shared Expense"}
                </h3>
                <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-0.5">
                  Whole integer splits • Remainder to you • Track payment source
                </p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              {/* Amount & Description */}
              <div>
                <label className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                  Amount ({symbol})
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  className="w-full text-2xl font-serif font-bold text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. WiFi Bill, Weekly Groceries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full text-xs text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 focus:bg-white dark:focus:bg-[#13191E] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                  Category
                </label>
                <CategorySelect value={category} onChange={setCategory} />
              </div>

              {/* PAYER SECTION (Single vs Multiple / Custom Paid) */}
              <div className="p-3.5 bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase font-bold text-[#162B27] dark:text-white tracking-wider">
                    Who Paid?
                  </label>
                  <div className="flex bg-stone-200/60 dark:bg-[#13191E] p-0.5 rounded-lg text-[11px] font-medium border border-transparent dark:border-[#1E2824]">
                    <button
                      type="button"
                      onClick={() => setPayerMode("single")}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
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
                        if (Object.keys(customPayments).length === 0 && payerId) {
                          setCustomPayments({ [payerId]: amount });
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        payerMode === "multiple"
                          ? "bg-white dark:bg-[#1A2229] text-[#0F5C53] dark:text-[#34D399] font-bold shadow-xs"
                          : "text-[#6B7268] dark:text-[#8E9C95]"
                      }`}
                    >
                      Multiple / Custom Paid
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
                      {members.map((m) => (
                        <option key={m.personId} value={m.personId}>
                          {m.person.isSelf ? "You (Paid full amount)" : `${m.person.name} (Paid full amount)`}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {members.map((m) => {
                        const val = customPayments[m.personId] || "";
                        return (
                          <div key={m.personId} className="flex items-center gap-2 bg-white dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-2 rounded-xl">
                            <span className="text-xs font-medium text-[#162B27] dark:text-white flex-1 truncate">
                              {m.person.isSelf ? "You" : m.person.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-[#6B7268] dark:text-[#8E9C95]">{symbol}</span>
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
                          {symbol}{totalCustomPaid.toFixed(0)}
                        </strong>{" "}
                        / {symbol}{parsedAmount.toFixed(0)}
                      </span>
                      {Math.abs(totalCustomPaid - parsedAmount) < 0.01 && parsedAmount > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">✓ Matches total</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!selfPersonId) return;
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
                          className="text-[#0F5C53] dark:text-[#34D399] font-semibold underline cursor-pointer hover:text-[#0A3F38]"
                        >
                          Fill remainder to You
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ACCOUNT SELECTION: Shown whenever "Me" is paying (Kaha se hoyi ha) */}
              {selfPaidAmountInModal > 0 && (
                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase font-bold text-[#0F5C53] dark:text-[#34D399] tracking-wider">
                      Paid From Account (Kaha se hoyi ha)
                    </label>
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-medium">
                      Your payment: {symbol}{Math.round(selfPaidAmountInModal)}
                    </span>
                  </div>
                  <AccountSelect
                    value={accountId}
                    onChange={setAccountId}
                    label=""
                    placeholder="Select payment source (Cash, NayaPay, SadaPay...)"
                  />
                  <p className="text-[10px] text-[#6B7268] dark:text-[#8E9C95] mt-1">
                    Deducts {symbol}{Math.round(selfPaidAmountInModal)} directly from this account balance.
                  </p>
                </div>
              )}

              {/* SPLIT SECTION (Equal vs Custom Split) */}
              <div className="p-3.5 bg-[#FAF8F5] dark:bg-[#182026] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] uppercase font-bold text-[#162B27] dark:text-white tracking-wider block">
                      Split Between
                    </label>
                  </div>
                  <div className="flex bg-stone-200/60 dark:bg-[#13191E] p-0.5 rounded-lg text-[11px] font-medium border border-transparent dark:border-[#1E2824]">
                    <button
                      type="button"
                      onClick={() => setSplitMode("equal")}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
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
                          for (const m of members) {
                            if (splitSelected.has(m.personId)) {
                              initial[m.personId] = (equalSplitsMap[m.personId] || 0).toString();
                            }
                          }
                          setCustomSplits(initial);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {members.map((m) => {
                        const isChecked = splitSelected.has(m.personId);
                        const assignedShare = isChecked ? equalSplitsMap[m.personId] || 0 : 0;
                        const isSelf = m.person.isSelf;
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
                              <span className="font-semibold text-[#162B27] dark:text-white">
                                {isSelf ? "You" : m.person.name}
                              </span>
                            </div>

                            {isChecked && parsedAmount > 0 && (
                              <div className="text-right">
                                <span className="font-mono font-bold text-[#0F5C53] dark:text-[#34D399]">
                                  {symbol}{assignedShare}
                                </span>
                                {hasExtraRupee && (
                                  <span className="block text-[9px] font-bold text-amber-700 dark:text-amber-400">
                                    (+{assignedShare - baseShare} remainder to you)
                                  </span>
                                )}
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-[#6B7268] dark:text-[#8E9C95] pt-1">
                      No fractions or decimals. Any remainder is assigned to You to keep sums exact.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {members.map((m) => {
                        const val = customSplits[m.personId] || "";
                        return (
                          <div key={m.personId} className="flex items-center gap-2 bg-white dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-2 rounded-xl">
                            <span className="text-xs font-medium text-[#162B27] dark:text-white flex-1 truncate">
                              {m.person.isSelf ? "You" : m.person.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-[#6B7268] dark:text-[#8E9C95]">{symbol}</span>
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
                          {symbol}{totalCustomSplit.toFixed(0)}
                        </strong>{" "}
                        / {symbol}{parsedAmount.toFixed(0)}
                      </span>
                      {Math.abs(totalCustomSplit - parsedAmount) < 0.01 && parsedAmount > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">✓ Matches total</span>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const eq = calculateEqualSplits(parsedAmount, members.map((m) => m.personId), selfPersonId);
                              const mapped: Record<string, string> = {};
                              for (const [pid, amt] of Object.entries(eq)) {
                                mapped[pid] = amt.toString();
                              }
                              setCustomSplits(mapped);
                            }}
                            className="text-[#0F5C53] dark:text-[#34D399] font-semibold underline cursor-pointer hover:text-[#0A3F38]"
                          >
                            Divide Evenly
                          </button>
                          {selfPersonId && (
                            <button
                              type="button"
                              onClick={() => {
                                const otherSplits = Object.entries(customSplits).reduce(
                                  (sum, [pid, v]) => (pid === selfPersonId ? sum : sum + (parseFloat(v) || 0)),
                                  0
                                );
                                const rem = Math.max(0, parsedAmount - otherSplits);
                                setCustomSplits({
                                  ...customSplits,
                                  [selfPersonId]: rem.toFixed(0),
                                });
                              }}
                              className="text-[#0F5C53] dark:text-[#34D399] font-semibold underline cursor-pointer hover:text-[#0A3F38]"
                            >
                              Remainder to You
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">Date</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    required
                    className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] text-[#162B27] dark:text-white rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">Time</label>
                  <input
                    type="time"
                    value={expTime}
                    onChange={(e) => setExpTime(e.target.value)}
                    required
                    className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] text-[#162B27] dark:text-white rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-[#8E9C95] hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229] rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExp}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {submittingExp ? "Saving..." : editingExpenseId ? "Update Expense" : "+ Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record / Edit Settlement Modal */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                {editingSettlementId ? "Edit Settlement" : "Record Settlement"}
              </h3>
              <button
                onClick={() => {
                  setEditingSettlementId(null);
                  setIsSettleModalOpen(false);
                }}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSettle} className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">Payer (Who paid)</label>
                <select
                  value={settleFrom}
                  onChange={(e) => setSettleFrom(e.target.value)}
                  required
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                >
                  <option value="">Select payer...</option>
                  {members.map((m) => (
                    <option key={m.personId} value={m.personId}>
                      {m.person.isSelf ? "You" : m.person.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">Recipient (Who received)</label>
                <select
                  value={settleTo}
                  onChange={(e) => setSettleTo(e.target.value)}
                  required
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                >
                  <option value="">Select recipient...</option>
                  {members.map((m) => (
                    <option key={m.personId} value={m.personId}>
                      {m.person.isSelf ? "You" : m.person.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                    Amount ({symbol})
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="0"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    required
                    className="w-full text-lg font-serif font-bold bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    required
                    className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                  />
                </div>
              </div>

              {/* Account Selection if user is involved */}
              {(settleTo === selfPersonId || settleFrom === selfPersonId) && (
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[#0F5C53] dark:text-[#34D399] tracking-wider block">
                    {settleTo === selfPersonId
                      ? "Deposit into Account (Kaha aayenge)"
                      : "Pay from Account (Kaha se de rahe ho)"}
                  </label>
                  <AccountSelect
                    value={settleAccountId}
                    onChange={setSettleAccountId}
                    label=""
                    placeholder={settleTo === selfPersonId ? "Select deposit account..." : "Select payment account..."}
                  />
                  <p className="text-[10px] text-[#6B7268] dark:text-[#8E9C95]">
                    {settleTo === selfPersonId
                      ? "Amount will be added directly to this account balance."
                      : "Amount will be deducted directly from this account balance."}
                  </p>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSettlementId(null);
                    setIsSettleModalOpen(false);
                  }}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-[#8E9C95] hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229] rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {settling
                    ? (editingSettlementId ? "Saving..." : "Recording...")
                    : (editingSettlementId ? "Save Changes" : "Record Settlement")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}