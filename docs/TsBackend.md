# TypeScript backend (`shared/` + `server/`)

LiftLog's backend is being ported from .NET (`backend/`) to TypeScript, as two new packages in the
pnpm workspace: **`shared/`** (`@liftlog/shared` — crypto-shape types and Zod API contracts consumed
by both sides) and **`server/`** (`@liftlog/server` — the Hono/Drizzle/Postgres backend itself).

**`backend/` (the .NET API) stays running in production and is not touched by this work.** Nothing
in `app/`'s production configuration changes as part of this port — see "Cutover" below.

## Why this shape

- **Hono**, not Express/Fastify/NestJS: its `hc<AppType>()` client generates a type-safe RPC client
  straight from the backend's route definitions, which is what lets `app/` stop hand-mirroring DTOs.
- **Drizzle**, not Prisma/Kysely: `app/` already depends on `drizzle-orm` for its local SQLite layer.
  Reusing the same ORM family (here, Postgres via `drizzle-orm/node-postgres`) is a direct instance of
  "share as much tech as possible with the frontend."
- **Zod**, for the `shared`/`server` API-contract layer specifically. This is additive — it does
  **not** replace `app/`'s existing Ajv + `ts-json-schema-generator` pipeline used for local
  storage/migration validation (see `docs/Migrations.md`); that's a different concern (validating
  persisted on-device data against a schema derived from TS types) untouched by this work.
- A **long-running Node process** (`@hono/node-server`), not serverless — mirrors the current ASP.NET
  Core deployment model and avoids Postgres connection-pool-per-invocation problems entirely.

## Scope: what's ported, what's deferred

Everything in the .NET backend is ported **except the AI workout planner** (the two SignalR hubs,
`/ai-chat` and `/ai-chat-v2`). SignalR has no good Node server story, so rather than guess at a
replacement, that decision is written up below instead of implemented.

**Note on process:** the original plan was to file this as a GitHub issue, but Issues are disabled on
this repository (`josefrousal/liftlog`) — hence it living here instead. If Issues are ever enabled,
consider moving this section there and linking back.

### AI-chat transport decision (needed before porting the AI planner)

- **Only the V2 hub has a live client.** `app/src/services/ai-chat-service-v2.ts` is the only
  AI-chat client in `app/src` — there is no non-`-v2` `ai-chat-service` file or importer anywhere in
  the app. The V1 hub (`AiWorkoutChatHub`) appears to be dead code; confirm before dropping it.
- **`RateLimitService` (`server/src/services/rate-limit-service.ts`, ported from
  `backend/LiftLog.Api/Service/RateLimitService.cs`) is built but deliberately unwired** — same as the
  .NET original, which registers it in DI but never calls it from any controller or hub. It's clearly
  meant to gate the AI planner (limits differ by `AppStore`: 100/day Web vs 20/day RevenueCat, decided
  by `server/src/middleware/purchase-token.ts`). Whichever transport is chosen for the AI planner
  should decide whether to finally wire this in.
- **Purchase/entitlement verification is also built standalone and unattached**:
  `server/src/services/purchase-verification/` (Web shared-secret + a small hand-written RevenueCat
  fetch wrapper — not a ported Kiota client, since only one RevenueCat endpoint is actually used) and
  `server/src/middleware/purchase-token.ts` (parses `Authorization: {AppStore} {token}`). These are
  ready to mount on whatever route/hub the AI planner ends up using.

**Transport options considered:**

1. **HTTP streaming (SSE / chunked fetch)** — *recommended*. A plain POST with a streamed response
   body, the standard pattern for LLM chat apps (same idea as the Vercel AI SDK / OpenAI streaming).
   Stateless, scales horizontally, simplest to implement and test. "Stop generating" becomes a
   client-side `AbortController` instead of an RPC. Requires rewriting `ai-chat-service-v2.ts` and
   `hub-connection-factory.ts` in the app to drop `@microsoft/signalr`.
