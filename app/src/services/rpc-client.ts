import type { AppType } from '@liftlog/server';
import { base64Replacer } from '@liftlog/shared';
import { hc } from 'hono/client';
import { fetch } from 'expo/fetch';
import { apiBaseUrl } from './api-consts';

// Hono's `hc<AppType>()` gives us a typed client generated straight from the backend's own route
// definitions — no more hand-mirrored DTOs (see @liftlog/shared's feed-api-contracts.ts for those
// on the backend side). Two things it does NOT do, though (see docs/TsBackend.md on the backend
// side for the full writeup):
//   1. It does not run the shared Zod schemas' `.transform()` on responses — `.json()` just gives
//      back parsed JSON with base64 strings where the schema would decode to Uint8Array. Callers
//      must run the matching schema's `.parse()` themselves (see `parseWireResponse` below).
//   2. It does not encode Uint8Array fields to base64 before sending a request body — `toWireRequest`
//      does that (mirroring the transform direction in reverse, plain JSON.stringify + a replacer).
export const rpcClient = hc<AppType>(apiBaseUrl, { fetch });

export function toWireRequest<TWire>(value: unknown): TWire {
  return JSON.parse(JSON.stringify(value, base64Replacer)) as TWire;
}

export async function parseWireResponse<T>(response: Response, schema: { parse: (value: unknown) => T }): Promise<T> {
  return schema.parse(await response.json());
}
