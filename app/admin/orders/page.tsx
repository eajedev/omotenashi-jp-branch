import { AdminShell } from "../AdminShell";
import { getOrders } from "@/lib/db";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await getOrders();
  return (
    <AdminShell active="/admin/orders">
      <h1>Orders</h1>
      <p className="page-sub">Track orders placed through the branch store.</p>
      <OrdersClient initialOrders={orders} />
    </AdminShell>
  );
}
