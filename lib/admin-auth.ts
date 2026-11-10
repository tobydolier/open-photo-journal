import { env } from "cloudflare:workers";

const COOKIE_NAME = "photo_journal_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function cookieValue(headers: Headers, name: string) {
  const cookie = headers.get("cookie") || "";
  for (const item of cookie.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2) return null;
  return new Uint8Array(value.match(/.{2}/g)!.map(byte => Number.parseInt(byte, 16)));
}

async function hmacKey() {
  if (!env.ADMIN_SESSION_SECRET) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.ADMIN_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function validSession(headers: Headers) {
  const token = cookieValue(headers, COOKIE_NAME);
  const key = await hmacKey();
  if (!token || !key) return false;
  const [expiresText, signatureText] = token.split(".");
  const expires = Number(expiresText);
  const signature = signatureText && hexToBytes(signatureText);
  if (!Number.isSafeInteger(expires) || expires <= Date.now() || !signature) return false;
  return crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(expiresText));
}

async function sameSecret(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    mismatch |= (a[index] || 0) ^ (b[index] || 0);
  }
  return mismatch === 0;
}

export async function isAdminRequest(headers: Headers) {
  const configuredEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
  const authenticatedEmail = (
    headers.get("oai-authenticated-user-email") ||
    headers.get("cf-access-authenticated-user-email") ||
    ""
  ).trim().toLowerCase();

  if (configuredEmail && authenticatedEmail && configuredEmail === authenticatedEmail) return true;
  return validSession(headers);
}

export async function createAdminSession(password: string) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) return null;
  if (!(await sameSecret(password, env.ADMIN_PASSWORD))) return null;
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const key = await hmacKey();
  if (!key) return null;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(expires)));
  return `${expires}.${bytesToHex(new Uint8Array(signature))}`;
}

export function adminSessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
