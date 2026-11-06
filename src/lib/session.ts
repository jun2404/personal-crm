// Signed session cookie using Web Crypto, so it works in proxy.ts and on the server.
// Format: "<expiresAtMs>.<base64url HMAC-SHA256(expiresAtMs)>"

export const SESSION_COOKIE = "crm_session";
export const TZ_COOKIE = "crm_tz";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 90; // 90 days, so your phone stays signed in

const enc = new TextEncoder();

function getSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 16 ? s : null;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET must be set (16+ characters).");
  const expires = String(Date.now() + SESSION_MAX_AGE_S * 1000);
  return `${expires}.${await hmac(secret, expires)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expires = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, expires));
}

/** Constant-time password comparison via HMAC digests (equal length). */
export async function passwordMatches(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  const k = "crm-password-compare";
  return safeEqual(await hmac(k, input), await hmac(k, expected));
}
