/**
 * UberEats Types and Interfaces
 */

import { z } from 'zod';

// Item types
export interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
  options?: {
    size?: string;
    extras?: string[];
    specialInstructions?: string;
  };
}

export interface CartTotal {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  serviceFee: number;
  tip: number;
  total: number;
}

// Address types
export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  aptSuite?: string;
  deliveryInstructions?: string;
  latitude?: number;
  longitude?: number;
}

// Order types
export interface OrderConfirmation {
  orderNumber: string;
  estimatedDeliveryTime: Date;
  trackingUrl?: string;
  totalAmount: number;
  restaurantName: string;
  items: OrderItem[];
}

// API Response types
export interface ApiResponse<T = any> {
  status: 'success' | 'error' | 'pending';
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
  timestamp: Date;
}

// Zod schemas for validation
export const AddItemsSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  restaurantName: z.string().min(1, 'Restaurant name is required'),
  items: z
    .array(
      z.object({
        name: z.string().min(1, 'Item name is required'),
        quantity: z.number().int().positive('Quantity must be a positive integer'),
        price: z.number().positive().optional(),
        options: z
          .object({
            size: z.string().optional(),
            extras: z.array(z.string()).optional(),
            specialInstructions: z.string().max(500).optional(),
          })
          .optional(),
      })
    )
    .min(1, 'At least one item is required'),
});

export const DeliveryAddressSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  address: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().length(2, 'State must be 2 characters'),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
    aptSuite: z.string().optional(),
    deliveryInstructions: z.string().max(500).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
});

export const CheckoutSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  paymentMethodId: z.string().optional(),
  tipAmount: z.number().min(0, 'Tip amount cannot be negative').optional(),
  promoCode: z.string().optional(),
  scheduleTime: z.string().datetime().optional(),
  contactlessDelivery: z.boolean().optional(),
});

export type AddItemsInput = z.infer<typeof AddItemsSchema>;
export type DeliveryAddressInput = z.infer<typeof DeliveryAddressSchema>;
export type CheckoutInput = z.infer<typeof CheckoutSchema>;
