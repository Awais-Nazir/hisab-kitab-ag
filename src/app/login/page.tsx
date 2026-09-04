"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F2EEE9] dark:bg-[#111413] relative flex items-center justify-center p-4 overflow-hidden select-none transition-colors duration-200">
      {/* Theme toggle in top right corner */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Ambient background decorative organic shapes */}
      <div className="absolute top-12 right-12 w-48 h-48 md:w-64 md:h-64 rounded-full bg-[#E8D9B5]/80 dark:bg-[#0F5C53]/15 pointer-events-none -z-0 blur-[1px] transition-colors" />
      <div className="absolute -bottom-12 -left-12 w-72 h-72 md:w-96 md:h-96 rounded-full bg-[#C2DBD2]/80 dark:bg-[#10B981]/10 pointer-events-none -z-0 blur-[1px] transition-colors" />

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-[420px] bg-white dark:bg-[#19201D] rounded-3xl shadow-xl shadow-stone-900/5 dark:shadow-2xl border border-[#E5E0D8] dark:border-[#28332E] overflow-hidden transition-colors">
        {/* Top gradient stripe matching Figma */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#4EAA9C] via-[#0F5C53] to-[#0A3F38]" />

        <div className="p-8 sm:p-10">
          {/* Brand Emblem */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-3 hover:scale-105 transition-transform">
              <BrandLogo variant="icon" size={56} href={null} />
            </div>
            <h1 className="font-serif font-bold text-3xl text-[#162B27] dark:text-white tracking-tight">
              Hisab Kitab
            </h1>
            <p className="text-xs text-[#6B7268] dark:text-[#95A19B] mt-1 font-medium tracking-wide">
              Clarity in Every Entry
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div className="border-b border-[#E0DBD2] dark:border-[#28332E] focus-within:border-[#0F5C53] dark:focus-within:border-[#10B981] pb-1 transition-colors">
              <label className="block text-[11px] font-semibold text-[#6B7268] dark:text-[#95A19B] uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full text-sm text-[#162B27] dark:text-white bg-transparent focus:outline-none py-1 placeholder:text-stone-300 dark:placeholder:text-stone-600"
              />
            </div>

            {/* Password field with toggle */}
            <div className="border-b border-[#E0DBD2] dark:border-[#28332E] focus-within:border-[#0F5C53] dark:focus-within:border-[#10B981] pb-1 transition-colors relative">
              <label className="block text-[11px] font-semibold text-[#6B7268] dark:text-[#95A19B] uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full text-sm text-[#162B27] dark:text-white bg-transparent focus:outline-none py-1 placeholder:text-stone-300 dark:placeholder:text-stone-600 pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#0F5C53] dark:text-[#10B981] focus:ring-[#0F5C53] accent-[#0F5C53] dark:accent-[#10B981]"
                />
                <span className="text-xs text-[#5A6863] dark:text-[#95A19B]">Remember me</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-[#0A3F38] hover:bg-[#072F2A] dark:bg-[#10B981] dark:hover:bg-[#059669] dark:text-[#111413] text-white py-3 rounded-xl font-semibold text-sm shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer active:scale-[0.99]"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Divider & Switch link */}
          <div className="mt-8 pt-6 border-t border-[#F0ECE6] dark:border-[#28332E] text-center">
            <p className="text-xs text-[#6B7268] dark:text-[#95A19B]">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold text-[#0F5C53] dark:text-[#34D399] hover:underline ml-1">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}