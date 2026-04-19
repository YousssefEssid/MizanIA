"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import type { Me, Role } from "@/lib/api";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "unauthenticated"; user: null }
  | { status: "authenticated"; user: Me };

type AuthContextValue = AuthState & {
  refresh: () => Promise<Me | null>;
  signIn: (email: string, password: string) => Promise<Me>;
  signOut: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function homeForRole(role: Role): string {
  if (role === "hr_admin") return "/company/dashboard";
  if (role === "employee") return "/employee";
  if (role === "superadmin") return "/admin";
  return "/";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({ status: "loading", user: null });

  const refresh = React.useCallback(async () => {
    try {
      const u = await api.me();
      setState({ status: "authenticated", user: u });
      return u;
    } catch {
      setState({ status: "unauthenticated", user: null });
      return null;
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = React.useCallback(
    async (email: string, password: string) => {
      await api.login(email, password);
      const u = await api.me();
      setState({ status: "authenticated", user: u });
      return u;
    },
    [],
  );

  const signOut = React.useCallback(() => {
    api.logout();
    setState({ status: "unauthenticated", user: null });
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ ...state, refresh, signIn, signOut }),
    [state, refresh, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = React.useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

/**
 * Client guard: renders `fallback` while auth is loading, redirects to /login
 * if unauthenticated, and redirects to the user's home if their role doesn't
 * match `allow`.
 */
export function RoleGate({
  allow,
  children,
  fallback,
}: {
  allow: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace("/login");
    } else if (auth.status === "authenticated" && !allow.includes(auth.user.role)) {
      router.replace(homeForRole(auth.user.role));
    }
  }, [auth, allow, router]);

  if (auth.status !== "authenticated" || !allow.includes(auth.user.role)) {
    return (
      <>{fallback ?? <div className="p-8 text-sm text-muted-foreground">Loading…</div>}</>
    );
  }
  return <>{children}</>;
}
