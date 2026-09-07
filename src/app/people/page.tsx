"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
import { ModalPortal } from "@/components/ModalPortal";
import { useCurrency } from "@/context/CurrencyContext";

interface Person {
  id: string;
  name: string;
  email: string | null;
}

interface PersonNet {
  personId: string;
  name: string;
  netBalance: number;
}

interface Overview {
  netByPerson: PersonNet[];
}

interface ParticipantInfo {
  personId: string;
  name: string;
  amount: number;
  isSelf: boolean;
}

interface LedgerExpenseItem {
  type: "expense";
  id: string;
  description: string;
  category: string | null;
  date: string;
  workspace: { id: string; name: string };
  account: { id: string; name: string; type: string; color: string | null; icon: string | null } | null;
  totalAmount: number;
  personShare: number;
  personPaid: number;
  selfShare: number;
  selfPaid: number;
  pairwiseDelta: number;
  payments: ParticipantInfo[];
  splits: ParticipantInfo[];
}

interface LedgerSettlementItem {
  type: "settlement";
  id: string;
  date: string;
  workspace: { id: string; name: string };
  account: { id: string; name: string; type: string; color: string | null; icon: string | null } | null;
  amount: number;
  fromPerson: { id: string; name: string; isSelf: boolean };
  toPerson: { id: string; name: string; isSelf: boolean };
  pairwiseDelta: number;
  note: string | null;
}

type LedgerItem = LedgerExpenseItem | LedgerSettlementItem;

interface LedgerDay {
  date: string;
  dayExpenseDelta?: number;
  dayExpenseLena?: number;
  dayExpenseDena?: number;
  daySettlementDelta?: number;
  daySettledAmount?: number;
  dayNetDelta?: number;
  delta: number;
  openingBalance?: number;
  closingBalance?: number;
  runningTotal: number;
  isSettled?: boolean;
  items?: LedgerItem[];
}

interface Ledger {
  personId: string;
  personName?: string;
  total: number;
  totalExpensesCount?: number;
  totalSettlementsCount?: number;
  days: LedgerDay[];
}

function getCategoryIcon(cat: string | null) {
  const c = (cat || "").toLowerCase();
  if (c.includes("coffee") || c.includes("food") || c.includes("eat") || c.includes("din") || c.includes("lunch")) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />
      </svg>
    );
  }
  if (c.includes("uber") || c.includes("transport") || c.includes("auto") || c.includes("fuel") || c.includes("cab") || c.includes("travel")) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    );
  }
  if (c.includes("grocer") || c.includes("shop") || c.includes("blink") || c.includes("mart") || c.includes("supplies")) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
      </svg>
    );
  }
  if (c.includes("bill") || c.includes("util") || c.includes("electr") || c.includes("rent") || c.includes("wifi")) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <circle cx="7" cy="7" r=".5" fill="currentColor" />
    </svg>
  );
}

