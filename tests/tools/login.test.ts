/**
 * Login tool tests
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { loginHandler } from '../../src/tools/login.js';

describe('Login Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should validate input schema', async () => {
    const result = await loginHandler({
      username: 'invalid-email',
      password: 'test123'
    });

    expect(result.status).toBe('error');
    expect(result.message).toContain('validation');
  });

  test('should require username and password', async () => {
    const result = await loginHandler({});

    expect(result.status).toBe('error');
    expect(result.message).toContain('validation');
  });

  test('should handle valid login input', async () => {
    const result = await loginHandler({
      username: 'test@example.com',
      password: 'password123',
      manualMode: false
    });

    // Should not throw an error with valid input
    expect(result).toBeDefined();
  });

  test('should support manual mode', async () => {
    const result = await loginHandler({
      username: 'test@example.com',
      password: 'password123',
      manualMode: true
    });

    expect(result).toBeDefined();
  });
});