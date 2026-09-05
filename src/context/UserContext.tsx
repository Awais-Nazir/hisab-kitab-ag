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
  // Initialize with cached user data if available to prevent avatar flicker on refresh
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(USER_CACHE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {}
    }
    return null;
  });

  const [loading, setLoading] = useState(!user);

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
    } catch {
      // If 401 Unauthorized, clear cached user
      setUser(null);
      try {
        localStorage.removeItem(USER_CACHE_KEY);
      } catch {}
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch once on app mount
  useEffect(() => {
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
