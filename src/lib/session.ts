// Signed session cookie using Web Crypto, so it works in proxy.ts and on the server.
// Format: "<userId>.<expiresAtMs>.<base64url HMAC-SHA256("<userId>.<expiresAtMs>")>"

export const SESSION_COOKIE = "crm_session";
export const TZ_COOKIE = "crm_tz";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 90; // 90 days, so your phone stays signed in

const enc = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function createSessionToken(userId: string): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET must be set (16+ characters).");
  if (!UUID_RE.test(userId)) throw new Error("Invalid user id.");
  const payload = `${userId}.${Date.now() + SESSION_MAX_AGE_S * 1000}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

/** Returns the signed-in user's id, or null if the token is missing, expired or forged. */
export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, sig] = parts;
  if (!UUID_RE.test(userId) || !/^\d+$/.test(expires) || Number(expires) < Date.now()) return null;
  return safeEqual(sig, await hmac(secret, `${userId}.${expires}`)) ? userId : null;
}

/**
 * Checks the old single-user APP_PASSWORD (constant time, via HMAC digests of equal length).
 * Only used to let the original owner move their existing contacts into a new account.
 */
export async function legacyPasswordMatches(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  const k = "crm-password-compare";
  return safeEqual(await hmac(k, input), await hmac(k, expected));
}
