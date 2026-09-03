"use client";

interface TopHeaderProps {
  onAddEntry?: () => void;
  onSearch?: (query: string) => void;
  title?: string;
  subtitle?: string;
}

export function TopHeader({
  onAddEntry,
  title = "HISAB KITAB",
  subtitle = "Private Ledger #001",
}: TopHeaderProps) {
  return (
    <header className="h-16 border-b border-[#E5E0D8] bg-[#FAF8F5]/80 backdrop-blur-md px-8 hidden md:flex items-center justify-between sticky top-0 z-20">
      {/* Left: Breadcrumbs / Ledger tag */}
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider font-bold text-[#5A6863]">
          {title}
        </span>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#162B27]">
          <svg className="w-3 h-3 text-[#0F5C53]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{subtitle}</span>
        </div>
      </div>

      {/* Right: Search & Add Entry CTA */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <svg className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-1.5 text-xs bg-white/70 border border-[#E5E0D8] rounded-full w-48 focus:w-64 focus:bg-white focus:outline-none focus:border-[#0F5C53] transition-all"
          />
        </div>

        {onAddEntry && (
          <button
            onClick={onAddEntry}
            className="flex items-center gap-1.5 bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            <span>Add Entry +</span>
          </button>
        )}
      </div>
    </header>
  );
}
