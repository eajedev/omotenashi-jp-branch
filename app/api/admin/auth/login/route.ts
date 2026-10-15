import { NextResponse } from "next/server";
import {
  verifyPassword,
  createSession,
  sessionCookieOptions,
} from "@/lib/auth";
import { ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";
    if (!verifyPassword(password)) {
      return NextResponse.json(
        { error: "Invalid password." },
        { status: 401 }
      );
    }
    await ensureSchema();
    const token = await createSession();
    if (!token) {
      return NextResponse.json(
        { error: "Database unavailable. Try again later." },
        { status: 503 }
      );
    }
    const res = NextResponse.json({ ok: true });
    const opts = sessionCookieOptions();
    res.cookies.set({
      name: opts.name,
      value: token,
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      path: opts.path,
      maxAge: opts.maxAge,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
