"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
import { CURRENCIES } from "@/lib/currency";
import { useCurrency } from "@/context/CurrencyContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { useUser, User } from "@/context/UserContext";

export default function ProfilePage() {
  const router = useRouter();
  const { currency, updateCurrency } = useCurrency();
  const { user, updateUser, logout, loading: userLoading } = useUser();
  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(user?.currency || "PKR");
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Avatar upload states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageSuccess, setImageSuccess] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setSelectedCurrency(user.currency || "PKR");
    }
  }, [user]);

  useEffect(() => {
    if (currency) {
      setSelectedCurrency(currency);
    }
  }, [currency]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || savingName) return;
    setSavingName(true);
    setNameSuccess(false);
    try {
      const res = await apiFetch<{ user: User }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      updateUser(res.user);
      setName(res.user.name);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSaveCurrency() {
    setSavingCurrency(true);
    setSavedSuccess(false);
    try {
      await updateCurrency(selectedCurrency);
      updateUser({ currency: selectedCurrency });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      alert("Failed to save currency preference");
    } finally {
      setSavingCurrency(false);
    }
  }

  async function handleLogout() {
    await logout();
  }

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      setImageError("Please select a valid image file (PNG, JPG, WebP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setImageError("Image file size must be less than 10MB");
      return;
    }

    setUploadingImage(true);
    setImageError(null);
    setImageSuccess(false);

    try {
      const reader = new FileReader();
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(file);
      });

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to process image"));
        img.src = rawDataUrl;
      });

      // Center crop square 256x256
      const size = Math.min(img.width, img.height);
      const startX = (img.width - size) / 2;
      const startY = (img.height - size) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize canvas context");

      ctx.drawImage(img, startX, startY, size, size, 0, 0, 256, 256);
      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);

      const res = await apiFetch<{ user: User }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ image: compressedDataUrl }),
      });

      updateUser(res.user);
      setImageSuccess(true);
      setTimeout(() => setImageSuccess(false), 3000);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleRemoveImage() {
    if (!confirm("Are you sure you want to remove your profile picture?")) return;
    setUploadingImage(true);
    setImageError(null);
    setImageSuccess(false);
    try {
      const res = await apiFetch<{ user: User }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ image: null }),
      });
      updateUser(res.user);
      setImageSuccess(true);
      setTimeout(() => setImageSuccess(false), 3000);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Failed to remove image");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <AppLayout title="Profile" subtitle="Account Settings">
      <div className="max-w-xl mx-auto">
        <h1 className="font-serif font-bold text-2xl md:text-3xl text-[#162B27] dark:text-white mb-2">
          Your Profile
        </h1>
        <p className="text-sm text-[#5A6863] dark:text-[#8E9C95] mb-6">
          Account details, profile photo, ledger preferences, and currency settings.
        </p>

        {userLoading && !user ? (
          <div className="p-8 text-center text-[#5A6863] dark:text-[#8E9C95]">Loading profile...</div>
        ) : (
          <div className="bg-white dark:bg-[#141816] border border-[#E5E0D8] dark:border-[#28332E] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            {/* Avatar & User Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-[#F0ECE6] dark:border-[#28332E]">
              {/* Avatar Circle with Camera Overlay */}
              <div className="relative group flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-[#0F5C53]/15 border-2 border-[#0F5C53]/30 dark:border-[#10B981]/30 flex items-center justify-center text-[#0F5C53] dark:text-[#34D399] font-serif font-bold text-2xl overflow-hidden shadow-inner">
                  {user?.image ? (
                    <img
                      src={user.image}
                      alt={user?.name || "Profile"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.name?.slice(0, 2).toUpperCase()
                  )}
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                      <svg className="w-6 h-6 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Camera Badge Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  title="Upload profile picture"
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white shadow-md transition-all active:scale-90 cursor-pointer border-2 border-white dark:border-[#141816] disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
              </div>

              {/* User Details & Photo Controls */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif font-bold text-xl text-[#162B27] dark:text-white truncate">
                    {user?.name}
                  </h2>
                  <span className="inline-block text-[10px] uppercase tracking-wider font-bold bg-emerald-50 dark:bg-emerald-950/40 text-[#0F5C53] dark:text-[#34D399] border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                    Private Ledger Member
                  </span>
                </div>
                <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-0.5 truncate">{user?.email}</p>

                {/* Photo Action Buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F5C53]/10 hover:bg-[#0F5C53]/20 dark:bg-[#10B981]/20 dark:hover:bg-[#10B981]/30 text-[#0F5C53] dark:text-[#34D399] rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {uploadingImage ? "Processing..." : user?.image ? "Change Photo" : "Upload Photo"}
                  </button>

                  {user?.image && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={uploadingImage}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {imageSuccess && (
                  <p className="text-xs font-semibold text-[#1E7D46] dark:text-[#34D399] mt-2 flex items-center gap-1">
                    ✓ Profile picture updated successfully!
                  </p>
                )}
                {imageError && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-2 flex items-center gap-1">
                    ✕ {imageError}
                  </p>
                )}
              </div>
            </div>

            {/* Currency Preference Setting */}
            <div className="bg-[#FAF8F5] dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-serif font-bold text-base text-[#162B27] dark:text-white">
                    Default Currency
                  </h3>
                  <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-0.5">
                    Choose the currency symbol displayed across your dashboard, workspaces, and ledger entries.
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#0F5C53]/10 text-[#0F5C53] dark:text-[#34D399] flex items-center justify-center font-bold text-sm">
                  {CURRENCIES.find((c) => c.code === selectedCurrency)?.symbol || "Rs."}
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-[#141816] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl text-sm font-medium text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleSaveCurrency}
                  disabled={savingCurrency || selectedCurrency === currency}
                  className="bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingCurrency ? "Saving..." : "Save Currency"}
                </button>
              </div>

              {savedSuccess && (
                <p className="text-xs font-semibold text-[#1E7D46] dark:text-[#34D399] mt-2 flex items-center gap-1">
                  ✓ Currency preference updated successfully!
                </p>
              )}
            </div>

            {/* Theme Preference Setting */}
            <div className="bg-[#FAF8F5] dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-[#162B27] dark:text-white">
                    Interface Appearance
                  </h3>
                  <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-0.5">
                    Switch between Light, Dark, or System mode.
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </div>

            {/* Daily Expense Push Notification Settings */}
            <PushNotificationManager variant="full" />

            <div className="space-y-4 pt-2">
              <form onSubmit={handleSaveName}>
                <label className="text-xs font-semibold text-[#6B7268] dark:text-stone-400 uppercase tracking-wider block mb-1">
                  Display Name
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="flex-1 px-4 py-2.5 bg-[#FAF8F5] dark:bg-[#141816] border border-[#E5E0D8] dark:border-[#28332E] rounded-xl text-sm font-medium text-[#162B27] dark:text-white focus:outline-none focus:border-[#0F5C53] dark:focus:border-[#10B981]"
                    placeholder="Your Name"
                  />
                  <button
                    type="submit"
                    disabled={savingName || name.trim() === user?.name}
                    className="bg-[#0F5C53] hover:bg-[#0A3F38] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingName ? "Saving..." : "Save Name"}
                  </button>
                </div>
                {nameSuccess && (
                  <p className="text-xs font-semibold text-[#1E7D46] mt-1.5 flex items-center gap-1">
                    ✓ Name updated successfully!
                  </p>
                )}
              </form>

              <div>
                <label className="text-xs font-semibold text-[#6B7268] dark:text-stone-400 uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  title="Email address cannot be modified"
                  className="w-full px-4 py-2.5 bg-stone-100 dark:bg-stone-800/40 border border-[#E5E0D8] dark:border-[#28332E] rounded-xl text-sm font-medium text-stone-500 dark:text-stone-400 cursor-not-allowed select-none opacity-80"
                />
                <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">
                  Account email address is permanently bound and cannot be edited.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-[#F0ECE6]">
              <button
                onClick={handleLogout}
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
