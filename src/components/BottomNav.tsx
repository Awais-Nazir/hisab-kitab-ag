"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close "More" sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const moreRoutes = [
    {
      label: "AI Assistant",
      sublabel: "Chat & Smart Entry",
      href: "/chat",
      icon: (
        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
      ),
    },
    {
      label: "Categories",
      sublabel: "Tags & Icons",
      href: "/categories",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
          <circle cx="7" cy="7" r=".5" fill="currentColor" />
        </svg>
      ),
    },
    {
      label: "Notes",
      sublabel: "Quick Daily Logs",
      href: "/notes",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <line x1="9" y1="12" x2="15" y2="12" />
          <line x1="9" y1="16" x2="13" y2="16" />
        </svg>
      ),
    },
    {
      label: "Contacts",
      sublabel: "Lena Dena Ledger",
      href: "/people",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "Workspaces",
      sublabel: "Shared Groups",
      href: "/workspaces",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      label: "Settings",
      sublabel: "Profile & Alerts",
      href: "/profile",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  const isMoreActive = moreRoutes.some((r) => pathname.startsWith(r.href));

  const primaryTabs = [
    {
      label: "Home",
      href: "/dashboard",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-[#0F5C53] dark:text-[#34D399]" : "text-[#6B7268] dark:text-stone-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="7" x="3" y="3" rx="1.5" />
          <rect width="7" height="7" x="14" y="3" rx="1.5" />
          <rect width="7" height="7" x="14" y="14" rx="1.5" />
          <rect width="7" height="7" x="3" y="14" rx="1.5" />
        </svg>
      ),
    },
    {
      label: "Expenses",
      href: "/expenses",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-[#0F5C53] dark:text-[#34D399]" : "text-[#6B7268] dark:text-stone-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      label: "Accounts",
      href: "/accounts",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-[#0F5C53] dark:text-[#34D399]" : "text-[#6B7268] dark:text-stone-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* More Options Popover / Sheet */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMoreOpen(false)}
          />

          {/* Floating Menu Sheet */}
          <div className="fixed bottom-20 left-3 right-3 max-w-sm mx-auto bg-white/95 dark:bg-[#161D1A]/95 backdrop-blur-md border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-6 duration-200">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E5E0D8]/60 dark:border-[#28332E]/60">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0F5C53] dark:bg-[#10B981]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#162B27] dark:text-white">
                  More Pages & Features
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-[#202925] dark:hover:bg-[#2A3731] text-stone-500 dark:text-stone-400 text-xs font-bold transition-colors cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {moreRoutes.map((route) => {
                const isSelected = pathname.startsWith(route.href);
                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all border ${
                      isSelected
                        ? "bg-[#0F5C53]/10 dark:bg-[#10B981]/15 border-[#0F5C53]/30 dark:border-[#10B981]/40 text-[#0F5C53] dark:text-[#34D399] font-bold shadow-xs"
                        : "bg-[#FAF8F5]/80 dark:bg-[#1C2521]/60 border-[#E5E0D8]/60 dark:border-[#28332E]/60 text-[#162B27] dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#1C2521]"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-[#0F5C53] text-white dark:bg-[#10B981] dark:text-white shadow-2xs"
                          : "bg-stone-200/60 dark:bg-[#2A3731] text-[#5A6863] dark:text-stone-400"
                      }`}
                    >
                      {route.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate leading-snug">
                        {route.label}
                      </div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                        {route.sublabel}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Main Bottom 4-Button Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#FAF8F5]/95 dark:bg-[#151A18]/95 backdrop-blur-md border-t border-[#E5E0D8] dark:border-[#28332E] flex md:hidden items-center justify-around px-2 z-40 shadow-sm transition-colors duration-200">
        {primaryTabs.map((tab) => {
          const isActive =
            tab.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors ${
                isActive
                  ? "text-[#0F5C53] dark:text-[#34D399]"
                  : "text-[#6B7268] dark:text-stone-400 hover:text-[#162B27] dark:hover:text-white"
              }`}
            >
              {tab.icon(isActive)}
              <span className={`text-[10px] ${isActive ? "font-bold text-[#0F5C53] dark:text-[#34D399]" : "font-medium"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* 4th Button: More (Toggles Sheet) */}
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors cursor-pointer ${
            moreOpen || isMoreActive
              ? "text-[#0F5C53] dark:text-[#34D399]"
              : "text-[#6B7268] dark:text-stone-400 hover:text-[#162B27] dark:hover:text-white"
          }`}
          title="More Pages"
        >
          <div className="relative">
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${moreOpen ? "rotate-90" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={moreOpen || isMoreActive ? "2.5" : "2"}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="19" cy="12" r="1.5" fill="currentColor" />
              <circle cx="5" cy="12" r="1.5" fill="currentColor" />
            </svg>
            {isMoreActive && !moreOpen && (
              <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#0F5C53] dark:bg-[#10B981] ring-2 ring-[#FAF8F5] dark:ring-[#151A18]" />
            )}
          </div>
          <span
            className={`text-[10px] ${
              moreOpen || isMoreActive ? "font-bold text-[#0F5C53] dark:text-[#34D399]" : "font-medium"
            }`}
          >
            More
          </span>
        </button>
      </nav>
    </>
  );
}
