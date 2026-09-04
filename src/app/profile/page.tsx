"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
import { CURRENCIES } from "@/lib/currency";
import { useCurrency } from "@/context/CurrencyContext";

interface User {
  id: string;
  name: string;
  email: string;
  currency?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { currency, updateCurrency } = useCurrency();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState("PKR");
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    apiFetch<{ user: User }>("/api/auth/me")
      .then((res) => {
        setUser(res.user);
        setSelectedCurrency(res.user.currency || "PKR");
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (currency) {
      setSelectedCurrency(currency);
    }
  }, [currency]);

  async function handleSaveCurrency() {
    setSavingCurrency(true);
    setSavedSuccess(false);
    try {
      await updateCurrency(selectedCurrency);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      alert("Failed to save currency preference");
    } finally {
      setSavingCurrency(false);
    }
  }

  async function handleLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      router.push("/login");
    }
  }

  return (
    <AppLayout title="Profile" subtitle="Account Settings">
      <div className="max-w-xl mx-auto">
        <h1 className="font-serif font-bold text-2xl md:text-3xl text-[#162B27] mb-2">
          Your Profile
        </h1>
        <p className="text-sm text-[#5A6863] mb-6">
          Account details, ledger preferences, and currency settings.
        </p>

        {loading ? (
          <div className="p-8 text-center text-[#5A6863]">Loading profile...</div>
        ) : (
          <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-4 pb-6 border-b border-[#F0ECE6]">
              <div className="w-16 h-16 rounded-full bg-[#0F5C53]/15 border border-[#0F5C53]/30 flex items-center justify-center text-[#0F5C53] font-serif font-bold text-2xl">
                {user?.name?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="font-serif font-bold text-xl text-[#162B27]">{user?.name}</h2>
                <p className="text-sm text-[#6B7268]">{user?.email}</p>
                <span className="inline-block text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-[#0F5C53] border border-emerald-200 px-2.5 py-0.5 rounded-full mt-1.5">
                  Private Ledger Member
                </span>
              </div>
            </div>

            {/* Currency Preference Setting */}
            <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-serif font-bold text-base text-[#162B27]">
                    Default Currency
                  </h3>
                  <p className="text-xs text-[#6B7268] mt-0.5">
                    Choose the currency symbol displayed across your dashboard, workspaces, and ledger entries.
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#0F5C53]/10 text-[#0F5C53] flex items-center justify-center font-bold text-sm">
                  {CURRENCIES.find((c) => c.code === selectedCurrency)?.symbol || "Rs."}
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-white border border-[#E5E0D8] rounded-xl text-sm font-medium text-[#162B27] focus:outline-none focus:border-[#0F5C53]"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleSaveCurrency}
                  disabled={savingCurrency || selectedCurrency === currency}
                  className="bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingCurrency ? "Saving..." : "Save Currency"}
                </button>
              </div>

              {savedSuccess && (
                <p className="text-xs font-semibold text-[#1E7D46] mt-2 flex items-center gap-1">
                  ✓ Currency preference updated successfully!
                </p>
              )}
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-[#6B7268] uppercase tracking-wider block mb-1">
                  Display Name
                </label>
                <div className="p-3 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl text-sm font-medium text-[#162B27]">
                  {user?.name}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7268] uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <div className="p-3 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl text-sm font-medium text-[#162B27]">
                  {user?.email}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#F0ECE6]">
              <button
                onClick={handleLogout}
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
