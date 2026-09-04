"use client";

import { useTheme, Theme } from "@/context/ThemeContext";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center bg-[#FAF8F5] dark:bg-[#151A18] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl p-0.5 text-xs font-semibold">
      <button
        type="button"
        onClick={() => setTheme("system")}
        className={`px-2 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
          theme === "system"
            ? "bg-white dark:bg-[#202925] text-[#0F5C53] dark:text-[#34D399] shadow-xs font-bold"
            : "text-[#6B7268] dark:text-stone-400 hover:text-[#162B27] dark:hover:text-white"
        }`}
        title="System Default Theme"
      >
        <span>💻</span>
        <span className="hidden sm:inline">Auto</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`px-2 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
          theme === "light"
            ? "bg-white dark:bg-white text-[#0F5C53] shadow-xs font-bold"
            : "text-[#6B7268] dark:text-stone-400 hover:text-[#162B27] dark:hover:text-white"
        }`}
        title="Light Theme"
      >
        <span>☀️</span>
        <span className="hidden sm:inline">Light</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`px-2 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
          theme === "dark"
            ? "bg-[#202925] text-[#34D399] shadow-xs font-bold"
            : "text-[#6B7268] dark:text-stone-400 hover:text-[#162B27] dark:hover:text-white"
        }`}
        title="Dark Theme"
      >
        <span>🌙</span>
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}
