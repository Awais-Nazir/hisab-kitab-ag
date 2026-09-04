"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";

type LedgerDay = { date: string; delta: number; runningTotal: number };
type Ledger = { personId: string; total: number; days: LedgerDay[] };

export function LenaDenaRow({ personId, name, netBalance }: { personId: string; name: string; netBalance: number }) {
    const { symbol } = useCurrency();
    const [expanded, setExpanded] = useState(false);
    const [ledger, setLedger] = useState<Ledger | null>(null);
    const [loading, setLoading] = useState(false);

    async function toggle() {
        if (!expanded && !ledger) {
            setLoading(true);
            try {
                const res = await apiFetch<Ledger>(`/api/people/${personId}/ledger`);
                setLedger(res);
            } catch {
                // silently fail, stays collapsed
            } finally {
                setLoading(false);
            }
        }
        setExpanded((prev) => !prev);
    }

    return (
        <div className="border-b border-[#F0ECE6] last:border-0 py-1">
            <button
                onClick={toggle}
                className="w-full flex items-center justify-between py-2 text-left bg-transparent border-0 cursor-pointer hover:text-[#0F5C53] transition-colors"
            >
                <span className="text-xs font-medium text-[#162B27] flex items-center gap-1.5">
                    <span className="text-stone-400 text-[10px]">{expanded ? "▼" : "▶"}</span> {name}
                </span>
                <span className={`text-xs font-serif font-bold ${netBalance > 0 ? "text-[#1E7D46]" : netBalance < 0 ? "text-[#A8441F]" : "text-[#6B7268]"}`}>
                    {netBalance > 0 ? "+" : ""}{symbol}{Math.abs(netBalance).toFixed(2)}
                </span>
            </button>
            {expanded && (
                <div className="pl-4 pr-1 pb-3 pt-1 space-y-1.5">
                    {loading && <p className="text-xs text-[#6B7268]">Loading entries...</p>}
                    {ledger && ledger.days.length === 0 && <p className="text-xs text-[#6B7268]">No activity yet.</p>}
                    {ledger?.days.map((d) => (
                        <div key={d.date} className="flex items-center justify-between text-xs py-1 border-b border-[#FAF8F5]">
                            <span className="text-stone-500">
                                {new Date(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                            </span>
                            <span className={`font-semibold ${d.delta > 0 ? "text-[#1E7D46]" : d.delta < 0 ? "text-[#A8441F]" : "text-stone-500"}`}>
                                {d.delta > 0 ? "+" : ""}{symbol}{Math.abs(d.delta).toFixed(2)}
                            </span>
                            <span className="text-stone-400 text-[11px]">bal: {symbol}{d.runningTotal.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}