/**
 * Health Check Resource for MCP Server
 */

import { sessionService } from '../services/sessionService.js';
import { n8nService } from '../services/n8nService.js';
import { createLogger } from '../utils/logger.js';
import { serverConfig, redisConfig } from '../config/environment.js';

const logger = createLogger('healthCheckResource');

/**
 * Health check handler
 */
export async function healthCheckHandler(): Promise<any> {
  try {
    const healthData: any = {
      status: 'healthy',
      service: 'UberEats MCP Server Enhanced',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: serverConfig.env,
      checks: {},
    };

    // Check Redis connection
    try {
      const sessionCount = await sessionService.getActiveSessionCount();
      healthData.checks.redis = {
        status: 'healthy',
        activeSessions: sessionCount,
        host: redisConfig.host,
        port: redisConfig.port,
      };
    } catch (error) {
      healthData.checks.redis = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      healthData.status = 'degraded';
    }

    // Check n8n connection
    try {
      const n8nHealthy = await n8nService.healthCheck();
      const circuitBreakers = n8nService.getCircuitBreakerStatus();

      healthData.checks.n8n = {
        status: n8nHealthy ? 'healthy' : 'unhealthy',
        baseUrl: process.env.N8N_BASE_URL,
        circuitBreakers: Object.entries(circuitBreakers).map(([endpoint, state]) => ({
          endpoint,
          isOpen: state.isOpen,
          failures: state.failures,
        })),
      };

      if (!n8nHealthy) {
        healthData.status = 'degraded';
      }
    } catch (error) {
      healthData.checks.n8n = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      healthData.status = 'degraded';
    }

    // System metrics
    const memoryUsage = process.memoryUsage();
    healthData.system = {
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      },
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };

    logger.debug({ status: healthData.status }, 'Health check completed');

    return healthData;
  } catch (error) {
    logger.error({ error }, 'Health check error');

    return {
      status: 'unhealthy',
      service: 'UberEats MCP Server Enhanced',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export resource definition
export const healthCheckResource = {
  uri: 'ubereats://health',
  name: 'Health Check',
  description: 'Server health status and system metrics',
  mimeType: 'application/json',
};
