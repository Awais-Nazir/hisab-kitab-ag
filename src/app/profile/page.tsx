"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";

interface User {
  id: string;
  name: string;
  email: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ user: User }>("/api/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

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
          Account details and ledger preferences.
        </p>

        {loading ? (
          <div className="p-8 text-center text-[#5A6863]">Loading profile...</div>
        ) : (
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center gap-4 pb-6 border-b border-[#F0ECE6]">
              <div className="w-16 h-16 rounded-full bg-[#0F5C53]/15 border border-[#0F5C53]/30 flex items-center justify-center text-[#0F5C53] font-serif font-bold text-2xl">
                {user?.name?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="font-serif font-bold text-xl text-[#162B27]">{user?.name}</h2>
                <p className="text-sm text-[#6B7268]">{user?.email}</p>
                <span className="inline-block text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-[#0F5C53] border border-emerald-200 px-2 py-0.5 rounded-full mt-1.5">
                  Private Ledger Member
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#6B7268] uppercase tracking-wider">
                  Display Name
                </label>
                <p className="font-medium text-[#162B27] mt-0.5">{user?.name}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#6B7268] uppercase tracking-wider">
                  Email Address
                </label>
                <p className="font-medium text-[#162B27] mt-0.5">{user?.email}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#F0ECE6]">
              <button
                onClick={handleLogout}
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer"
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
