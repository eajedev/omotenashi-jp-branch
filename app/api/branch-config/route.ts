// Public branch config: product overrides, branch products, payment methods, settings.
// Used by middleware.ts to apply admin-managed data to the mirrored storefront.
// No auth — this is the same data already visible on the public site.
import { NextResponse } from "next/server";
import { getProductOverrides, getBranchProducts, getPaymentMethods, getSettings, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const [overrides, branchProducts, payments, settings] = await Promise.all([
      getProductOverrides(),
      getBranchProducts(),
      getPaymentMethods(),
      getSettings(),
    ]);
    return NextResponse.json({ overrides, branchProducts, payments, settings });
  } catch {
    return NextResponse.json({ overrides: [], branchProducts: [], payments: [], settings: {} });
  }
}
