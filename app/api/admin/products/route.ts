import { NextResponse } from "next/server";
import { requireAdmin } from "../requireAdmin";
import {
  getProductOverrides,
  getBranchProducts,
  upsertProductOverride,
  deleteProductOverride,
  createBranchProduct,
  updateBranchProduct,
  deleteBranchProduct,
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

function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const [overrides, branchProducts] = await Promise.all([
    getProductOverrides(),
    getBranchProducts(),
  ]);
  return NextResponse.json({ overrides, branchProducts });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.type === "override") {
    const handle = toStr(body.handle);
    if (!handle) {
      return NextResponse.json({ error: "handle is required." }, { status: 400 });
    }
    const ok = await upsertProductOverride({
      handle,
      title: toStr(body.title),
      price_cents: toInt(body.price_cents),
      compare_price_cents: toInt(body.compare_price_cents),
      description: toStr(body.description),
      badge: toStr(body.badge),
      hidden: toBool(body.hidden),
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Database unavailable." },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true });
  }
  if (body.type === "branch") {
    const handle = toStr(body.handle);
    const title = toStr(body.title);
    const priceCents = toInt(body.price_cents);
    if (!handle || !title || priceCents === null) {
      return NextResponse.json(
        { error: "handle, title, and price_cents are required." },
        { status: 400 }
      );
    }
    const product = await createBranchProduct({
      handle,
      title,
      price_cents: priceCents,
      compare_price_cents: toInt(body.compare_price_cents),
      description: toStr(body.description),
      image_url: toStr(body.image_url),
      badge: toStr(body.badge),
      active: toBool(body.active, true),
    });
    if (!product) {
      return NextResponse.json(
        { error: "Could not create product (duplicate handle or DB unavailable)." },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true, product });
  }
  return NextResponse.json(
    { error: "type must be 'override' or 'branch'." },
    { status: 400 }
  );
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.type === "override") {
    const handle = toStr(body.handle);
    if (!handle) {
      return NextResponse.json({ error: "handle is required." }, { status: 400 });
    }
    const ok = await upsertProductOverride({
      handle,
      title: toStr(body.title),
      price_cents: toInt(body.price_cents),
      compare_price_cents: toInt(body.compare_price_cents),
      description: toStr(body.description),
      badge: toStr(body.badge),
      hidden: toBool(body.hidden),
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Database unavailable." },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true });
  }
  if (body.type === "branch") {
    const id = toInt(body.id);
    if (id === null) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    if (body.handle !== undefined) patch.handle = toStr(body.handle);
    if (body.title !== undefined) patch.title = toStr(body.title);
    if (body.price_cents !== undefined) patch.price_cents = toInt(body.price_cents);
    if (body.compare_price_cents !== undefined)
      patch.compare_price_cents = toInt(body.compare_price_cents);
    if (body.description !== undefined) patch.description = toStr(body.description);
    if (body.image_url !== undefined) patch.image_url = toStr(body.image_url);
    if (body.badge !== undefined) patch.badge = toStr(body.badge);
    if (body.active !== undefined) patch.active = toBool(body.active);
    const ok = await updateBranchProduct(id, patch);
    if (!ok) {
      return NextResponse.json(
        { error: "Database unavailable." },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: "type must be 'override' or 'branch'." },
    { status: 400 }
  );
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  if (type === "override") {
    const handle = url.searchParams.get("handle");
    if (!handle) {
      return NextResponse.json({ error: "handle is required." }, { status: 400 });
    }
    await deleteProductOverride(handle);
    return NextResponse.json({ ok: true });
  }
  if (type === "branch") {
    const id = toInt(url.searchParams.get("id"));
    if (id === null) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }
    await deleteBranchProduct(id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: "type must be 'override' or 'branch'." },
    { status: 400 }
  );
}
