"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
import { AccountSelect } from "@/components/AccountSelect";
import { useCurrency } from "@/context/CurrencyContext";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number | string;
  color?: string;
  icon?: string;
}

interface AccountTransfer {
  id: string;
  amount: number | string;
  note?: string;
  date: string;
  fromAccount: Account;
  toAccount: Account;
}

interface ActivityItem {
  id: string;
  type: string;
  direction: "IN" | "OUT";
  amount: number;
  title: string;
  category?: string | null;
  note?: string | null;
  date: string;
  createdAt: string;
}

interface Person {
  id: string;
  name: string;
  email: string | null;
}

interface UdharEntryItem {
  id: string;
  type: "LENA" | "DENA";
  amount: number | string;
  note?: string | null;
  date: string;
  isSettled: boolean;
  settledAt?: string | null;
  person: Person;
  account?: Account | null;
  settleAccount?: Account | null;
}

interface PersonUdharSummary {
  personId: string;
  name: string;
  totalLena: number;
  totalDena: number;
  netBalance: number;
  entries: UdharEntryItem[];
}

interface UdharApiResponse {
  entries: UdharEntryItem[];
  peopleSummary: PersonUdharSummary[];
  totalLena: number;
  totalDena: number;
  netBalance: number;
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeStr() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export default function AccountsPage() {
  const { symbol } = useCurrency();

  // Top level view: "accounts" | "udhar"
  const [activeTab, setActiveTab] = useState<"accounts" | "udhar">("accounts");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);
  const [contacts, setContacts] = useState<Person[]>([]);

  // Dedicated Udhar Khata state (completely separate from workspace expenses & settlements)
  const [udharEntries, setUdharEntries] = useState<UdharEntryItem[]>([]);
  const [udharPeople, setUdharPeople] = useState<PersonUdharSummary[]>([]);
  const [totalLena, setTotalLena] = useState(0);
  const [totalDena, setTotalDena] = useState(0);
  const [netUdhar, setNetUdhar] = useState(0);

  // Balance Visibility State (default hidden: ••••••)
  const [showGlobalBalance, setShowGlobalBalance] = useState(false);
  const [visibleAccountIds, setVisibleAccountIds] = useState<Set<string>>(new Set());

  function toggleGlobalBalance() {
    setShowGlobalBalance((prev) => !prev);
  }

  function toggleAccountBalance(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setVisibleAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Check if total balance and all individual accounts are currently revealed
  const isAllRevealed = useMemo(() => {
    return (
      showGlobalBalance &&
      accounts.length > 0 &&
      accounts.every((acc) => visibleAccountIds.has(acc.id))
    );
  }, [showGlobalBalance, accounts, visibleAccountIds]);

  // Reveal or hide all account balances including total balance at once
  function toggleAllBalances() {
    if (isAllRevealed) {
      setShowGlobalBalance(false);
      setVisibleAccountIds(new Set());
    } else {
      setShowGlobalBalance(true);
      setVisibleAccountIds(new Set(accounts.map((acc) => acc.id)));
    }
  }

  const [loading, setLoading] = useState(true);

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Direct Deposit Modal State (Salary, Top-up, Freelance)
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAccountId, setDepositAccountId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositSource, setDepositSource] = useState("Salary");
  const [depositNote, setDepositNote] = useState("");
  const [depositDate, setDepositDate] = useState(todayDateStr);
  const [depositTime, setDepositTime] = useState(nowTimeStr);
  const [depositing, setDepositing] = useState(false);

  // Add Account Modal State
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<"CASH" | "BANK" | "WALLET" | "UDHAR_KHATA">("WALLET");
  const [newAccBalance, setNewAccBalance] = useState("0");
  const [addingAcc, setAddingAcc] = useState(false);

  // Edit Account Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState("");
  const [editAccName, setEditAccName] = useState("");
  const [editAccType, setEditAccType] = useState<string>("WALLET");
  const [savingEdit, setSavingEdit] = useState(false);

  // Account Activity Drawer / Modal State
  const [selectedAccountForActivity, setSelectedAccountForActivity] = useState<Account | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"ALL" | "IN" | "OUT">("ALL");

  // Udhar Khata Filter: "all" | "lena" | "dene"
  const [udharFilter, setUdharFilter] = useState<"all" | "lena" | "dene">("all");

  // Record Udhar Entry Modal State
  const [isUdharModalOpen, setIsUdharModalOpen] = useState(false);
  const [udharType, setUdharType] = useState<"LENA" | "DENA">("LENA");
  const [udharPersonId, setUdharPersonId] = useState("");
  const [udharAmount, setUdharAmount] = useState("");
  const [udharAccountId, setUdharAccountId] = useState("");
  const [udharNote, setUdharNote] = useState("");
  const [udharDate, setUdharDate] = useState(todayDateStr);
  const [submittingUdhar, setSubmittingUdhar] = useState(false);

