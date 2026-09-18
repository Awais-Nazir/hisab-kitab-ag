"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushNotificationManagerProps {
  variant?: "full" | "banner";
}

export function PushNotificationManager({ variant = "full" }: PushNotificationManagerProps) {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [deviceCount, setDeviceCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (variant === "banner" && localStorage.getItem("push_banner_dismissed") === "true") {
      setIsBannerDismissed(true);
    }

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (!supported) return;

    setPermission(Notification.permission);
    checkSubscriptionStatus();
  }, [variant]);

  async function checkSubscriptionStatus() {
    try {
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg?.pushManager?.getSubscription();
      setIsSubscribed(!!sub);

      const res = await apiFetch<{ isSubscribed: boolean; deviceCount: number }>("/api/push/status");
      setDeviceCount(res.deviceCount || 0);
    } catch (err) {
      console.error("Error checking push status:", err);
    }
  }

  async function subscribe() {
    if (!isSupported) {
      setFeedback({ type: "error", text: "Push notifications are not supported in this browser." });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setFeedback({
          type: "error",
          text: perm === "denied"
            ? "Notifications are blocked. Please enable notifications in your browser/Android site settings."
            : "Notification permission was not granted.",
        });
        return;
      }

      const keyRes = await apiFetch<{ publicKey: string }>("/api/push/vapid-public-key");
      const publicKey = keyRes.publicKey;
      if (!publicKey) {
        throw new Error("VAPID public key is missing on the server.");
      }

      let reg = await navigator.serviceWorker.ready;
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
      }

      const convertedKey = urlBase64ToUint8Array(publicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });

      await apiFetch("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });

      setIsSubscribed(true);
      await checkSubscriptionStatus();
      setFeedback({
        type: "success",
        text: "Subscribed successfully! A welcome reminder has been sent to your device.",
      });
    } catch (err: any) {
      console.error("Subscription failed:", err);
      setFeedback({
        type: "error",
        text: err?.message || "Failed to subscribe to push notifications. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    setFeedback(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        await apiFetch("/api/push/subscribe", {
          method: "DELETE",
          body: JSON.stringify({ endpoint }),
        });
      }

      setIsSubscribed(false);
      await checkSubscriptionStatus();
      setFeedback({
        type: "info",
        text: "You have unsubscribed from push notifications on this device.",
      });
    } catch (err: any) {
      console.error("Unsubscribe failed:", err);
      setFeedback({
        type: "error",
        text: err?.message || "Failed to unsubscribe. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendTestNotification() {
    setTesting(true);
    setFeedback(null);

    try {
      const res = await apiFetch<{
        success: boolean;
        sentCount: number;
        message: string;
        notification: { title: string; body: string };
      }>("/api/push/send-test", {
        method: "POST",
      });

      setFeedback({
        type: "success",
        text: res.message,
      });
    } catch (err: any) {
      console.error("Test push failed:", err);
      setFeedback({
        type: "error",
        text: err?.message || "Failed to send test push notification.",
      });
    } finally {
      setTesting(false);
    }
  }

  function dismissBanner() {
    setIsBannerDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("push_banner_dismissed", "true");
    }
  }

  if (!isSupported) {
    if (variant === "banner") return null;
    return (
      <div className="bg-[#FAF8F5] dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-2xl p-5 text-sm text-[#6B7268] dark:text-[#8E9C95]">
        <div className="flex items-center gap-2 font-semibold text-[#162B27] dark:text-white mb-1">
          <span>Push Notifications</span>
        </div>
        <p className="text-xs">
          Web push notifications are not supported on this browser or platform. (On iOS, add this app to Home Screen via Safari to enable web push).
        </p>
      </div>
    );
  }

  if (variant === "banner") {
    if (isSubscribed || isBannerDismissed) return null;

    return (
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0F5C53]/10 via-[#10B981]/15 to-[#0F5C53]/10 dark:from-[#10B981]/15 dark:via-[#0F5C53]/20 dark:to-[#10B981]/10 border border-[#0F5C53]/30 dark:border-[#10B981]/30 rounded-2xl p-4 sm:p-5 mb-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F5C53] dark:bg-[#10B981] text-white flex items-center justify-center shrink-0 shadow-xs text-xl">
              🔔
            </div>
            <div>
              <h4 className="font-semibold text-sm sm:text-base text-[#162B27] dark:text-white">
                Rozana Kharcha Bhool Jate Ho?
              </h4>
              <p className="text-xs text-[#6B7268] dark:text-[#A7B9B0] mt-0.5 max-w-lg">
                Enable daily Android reminders! Din me ~3 bar randomly reminder aayega: <em className="text-[#0F5C53] dark:text-[#34D399]">&quot;Aj ka kharcha note down kr le Bahi, bad main confusion hogi!&quot;</em>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={dismissBanner}
              className="text-xs font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Later
            </button>
            <button
              type="button"
              onClick={subscribe}
              disabled={loading}
              className="bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Enabling...
                </>
              ) : (
                <>
                  <span>🔔</span>
                  Enable Reminders
                </>
              )}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-3 p-2.5 rounded-xl text-xs font-medium ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                : feedback.type === "error"
                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#FAF8F5] dark:bg-[#19201D] border border-[#E5E0D8] dark:border-[#28332E] rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-base text-[#162B27] dark:text-white flex items-center gap-2">
              <span>🔔</span> Android & PWA Push Notifications
            </h3>
            {isSubscribed ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
                Disabled
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B7268] dark:text-[#8E9C95] mt-1 max-w-xl">
            Get random reminders ~3 times daily (morning, afternoon, night) on your phone:{" "}
            <span className="italic text-[#0F5C53] dark:text-[#34D399]">&quot;Aj ka kharcha note down kr le Bahi, bad main confusion hogi!&quot;</span> Timings vary dynamically each day and weekends are customized.
          </p>
          {deviceCount > 0 && (
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1.5">
              📱 Active subscribed devices: <strong className="text-[#162B27] dark:text-stone-200">{deviceCount}</strong>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSubscribed ? (
            <button
              type="button"
              onClick={unsubscribe}
              disabled={loading}
              className="bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Unsubscribing..." : "Turn Off"}
            </button>
          ) : (
            <button
              type="button"
              onClick={subscribe}
              disabled={loading}
              className="bg-[#0F5C53] hover:bg-[#0A3F38] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Setting up...
                </>
              ) : (
                <>
                  <span>🔔</span> Enable Reminders
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {isSubscribed && (
        <div className="mt-4 pt-4 border-t border-[#E5E0D8] dark:border-[#28332E] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-500 dark:text-stone-400">
            Test your device notification sound and vibration right now:
          </div>
          <button
            type="button"
            onClick={sendTestNotification}
            disabled={testing}
            className="border border-[#0F5C53] dark:border-[#10B981] text-[#0F5C53] dark:text-[#34D399] hover:bg-[#0F5C53]/10 dark:hover:bg-[#10B981]/10 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {testing ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                Sending...
              </>
            ) : (
              <>
                <span>⚡</span> Send Test Notification Now
              </>
            )}
          </button>
        </div>
      )}

      {permission === "denied" && (
        <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-800 dark:text-rose-300">
          ⚠️ <strong>Permission Denied:</strong> Notifications are blocked in your browser settings. To receive reminders, click the lock or settings icon next to the address bar and set Notifications to <strong>Allow</strong>.
        </div>
      )}

      {feedback && (
        <div
          className={`mt-3 p-3 rounded-xl text-xs font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
              : feedback.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}
