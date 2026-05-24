import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { fetchAdminAuthStatus } from "../lib/api.js";

type AuthState = "checking" | "authenticated" | "unauthenticated";

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const status = await fetchAdminAuthStatus();
        if (active) {
          setAuthState(status.authenticated ? "authenticated" : "unauthenticated");
        }
      } catch {
        if (active) {
          setAuthState("unauthenticated");
        }
      }
    }

    void checkAuth();
    return () => {
      active = false;
    };
  }, []);

  if (authState === "checking") {
    return (
      <div className="app-shell app-shell--admin">
        <p>Checking admin access...</p>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    const next = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/admin/login?next=${encodeURIComponent(next)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
