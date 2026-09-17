"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  currency?: string;
  selfPersonId?: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  updateUser: (updatedFields: Partial<User>) => void;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const USER_CACHE_KEY = "hisab_user_cache";

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  updateUser: () => {},
  refreshUser: async () => null,
  logout: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: User }>("/api/auth/me");
      if (res.user) {
        setUser(res.user);
        try {
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(res.user));
        } catch {}
      }
      return res.user;
    } catch (err: any) {
      // Only clear user if online and truly unauthorized (not a network or offline failure)
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (!isOffline && (err?.message?.includes("Unauthorized") || err?.status === 401)) {
        setUser(null);
        try {
          localStorage.removeItem(USER_CACHE_KEY);
        } catch {}
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Hydrate from cache on mount and fetch fresh user data
  useEffect(() => {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      if (cached) {
        setUser(JSON.parse(cached));
        setLoading(false);
      }
    } catch {}
    refreshUser();
  }, [refreshUser]);

  const updateUser = useCallback((updatedFields: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      try {
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    try {
      localStorage.removeItem(USER_CACHE_KEY);
    } catch {}
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, setUser, updateUser, refreshUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
