/**
 * n8n Integration Types
 */

export interface N8nWebhookPayload {
  sessionId: string;
  sessionData?: any;
  timestamp: string;
  [key: string]: any;
}

export interface N8nWebhookResponse {
  status: 'success' | 'error' | 'manual_login_started' | 'login_incomplete';
  message?: string;
  data?: any;
  cookies?: Record<string, string>;
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
  };
  sessionStorage?: Record<string, any>;
  localStorage?: Record<string, any>;
  cartTotal?: string;
  orderConfirmationNumber?: string;
  estimatedDeliveryTime?: string;
  instructions?: string[];
}

export enum N8nWebhookEndpoint {
  LOGIN = 'ubereats-login',
  LOGIN_STATUS = 'ubereats-login-status',
  ADD_ITEMS = 'ubereats-add-items',
  SET_ADDRESS = 'ubereats-set-address',
  CHECKOUT = 'ubereats-checkout',
  ORDER_STATUS = 'ubereats-order-status',
  CANCEL_ORDER = 'ubereats-cancel-order',
}

export interface N8nServiceConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}
