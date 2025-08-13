/**
 * Session Management Service with Redis
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import {
  SessionData,
  SessionStatus,
  SessionCreateOptions,
  SessionUpdateOptions,
} from '../types/session.js';
import { redisConfig, sessionConfig, securityConfig } from '../config/environment.js';
import { createLogger } from '../utils/logger.js';
import { NotFoundError, AuthenticationError, AppError } from '../utils/errorHandler.js';

const logger = createLogger('sessionService');

export class SessionService {
  private redis: Redis;
  private readonly keyPrefix: string;
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.keyPrefix = `${redisConfig.keyPrefix}session:`;

    // Initialize Redis client
    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn({ times, delay }, 'Redis connection retry');
        return delay;
      },
      reconnectOnError: (err: Error) => {
        logger.error({ err }, 'Redis reconnection error');
        return true;
      },
    });

    // Redis event handlers
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('error', (err: Error) => {
      logger.error({ err }, 'Redis error');
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Create a new session
   */
  async createSession(options: SessionCreateOptions): Promise<SessionData> {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (options.lifetimeMinutes || sessionConfig.lifetimeMinutes) * 60000
    );

    const session: SessionData = {
      id: sessionId,
      username: options.username,
      status: options.status || SessionStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      cookies: {},
      tokens: {},
      sessionStorage: {},
      localStorage: {},
      metadata: options.metadata,
    };

    // Check max sessions limit
    const sessionCount = await this.getActiveSessionCount();
    if (sessionCount >= sessionConfig.maxSessions) {
      throw new AppError('Maximum session limit reached', 503, 'MAX_SESSIONS_EXCEEDED');
    }

    // Store in Redis with TTL
    const key = this.keyPrefix + sessionId;
    const ttl = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

    await this.redis.setex(key, ttl, JSON.stringify(session));

    // Also store in a set for user's sessions
    await this.redis.sadd(`${redisConfig.keyPrefix}user:${options.username}:sessions`, sessionId);

    logger.info({ sessionId, username: options.username }, 'Session created');

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData> {
    const key = this.keyPrefix + sessionId;
    const data = await this.redis.get(key);

    if (!data) {
      throw new NotFoundError('Session');
    }

    const session = JSON.parse(data) as SessionData;

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      await this.deleteSession(sessionId);
      throw new AuthenticationError('Session expired');
    }

    return session;
  }

  /**
   * Update session
   */
  async updateSession(sessionId: string, updates: SessionUpdateOptions): Promise<SessionData> {
    const session = await this.getSession(sessionId);

    // Update fields
    if (updates.status !== undefined) session.status = updates.status;
    if (updates.cookies) session.cookies = { ...session.cookies, ...updates.cookies };
    if (updates.tokens) session.tokens = { ...session.tokens, ...updates.tokens };
    if (updates.sessionStorage) {
      session.sessionStorage = { ...session.sessionStorage, ...updates.sessionStorage };
    }
    if (updates.localStorage) {
      session.localStorage = { ...session.localStorage, ...updates.localStorage };
    }
    if (updates.loginCompletedAt) session.loginCompletedAt = updates.loginCompletedAt;

    session.updatedAt = new Date();

    // Calculate remaining TTL
    const ttl = Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000);

    if (ttl > 0) {
      await this.redis.setex(this.keyPrefix + sessionId, ttl, JSON.stringify(session));
    }

    logger.info({ sessionId }, 'Session updated');

    return session;
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);

      // Remove from Redis
      await this.redis.del(this.keyPrefix + sessionId);

      // Remove from user's session set
      await this.redis.srem(`${redisConfig.keyPrefix}user:${session.username}:sessions`, sessionId);

      logger.info({ sessionId }, 'Session deleted');
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }
  }

  /**
   * Validate session
   */
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      return session.status === SessionStatus.ACTIVE;
    } catch {
      return false;
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(username: string): Promise<SessionData[]> {
    const sessionIds = await this.redis.smembers(
      `${redisConfig.keyPrefix}user:${username}:sessions`
    );

    const sessions: SessionData[] = [];

    for (const sessionId of sessionIds) {
      try {
        const session = await this.getSession(sessionId);
        sessions.push(session);
      } catch {
        // Session might be expired or deleted
        await this.redis.srem(`${redisConfig.keyPrefix}user:${username}:sessions`, sessionId);
      }
    }

    return sessions;
  }

  /**
   * Get active session count
   */
  async getActiveSessionCount(): Promise<number> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    return keys.length;
  }

  /**
   * Generate JWT token for session
   */
  generateToken(sessionId: string, username: string): string {
    return jwt.sign({ sessionId, username }, securityConfig.jwtSecret, {
      expiresIn: `${sessionConfig.lifetimeMinutes}m`,
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { sessionId: string; username: string } {
    try {
      return jwt.verify(token, securityConfig.jwtSecret) as any;
    } catch {
      throw new AuthenticationError('Invalid token');
    }
  }

  /**
   * Extend session lifetime
   */
  async extendSession(sessionId: string, additionalMinutes: number): Promise<SessionData> {
    const session = await this.getSession(sessionId);

    const newExpiresAt = new Date(
      new Date(session.expiresAt).getTime() + additionalMinutes * 60000
    );

    session.expiresAt = newExpiresAt;
    session.updatedAt = new Date();

    const ttl = Math.floor((newExpiresAt.getTime() - Date.now()) / 1000);

    await this.redis.setex(this.keyPrefix + sessionId, ttl, JSON.stringify(session));

    logger.info({ sessionId, additionalMinutes }, 'Session extended');

    return session;
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      let cleanedCount = 0;

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const session = JSON.parse(data) as SessionData;
          if (new Date(session.expiresAt) < new Date()) {
            await this.redis.del(key);
            await this.redis.srem(
              `${redisConfig.keyPrefix}user:${session.username}:sessions`,
              session.id
            );
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info({ cleanedCount }, 'Expired sessions cleaned up');
      }
    } catch (error) {
      logger.error({ err: error }, 'Error cleaning up expired sessions');
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredSessions(),
      sessionConfig.cleanupIntervalMinutes * 60000
    );
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    await this.redis.quit();
    logger.info('Session service cleaned up');
  }
}

// Export singleton instance
export const sessionService = new SessionService();
