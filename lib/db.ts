// Database layer for the Omotenashi TCG Japan branch admin panel.
// Branch-specific data lives in Postgres, separate from the Shopify origin.
// All functions fail gracefully (return safe defaults, never throw) so the
// storefront never crashes when DATABASE_URL is unset or the DB is down.

import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 5 });
    pool.on("error", () => {
      /* pool errors are surfaced per-query; never crash */
    });
  }
  return pool;
}

export interface ProductOverride {
  handle: string;
  title: string | null;
  price_cents: number | null;
  compare_price_cents: number | null;
  description: string | null;
  badge: string | null;
  hidden: boolean;
  updated_at: string | null;
}

export interface BranchProduct {
  id: number;
  handle: string;
  title: string;
  price_cents: number;
  compare_price_cents: number | null;
  description: string | null;
  image_url: string | null;
  badge: string | null;
  active: boolean;
  created_at: string | null;
}

export interface PaymentMethod {
  id: number;
  key: string;
  name: string;
  enabled: boolean;
  details: string | null;
  sort_order: number;
}

export interface OrderItem {
  name: string;
  qty: number;
  price_cents: number;
}

export interface Order {
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
  updated_at: string | null;
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
];

const PAYMENT_SEED: Array<{ key: string; name: string; sort_order: number }> = [
  { key: "wise", name: "Wise", sort_order: 1 },
  { key: "cashapp", name: "Cash App", sort_order: 2 },
  { key: "creditcard", name: "Credit Card", sort_order: 3 },
  { key: "banktransfer", name: "Bank Transfer", sort_order: 4 },
  { key: "chime", name: "Chime", sort_order: 5 },
  { key: "paypal", name: "PayPal", sort_order: 6 },
];

const SETTINGS_SEED: Record<string, string> = {
  whatsapp_number: "+18179694115",
  notice_en:
    "You are shopping at the Japanese branch of Omotenashi TCG here in Michigan, USA.",
  notice_ja:
    "こちらはミシガン州にある Omotenashi TCG の日本支店です。",
  store_name: "Omotenashi TCG — Japan Branch",
};

let schemaReady = false;

