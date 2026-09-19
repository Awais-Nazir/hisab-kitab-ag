"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Verify token validity on page load
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setTokenError("No reset token was provided in the URL.");
      return;
    }

    async function checkToken() {
      try {
        const res = await apiFetch<{ valid: boolean; email?: string; error?: string }>(
          `/api/auth/reset-password?token=${encodeURIComponent(token)}`
        );
        if (res.valid) {
          setTokenValid(true);
          setAccountEmail(res.email || "");
        } else {
          setTokenValid(false);
          setTokenError(res.error || "This reset link is invalid or has expired.");
        }
      } catch (err: any) {
        setTokenValid(false);
        setTokenError(err?.message || "Failed to verify reset link.");
      } finally {
        setVerifying(false);
      }
    }

    checkToken();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 6) {
      setSubmitError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);

    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          password,
        }),
      });

      setResetSuccess(true);
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 sm:p-10">
      {/* Brand Emblem */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="mb-3 hover:scale-105 transition-transform">
          <BrandLogo variant="icon" size={52} href="/" />
        </div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#162B27] dark:text-white tracking-tight">
          {resetSuccess
            ? "Password Updated!"
            : tokenValid
            ? "Set New Password"
            : "Reset Link Issue"}
        </h1>
        <p className="text-xs text-[#6B7268] dark:text-[#95A19B] mt-1 font-medium tracking-wide max-w-xs">
          {resetSuccess
            ? "Your account password has been updated securely."
            : tokenValid
            ? accountEmail
              ? `Creating a new password for ${accountEmail}`
              : "Enter your new password below."
            : "We couldn't verify your reset link."}
        </p>
      </div>

      {verifying && (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-[#0F5C53] dark:border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-stone-500 font-medium">Verifying security token...</span>
        </div>
      )}

      {!verifying && !tokenValid && (
        <div className="space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 mx-auto flex items-center justify-center text-amber-600 dark:text-amber-400 text-2xl shadow-xs">
            ⚠️
          </div>

          <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-xs text-amber-800 dark:text-amber-300">
            {tokenError || "This password reset link is invalid or has expired."}
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/forgot-password"
              className="w-full bg-[#0A3F38] hover:bg-[#072F2A] dark:bg-[#10B981] dark:hover:bg-[#059669] dark:text-[#111413] text-white py-3 rounded-xl font-semibold text-sm shadow-sm transition-all text-center block"
            >
              Request New Reset Link
            </Link>
            <Link
              href="/login"
              className="text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 py-2 font-medium"
            >
              Return to Sign In
            </Link>
          </div>
        </div>
      )}

      {!verifying && tokenValid && resetSuccess && (
        <div className="space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 mx-auto flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-3xl shadow-xs">
            ✓
          </div>

          <div className="p-4 bg-[#FAF8F5] dark:bg-[#141816] rounded-2xl border border-[#E5E0D8] dark:border-[#28332E] text-xs text-stone-600 dark:text-stone-300">
            Your password has been changed successfully. You can now use your new password to sign in.
          </div>

          <Link
            href="/login"
            className="w-full bg-[#0A3F38] hover:bg-[#072F2A] dark:bg-[#10B981] dark:hover:bg-[#059669] dark:text-[#111413] text-white py-3 rounded-xl font-semibold text-sm shadow-sm transition-all text-center block"
          >
            Sign In With New Password &rarr;
          </Link>
        </div>
      )}

      {!verifying && tokenValid && !resetSuccess && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {submitError}
            </div>
          )}

          {/* New Password */}
          <div className="border-b border-[#E0DBD2] dark:border-[#28332E] focus-within:border-[#0F5C53] dark:focus-within:border-[#10B981] pb-1 transition-colors relative">
            <label className="block text-[11px] font-semibold text-[#6B7268] dark:text-[#95A19B] uppercase tracking-wider mb-1">
              New Password
            </label>
            <div className="flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
                className="w-full text-sm text-[#162B27] dark:text-white bg-transparent focus:outline-none py-1 placeholder:text-stone-300 dark:placeholder:text-stone-600 pr-8"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
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

          {/* Confirm Password */}
          <div className="border-b border-[#E0DBD2] dark:border-[#28332E] focus-within:border-[#0F5C53] dark:focus-within:border-[#10B981] pb-1 transition-colors">
            <label className="block text-[11px] font-semibold text-[#6B7268] dark:text-[#95A19B] uppercase tracking-wider mb-1">
              Confirm New Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full text-sm text-[#162B27] dark:text-white bg-transparent focus:outline-none py-1 placeholder:text-stone-300 dark:placeholder:text-stone-600"
            />
          </div>

          {/* Password Match Indicator */}
          {password && confirmPassword && (
            <div className="text-[11px]">
              {password === confirmPassword ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  ✓ Passwords match
                </span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 font-medium">
                  ✗ Passwords do not match
                </span>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || password.length < 6 || password !== confirmPassword}
            className="w-full mt-2 bg-[#0A3F38] hover:bg-[#072F2A] dark:bg-[#10B981] dark:hover:bg-[#059669] dark:text-[#111413] text-white py-3 rounded-xl font-semibold text-sm shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white dark:border-[#111413] border-t-transparent rounded-full animate-spin"></span>
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Update Password</span>
            )}
          </button>
        </form>
      )}

      {/* Footer Back link */}
      <div className="mt-8 pt-6 border-t border-[#F0ECE6] dark:border-[#28332E] text-center">
        <Link
          href="/login"
          className="text-xs font-semibold text-[#0F5C53] dark:text-[#34D399] hover:underline"
        >
          Cancel &bull; Return to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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

        <Suspense
          fallback={
            <div className="p-12 text-center text-xs text-stone-500">
              <div className="w-8 h-8 border-3 border-[#0F5C53] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              Loading security portal...
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
