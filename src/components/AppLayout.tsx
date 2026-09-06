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
  const mainRef = useRef<HTMLElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const directionLockRef = useRef<"horizontal" | "vertical" | null>(null);
  const swipeDirectionRef = useRef<"left" | "right" | null>(null);

  // When pathname changes after a swipe navigation, smoothly animate the incoming view in
  useEffect(() => {
    if (!mainRef.current) return;
    if (swipeDirectionRef.current) {
      const dir = swipeDirectionRef.current;
      swipeDirectionRef.current = null;
      const startX = dir === "left" ? "20vw" : "-20vw";

      mainRef.current.style.transition = "none";
      mainRef.current.style.transform = `translateX(${startX})`;
      mainRef.current.style.opacity = "0.7";

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!mainRef.current) return;
          mainRef.current.style.transition =
            "transform 220ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms ease-out";
          mainRef.current.style.transform = "translateX(0)";
          mainRef.current.style.opacity = "1";

          setTimeout(() => {
            if (mainRef.current) {
              mainRef.current.style.transition = "";
              mainRef.current.style.transform = "";
              mainRef.current.style.opacity = "";
            }
          }, 240);
        });
      });
    } else {
      mainRef.current.style.transition = "";
      mainRef.current.style.transform = "";
      mainRef.current.style.opacity = "";
    }
  }, [pathname]);

  // Real-time mobile swipe gesture engine (WhatsApp-like responsive feedback)
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
          target.closest(".overflow-x-auto") ||
          target.closest("[data-no-swipe]"))
      ) {
        return;
      }

      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
      directionLockRef.current = null;
    }

    function handleTouchMove(e: TouchEvent) {
      if (!touchStartRef.current || typeof window === "undefined" || window.innerWidth >= 768) return;
      if (e.touches.length !== 1) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - touchStartRef.current.x;
      const dy = currentY - touchStartRef.current.y;

      // Detect and lock gesture direction once small movement threshold is crossed
      if (directionLockRef.current === null) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          if (Math.abs(dx) > Math.abs(dy)) {
            directionLockRef.current = "horizontal";
          } else {
            directionLockRef.current = "vertical";
          }
        }
      }

      if (directionLockRef.current === "horizontal") {
        if (e.cancelable) {
          e.preventDefault();
        }

        const currentIndex = MOBILE_TABS.findIndex((tab) =>
          tab === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab)
        );

        // Check edge boundaries
        const isLeftBoundary =
          (currentIndex === 0 || currentIndex === -1) && !pathname.startsWith("/workspaces/");
        const isRightBoundary = currentIndex === MOBILE_TABS.length - 1;

        let visualDx = dx;
        // Rubber-band damping resistance at boundaries
        if ((dx > 0 && isLeftBoundary) || (dx < 0 && isRightBoundary)) {
          visualDx = dx * 0.25;
        }

        if (mainRef.current) {
          mainRef.current.style.transition = "none";
          mainRef.current.style.transform = `translateX(${visualDx}px)`;
          mainRef.current.style.opacity = `${Math.max(
            0.7,
            1 - Math.abs(visualDx) / (window.innerWidth * 1.5)
          )}`;
        }
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!touchStartRef.current || typeof window === "undefined" || window.innerWidth >= 768) return;
      if (e.changedTouches.length !== 1) return;

      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const elapsed = Math.max(1, Date.now() - touchStartRef.current.time);
      const isHorizontal = directionLockRef.current === "horizontal";

      touchStartRef.current = null;
      directionLockRef.current = null;

      if (!isHorizontal || !mainRef.current) {
        return;
      }

      const velocity = Math.abs(deltaX) / elapsed; // px/ms
      const isFlick = velocity > 0.35 && Math.abs(deltaX) > 30;
      const isDrag = Math.abs(deltaX) > window.innerWidth * 0.22;
      const shouldNavigate = isFlick || isDrag;

      const currentIndex = MOBILE_TABS.findIndex((tab) =>
        tab === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab)
      );

      let targetTab: string | null = null;
      let exitDirection: "left" | "right" | null = null;

      if (shouldNavigate) {
        if (deltaX < 0) {
          // Swiped Left (finger right to left) -> Navigate to Next Page
          if (currentIndex !== -1 && currentIndex < MOBILE_TABS.length - 1) {
            targetTab = MOBILE_TABS[currentIndex + 1];
            exitDirection = "left";
          }
        } else {
          // Swiped Right (finger left to right) -> Navigate to Previous Page
          if (pathname.startsWith("/workspaces/") && pathname !== "/workspaces") {
            targetTab = "/workspaces";
            exitDirection = "right";
          } else if (currentIndex > 0) {
            targetTab = MOBILE_TABS[currentIndex - 1];
            exitDirection = "right";
          }
        }
      }

      if (targetTab && exitDirection) {
        swipeDirectionRef.current = exitDirection;
        const exitTranslate = exitDirection === "left" ? "-100vw" : "100vw";

        mainRef.current.style.transition =
          "transform 200ms cubic-bezier(0.2, 0.8, 0.25, 1), opacity 200ms ease-out";
        mainRef.current.style.transform = `translateX(${exitTranslate})`;
        mainRef.current.style.opacity = "0.3";

        setTimeout(() => {
          router.push(targetTab!);
        }, 50);
      } else {
        // Snap back to 0 if swipe was cancelled or at boundary
        mainRef.current.style.transition =
          "transform 250ms cubic-bezier(0.25, 1, 0.5, 1), opacity 250ms ease-out";
        mainRef.current.style.transform = "translateX(0px)";
        mainRef.current.style.opacity = "1";
      }
    }

    function handleTouchCancel() {
      touchStartRef.current = null;
      directionLockRef.current = null;
      if (mainRef.current) {
        mainRef.current.style.transition = "transform 200ms ease-out, opacity 200ms ease-out";
        mainRef.current.style.transform = "translateX(0px)";
        mainRef.current.style.opacity = "1";
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
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
      <div className="md:pl-64 flex-1 flex flex-col min-w-0 overflow-x-hidden">
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
        <main
          ref={mainRef}
          className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-7xl w-full mx-auto pb-24 md:pb-12 will-change-[transform,opacity]"
        >
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
