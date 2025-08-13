/**
 * n8n Integration Service
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { N8nWebhookEndpoint, N8nWebhookPayload, N8nWebhookResponse } from '../types/n8n.js';
import { n8nConfig } from '../config/environment.js';
import { createLogger } from '../utils/logger.js';
import { ExternalServiceError, CircuitBreakerError } from '../utils/errorHandler.js';

const logger = createLogger('n8nService');

// Circuit breaker state
interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

export class N8nService {
  private axios: AxiosInstance;
  private circuitBreakers: Map<string, CircuitBreakerState>;
  private readonly maxFailures = 5;
  private readonly resetTimeout = 60000; // 1 minute

  constructor() {
    // Initialize axios instance
    this.axios = axios.create({
      baseURL: n8nConfig.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(n8nConfig.apiKey && { 'X-API-Key': n8nConfig.apiKey }),
      },
    });

    // Initialize circuit breakers for each endpoint
    this.circuitBreakers = new Map();
    Object.values(N8nWebhookEndpoint).forEach((endpoint) => {
      this.circuitBreakers.set(endpoint, {
        isOpen: false,
        failures: 0,
      });
    });

    // Add request interceptor for logging
    this.axios.interceptors.request.use(
      (config) => {
        logger.debug(
          {
            url: config.url,
            method: config.method,
            endpoint: config.url?.split('/').pop(),
          },
          'n8n request'
        );
        return config;
      },
      (error) => {
        logger.error({ err: error }, 'n8n request error');
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axios.interceptors.response.use(
      (response) => {
        logger.debug(
          {
            status: response.status,
            url: response.config.url,
          },
          'n8n response'
        );
        return response;
      },
      (error) => {
        logger.error(
          {
            err: error,
            status: error.response?.status,
            data: error.response?.data,
          },
          'n8n response error'
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if circuit breaker is open for an endpoint
   */
  private isCircuitOpen(endpoint: string): boolean {
    const state = this.circuitBreakers.get(endpoint);

    if (!state || !state.isOpen) {
      return false;
    }

    // Check if reset timeout has passed
    if (state.nextRetryTime && new Date() >= state.nextRetryTime) {
      // Reset circuit breaker
      state.isOpen = false;
      state.failures = 0;
      state.lastFailureTime = undefined;
      state.nextRetryTime = undefined;
      logger.info({ endpoint }, 'Circuit breaker reset');
      return false;
    }

    return true;
  }

  /**
   * Record failure for circuit breaker
   */
  private recordFailure(endpoint: string): void {
    const state = this.circuitBreakers.get(endpoint);

    if (!state) return;

    state.failures++;
    state.lastFailureTime = new Date();

    if (state.failures >= this.maxFailures) {
      state.isOpen = true;
      state.nextRetryTime = new Date(Date.now() + this.resetTimeout);
      logger.warn(
        {
          endpoint,
          failures: state.failures,
          nextRetryTime: state.nextRetryTime,
        },
        'Circuit breaker opened'
      );
    }
  }

  /**
   * Record success for circuit breaker
   */
  private recordSuccess(endpoint: string): void {
    const state = this.circuitBreakers.get(endpoint);

    if (!state) return;

    if (state.failures > 0) {
      state.failures = 0;
      state.lastFailureTime = undefined;
      logger.info({ endpoint }, 'Circuit breaker failures reset');
    }
  }

  /**
   * Call n8n webhook with circuit breaker
   */
  private async callWebhook<T = N8nWebhookResponse>(
    endpoint: N8nWebhookEndpoint,
    payload: N8nWebhookPayload,
    timeout?: number
  ): Promise<T> {
    // Check circuit breaker
    if (this.isCircuitOpen(endpoint)) {
      throw new CircuitBreakerError(`n8n ${endpoint}`);
    }

    try {
      const response = await this.axios.post<T>(`/webhook/${endpoint}`, payload, {
        timeout: timeout || n8nConfig.timeouts.default,
      });

      this.recordSuccess(endpoint);
      return response.data;
    } catch (error) {
      this.recordFailure(endpoint);

      if (error instanceof AxiosError) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new ExternalServiceError('n8n timeout', error);
        }

        if (error.response) {
          throw new ExternalServiceError(`n8n ${endpoint}`, {
            status: error.response.status,
            data: error.response.data,
          });
        }

        throw new ExternalServiceError('n8n connection failed', error);
      }

      throw error;
    }
  }

  /**
   * Login via n8n
   */
  async login(
    sessionId: string,
    username: string,
    password: string,
    manualMode: boolean = false
  ): Promise<N8nWebhookResponse> {
    const payload: N8nWebhookPayload = {
      sessionId,
      username,
      password,
      manualMode,
      timestamp: new Date().toISOString(),
    };

    const timeout = manualMode ? n8nConfig.timeouts.manualLogin : n8nConfig.timeouts.default;

    try {
      return await this.callWebhook(N8nWebhookEndpoint.LOGIN, payload, timeout);
    } catch (error) {
      // Special handling for manual login timeout (expected behavior)
      if (
        manualMode &&
        error instanceof ExternalServiceError &&
        error.details?.status === 'ECONNABORTED'
      ) {
        return {
          status: 'manual_login_started',
          message: 'Manual login process started. Complete login in browser.',
          instructions: [
            'A browser window should have opened',
            'Complete the login process manually',
            'Handle any CAPTCHA or MFA challenges',
            'Click "Complete Manual Login" when done',
          ],
        };
      }
      throw error;
    }
  }

  /**
   * Check login status
   */
  async checkLoginStatus(sessionId: string, username: string): Promise<N8nWebhookResponse> {
    const payload: N8nWebhookPayload = {
      sessionId,
      username,
      timestamp: new Date().toISOString(),
    };

    return this.callWebhook(
      N8nWebhookEndpoint.LOGIN_STATUS,
      payload,
      n8nConfig.timeouts.loginStatus
    );
  }

  /**
   * Add items to cart
   */
  async addItems(
    sessionId: string,
    sessionData: any,
    restaurantName: string,
    items: any[]
  ): Promise<N8nWebhookResponse> {
    const payload: N8nWebhookPayload = {
      sessionId,
      sessionData,
      restaurantName,
      items,
      timestamp: new Date().toISOString(),
    };

    return this.callWebhook(N8nWebhookEndpoint.ADD_ITEMS, payload);
  }

  /**
   * Set delivery address
   */
  async setDeliveryAddress(
    sessionId: string,
    sessionData: any,
    address: any
  ): Promise<N8nWebhookResponse> {
    const payload: N8nWebhookPayload = {
      sessionId,
      sessionData,
      address,
      timestamp: new Date().toISOString(),
    };

    return this.callWebhook(N8nWebhookEndpoint.SET_ADDRESS, payload);
  }

  /**
   * Complete checkout
   */
  async checkout(
    sessionId: string,
    sessionData: any,
    paymentMethodId?: string,
    tipAmount?: number
  ): Promise<N8nWebhookResponse> {
    const payload: N8nWebhookPayload = {
      sessionId,
      sessionData,
      paymentMethodId,
      tipAmount,
      timestamp: new Date().toISOString(),
    };

    return this.callWebhook(N8nWebhookEndpoint.CHECKOUT, payload);
  }

  /**
   * Get order status
   */
  async getOrderStatus(sessionId: string, orderNumber: string): Promise<N8nWebhookResponse> {
    const payload: N8nWebhookPayload = {
      sessionId,
      orderNumber,
      timestamp: new Date().toISOString(),
    };

    return this.callWebhook(N8nWebhookEndpoint.ORDER_STATUS, payload);
  }

  /**
   * Cancel order
   */
  async cancelOrder(
    sessionId: string,
    orderNumber: string,
    reason?: string
  ): Promise<N8nWebhookResponse> {
    const payload: N8nWebhookPayload = {
      sessionId,
      orderNumber,
      reason,
      timestamp: new Date().toISOString(),
    };

    return this.callWebhook(N8nWebhookEndpoint.CANCEL_ORDER, payload);
  }

  /**
   * Health check for n8n service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axios.get('/health', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    const status: Record<string, CircuitBreakerState> = {};

    this.circuitBreakers.forEach((state, endpoint) => {
      status[endpoint] = { ...state };
    });

    return status;
  }
}

// Export singleton instance
export const n8nService = new N8nService();
