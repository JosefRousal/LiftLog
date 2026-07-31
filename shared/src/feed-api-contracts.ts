import { z } from 'zod';
import { base64ToBytes } from './base64';

// Zod contracts for the LiftLog feed/user API, shared between the `server` backend and the
// `app` frontend. Each schema's *input* type (`z.input<...>`) is the wire shape that actually
// crosses JSON (binary fields are base64 strings) — this is what server route handlers must
// construct before calling `c.json()`, since Hono does not run these transforms on the way out.
// Each schema's *output* type (`z.infer<...>`) is the decoded domain shape (binary fields are
// `Uint8Array`) — this is what `.parse()` produces, on the server after `@hono/zod-validator`
// parses a request body, and on the client after the RPC wrapper parses a response body.
//
// Ported from backend/LiftLog.Lib/Models/{UserRequests,ShareRequests}.cs and the FluentValidation
// rules in backend/LiftLog.Api/Validators/{UserRequestValidators,SharedItemRequestValidators}.cs.
// Postgres does not enforce these size limits (bytea has no native length constraint) — these
// schemas are the real source of truth for them.

const KB = 1024;

function zBase64Bytes(options?: { maxBytes?: number; exactBytes?: number }) {
  return z.string().transform((value, ctx) => {
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid base64' });
      return z.NEVER;
    }
    if (options?.exactBytes !== undefined && bytes.length !== options.exactBytes) {
      ctx.addIssue({ code: 'custom', message: `Expected exactly ${options.exactBytes} bytes` });
      return z.NEVER;
    }
    if (options?.maxBytes !== undefined && bytes.length > options.maxBytes) {
      ctx.addIssue({ code: 'custom', message: `Expected at most ${options.maxBytes} bytes` });
      return z.NEVER;
    }
    return bytes;
  });
}

function zOptionalBase64Bytes(options?: { maxBytes?: number }) {
  return zBase64Bytes(options)
    .nullable()
    .optional()
    .transform((value) => value ?? undefined);
}

// Password is checked against a per-user PBKDF2 hash server-side (see password-service.ts); the
// max length here just mirrors the FluentValidation rules that had one (not every endpoint did).
const zPassword = (maxLength?: number) => (maxLength ? z.string().min(1).max(maxLength) : z.string().min(1));

// ─── Encryption value shapes (wire versions of shared/src/encryption-models.ts) ────────────────

// The decoded (output) shape of these two schemas is structurally identical to the
// `RsaPublicKey`/`AesEncryptedAndRsaSignedData` interfaces in ./encryption-models — reuse those
// type names rather than re-declaring them here.

export const RsaPublicKeySchema = z.object({
  spkiPublicKeyBytes: zBase64Bytes(),
});

export const AesIVSchema = z.object({
  value: zBase64Bytes({ exactBytes: 16 }),
});

export const AesEncryptedAndRsaSignedDataSchema = z.object({
  encryptedPayload: zBase64Bytes({ maxBytes: 20 * KB }),
  iv: AesIVSchema,
});

// ─── User ───────────────────────────────────────────────────────────────────────────────────────

export const CreateUserRequestSchema = z.object({});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export const CreateUserResponseSchema = z.object({
  id: z.string(),
  lookup: z.string(),
  password: z.string(),
});
export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;

// `encryptedProfilePicture` is intentionally omitted: the DB/legacy .NET DTOs still carry it, but
// no client reads or writes it, so it's dropped from the new contracts (see docs/TsBackend.md).
export const GetUserResponseSchema = z.object({
  id: z.string(),
  lookup: z.string(),
  encryptedCurrentPlan: zOptionalBase64Bytes({ maxBytes: 15 * KB }),
  encryptedName: zOptionalBase64Bytes({ maxBytes: 2 * KB }),
  encryptionIV: zBase64Bytes(),
  rsaPublicKey: zBase64Bytes(),
});
export type GetUserResponse = z.infer<typeof GetUserResponseSchema>;
export type GetUserResponseWire = z.input<typeof GetUserResponseSchema>;

export const PutUserDataRequestSchema = z.object({
  id: z.string(),
  password: zPassword(),
  encryptedCurrentPlan: zOptionalBase64Bytes({ maxBytes: 15 * KB }),
  encryptedName: zOptionalBase64Bytes({ maxBytes: 2 * KB }),
  encryptionIV: zBase64Bytes(),
  rsaPublicKey: zBase64Bytes(),
});
export type PutUserDataRequest = z.infer<typeof PutUserDataRequestSchema>;
export type PutUserDataRequestWire = z.input<typeof PutUserDataRequestSchema>;

export const DeleteUserRequestSchema = z.object({
  id: z.string(),
  password: zPassword(40),
});
export type DeleteUserRequest = z.infer<typeof DeleteUserRequestSchema>;

export const GetUsersRequestSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
});
export type GetUsersRequest = z.infer<typeof GetUsersRequestSchema>;

