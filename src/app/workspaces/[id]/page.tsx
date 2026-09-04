"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { CategorySelect } from "@/components/CategorySelect";
import { AppLayout } from "@/components/AppLayout";
import { useCurrency } from "@/context/CurrencyContext";

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

interface Expense {
  id: string;
  amount: string;
  description: string;
  category: string | null;
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
  fromPerson: Person;
  toPerson: Person;
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
  const [submittingExp, setSubmittingExp] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Split & Payment config
  const [payerId, setPayerId] = useState("");
  const [splitSelected, setSplitSelected] = useState<Set<string>>(new Set());

  // Settlement Form State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleFrom, setSettleFrom] = useState("");
  const [settleTo, setSettleTo] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settling, setSettling] = useState(false);

  // Add Member State
  const [selectedContactId, setSelectedContactId] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  async function loadData() {
    try {
      const [wsRes, expRes, balRes, setRes, peopleRes] = await Promise.all([
        apiFetch<{ members: Member[]; workspace: { name: string } }>(`/api/workspaces/${id}/members`),
        apiFetch<{ expenses: Expense[] }>(`/api/workspaces/${id}/expenses`),
        apiFetch<{ balances: Balance[] }>(`/api/workspaces/${id}/balances`),
        apiFetch<{ settlements: Settlement[] }>(`/api/workspaces/${id}/settlements`),
        apiFetch<{ people: Person[] }>("/api/people"),
      ]);
      setWorkspaceName(wsRes.workspace.name);
      setMembers(wsRes.members);
      setExpenses(expRes.expenses);
      setBalances(balRes.balances);
      setSettlements(setRes.settlements);
      setContacts(peopleRes.people);

      // Default payer and splits if empty
      if (!payerId && wsRes.members.length > 0) {
        const selfMem = wsRes.members.find((m) => m.person.isSelf);
        setPayerId(selfMem?.personId || wsRes.members[0].personId);
        setSplitSelected(new Set(wsRes.members.map((m) => m.personId)));
      }
    } catch {
      router.push("/workspaces");
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
  // Calculate percentage offset: 50% is center (0)
  const tiltPercent = Math.max(5, Math.min(95, 50 + (myNet / maxBalanceRange) * 50));

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (submittingExp) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (splitSelected.size === 0) {
      alert("Select at least one member to split with");
      return;
    }

    setSubmittingExp(true);
    try {
      const splitArray = Array.from(splitSelected);
      const splitShare = Math.round((numAmount / splitArray.length) * 100) / 100;
      const splits = splitArray.map((personId) => ({
        personId,
        amount: splitShare,
      }));

      const payments = [{ personId: payerId, amount: numAmount }];

      const payload = {
        amount: numAmount,
        description,
        category: category || undefined,
        date: new Date(`${expDate}T${expTime}`).toISOString(),
        payments,
        splits,
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

      setAmount("");
      setDescription("");
      setCategory("");
      setEditingExpenseId(null);
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

  async function handleSubmitSettle(e: React.FormEvent) {
    e.preventDefault();
    if (settling || !settleFrom || !settleTo || settleFrom === settleTo) return;
    setSettling(true);
    try {
      await apiFetch(`/api/workspaces/${id}/settlements`, {
        method: "POST",
        body: JSON.stringify({
          fromPersonId: settleFrom,
          toPersonId: settleTo,
          amount: parseFloat(settleAmount),
          date: new Date().toISOString(),
        }),
      });
      setSettleAmount("");
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
      onAddEntry={() => setIsExpenseModalOpen(true)}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar matching Figma */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/workspaces" className="text-xs font-semibold text-[#6B7268] hover:text-[#0F5C53]">
                ← All Workspaces
              </Link>
              <span className="text-stone-300">•</span>
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#0F5C53]">
                Shared Ledger
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="font-serif font-bold text-3xl md:text-4xl text-[#162B27] tracking-tight">
                {workspaceName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-[#0F5C53] border border-emerald-200">
                {Math.abs(myNet) < 0.5 ? "Equilibrium" : myNet > 0 ? "Owed" : "In Debt"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setSettleFrom(myNet < 0 ? (selfBalanceObj?.personId ?? "") : "");
                setSettleTo(myNet > 0 ? (selfBalanceObj?.personId ?? "") : "");
                setSettleAmount(Math.abs(myNet) > 0 ? Math.abs(myNet).toFixed(2) : "");
                setIsSettleModalOpen(true);
              }}
              className="bg-[#FAF8F5] hover:bg-[#F2EEE9] border border-[#E5E0D8] text-[#162B27] px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              Settle Up
            </button>
            <button
              onClick={() => {
                setEditingExpenseId(null);
                setAmount("");
                setDescription("");
                setCategory("");
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

        {/* Hero Tug-of-War Balance Equilibrium Card matching Figma */}
        <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            {/* Left: Your Net Position */}
            <div className="min-w-[200px]">
              <span className="text-xs uppercase font-bold text-[#6B7268] tracking-wider block">
                Your Net Position
              </span>
              <div className={`font-serif font-bold text-3xl sm:text-4xl mt-1 ${myNet > 0 ? "text-[#1E7D46]" : myNet < 0 ? "text-[#A8441F]" : "text-[#162B27]"}`}>
                {myNet > 0 ? "+" : myNet < 0 ? "-" : ""}{symbol}{Math.abs(myNet).toFixed(2)}
              </div>
              <p className="text-xs text-[#6B7268] mt-1">
                {myNet > 0
                  ? "You are owed by roommates"
                  : myNet < 0
                  ? "You owe the roommates"
                  : "All settled up in this ledger"}
              </p>
            </div>

            {/* Center: Balance Tug-of-War Slider */}
            <div className="flex-1 w-full max-w-xl bg-[#FAF8F5] border border-[#E5E0D8] rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-[#A8441F] flex items-center gap-1">
                  ◀ You Owe
                </span>
                <span className="text-[#6B7268] text-[11px] font-bold tracking-widest uppercase">
                  Equilibrium
                </span>
                <span className="text-[#1E7D46] flex items-center gap-1">
                  Owed to You ▶
                </span>
              </div>

              {/* Equilibrium Track */}
              <div className="relative w-full h-3.5 bg-[#EAE5DC] rounded-full overflow-hidden my-2">
                {/* Center marker line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-stone-400 z-10" />
                {/* Active Tug fill */}
                {myNet >= 0 ? (
                  <div
                    className="absolute top-0 bottom-0 bg-[#0F5C53] rounded-r-full transition-all duration-500"
                    style={{ left: "50%", width: `${Math.min(50, (myNet / maxBalanceRange) * 50)}%` }}
                  />
                ) : (
                  <div
                    className="absolute top-0 bottom-0 bg-[#C94A29] rounded-l-full transition-all duration-500"
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
                  <div className="w-2.5 h-2.5 bg-[#162B27] rounded-full ring-2 ring-white shadow-xs" />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#6B7268] mt-1 font-medium">
                <span>-{symbol}{maxBalanceRange.toFixed(0)}</span>
                <span className="text-stone-400">0.00</span>
                <span>+{symbol}{maxBalanceRange.toFixed(0)}</span>
              </div>
            </div>

            {/* Right: Summary Quick Stats */}
            <div className="flex lg:flex-col gap-4 sm:gap-6 border-t lg:border-t-0 lg:border-l border-[#F0ECE6] pt-4 lg:pt-0 lg:pl-8 min-w-[170px]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block">
                  Total Shared Spend
                </span>
                <span className="font-serif font-bold text-lg text-[#162B27]">
                  {symbol}{totalSpend.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block">
                  You Paid / Fair Share
                </span>
                <span className="text-xs font-semibold text-[#162B27]">
                  {symbol}{myPaid.toFixed(2)} <span className="text-stone-400">/</span> {symbol}{myShare.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content: 2-Column Grid matching Figma */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Column (2 Cols): Transactions & Settlements Feed */}
          <div className="lg:col-span-2 space-y-5">
            {/* Filter Tabs matching Figma */}
            <div className="flex items-center justify-between">
              <div className="flex bg-[#FAF8F5] border border-[#E5E0D8] p-1 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={`px-3.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                    filterTab === "all"
                      ? "bg-white text-[#0F5C53] font-bold shadow-xs"
                      : "text-[#6B7268]"
                  }`}
                >
                  All Activity
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("expenses")}
                  className={`px-3.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                    filterTab === "expenses"
                      ? "bg-white text-[#0F5C53] font-bold shadow-xs"
                      : "text-[#6B7268]"
                  }`}
                >
                  Expenses ({expenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("settlements")}
                  className={`px-3.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                    filterTab === "settlements"
                      ? "bg-white text-[#0F5C53] font-bold shadow-xs"
                      : "text-[#6B7268]"
                  }`}
                >
                  Settlements ({settlements.length})
                </button>
              </div>

              <span className="text-xs text-[#6B7268]">
                {filterTab === "settlements" ? settlements.length : expenses.length} items
              </span>
            </div>

            {/* Expenses List */}
            {filterTab !== "settlements" && (
              <div className="space-y-3">
                {expenses.map((exp) => {
                  const myPaidSplit = exp.payments.find((p) => p.person.isSelf);
                  const myShareSplit = exp.splits.find((s) => s.person.isSelf);
                  const paidByMe = myPaidSplit ? parseFloat(myPaidSplit.amountPaid) : 0;
                  const myShareAmt = myShareSplit ? parseFloat(myShareSplit.shareAmount) : 0;
                  const impact = paidByMe - myShareAmt;

                  const payerText = exp.payments.map((p) => (p.person.isSelf ? "You" : p.person.name)).join(", ");

                  return (
                    <div
                      key={exp.id}
                      className="bg-white border border-[#E5E0D8] rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between hover:border-[#0F5C53]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] text-[#0F5C53] flex items-center justify-center flex-shrink-0">
                          {getCategoryIcon(exp.category)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-[#162B27]">
                            {exp.description}
                          </p>
                          <p className="text-xs text-[#6B7268] mt-0.5">
                            Paid by <span className="font-medium text-[#162B27]">{payerText}</span> • Split between {exp.splits.length} {exp.splits.length === 1 ? "person" : "people"} • {new Date(exp.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="font-serif font-bold text-sm text-[#162B27] block">
                            {symbol}{Number(exp.amount).toFixed(2)}
                          </span>
                          {/* Personal Impact Chip matching Figma */}
                          <span
                            className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md mt-0.5 ${
                              impact > 0
                                ? "bg-emerald-50 text-[#1E7D46] border border-emerald-200"
                                : impact < 0
                                ? "bg-rose-50 text-[#A8441F] border border-rose-200"
                                : "bg-stone-50 text-stone-600 border border-stone-200"
                            }`}
                          >
                            {impact > 0 ? `+${symbol}${impact.toFixed(2)} to balance` : impact < 0 ? `-${symbol}${Math.abs(impact).toFixed(2)} to balance` : "0.00 net"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingExpenseId(exp.id);
                              setAmount(exp.amount);
                              setDescription(exp.description);
                              setCategory(exp.category || "");
                              setExpDate(exp.date.slice(0, 10));
                              setExpTime(exp.date.slice(11, 16));
                              setIsExpenseModalOpen(true);
                            }}
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
                  );
                })}

                {expenses.length === 0 && (
                  <div className="bg-white border border-dashed border-[#E5E0D8] rounded-2xl p-12 text-center text-[#6B7268]">
                    <p className="font-serif font-semibold text-base text-[#162B27]">No shared expenses yet</p>
                    <p className="text-xs mt-1">Add your first shared expense to start keeping balance.</p>
                  </div>
                )}
              </div>
            )}

            {/* Settlements List */}
            {filterTab !== "expenses" && settlements.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="text-[11px] uppercase tracking-wider font-bold text-[#6B7268] flex items-center gap-2">
                  <span>Settlement History</span>
                  <span className="flex-1 h-[1px] bg-[#EBE8E1]" />
                </div>
                {settlements.map((s) => (
                  <div
                    key={s.id}
                    className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-2xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#0F5C53] flex items-center justify-center">
                        ✓
                      </div>
                      <div>
                        <p className="font-medium text-xs text-[#162B27]">
                          <span className="font-bold">{s.fromPerson.isSelf ? "You" : s.fromPerson.name}</span> paid{" "}
                          <span className="font-bold">{s.toPerson.isSelf ? "You" : s.toPerson.name}</span>
                        </p>
                        <p className="text-[11px] text-[#6B7268] mt-0.5">
                          {new Date(s.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-serif font-bold text-sm text-[#0F5C53]">
                        {symbol}{Number(s.amount).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleDeleteSettle(s.id)}
                        className="text-stone-400 hover:text-rose-600 text-xs cursor-pointer p-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Side Rail (1 Col): Members List & Quick Actions matching Figma */}
          <div className="space-y-6">
            {/* Members & Balances Card */}
            <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-xl text-[#162B27]">
                  Members
                </h3>
                <span className="text-xs text-[#6B7268]">
                  {members.length} people
                </span>
              </div>

              {/* Members List */}
              <div className="space-y-3">
                {balances.map((b) => (
                  <div
                    key={b.personId}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#0F5C53]/15 text-[#0F5C53] font-serif font-bold text-xs flex items-center justify-center">
                        {b.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#162B27]">
                          {b.isSelf ? `${b.name} (You)` : b.name}
                        </p>
                        <p className={`text-[11px] font-medium ${b.netBalance > 0 ? "text-[#1E7D46]" : b.netBalance < 0 ? "text-[#A8441F]" : "text-stone-400"}`}>
                          {b.netBalance > 0
                            ? `Owed ${symbol}${b.netBalance.toFixed(2)}`
                            : b.netBalance < 0
                            ? `Owes ${symbol}${Math.abs(b.netBalance).toFixed(2)}`
                            : "Settled"}
                        </p>
                      </div>
                    </div>

                    {!b.isSelf && Math.abs(b.netBalance) > 0.01 && (
                      <button
                        onClick={() => {
                          if (b.netBalance < 0) {
                            // They owe money
                            setSettleFrom(b.personId);
                            setSettleTo(selfBalanceObj?.personId ?? "");
                          } else {
                            // You owe them
                            setSettleFrom(selfBalanceObj?.personId ?? "");
                            setSettleTo(b.personId);
                          }
                          setSettleAmount(Math.abs(b.netBalance).toFixed(2));
                          setIsSettleModalOpen(true);
                        }}
                        className="text-[11px] font-semibold text-[#0F5C53] hover:underline cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-[#E5E0D8]"
                      >
                        Settle
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Member to Workspace Form */}
              <div className="mt-5 pt-4 border-t border-[#F0ECE6]">
                <h4 className="text-[11px] uppercase font-bold text-[#6B7268] tracking-wider mb-2">
                  Add Member
                </h4>
                <form onSubmit={handleAddMember} className="flex gap-2">
                  <select
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    className="flex-1 text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2 text-[#162B27] focus:outline-none focus:border-[#0F5C53]"
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
                    className="bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {addingMember ? "..." : "+ Add"}
                  </button>
                </form>

                {availableContacts.length === 0 && (
                  <p className="text-[11px] text-[#6B7268] mt-2">
                    Need new contacts? <Link href="/people" className="text-[#0F5C53] underline font-medium">Add in Contacts</Link>.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Shared Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 max-w-lg w-full shadow-2xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27]">
                {editingExpenseId ? "Edit Shared Expense" : "Add Shared Expense"}
              </h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
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
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. WiFi Bill, Weekly Groceries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full text-xs text-[#162B27] bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:border-[#0F5C53]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">Paid By</label>
                  <select
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                    className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2 text-[#162B27]"
                  >
                    {members.map((m) => (
                      <option key={m.personId} value={m.personId}>
                        {m.person.isSelf ? "You" : m.person.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">Category</label>
                  <CategorySelect value={category} onChange={setCategory} />
                </div>
              </div>

              {/* Split With Selectors */}
              <div>
                <label className="text-[11px] uppercase font-bold text-[#6B7268] tracking-wider block mb-2">
                  Split Equally With:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {members.map((m) => {
                    const isChecked = splitSelected.has(m.personId);
                    return (
                      <label
                        key={m.personId}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-emerald-50/60 border-[#0F5C53] text-[#0F5C53] font-semibold"
                            : "bg-[#FAF8F5] border-[#E5E0D8] text-[#6B7268]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const next = new Set(splitSelected);
                            if (next.has(m.personId)) next.delete(m.personId);
                            else next.add(m.personId);
                            setSplitSelected(next);
                          }}
                          className="w-3.5 h-3.5 accent-[#0F5C53]"
                        />
                        <span>{m.person.isSelf ? "You" : m.person.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">Date</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    required
                    className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">Time</label>
                  <input
                    type="time"
                    value={expTime}
                    onChange={(e) => setExpTime(e.target.value)}
                    required
                    className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExp}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingExp ? "Saving..." : editingExpenseId ? "Update Expense" : "+ Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Settlement Modal */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27]">
                Record Settlement
              </h3>
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSettle} className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">Payer (Who paid)</label>
                <select
                  value={settleFrom}
                  onChange={(e) => setSettleFrom(e.target.value)}
                  required
                  className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2 text-[#162B27]"
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
                <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">Recipient (Who received)</label>
                <select
                  value={settleTo}
                  onChange={(e) => setSettleTo(e.target.value)}
                  required
                  className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2 text-[#162B27]"
                >
                  <option value="">Select recipient...</option>
                  {members.map((m) => (
                    <option key={m.personId} value={m.personId}>
                      {m.person.isSelf ? "You" : m.person.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">
                  Amount ({symbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                  className="w-full text-xl font-serif font-bold bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-3 py-2 text-[#162B27]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] hover:bg-[#FAF8F5] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {settling ? "Recording..." : "Record Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}