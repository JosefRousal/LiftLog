import { init } from '@paralleldrive/cuid2';

// The .NET backend uses `new Cuid2(12)` (Visus.Cuid) for user lookups and shared item ids —
// a 12-character id. Match that length here.
export const createShortId = init({ length: 12 });
