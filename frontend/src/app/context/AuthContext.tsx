import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setAuthToken } from "../services/api";

const SESSION_TOKEN_KEY = "arglove_auth_token";

export type AuthUser = {
  id: number;
  email: string;
  role: string;
  is_active?: boolean;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const applyToken = useCallback((next: string | null) => {
    setToken(next);
    setAuthToken(next);
    if (next) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, next);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const saved = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!saved) {
      setAuthReady(true);
      return;
    }

    applyToken(saved);
    api
      .getProfile()
      .then((data) => {
        if (mounted) setUser(data.user);
      })
      .catch(() => {
        applyToken(null);
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [applyToken]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password);
    applyToken(data.token);
    setUser(data.user);
    return data.user as AuthUser;
  }, [applyToken]);

  const register = useCallback(async (email: string, password: string) => {
    const data = await api.register(email, password);
    applyToken(data.token);
    setUser(data.user);
    return data.user as AuthUser;
  }, [applyToken]);

  const logout = useCallback(() => {
    applyToken(null);
    setUser(null);
  }, [applyToken]);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      authReady,
      setUser,
      login,
      register,
      logout,
    }),
    [token, user, authReady, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function canAccessCms(user: AuthUser | null): boolean {
  return user?.role === "admin" || user?.role === "editor";
}
