import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setCsrfToken } from "./api";
import type { AuthResponse, User } from "./types";

interface AuthContextValue {
  user: User | null;
  csrfToken: string | null;
  loading: boolean;
  mustChangePassword: boolean;
  mustSetup2fa: boolean;
  login: (payload: { username: string; password: string; totp?: string; recoveryCode?: string }) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  applySession: (session: AuthResponse) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyResponse(session: AuthResponse) {
  setCsrfToken(session.csrfToken);
  return session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [csrfToken, setCsrf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [mustSetup2fa, setMustSetup2fa] = useState(false);

  const applySession = useCallback((session: AuthResponse) => {
    applyResponse(session);
    setUser(session.user);
    setCsrf(session.csrfToken);
    setMustChangePassword(Boolean(session.mustChangePassword));
    setMustSetup2fa(Boolean(session.mustSetup2fa));
  }, []);

  const clearSession = useCallback(() => {
    setCsrfToken(null);
    setUser(null);
    setCsrf(null);
    setMustChangePassword(false);
    setMustSetup2fa(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const session = await api.me();
      applySession(session);
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (payload: { username: string; password: string; totp?: string; recoveryCode?: string }) => {
      const session = await api.login(payload);
      applySession(session);
      return session;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Clear locally even if the network call fails.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      csrfToken,
      loading,
      mustChangePassword,
      mustSetup2fa,
      login,
      logout,
      refresh,
      applySession,
      clearSession,
    }),
    [
      user,
      csrfToken,
      loading,
      mustChangePassword,
      mustSetup2fa,
      login,
      logout,
      refresh,
      applySession,
      clearSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
