"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";

type Person = { id: string; name: string; email: string | null };
type Batch = {
    batchId: string;
    date: string;
    fromPerson: { id: string; name: string; isSelf: boolean };
    toPerson: { id: string; name: string; isSelf: boolean };
    total: number;
    breakdown: { workspaceName: string; amount: number }[];
};

export function GlobalSettlementSection({
    selfPersonId,
    onSettled,
}: {
    selfPersonId: string;
    onSettled: () => void;
}) {
    const { symbol } = useCurrency();
    const [contacts, setContacts] = useState<Person[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);

    const [fromId, setFromId] = useState("");
    const [toId, setToId] = useState("");
    const [amount, setAmount] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ breakdown: { workspaceName: string; amount: number }[]; remaining: number } | null>(null);

    const options = [{ id: selfPersonId, name: "You" }, ...contacts];

    async function load() {
        const [peopleRes, batchesRes] = await Promise.all([
            apiFetch<{ people: Person[] }>("/api/people"),
            apiFetch<{ batches: Batch[] }>("/api/settlements/global"),
        ]);
        setContacts(peopleRes.people);
        setBatches(batchesRes.batches);
    }

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (submitting || !fromId || !toId || fromId === toId) return;
        setSubmitting(true);
        setResult(null);
        try {
            const res = await apiFetch<{
                totalOwedBefore: number;
                settlements: { amount: string; workspace: { name: string } }[];
            }>("/api/settlements/global", {
                method: "POST",
                body: JSON.stringify({ fromPersonId: fromId, toPersonId: toId, amount: parseFloat(amount) }),
            });
            const breakdown = res.settlements.map((s) => ({
                workspaceName: s.workspace.name,
                amount: Number(s.amount),
            }));
            const paid = breakdown.reduce((s, b) => s + b.amount, 0);
            setResult({ breakdown, remaining: Math.round((res.totalOwedBefore - paid) * 100) / 100 });
            setAmount("");
            await load();
            onSettled();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to record settlement");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDeleteBatch(batchId: string) {
        if (!confirm("Delete this global settlement? This removes it from every workspace it touched.")) return;
        try {
            await apiFetch(`/api/settlements/global/${batchId}`, { method: "DELETE" });
            await load();
            onSettled();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to delete");
        }
    }

    if (loading) return null;

    return (
        <section className="space-y-4">
            <div>
                <h4 className="font-serif font-bold text-base text-[#162B27]">Multi-Workspace Settlement</h4>
                <p className="text-xs text-[#6B7268] mt-0.5">
                    Record a single payment that settles debts across multiple shared ledgers FIFO.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">From</label>
                        <select
                            value={fromId}
                            onChange={(e) => setFromId(e.target.value)}
                            required
                            className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2 text-[#162B27]"
                        >
                            <option value="">Select payer...</option>
                            {options.map((o) => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">To</label>
                        <select
                            value={toId}
                            onChange={(e) => setToId(e.target.value)}
                            required
                            className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-2.5 py-2 text-[#162B27]"
                        >
                            <option value="">Select recipient...</option>
                            {options.map((o) => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] uppercase font-bold text-[#6B7268] tracking-wider block mb-1">
                        Amount ({symbol})
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        className="w-full text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-3 py-2 text-[#162B27]"
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#0F5C53] hover:bg-[#0A3F38] text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                    {submitting ? "Settling..." : `Execute Settlement (${symbol})`}
                </button>
            </form>

            {result && (
                <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl p-3 text-xs space-y-1">
                    <p className="font-semibold text-[#0F5C53]">Settlement Breakdown:</p>
                    {result.breakdown.map((b, i) => (
                        <p key={i} className="text-[#162B27]">{b.workspaceName}: {symbol}{b.amount.toFixed(2)}</p>
                    ))}
                    {result.remaining > 0 && (
                        <p className="text-rose-600 font-semibold pt-1">
                            {symbol}{result.remaining.toFixed(2)} remaining balance
                        </p>
                    )}
                </div>
            )}

            {batches.length > 0 && (
                <div className="pt-3 border-t border-[#F0ECE6] space-y-2">
                    <p className="text-[11px] uppercase font-bold text-[#6B7268] tracking-wider">Settlement Batches</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {batches.map((b) => (
                            <div key={b.batchId} className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl p-2.5 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-[#162B27]">
                                        {b.fromPerson.isSelf ? "You" : b.fromPerson.name} → {b.toPerson.isSelf ? "You" : b.toPerson.name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-[#162B27]">{symbol}{b.total.toFixed(2)}</span>
                                        <button
                                            onClick={() => handleDeleteBatch(b.batchId)}
                                            className="text-stone-400 hover:text-rose-600 text-[11px] cursor-pointer"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-stone-400 mt-0.5">
                                    {new Date(b.date).toLocaleDateString()} • {b.breakdown.map((x) => `${x.workspaceName} (${symbol}${x.amount.toFixed(2)})`).join(", ")}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}