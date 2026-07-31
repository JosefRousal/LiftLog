import { index, pgTable, primaryKey, timestamp, uniqueIndex, uuid, varchar, text } from 'drizzle-orm/pg-core';
import { bytea } from './bytea';

// Mirrors the existing Postgres schema managed by the .NET backend's EF Core migrations
// (backend/LiftLog.Api/Migrations/{UserData,RateLimit}/*, snake_case via EFCore.NamingConventions).
// This is schema *parity*, not a fresh design — no data migration happens as part of this port, so
// column names/types must match exactly. See docs/TsBackend.md for the migration-ownership note:
// until cutover, the EF Core migrations remain the source of truth and this file is kept in sync by
// hand/re-introspection (`pnpm run db:introspect`), not by generating new drizzle-kit migrations.
//
// The .NET backend splits these across two DbContexts/connection strings (UserDataContext,
// RateLimitContext) for logical separation, but both point at the same Postgres database in every
// documented deployment (see backend/README.md's sample appsettings). This port uses a single
// Postgres client for both, which is a knowing simplification, not a schema difference.

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    userLookup: text('user_lookup').notNull(),
    hashedPassword: text('hashed_password').notNull(),
    lastAccessed: timestamp('last_accessed', { withTimezone: true, mode: 'date' }).notNull(),
    created: timestamp('created', { withTimezone: true, mode: 'date' }).notNull(),
    salt: bytea('salt').notNull(),
    encryptedCurrentPlan: bytea('encrypted_current_plan'),
    // Live column, kept for schema parity — no client reads or writes it (see docs/TsBackend.md).
    encryptedProfilePicture: bytea('encrypted_profile_picture'),
    encryptedName: bytea('encrypted_name'),
    encryptionIV: bytea('encryption_iv').notNull(),
    rsaPublicKey: bytea('rsa_public_key').notNull(),
  },
  (table) => [uniqueIndex('ix_users_user_lookup').on(table.userLookup)],
);

export const userEvents = pgTable(
  'user_events',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: uuid('id').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true, mode: 'date' }).notNull(),
    lastAccessed: timestamp('last_accessed', { withTimezone: true, mode: 'date' }).notNull(),
    expiry: timestamp('expiry', { withTimezone: true, mode: 'date' }).notNull(),
    // Max 15KB, enforced by the shared Zod contracts (see shared/src/feed-api-contracts.ts) —
    // Postgres bytea has no native length constraint.
    encryptedEvent: bytea('encrypted_event').notNull(),
    encryptionIV: bytea('encryption_iv').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] }), index('ix_user_events_expiry').on(table.expiry)],
);

export const userFollowSecrets = pgTable(
  'user_follow_secrets',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: varchar('value', { length: 40 }).notNull(),
  },
  (table) => [index('ix_user_follow_secrets_user_id').on(table.userId)],
);

export const userInboxItems = pgTable(
  'user_inbox_items',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    encryptedMessage: bytea('encrypted_message').array().notNull(),
  },
  (table) => [index('ix_user_inbox_items_user_id').on(table.userId)],
);

export const sharedItems = pgTable(
  'shared_items',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    timestamp: timestamp('timestamp', { withTimezone: true, mode: 'date' }).notNull(),
    expiry: timestamp('expiry', { withTimezone: true, mode: 'date' }).notNull(),
    // Max 20KB, enforced by the shared Zod contracts — see the note on userEvents above.
    encryptedPayload: bytea('encrypted_payload').notNull(),
    encryptionIV: bytea('encryption_iv').notNull(),
  },
  (table) => [index('ix_shared_items_user_id').on(table.userId)],
);

export const rateLimitConsumptions = pgTable('rate_limit_consumptions', {
  key: text('key').primaryKey(),
  requests: timestamp('requests', { withTimezone: true, mode: 'date' }).array().notNull(),
});
