import { describe, expect, it } from 'vitest';
import { base64ToBytes, base64Replacer, bytesToBase64 } from './base64';

describe('base64', () => {
  it('round-trips bytes through base64', () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 128, 42]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('round-trips an empty array', () => {
    const bytes = new Uint8Array([]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('base64Replacer encodes Uint8Array fields when used with JSON.stringify', () => {
    const json = JSON.stringify({ a: new Uint8Array([1, 2, 3]), b: 'text' }, base64Replacer);
    expect(JSON.parse(json)).toEqual({ a: bytesToBase64(new Uint8Array([1, 2, 3])), b: 'text' });
  });
});
