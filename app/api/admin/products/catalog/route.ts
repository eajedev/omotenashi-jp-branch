import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/shopify";
import { getProductOverrides } from "@/lib/db";
import { requireAdmin } from "../../requireAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const [products, overrides] = await Promise.all([getCatalog(), getProductOverrides()]);
    const overridden = new Set(overrides.map((o) => o.handle.toLowerCase()));
    return NextResponse.json({
      total: products.length,
      products: products.map((p) => ({ ...p, hasOverride: overridden.has(p.handle.toLowerCase()) })),
    });
  } catch {
    return NextResponse.json({ error: "Catalog unavailable." }, { status: 502 });
  }
}
