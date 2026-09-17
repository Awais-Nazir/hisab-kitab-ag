"use client";

import { useEffect, useState } from "react";

export function OfflineStatusBanner() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
        const on = () => setIsOnline(true);
        const off = () => setIsOnline(false);
        window.addEventListener("online", on);
        window.addEventListener("offline", off);
        return () => {
            window.removeEventListener("online", on);
            window.removeEventListener("offline", off);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 px-4 py-1.5 text-xs font-medium text-center">
            No internet connection. Please check your network.
        </div>
    );
}
