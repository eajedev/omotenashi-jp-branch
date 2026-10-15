import { NextResponse } from "next/server";
import { requireAdmin } from "../requireAdmin";
import { getPaymentMethods, updatePaymentMethod } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const methods = await getPaymentMethods();
  return NextResponse.json({ methods });
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "number" ? body.id : parseInt(body.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  const patch: { enabled?: boolean; details?: string | null; name?: string } = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.details !== undefined) {
    patch.details =
      typeof body.details === "string" && body.details.trim() !== ""
        ? body.details.trim()
        : null;
  }
  if (typeof body.name === "string" && body.name.trim() !== "") {
    patch.name = body.name.trim();
  }
  const ok = await updatePaymentMethod(id, patch);
  if (!ok) {
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
