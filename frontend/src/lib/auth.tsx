"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Me } from "@/lib/types";
import { getMe, getToken, login as apiLogin, setTokens, clearTokens } from "@/lib/api";

interface AuthState {
  me: Me | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<Me>;
  signOut: () => void;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!getToken()) { setMe(null); setLoading(false); return; }
    setLoading(true);
    try {
      setMe(await getMe());
    } catch {
      clearTokens();
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const signIn = useCallback(async (username: string, password: string) => {
    const data = await apiLogin(username, password);
    setTokens(data.access, data.refresh);
    const profile = await getMe();
    setMe(profile);
    return profile;
  }, []);

  const signOut = useCallback(() => {
    clearTokens();
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, signIn, signOut, reload }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
