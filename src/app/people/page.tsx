"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
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

interface LedgerDay {
  date: string;
  delta: number;
  runningTotal: number;
}

interface Ledger {
  personId: string;
  total: number;
  days: LedgerDay[];
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
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Load ledger when selected person changes
  useEffect(() => {
    if (!selectedPerson) return;
    setLoadingLedger(true);
    apiFetch<Ledger>(`/api/people/${selectedPerson.id}/ledger`)
      .then((res) => setLedger(res))
      .catch(() => setLedger(null))
      .finally(() => setLoadingLedger(false));
  }, [selectedPerson]);

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
      ? `Hi ${person.name}, just sending a quick reminder about our balance of ${symbol}${balance.toFixed(2)} on Hisab Kitab.`
      : `Hi ${person.name}, I checked our ledger on Hisab Kitab and I owe you ${symbol}${Math.abs(balance).toFixed(2)}. Let's settle up soon!`;

    navigator.clipboard.writeText(text);
    setCopiedReminder(true);
    setTimeout(() => setCopiedReminder(false), 3000);
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
        {/* Header Section matching Figma */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#0F5C53]">
              Contacts & Directory
            </div>
            <h1 className="font-serif font-bold text-3xl md:text-4xl text-[#162B27] tracking-tight mt-0.5">
              People
            </h1>
            <p className="text-xs text-[#6B7268] mt-1">
              Track multi-ledger balances and transaction history with your friends and contacts.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>+ Add Contact</span>
          </button>
        </div>

        {/* Top 3 Summary Cards matching Figma */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Card 1: Total Owed to You */}
          <div className="bg-white dark:bg-stone-900 border border-[#E5E0D8] dark:border-stone-800 rounded-2xl p-5 shadow-xs">
            <span className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block">
              Total Owed to You
            </span>
            <div className="font-serif font-bold text-2xl text-[#1E7D46] dark:text-emerald-400 mt-2">
              +{symbol}{totalOwedToYou.toFixed(2)}
            </div>
            <p className="text-xs text-[#6B7268] dark:text-stone-400 mt-1">
              receivable across contacts
            </p>
          </div>

          {/* Card 2: Total You Owe */}
          <div className="bg-white dark:bg-stone-900 border border-[#E5E0D8] dark:border-stone-800 rounded-2xl p-5 shadow-xs">
            <span className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block">
              Total You Owe
            </span>
            <div className="font-serif font-bold text-2xl text-[#A8441F] dark:text-rose-400 mt-2">
              -{symbol}{totalYouOwe.toFixed(2)}
            </div>
            <p className="text-xs text-[#6B7268] dark:text-stone-400 mt-1">
              payable across contacts
            </p>
          </div>

          {/* Card 3: Net Position */}
          <div className="bg-white dark:bg-stone-900 border border-[#E5E0D8] dark:border-stone-800 rounded-2xl p-5 shadow-xs">
            <span className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block">
              Net Position
            </span>
            <div className={`font-serif font-bold text-2xl mt-2 ${netTotal >= 0 ? "text-[#1E7D46] dark:text-emerald-400" : "text-[#A8441F] dark:text-rose-400"}`}>
              {netTotal >= 0 ? "+" : "-"}{symbol}{Math.abs(netTotal).toFixed(2)}
            </div>
            <p className="text-xs text-[#6B7268] dark:text-stone-400 mt-1">
              {netTotal >= 0 ? "Overall net positive" : "Overall net payable"}
            </p>
          </div>
        </div>

        {/* Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (5 Cols): Contacts List with Search & Filter */}
          <div className="lg:col-span-5 bg-white dark:bg-stone-900 border border-[#E5E0D8] dark:border-stone-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            {/* Search Input */}
            <div className="relative">
              <svg className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-[#FAF8F5] dark:bg-stone-800 border border-[#E5E0D8] dark:border-stone-700 rounded-xl text-xs text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex bg-[#FAF8F5] dark:bg-stone-800 border border-[#E5E0D8] dark:border-stone-700 p-1 rounded-xl text-[11px] font-medium overflow-x-auto">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "owes_me", label: "Owes Me" },
                  { id: "i_owe", label: "I Owe" },
                  { id: "settled", label: "Settled" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`flex-1 py-1.5 px-2 rounded-lg whitespace-nowrap transition-all cursor-pointer text-center ${
                    filterTab === tab.id
                      ? "bg-white dark:bg-stone-900 text-[#0F5C53] dark:text-emerald-400 font-bold shadow-xs"
                      : "text-[#6B7268] dark:text-stone-400"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Contacts Scrollable List */}
            {loading ? (
              <div className="py-8 text-center text-xs text-[#6B7268] dark:text-stone-400">Loading contacts...</div>
            ) : filteredPeople.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6B7268] dark:text-stone-400">
                No contacts match the filter.
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filteredPeople.map((person) => {
                  const bal = netMap[person.id] || 0;
                  const isSelected = selectedPerson?.id === person.id;

                  return (
                    <div
                      key={person.id}
                      onClick={() => setSelectedPerson(person)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-emerald-50/70 dark:bg-[#0F5C53]/30 border-[#0F5C53] dark:border-[#10B981] shadow-xs"
                          : "bg-white dark:bg-stone-900/50 hover:bg-[#FAF8F5] dark:hover:bg-stone-800/50 border-[#E5E0D8] dark:border-stone-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0F5C53]/15 dark:bg-[#0F5C53]/35 text-[#0F5C53] dark:text-emerald-400 font-serif font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {person.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-[#162B27] dark:text-white">
                            {person.name}
                          </p>
                          <p className="text-[11px] text-[#6B7268] dark:text-stone-400 truncate max-w-[140px]">
                            {person.email || "No email"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`font-serif font-bold text-xs ${bal > 0 ? "text-[#1E7D46] dark:text-emerald-400" : bal < 0 ? "text-[#A8441F] dark:text-rose-400" : "text-[#6B7268] dark:text-stone-400"}`}>
                          {bal > 0 ? `+${symbol}${bal.toFixed(2)}` : bal < 0 ? `-${symbol}${Math.abs(bal).toFixed(2)}` : "Settled"}
                        </span>
                        <span className="block text-[10px] text-[#6B7268] dark:text-stone-400">
                          {bal > 0 ? "Owes you" : bal < 0 ? "You owe" : "Clear"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column (7 Cols): Contact Detail & Running Ledger Inspection */}
          <div className="lg:col-span-7 bg-white dark:bg-stone-900 border border-[#E5E0D8] dark:border-stone-800 rounded-3xl p-6 shadow-xs space-y-6">
            {selectedPerson ? (
              <>
                {/* Contact Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#F0ECE6] dark:border-stone-800">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-full bg-[#0F5C53]/15 dark:bg-[#0F5C53]/35 text-[#0F5C53] dark:text-emerald-400 font-serif font-bold text-xl flex items-center justify-center">
                      {selectedPerson.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-serif font-bold text-2xl text-[#162B27] dark:text-white">
                        {selectedPerson.name}
                      </h2>
                      <p className="text-xs text-[#6B7268] dark:text-stone-400">
                        {selectedPerson.email || "No contact email listed"}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block">
                      Net Balance
                    </span>
                    <div className={`font-serif font-bold text-2xl mt-0.5 ${(netMap[selectedPerson.id] || 0) > 0 ? "text-[#1E7D46] dark:text-emerald-400" : (netMap[selectedPerson.id] || 0) < 0 ? "text-[#A8441F] dark:text-rose-400" : "text-[#162B27] dark:text-white"}`}>
                      {(netMap[selectedPerson.id] || 0) > 0 ? "+" : (netMap[selectedPerson.id] || 0) < 0 ? "-" : ""}{symbol}{Math.abs(netMap[selectedPerson.id] || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons: Nudge / Reminder & Remove */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyReminder(selectedPerson, netMap[selectedPerson.id] || 0)}
                      className="bg-[#FAF8F5] dark:bg-stone-800 hover:bg-[#F2EEE9] dark:hover:bg-stone-750 border border-[#E5E0D8] dark:border-stone-700 text-[#162B27] dark:text-stone-200 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>💬 Send Reminder / Nudge</span>
                    </button>
                    {copiedReminder && (
                      <span className="text-xs font-medium text-[#1E7D46] dark:text-emerald-400">
                        ✓ Copied message to clipboard!
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(selectedPerson.id)}
                    className="text-stone-400 hover:text-rose-600 text-xs cursor-pointer p-1"
                    title="Remove Contact"
                  >
                    Delete
                  </button>
                </div>

                {/* Running Ledger History matching Lena / Dena Figma Spec */}
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#162B27] dark:text-white mb-1">
                    Running Ledger Delta
                  </h3>
                  <p className="text-xs text-[#6B7268] dark:text-stone-400 mb-4">
                    Day-by-day balance timeline across all shared workspaces.
                  </p>

                  {loadingLedger ? (
                    <div className="py-12 text-center text-xs text-[#6B7268] dark:text-stone-400">
                      Loading ledger timeline...
                    </div>
                  ) : !ledger || ledger.days.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#FAF8F5] dark:bg-stone-800/40 border border-[#E5E0D8] dark:border-stone-800 text-center text-xs text-[#6B7268] dark:text-stone-400">
                      No recorded activity with {selectedPerson.name} yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {ledger.days.map((day) => (
                        <div
                          key={day.date}
                          className="bg-[#FAF8F5] dark:bg-stone-800/60 border border-[#E5E0D8] dark:border-stone-700 rounded-xl p-3 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-medium text-[#162B27] dark:text-stone-200">
                              {new Date(day.date).toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="text-stone-400 text-[11px] block mt-0.5">
                              Cumulative balance: {symbol}{day.runningTotal.toFixed(2)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className={`font-serif font-bold text-sm ${day.delta > 0 ? "text-[#1E7D46] dark:text-emerald-400" : day.delta < 0 ? "text-[#A8441F] dark:text-rose-400" : "text-stone-500"}`}>
                              {day.delta > 0 ? "+" : ""}{symbol}{Math.abs(day.delta).toFixed(2)}
                            </span>
                            <span className="block text-[10px] text-stone-400">
                              {day.delta > 0 ? "Owed to you" : "You paid/owe"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-xs text-[#6B7268] dark:text-stone-400">
                Select a contact on the left to inspect their ledger details.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 border border-[#E5E0D8] dark:border-stone-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-xl text-[#162B27] dark:text-white">
                Add New Contact
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
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
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-stone-800 border border-[#E5E0D8] dark:border-stone-700 rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="rahul@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs bg-[#FAF8F5] dark:bg-stone-800 border border-[#E5E0D8] dark:border-stone-700 rounded-xl px-3 py-2.5 text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-1/3 py-2.5 text-xs font-semibold text-[#6B7268] dark:text-stone-400 hover:bg-[#FAF8F5] dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="w-2/3 bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "+ Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}