"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "./BrandLogo";

interface SidebarProps {
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
  onLogout?: () => void;
}

export function Sidebar({ userName = "Account Admin", userImage, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70 dark:text-stone-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="7" x="3" y="3" rx="1.5" />
          <rect width="7" height="7" x="14" y="3" rx="1.5" />
          <rect width="7" height="7" x="14" y="14" rx="1.5" />
          <rect width="7" height="7" x="3" y="14" rx="1.5" />
        </svg>
      ),
    },
    {
      label: "All Expenses",
      href: "/expenses",
      badge: "NEW",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70 dark:text-stone-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      label: "Workspaces",
      href: "/workspaces",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70 dark:text-stone-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      label: "Accounts & Udhar",
      href: "/accounts",
      badge: "V2",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70 dark:text-stone-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M6 6h10" />
          <path d="M6 10h10" />
        </svg>
      ),
    },
    {
      label: "Contacts",
      href: "/people",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70 dark:text-stone-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70 dark:text-stone-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      ),
    },
    {
      label: "Settings",
      href: "/profile",
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? "text-white" : "text-[#162B27]/70 dark:text-stone-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bottom-0 bg-[#F4F1EA] dark:bg-[#0D131A] border-r border-[#E5E0D8] dark:border-[#1E2824] hidden md:flex flex-col justify-between z-30 select-none transition-colors duration-200">
      {/* Top section: Logo & Nav items */}
      <div className="pt-7 px-4">
        {/* Brand Logo with Ledger V2 tag */}
        <div className="px-2 mb-8">
          <BrandLogo variant="mark" size={38} showText={true} />
          <div className="mt-1 flex items-center gap-1.5 pl-11">
            <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-[#0F5C53] dark:text-[#10B981]">
              LEDGER V2
            </span>
          </div>
        </div>

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
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? "bg-[#0F5C53] text-white shadow-sm font-semibold"
                    : "text-[#3E4D48] dark:text-stone-300 hover:bg-[#EAE4DC] dark:hover:bg-[#151D24] hover:text-[#162B27] dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  {item.icon(isActive)}
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-[#0F5C53]/10 dark:bg-[#10B981]/20 text-[#0F5C53] dark:text-[#34D399]"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>


      {/* Bottom user card */}
      <div className="p-4 border-t border-[#E5E0D8] dark:border-[#28332E]">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#EAE4DC] dark:hover:bg-[#202925] transition-colors">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-[#0F5C53]/15 border border-[#0F5C53]/20 flex items-center justify-center text-[#0F5C53] dark:text-[#34D399] font-semibold font-serif text-sm flex-shrink-0 overflow-hidden">
              {userImage ? (
                <img src={userImage} alt={userName} className="w-full h-full object-cover" />
              ) : (
                userName.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-[#162B27] dark:text-white truncate leading-tight">
                {userName}
              </p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F5C53]/80 dark:text-[#34D399] mt-0.5">
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
