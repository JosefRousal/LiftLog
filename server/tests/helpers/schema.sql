-- Bootstraps the test database with the same schema as server/src/db/schema.ts.
-- This mirrors the .NET backend's EF Core migrations (see backend/LiftLog.Api/Migrations/UserData/
-- UserDataContextModelSnapshot.cs) rather than being generated from drizzle-kit — no drizzle-kit
-- migrations are checked in yet, see docs/TsBackend.md.

DROP TABLE IF EXISTS user_events, user_follow_secrets, user_inbox_items, shared_items, rate_limit_consumptions, users CASCADE;

CREATE TABLE users (
  id uuid NOT NULL,
  created timestamptz NOT NULL,
  encrypted_current_plan bytea NULL,
  encrypted_name bytea NULL,
  encrypted_profile_picture bytea NULL,
  encryption_iv bytea NOT NULL,
  hashed_password text NOT NULL,
  last_accessed timestamptz NOT NULL,
  rsa_public_key bytea NOT NULL,
  salt bytea NOT NULL,
  user_lookup text NOT NULL,
  CONSTRAINT pk_users PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_users_user_lookup ON users (user_lookup);

CREATE TABLE user_events (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  encrypted_event bytea NOT NULL,
  encryption_iv bytea NOT NULL,
  expiry timestamptz NOT NULL,
  last_accessed timestamptz NOT NULL,
  timestamp timestamptz NOT NULL,
  CONSTRAINT pk_user_events PRIMARY KEY (user_id, id),
  CONSTRAINT fk_user_events_users_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_user_events_expiry ON user_events (expiry);

CREATE TABLE user_follow_secrets (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  value character varying(40) NOT NULL,
  CONSTRAINT pk_user_follow_secrets PRIMARY KEY (id),
  CONSTRAINT fk_user_follow_secrets_users_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_user_follow_secrets_user_id ON user_follow_secrets (user_id);

CREATE TABLE user_inbox_items (
  id uuid NOT NULL,
  encrypted_message bytea[] NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT pk_user_inbox_items PRIMARY KEY (id),
  CONSTRAINT fk_user_inbox_items_users_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_user_inbox_items_user_id ON user_inbox_items (user_id);

CREATE TABLE shared_items (
  id text NOT NULL,
  encrypted_payload bytea NOT NULL,
  encryption_iv bytea NOT NULL,
  expiry timestamptz NOT NULL,
  timestamp timestamptz NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT pk_shared_items PRIMARY KEY (id),
  CONSTRAINT fk_shared_items_users_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_shared_items_user_id ON shared_items (user_id);

CREATE TABLE rate_limit_consumptions (
  key text NOT NULL,
  requests timestamptz[] NOT NULL,
  CONSTRAINT pk_rate_limit_consumptions PRIMARY KEY (key)
);
