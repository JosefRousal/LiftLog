import { describe, expect, it } from 'vitest';
import { bytesToBase64 } from './base64';
import {
  AesEncryptedAndRsaSignedDataSchema,
  CreateSharedItemRequestSchema,
  GetInboxMessagesResponseSchema,
  GetUserResponseSchema,
  GetUsersRequestSchema,
  PutInboxMessageRequestSchema,
  PutUserDataRequestSchema,
  PutUserEventRequestSchema,
} from './feed-api-contracts';

function bytesOf(length: number): Uint8Array {
  return new Uint8Array(length).fill(1);
}

describe('feed-api-contracts', () => {
  it('decodes GetUserResponse base64 fields into Uint8Array', () => {
    const wire = {
      id: 'abc',
      lookup: 'xyz',
      encryptedCurrentPlan: bytesToBase64(bytesOf(4)),
      encryptedName: undefined,
      encryptionIV: bytesToBase64(bytesOf(16)),
      rsaPublicKey: bytesToBase64(bytesOf(32)),
    };

    const result = GetUserResponseSchema.parse(wire);

    expect(result.encryptedCurrentPlan).toEqual(bytesOf(4));
    expect(result.encryptedName).toBeUndefined();
    expect(result.encryptionIV).toEqual(bytesOf(16));
  });

  it('treats a null optional field the same as an omitted one', () => {
    const wire = {
      id: 'abc',
      lookup: 'xyz',
      encryptedCurrentPlan: null,
      encryptedName: null,
      encryptionIV: bytesToBase64(bytesOf(16)),
      rsaPublicKey: bytesToBase64(bytesOf(32)),
    };

    const result = GetUserResponseSchema.parse(wire);

    expect(result.encryptedCurrentPlan).toBeUndefined();
    expect(result.encryptedName).toBeUndefined();
  });

  it('rejects an encrypted plan over the 15KB limit', () => {
    const result = PutUserDataRequestSchema.safeParse({
      id: 'abc',
      password: 'pw',
      encryptedCurrentPlan: bytesToBase64(bytesOf(15 * 1024 + 1)),
      encryptedName: undefined,
      encryptionIV: bytesToBase64(bytesOf(16)),
      rsaPublicKey: bytesToBase64(bytesOf(32)),
    });

    expect(result.success).toBe(false);
  });

  it('accepts an encrypted plan exactly at the 15KB limit', () => {
    const result = PutUserDataRequestSchema.safeParse({
      id: 'abc',
      password: 'pw',
      encryptedCurrentPlan: bytesToBase64(bytesOf(15 * 1024)),
      encryptedName: undefined,
      encryptionIV: bytesToBase64(bytesOf(16)),
      rsaPublicKey: bytesToBase64(bytesOf(32)),
    });

    expect(result.success).toBe(true);
  });

  it('rejects a PutUserEventRequest with an oversized event payload', () => {
    const result = PutUserEventRequestSchema.safeParse({
      userId: 'user-1',
      password: 'pw',
      eventId: 'event-1',
      encryptedEventPayload: bytesToBase64(bytesOf(15 * 1024 + 1)),
      encryptedEventIV: bytesToBase64(bytesOf(16)),
      expiry: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });

  it('rejects GetUsersRequest with more than 200 ids', () => {
    const result = GetUsersRequestSchema.safeParse({
      ids: Array.from({ length: 201 }, (_, i) => `id-${i}`),
    });

    expect(result.success).toBe(false);
  });

  it('rejects GetUsersRequest with zero ids', () => {
    const result = GetUsersRequestSchema.safeParse({ ids: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an inbox message with more than 20 chunks', () => {
    const result = PutInboxMessageRequestSchema.safeParse({
      toUserId: 'user-1',
      encryptedMessage: Array.from({ length: 21 }, () => bytesToBase64(bytesOf(1))),
    });

    expect(result.success).toBe(false);
  });

  it('rejects an inbox message chunk over 1KB', () => {
    const result = PutInboxMessageRequestSchema.safeParse({
      toUserId: 'user-1',
      encryptedMessage: [bytesToBase64(bytesOf(1024 + 1))],
    });

    expect(result.success).toBe(false);
  });

  it('decodes a well-formed GetInboxMessagesResponse', () => {
    const result = GetInboxMessagesResponseSchema.parse({
      inboxMessages: [{ id: 'msg-1', encryptedMessage: [bytesToBase64(bytesOf(10))] }],
    });

    expect(result.inboxMessages[0]?.encryptedMessage[0]).toEqual(bytesOf(10));
  });

  it('requires the shared-item IV to be exactly 16 bytes', () => {
    const tooShort = AesEncryptedAndRsaSignedDataSchema.safeParse({
      encryptedPayload: bytesToBase64(bytesOf(4)),
      iv: { value: bytesToBase64(bytesOf(15)) },
    });
    const exact = AesEncryptedAndRsaSignedDataSchema.safeParse({
      encryptedPayload: bytesToBase64(bytesOf(4)),
      iv: { value: bytesToBase64(bytesOf(16)) },
    });

    expect(tooShort.success).toBe(false);
    expect(exact.success).toBe(true);
  });

  it('rejects a shared item payload over 20KB', () => {
    const result = CreateSharedItemRequestSchema.safeParse({
      userId: 'user-1',
      password: 'pw',
      encryptedPayload: {
        encryptedPayload: bytesToBase64(bytesOf(20 * 1024 + 1)),
        iv: { value: bytesToBase64(bytesOf(16)) },
      },
      expiry: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid base64', () => {
    const result = PutUserDataRequestSchema.safeParse({
      id: 'abc',
      password: 'pw',
      encryptionIV: 'not-valid-base64!!!',
      rsaPublicKey: bytesToBase64(bytesOf(32)),
    });

    expect(result.success).toBe(false);
  });
});
