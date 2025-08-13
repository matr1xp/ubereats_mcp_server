/**
 * Jest test setup
 */

import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.SESSION_SECRET = 'test-session-secret-for-testing';
process.env.ENCRYPTION_KEY = '82ce6d635cc50a6c118ebeaf8187af7f';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_DB = '1'; // Use different DB for tests
process.env.N8N_BASE_URL = 'http://localhost:5678';
process.env.LOG_LEVEL = 'silent';

// Mock Redis if not available in test environment
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  };
  
  return jest.fn(() => mockRedis);
});

// Mock axios for n8n service
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  }))
}));

// Increase timeout for integration tests
jest.setTimeout(30000);