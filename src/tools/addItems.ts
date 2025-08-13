/**
 * Add Items Tool for MCP Server
 */

import { AddItemsSchema } from '../types/ubereats.js';
import { sessionService } from '../services/sessionService.js';
import { n8nService } from '../services/n8nService.js';
import { SessionStatus } from '../types/session.js';
import { createLogger } from '../utils/logger.js';
import { handleError, AuthenticationError } from '../utils/errorHandler.js';

const logger = createLogger('addItemsTool');

/**
 * Add items to cart handler
 */
export async function addItemsHandler(args: unknown): Promise<any> {
  try {
    // Validate input
    const input = AddItemsSchema.parse(args);

    logger.info(
      {
        sessionId: input.sessionId,
        restaurant: input.restaurantName,
        itemCount: input.items.length,
      },
      'Adding items to cart'
    );

    // Get and validate session
    const session = await sessionService.getSession(input.sessionId);

    if (session.status !== SessionStatus.ACTIVE) {
      throw new AuthenticationError('Session is not active. Please complete login first.');
    }

    // Call n8n add items webhook
    const n8nResponse = await n8nService.addItems(
      session.id,
      {
        cookies: session.cookies,
        tokens: session.tokens,
        sessionStorage: session.sessionStorage,
        localStorage: session.localStorage,
      },
      input.restaurantName,
      input.items
    );

    if (n8nResponse.status === 'success') {
      logger.info(
        {
          sessionId: session.id,
          cartTotal: n8nResponse.cartTotal,
        },
        'Items added successfully'
      );

      return {
        status: 'success',
        message: 'Items added to cart successfully',
        cartTotal: n8nResponse.cartTotal,
        data: {
          restaurant: input.restaurantName,
          items: input.items,
          timestamp: new Date().toISOString(),
        },
      };
    } else {
      logger.warn(
        {
          sessionId: session.id,
          error: n8nResponse.message,
        },
        'Failed to add items'
      );

      return {
        status: 'error',
        message: n8nResponse.message || 'Failed to add items to cart',
        code: 'ADD_ITEMS_FAILED',
      };
    }
  } catch (error) {
    logger.error({ error }, 'Add items tool error');
    return handleError(error);
  }
}

// Export tool definition
export const addItemsTool = {
  name: 'ubereats_add_items',
  description: 'Add items to UberEats cart from a specific restaurant',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session ID from login',
      },
      restaurantName: {
        type: 'string',
        description: 'Name of the restaurant',
      },
      items: {
        type: 'array',
        description: 'Items to add to cart',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Item name',
            },
            quantity: {
              type: 'number',
              description: 'Quantity to order',
              minimum: 1,
            },
            price: {
              type: 'number',
              description: 'Item price (optional)',
            },
            options: {
              type: 'object',
              description: 'Item options',
              properties: {
                size: {
                  type: 'string',
                  description: 'Size option',
                },
                extras: {
                  type: 'array',
                  description: 'Extra toppings/additions',
                  items: { type: 'string' },
                },
                specialInstructions: {
                  type: 'string',
                  description: 'Special instructions for the item',
                },
              },
            },
          },
          required: ['name', 'quantity'],
        },
        minItems: 1,
      },
    },
    required: ['sessionId', 'restaurantName', 'items'],
  },
};
