/**
 * Environment Configuration
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5001'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().length(32, 'Encryption key must be exactly 32 characters'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),
  REDIS_KEY_PREFIX: z.string().default('ubereats:'),

  // Session
  SESSION_LIFETIME_MINUTES: z.string().transform(Number).default('60'),
  MAX_SESSIONS: z.string().transform(Number).default('100'),
  SESSION_CLEANUP_INTERVAL_MINUTES: z.string().transform(Number).default('5'),

  // n8n
  N8N_BASE_URL: z.string().url().default('http://localhost:5678'),
  N8N_API_KEY: z.string().optional(),
  API_TIMEOUT_SECONDS: z.string().transform(Number).default('60'),
  MANUAL_LOGIN_TIMEOUT_SECONDS: z.string().transform(Number).default('10'),
  LOGIN_STATUS_TIMEOUT_SECONDS: z.string().transform(Number).default('30'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  RATE_LIMIT_LOGIN_MAX: z.string().transform(Number).default('5'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // Circuit Breaker
  CIRCUIT_BREAKER_THRESHOLD: z.string().transform(Number).default('5'),
  CIRCUIT_BREAKER_TIMEOUT_MS: z.string().transform(Number).default('30000'),
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: z.string().transform(Number).default('60000'),

  // Monitoring
  ENABLE_METRICS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  METRICS_PORT: z.string().transform(Number).default('9090'),
  HEALTH_CHECK_INTERVAL_MS: z.string().transform(Number).default('30000'),

  // Development
  ENABLE_DEBUG: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  PRETTY_LOGS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
});

// Parse and validate environment
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => e.path.join('.'));
      console.error('❌ Invalid environment configuration:');
      console.error(error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n'));

      // Check if we're missing critical security keys
      const criticalMissing = ['JWT_SECRET', 'SESSION_SECRET', 'ENCRYPTION_KEY'].filter((key) =>
        missingVars.includes(key)
      );

      if (criticalMissing.length > 0 && process.env.NODE_ENV === 'production') {
        throw new Error(`Critical security configuration missing: ${criticalMissing.join(', ')}`);
      }

      // Use defaults for development
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️  Using default values for missing configuration (development mode)');
        // Set defaults for critical security keys in development
        process.env.JWT_SECRET =
          process.env.JWT_SECRET || 'development-jwt-secret-do-not-use-in-production';
        process.env.SESSION_SECRET =
          process.env.SESSION_SECRET || 'development-session-secret-do-not-use';
        process.env.ENCRYPTION_KEY =
          process.env.ENCRYPTION_KEY || 'development-encryption-key-32chr';

        return envSchema.parse(process.env);
      }
    }
    throw error;
  }
};

export const config = parseEnv();

// Configuration groups for easier access
export const serverConfig = {
  port: config.PORT,
  env: config.NODE_ENV,
  logLevel: config.LOG_LEVEL,
  isProduction: config.NODE_ENV === 'production',
  isDevelopment: config.NODE_ENV === 'development',
  isTest: config.NODE_ENV === 'test',
};

export const securityConfig = {
  jwtSecret: config.JWT_SECRET,
  sessionSecret: config.SESSION_SECRET,
  encryptionKey: config.ENCRYPTION_KEY,
};

export const redisConfig = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB,
  keyPrefix: config.REDIS_KEY_PREFIX,
};

export const sessionConfig = {
  lifetimeMinutes: config.SESSION_LIFETIME_MINUTES,
  maxSessions: config.MAX_SESSIONS,
  cleanupIntervalMinutes: config.SESSION_CLEANUP_INTERVAL_MINUTES,
};

export const n8nConfig = {
  baseUrl: config.N8N_BASE_URL,
  apiKey: config.N8N_API_KEY,
  timeouts: {
    default: config.API_TIMEOUT_SECONDS * 1000,
    manualLogin: config.MANUAL_LOGIN_TIMEOUT_SECONDS * 1000,
    loginStatus: config.LOGIN_STATUS_TIMEOUT_SECONDS * 1000,
  },
};

export const rateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  loginMax: config.RATE_LIMIT_LOGIN_MAX,
};

export const corsConfig = {
  origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
  credentials: config.CORS_CREDENTIALS,
};

export const circuitBreakerConfig = {
  threshold: config.CIRCUIT_BREAKER_THRESHOLD,
  timeout: config.CIRCUIT_BREAKER_TIMEOUT_MS,
  resetTimeout: config.CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
};

export const monitoringConfig = {
  enableMetrics: config.ENABLE_METRICS,
  metricsPort: config.METRICS_PORT,
  healthCheckInterval: config.HEALTH_CHECK_INTERVAL_MS,
};

export const debugConfig = {
  enableDebug: config.ENABLE_DEBUG,
  prettyLogs: config.PRETTY_LOGS,
};
