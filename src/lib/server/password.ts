import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Stored as "scrypt$<N>$<salt base64>$<hash base64>".
const N = 16384;
const KEYLEN = 64;

function derive(password: string, salt: Buffer, n: number): Promise<Buffer> {
  const opts: ScryptOptions = { N: n, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, N);
  return `scrypt$${N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), Number(n));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Same work as a real check, so "no such email" and "wrong password" take equally long. */
const DUMMY = `scrypt$${N}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEYLEN).toString("base64")}`;
export async function burnPasswordCheck(password: string): Promise<void> {
  await verifyPassword(password, DUMMY);
}
