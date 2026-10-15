import { AdminShell } from "../AdminShell";
import { getSettings } from "@/lib/db";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <AdminShell active="/admin/settings">
      <h1>Settings</h1>
      <p className="page-sub">Branch-wide store settings.</p>
      <SettingsClient initialSettings={settings} />
    </AdminShell>
  );
}
