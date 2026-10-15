import { NextResponse } from "next/server";
import { requireAdmin } from "../requireAdmin";
import { getSettings, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const value = typeof body.value === "string" ? body.value : "";
  if (!key) {
    return NextResponse.json({ error: "key is required." }, { status: 400 });
  }
  const ok = await setSetting(key, value);
  if (!ok) {
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
