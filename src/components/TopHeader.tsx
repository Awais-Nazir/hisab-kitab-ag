"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyContext";

export interface SearchResultItem {
  id: string;
  category: "transaction" | "udhar" | "person" | "account" | "workspace";
  title: string;
  subtitle: string;
  amount?: number;
  badge?: string;
  url: string;
}

interface TopHeaderProps {
  onAddEntry?: () => void;
  addEntryLabel?: string;
  onSearch?: (query: string) => void;
  title?: string;
  subtitle?: string;
}

function CategoryBadge({ category }: { category: SearchResultItem["category"] }) {
  switch (category) {
    case "transaction":
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Expense
        </span>
      );
    case "udhar":
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          Udhar
        </span>
      );
    case "person":
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
          Contact
        </span>
      );
    case "account":
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          Account
        </span>
      );
    case "workspace":
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
          Workspace
        </span>
      );
  }
}

function CategoryIcon({ category }: { category: SearchResultItem["category"] }) {
  switch (category) {
    case "transaction":
      return (
        <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case "udhar":
      return (
        <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      );
    case "person":
      return (
        <svg className="w-4 h-4 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "account":
      return (
        <svg className="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case "workspace":
      return (
        <svg className="w-4 h-4 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
  }
}

export function TopHeader({
  onAddEntry,
  addEntryLabel = "Add Entry",
  title = "HISAB KITAB",
  subtitle = "Private Ledger #001",
  onSearch,
}: TopHeaderProps) {
  const router = useRouter();
  const { symbol } = useCurrency();

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayLabel = addEntryLabel.startsWith("+")
    ? addEntryLabel.slice(1).trim()
    : addEntryLabel.endsWith("+")
    ? addEntryLabel.slice(0, -1).trim()
    : addEntryLabel;

  // Global Keyboard Shortcuts (Ctrl+K or Cmd+K or /)
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced API Search
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
        setSelectedIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function handleSelectResult(item: SearchResultItem) {
    setIsOpen(false);
    setSearchQuery("");
    router.push(item.url);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length === 0 ? -1 : (prev + 1) % results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length === 0 ? -1 : prev <= 0 ? results.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        e.preventDefault();
        handleSelectResult(results[selectedIndex]);
      }
    }
  }

  return (
    <header className="h-16 border-b border-[#E5E0D8] dark:border-[#1E2824] bg-[#FAF8F5]/80 dark:bg-[#090D12]/90 backdrop-blur-md px-8 hidden md:flex items-center justify-between sticky top-0 z-40">
      {/* Left: Breadcrumbs / Ledger tag */}
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider font-bold text-[#5A6863] dark:text-[#8E9C95]">
          {title}
        </span>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#162B27] dark:text-white">
          <svg className="w-3 h-3 text-[#0F5C53] dark:text-[#34D399]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{subtitle}</span>
        </div>
      </div>

      {/* Center: Global Search Bar with Live Results Dropdown */}
      <div ref={containerRef} className="flex-1 max-w-lg mx-6 relative">
        <div className="relative flex items-center">
          <svg className="w-4 h-4 text-[#5A6863] dark:text-[#8E9C95] absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            placeholder="Search transactions, udhar, contacts, accounts..."
            value={searchQuery}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
              if (onSearch) onSearch(e.target.value);
            }}
            onKeyDown={handleInputKeyDown}
            className="w-full pl-10 pr-16 py-2 text-xs rounded-2xl bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] text-[#162B27] dark:text-white placeholder-[#8E9C95] focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981] shadow-xs transition-all"
          />

          {/* Shortcut hint or spinner */}
          <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
            {loading ? (
              <svg className="w-4 h-4 animate-spin text-[#0F5C53] dark:text-[#34D399]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <kbd className="text-[10px] font-mono text-stone-400 dark:text-stone-500 bg-[#FAF8F5] dark:bg-[#1A2229] border border-[#E5E0D8] dark:border-[#28332E] px-1.5 py-0.5 rounded-md font-semibold">
                Ctrl K
              </kbd>
            )}
          </div>
        </div>

        {/* Live Search Results Dropdown */}
        {isOpen && searchQuery.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#13191E] border border-[#E5E0D8] dark:border-[#1E2824] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="p-2 max-h-[380px] overflow-y-auto space-y-1">
              {loading && results.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">
                  Searching database...
                </div>
              ) : results.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6B7268] dark:text-[#8E9C95]">
                  No matching records found for &quot;<strong className="text-[#162B27] dark:text-white">{searchQuery}</strong>&quot;
                </div>
              ) : (
                results.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectResult(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? "bg-emerald-50/70 dark:bg-[#1A2229] border border-[#0F5C53]/30 dark:border-[#10B981]/30"
                          : "hover:bg-[#FAF8F5] dark:hover:bg-[#1A2229]/60 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-[#1A2229] flex items-center justify-center flex-shrink-0">
                          <CategoryIcon category={item.category} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-[#162B27] dark:text-white truncate">
                              {item.title}
                            </p>
                            <CategoryBadge category={item.category} />
                          </div>
                          <p className="text-[11px] text-[#6B7268] dark:text-[#8E9C95] truncate">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      {item.amount !== undefined && (
                        <div className="text-right flex-shrink-0 ml-3">
                          <span className="font-serif font-bold text-xs text-[#162B27] dark:text-white">
                            {symbol}{Math.round(item.amount).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Dropdown Footer Navigation Shortcut Hints */}
            <div className="px-3 py-2 bg-[#FAF8F5] dark:bg-[#161D22] border-t border-[#E5E0D8] dark:border-[#1E2824] flex items-center justify-between text-[10px] text-[#6B7268] dark:text-[#8E9C95]">
              <div className="flex items-center gap-3 font-mono">
                <span>↑↓ Navigate</span>
                <span>↵ Open</span>
                <span>ESC Close</span>
              </div>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {results.length} results
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Theme Toggle & Add Entry CTA */}
      <div className="flex items-center gap-3">
        <ThemeToggle />

        {onAddEntry && (
          <button
            onClick={onAddEntry}
            className="flex items-center gap-1.5 bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all active:scale-95 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            <span>{displayLabel}</span>
          </button>
        )}
      </div>
    </header>
  );
}
