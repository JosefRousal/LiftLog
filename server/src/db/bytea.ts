import { customType } from 'drizzle-orm/pg-core';

/**
 * Postgres `bytea` column, mapped to/from Uint8Array. node-postgres returns bytea values as
 * Node `Buffer` (which is a Uint8Array subclass) and accepts Buffer/Uint8Array on the way in.
 */
export const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Uint8Array): Buffer {
    return Buffer.from(value);
  },
  fromDriver(value: Buffer): Uint8Array {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  },
});
