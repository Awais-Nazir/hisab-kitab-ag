"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: string | number;
  color?: string;
  icon?: string;
}

interface AccountSelectProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export function AccountSelect({
  value,
  onChange,
  label = "Paid From (Kaha se hoyi ha)",
  placeholder,
  required = false,
}: AccountSelectProps) {
  const { symbol } = useCurrency();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ accounts: Account[] }>("/api/accounts")
      .then((res) => {
        setAccounts(res.accounts);
        // If no value is selected and no placeholder, default to the first account (typically Cash)
        if (!value && !placeholder && res.accounts.length > 0) {
          onChange(res.accounts[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {label && (
        <label className="text-[11px] uppercase font-bold text-[#6B7268] dark:text-stone-400 tracking-wider block mb-1">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={loading}
        className="w-full text-xs bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl px-3 py-2 text-[#162B27] dark:text-white focus:bg-white dark:focus:bg-[#1A201D] focus:outline-none focus:border-[#0F5C53]"
      >
        {loading ? (
          <option value="">Loading accounts...</option>
        ) : (
          <>
            {placeholder && <option value="">{placeholder}</option>}
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({symbol}{Math.round(Number(acc.balance))}) {acc.type === "UDHAR_KHATA" ? "• Udhar Khata" : ""}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