  // Settle Individual Udhar Entry Modal State
  const [settlingEntry, setSettlingEntry] = useState<UdharEntryItem | null>(null);
  const [settleAccountId, setSettleAccountId] = useState("");
  const [settling, setSettling] = useState(false);

  async function loadData() {
    try {
      const [accRes, transRes, peopleRes, udharRes] = await Promise.all([
        apiFetch<{ accounts: Account[] }>("/api/accounts"),
        apiFetch<{ transfers: AccountTransfer[] }>("/api/accounts/transfer"),
        apiFetch<{ people: Person[] }>("/api/people"),
        apiFetch<UdharApiResponse>("/api/udhar"),
      ]);

      setAccounts(accRes.accounts);
      setTransfers(transRes.transfers);
      setContacts(peopleRes.people.filter((p) => !p.email?.includes("@self")));

      // Dedicated Udhar Khata data
      setUdharEntries(udharRes.entries || []);
      setUdharPeople(udharRes.peopleSummary || []);
      setTotalLena(udharRes.totalLena || 0);
      setTotalDena(udharRes.totalDena || 0);
      setNetUdhar(udharRes.netBalance || 0);

      if (accRes.accounts.length > 0) {
        if (!fromAccountId && accRes.accounts.length >= 2) {
          setFromAccountId(accRes.accounts[0].id);
          setToAccountId(accRes.accounts[1].id);
        }
        if (!depositAccountId) {
          setDepositAccountId(accRes.accounts[0].id);
        }
        if (!udharAccountId) {
          setUdharAccountId(accRes.accounts[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load accounts data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openActivityModal(acc: Account) {
    setSelectedAccountForActivity(acc);
    setLoadingActivities(true);
    setActivities([]);
    try {
      const res = await apiFetch<{ activities: ActivityItem[] }>(`/api/accounts/${acc.id}/activity`);
      setActivities(res.activities);
    } catch (err) {
      console.error("Failed to load activity:", err);
    } finally {
      setLoadingActivities(false);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (transferring || !fromAccountId || !toAccountId || fromAccountId === toAccountId) return;
    const num = parseFloat(transferAmount);
    if (isNaN(num) || num <= 0) {
      alert("Please enter a valid transfer amount");
      return;
    }

    setTransferring(true);
    try {
      await apiFetch("/api/accounts/transfer", {
        method: "POST",
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: num,
          note: transferNote || undefined,
        }),
      });
      setTransferAmount("");
      setTransferNote("");
      setIsTransferModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to complete transfer");
    } finally {
      setTransferring(false);
    }
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (depositing || !depositAccountId) return;
    const num = parseFloat(depositAmount);
    if (isNaN(num) || num <= 0) {
      alert("Please enter a valid deposit amount");
      return;
    }

    setDepositing(true);
    try {
      await apiFetch(`/api/accounts/${depositAccountId}/deposit`, {
        method: "POST",
        body: JSON.stringify({
          amount: num,
          source: depositSource,
          note: depositNote.trim() || undefined,
          date: new Date(`${depositDate}T${depositTime}`).toISOString(),
        }),
      });
      setDepositAmount("");
      setDepositNote("");
      setIsDepositModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to deposit funds");
    } finally {
      setDepositing(false);
    }
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (addingAcc || !newAccName.trim()) return;
    setAddingAcc(true);
    try {
      await apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: newAccName.trim(),
          type: newAccType,
          balance: parseFloat(newAccBalance) || 0,
        }),
      });
      setNewAccName("");
      setNewAccBalance("0");
      setIsAddAccountModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setAddingAcc(false);
    }
  }

  async function handleSaveEditAccount(e: React.FormEvent) {
    e.preventDefault();
    if (savingEdit || !editingAccountId || !editAccName.trim()) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/api/accounts/${editingAccountId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editAccName.trim(),
          type: editAccType,
        }),
      });
      setIsEditModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRecordUdhar(e: React.FormEvent) {
    e.preventDefault();
    if (submittingUdhar || !udharPersonId) return;
    const num = parseFloat(udharAmount);
    if (isNaN(num) || num <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSubmittingUdhar(true);
    try {
      await apiFetch("/api/udhar", {
        method: "POST",
        body: JSON.stringify({
          type: udharType,
          personId: udharPersonId,
          amount: num,
          accountId: udharAccountId || undefined,
          note: udharNote.trim() || undefined,
          date: new Date(udharDate).toISOString(),
        }),
      });
      setUdharAmount("");
      setUdharNote("");
      setIsUdharModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to record Udhar");
    } finally {
      setSubmittingUdhar(false);
    }
  }

  async function handleConfirmSettleUdhar(e: React.FormEvent) {
    e.preventDefault();
    if (settling || !settlingEntry) return;

    setSettling(true);
    try {
      await apiFetch(`/api/udhar/${settlingEntry.id}/settle`, {
        method: "POST",
        body: JSON.stringify({
          accountId: settleAccountId || undefined,
        }),
      });

      setSettlingEntry(null);
      setSettleAccountId("");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to settle Udhar entry");
    } finally {
      setSettling(false);
    }
  }

  async function handleDeleteUdharEntry(entryId: string) {
    if (!confirm("Delete this Udhar entry?")) return;
    try {
      await apiFetch(`/api/udhar/${entryId}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete entry");
    }
  }

  // Calculations
  const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.balance.toString()), 0);

  // Udhar Khata filtered lists (purely based on UdharEntry, not workspace expenses)
  const lenaPeople = useMemo(() => udharPeople.filter((p) => p.totalLena > 0), [udharPeople]);
  const denePeople = useMemo(() => udharPeople.filter((p) => p.totalDena > 0), [udharPeople]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === "ALL") return activities;
    return activities.filter((a) => a.direction === activityFilter);
  }, [activities, activityFilter]);

  if (loading) {
    return (
      <AppLayout title="Accounts" subtitle="Wallets & Khata">
        <div className="py-16 text-center text-[#5A6863] dark:text-stone-400">Loading accounts...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Accounts & Wallets"
      subtitle="Financial Sources"
      onAddEntry={() => {
        if (activeTab === "accounts") {
          setIsDepositModalOpen(true);
        } else {
          setIsUdharModalOpen(true);
        }
      }}
      addEntryLabel={activeTab === "accounts" ? "Add Deposit" : "Record Udhar"}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header & Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#0F5C53] dark:text-[#34D399]">
              Liquidity & Credit
            </div>
            <h1 className="font-serif font-bold text-3xl md:text-4xl text-[#162B27] dark:text-white tracking-tight">
              Accounts & Wallets
            </h1>
          </div>

          {/* Tab Switcher: Accounts vs Udhar Khata */}
          <div className="flex items-center gap-2">
            <div className="flex bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] p-1 rounded-2xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("accounts")}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "accounts"
                    ? "bg-[#0F5C53] text-white shadow-xs"
                    : "text-[#6B7268] dark:text-stone-400 hover:text-[#162B27] dark:hover:text-white"
                }`}
              >
                <span>💳 Wallets & Banks</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === "accounts" ? "bg-white/20 text-white" : "bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300"}`}>
                  {accounts.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("udhar")}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "udhar"
                    ? "bg-[#0F5C53] text-white shadow-xs"
                    : "text-[#6B7268] dark:text-stone-400 hover:text-[#162B27] dark:hover:text-white"
                }`}
              >
                <span>📖 Udhar Khata</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === "udhar" ? "bg-white/20 text-white" : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"}`}>
                  {udharPeople.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* VIEW 1: ACCOUNTS & WALLETS */}
        {activeTab === "accounts" && (
          <div className="space-y-6">
            {/* Total Balance Hero Card */}
            <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block">
                      Total Available Balance
                    </span>
                    <button
                      type="button"
                      onClick={toggleGlobalBalance}
                      className="p-1 rounded-lg text-stone-400 hover:text-[#162B27] dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                      title={showGlobalBalance ? "Hide total balance" : "Show total balance"}
                    >
                      {showGlobalBalance ? (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>

                    <span className="text-stone-300 dark:text-stone-700 select-none">|</span>

                    <button
                      type="button"
                      onClick={toggleAllBalances}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg text-stone-600 dark:text-stone-300 hover:text-[#0F5C53] dark:hover:text-emerald-400 bg-[#FAF8F5] dark:bg-[#141816] hover:bg-[#F2EEE9] dark:hover:bg-stone-800 border border-[#E5E0D8] dark:border-[#28332E] transition-all cursor-pointer shadow-2xs"
                      title={isAllRevealed ? "Hide all balances at once" : "Reveal all balances at once"}
                    >
                      {isAllRevealed ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                          <span>Hide All</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <span>Reveal All</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="font-serif font-bold text-4xl sm:text-5xl text-[#162B27] dark:text-white mt-1">
                    {showGlobalBalance ? `${symbol}${Math.round(totalBalance).toLocaleString()}` : "••••••"}
                  </div>
                  <p className="text-xs text-[#6B7268] dark:text-stone-400 mt-1.5 flex items-center gap-2">
                    <span>{accounts.length} active payment sources</span>
                    <span>•</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Click any account to view date & time ledger</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => {
                      if (accounts.length > 0) setDepositAccountId(accounts[0].id);
                      setIsDepositModalOpen(true);
                    }}
                    className="bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>+ Add Income / Salary</span>
                  </button>
                  <button
                    onClick={() => setIsTransferModalOpen(true)}
                    className="bg-[#FAF8F5] dark:bg-[#151A18] hover:bg-[#F2EEE9] dark:hover:bg-[#202925] border border-[#E5E0D8] dark:border-[#28332E] text-[#162B27] dark:text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⇄ Transfer Funds</span>
                  </button>
                  <button
                    onClick={() => setIsAddAccountModalOpen(true)}
                    className="bg-white dark:bg-[#19201D] hover:bg-stone-50 dark:hover:bg-stone-800 border border-[#E5E0D8] dark:border-[#28332E] text-[#6B7268] dark:text-stone-300 hover:text-[#162B27] dark:hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    + New Account
                  </button>
                </div>
              </div>
            </div>

            {/* Accounts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {accounts.map((acc) => {
                const bal = parseFloat(acc.balance.toString());
                const isAccVisible = visibleAccountIds.has(acc.id);

                return (
                  <div
                    key={acc.id}
                    onClick={() => openActivityModal(acc)}
                    className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-5 sm:p-6 shadow-xs hover:border-[#0F5C53] dark:hover:border-[#34D399] hover:shadow-md transition-all cursor-pointer relative group flex flex-col justify-between min-h-[170px]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-xs"
                            style={{ backgroundColor: acc.color || "#0F5C53" }}
                          >
                            {acc.type === "BANK" ? "🏛️" : acc.type === "CASH" ? "💵" : acc.type === "UDHAR_KHATA" ? "📖" : "📱"}
                          </div>
                          <div>
                            <h3 className="font-serif font-bold text-lg text-[#162B27] dark:text-white leading-snug group-hover:text-[#0F5C53] dark:group-hover:text-[#34D399] transition-colors">
                              {acc.name}
                            </h3>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7268] dark:text-stone-400">
                              {acc.type.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingAccountId(acc.id);
                            setEditAccName(acc.name);
                            setEditAccType(acc.type);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-[#162B27] dark:hover:text-white hover:bg-[#FAF8F5] dark:hover:bg-stone-800 transition-all cursor-pointer text-xs"
                          title="Edit Account Name"
                        >
                          ✏️
                        </button>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block">
                            Current Balance
                          </span>
                          <button
                            type="button"
                            onClick={(e) => toggleAccountBalance(acc.id, e)}
                            className="p-1 rounded-md text-stone-400 hover:text-[#162B27] dark:hover:text-white hover:bg-[#FAF8F5] dark:hover:bg-stone-800 transition-colors cursor-pointer"
                            title={isAccVisible ? "Hide balance" : "Show balance"}
                          >
                            {isAccVisible ? (
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
                        <span className="font-serif font-bold text-2xl text-[#162B27] dark:text-white">
                          {isAccVisible ? `${symbol}${Math.round(bal).toLocaleString()}` : "••••••"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#F0ECE6] dark:border-[#28332E] flex items-center justify-between text-xs">
                      <span className="text-[#0F5C53] dark:text-[#34D399] font-semibold text-[11px] group-hover:underline flex items-center gap-1">
                        View Activity & Time →
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDepositAccountId(acc.id);
                          setIsDepositModalOpen(true);
                        }}
                        className="text-[11px] font-semibold bg-[#FAF8F5] dark:bg-[#151A18] hover:bg-[#EAE5DC] dark:hover:bg-[#202925] text-[#162B27] dark:text-white px-2.5 py-1 rounded-lg border border-[#E5E0D8] dark:border-[#28332E]"
                      >
                        + Deposit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Transfers History */}
            {transfers.length > 0 && (
              <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                    Recent Inter-Account Transfers
                  </h3>
                  <span className="text-xs text-[#6B7268] dark:text-stone-400">
                    {transfers.length} transfers
                  </span>
                </div>

                <div className="divide-y divide-[#F0ECE6] dark:divide-[#28332E]">
                  {transfers.slice(0, 8).map((t) => (
                    <div key={t.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] text-stone-600 dark:text-stone-400 flex items-center justify-center text-xs">
                          ⇄
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#162B27] dark:text-white">
                            <span>{t.fromAccount.name}</span>
                            <span className="text-stone-400 mx-1.5">→</span>
                            <span>{t.toAccount.name}</span>
                          </p>
                          <p className="text-[11px] text-[#6B7268] dark:text-stone-400 mt-0.5">
                            {formatDateTime(t.date)} {t.note ? `• ${t.note}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="font-serif font-bold text-sm text-[#162B27] dark:text-white">
                        {symbol}{Math.round(parseFloat(t.amount.toString()))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: UDHAR KHATA (DEDICATED CREDIT LEDGER) */}
        {activeTab === "udhar" && (
          <div className="space-y-6">
            {/* Udhar Khata Balance Equilibrium Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Lena Hai (Receivables) */}
              <div className="bg-white dark:bg-[#19201D] border border-emerald-200 dark:border-emerald-900/50 rounded-3xl p-6 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
                <span className="text-[11px] uppercase font-bold text-emerald-800 dark:text-emerald-400 tracking-wider block">
                  🟢 Logon Se Lena Hai (Receivables)
                </span>
                <div className="font-serif font-bold text-3xl sm:text-4xl text-[#1E7D46] dark:text-emerald-400 mt-2">
                  {symbol}{Math.round(totalLena).toLocaleString()}
                </div>
                <p className="text-xs text-[#6B7268] dark:text-stone-400 mt-1.5">
                  {lenaPeople.length} {lenaPeople.length === 1 ? "person owes" : "people owe"} you personal loans
                </p>
              </div>

              {/* Total Dene Hain (Payables) */}
              <div className="bg-white dark:bg-[#19201D] border border-rose-200 dark:border-rose-900/50 rounded-3xl p-6 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />
                <span className="text-[11px] uppercase font-bold text-rose-800 dark:text-rose-400 tracking-wider block">
                  🔴 Logon Ko Dena Hai (Payables)
                </span>
                <div className="font-serif font-bold text-3xl sm:text-4xl text-[#A8441F] dark:text-rose-400 mt-2">
                  {symbol}{Math.round(totalDena).toLocaleString()}
                </div>
                <p className="text-xs text-[#6B7268] dark:text-stone-400 mt-1.5">
                  You owe {denePeople.length} {denePeople.length === 1 ? "person" : "people"}
                </p>
              </div>

              {/* Net Udhar Position */}
              <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block">
                    ⚖️ Net Khata Equilibrium
                  </span>
                  <div className={`font-serif font-bold text-3xl sm:text-4xl mt-2 ${netUdhar > 0 ? "text-[#1E7D46] dark:text-emerald-400" : netUdhar < 0 ? "text-[#A8441F] dark:text-rose-400" : "text-[#162B27] dark:text-white"}`}>
                    {netUdhar > 0 ? "+" : ""}{symbol}{Math.round(netUdhar).toLocaleString()}
                  </div>
                  <p className="text-xs text-[#6B7268] dark:text-stone-400 mt-1">
                    {netUdhar > 0 ? "You are net in credit" : netUdhar < 0 ? "You are net in debt" : "All even"}
                  </p>
                </div>

                <button
                  onClick={() => setIsUdharModalOpen(true)}
                  className="mt-3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  + Record Udhar Entry
                </button>
              </div>
            </div>

            {/* Filter Tabs for Udhar */}
            <div className="flex items-center justify-between">
              <div className="flex bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setUdharFilter("all")}
                  className={`px-3.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                    udharFilter === "all" ? "bg-white dark:bg-[#202925] text-[#0F5C53] dark:text-[#34D399] font-bold shadow-xs" : "text-[#6B7268] dark:text-stone-400"
                  }`}
                >
                  All Active ({udharPeople.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUdharFilter("lena")}
                  className={`px-3.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                    udharFilter === "lena" ? "bg-white dark:bg-[#202925] text-emerald-700 dark:text-emerald-400 font-bold shadow-xs" : "text-[#6B7268] dark:text-stone-400"
                  }`}
                >
                  Lena Hai ({lenaPeople.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUdharFilter("dene")}
                  className={`px-3.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                    udharFilter === "dene" ? "bg-white dark:bg-[#202925] text-rose-700 dark:text-rose-400 font-bold shadow-xs" : "text-[#6B7268] dark:text-stone-400"
                  }`}
                >
                  Dene Hain ({denePeople.length})
                </button>
              </div>

              <button
                onClick={() => setIsUdharModalOpen(true)}
                className="text-xs font-semibold text-[#0F5C53] dark:text-[#34D399] hover:underline cursor-pointer"
              >
                + New Udhar Entry
              </button>
            </div>

            {/* Udhar Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* LENA HAI SECTION */}
              {(udharFilter === "all" || udharFilter === "lena") && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Logon Se Lena Hai ({lenaPeople.length})
                    </span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {symbol}{Math.round(totalLena)}
                    </span>
                  </div>

                  {lenaPeople.map((person) => {
                    const politeMsg = encodeURIComponent(
                      `Assalam-o-Alaikum ${person.name}, reminder regarding our Udhar balance of ${symbol}${Math.round(person.totalLena)} on Hisab Kitab. Please settle whenever convenient. JazakAllah!`
                    );

                    const activeEntries = person.entries.filter((e) => !e.isSettled && e.type === "LENA");

                    return (
                      <div
                        key={person.personId}
                        className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-5 shadow-xs space-y-3 hover:border-emerald-400 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400 font-serif font-bold text-sm flex items-center justify-center">
                              {person.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-[#162B27] dark:text-white">
                                {person.name}
                              </p>
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                Total Owed: {symbol}{Math.round(person.totalLena)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <a
                              href={`https://wa.me/?text=${politeMsg}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-all text-xs font-bold"
                              title="Send WhatsApp Reminder"
                            >
                              💬
                            </a>
                          </div>
                        </div>

                        {/* Unsettled entries list for this person */}
                        <div className="divide-y divide-[#F0ECE6] dark:divide-[#28332E] pt-1">
                          {activeEntries.map((e) => (
                            <div key={e.id} className="py-2.5 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-medium text-[#162B27] dark:text-white">
                                  {e.note || "Udhar (Maine diye)"}
                                </p>
                                <p className="text-[11px] text-[#6B7268] dark:text-stone-400 mt-0.5">
                                  {formatDateTime(e.date)}
                                  {e.account && <span className="ml-1.5 px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-[10px]">💳 {e.account.name}</span>}
                                </p>
                              </div>

                              <div className="flex items-center gap-2.5">
                                <span className="font-serif font-bold text-sm text-[#1E7D46] dark:text-emerald-400">
                                  +{symbol}{Math.round(Number(e.amount))}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettlingEntry(e);
                                    if (accounts.length > 0) setSettleAccountId(accounts[0].id);
                                  }}
                                  className="bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer shadow-xs"
                                >
                                  Vasooli
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteUdharEntry(e.id)}
                                  className="text-stone-400 hover:text-rose-600 text-xs p-1"
                                  title="Delete entry"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {lenaPeople.length === 0 && (
                    <div className="bg-white dark:bg-[#19201D] border border-dashed border-[#E5E0D8] dark:border-[#28332E] rounded-2xl p-8 text-center text-[#6B7268] dark:text-stone-400 text-xs">
                      No active receivables. You have not lent money to anyone.
                    </div>
                  )}
                </div>
              )}

              {/* DENE HAIN SECTION */}
              {(udharFilter === "all" || udharFilter === "dene") && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Logon Ko Dena Hai ({denePeople.length})
                    </span>
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                      {symbol}{Math.round(totalDena)}
                    </span>
                  </div>

                  {denePeople.map((person) => {
                    const activeEntries = person.entries.filter((e) => !e.isSettled && e.type === "DENA");

                    return (
                      <div
                        key={person.personId}
                        className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-5 shadow-xs space-y-3 hover:border-rose-400 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-400 font-serif font-bold text-sm flex items-center justify-center">
                              {person.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-[#162B27] dark:text-white">
                                {person.name}
                              </p>
                              <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                                Total Debt: {symbol}{Math.round(person.totalDena)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Unsettled entries list for this person */}
                        <div className="divide-y divide-[#F0ECE6] dark:divide-[#28332E] pt-1">
                          {activeEntries.map((e) => (
                            <div key={e.id} className="py-2.5 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-medium text-[#162B27] dark:text-white">
                                  {e.note || "Udhar (Maine liye)"}
                                </p>
                                <p className="text-[11px] text-[#6B7268] dark:text-stone-400 mt-0.5">
                                  {formatDateTime(e.date)}
                                  {e.account && <span className="ml-1.5 px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-[10px]">💳 {e.account.name}</span>}
                                </p>
                              </div>

                              <div className="flex items-center gap-2.5">
                                <span className="font-serif font-bold text-sm text-[#A8441F] dark:text-rose-400">
                                  -{symbol}{Math.round(Number(e.amount))}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettlingEntry(e);
                                    if (accounts.length > 0) setSettleAccountId(accounts[0].id);
                                  }}
                                  className="bg-[#A8441F] hover:bg-[#853416] text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer shadow-xs"
                                >
                                  Ada Karen
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteUdharEntry(e.id)}
                                  className="text-stone-400 hover:text-rose-600 text-xs p-1"
                                  title="Delete entry"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {denePeople.length === 0 && (
                    <div className="bg-white dark:bg-[#19201D] border border-dashed border-[#E5E0D8] dark:border-[#28332E] rounded-2xl p-8 text-center text-[#6B7268] dark:text-stone-400 text-xs">
                      No active debts! You don't owe anyone personal loan money.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: ACCOUNT ACTIVITY & TIME LEDGER */}
      {selectedAccountForActivity && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-[#F0ECE6] dark:border-[#28332E]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7268] dark:text-stone-400">
                  Account Activity & Audit
                </span>
                <h3 className="font-serif font-bold text-2xl text-[#162B27] dark:text-white">
                  {selectedAccountForActivity.name}
                </h3>
                <p className="text-xs text-[#6B7268] dark:text-stone-400 mt-0.5">
                  Balance: <strong className="text-[#162B27] dark:text-white">{symbol}{Math.round(parseFloat(selectedAccountForActivity.balance.toString()))}</strong> • {selectedAccountForActivity.type}
                </p>
              </div>
              <button
                onClick={() => setSelectedAccountForActivity(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 py-3">
              <button
                onClick={() => setActivityFilter("ALL")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${activityFilter === "ALL" ? "bg-[#0F5C53] text-white" : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"}`}
              >
                All
              </button>
              <button
                onClick={() => setActivityFilter("IN")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${activityFilter === "IN" ? "bg-emerald-600 text-white" : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"}`}
              >
                Money In (+)
              </button>
              <button
                onClick={() => setActivityFilter("OUT")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${activityFilter === "OUT" ? "bg-rose-600 text-white" : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"}`}
              >
                Money Out (-)
              </button>
            </div>

            {/* Activity List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#F0ECE6] dark:divide-[#28332E] pr-1 space-y-1">
              {loadingActivities ? (
                <div className="py-12 text-center text-xs text-[#6B7268] dark:text-stone-400">
                  Loading transactions...
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#6B7268] dark:text-stone-400">
                  No transactions recorded for this account yet.
                </div>
              ) : (
                filteredActivities.map((act) => (
                  <div key={act.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                          act.direction === "IN"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300"
                        }`}
                      >
                        {act.direction === "IN" ? "↓" : "↑"}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#162B27] dark:text-white">
                          {act.title}
                        </p>
                        <p className="text-[11px] text-[#6B7268] dark:text-stone-400 mt-0.5">
                          {formatDateTime(act.date)} {act.note ? `• ${act.note}` : ""}
                        </p>
                        {act.category && (
                          <span className="inline-block mt-1 px-2 py-0.2 rounded-md text-[10px] font-medium bg-[#FAF8F5] dark:bg-[#151A18] text-stone-600 dark:text-stone-300 border border-[#E5E0D8] dark:border-[#28332E]">
                            {act.category}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span
                        className={`font-serif font-bold text-sm ${
                          act.direction === "IN" ? "text-[#1E7D46] dark:text-emerald-400" : "text-[#162B27] dark:text-white"
                        }`}
                      >
                        {act.direction === "IN" ? "+" : "-"}{symbol}{Math.round(act.amount)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-[#F0ECE6] dark:border-[#28332E] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAccountForActivity(null)}
                className="px-5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-800 dark:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DIRECT DEPOSIT (SALARY / INCOME) */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                Add Income / Deposit
              </h3>
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDeposit} className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Destination Account
                </label>
                <select
                  value={depositAccountId}
                  onChange={(e) => setDepositAccountId(e.target.value)}
                  required
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({symbol}{Math.round(parseFloat(acc.balance.toString()))})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Amount ({symbol})
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  required
                  autoFocus
                  className="w-full text-2xl font-serif font-bold text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Income Source / Label
                </label>
                <select
                  value={depositSource}
                  onChange={(e) => setDepositSource(e.target.value)}
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                >
                  <option value="Salary">💼 Monthly Salary</option>
                  <option value="Freelance">💻 Freelance / Project</option>
                  <option value="Cash Deposit">🏧 Cash Deposit</option>
                  <option value="Business Profit">📈 Business Profit</option>
                  <option value="Gift / Pocket Money">🎁 Gift / Allowance</option>
                  <option value="Other">✨ Other Income</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. October payroll, Client advance"
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">Date</label>
                  <input
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    required
                    className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">Time</label>
                  <input
                    type="time"
                    value={depositTime}
                    onChange={(e) => setDepositTime(e.target.value)}
                    required
                    className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-stone-400 hover:bg-[#FAF8F5] dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={depositing}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {depositing ? "Adding..." : "+ Deposit Funds"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TRANSFER FUNDS */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                Transfer Money
              </h3>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">From Account</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  required
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id} disabled={acc.id === toAccountId}>
                      {acc.name} ({symbol}{Math.round(parseFloat(acc.balance.toString()))})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">To Account</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  required
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id} disabled={acc.id === fromAccountId}>
                      {acc.name} ({symbol}{Math.round(parseFloat(acc.balance.toString()))})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Amount ({symbol})
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  required
                  className="w-full text-xl font-serif font-bold bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-3 py-2 text-[#162B27] dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. ATM cash withdrawal"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-stone-400 hover:bg-[#FAF8F5] dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {transferring ? "Transferring..." : "Transfer Funds"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT ACCOUNT NAME */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                Edit Account
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditAccount} className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={editAccName}
                  onChange={(e) => setEditAccName(e.target.value)}
                  required
                  className="w-full text-sm font-semibold bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-3 py-2 text-[#162B27] dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Type
                </label>
                <select
                  value={editAccType}
                  onChange={(e) => setEditAccType(e.target.value)}
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                >
                  <option value="BANK">Bank Account</option>
                  <option value="WALLET">Digital Wallet (NayaPay, SadaPay, etc.)</option>
                  <option value="CASH">Physical Cash</option>
                  <option value="UDHAR_KHATA">Udhar Khata</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-stone-400 hover:bg-[#FAF8F5] dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD NEW ACCOUNT */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                New Account
              </h3>
              <button
                onClick={() => setIsAddAccountModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meezan Bank, EasyPaisa"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  required
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Account Type
                </label>
                <select
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value as any)}
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                >
                  <option value="WALLET">Digital Wallet (NayaPay, SadaPay, etc.)</option>
                  <option value="BANK">Bank Account</option>
                  <option value="CASH">Physical Cash</option>
                  <option value="UDHAR_KHATA">Udhar Khata</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Starting Balance ({symbol})
                </label>
                <input
                  type="number"
                  step="1"
                  value={newAccBalance}
                  onChange={(e) => setNewAccBalance(e.target.value)}
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-stone-400 hover:bg-[#FAF8F5] dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingAcc}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {addingAcc ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: RECORD DEDICATED UDHAR ENTRY (MAINE DIYE / MAINE LIYE) */}
      {isUdharModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                  Record Udhar Entry
                </h3>
                <p className="text-xs text-[#6B7268] dark:text-stone-400 mt-0.5">
                  Separate personal loan credit book
                </p>
              </div>
              <button
                onClick={() => setIsUdharModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordUdhar} className="space-y-3.5">
              {/* Type Switcher: Maine Diye vs Maine Liye */}
              <div className="grid grid-cols-2 gap-2 bg-[#FAF8F5] dark:bg-[#151A18] p-1 border border-[#E5E0D8] dark:border-[#28332E] rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setUdharType("LENA")}
                  className={`py-2 rounded-lg transition-all cursor-pointer text-center ${
                    udharType === "LENA"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-[#6B7268] dark:text-stone-400"
                  }`}
                >
                  Maine Diye (Lena Hai)
                </button>
                <button
                  type="button"
                  onClick={() => setUdharType("DENA")}
                  className={`py-2 rounded-lg transition-all cursor-pointer text-center ${
                    udharType === "DENA"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-[#6B7268] dark:text-stone-400"
                  }`}
                >
                  Maine Liye (Dene Hain)
                </button>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Contact / Person
                </label>
                <select
                  value={udharPersonId}
                  onChange={(e) => setUdharPersonId(e.target.value)}
                  required
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                >
                  <option value="">Select person...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Amount ({symbol})
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={udharAmount}
                  onChange={(e) => setUdharAmount(e.target.value)}
                  required
                  className="w-full text-2xl font-serif font-bold text-[#162B27] dark:text-white bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  {udharType === "LENA"
                    ? "Deduct from Account (Kaha se diye)"
                    : "Deposit into Account (Kaha jama huye)"}
                </label>
                <select
                  value={udharAccountId}
                  onChange={(e) => setUdharAccountId(e.target.value)}
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                >
                  <option value="">No account (Credit ledger record only)</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({symbol}{Math.round(parseFloat(acc.balance.toString()))})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Note / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cash advance, Emergency help"
                  value={udharNote}
                  onChange={(e) => setUdharNote(e.target.value)}
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">Date</label>
                <input
                  type="date"
                  value={udharDate}
                  onChange={(e) => setUdharDate(e.target.value)}
                  required
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-2.5 py-2 text-[#162B27] dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsUdharModalOpen(false)}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-stone-400 hover:bg-[#FAF8F5] dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUdhar}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingUdhar ? "Saving..." : "Save Udhar Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: SETTLE SPECIFIC UDHAR ENTRY */}
      {settlingEntry && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                {settlingEntry.type === "LENA" ? "Vasooli (Record Return)" : "Ada Karen (Pay Debt)"}
              </h3>
              <button
                onClick={() => setSettlingEntry(null)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSettleUdhar} className="space-y-3.5">
              <div className="p-3 bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl">
                <p className="text-xs text-[#6B7268] dark:text-stone-400">Contact</p>
                <p className="text-sm font-bold text-[#162B27] dark:text-white mt-0.5">{settlingEntry.person.name}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#F0ECE6] dark:border-[#28332E]">
                  <span className="text-xs text-[#6B7268] dark:text-stone-400">Amount</span>
                  <span className={`text-base font-serif font-bold ${settlingEntry.type === "LENA" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                    {symbol}{Math.round(Number(settlingEntry.amount))}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#0F5C53] dark:text-[#34D399] tracking-wider block mb-1">
                  {settlingEntry.type === "LENA"
                    ? "Deposit into Account (Kaha jama huye)"
                    : "Pay from Account (Kaha se ada kiye)"}
                </label>
                <AccountSelect
                  value={settleAccountId}
                  onChange={setSettleAccountId}
                  label=""
                  placeholder="Select account (e.g. Cash, NayaPay)..."
                />
                <p className="text-[10px] text-[#6B7268] dark:text-stone-400 mt-1">
                  {settlingEntry.type === "LENA"
                    ? "Amount will be added to this account's balance."
                    : "Amount will be deducted from this account's balance."}
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSettlingEntry(null)}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-stone-400 hover:bg-[#FAF8F5] dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {settling ? "Recording..." : "Confirm Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
