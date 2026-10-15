import { NextResponse } from "next/server";
import { requireAdmin } from "../requireAdmin";
import {
  getOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  ORDER_STATUSES,
} from "@/lib/db";

export const dynamic = "force-dynamic";

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function toStr(v: unknown): string | null {
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const orders = await getOrders();
  return NextResponse.json({ orders });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items)
    ? body.items
        .filter(
          (i: unknown) =>
            typeof i === "object" && i !== null && typeof (i as { name?: unknown }).name === "string"
        )
        .map((i: { name: string; qty?: unknown; price_cents?: unknown }) => ({
          name: i.name,
          qty: typeof i.qty === "number" ? Math.max(1, Math.round(i.qty)) : 1,
          price_cents:
            typeof i.price_cents === "number" ? Math.round(i.price_cents) : 0,
        }))
    : [];
  const totalCents = toInt(body.total_cents) ?? 0;
  const status =
    typeof body.status === "string" &&
    (ORDER_STATUSES as string[]).includes(body.status)
      ? body.status
      : "pending";
  const order = await createOrder({
    customer_name: toStr(body.customer_name),
    phone: toStr(body.phone),
    address: toStr(body.address),
    items,
    total_cents: totalCents,
    payment_method: toStr(body.payment_method),
    status,
    notes: toStr(body.notes),
  });
  if (!order) {
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, order });
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const id = toInt(body.id);
  if (id === null) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (body.customer_name !== undefined) patch.customer_name = toStr(body.customer_name);
  if (body.phone !== undefined) patch.phone = toStr(body.phone);
  if (body.address !== undefined) patch.address = toStr(body.address);
  if (Array.isArray(body.items)) patch.items = body.items;
  if (body.total_cents !== undefined) patch.total_cents = toInt(body.total_cents);
  if (body.payment_method !== undefined) patch.payment_method = toStr(body.payment_method);
  if (body.notes !== undefined) patch.notes = toStr(body.notes);
  if (typeof body.status === "string" && (ORDER_STATUSES as string[]).includes(body.status)) {
    patch.status = body.status;
  }
  const ok = await updateOrder(id, patch);
  if (!ok) {
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = toInt(url.searchParams.get("id"));
  if (id === null) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  await deleteOrder(id);
  return NextResponse.json({ ok: true });
}
