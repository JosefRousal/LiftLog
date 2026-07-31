import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../config';
import { isValidWebAuthToken } from './web-auth';

describe('web-auth purchase verification', () => {
  afterEach(() => {
    delete process.env.WEB_AUTH_API_KEY;
  });

  it('denies all requests when no key is configured', () => {
    expect(config.webAuthApiKey).toBeUndefined();
    expect(isValidWebAuthToken('anything')).toBe(false);
  });

  it('accepts a token matching the configured key', () => {
    process.env.WEB_AUTH_API_KEY = 'test-web-auth-key-12345';
    expect(isValidWebAuthToken('test-web-auth-key-12345')).toBe(true);
  });

  it('rejects a token not matching the configured key', () => {
    process.env.WEB_AUTH_API_KEY = 'test-web-auth-key-12345';
    expect(isValidWebAuthToken('wrong-key')).toBe(false);
  });
});
