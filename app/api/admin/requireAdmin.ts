// Shared auth guard for /api/admin/* routes.
// Returns true when the request carries a valid admin session cookie.
import { cookies } from "next/headers";
import { ADMIN_COOKIE, validateSession } from "@/lib/auth";

export async function requireAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return validateSession(token);
}
