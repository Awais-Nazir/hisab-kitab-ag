"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";
import { MobileHeader } from "./MobileHeader";
import { BottomNav } from "./BottomNav";
import { CurrencyProvider } from "@/context/CurrencyContext";

interface User {
  id: string;
  name: string;
  email: string;
  currency?: string;
  selfPersonId?: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onAddEntry?: () => void;
  mobileAction?: React.ReactNode;
}

export function AppLayout({
  children,
  title = "Dashboard",
  subtitle = "Private Ledger #001",
  onAddEntry,
  mobileAction,
}: AppLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    apiFetch<{ user: User }>("/api/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => {
        // Handled by individual pages or redirect if 401
      });
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
    <CurrencyProvider>
      <div className="min-h-screen bg-[#FAF8F5] text-[#1B211F] flex flex-col antialiased">
        {/* Desktop Sidebar */}
        <Sidebar userName={user?.name ?? "Account Admin"} userEmail={user?.email} onLogout={handleLogout} />

        {/* Main Content Area (Offset by Desktop Sidebar) */}
        <div className="md:pl-64 flex-1 flex flex-col min-w-0">
          {/* Desktop Top Header */}
          <TopHeader title="HISAB KITAB" subtitle={subtitle} onAddEntry={onAddEntry} />

          {/* Mobile Header */}
          <MobileHeader title={title} userName={user?.name ?? "User"} action={mobileAction} />

          {/* Page Content */}
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
            {children}
          </main>
        </div>

        {/* Mobile Fixed Bottom Navigation */}
        <BottomNav />
      </div>
    </CurrencyProvider>
  );
}
