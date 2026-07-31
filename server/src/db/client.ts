import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as schema from './schema';

// A long-running Node process (not serverless — see docs/TsBackend.md) holds a single pooled
// connection for its lifetime, mirroring the ASP.NET Core deployment model.
export const pool = new Pool({ connectionString: config.databaseUrl });

export const db = drizzle(pool, { schema });

export type Db = typeof db;
