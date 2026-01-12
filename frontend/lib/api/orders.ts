/**
 * Orders API service
 * 
 * Backend endpoints:
 * - GET /api/orders - Get all orders (Private, requires authentication)
 * - GET /api/orders/menu-items - Get active menu items for order creation
 * - GET /api/orders/deals - Get active deals for order creation
 * - POST /api/orders - Create order (Private, User and Manager, requires authentication)
 * - GET /api/orders/:id - Get order details
 * - PUT /api/orders/:id - Update order (Private, User and Manager)
 * - POST /api/orders/:id/status - Update order status
 * - DELETE /api/orders/:id - Delete order (Private, Manager only)
 */

import { apiGet, apiPost, apiPut, apiDelete, apiRequest } from '../api';
import type { MenuItem } from './menu-items';
import type { Deal } from './deals';

export type OrderType = 'DINE' | 'TAKEAWAY' | 'DELIVERY';
export type PaymentMethod = 'CASH' | 'ONLINE';
export type OrderStatus = 'DRAFT' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'PICKED_UP' | 'FINISHED' | 'CANCELLED';
export type PaymentStatus = 'PAID' | 'UNPAID';

export interface OrderLine {
  id?: string;
  orderId?: string;
  productType: 'ITEM' | 'DEAL';
  productId: string;
  nameAtSale: string;
  unitPriceAtSale: number;
  quantity: number;
  lineTotal: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  subtotal: number;
  deliveryCharges: number;
  discount: number;
  total: number;
  orderLines: OrderLine[];
  createdBy: {
    id: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderData {
  orderType: OrderType;
  paymentMethod?: PaymentMethod | null;
  paymentStatus?: PaymentStatus;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  deliveryCharges?: number;
  discount?: number;
  orderLines: Array<{
    productType: 'ITEM' | 'DEAL';
    productId: string;
    quantity: number;
  }>;
}

export interface UpdateOrderData {
  orderType?: OrderType;
  paymentMethod?: PaymentMethod | null;
  paymentStatus?: PaymentStatus;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  deliveryCharges?: number;
  discount?: number;
  orderLines?: Array<{
    productType: 'ITEM' | 'DEAL';
    productId: string;
    quantity: number;
  }>;
}

export interface OrdersResponse {
  orders: Order[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get all active menu items for order creation
 * 
 * Backend endpoint: GET /api/orders/menu-items
 * Response format: { success: true, count: number, data: { menuItems: MenuItem[] } }
 * 
 * @returns Promise<MenuItem[]> Array of active menu items
 * @throws Error if request fails or authentication is invalid
 */
export async function getMenuItemsForOrder(): Promise<MenuItem[]> {
  const response = await apiGet<{ menuItems: MenuItem[] }>('/api/orders/menu-items');
  return response.data?.menuItems || [];
}

/**
 * Get all active deals for order creation
 * 
 * Backend endpoint: GET /api/orders/deals
 * Response format: { success: true, count: number, data: { deals: Deal[] } }
 * 
 * @returns Promise<Deal[]> Array of active deals
 * @throws Error if request fails or authentication is invalid
 */
export async function getDealsForOrder(): Promise<Deal[]> {
  const response = await apiGet<{ deals: Deal[] }>('/api/orders/deals');
  return response.data?.deals || [];
}

/**
 * Get all orders from the backend
 * 
 * Backend endpoint: GET /api/orders
 * Query params: status?, orderType?, paymentStatus?, page?, limit?
 * Response format: { success: true, count: number, pagination?: {...}, data: { orders: Order[] } }
 * 
 * @param filters - Optional filters for orders
 * @returns Promise<OrdersResponse> Orders with pagination info
 * @throws Error if request fails or authentication is invalid
 */
export async function getAllOrders(filters?: {
  status?: OrderStatus;
  orderType?: OrderType;
  paymentStatus?: PaymentStatus;
  page?: number;
  limit?: number;
}): Promise<OrdersResponse> {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.append('status', filters.status);
  if (filters?.orderType) queryParams.append('orderType', filters.orderType);
  if (filters?.paymentStatus) queryParams.append('paymentStatus', filters.paymentStatus);
  if (filters?.page) queryParams.append('page', filters.page.toString());
  if (filters?.limit) queryParams.append('limit', filters.limit.toString());

  const endpoint = `/api/orders${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiGet<{ orders: Order[] }>(endpoint);
  
  // Backend returns: { success: true, count: number, pagination: {...}, data: { orders: [...] } }
  // So pagination is at root level, not in data
  const responseWithPagination = response as typeof response & { pagination?: OrdersResponse['pagination'] };
  
  return {
    orders: response.data?.orders || [],
    pagination: responseWithPagination.pagination
  };
}

/**
 * Get order by ID
 * 
 * Backend endpoint: GET /api/orders/:id
 * Response format: { success: true, data: { order: Order } }
 * 
 * @param orderId - Order ID
 * @returns Promise<Order> The order
 * @throws Error if order not found or request fails
 */
export async function getOrderById(orderId: string): Promise<Order> {
  const response = await apiGet<{ order: Order }>(`/api/orders/${orderId}`);
  if (!response.data?.order) {
    throw new Error('Order not found');
  }
  return response.data.order;
}

/**
 * Create a new order via the backend API
 * 
 * Backend endpoint: POST /api/orders
 * Requires: User or Manager role and authentication token
 * Request body: { orderType, paymentMethod?, customerName?, customerPhone?, customerAddress?, orderLines }
 * Response format: { success: true, message: string, data: { order: Order } }
 * 
 * Validation:
 * - orderType must be DINE, TAKEAWAY, or DELIVERY
 * - For DELIVERY orders: customerName, customerPhone, and customerAddress are required
 * - orderLines must be a non-empty array
 * - Each orderLine must have productType (ITEM or DEAL), productId, and quantity (minimum 1)
 * 
 * @param data - Order data to create
 * @returns Promise<Order> The created order
 * @throws Error if creation fails or validation errors occur
 */
export async function createOrder(data: CreateOrderData): Promise<Order> {
  const response = await apiPost<{ order: Order }>('/api/orders', data);
  if (!response.data?.order) {
    throw new Error('Failed to create order');
  }
  return response.data.order;
}

/**
 * Update an existing order via the backend API
 * 
 * Backend endpoint: PUT /api/orders/:id
 * Requires: User or Manager role and authentication token
 * Request body: { paymentMethod?, paymentStatus?, customerName?, customerPhone?, customerAddress?, orderLines? }
 * Response format: { success: true, message: string, data: { order: Order } }
 * 
 * Note: Only DRAFT orders can be edited by Users. Managers can reopen PREPARING orders to DRAFT first.
 * 
 * @param orderId - Order ID to update
 * @param data - Order data to update
 * @returns Promise<Order> The updated order
 * @throws Error if update fails
 */
export async function updateOrder(orderId: string, data: UpdateOrderData): Promise<Order> {
  const response = await apiPut<{ order: Order }>(`/api/orders/${orderId}`, data);
  if (!response.data?.order) {
    throw new Error('Failed to update order');
  }
  return response.data.order;
}

/**
 * Update order status
 * 
 * Backend endpoint: POST /api/orders/:id/status
 * Requires: User or Manager role and authentication token
 * Request body: { status }
 * Response format: { success: true, message: string, data: { order: Order } }
 * 
 * @param orderId - Order ID
 * @param status - New order status
 * @returns Promise<Order> The updated order
 * @throws Error if status update fails
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const response = await apiPost<{ order: Order }>(`/api/orders/${orderId}/status`, { status });
  if (!response.data?.order) {
    throw new Error('Failed to update order status');
  }
  return response.data.order;
}

/**
 * Delete an order (Manager only)
 * 
 * Backend endpoint: DELETE /api/orders/:id
 * Requires: Manager role and authentication token
 * Response format: { success: true, message: string, data: { deletedOrder: {...} } }
 * 
 * @param orderId - Order ID to delete
 * @returns Promise<Order> The deleted order
 * @throws Error if deletion fails
 */
export async function deleteOrder(orderId: string): Promise<Order> {
  const response = await apiDelete<{ deletedOrder: Order }>(`/api/orders/${orderId}`);
  if (!response.data?.deletedOrder) {
    throw new Error('Failed to delete order');
  }
  return response.data.deletedOrder;
}
