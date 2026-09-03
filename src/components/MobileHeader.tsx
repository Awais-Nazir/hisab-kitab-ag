"use client";

import Link from "next/link";

interface MobileHeaderProps {
  title?: string;
  userName?: string;
  action?: React.ReactNode;
}

export function MobileHeader({
  title = "Dashboard",
  userName = "User",
  action,
}: MobileHeaderProps) {
  return (
    <header className="h-14 px-4 border-b border-[#E5E0D8] bg-[#FAF8F5]/90 backdrop-blur-md flex md:hidden items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <Link href="/dashboard" className="w-7 h-7 rounded-full bg-[#0F5C53] flex items-center justify-center text-white shadow-xs">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          </svg>
        </Link>
        <h1 className="font-serif font-bold text-lg text-[#162B27]">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {action}
        <Link href="/profile" className="w-7 h-7 rounded-full bg-[#0F5C53]/15 border border-[#0F5C53]/30 flex items-center justify-center text-[#0F5C53] font-serif font-semibold text-xs">
          {userName.slice(0, 2).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
