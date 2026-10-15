import { AdminShell } from "../AdminShell";
import { getProductOverrides, getBranchProducts } from "@/lib/db";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [overrides, branch] = await Promise.all([
    getProductOverrides(),
    getBranchProducts(),
  ]);
  return (
    <AdminShell active="/admin/products">
      <h1>Products</h1>
      <p className="page-sub">
        Override Shopify products or manage branch-only products.
      </p>
      <ProductsClient initialOverrides={overrides} initialBranch={branch} />
    </AdminShell>
  );
}
