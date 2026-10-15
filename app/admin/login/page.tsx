"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    search.get("error") ? "Your session expired. Please log in again." : null
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login failed.");
        setBusy(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      {error && <div className="admin-alert error">{error}</div>}
      <form onSubmit={submit} className="admin-form">
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </div>
        <button type="submit" className="admin-btn" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <h1>Admin Login</h1>
        <p>Omotenashi TCG — Japan Branch</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
