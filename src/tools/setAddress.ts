/**
 * Set Address Tool for MCP Server
 */

import { DeliveryAddressSchema } from '../types/ubereats.js';
import { sessionService } from '../services/sessionService.js';
import { n8nService } from '../services/n8nService.js';
import { SessionStatus } from '../types/session.js';
import { createLogger } from '../utils/logger.js';
import { handleError, AuthenticationError } from '../utils/errorHandler.js';

const logger = createLogger('setAddressTool');

/**
 * Set delivery address handler
 */
export async function setAddressHandler(args: unknown): Promise<any> {
  try {
    // Validate input
    const input = DeliveryAddressSchema.parse(args);

    logger.info(
      {
        sessionId: input.sessionId,
        city: input.address.city,
        state: input.address.state,
      },
      'Setting delivery address'
    );

    // Get and validate session
    const session = await sessionService.getSession(input.sessionId);

    if (session.status !== SessionStatus.ACTIVE) {
      throw new AuthenticationError('Session is not active. Please complete login first.');
    }

    // Call n8n set address webhook
    const n8nResponse = await n8nService.setDeliveryAddress(
      session.id,
      {
        cookies: session.cookies,
        tokens: session.tokens,
        sessionStorage: session.sessionStorage,
        localStorage: session.localStorage,
      },
      input.address
    );

    if (n8nResponse.status === 'success') {
      logger.info(
        {
          sessionId: session.id,
        },
        'Delivery address set successfully'
      );

      return {
        status: 'success',
        message: 'Delivery address set successfully',
        data: {
          address: input.address,
          timestamp: new Date().toISOString(),
        },
      };
    } else {
      logger.warn(
        {
          sessionId: session.id,
          error: n8nResponse.message,
        },
        'Failed to set address'
      );

      return {
        status: 'error',
        message: n8nResponse.message || 'Failed to set delivery address',
        code: 'SET_ADDRESS_FAILED',
      };
    }
  } catch (error) {
    logger.error({ error }, 'Set address tool error');
    return handleError(error);
  }
}

// Export tool definition
export const setAddressTool = {
  name: 'ubereats_set_address',
  description: 'Set delivery address for UberEats order',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session ID from login',
      },
      address: {
        type: 'object',
        description: 'Delivery address details',
        properties: {
          street: {
            type: 'string',
            description: 'Street address',
          },
          city: {
            type: 'string',
            description: 'City',
          },
          state: {
            type: 'string',
            description: 'State (2-letter code)',
            minLength: 2,
            maxLength: 2,
          },
          zipCode: {
            type: 'string',
            description: 'ZIP code',
            pattern: '^\\d{5}(-\\d{4})?$',
          },
          aptSuite: {
            type: 'string',
            description: 'Apartment or suite number (optional)',
          },
          deliveryInstructions: {
            type: 'string',
            description: 'Delivery instructions (optional)',
            maxLength: 500,
          },
          latitude: {
            type: 'number',
            description: 'Latitude coordinate (optional)',
            minimum: -90,
            maximum: 90,
          },
          longitude: {
            type: 'number',
            description: 'Longitude coordinate (optional)',
            minimum: -180,
            maximum: 180,
          },
        },
        required: ['street', 'city', 'state', 'zipCode'],
      },
    },
    required: ['sessionId', 'address'],
  },
};
