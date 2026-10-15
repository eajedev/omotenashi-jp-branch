import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, destroySession, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST — destroy the session and clear the cookie.
// Also handles the sidebar logout <form> (returns a redirect).
export async function POST(req: Request) {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await destroySession(token);
  const isForm =
    (req.headers.get("content-type") ?? "").includes("form") ||
    req.headers.get("accept")?.includes("text/html");
  if (isForm) {
    const res = NextResponse.redirect(new URL("/admin/login", req.url));
    const opts = sessionCookieOptions();
    res.cookies.set({
      name: opts.name,
      value: "",
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      path: opts.path,
      maxAge: 0,
    });
    return res;
  }
  const res = NextResponse.json({ ok: true });
  const opts = sessionCookieOptions();
  res.cookies.set({
    name: opts.name,
    value: "",
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: 0,
  });
  return res;
}
