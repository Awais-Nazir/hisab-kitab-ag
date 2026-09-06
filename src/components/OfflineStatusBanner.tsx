"use client";

import { useSync } from "@/context/SyncContext";
import { useEffect, useState } from "react";

export function OfflineStatusBanner() {
    const { isOnline, pendingCount, isSyncing, lastSyncTime, syncNow } = useSync();
    const [showSyncedNotice, setShowSyncedNotice] = useState(false);

    useEffect(() => {
        if (lastSyncTime && Date.now() - lastSyncTime < 4000) {
            setShowSyncedNotice(true);
            const timer = setTimeout(() => {
                setShowSyncedNotice(false);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [lastSyncTime]);

    // If completely online with no pending syncs and no recent sync notice, render nothing
    if (isOnline && pendingCount === 0 && !isSyncing && !showSyncedNotice) {
        return null;
    }

    return (
        <div className="w-full transition-all duration-200">
            {!isOnline && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span>
                            <strong>Offline Mode</strong> — You can still add expenses! They are saved locally on this device.
                        </span>
                    </div>
                    {pendingCount > 0 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200">
                            {pendingCount} unsynced
                        </span>
                    )}
                </div>
            )}

            {isOnline && isSyncing && pendingCount > 0 && (
                <div className="bg-blue-500/10 border-b border-blue-500/20 text-blue-800 dark:text-blue-300 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="animate-spin h-3.5 w-3.5 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Syncing {pendingCount} offline {pendingCount === 1 ? "entry" : "entries"} with server...</span>
                    </div>
                </div>
            )}

            {isOnline && !isSyncing && pendingCount > 0 && (
                <div className="bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span>Connected! {pendingCount} offline {pendingCount === 1 ? "entry is" : "entries are"} ready to sync.</span>
                    </div>
                    <button
                        onClick={() => syncNow()}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition cursor-pointer"
                    >
                        Sync Now
                    </button>
                </div>
            )}

            {showSyncedNotice && pendingCount === 0 && !isSyncing && (
                <div className="bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-4 py-2 text-xs md:text-sm font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>All offline changes synced successfully!</span>
                </div>
            )}
        </div>
    );
}
