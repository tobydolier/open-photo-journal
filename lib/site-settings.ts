import { env } from "cloudflare:workers";

export const editableSettingLimits = {
  siteName: 80,
  siteDescription: 180,
  profileName: 80,
  profileHandle: 40,
  profileBio: 240,
  profileInitial: 2,
  eyebrow: 80,
  visibilityLabel: 40,
} as const;

export type EditableSettingKey = keyof typeof editableSettingLimits;

export async function ensureSiteSettingsTable() {
  await env.DB!.prepare(
    "CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
  ).run();
}

export async function getSiteSettings() {
  await ensureSiteSettingsTable();
  const result = await env.DB!.prepare("SELECT key, value FROM site_settings").all<{ key: string; value: string }>();
  return Object.fromEntries(result.results.map(row => [row.key, row.value]));
}

export async function saveSiteSettings(values: Partial<Record<EditableSettingKey | "profileImageVersion", string>>) {
  await ensureSiteSettingsTable();
  const entries = Object.entries(values);
  if (!entries.length) return;
  await env.DB!.batch(entries.map(([key, value]) => (
    env.DB!.prepare(
      "INSERT INTO site_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).bind(key, value)
  )));
}

export async function deleteSiteSetting(key: EditableSettingKey | "profileImageVersion") {
  await ensureSiteSettingsTable();
  await env.DB!.prepare("DELETE FROM site_settings WHERE key=?").bind(key).run();
}
