/**
 * Login Tool for MCP Server
 */

import { z } from 'zod';
import { sessionService } from '../services/sessionService.js';
import { n8nService } from '../services/n8nService.js';
import { SessionStatus } from '../types/session.js';
import { createLogger } from '../utils/logger.js';
import { handleError } from '../utils/errorHandler.js';

const logger = createLogger('loginTool');

// Input schema for login tool
const LoginInputSchema = z.object({
  username: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  manualMode: z.boolean().optional().default(false),
  metadata: z
    .object({
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
    })
    .optional(),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

/**
 * Login tool handler
 */
export async function loginHandler(args: unknown): Promise<any> {
  try {
    // Validate input
    const input = LoginInputSchema.parse(args);

    logger.info({ username: input.username, manualMode: input.manualMode }, 'Login attempt');

    // Create session
    const session = await sessionService.createSession({
      username: input.username,
      status: input.manualMode ? SessionStatus.MANUAL_LOGIN_PENDING : SessionStatus.ACTIVE,
      metadata: input.metadata,
    });

    try {
      // Call n8n login webhook
      const n8nResponse = await n8nService.login(
        session.id,
        input.username,
        input.password,
        input.manualMode
      );

      // Handle different response types
      if (n8nResponse.status === 'success') {
        // Update session with authentication data
        await sessionService.updateSession(session.id, {
          status: SessionStatus.ACTIVE,
          cookies: n8nResponse.cookies || {},
          tokens: n8nResponse.tokens || {},
          sessionStorage: n8nResponse.sessionStorage || {},
          localStorage: n8nResponse.localStorage || {},
          storageState: n8nResponse.storageState,
          loginCompletedAt: new Date(),
        });

        // Generate JWT token
        const token = sessionService.generateToken(session.id, input.username);

        logger.info({ sessionId: session.id, username: input.username }, 'Login successful');

        return {
          status: 'success',
          message: 'Successfully logged in',
          sessionId: session.id,
          token,
          expiresAt: session.expiresAt,
        };
      } else if (n8nResponse.status === 'manual_login_started') {
        // Manual login initiated
        logger.info({ sessionId: session.id }, 'Manual login started');

        return {
          status: 'manual_login_started',
          message: n8nResponse.message || 'Manual login started. Complete login in browser.',
          sessionId: session.id,
          instructions: n8nResponse.instructions || [
            'A browser window should have opened',
            'Complete the login process manually',
            'Handle any CAPTCHA or MFA challenges',
            'Use the completeLogin tool when done',
          ],
        };
      } else {
        // Login failed
        await sessionService.deleteSession(session.id);

        logger.warn({ sessionId: session.id, username: input.username }, 'Login failed');

        return {
          status: 'error',
          message: n8nResponse.message || 'Login failed',
          code: 'LOGIN_FAILED',
        };
      }
    } catch (error) {
      // Clean up session on error
      await sessionService.deleteSession(session.id);
      throw error;
    }
  } catch (error) {
    logger.error({ error }, 'Login tool error');
    return handleError(error);
  }
}

/**
 * Complete login tool handler
 */
const CompleteLoginInputSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

export async function completeLoginHandler(args: unknown): Promise<any> {
  try {
    const input = CompleteLoginInputSchema.parse(args);

    logger.info({ sessionId: input.sessionId }, 'Completing login');

    // Get session
    const session = await sessionService.getSession(input.sessionId);

    // If session is already active with login data, return success immediately
    if (session.status === SessionStatus.ACTIVE && session.loginCompletedAt) {
      logger.info({ sessionId: input.sessionId }, 'Session already active with login completed');
      
      // Generate fresh token
      const token = sessionService.generateToken(session.id, session.username);
      
      return {
        status: 'success',
        message: 'Session already logged in',
        sessionId: session.id,
        token,
        expiresAt: session.expiresAt,
      };
    }

    // Check if session is in a valid state for login completion
    if (session.status !== SessionStatus.MANUAL_LOGIN_PENDING && session.status !== SessionStatus.ACTIVE) {
      return {
        status: 'error',
        message: 'Session is not in a valid state for login completion',
        code: 'INVALID_STATE',
      };
    }

    // Check login status with n8n
    const n8nResponse = await n8nService.checkLoginStatus(session.id, session.username);

    if (n8nResponse.status === 'success') {
      // Update session with authentication data
      await sessionService.updateSession(session.id, {
        status: SessionStatus.ACTIVE,
        cookies: n8nResponse.cookies || {},
        tokens: n8nResponse.tokens || {},
        sessionStorage: n8nResponse.sessionStorage || {},
        localStorage: n8nResponse.localStorage || {},
        storageState: n8nResponse.storageState,
        loginCompletedAt: new Date(),
      });

      // Generate JWT token
      const token = sessionService.generateToken(session.id, session.username);

      logger.info({ sessionId: session.id }, 'Login completed successfully');

      return {
        status: 'success',
        message: 'Login completed successfully',
        sessionId: session.id,
        token,
        expiresAt: session.expiresAt,
      };
    } else if (n8nResponse.status === 'login_incomplete') {
      return {
        status: 'login_incomplete',
        message:
          n8nResponse.message ||
          'Login not yet completed. Please finish the login process in the browser.',
        sessionId: session.id,
      };
    } else {
      return {
        status: 'error',
        message: n8nResponse.message || 'Failed to complete login',
        code: 'LOGIN_COMPLETION_FAILED',
      };
    }
  } catch (error) {
    logger.error({ error }, 'Complete login tool error');
    return handleError(error);
  }
}

/**
 * Logout tool handler
 */
const LogoutInputSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

export async function logoutHandler(args: unknown): Promise<any> {
  try {
    const input = LogoutInputSchema.parse(args);

    logger.info({ sessionId: input.sessionId }, 'Logout attempt');

    // Delete session
    await sessionService.deleteSession(input.sessionId);

    logger.info({ sessionId: input.sessionId }, 'Logout successful');

    return {
      status: 'success',
      message: 'Successfully logged out',
    };
  } catch (error) {
    logger.error({ error }, 'Logout tool error');
    return handleError(error);
  }
}

// Export tool definitions
export const loginTool = {
  name: 'ubereats_login',
  description: 'Login to UberEats with automatic or manual mode support',
  inputSchema: {
    type: 'object',
    properties: {
      username: {
        type: 'string',
        description: 'UberEats account email',
      },
      password: {
        type: 'string',
        description: 'Account password',
      },
      manualMode: {
        type: 'boolean',
        description: 'Use manual login mode for CAPTCHA/MFA',
        default: false,
      },
      metadata: {
        type: 'object',
        properties: {
          userAgent: { type: 'string' },
          ipAddress: { type: 'string' },
        },
      },
    },
    required: ['username', 'password'],
  },
};

export const completeLoginTool = {
  name: 'ubereats_complete_login',
  description: 'Complete manual login process after browser authentication',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session ID from login',
      },
    },
    required: ['sessionId'],
  },
};

export const logoutTool = {
  name: 'ubereats_logout',
  description: 'Logout from UberEats and destroy session',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session ID to logout',
      },
    },
    required: ['sessionId'],
  },
};
