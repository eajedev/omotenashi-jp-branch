import Link from "next/link";
import { AdminShell } from "./AdminShell";
import {
  getBranchProducts,
  getProductOverrides,
  getPaymentMethods,
  getOrders,
  ORDER_STATUSES,
} from "@/lib/db";

export const dynamic = "force-dynamic";

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusBadge(status: string): string {
  switch (status) {
    case "paid":
      return "admin-badge green";
    case "shipped":
      return "admin-badge amber";
    case "delivered":
      return "admin-badge green";
    case "cancelled":
      return "admin-badge red";
    default:
      return "admin-badge gray";
  }
}

export default async function AdminDashboard() {
  const [branchProducts, overrides, methods, orders] = await Promise.all([
    getBranchProducts(),
    getProductOverrides(),
    getPaymentMethods(),
    getOrders(),
  ]);

  const dbConfigured = process.env.DATABASE_URL ? true : false;
  const activeMethods = methods.filter((m) => m.enabled).length;
  const totalProducts =
    branchProducts.filter((p) => p.active).length + overrides.length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthOrders = orders.filter(
    (o) => o.created_at && new Date(o.created_at) >= monthStart
  );
  const monthRevenue = monthOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total_cents, 0);

  const statusCounts: Record<string, number> = {};
  for (const o of orders) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  }

  const recentOrders = orders.slice(0, 8);

  return (
    <AdminShell active="/admin">
      <h1>Dashboard</h1>
      <p className="page-sub">Overview of the Japan branch store.</p>

      {!dbConfigured && (
        <div className="admin-alert">
          DATABASE_URL is not set. The admin panel is running in read-only /
          empty mode — set DATABASE_URL to enable saving.
        </div>
      )}

      <div className="admin-stat-grid">
        <div className="admin-stat">
          <div className="stat-value">{totalProducts}</div>
          <div className="stat-label">Products (branch + overrides)</div>
        </div>
        <div className="admin-stat">
          <div className="stat-value">
            {activeMethods} / {methods.length}
          </div>
          <div className="stat-label">Payment methods active</div>
        </div>
        <div className="admin-stat">
          <div className="stat-value">{orders.length}</div>
          <div className="stat-label">Total orders</div>
        </div>
        <div className="admin-stat">
          <div className="stat-value">{fmtCents(monthRevenue)}</div>
          <div className="stat-label">Revenue this month</div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Orders by status</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ORDER_STATUSES.map((s) => (
            <span key={s} className={statusBadge(s)}>
              {s}: {statusCounts[s] ?? 0}
            </span>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <h2>Recent orders</h2>
        {recentOrders.length === 0 ? (
          <p className="admin-empty">No orders yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.customer_name || "—"}</td>
                    <td>{fmtCents(o.total_cents)}</td>
                    <td>{o.payment_method || "—"}</td>
                    <td>
                      <span className={statusBadge(o.status)}>{o.status}</span>
                    </td>
                    <td>{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <Link href="/admin/orders">View all orders →</Link>
        </div>
      </div>

      <div className="admin-card">
        <h2>Quick links</h2>
        <div className="admin-quicklinks">
          <Link href="/admin/products">Add a product</Link>
          <Link href="/admin/products">Edit product override</Link>
          <Link href="/admin/payments">Manage payment methods</Link>
          <Link href="/admin/orders">Add an order</Link>
          <Link href="/admin/settings">Store settings</Link>
        </div>
      </div>
    </AdminShell>
  );
}