export const GetUsersResponseSchema = z.object({
  users: z.record(z.string(), GetUserResponseSchema),
});
export type GetUsersResponse = z.infer<typeof GetUsersResponseSchema>;
export type GetUsersResponseWire = z.input<typeof GetUsersResponseSchema>;

// ─── Events ─────────────────────────────────────────────────────────────────────────────────────

export const PutUserEventRequestSchema = z.object({
  userId: z.string(),
  password: zPassword(),
  eventId: z.string(),
  encryptedEventPayload: zBase64Bytes({ maxBytes: 15 * KB }),
  encryptedEventIV: zBase64Bytes({ maxBytes: 16 }),
  expiry: z.string(),
});
export type PutUserEventRequest = z.infer<typeof PutUserEventRequestSchema>;
export type PutUserEventRequestWire = z.input<typeof PutUserEventRequestSchema>;

export const GetUserEventRequestSchema = z.object({
  userId: z.string(),
  followSecret: z.string(),
  since: z.string(),
});
export type GetUserEventRequest = z.infer<typeof GetUserEventRequestSchema>;

export const GetEventsRequestSchema = z.object({
  users: z.array(GetUserEventRequestSchema).min(1).max(200),
});
export type GetEventsRequest = z.infer<typeof GetEventsRequestSchema>;

export const UserEventResponseSchema = z.object({
  userId: z.string(),
  eventId: z.string(),
  timestamp: z.string(),
  encryptedEventPayload: zBase64Bytes(),
  encryptedEventIV: zBase64Bytes(),
  expiry: z.string(),
});
export type UserEventResponse = z.infer<typeof UserEventResponseSchema>;
export type UserEventResponseWire = z.input<typeof UserEventResponseSchema>;

export const GetEventsResponseSchema = z.object({
  events: z.array(UserEventResponseSchema),
  invalidFollowSecrets: z.array(z.string()),
});
export type GetEventsResponse = z.infer<typeof GetEventsResponseSchema>;
export type GetEventsResponseWire = z.input<typeof GetEventsResponseSchema>;

// ─── Inbox ──────────────────────────────────────────────────────────────────────────────────────

export const PutInboxMessageRequestSchema = z.object({
  toUserId: z.string(),
  encryptedMessage: z.array(zBase64Bytes({ maxBytes: 1 * KB })).min(1).max(20),
});
export type PutInboxMessageRequest = z.infer<typeof PutInboxMessageRequestSchema>;
export type PutInboxMessageRequestWire = z.input<typeof PutInboxMessageRequestSchema>;

export const GetInboxMessagesRequestSchema = z.object({
  userId: z.string(),
  password: zPassword(40),
});
export type GetInboxMessagesRequest = z.infer<typeof GetInboxMessagesRequestSchema>;

export const GetInboxMessageResponseSchema = z.object({
  id: z.string(),
  encryptedMessage: z.array(zBase64Bytes()),
});
export type GetInboxMessageResponse = z.infer<typeof GetInboxMessageResponseSchema>;
export type GetInboxMessageResponseWire = z.input<typeof GetInboxMessageResponseSchema>;

export const GetInboxMessagesResponseSchema = z.object({
  inboxMessages: z.array(GetInboxMessageResponseSchema),
});
export type GetInboxMessagesResponse = z.infer<typeof GetInboxMessagesResponseSchema>;
export type GetInboxMessagesResponseWire = z.input<typeof GetInboxMessagesResponseSchema>;

// ─── Follow secrets ─────────────────────────────────────────────────────────────────────────────

export const PutUserFollowSecretRequestSchema = z.object({
  userId: z.string(),
  password: zPassword(40),
  followSecret: z.string().min(1).max(40),
});
export type PutUserFollowSecretRequest = z.infer<typeof PutUserFollowSecretRequestSchema>;

export const DeleteUserFollowSecretRequestSchema = z.object({
  userId: z.string(),
  password: zPassword(40),
  followSecret: z.string().min(1).max(40),
});
export type DeleteUserFollowSecretRequest = z.infer<typeof DeleteUserFollowSecretRequestSchema>;

// ─── Shared items ───────────────────────────────────────────────────────────────────────────────

export const CreateSharedItemRequestSchema = z.object({
  userId: z.string(),
  password: zPassword(40),
  encryptedPayload: AesEncryptedAndRsaSignedDataSchema,
  expiry: z.string(),
});
export type CreateSharedItemRequest = z.infer<typeof CreateSharedItemRequestSchema>;
export type CreateSharedItemRequestWire = z.input<typeof CreateSharedItemRequestSchema>;

export const CreateSharedItemResponseSchema = z.object({
  id: z.string(),
});
export type CreateSharedItemResponse = z.infer<typeof CreateSharedItemResponseSchema>;

export const GetSharedItemResponseSchema = z.object({
  rsaPublicKey: RsaPublicKeySchema,
  encryptedPayload: AesEncryptedAndRsaSignedDataSchema,
});
export type GetSharedItemResponse = z.infer<typeof GetSharedItemResponseSchema>;
export type GetSharedItemResponseWire = z.input<typeof GetSharedItemResponseSchema>;
