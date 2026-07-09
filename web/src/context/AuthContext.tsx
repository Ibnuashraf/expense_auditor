import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearSession,
  getStoredUser,
  setSession,
  type LoginBody,
  type TokenResponse,
} from "../lib/api";

type AuthContextValue = {
  user: TokenResponse | null;
  login: (body: LoginBody) => Promise<TokenResponse>;
  logout: () => void;
  ready: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TokenResponse | null>(() => getStoredUser());
  const ready = true;

  const login = useCallback(async (body: LoginBody) => {
    const token = await api.login(body);
    setSession(token.access_token, token);
    setUser(token);
    return token;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, logout, ready }),
    [user, login, logout, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
