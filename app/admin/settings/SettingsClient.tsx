"use client";

import { useState } from "react";

const FIELDS: Array<{
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}> = [
  { key: "store_name", label: "Store name" },
  { key: "whatsapp_number", label: "WhatsApp number" },
  { key: "notice_en", label: "Entry notice — English", multiline: true },
  { key: "notice_ja", label: "Entry notice — Japanese", multiline: true },
];

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

export default function SettingsClient({
  initialSettings,
}: {
  initialSettings: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialSettings);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(key: string) {
    setSaving((s) => ({ ...s, [key]: true }));
    setError(null);
    try {
      await api("/api/admin/settings", "PUT", {
        key,
        value: values[key] ?? "",
      });
      setNotice("Setting saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  async function saveAll() {
    setError(null);
    try {
      for (const f of FIELDS) {
        await api("/api/admin/settings", "PUT", {
          key: f.key,
          value: values[f.key] ?? "",
        });
      }
      setNotice("All settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
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
        <h2>Store settings</h2>
        <p style={{ color: "#666", marginTop: -6 }}>
          These values drive the branch storefront (entry notice, WhatsApp
          checkout number, store name).
        </p>
        <div className="admin-form">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`set-${f.key}`}>{f.label}</label>
              {f.multiline ? (
                <textarea
                  id={`set-${f.key}`}
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  placeholder={f.placeholder}
                />
              ) : (
                <input
                  id={`set-${f.key}`}
                  type="text"
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  placeholder={f.placeholder}
                />
              )}
              <div style={{ marginTop: 6 }}>
                <button
                  className="admin-btn small secondary"
                  disabled={!!saving[f.key]}
                  onClick={() => save(f.key)}
                >
                  {saving[f.key] ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ))}
          <div>
            <button className="admin-btn" onClick={saveAll}>
              Save all
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
