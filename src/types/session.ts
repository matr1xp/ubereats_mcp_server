/**
 * Session Types and Interfaces
 */

import { z } from 'zod';

export enum SessionStatus {
  ACTIVE = 'active',
  MANUAL_LOGIN_PENDING = 'manual_login_pending',
  EXPIRED = 'expired',
  INVALID = 'invalid',
}

export interface SessionData {
  id: string;
  username: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  loginCompletedAt?: Date;
  cookies: Record<string, string>;
  tokens: {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
  };
  sessionStorage: Record<string, any>;
  localStorage: Record<string, any>;
  storageState?: any; // Complete Playwright storage state
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    loginMethod?: 'automatic' | 'manual';
  };
}

export interface SessionCreateOptions {
  username: string;
  status?: SessionStatus;
  lifetimeMinutes?: number;
  metadata?: SessionData['metadata'];
}

export interface SessionUpdateOptions {
  status?: SessionStatus;
  cookies?: Record<string, string>;
  tokens?: SessionData['tokens'];
  sessionStorage?: Record<string, any>;
  localStorage?: Record<string, any>;
  storageState?: any;
  loginCompletedAt?: Date;
}

// Zod schemas for validation
export const SessionCreateSchema = z.object({
  username: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  manualMode: z.boolean().optional(),
  metadata: z
    .object({
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
    })
    .optional(),
});

export const SessionIdSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
});

export type SessionCreateInput = z.infer<typeof SessionCreateSchema>;
export type SessionIdInput = z.infer<typeof SessionIdSchema>;
