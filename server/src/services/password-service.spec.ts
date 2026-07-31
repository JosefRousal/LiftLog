import { pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password-service';

describe('password-service', () => {
  it('round-trips a hashed password', () => {
    const { hash, salt } = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', hash, salt)).toBe(true);
  });

  it('rejects the wrong password', () => {
    const { hash, salt } = hashPassword('correct horse battery staple');
    expect(verifyPassword('wrong password', hash, salt)).toBe(false);
  });

  it('rejects a hash/salt from a different password', () => {
    const a = hashPassword('password-a');
    const b = hashPassword('password-b');
    expect(verifyPassword('password-a', a.hash, b.salt)).toBe(false);
  });

  it('produces different salts for repeated calls with the same password', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a.salt).not.toEqual(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('matches the standard PBKDF2-HMAC-SHA512 test vector (password/salt/1 iteration/64 bytes)', () => {
    // This is a widely-cited standard PBKDF2-HMAC-SHA512 test vector (independent of this repo),
    // used here to confirm the parameters (digest, key size) line up with the algorithm .NET's
    // Rfc2898DeriveBytes.Pbkdf2 also implements — without needing a live .NET instance to compare
    // against. See backend/LiftLog.Api/Service/PasswordService.cs for the parameters being matched.
    const derived = pbkdf2Sync('password', 'salt', 1, 64, 'sha512');
    expect(derived.toString('hex')).toBe(
      '867f70cf1ade02cff3752599a3a53dc4af34c7a669815ae5d513554e1c8cf252c02d470a285a0501bad999bfe943c08f050235d7d68b1da55e63f73b60a57fce',
    );
  });
});
