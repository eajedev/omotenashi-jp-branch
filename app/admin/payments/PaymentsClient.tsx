"use client";

import { useState } from "react";

interface Method {
  id: number;
  key: string;
  name: string;
  enabled: boolean;
  details: string | null;
  sort_order: number;
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

export default function PaymentsClient({
  initialMethods,
}: {
  initialMethods: Method[];
}) {
  const [methods, setMethods] = useState(initialMethods);
  const [drafts, setDrafts] = useState<Record<number, string>>(() => {
    const d: Record<number, string> = {};
    for (const m of initialMethods) d[m.id] = m.details ?? "";
    return d;
  });
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(id: number, enabled: boolean, details: string) {
    setSaving((s) => ({ ...s, [id]: true }));
    setError(null);
    try {
      await api("/api/admin/payments", "PUT", {
        id,
        enabled,
        details: details.trim() || null,
      });
      setMethods((ms) =>
        ms.map((m) =>
          m.id === id ? { ...m, enabled, details: details.trim() || null } : m
        )
      );
      setNotice("Payment method saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
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
        <h2>Payment methods</h2>
        <p style={{ color: "#666", marginTop: -6 }}>
          Toggle which methods customers can pick at checkout. The details
          field holds account info shown to staff (not published publicly).
        </p>
        {methods.length === 0 ? (
          <p className="admin-empty">No payment methods configured.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Details</th>
                  <th>Enabled</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.name}</strong>
                      <div className="admin-mono" style={{ color: "#888" }}>
                        {m.key}
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={drafts[m.id] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [m.id]: e.target.value }))
                        }
                        placeholder="Account info / instructions"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          border: "1px solid #d4d4d4",
                          borderRadius: 6,
                          fontSize: 14,
                          fontFamily: "inherit",
                        }}
                      />
                    </td>
                    <td>
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={async (e) => {
                            const next = e.target.checked;
                            setMethods((ms) =>
                              ms.map((x) =>
                                x.id === m.id ? { ...x, enabled: next } : x
                              )
                            );
                            await save(m.id, next, drafts[m.id] ?? "");
                          }}
                        />
                        {m.enabled ? "On" : "Off"}
                      </label>
                    </td>
                    <td>
                      <button
                        className="admin-btn small"
                        disabled={!!saving[m.id]}
                        onClick={() =>
                          save(m.id, m.enabled, drafts[m.id] ?? "")
                        }
                      >
                        {saving[m.id] ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
