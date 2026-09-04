"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

interface MobileHeaderProps {
  title?: string;
  userName?: string;
  action?: React.ReactNode;
  onAddEntry?: () => void;
  addEntryLabel?: string;
}

export function MobileHeader({
  title = "Dashboard",
  userName = "User",
  action,
  onAddEntry,
  addEntryLabel = "Add Entry",
}: MobileHeaderProps) {
  const displayLabel = addEntryLabel.startsWith("+")
    ? addEntryLabel.slice(1).trim()
    : addEntryLabel.endsWith("+")
    ? addEntryLabel.slice(0, -1).trim()
    : addEntryLabel;

  return (
    <header className="h-14 px-3 sm:px-4 border-b border-[#E5E0D8] dark:border-[#28332E] bg-[#FAF8F5]/90 dark:bg-[#121514]/90 backdrop-blur-md flex md:hidden items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="w-7 h-7 rounded-full bg-[#0F5C53] flex items-center justify-center text-white shadow-xs">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          </svg>
        </Link>
        <h1 className="font-serif font-bold text-base text-[#162B27] dark:text-white truncate max-w-[130px] sm:max-w-[200px]">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {onAddEntry && (
          <button
            onClick={onAddEntry}
            className="flex items-center gap-1 bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-2.5 py-1 rounded-xl text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
            title={displayLabel}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-[11px] font-bold hidden xs:inline">{displayLabel}</span>
          </button>
        )}
        {action}
        <ThemeToggle />
        <Link href="/profile" className="w-7 h-7 rounded-full bg-[#0F5C53]/15 border border-[#0F5C53]/30 flex items-center justify-center text-[#0F5C53] font-serif font-semibold text-xs">
          {userName.slice(0, 2).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
