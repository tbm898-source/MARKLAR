import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchAdminAuthStatus,
  isUnauthorizedError,
  loginAdmin,
} from "../lib/api.js";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }
  return value;
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams],
  );
  const [token, setToken] = useState("");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      try {
        const status = await fetchAdminAuthStatus();
        if (active && status.authenticated) {
          navigate(nextPath, { replace: true });
        }
      } catch {
        // Stay on the login form when the auth probe is unavailable.
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    void checkExistingSession();
    return () => {
      active = false;
    };
  }, [navigate, nextPath]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await loginAdmin(token);
      navigate(nextPath, { replace: true });
    } catch (err) {
      if (isUnauthorizedError(err)) {
        setError("That admin token was not accepted.");
      } else {
        setError(err instanceof Error ? err.message : "Admin login failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell admin-login-shell">
      <section className="admin-login-panel">
        <p className="admin-login-kicker">FieldPulse Lite</p>
        <h1>Admin sign in</h1>
        <p className="admin-login-copy">
          Enter the admin token from this deployment's environment.
        </p>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="admin-token">Admin token</label>
          <input
            id="admin-token"
            autoComplete="current-password"
            autoFocus
            disabled={checking || submitting}
            onChange={(event) => setToken(event.target.value)}
            type="password"
            value={token}
          />

          {error ? <p className="admin-login-error">{error}</p> : null}

          <button
            className="btn btn-primary admin-login-button"
            disabled={checking || submitting || token.trim().length === 0}
            type="submit"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="admin-login-footer">
          <Link to="/worker">Worker page</Link>
        </p>
      </section>
    </div>
  );
}
