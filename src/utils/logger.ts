/**
 * Logger Utility
 */

import pino from 'pino';
import { serverConfig, debugConfig } from '../config/environment.js';

const isProduction = serverConfig.isProduction;
const prettyPrint = debugConfig.prettyLogs && !isProduction;

export const logger = pino({
  level: serverConfig.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(prettyPrint && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        singleLine: false,
        messageFormat: '{level} - {msg}',
      },
    },
  }),
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      parameters: req.parameters,
      headers: {
        'user-agent': req.headers?.['user-agent'],
        'content-type': req.headers?.['content-type'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: res.headers,
    }),
    err: pino.stdSerializers.err,
  },
  base: {
    service: 'ubereats-mcp-server',
    env: serverConfig.env,
  },
  redact: {
    paths: ['password', 'token', 'sessionId', 'cookies', 'authorization'],
    censor: '[REDACTED]',
  },
});

// Create child loggers for different modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};
