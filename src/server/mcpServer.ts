/**
 * Core MCP Server Implementation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mcpServer');

export class UberEatsMCPServer {
  private server: Server;
  private tools: Map<string, any> = new Map();
  private resources: Map<string, any> = new Map();
  private prompts: Map<string, any> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'ubereats-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Setup request handlers
   */
  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tool = this.tools.get(name);
      if (!tool) {
        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
      }

      try {
        logger.info({ tool: name, args }, 'Executing tool');
        const result = await tool.handler(args);

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({ tool: name, error }, 'Tool execution failed');

        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // List resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = Array.from(this.resources.values()).map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType || 'application/json',
      }));

      return { resources };
    });

    // Read resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      const resource = Array.from(this.resources.values()).find((r) => r.uri === uri);
      if (!resource) {
        throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${uri}`);
      }

      try {
        logger.info({ resource: uri }, 'Reading resource');
        const content = await resource.handler();

        return {
          contents: [
            {
              uri,
              mimeType: resource.mimeType || 'application/json',
              text: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({ resource: uri, error }, 'Resource read failed');

        throw new McpError(
          ErrorCode.InternalError,
          `Resource read failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // List prompts handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = Array.from(this.prompts.values()).map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      }));

      return { prompts };
    });

    // Get prompt handler
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: promptArgs } = request.params;

      const prompt = this.prompts.get(name);
      if (!prompt) {
        throw new McpError(ErrorCode.InvalidRequest, `Prompt not found: ${name}`);
      }

      try {
        logger.info({ prompt: name, args: promptArgs }, 'Getting prompt');
        const messages = await prompt.handler(promptArgs);

        return {
          prompt: name,
          messages,
        };
      } catch (error) {
        logger.error({ prompt: name, error }, 'Prompt generation failed');

        throw new McpError(
          ErrorCode.InternalError,
          `Prompt generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  /**
   * Register a tool
   */
  registerTool(
    name: string,
    description: string,
    inputSchema: any,
    handler: (args: any) => Promise<any>
  ): void {
    this.tools.set(name, {
      name,
      description,
      inputSchema,
      handler,
    });

    logger.info({ tool: name }, 'Tool registered');
  }

  /**
   * Register a resource
   */
  registerResource(
    uri: string,
    name: string,
    description: string,
    handler: () => Promise<any>,
    mimeType?: string
  ): void {
    this.resources.set(uri, {
      uri,
      name,
      description,
      handler,
      mimeType,
    });

    logger.info({ resource: uri }, 'Resource registered');
  }

  /**
   * Register a prompt
   */
  registerPrompt(
    name: string,
    description: string,
    promptArguments: any[],
    handler: (args: any) => Promise<any[]>
  ): void {
    this.prompts.set(name, {
      name,
      description,
      arguments: promptArguments,
      handler,
    });

    logger.info({ prompt: name }, 'Prompt registered');
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info(
      {
        tools: this.tools.size,
        resources: this.resources.size,
        prompts: this.prompts.size,
      },
      'MCP server started'
    );

    // Handle server errors
    this.server.onerror = (error) => {
      logger.error({ error }, 'Server error');
    };

    // Handle shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down server...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down server...');
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Get server instance
   */
  getServer(): Server {
    return this.server;
  }
}

// Export singleton instance
export const mcpServer = new UberEatsMCPServer();
