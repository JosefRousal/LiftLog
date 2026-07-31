import { beforeEach } from 'vitest';
import { pool } from '../../src/db/client';

beforeEach(async () => {
  await pool.query(
    'TRUNCATE TABLE user_events, user_follow_secrets, user_inbox_items, shared_items, rate_limit_consumptions, users RESTART IDENTITY CASCADE',
  );
});
