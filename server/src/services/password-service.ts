import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

// Port of backend/LiftLog.Api/Service/PasswordService.cs. PBKDF2 is a standard, cross-implementation
// algorithm — matching these parameters exactly (iterations, key size, digest) means Node's
// `crypto.pbkdf2Sync` produces byte-identical output to .NET's `Rfc2898DeriveBytes.Pbkdf2`, so
// existing stored password hashes keep verifying correctly against this backend.
const KEY_SIZE_BYTES = 64;
const ITERATIONS = 350_000;
const DIGEST = 'sha512';

export function hashPassword(password: string): { hash: string; salt: Uint8Array } {
  const salt = randomBytes(KEY_SIZE_BYTES);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_SIZE_BYTES, DIGEST);
  return { hash: hash.toString('hex'), salt: new Uint8Array(salt) };
}

export function verifyPassword(password: string, hash: string, salt: Uint8Array): boolean {
  const hashToCompare = pbkdf2Sync(password, Buffer.from(salt), ITERATIONS, KEY_SIZE_BYTES, DIGEST);
  const expected = Buffer.from(hash, 'hex');
  if (hashToCompare.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(hashToCompare, expected);
}
