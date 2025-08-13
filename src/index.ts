#!/usr/bin/env node
/**
 * UberEats MCP Server Enhanced - Main Entry Point
 */

import { mcpServer } from './server/mcpServer.js';
import { createLogger } from './utils/logger.js';
import { serverConfig } from './config/environment.js';

// Import tools
import {
  loginTool,
  loginHandler,
  completeLoginTool,
  completeLoginHandler,
  logoutTool,
  logoutHandler,
} from './tools/login.js';
import { addItemsTool, addItemsHandler } from './tools/addItems.js';
import { setAddressTool, setAddressHandler } from './tools/setAddress.js';
import { checkoutTool, checkoutHandler } from './tools/checkout.js';

// Import resources
import { healthCheckResource, healthCheckHandler } from './resources/healthCheck.js';
import { sessionInfoResource, sessionInfoHandler } from './resources/sessionInfo.js';

const logger = createLogger('main');

/**
 * Register all tools
 */
function registerTools(): void {
  // Login tools
  mcpServer.registerTool(
    loginTool.name,
    loginTool.description,
    loginTool.inputSchema,
    loginHandler
  );

  mcpServer.registerTool(
    completeLoginTool.name,
    completeLoginTool.description,
    completeLoginTool.inputSchema,
    completeLoginHandler
  );

  mcpServer.registerTool(
    logoutTool.name,
    logoutTool.description,
    logoutTool.inputSchema,
    logoutHandler
  );

  // Order tools
  mcpServer.registerTool(
    addItemsTool.name,
    addItemsTool.description,
    addItemsTool.inputSchema,
    addItemsHandler
  );

  mcpServer.registerTool(
    setAddressTool.name,
    setAddressTool.description,
    setAddressTool.inputSchema,
    setAddressHandler
  );

  mcpServer.registerTool(
    checkoutTool.name,
    checkoutTool.description,
    checkoutTool.inputSchema,
    checkoutHandler
  );

  logger.info('All tools registered');
}

/**
 * Register all resources
 */
function registerResources(): void {
  mcpServer.registerResource(
    healthCheckResource.uri,
    healthCheckResource.name,
    healthCheckResource.description,
    healthCheckHandler,
    healthCheckResource.mimeType
  );

  mcpServer.registerResource(
    sessionInfoResource.uri,
    sessionInfoResource.name,
    sessionInfoResource.description,
    sessionInfoHandler,
    sessionInfoResource.mimeType
  );

  // Note: userSessionsResource would need query parameter support in a full implementation
  // For now, we'll skip this resource as it requires username parameter
  // mcpServer.registerResource(
  //   userSessionsResource.uri,
  //   userSessionsResource.name,
  //   userSessionsResource.description,
  //   () => userSessionsHandler({ username: 'default' }),
  //   userSessionsResource.mimeType
  // );

  logger.info('All resources registered');
}

/**
 * Register prompts
 */
function registerPrompts(): void {
  // Quick order prompt
  mcpServer.registerPrompt(
    'quick_order',
    'Generate a quick order workflow',
    [
      { name: 'restaurant', description: 'Restaurant name', required: true },
      { name: 'items', description: 'Comma-separated list of items', required: true },
      { name: 'address', description: 'Delivery address', required: false },
    ],
    async (args) => {
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Order from ${args.restaurant}: ${args.items}${args.address ? ` to ${args.address}` : ''}`,
          },
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `I'll help you order from ${args.restaurant}. Let me:
1. Log you into UberEats
2. Search for ${args.restaurant}
3. Add items: ${args.items}
4. Set delivery address${args.address ? `: ${args.address}` : ''}
5. Complete checkout

Shall I proceed with this order?`,
          },
        },
      ];
    }
  );

  // Reorder prompt
  mcpServer.registerPrompt(
    'reorder',
    'Reorder from previous order',
    [{ name: 'orderNumber', description: 'Previous order number', required: false }],
    async (args) => {
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Reorder ${args.orderNumber ? `order #${args.orderNumber}` : 'my last order'}`,
          },
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `I'll help you reorder ${args.orderNumber ? `order #${args.orderNumber}` : 'your last order'}. 
Let me retrieve the order details and place the same order again.`,
          },
        },
      ];
    }
  );

  logger.info('All prompts registered');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    logger.info(
      {
        env: serverConfig.env,
        nodeVersion: process.version,
        platform: process.platform,
      },
      'Starting UberEats MCP Server Enhanced'
    );

    // Register components
    registerTools();
    registerResources();
    registerPrompts();

    // Start the server
    await mcpServer.start();

    logger.info('UberEats MCP Server Enhanced is running');
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

// Start the server
main().catch((error) => {
  logger.fatal({ error }, 'Fatal error during startup');
  process.exit(1);
});
