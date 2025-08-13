/**
 * Session Info Resource for MCP Server
 */

import { sessionService } from '../services/sessionService.js';
import { createLogger } from '../utils/logger.js';
import { handleError } from '../utils/errorHandler.js';

const logger = createLogger('sessionInfoResource');

/**
 * Get session info handler
 */
export async function sessionInfoHandler(args?: { sessionId?: string }): Promise<any> {
  try {
    if (args?.sessionId) {
      // Get specific session
      const session = await sessionService.getSession(args.sessionId);

      // Remove sensitive data
      const { cookies, tokens, ...safeSession } = session;

      logger.debug({ sessionId: args.sessionId }, 'Retrieved session info');

      return {
        session: {
          ...safeSession,
          hasCookies: Object.keys(cookies).length > 0,
          hasTokens: Object.keys(tokens).length > 0,
        },
      };
    } else {
      // Get all sessions count
      const sessionCount = await sessionService.getActiveSessionCount();

      logger.debug({ sessionCount }, 'Retrieved session count');

      return {
        totalActiveSessions: sessionCount,
        maxSessions: process.env.MAX_SESSIONS || 100,
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error) {
    logger.error({ error }, 'Session info error');
    return handleError(error);
  }
}

/**
 * Get user sessions handler
 */
export async function userSessionsHandler(args: { username: string }): Promise<any> {
  try {
    const sessions = await sessionService.getUserSessions(args.username);

    // Remove sensitive data from all sessions
    const safeSessions = sessions.map((session) => {
      const { cookies, tokens, ...safeSession } = session;
      return {
        ...safeSession,
        hasCookies: Object.keys(cookies).length > 0,
        hasTokens: Object.keys(tokens).length > 0,
      };
    });

    logger.debug({ username: args.username, count: sessions.length }, 'Retrieved user sessions');

    return {
      username: args.username,
      sessions: safeSessions,
      totalSessions: safeSessions.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error({ error }, 'User sessions error');
    return handleError(error);
  }
}

// Export resource definitions
export const sessionInfoResource = {
  uri: 'ubereats://sessions',
  name: 'Session Information',
  description: 'Get information about active sessions',
  mimeType: 'application/json',
};

export const userSessionsResource = {
  uri: 'ubereats://user-sessions',
  name: 'User Sessions',
  description: 'Get all sessions for a specific user',
  mimeType: 'application/json',
};
