import { env } from "cloudflare:workers";

const COOKIE_NAME = "photo_journal_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const SESSION_PREFIX = 'v2';

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

async function sessionTable() {
  if(!env.DB)throw Error("Database unavailable");
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL)").run();
}

async function validSession(headers: Headers) {
  const token = cookieValue(headers, COOKIE_NAME);
  if(!token||!env.DB)return false;
  const parts=token.split(".");
  if(parts.length!==4||parts[0]!==SESSION_PREFIX)return false;
  const [version,id,expiresText,signatureText]=parts;
  if(!/^[a-f0-9]{64}$/.test(id)||!/^\d{13}$/.test(expiresText)||!(/^[a-f0-9]{64}$/.test(signatureText)))return false;
  const expires=Number(expiresText);
  if(!Number.isSafeInteger(expires)||expires<=Date.now())return false;
  try{
    const key=await hmacKey();
    const signature=hexToBytes(signatureText);
    if(!key||!signature||!(await crypto.subtle.verify("HMAC",key,signature,new TextEncoder().encode([version,id,expiresText].join(".")))))return false;
    const row=await env.DB.prepare("SELECT expires FROM admin_sessions WHERE id=?").bind(id).first<{expires:number}>();
    return row?.expires===expires;
  }catch{return false;}
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
  // Never trust externally supplied identity headers without verified assertions.
  return validSession(headers);
}

export async function createAdminSession(password: string) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET || !env.DB) return null;
  if (!(await sameSecret(password, env.ADMIN_PASSWORD))) return null;
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const key = await hmacKey();
  if (!key) return null;
  await sessionTable();
  const id=bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const payload=[SESSION_PREFIX,id,String(expires)].join(".");
  const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload));
  await env.DB.batch([
    env.DB.prepare("DELETE FROM admin_sessions WHERE expires<=?").bind(Date.now()),
    env.DB.prepare("INSERT INTO admin_sessions(id,expires) VALUES(?,?)").bind(id,expires),
  ]);
  return payload+"."+bytesToHex(new Uint8Array(signature));
}

export async function revokeAdminSession(headers:Headers){
  if(!await validSession(headers))return;
  const id=cookieValue(headers,COOKIE_NAME)!.split(".")[1];
  await env.DB!.prepare("DELETE FROM admin_sessions WHERE id=?").bind(id).run();
}

export function adminSessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
