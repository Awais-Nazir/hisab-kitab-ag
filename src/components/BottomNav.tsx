"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const tabs = [
    {
      label: "Home",
      href: "/dashboard",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-[#0F5C53]" : "text-[#6B7268]"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
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
        <svg className={`w-5 h-5 ${active ? "text-[#0F5C53]" : "text-[#6B7268]"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
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
        <svg className={`w-5 h-5 ${active ? "text-[#0F5C53]" : "text-[#6B7268]"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      ),
    },
    {
      label: "Contacts",
      href: "/people",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-[#0F5C53]" : "text-[#6B7268]"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "Categories",
      href: "/categories",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-[#0F5C53]" : "text-[#6B7268]"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#FAF8F5]/95 dark:bg-[#151A18]/95 backdrop-blur-md border-t border-[#E5E0D8] dark:border-[#28332E] flex md:hidden items-center justify-around px-2 z-40 shadow-sm transition-colors duration-200">
      {tabs.map((tab) => {
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
    </nav>
  );
}