2. **Socket.IO** — keeps a persistent bidirectional socket similar in spirit to SignalR (rooms,
   reconnection built in). More moving parts (sticky sessions or a shared adapter for multi-instance
   deploys) for not much benefit here, since the actual interaction is really just request + stream.
3. **Preserve the SignalR wire protocol** — use an unofficial/community SignalR-protocol server for
   Node so the existing client code barely changes. *Not recommended* — these libraries are niche and
   poorly maintained, trading a one-time client rewrite for an ongoing protocol-compatibility risk.

## Schema parity, not a fresh design

`server/src/db/schema.ts` mirrors the **existing** Postgres schema managed by the .NET backend's EF
Core migrations (`backend/LiftLog.Api/Migrations/{UserData,RateLimit}/*`) column-for-column — no data
migration happens as part of this port. It was cross-checked by reconstructing the schema from
`UserDataContextModelSnapshot.cs`/`RateLimitContextModelSnapshot.cs` in a scratch Postgres database and
running `drizzle-kit introspect` against it; table names, columns, indexes, and foreign keys all
matched (`drizzle-kit` can't infer the `bytea` type itself, which is expected — see `db/bytea.ts`).

Until cutover, **the EF Core migrations remain the schema's source of truth**. `server/src/db/schema.ts`
is kept in sync by hand / by re-running `pnpm run db:introspect` (see `server/drizzle.config.ts`)
against the real dev database — no new `drizzle-kit` migrations are checked in yet.

The .NET backend splits this schema across two `DbContext`s / connection strings (`UserDataContext`,
`RateLimitContext`) for logical separation, but both point at the same Postgres database in every
documented deployment (see `backend/README.md`'s sample `appsettings.Development.json`). This port
uses a single Postgres client (`server/src/db/client.ts`) for both — a deliberate simplification, not
a schema difference.

**`encrypted_profile_picture`** is a live column (and was a live DTO field in the .NET API) that no
client in `app/src` reads or writes. Rather than silently keep or drop it, this was raised explicitly:
the decision was to **keep the DB column** (avoids any migration) but **drop it from the new Zod
contracts** (`shared/src/feed-api-contracts.ts`) — it's simply absent from `GetUserResponse`/
`PutUserDataRequest` on the TS side. Revisit if a client ever needs it.

## The RPC client, and what Hono does *not* do for you

`app/src/services/rpc-client.ts` wraps `hc<AppType>()` (imported as a type-only `@liftlog/server`
dependency of `app/` — verified with a throwaway spike that a type-only import is fully elided before
Metro's bundler ever sees it, so `pg`/`drizzle-orm/node-postgres` never end up in the Expo bundle).

Two behaviors are easy to assume Hono handles automatically, and doesn't:

1. **`hc()` does not run the shared Zod schemas' `.transform()` on responses.** `await res.json()`
   just gives back parsed JSON with base64 strings wherever the schema would decode to `Uint8Array`.
   `rpc-client.ts`'s `parseWireResponse()` runs the matching schema's `.parse()` explicitly.
2. **`hc()` does not encode `Uint8Array` fields to base64 before sending a request body**, and calling
   `c.json()` with a real `Uint8Array` on the server would serialize it as an index-keyed object
   (`{"0":1,"1":2,...}`), not base64. `rpc-client.ts`'s `toWireRequest()` handles the client→server
   direction (`JSON.stringify` + a `Uint8Array`-to-base64 replacer); server route handlers construct
   the base64-string "wire" shape by hand before calling `c.json()` (see e.g. `server/src/routes/user.ts`'s
   `toGetUserResponseWire`). Each Zod schema in `shared/src/feed-api-contracts.ts` exports both its
   decoded domain type (`z.infer`, used everywhere in `app/`) and, where it has binary fields, a
   `...Wire` type (`z.input`) for exactly this purpose.

`app/src/services/feed-api.ts` (`FeedApiService`) keeps its original public method signatures — only
its internals changed, from hand-rolled `fetch` + base64 mapping to `rpcClient` + the wire/domain
helpers above. `app/src/services/api-error.ts`'s `ApiResult`/`ApiErrorType`/`ResponseError` contract
is unchanged (`ResponseError` now types its `response` field as the standard `Response` interface
rather than Expo's `FetchResponse`, since it's now also constructed from Hono RPC responses — both
satisfy the `.status`/`.statusText`/`.text()` surface it actually uses).

## The `EventsController` bulk query

The perf-critical `POST /events` endpoint (`backend/LiftLog.Api/Controllers/EventsController.cs`)
used a hand-built `UNION SELECT` + `FromSqlRaw` trick to fetch events for many followed users at once
in one round trip. `server/src/routes/events.ts` replaces this with Postgres
`unnest($1::uuid[], $2::timestamptz[])` via Drizzle's `sql` template — same single-round-trip
performance, bound params instead of string-built SQL. **Use `sql.param(array)`, not a bare
`${array}` interpolation** — plain interpolation flattens a JS array into multiple comma-joined bound
parameters (fine for a `VALUES` list, wrong for a single array parameter meant for `unnest`), which
was caught by the integration tests as a "malformed array literal" error against a real Postgres
instance before it could reach production.

One behavioral note: the .NET version matches each valid follow secret's *owning* userId back to the
request entry by userId using `.Single()`, which throws (500s) if the request's userId doesn't
actually own the follow secret it sent. The TS port skips mismatched pairs instead of crashing.

## Rate limiting & purchase verification: built, not wired

`server/src/services/rate-limit-service.ts` and `server/src/services/purchase-verification/` are full
ports (with unit tests the .NET originals lacked) but aren't mounted on any route — see "AI-chat
transport decision" above for why. `server/src/middleware/purchase-token.ts` is a ready-to-attach Hono
middleware for whenever that work resumes.

## Background job

`server/src/jobs/cleanup-expired-events.ts` ports `CleanupExpiredDataHostedService.cs`: an hourly purge
of expired `user_events` rows, running in the same long-running Node process (started from
`server/src/main.ts`). `purgeExpiredEvents()` is exported separately so it can be tested directly
rather than waiting an hour in CI.

## Local development

```bash
cd backend/LiftLog.Api && docker compose up -d   # Postgres, port 5400 (existing .NET dev setup)
cd server && DATABASE_URL=postgres://postgres:password@localhost:5400/liftlog PORT=5264 pnpm dev
```

`app/src/services/api-consts.ts`'s dev URL (`http://10.0.2.2:5264` Android / `http://127.0.0.1:5264`
iOS) already points at port `5264` — the same port `server/`'s default `PORT` matches (see
`server/src/config.ts`), specifically so a locally-running TS server is a drop-in swap for the local
.NET one with **no code change needed** in `api-consts.ts`. The production `apiBaseUrl`
(`https://api.liftlog.online`) is untouched — no cutover happens as part of this work.

## Testing

`server/`'s integration tests run against a real Postgres database (env `DATABASE_URL`; CI spins up a
`postgres:17` service container on port 5401, matching `tests/docker-compose.yml`'s convention for the
.NET test suite) — routes are tested via Hono's in-process `app.request(...)`, no bound port needed.

**`vitest.config.ts` sets `fileParallelism: false`** — every integration test file shares one real
database and truncates all tables in `beforeEach` (`tests/helpers/setup.ts`); running test files in
parallel let one file's truncate wipe out data another file's test was mid-way through using. Revisit
if the reset strategy ever moves to per-test transactions instead of truncation.

## Cutover

Not part of this work. `backend/` (.NET) keeps serving `https://api.liftlog.online` until a separate,
explicit decision is made to cut over — this port only adds `server`/`shared` alongside it for local
development and testing.
