"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatMoney, getCurrencySymbol } from "@/lib/currency";

interface CurrencyContextType {
  currency: string;
  symbol: string;
  format: (amount: number | string) => string;
  updateCurrency: (newCurrency: string) => Promise<void>;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "PKR",
  symbol: "Rs.",
  format: (amt) => formatMoney(amt, "PKR"),
  updateCurrency: async () => {},
  loading: true,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState("PKR");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ user: { currency?: string } }>("/api/auth/me")
      .then((res) => {
        if (res.user?.currency) {
          setCurrency(res.user.currency);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function updateCurrency(newCurrency: string) {
    setCurrency(newCurrency);
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ currency: newCurrency }),
      });
    } catch (err) {
      console.error("Failed to persist currency setting:", err);
    }
  }

  const symbol = getCurrencySymbol(currency);
  const format = (amount: number | string) => formatMoney(amount, currency);

  return (
    <CurrencyContext.Provider value={{ currency, symbol, format, updateCurrency, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
