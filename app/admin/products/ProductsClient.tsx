"use client";

import { useState } from "react";

interface Override {
  handle: string;
  title: string | null;
  price_cents: number | null;
  compare_price_cents: number | null;
  description: string | null;
  badge: string | null;
  hidden: boolean;
}

interface BranchProduct {
  id: number;
  handle: string;
  title: string;
  price_cents: number;
  compare_price_cents: number | null;
  description: string | null;
  image_url: string | null;
  badge: string | null;
  active: boolean;
}

function fmtPrice(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function parsePrice(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const v = parseFloat(t.replace(/[$,]/g, ""));
  if (Number.isNaN(v)) return null;
  return Math.round(v * 100);
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

function OverrideForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Override | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [price, setPrice] = useState(
    initial?.price_cents != null ? (initial.price_cents / 100).toFixed(2) : ""
  );
  const [comparePrice, setComparePrice] = useState(
    initial?.compare_price_cents != null
      ? (initial.compare_price_cents / 100).toFixed(2)
      : ""
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [hidden, setHidden] = useState(initial?.hidden ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/products", initial ? "PUT" : "POST", {
        type: "override",
        handle: handle.trim(),
        title: title.trim() || null,
        price_cents: parsePrice(price),
        compare_price_cents: parsePrice(comparePrice),
        description: description.trim() || null,
        badge: badge.trim() || null,
        hidden,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="admin-form">
      {error && <div className="admin-alert error">{error}</div>}
      <div>
        <label htmlFor="ov-handle">Product handle (Shopify handle)</label>
        <input
          id="ov-handle"
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="e.g. tcg0568"
          required
          disabled={!!initial}
        />
      </div>
      <div className="admin-form-row">
        <div>
          <label htmlFor="ov-title">Title override</label>
          <input
            id="ov-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Leave blank to keep original"
          />
        </div>
        <div>
          <label htmlFor="ov-badge">Badge</label>
          <input
            id="ov-badge"
            type="text"
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            placeholder="e.g. PRE-ORDER, SALE, NEW"
          />
        </div>
      </div>
      <div className="admin-form-row">
        <div>
          <label htmlFor="ov-price">Price (USD)</label>
          <input
            id="ov-price"
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 49.99"
          />
        </div>
        <div>
          <label htmlFor="ov-compare">Compare-at price (USD)</label>
          <input
            id="ov-compare"
            type="text"
            inputMode="decimal"
            value={comparePrice}
            onChange={(e) => setComparePrice(e.target.value)}
            placeholder="e.g. 69.99"
          />
        </div>
      </div>
      <div>
        <label htmlFor="ov-desc">Description override</label>
        <textarea
          id="ov-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Leave blank to keep original"
        />
      </div>
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={hidden}
          onChange={(e) => setHidden(e.target.checked)}
        />
        Hide this product from the branch store
      </label>
      <div className="admin-btn-row">
        <button type="submit" className="admin-btn" disabled={busy}>
          {busy ? "Saving…" : initial ? "Update override" : "Add override"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="admin-btn secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function BranchForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: BranchProduct | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [price, setPrice] = useState(
    initial ? (initial.price_cents / 100).toFixed(2) : ""
  );
  const [comparePrice, setComparePrice] = useState(
    initial?.compare_price_cents != null
      ? (initial.compare_price_cents / 100).toFixed(2)
      : ""
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const cents = parsePrice(price);
    if (cents === null) {
      setError("Enter a valid price.");
      setBusy(false);
      return;
    }
    try {
      await api("/api/admin/products", initial ? "PUT" : "POST", {
        type: "branch",
        id: initial?.id,
        handle: handle.trim(),
        title: title.trim(),
        price_cents: cents,
        compare_price_cents: parsePrice(comparePrice),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        badge: badge.trim() || null,
        active,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="admin-form">
      {error && <div className="admin-alert error">{error}</div>}
      <div className="admin-form-row">
        <div>
          <label htmlFor="br-handle">Handle (unique)</label>
          <input
            id="br-handle"
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="e.g. custom-product-1"
            required
          />
        </div>
        <div>
          <label htmlFor="br-title">Title</label>
          <input
            id="br-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="admin-form-row">
        <div>
          <label htmlFor="br-price">Price (USD)</label>
          <input
            id="br-price"
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 49.99"
            required
          />
        </div>
        <div>
          <label htmlFor="br-compare">Compare-at price (USD)</label>
          <input
            id="br-compare"
            type="text"
            inputMode="decimal"
            value={comparePrice}
            onChange={(e) => setComparePrice(e.target.value)}
            placeholder="e.g. 69.99"
          />
        </div>
      </div>
      <div>
        <label htmlFor="br-image">Image URL</label>
        <input
          id="br-image"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div>
        <label htmlFor="br-badge">Badge</label>
        <input
          id="br-badge"
          type="text"
          value={badge}
          onChange={(e) => setBadge(e.target.value)}
          placeholder="e.g. PRE-ORDER, SALE, NEW"
        />
      </div>
      <div>
        <label htmlFor="br-desc">Description</label>
        <textarea
          id="br-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Active (visible in store)
      </label>
      <div className="admin-btn-row">
        <button type="submit" className="admin-btn" disabled={busy}>
          {busy ? "Saving…" : initial ? "Update product" : "Add product"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="admin-btn secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function ProductsClient({
  initialOverrides,
  initialBranch,
}: {
  initialOverrides: Override[];
  initialBranch: BranchProduct[];
}) {
  const [overrides, setOverrides] = useState(initialOverrides);
  const [branch, setBranch] = useState(initialBranch);
  const [editingOverride, setEditingOverride] = useState<Override | null>(null);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchProduct | null>(null);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const data = await api("/api/admin/products", "GET");
      setOverrides(data.overrides ?? []);
      setBranch(data.branchProducts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed.");
    }
  }

  async function deleteOverride(handle: string) {
    if (!confirm(`Delete the override for "${handle}"?`)) return;
    try {
      await api(
        `/api/admin/products?type=override&handle=${encodeURIComponent(handle)}`,
        "DELETE"
      );
      setNotice("Override deleted.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function deleteBranch(id: number, title: string) {
    if (!confirm(`Delete branch product "${title}"?`)) return;
    try {
      await api(`/api/admin/products?type=branch&id=${id}`, "DELETE");
      setNotice("Branch product deleted.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
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
        <h2>Product Overrides</h2>
        <p style={{ color: "#666", marginTop: -6 }}>
          Override title, price, description, badge, or hide a product that
          comes from the Shopify origin. Leave fields blank to keep the
          original value.
        </p>
        {overrides.length === 0 ? (
          <p className="admin-empty">No overrides yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Handle</th>
                  <th>Title</th>
                  <th>Price</th>
                  <th>Badge</th>
                  <th>Hidden</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.handle}>
                    <td className="admin-mono">{o.handle}</td>
                    <td>{o.title || "—"}</td>
                    <td>{fmtPrice(o.price_cents)}</td>
                    <td>{o.badge || "—"}</td>
                    <td>{o.hidden ? "Yes" : "No"}</td>
                    <td>
                      <div className="admin-btn-row">
                        <button
                          className="admin-btn secondary small"
                          onClick={() => {
                            setEditingOverride(o);
                            setShowOverrideForm(false);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="admin-btn danger small"
                          onClick={() => deleteOverride(o.handle)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editingOverride ? (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14 }}>Edit override — {editingOverride.handle}</h3>
            <OverrideForm
              initial={editingOverride}
              onDone={async () => {
                setEditingOverride(null);
                await refresh();
              }}
              onCancel={() => setEditingOverride(null)}
            />
          </div>
        ) : showOverrideForm ? (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14 }}>Add override</h3>
            <OverrideForm
              onDone={async () => {
                setShowOverrideForm(false);
                await refresh();
              }}
              onCancel={() => setShowOverrideForm(false)}
            />
          </div>
        ) : (
          <button
            className="admin-btn"
            style={{ marginTop: 12 }}
            onClick={() => setShowOverrideForm(true)}
          >
            Add Override
          </button>
        )}
      </div>

      <div className="admin-card">
        <h2>Branch Products</h2>
        <p style={{ color: "#666", marginTop: -6 }}>
          Products that exist only on the Japan branch (not in Shopify).
        </p>
        {branch.length === 0 ? (
          <p className="admin-empty">No branch-only products yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Handle</th>
                  <th>Title</th>
                  <th>Price</th>
                  <th>Badge</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {branch.map((p) => (
                  <tr key={p.id}>
                    <td className="admin-mono">{p.handle}</td>
                    <td>{p.title}</td>
                    <td>{fmtPrice(p.price_cents)}</td>
                    <td>{p.badge || "—"}</td>
                    <td>{p.active ? "Yes" : "No"}</td>
                    <td>
                      <div className="admin-btn-row">
                        <button
                          className="admin-btn secondary small"
                          onClick={() => {
                            setEditingBranch(p);
                            setShowBranchForm(false);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="admin-btn danger small"
                          onClick={() => deleteBranch(p.id, p.title)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editingBranch ? (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14 }}>Edit product — {editingBranch.title}</h3>
            <BranchForm
              initial={editingBranch}
              onDone={async () => {
                setEditingBranch(null);
                await refresh();
              }}
              onCancel={() => setEditingBranch(null)}
            />
          </div>
        ) : showBranchForm ? (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14 }}>Add branch product</h3>
            <BranchForm
              onDone={async () => {
                setShowBranchForm(false);
                await refresh();
              }}
              onCancel={() => setShowBranchForm(false)}
            />
          </div>
        ) : (
          <button
            className="admin-btn"
            style={{ marginTop: 12 }}
            onClick={() => setShowBranchForm(true)}
          >
            Add Product
          </button>
        )}
      </div>
    </>
  );
}
