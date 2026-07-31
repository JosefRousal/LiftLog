import { createTestApp } from './app-factory';

export interface TestUser {
  id: string;
  lookup: string;
  password: string;
}

export async function createTestUser(): Promise<TestUser> {
  const app = createTestApp();
  const res = await app.request('/user/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return (await res.json()) as TestUser;
}
