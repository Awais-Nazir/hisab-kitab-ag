"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
}

export function Sidebar({ userName = "Account Admin", onLogout }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="7" x="3" y="3" rx="1.5" />
          <rect width="7" height="7" x="14" y="3" rx="1.5" />
          <rect width="7" height="7" x="14" y="14" rx="1.5" />
          <rect width="7" height="7" x="3" y="14" rx="1.5" />
        </svg>
      ),
    },
    {
      label: "Workspaces",
      href: "/workspaces",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      label: "Contacts",
      href: "/people",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      ),
    },
    {
      label: "Profile",
      href: "/profile",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="5" />
          <path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bottom-0 bg-[#F4F1EA] border-r border-[#E5E0D8] hidden md:flex flex-col justify-between z-30 select-none">
      {/* Top section: Logo & Nav items */}
      <div className="pt-7 px-4">
        {/* Brand Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 px-3 mb-8 group">
          <div className="w-8 h-8 rounded-full bg-[#0F5C53] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
              <path d="M6 10h10" />
            </svg>
          </div>
          <span className="font-serif font-bold text-2xl tracking-tight text-[#162B27]">
            Hisab Kitab
          </span>
        </Link>

        {/* Navigation list */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? "bg-[#0F5C53] text-white shadow-sm font-semibold"
                    : "text-[#3E4D48] hover:bg-[#EAE4DC] hover:text-[#162B27]"
                }`}
              >
                {item.icon(isActive)}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom user card */}
      <div className="p-4 border-t border-[#E5E0D8]">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#EAE4DC] transition-colors">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-[#0F5C53]/15 border border-[#0F5C53]/20 flex items-center justify-center text-[#0F5C53] font-semibold font-serif text-sm flex-shrink-0">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-[#162B27] truncate leading-tight">
                {userName}
              </p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F5C53]/80 mt-0.5">
                Premium
              </p>
            </div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg transition-colors ml-1 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
