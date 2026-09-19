"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setError(null);
    setLoading(true);

    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send reset link");
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

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-[420px] bg-white dark:bg-[#19201D] rounded-3xl shadow-xl shadow-stone-900/5 dark:shadow-2xl border border-[#E5E0D8] dark:border-[#28332E] overflow-hidden transition-colors">
        {/* Top gradient stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#4EAA9C] via-[#0F5C53] to-[#0A3F38]" />

        <div className="p-8 sm:p-10">
          {/* Brand Emblem */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-3 hover:scale-105 transition-transform">
              <BrandLogo variant="icon" size={52} href="/" />
            </div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#162B27] dark:text-white tracking-tight">
              {submitted ? "Check Your Inbox" : "Reset Password"}
            </h1>
            <p className="text-xs text-[#6B7268] dark:text-[#95A19B] mt-1 font-medium tracking-wide max-w-xs">
              {submitted
                ? "We've dispatched password recovery instructions to your email address."
                : "Enter your account email and we'll send you a secure link to reset your password."}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-5">
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
                  autoFocus
                  className="w-full text-sm text-[#162B27] dark:text-white bg-transparent focus:outline-none py-1 placeholder:text-stone-300 dark:placeholder:text-stone-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full bg-[#0A3F38] hover:bg-[#072F2A] dark:bg-[#10B981] dark:hover:bg-[#059669] dark:text-[#111413] text-white py-3 rounded-xl font-semibold text-sm shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white dark:border-[#111413] border-t-transparent rounded-full animate-spin"></span>
                    <span>Sending Link...</span>
                  </>
                ) : (
                  <span>Send Reset Link &rarr;</span>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 mx-auto flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-2xl shadow-xs">
                ✉️
              </div>

              <div className="bg-[#FAF8F5] dark:bg-[#141816] p-4 rounded-2xl border border-[#E5E0D8] dark:border-[#28332E] text-xs text-stone-600 dark:text-stone-300 space-y-2">
                <p>
                  If an account exists for <strong className="text-[#162B27] dark:text-white">{email}</strong>, you will receive a reset email shortly.
                </p>
                <p className="text-[11px] text-stone-400">
                  ⏰ The reset link is valid for <strong>1 hour</strong>.
                </p>
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <Link
                  href="/login"
                  className="w-full bg-[#0A3F38] hover:bg-[#072F2A] dark:bg-[#10B981] dark:hover:bg-[#059669] dark:text-[#111413] text-white py-3 rounded-xl font-semibold text-sm shadow-sm transition-all text-center block"
                >
                  Return to Sign In
                </Link>

                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="text-xs text-[#0F5C53] dark:text-[#34D399] font-medium hover:underline py-1.5 cursor-pointer"
                >
                  Didn&apos;t receive it? Try another email
                </button>
              </div>
            </div>
          )}

          {/* Back link */}
          <div className="mt-8 pt-6 border-t border-[#F0ECE6] dark:border-[#28332E] text-center">
            <Link
              href="/login"
              className="text-xs font-semibold text-[#0F5C53] dark:text-[#34D399] hover:underline flex items-center justify-center gap-1.5"
            >
              <span>&larr;</span>
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
