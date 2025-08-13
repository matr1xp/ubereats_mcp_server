/**
 * Checkout Tool for MCP Server
 */

import { CheckoutSchema } from '../types/ubereats.js';
import { sessionService } from '../services/sessionService.js';
import { n8nService } from '../services/n8nService.js';
import { SessionStatus } from '../types/session.js';
import { createLogger } from '../utils/logger.js';
import { handleError, AuthenticationError } from '../utils/errorHandler.js';

const logger = createLogger('checkoutTool');

/**
 * Checkout handler
 */
export async function checkoutHandler(args: unknown): Promise<any> {
  try {
    // Validate input
    const input = CheckoutSchema.parse(args);

    logger.info(
      {
        sessionId: input.sessionId,
        tipAmount: input.tipAmount,
        hasPaymentMethod: !!input.paymentMethodId,
      },
      'Processing checkout'
    );

    // Get and validate session
    const session = await sessionService.getSession(input.sessionId);

    if (session.status !== SessionStatus.ACTIVE) {
      throw new AuthenticationError('Session is not active. Please complete login first.');
    }

    // Call n8n checkout webhook
    const n8nResponse = await n8nService.checkout(
      session.id,
      {
        cookies: session.cookies,
        tokens: session.tokens,
        sessionStorage: session.sessionStorage,
        localStorage: session.localStorage,
      },
      input.paymentMethodId,
      input.tipAmount
    );

    if (n8nResponse.status === 'success') {
      logger.info(
        {
          sessionId: session.id,
          orderNumber: n8nResponse.orderConfirmationNumber,
        },
        'Order placed successfully'
      );

      return {
        status: 'success',
        message: 'Order placed successfully',
        data: {
          orderConfirmationNumber: n8nResponse.orderConfirmationNumber,
          estimatedDeliveryTime: n8nResponse.estimatedDeliveryTime,
          paymentMethod: input.paymentMethodId,
          tipAmount: input.tipAmount,
          timestamp: new Date().toISOString(),
        },
      };
    } else {
      logger.warn(
        {
          sessionId: session.id,
          error: n8nResponse.message,
        },
        'Checkout failed'
      );

      return {
        status: 'error',
        message: n8nResponse.message || 'Checkout failed',
        code: 'CHECKOUT_FAILED',
      };
    }
  } catch (error) {
    logger.error({ error }, 'Checkout tool error');
    return handleError(error);
  }
}

// Export tool definition
export const checkoutTool = {
  name: 'ubereats_checkout',
  description: 'Complete checkout and place UberEats order',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session ID from login',
      },
      paymentMethodId: {
        type: 'string',
        description: 'ID of saved payment method (optional)',
      },
      tipAmount: {
        type: 'number',
        description: 'Tip amount in dollars',
        minimum: 0,
      },
      promoCode: {
        type: 'string',
        description: 'Promo code to apply (optional)',
      },
      scheduleTime: {
        type: 'string',
        description: 'Scheduled delivery time in ISO format (optional)',
      },
      contactlessDelivery: {
        type: 'boolean',
        description: 'Request contactless delivery',
        default: true,
      },
    },
    required: ['sessionId'],
  },
};