export async function ensureSchema(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  if (schemaReady) return true;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS product_overrides (
        handle TEXT PRIMARY KEY,
        title TEXT,
        price_cents INT,
        compare_price_cents INT,
        description TEXT,
        badge TEXT,
        hidden BOOLEAN DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS branch_products (
        id SERIAL PRIMARY KEY,
        handle TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        price_cents INT NOT NULL,
        compare_price_cents INT,
        description TEXT,
        image_url TEXT,
        badge TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS payment_methods (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        details TEXT,
        sort_order INT DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name TEXT,
        phone TEXT,
        address TEXT,
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        total_cents INT NOT NULL DEFAULT 0,
        payment_method TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    // Seed payment methods only if table is empty
    const pmCount = await p.query("SELECT COUNT(*)::int AS c FROM payment_methods");
    if ((pmCount.rows[0]?.c ?? 0) === 0) {
      for (const m of PAYMENT_SEED) {
        await p.query(
          "INSERT INTO payment_methods (key, name, enabled, sort_order) VALUES ($1, $2, true, $3) ON CONFLICT (key) DO NOTHING",
          [m.key, m.name, m.sort_order]
        );
      }
    }
    // Seed settings only for missing keys
    for (const [key, value] of Object.entries(SETTINGS_SEED)) {
      await p.query(
        "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
        [key, value]
      );
    }
    schemaReady = true;
    return true;
  } catch {
    return false;
  }
}

// ---------- Product overrides ----------

export async function getProductOverrides(): Promise<ProductOverride[]> {
  const p = getPool();
  if (!p) return [];
  try {
    await ensureSchema();
    const r = await p.query(
      "SELECT handle, title, price_cents, compare_price_cents, description, badge, hidden, updated_at FROM product_overrides ORDER BY updated_at DESC"
    );
    return r.rows;
  } catch {
    return [];
  }
}

export async function upsertProductOverride(o: {
  handle: string;
  title?: string | null;
  price_cents?: number | null;
  compare_price_cents?: number | null;
  description?: string | null;
  badge?: string | null;
  hidden?: boolean;
}): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await ensureSchema();
    await p.query(
      `INSERT INTO product_overrides (handle, title, price_cents, compare_price_cents, description, badge, hidden, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (handle) DO UPDATE SET
         title = EXCLUDED.title,
         price_cents = EXCLUDED.price_cents,
         compare_price_cents = EXCLUDED.compare_price_cents,
         description = EXCLUDED.description,
         badge = EXCLUDED.badge,
         hidden = EXCLUDED.hidden,
         updated_at = now()`,
      [
        o.handle,
        o.title ?? null,
        o.price_cents ?? null,
        o.compare_price_cents ?? null,
        o.description ?? null,
        o.badge ?? null,
        o.hidden ?? false,
      ]
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteProductOverride(handle: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await ensureSchema();
    await p.query("DELETE FROM product_overrides WHERE handle = $1", [handle]);
    return true;
  } catch {
    return false;
  }
}

// ---------- Branch products ----------

export async function getBranchProducts(): Promise<BranchProduct[]> {
  const p = getPool();
  if (!p) return [];
  try {
    await ensureSchema();
    const r = await p.query(
      "SELECT id, handle, title, price_cents, compare_price_cents, description, image_url, badge, active, created_at FROM branch_products ORDER BY created_at DESC"
    );
    return r.rows;
  } catch {
    return [];
  }
}

export async function createBranchProduct(b: {
  handle: string;
  title: string;
  price_cents: number;
  compare_price_cents?: number | null;
  description?: string | null;
  image_url?: string | null;
  badge?: string | null;
  active?: boolean;
}): Promise<BranchProduct | null> {
  const p = getPool();
  if (!p) return null;
  try {
    await ensureSchema();
    const r = await p.query(
      `INSERT INTO branch_products (handle, title, price_cents, compare_price_cents, description, image_url, badge, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        b.handle,
        b.title,
        b.price_cents,
        b.compare_price_cents ?? null,
        b.description ?? null,
        b.image_url ?? null,
        b.badge ?? null,
        b.active ?? true,
      ]
    );
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function updateBranchProduct(
  id: number,
  b: Partial<{
    handle: string;
    title: string;
    price_cents: number;
    compare_price_cents: number | null;
    description: string | null;
    image_url: string | null;
    badge: string | null;
    active: boolean;
  }>
): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await ensureSchema();
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, val] of Object.entries(b)) {
      if (val === undefined) continue;
      fields.push(`${key} = $${i++}`);
      values.push(val);
    }
    if (fields.length === 0) return false;
    values.push(id);
    await p.query(
      `UPDATE branch_products SET ${fields.join(", ")} WHERE id = $${i}`,
      values
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteBranchProduct(id: number): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await ensureSchema();
    await p.query("DELETE FROM branch_products WHERE id = $1", [id]);
    return true;
  } catch {
    return false;
  }
}

// ---------- Payment methods ----------

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const p = getPool();
  if (!p) return [];
  try {
    await ensureSchema();
    const r = await p.query(
      "SELECT id, key, name, enabled, details, sort_order FROM payment_methods ORDER BY sort_order ASC, id ASC"
    );
    return r.rows;
  } catch {
    return [];
  }
}

export async function updatePaymentMethod(
  id: number,
  patch: { enabled?: boolean; details?: string | null; name?: string }
): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await ensureSchema();
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, val] of Object.entries(patch)) {
      if (val === undefined) continue;
      fields.push(`${key} = $${i++}`);
      values.push(val);
    }
    if (fields.length === 0) return false;
    values.push(id);
    await p.query(
      `UPDATE payment_methods SET ${fields.join(", ")} WHERE id = $${i}`,
      values
    );
    return true;
  } catch {
    return false;
  }
}

// ---------- Orders ----------

export async function getOrders(): Promise<Order[]> {
  const p = getPool();
  if (!p) return [];
  try {
    await ensureSchema();
    const r = await p.query(
      "SELECT id, customer_name, phone, address, items, total_cents, payment_method, status, notes, created_at, updated_at FROM orders ORDER BY created_at DESC"
    );
    return r.rows.map((row) => ({
      ...row,
      items: Array.isArray(row.items) ? row.items : [],
    }));
  } catch {
    return [];
  }
}

export async function createOrder(o: {
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
  items?: OrderItem[];
  total_cents?: number;
  payment_method?: string | null;
  status?: string;
  notes?: string | null;
}): Promise<Order | null> {
  const p = getPool();
  if (!p) return null;
  try {
    await ensureSchema();
    const r = await p.query(
      `INSERT INTO orders (customer_name, phone, address, items, total_cents, payment_method, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        o.customer_name ?? null,
        o.phone ?? null,
        o.address ?? null,
        JSON.stringify(o.items ?? []),
        o.total_cents ?? 0,
        o.payment_method ?? null,
        o.status ?? "pending",
        o.notes ?? null,
      ]
    );
    const row = r.rows[0];
    if (!row) return null;
    return { ...row, items: Array.isArray(row.items) ? row.items : [] };
  } catch {
    return null;
  }
}

export async function updateOrder(
  id: number,
  patch: Partial<{
    customer_name: string | null;
    phone: string | null;
    address: string | null;
    items: OrderItem[];
    total_cents: number;
    payment_method: string | null;
    status: string;
    notes: string | null;
  }>
): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await ensureSchema();
    const fields: string[] = ["updated_at = now()"];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, val] of Object.entries(patch)) {
      if (val === undefined) continue;
      fields.push(`${key} = $${i++}`);
      values.push(key === "items" ? JSON.stringify(val) : val);
    }
    if (fields.length === 1) return false;
    values.push(id);
    await p.query(
      `UPDATE orders SET ${fields.join(", ")} WHERE id = $${i}`,
      values
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteOrder(id: number): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await ensureSchema();
    await p.query("DELETE FROM orders WHERE id = $1", [id]);
    return true;
  } catch {
    return false;
  }
}

// ---------- Settings ----------

export async function getSettings(): Promise<Record<string, string>> {
  const p = getPool();
  if (!p) return {};
  try {
    await ensureSchema();
    const r = await p.query("SELECT key, value FROM settings ORDER BY key ASC");
    const out: Record<string, string> = {};
    for (const row of r.rows) out[row.key] = row.value;
    return out;
  } catch {
    return {};
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const p = getPool();
  if (!p) return null;
  try {
    await ensureSchema();
    const r = await p.query("SELECT value FROM settings WHERE key = $1", [key]);
    return r.rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await ensureSchema();
    await p.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [key, value]
    );
    return true;
  } catch {
    return false;
  }
}
