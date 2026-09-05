"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";
import { MobileHeader } from "./MobileHeader";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onAddEntry?: () => void;
  addEntryLabel?: string;
  mobileAction?: React.ReactNode;
}

const MOBILE_TABS = [
  "/dashboard",
  "/workspaces",
  "/accounts",
  "/people",
  "/categories",
];

export function AppLayout({
  children,
  title = "Dashboard",
  subtitle = "Private Ledger #001",
  onAddEntry,
  addEntryLabel = "Add Entry",
  mobileAction,
}: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useUser();
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Swipe left / right gesture navigation ONLY on mobile screen
  useEffect(() => {
    function handleTouchStart(e: TouchEvent) {
      if (typeof window === "undefined" || window.innerWidth >= 768) return;
      if (e.touches.length !== 1) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest("input") ||
          target.closest("textarea") ||
          target.closest("select") ||
          target.closest("button") ||
          target.closest("[role='dialog']") ||
          target.closest(".recharts-responsive-container") ||
          target.closest(".overflow-x-auto"))
      ) {
        return;
      }

      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!touchStartRef.current || typeof window === "undefined" || window.innerWidth >= 768) return;
      if (e.changedTouches.length !== 1) return;

      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      const elapsed = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      // Require significant horizontal distance, predominantly horizontal vector, and quick swipe
      if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5 || elapsed > 500) {
        return;
      }

      const currentIndex = MOBILE_TABS.findIndex((tab) =>
        tab === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab)
      );

      if (deltaX < 0) {
        // Swiped Left (finger right to left) -> Navigate to Next Page
        if (currentIndex !== -1 && currentIndex < MOBILE_TABS.length - 1) {
          router.push(MOBILE_TABS[currentIndex + 1]);
        }
      } else {
        // Swiped Right (finger left to right) -> Navigate to Previous Page
        if (pathname.startsWith("/workspaces/") && pathname !== "/workspaces") {
          router.push("/workspaces");
        } else if (currentIndex > 0) {
          router.push(MOBILE_TABS[currentIndex - 1]);
        }
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pathname, router]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#111413] text-[#1B211F] dark:text-[#F2F5F3] flex flex-col antialiased transition-colors duration-200">
      {/* Desktop Sidebar */}
      <Sidebar
        userName={user?.name ?? "Account Admin"}
        userEmail={user?.email}
        userImage={user?.image}
        onLogout={logout}
      />

      {/* Main Content Area (Offset by Desktop Sidebar) */}
      <div className="md:pl-64 flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header */}
        <TopHeader
          title="HISAB KITAB"
          subtitle={subtitle}
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
        />

        {/* Mobile Header */}
        <MobileHeader
          title={title}
          userName={user?.name ?? "User"}
          userImage={user?.image}
          action={mobileAction}
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
        />

        {/* Page Content */}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
