import { env } from "cloudflare:workers";

export type PublicSiteConfig = {
  siteName: string;
  siteDescription: string;
  profileName: string;
  profileHandle: string;
  profileBio: string;
  profileInitial: string;
  eyebrow: string;
  visibilityLabel: string;
  locale: string;
  storageLimitBytes: number;
  wordmarkImageUrl: string;
  profileImageUrl: string;
  faviconUrl: string;
  shareImageUrl: string;
  isAdmin: boolean;
  passwordLoginEnabled: boolean;
};

function text(value: string | undefined, fallback: string, max = 120) {
  const clean = value?.trim();
  return (clean || fallback).slice(0, max);
}

function assetUrl(value: string | undefined) {
  const clean = value?.trim();
  if (!clean) return "";
  if (clean.startsWith("/") && !clean.startsWith("//")) return clean.slice(0, 500);
  try {
    const url = new URL(clean);
    return url.protocol === "https:" ? clean.slice(0, 500) : "";
  } catch {
    return "";
  }
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getPublicSiteConfig(): Omit<PublicSiteConfig, "isAdmin" | "passwordLoginEnabled"> {
  const handle = text(env.PROFILE_HANDLE, "photographer", 40).replace(/^@+/, "");
  const profileName = text(env.PROFILE_NAME, "Photo journal owner", 80);

  return {
    siteName: text(env.SITE_NAME, "Open Photo Journal", 80),
    siteDescription: text(env.SITE_DESCRIPTION, "A personal, self-hosted photo journal.", 180),
    profileName,
    profileHandle: handle,
    profileBio: text(env.PROFILE_BIO, "Little moments. Big memories.", 240),
    profileInitial: text(env.PROFILE_INITIAL, profileName.charAt(0).toLowerCase() || "p", 2),
    eyebrow: text(env.SITE_EYEBROW, "PERSONAL PHOTO JOURNAL", 80),
    visibilityLabel: text(env.VISIBILITY_LABEL, "Photo journal", 40),
    locale: text(env.SITE_LOCALE, "en-GB", 20),
    storageLimitBytes: positiveNumber(env.STORAGE_LIMIT_BYTES, 8_000_000_000),
    wordmarkImageUrl: assetUrl(env.WORDMARK_IMAGE_URL),
    profileImageUrl: assetUrl(env.PROFILE_IMAGE_URL),
    faviconUrl: assetUrl(env.FAVICON_URL),
    shareImageUrl: assetUrl(env.SHARE_IMAGE_URL),
  };
}

export function hasPasswordLogin() {
  return Boolean(env.ADMIN_PASSWORD && env.ADMIN_SESSION_SECRET);
}
