"use client";

import { useState } from "react";

const ORDER_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];

interface OrderItem {
  name: string;
  qty: number;
  price_cents: number;
}

interface Order {
  id: number;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  items: OrderItem[];
  total_cents: number;
  payment_method: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
}

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

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Parse "Name x Qty @ Price" lines into items
function parseItems(text: string): OrderItem[] {
  const items: OrderItem[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    // "Name x 2 @ 49.99" or "Name x2 @ $49.99"
    const m = t.match(/^(.*?)\s*x\s*(\d+)\s*@\s*\$?([\d.]+)\s*$/i);
    if (m) {
      items.push({
        name: m[1].trim(),
        qty: parseInt(m[2], 10),
        price_cents: Math.round(parseFloat(m[3]) * 100),
      });
    } else {
      items.push({ name: t, qty: 1, price_cents: 0 });
    }
  }
  return items;
}

function parsePrice(input: string): number {
  const v = parseFloat(input.replace(/[$,]/g, ""));
  return Number.isNaN(v) ? 0 : Math.round(v * 100);
}

export default function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [total, setTotal] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Wise");
  const [notes, setNotes] = useState("");

  async function refresh() {
    const data = await api("/api/admin/orders", "GET");
    setOrders(data.orders ?? []);
  }

  async function updateStatus(id: number, status: string) {
    try {
      await api("/api/admin/orders", "PUT", { id, status });
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, status } : o)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  async function deleteOrder(id: number) {
    if (!confirm(`Delete order #${id}?`)) return;
    try {
      await api(`/api/admin/orders?id=${id}`, "DELETE");
      setNotice(`Order #${id} deleted.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const items = parseItems(itemsText);
      const totalCents =
        total.trim() !== ""
          ? parsePrice(total)
          : items.reduce((s, i) => s + i.qty * i.price_cents, 0);
      await api("/api/admin/orders", "POST", {
        customer_name: customerName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        items,
        total_cents: totalCents,
        payment_method: paymentMethod.trim() || null,
        status: "pending",
        notes: notes.trim() || null,
      });
      setNotice("Order added.");
      setShowForm(false);
      setCustomerName("");
      setPhone("");
      setAddress("");
      setItemsText("");
      setTotal("");
      setNotes("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {notice && (
        <div className="admin-alert success" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
      {error && (
        <div className="admin-alert error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="admin-card">
        <h2>All orders</h2>
        {orders.length === 0 ? (
          <p className="admin-empty">No orders yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>
                      <strong>{o.customer_name || "—"}</strong>
                      {o.phone && <div style={{ color: "#666" }}>{o.phone}</div>}
                    </td>
                    <td>
                      {o.items.length === 0
                        ? "—"
                        : o.items
                            .map((i) => `${i.name} × ${i.qty}`)
                            .join(", ")}
                    </td>
                    <td>{fmtCents(o.total_cents)}</td>
                    <td>{o.payment_method || "—"}</td>
                    <td>
                      <select
                        value={o.status}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                        style={{
                          padding: "6px 8px",
                          border: "1px solid #d4d4d4",
                          borderRadius: 6,
                          fontSize: 13,
                          fontFamily: "inherit",
                        }}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <div style={{ marginTop: 4 }}>
                        <span className={statusBadge(o.status)}>{o.status}</span>
                      </div>
                    </td>
                    <td>{fmtDate(o.created_at)}</td>
                    <td>
                      <button
                        className="admin-btn danger small"
                        onClick={() => deleteOrder(o.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm ? (
        <div className="admin-card">
          <h2>Add order</h2>
          <form onSubmit={submit} className="admin-form">
            <div className="admin-form-row">
              <div>
                <label htmlFor="ord-name">Customer name</label>
                <input
                  id="ord-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ord-phone">Phone</label>
                <input
                  id="ord-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="ord-address">Delivery address</label>
              <textarea
                id="ord-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ord-items">
                Items — one per line, format: Name x Qty @ Price
              </label>
              <textarea
                id="ord-items"
                value={itemsText}
                onChange={(e) => setItemsText(e.target.value)}
                placeholder={"OP-18 Booster Box x 1 @ 89.99\nPSA10 Luffy x 2 @ 90.00"}
              />
            </div>
            <div className="admin-form-row">
              <div>
                <label htmlFor="ord-total">
                  Total (USD) — leave blank to sum items
                </label>
                <input
                  id="ord-total"
                  type="text"
                  inputMode="decimal"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="e.g. 269.99"
                />
              </div>
              <div>
                <label htmlFor="ord-method">Payment method</label>
                <select
                  id="ord-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option>Wise</option>
                  <option>Cash App</option>
                  <option>Credit Card</option>
                  <option>Bank Transfer</option>
                  <option>Chime</option>
                  <option>PayPal</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="ord-notes">Notes</label>
              <textarea
                id="ord-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="admin-btn-row">
              <button type="submit" className="admin-btn" disabled={busy}>
                {busy ? "Saving…" : "Add order"}
              </button>
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button className="admin-btn" onClick={() => setShowForm(true)}>
          Add Order
        </button>
      )}
    </>
  );
}
