// Admin session auth. Password + session tokens.
// Fail closed: if ADMIN_PASSWORD is unset/empty, login always fails.
// Session tokens are random 32-byte hex strings stored in Postgres.

import { randomBytes, timingSafeEqual } from "crypto";
import { Pool } from "pg";

export const ADMIN_COOKIE = "omotenashi_admin";

let pool: Pool | null = null;

function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 5 });
    pool.on("error", () => {});
  }
  return pool;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length === 0) return false;
  if (typeof input !== "string" || input.length === 0) return false;
  return safeEqual(input, expected);
}

export async function createSession(): Promise<string | null> {
  const p = getPool();
  if (!p) return null;
  const token = randomBytes(32).toString("hex");
  try {
    await p.query(
      "INSERT INTO admin_sessions (id, token, expires_at) VALUES ($1, $2, now() + interval '24 hours')",
      [token, token]
    );
    return token;
  } catch {
    return null;
  }
}

export async function validateSession(token: string): Promise<boolean> {
  const p = getPool();
  if (!p || !token) return false;
  try {
    const r = await p.query(
      "SELECT expires_at FROM admin_sessions WHERE token = $1",
      [token]
    );
    const row = r.rows[0];
    if (!row) return false;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await p.query("DELETE FROM admin_sessions WHERE token = $1", [token]);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function destroySession(token: string): Promise<void> {
  const p = getPool();
  if (!p || !token) return;
  try {
    await p.query("DELETE FROM admin_sessions WHERE token = $1", [token]);
  } catch {
    /* best effort */
  }
}

export function sessionCookieOptions() {
  return {
    name: ADMIN_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 86400,
  };
}
