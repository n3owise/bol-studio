import { timingSafeEqual } from 'node:crypto';
/** Additional owner-only gate. No database, cookies or client-side secret. */
export function pinAccepted(value: string | string[] | undefined, secret = process.env.BOL_ADMIN_PIN): boolean {
  if (!secret || typeof value !== 'string' || !/^\d{4}$/.test(value)) return false;
  const supplied = Buffer.from(value), expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
