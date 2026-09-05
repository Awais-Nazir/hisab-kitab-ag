"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "./BrandLogo";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";
import { SearchResultItem } from "./TopHeader";

interface MobileHeaderProps {
  title?: string;
  userName?: string;
  userImage?: string | null;
  action?: React.ReactNode;
  onAddEntry?: () => void;
  addEntryLabel?: string;
}

export function MobileHeader({
  title = "Dashboard",
  userName = "User",
  userImage,
  action,
  onAddEntry,
  addEntryLabel = "Add Entry",
}: MobileHeaderProps) {
  const router = useRouter();
  const { symbol } = useCurrency();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const displayLabel = addEntryLabel.startsWith("+")
    ? addEntryLabel.slice(1).trim()
    : addEntryLabel.endsWith("+")
    ? addEntryLabel.slice(0, -1).trim()
    : addEntryLabel;

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
      setResults([]);
    }
  }, [isSearchOpen]);

  // Close data-only search overlay on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isSearchOpen]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<{ results: SearchResultItem[] }>(
          `/api/search?q=${encodeURIComponent(q)}`
        );
        setResults(res.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function handleSelectResult(item: SearchResultItem) {
    setIsSearchOpen(false);
    router.push(item.url);
  }

  return (
    <>
      <header className="h-14 px-3 sm:px-4 border-b border-[#E5E0D8] dark:border-[#1E2824] bg-[#FAF8F5]/90 dark:bg-[#090D12]/90 backdrop-blur-md flex md:hidden items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <BrandLogo variant="icon" size={28} href="/dashboard" />
          <h1 className="font-serif font-bold text-base text-[#162B27] dark:text-white truncate max-w-[130px] sm:max-w-[200px]">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Search trigger button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-1.5 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-white rounded-xl hover:bg-stone-100 dark:hover:bg-[#1A2229] transition-colors"
            title="Search"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {onAddEntry && (
            <button
              onClick={onAddEntry}
              className="flex items-center gap-1 bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white px-2.5 py-1 rounded-xl text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
              title={displayLabel}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-[11px] font-bold hidden xs:inline">{displayLabel}</span>
            </button>
          )}
          {action}
          <Link href="/profile" className="w-7 h-7 rounded-full bg-[#0F5C53]/15 border border-[#0F5C53]/30 flex items-center justify-center text-[#0F5C53] dark:text-[#34D399] font-serif font-semibold text-xs overflow-hidden flex-shrink-0">
            {userImage ? (
              <img src={userImage} alt={userName} className="w-full h-full object-cover" />
            ) : (
              userName.slice(0, 2).toUpperCase()
            )}
          </Link>
        </div>
      </header>

      {/* Mobile Search Overlay Modal */}
      {isSearchOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSearchOpen(false);
          }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col md:hidden p-3 animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-3xl p-3 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Search Input Bar */}
            <div className="flex items-center gap-2 pb-2 border-b border-[#E5E0D8] dark:border-[#1E2824]">
              <svg className="w-4 h-4 text-[#5A6863] dark:text-[#8E9C95] ml-2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 text-xs bg-transparent text-[#162B27] dark:text-white placeholder-[#8E9C95] focus:outline-none py-2"
              />
              {loading && (
                <svg className="w-4 h-4 animate-spin text-[#0F5C53] dark:text-[#34D399] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              )}
              <button
                onClick={() => setIsSearchOpen(false)}
                className="px-2.5 py-1 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-white"
              >
                Done
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-1 space-y-1.5 mt-2">
              {loading && results.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">
                  Searching database...
                </div>
              ) : searchQuery.trim() && results.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">
                  No records found for &quot;<strong className="text-[#162B27] dark:text-white">{searchQuery}</strong>&quot;
                </div>
              ) : !searchQuery.trim() ? (
                <div className="py-8 text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">
                  Type to search expenses, udhar, contacts, accounts...
                </div>
              ) : (
                results.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectResult(item)}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#1E2824] active:scale-98 transition-all"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-[#162B27] dark:text-white truncate">
                          {item.title}
                        </p>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B7268] dark:text-[#8E9C95] truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>

                    {item.amount !== undefined && (
                      <span className="font-serif font-bold text-xs text-[#162B27] dark:text-white flex-shrink-0">
                        {symbol}{Math.round(item.amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