export default function PeoplePage() {
  const router = useRouter();
  const { symbol } = useCurrency();

  const [people, setPeople] = useState<Person[]>([]);
  const [netMap, setNetMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "owes_me" | "i_owe" | "settled">("all");

  // Selected Person for Details Pane
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [expandedDrawers, setExpandedDrawers] = useState<Record<string, boolean>>({});

  // Add Contact Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedReminder, setCopiedReminder] = useState(false);

  async function loadData() {
    try {
      const [peopleRes, overviewRes] = await Promise.all([
        apiFetch<{ people: Person[] }>("/api/people"),
        apiFetch<Overview>("/api/stats/overview"),
      ]);

      setPeople(peopleRes.people);

      const map: Record<string, number> = {};
      for (const item of overviewRes.netByPerson) {
        map[item.personId] = item.netBalance;
      }
      setNetMap(map);

      if (peopleRes.people.length > 0 && !selectedPerson) {
        setSelectedPerson(peopleRes.people[0]);
      }
    } catch {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    window.addEventListener("offline-sync-completed", loadData);
    return () => window.removeEventListener("offline-sync-completed", loadData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Load ledger when selected person changes
  useEffect(() => {
    if (!selectedPerson) return;
    setLoadingLedger(true);
    setExpandedDrawers({});
    apiFetch<Ledger>(`/api/people/${selectedPerson.id}/ledger`)
      .then((res) => {
        setLedger(res);
        // By default, expand all days
        const defaultOpen: Record<string, boolean> = {};
        if (res?.days) {
          for (const d of res.days) {
            defaultOpen[d.date] = true;
          }
        }
        setExpandedDays(defaultOpen);
      })
      .catch(() => setLedger(null))
      .finally(() => setLoadingLedger(false));
  }, [selectedPerson]);

  function toggleDayAccordion(dateStr: string) {
    setExpandedDays((prev) => ({
      ...prev,
      [dateStr]: prev[dateStr] === undefined ? false : !prev[dateStr],
    }));
  }

  function toggleAllAccordions(expand: boolean) {
    if (!ledger?.days) return;
    const updated: Record<string, boolean> = {};
    for (const d of ledger.days) {
      updated[d.date] = expand;
    }
    setExpandedDays(updated);
  }

  function toggleDrawer(itemId: string) {
    setExpandedDrawers((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ person: Person }>("/api/people", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined }),
      });
      setPeople((prev) => [...prev, res.person].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedPerson(res.person);
      setName("");
      setEmail("");
      setIsAddModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contact");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this contact? This only works if they have no expense history.")) return;
    try {
      await apiFetch(`/api/people/${id}`, { method: "DELETE" });
      const nextPeople = people.filter((p) => p.id !== id);
      setPeople(nextPeople);
      if (selectedPerson?.id === id) {
        setSelectedPerson(nextPeople[0] || null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove contact");
    }
  }

  function handleCopyReminder(person: Person, balance: number) {
    const text = balance > 0
      ? `Hi ${person.name}, just sending a quick reminder about our balance of ${symbol}${Math.round(balance).toLocaleString()} on Hisab Kitab.`
      : `Hi ${person.name}, I checked our ledger on Hisab Kitab and I owe you ${symbol}${Math.round(Math.abs(balance)).toLocaleString()}. Let's settle up soon!`;

    navigator.clipboard.writeText(text);
    setCopiedReminder(true);
    setTimeout(() => setCopiedReminder(false), 3000);
  }

  function handleWhatsAppReminder(person: Person, balance: number) {
    const text = balance > 0
      ? `Hi ${person.name}, just sending a quick reminder about our balance of ${symbol}${Math.round(balance).toLocaleString()} on Hisab Kitab.`
      : `Hi ${person.name}, I checked our ledger on Hisab Kitab and I owe you ${symbol}${Math.round(Math.abs(balance)).toLocaleString()}. Let's settle up soon!`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  // Calculate totals
  let totalOwedToYou = 0;
  let totalYouOwe = 0;
  for (const p of people) {
    const bal = netMap[p.id] || 0;
    if (bal > 0) totalOwedToYou += bal;
    else if (bal < 0) totalYouOwe += Math.abs(bal);
  }
  const netTotal = totalOwedToYou - totalYouOwe;

  // Filter contacts
  const filteredPeople = people.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const bal = netMap[p.id] || 0;
    if (!matchesSearch) return false;

    if (filterTab === "owes_me") return bal > 0.01;
    if (filterTab === "i_owe") return bal < -0.01;
    if (filterTab === "settled") return Math.abs(bal) <= 0.01;
    return true;
  });

  return (
    <AppLayout
      title="People"
      subtitle="Contacts & Directory"
      onAddEntry={() => setIsAddModalOpen(true)}
      addEntryLabel="Add Contact"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#0F5C53] dark:text-[#34D399]">
              Network Directory
            </div>
            <h1 className="font-serif font-bold text-3xl md:text-4xl text-[#162B27] dark:text-white tracking-tight mt-0.5">
              Contacts & Balances
            </h1>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <span>+ Add Contact</span>
          </button>
        </div>

        {/* Global Net Balance Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block">
              Overall Balance
            </span>
            <div className={`font-serif font-bold text-2xl mt-1 ${netTotal > 0 ? "text-[#1E7D46] dark:text-emerald-400" : netTotal < 0 ? "text-[#A8441F] dark:text-rose-400" : "text-[#162B27] dark:text-white"}`}>
              {netTotal > 0 ? "+" : ""}{symbol}{Math.round(netTotal).toLocaleString()}
            </div>
            <span className="text-[11px] text-[#6B7268] dark:text-[#8E9C95] block mt-0.5">
              Across all contacts
            </span>
          </div>

          <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#1E7D46] dark:text-emerald-400 tracking-wider block">
              Owed to You (Lena)
            </span>
            <div className="font-serif font-bold text-2xl text-[#1E7D46] dark:text-emerald-400 mt-1">
              +{symbol}{Math.round(totalOwedToYou).toLocaleString()}
            </div>
            <span className="text-[11px] text-[#6B7268] dark:text-[#8E9C95] block mt-0.5">
              Total to collect
            </span>
          </div>

          <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#A8441F] dark:text-rose-400 tracking-wider block">
              You Owe (Dena)
            </span>
            <div className="font-serif font-bold text-2xl text-[#A8441F] dark:text-rose-400 mt-1">
              -{symbol}{Math.round(totalYouOwe).toLocaleString()}
            </div>
            <span className="text-[11px] text-[#6B7268] dark:text-[#8E9C95] block mt-0.5">
              Total to pay back
            </span>
          </div>
        </div>

        {/* Two-Column Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (5 Cols): Contacts Directory List */}
          <div className="lg:col-span-5 bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-5 shadow-xs space-y-4">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search contact by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3.5 py-2.5 pl-9 text-[#162B27] dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
              />
              <svg className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-1 rounded-xl text-xs">
              {[
                { id: "all", label: "All" },
                { id: "owes_me", label: "Owes Me" },
                { id: "i_owe", label: "I Owe" },
                { id: "settled", label: "Settled" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id as any)}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition-all text-center cursor-pointer ${filterTab === tab.id
                    ? "bg-[#0F5C53] text-white shadow-xs"
                    : "text-[#6B7268] dark:text-[#8E9C95] hover:text-[#162B27] dark:hover:text-white"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Contacts Scrollable List */}
            {loading ? (
              <div className="py-8 text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">Loading contacts...</div>
            ) : filteredPeople.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">
                No contacts match the filter.
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {filteredPeople.map((person) => {
                  const bal = netMap[person.id] || 0;
                  const isSelected = selectedPerson?.id === person.id;

                  return (
                    <div
                      key={person.id}
                      onClick={() => setSelectedPerson(person)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${isSelected
                        ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-[#0F5C53] dark:border-[#10B981] shadow-xs"
                        : "bg-white dark:bg-[#161D22] hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229] border-[#E5E0D8] dark:border-[#1E2824]"
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-[#0F5C53] dark:text-[#34D399] font-serif font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {person.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-[#162B27] dark:text-white truncate">
                            {person.name}
                          </p>
                          <p className="text-[11px] text-[#6B7268] dark:text-[#8E9C95] truncate">
                            {person.email || "No email"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 ml-2">
                        <span className={`font-serif font-bold text-xs ${bal > 0 ? "text-[#1E7D46] dark:text-emerald-400" : bal < 0 ? "text-[#A8441F] dark:text-rose-400" : "text-[#6B7268] dark:text-[#8E9C95]"}`}>
                          {bal > 0 ? `+${symbol}${Math.round(bal).toLocaleString()}` : bal < 0 ? `-${symbol}${Math.round(Math.abs(bal)).toLocaleString()}` : "Settled"}
                        </span>
                        <span className="block text-[10px] text-[#6B7268] dark:text-[#8E9C95]">
                          {bal > 0 ? "Owes you" : bal < 0 ? "You owe" : "Clear"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column (7 Cols): Contact Detail & Detailed Day-by-Day Ledger */}
          <div className="lg:col-span-7 bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-5 sm:p-6 shadow-xs space-y-6">
            {selectedPerson ? (
              <>
                {/* Contact Profile Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#F0ECE6] dark:border-[#1E2824]">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-[#0F5C53] dark:text-[#34D399] font-serif font-bold text-xl flex items-center justify-center flex-shrink-0">
                      {selectedPerson.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-serif font-bold text-2xl text-[#162B27] dark:text-white">
                        {selectedPerson.name}
                      </h2>
                      <p className="text-xs text-[#6B7268] dark:text-[#8E9C95]">
                        {selectedPerson.email || "No contact email listed"}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block">
                      Net Balance
                    </span>
                    <div className={`font-serif font-bold text-2xl mt-0.5 ${(netMap[selectedPerson.id] || 0) > 0 ? "text-[#1E7D46] dark:text-emerald-400" : (netMap[selectedPerson.id] || 0) < 0 ? "text-[#A8441F] dark:text-rose-400" : "text-[#162B27] dark:text-white"}`}>
                      {(netMap[selectedPerson.id] || 0) > 0 ? "+" : (netMap[selectedPerson.id] || 0) < 0 ? "-" : ""}{symbol}{Math.round(Math.abs(netMap[selectedPerson.id] || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Quick Actions: WhatsApp Reminder, Copy Nudge & Remove */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleWhatsAppReminder(selectedPerson, netMap[selectedPerson.id] || 0)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>💬 WhatsApp Reminder</span>
                    </button>
                    <button
                      onClick={() => handleCopyReminder(selectedPerson, netMap[selectedPerson.id] || 0)}
                      className="bg-[#FAF8F5] dark:bg-[#1A2229] hover:bg-[#F2EEE9] dark:hover:bg-[#161D22] border border-[#E5E0D8] dark:border-[#1E2824] text-[#162B27] dark:text-stone-200 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>📋 Copy Nudge</span>
                    </button>
                    {copiedReminder && (
                      <span className="text-xs font-medium text-[#1E7D46] dark:text-emerald-400">
                        ✓ Copied message!
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(selectedPerson.id)}
                    className="text-stone-400 hover:text-rose-500 text-xs cursor-pointer p-1 transition-colors"
                    title="Remove Contact"
                  >
                    Remove Contact
                  </button>
                </div>

                {/* Detailed Day-by-Day Expense Ledger Across All Workspaces */}
                <div className="space-y-4">
                  {/* Ledger Header & Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] p-3.5 rounded-2xl">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-bold text-base text-[#162B27] dark:text-white">
                          Shared Expense History
                        </h3>
                        {ledger && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] text-[#0F5C53] dark:text-[#10B981]">
                            {ledger.totalExpensesCount || 0} expenses • {ledger.totalSettlementsCount || 0} settlements
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6B7268] dark:text-[#8E9C95] mt-0.5">
                        Grouped day-by-day across all shared workspaces with {selectedPerson.name}
                      </p>
                    </div>

                    {ledger && ledger.days && ledger.days.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-[#6B7268] dark:text-[#8E9C95]">
                        <button
                          onClick={() => toggleAllAccordions(true)}
                          className="hover:text-[#0F5C53] dark:hover:text-[#10B981] font-medium cursor-pointer"
                        >
                          Expand All
                        </button>
                        <span>•</span>
                        <button
                          onClick={() => toggleAllAccordions(false)}
                          className="hover:text-[#0F5C53] dark:hover:text-[#10B981] font-medium cursor-pointer"
                        >
                          Collapse All
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Loading State */}
                  {loadingLedger ? (
                    <div className="py-16 text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">
                      Loading complete transaction timeline across workspaces...
                    </div>
                  ) : !ledger || !ledger.days || ledger.days.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">
                      <p className="font-medium text-[#162B27] dark:text-white">No shared activity recorded yet</p>
                      <p className="mt-1">Add {selectedPerson.name} to a shared workspace or log an expense with them.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
                      {ledger.days.map((day) => {
                        const isOpen = expandedDays[day.date] !== false; // default open
                        const todayStr = new Date().toISOString().slice(0, 10);
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        const yesterdayStr = yesterday.toISOString().slice(0, 10);

                        let dateLabel = "";
                        if (day.date === todayStr) dateLabel = "Today";
                        else if (day.date === yesterdayStr) dateLabel = "Yesterday";
                        else {
                          dateLabel = new Date(day.date + "T00:00:00").toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          });
                        }

                        const fullDateLabel = new Date(day.date + "T00:00:00").toLocaleDateString(undefined, {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        });

                        const items = day.items || [];

                        return (
                          <div
                            key={day.date}
                            className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl overflow-hidden shadow-xs transition-all"
                          >
                            {/* Day Accordion Header Button with the 2 Balances */}
                            <button
                              type="button"
                              onClick={() => toggleDayAccordion(day.date)}
                              className="w-full px-4 py-3.5 bg-[#FAF8F5]/90 dark:bg-[#1A2229]/70 hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229] border-b border-[#E5E0D8]/60 dark:border-[#1E2824]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-6 h-6 rounded-lg bg-stone-200/70 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300 transition-transform duration-200 ${
                                    isOpen ? "rotate-90" : ""
                                  }`}
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="9 18 15 12 9 6" />
                                  </svg>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-xs sm:text-sm text-[#162B27] dark:text-white">
                                      {dateLabel}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] text-[#6B7268] dark:text-[#8E9C95]">
                                      {items.length} {items.length === 1 ? "entry" : "entries"}
                                    </span>
                                    {(day.daySettledAmount || 0) > 0 && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/40">
                                        🤝 Settled
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-[#6B7268] dark:text-[#8E9C95] block mt-0.5">
                                    {fullDateLabel}
                                  </span>
                                </div>
                              </div>

                              {/* THE 2 DAY BALANCES: (1) Total Lena / Dena for this day, (2) Balance Left After Settled */}
                              <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto pt-1 sm:pt-0">
                                {/* Balance 1: Total Lena ya Dena for that day */}
                                <div className="text-right">
                                  <span className="text-[9px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block">
                                    Day Lena/Dena
                                  </span>
                                  <div className={`font-serif font-bold text-xs ${
                                    (day.dayExpenseDelta ?? day.delta) > 0
                                      ? "text-[#1E7D46] dark:text-emerald-400"
                                      : (day.dayExpenseDelta ?? day.delta) < 0
                                      ? "text-[#A8441F] dark:text-rose-400"
                                      : "text-stone-600 dark:text-stone-300"
                                  }`}>
                                    {(day.dayExpenseDelta ?? day.delta) > 0
                                      ? `+${symbol}${Math.round(day.dayExpenseDelta ?? day.delta).toLocaleString()} (Lena)`
                                      : (day.dayExpenseDelta ?? day.delta) < 0
                                      ? `-${symbol}${Math.round(Math.abs(day.dayExpenseDelta ?? day.delta)).toLocaleString()} (Dena)`
                                      : "Rs 0"}
                                  </div>
                                  {(day.daySettledAmount || 0) > 0 && (
                                    <span className="text-[9px] text-teal-600 dark:text-teal-400 font-medium block">
                                      Settled: {symbol}{Math.round(day.daySettledAmount || 0).toLocaleString()}
                                    </span>
                                  )}
                                </div>

                                <span className="h-7 w-[1px] bg-stone-300 dark:bg-stone-700" />

                                {/* Balance 2: Remaining Balance Left After Settled */}
                                <div className="text-right">
                                  <span className="text-[9px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block">
                                    Remaining Left
                                  </span>
                                  <div className={`font-serif font-bold text-xs sm:text-sm ${
                                    (day.closingBalance ?? day.runningTotal) > 0.01
                                      ? "text-[#1E7D46] dark:text-emerald-400"
                                      : (day.closingBalance ?? day.runningTotal) < -0.01
                                      ? "text-[#A8441F] dark:text-rose-400"
                                      : "text-emerald-600 dark:text-emerald-400"
                                  }`}>
                                    {(day.closingBalance ?? day.runningTotal) > 0.01
                                      ? `+${symbol}${Math.round(day.closingBalance ?? day.runningTotal).toLocaleString()} (Lena)`
                                      : (day.closingBalance ?? day.runningTotal) < -0.01
                                      ? `-${symbol}${Math.round(Math.abs(day.closingBalance ?? day.runningTotal)).toLocaleString()} (Dena)`
                                      : "✓ Fully Settled"}
                                  </div>
                                  <span className="text-[9px] text-[#6B7268] dark:text-[#8E9C95] block">
                                    {(day.closingBalance ?? day.runningTotal) > 0.01
                                      ? "Owed to you"
                                      : (day.closingBalance ?? day.runningTotal) < -0.01
                                      ? "You owe"
                                      : "Clear (Rs 0 left)"}
                                  </span>
                                </div>
                              </div>
                            </button>

                            {/* Day Items List */}
                            {isOpen && (
                              <div className="divide-y divide-[#E5E0D8]/40 dark:divide-[#1E2824]/40 p-2 space-y-2">
                                {/* Explicit Day Balance & Settlement Breakdown Banner */}
                                <div className="bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8]/80 dark:border-[#1E2824]/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                                    <div>
                                      <span className="text-[9px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] block">
                                        Day Total Lena/Dena
                                      </span>
                                      <span className="font-semibold text-xs text-[#162B27] dark:text-white">
                                        {(day.dayExpenseDelta ?? day.delta) > 0
                                          ? `+${symbol}${Math.round(day.dayExpenseDelta ?? day.delta).toLocaleString()} (Lena - ${selectedPerson.name} owes you)`
                                          : (day.dayExpenseDelta ?? day.delta) < 0
                                          ? `-${symbol}${Math.round(Math.abs(day.dayExpenseDelta ?? day.delta)).toLocaleString()} (Dena - You owe ${selectedPerson.name})`
                                          : "Rs 0 (Balanced)"}
                                      </span>
                                    </div>

                                    {(day.daySettledAmount || 0) > 0 && (
                                      <>
                                        <span className="h-5 w-[1px] bg-stone-300 dark:bg-stone-700" />
                                        <div>
                                          <span className="text-[9px] uppercase font-bold text-teal-600 dark:text-teal-400 block">
                                            Settled on this Day
                                          </span>
                                          <span className="font-semibold text-xs text-teal-700 dark:text-teal-300">
                                            🤝 {symbol}{Math.round(day.daySettledAmount || 0).toLocaleString()} settled
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  <div className="text-right">
                                    <span className="text-[9px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] block">
                                      Remaining Balance Left
                                    </span>
                                    <span className={`font-serif font-bold text-xs ${
                                      (day.closingBalance ?? day.runningTotal) > 0.01
                                        ? "text-[#1E7D46] dark:text-emerald-400"
                                        : (day.closingBalance ?? day.runningTotal) < -0.01
                                        ? "text-[#A8441F] dark:text-rose-400"
                                        : "text-emerald-600 dark:text-emerald-400"
                                    }`}>
                                      {(day.closingBalance ?? day.runningTotal) > 0.01
                                        ? `+${symbol}${Math.round(day.closingBalance ?? day.runningTotal).toLocaleString()} Left (Lena / Owes you)`
                                        : (day.closingBalance ?? day.runningTotal) < -0.01
                                        ? `-${symbol}${Math.round(Math.abs(day.closingBalance ?? day.runningTotal)).toLocaleString()} Left (Dena / You owe)`
                                        : "✓ Fully Settled (Rs 0 Left)"}
                                    </span>
                                  </div>
                                </div>
                                {items.length === 0 ? (
                                  <div className="p-3 text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">
                                    No item records found for this day.
                                  </div>
                                ) : (
                                  items.map((item) => {
                                    if (item.type === "settlement") {
                                      // Settlement Item
                                      return (
                                        <div
                                          key={item.id}
                                          className="p-3 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl m-1 border border-emerald-200/50 dark:border-emerald-800/30 flex flex-col gap-2"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0 text-xs">
                                                🤝
                                              </div>
                                              <div className="min-w-0">
                                                <p className="font-semibold text-xs text-[#162B27] dark:text-white truncate">
                                                  {item.fromPerson.isSelf
                                                    ? `You paid ${item.toPerson.name}`
                                                    : `${item.fromPerson.name} paid You`}
                                                </p>
                                                <p className="text-[10px] text-[#6B7268] dark:text-[#8E9C95]">
                                                  Settlement {item.note ? `• ${item.note}` : ""}
                                                </p>
                                              </div>
                                            </div>

                                            <div className="text-right flex-shrink-0">
                                              <span className="font-serif font-bold text-xs text-emerald-700 dark:text-emerald-400 block">
                                                {symbol}{Math.round(item.amount).toLocaleString()}
                                              </span>
                                              <span className="text-[10px] text-[#6B7268] dark:text-[#8E9C95]">
                                                {item.pairwiseDelta > 0 ? "You settled debt" : "Debt received"}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2 text-[10px]">
                                            <Link
                                              href={`/workspaces/${item.workspace.id}`}
                                              className="text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 font-medium"
                                            >
                                              <span>📁 {item.workspace.name} ↗</span>
                                            </Link>
                                            {item.account && (
                                              <span className="text-[#6B7268] dark:text-[#8E9C95]">
                                                • 💳 {item.account.name}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }

                                    // Expense Item
                                    const isDrawerOpen = Boolean(expandedDrawers[item.id]);
                                    const timeStr = new Date(item.date).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    });

                                    return (
                                      <div
                                        key={item.id}
                                        className="p-3 sm:p-3.5 hover:bg-[#FAF8F5]/50 dark:hover:bg-[#1A2229]/30 rounded-xl transition-colors space-y-2"
                                      >
                                        {/* Top Line: Category Icon, Description, Pairwise Impact Badge */}
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex items-start gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-xl bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] text-[#0F5C53] dark:text-[#10B981] flex items-center justify-center flex-shrink-0 mt-0.5">
                                              {getCategoryIcon(item.category)}
                                            </div>
                                            <div className="min-w-0">
                                              <p className="font-semibold text-xs text-[#162B27] dark:text-white truncate">
                                                {item.description}
                                              </p>
                                              <div className="flex items-center gap-1.5 text-[10px] text-[#6B7268] dark:text-[#8E9C95] mt-0.5 flex-wrap">
                                                <span>{item.category || "Uncategorized"}</span>
                                                <span>•</span>
                                                <span>{timeStr}</span>
                                                <span>•</span>
                                                <Link
                                                  href={`/workspaces/${item.workspace.id}`}
                                                  className="text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-0.5 font-medium"
                                                >
                                                  <span>📁 {item.workspace.name}</span>
                                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                    <polyline points="15 3 21 3 21 9" />
                                                  </svg>
                                                </Link>
                                                {item.account && (
                                                  <>
                                                    <span>•</span>
                                                    <span className="font-medium text-stone-700 dark:text-stone-300">
                                                      💳 {item.account.name}
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Pairwise Impact Badge */}
                                          <div className="text-right flex-shrink-0">
                                            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                              item.pairwiseDelta > 0
                                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                                : item.pairwiseDelta < 0
                                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                                : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
                                            }`}>
                                              {item.pairwiseDelta > 0
                                                ? `+${symbol}${Math.round(item.pairwiseDelta)} (Owes you)`
                                                : item.pairwiseDelta < 0
                                                ? `-${symbol}${Math.round(Math.abs(item.pairwiseDelta))} (You owe)`
                                                : "Settled / Neutral"}
                                            </div>
                                            <span className="text-[10px] text-[#6B7268] dark:text-[#8E9C95] block mt-0.5">
                                              Total Bill: {symbol}{Math.round(item.totalAmount).toLocaleString()}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Bottom Line: Who Paid & Individual Shares */}
                                        <div className="bg-[#FAF8F5]/80 dark:bg-[#1A2229]/50 border border-[#E5E0D8]/60 dark:border-[#1E2824]/60 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                                          <div className="flex items-center gap-3 flex-wrap">
                                            {/* Payer Summary */}
                                            <div>
                                              <span className="text-[10px] text-[#6B7268] dark:text-[#8E9C95] block uppercase font-bold tracking-wider">
                                                Paid
                                              </span>
                                              <span className="font-semibold text-[11px] text-[#162B27] dark:text-white">
                                                {item.selfPaid > 0 && item.personPaid === 0
                                                  ? `You paid ${symbol}${Math.round(item.selfPaid)}`
                                                  : item.personPaid > 0 && item.selfPaid === 0
                                                  ? `${selectedPerson.name} paid ${symbol}${Math.round(item.personPaid)}`
                                                  : item.selfPaid > 0 && item.personPaid > 0
                                                  ? `You (${symbol}${Math.round(item.selfPaid)}) • ${selectedPerson.name} (${symbol}${Math.round(item.personPaid)})`
                                                  : `Paid by ${item.payments.map((p) => p.name).join(", ") || "Other"}`}
                                              </span>
                                            </div>

                                            <span className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700" />

                                            {/* Contact Share */}
                                            <div>
                                              <span className="text-[10px] text-[#6B7268] dark:text-[#8E9C95] block uppercase font-bold tracking-wider">
                                                {selectedPerson.name}&apos;s Share
                                              </span>
                                              <span className="font-semibold text-[11px] text-[#162B27] dark:text-white">
                                                {symbol}{Math.round(item.personShare).toLocaleString()}
                                              </span>
                                            </div>

                                            <span className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700" />

                                            {/* Your Share */}
                                            <div>
                                              <span className="text-[10px] text-[#6B7268] dark:text-[#8E9C95] block uppercase font-bold tracking-wider">
                                                Your Share
                                              </span>
                                              <span className="font-semibold text-[11px] text-[#162B27] dark:text-white">
                                                {symbol}{Math.round(item.selfShare).toLocaleString()}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Toggle Split Details */}
                                          <button
                                            type="button"
                                            onClick={() => toggleDrawer(item.id)}
                                            className="text-[10px] font-semibold text-[#0F5C53] dark:text-[#10B981] hover:underline flex items-center gap-1 cursor-pointer ml-auto"
                                          >
                                            <span>{isDrawerOpen ? "Hide Breakdown" : "View Breakdown"}</span>
                                            <svg className={`w-3 h-3 transition-transform ${isDrawerOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                          </button>
                                        </div>

                                        {/* Expandable Split Participants Drawer */}
                                        {isDrawerOpen && (
                                          <div className="p-3 bg-white dark:bg-[#161D22] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl text-xs space-y-2.5">
                                            <div className="grid grid-cols-2 gap-4">
                                              {/* Who Paid */}
                                              <div>
                                                <p className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider mb-1.5">
                                                  Payments Made
                                                </p>
                                                <div className="space-y-1">
                                                  {item.payments.map((p) => (
                                                    <div key={p.personId} className="flex items-center justify-between text-[11px]">
                                                      <span className={p.isSelf ? "font-bold text-[#0F5C53] dark:text-[#10B981]" : "text-stone-700 dark:text-stone-300"}>
                                                        {p.name}
                                                      </span>
                                                      <span className="font-medium text-stone-900 dark:text-stone-100">
                                                        {symbol}{Math.round(p.amount).toLocaleString()}
                                                      </span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>

                                              {/* Who Split */}
                                              <div>
                                                <p className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider mb-1.5">
                                                  Split Allocation
                                                </p>
                                                <div className="space-y-1">
                                                  {item.splits.map((s) => (
                                                    <div key={s.personId} className="flex items-center justify-between text-[11px]">
                                                      <span className={s.isSelf ? "font-bold text-[#0F5C53] dark:text-[#10B981]" : "text-stone-700 dark:text-stone-300"}>
                                                        {s.name}
                                                      </span>
                                                      <span className="font-medium text-stone-900 dark:text-stone-100">
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
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">
                Select a contact on the left to inspect their ledger details.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                  Add New Contact
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-white cursor-pointer text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mb-4 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleAdd} className="space-y-3.5">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Razaq, Hamza"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-[#8E9C95] tracking-wider block mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-[#8E9C95] hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229] rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {submitting ? "Saving..." : "+ Save Contact"}
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
