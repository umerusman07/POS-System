/**
 * Deals API service
 * 
 * Backend endpoints:
 * - GET /api/deals - Get all deals (Private, requires authentication)
 * - POST /api/deals - Create deal (Private, Manager only, requires authentication)
 * - PATCH /api/deals/:id - Update deal (Private, Manager only)
 * - DELETE /api/deals/:id - Delete deal (Private, Manager only)
 */

import { apiGet, apiPost, apiRequest, apiDelete } from '../api';

export interface DealItem {
  id?: string;
  dealId?: string;
  menuItemId: string;
  quantity: number;
  menuItem?: {
    id: string;
    name: string;
    referenceNumber: string;
    price: number;
    description?: string;
  };
}

export interface Deal {
  id: string;
  name: string;
  referenceNumber: string;
  description?: string;
  price: number;
  isActive: boolean;
  dealItems: DealItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDealData {
  name: string;
  referenceNumber: string;
  description?: string;
  price: number | string;
  isActive?: boolean;
  dealItems: Array<{
    menuItemId: string;
    quantity: number;
  }>;
}

export interface UpdateDealData {
  name?: string;
  description?: string;
  price?: number | string;
  isActive?: boolean;
  dealItems?: Array<{
    menuItemId: string;
    quantity: number;
  }>;
}

export interface DealsResponse {
  deals: Deal[];
}

/**
 * Get all deals from the backend
 * 
 * Backend endpoint: GET /api/deals
 * Response format: { success: true, count: number, data: { deals: Deal[] } }
 * 
 * @returns Promise<Deal[]> Array of deals
 * @throws Error if request fails or authentication is invalid
 */
export async function getAllDeals(): Promise<Deal[]> {
  const response = await apiGet<DealsResponse>('/api/deals');
  return response.data?.deals || [];
}

/**
 * Create a new deal via the backend API
 * 
 * Backend endpoint: POST /api/deals
 * Requires: Manager role and authentication token
 * Request body: { name, referenceNumber, description?, price, isActive?, dealItems }
 * Response format: { success: true, message: string, data: { deal: Deal } }
 * 
 * @param data - Deal data to create
 * @returns Promise<Deal> The created deal
 * @throws Error if creation fails
 */
export async function createDeal(data: CreateDealData): Promise<Deal> {
  const response = await apiPost<{ deal: Deal }>('/api/deals', data);
  if (!response.data?.deal) {
    throw new Error('Failed to create deal');
  }
  return response.data.deal;
}

/**
 * Update a deal via the backend API
 * 
 * Backend endpoint: PATCH /api/deals/:id
 * Requires: Manager role and authentication token
 * Request body: { name?, description?, price?, isActive?, dealItems? }
 * Response format: { success: true, message: string, data: { deal: Deal } }
 * 
 * @param dealId - Deal ID to update
 * @param data - Deal data to update
 * @returns Promise<Deal> The updated deal
 * @throws Error if update fails
 */
export async function updateDeal(dealId: string, data: UpdateDealData): Promise<Deal> {
  const response = await apiRequest<{ deal: Deal }>(`/api/deals/${dealId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!response.data?.deal) {
    throw new Error('Failed to update deal');
  }
  return response.data.deal;
}

/**
 * Delete a deal via the backend API
 * 
 * Backend endpoint: DELETE /api/deals/:id
 * Requires: Manager role and authentication token
 * Response format: { success: true, message: string, data: { deal: Deal } }
 * 
 * @param dealId - Deal ID to delete
 * @returns Promise<Deal> The deleted deal
 * @throws Error if deletion fails
 */
export async function deleteDeal(dealId: string): Promise<Deal> {
  const response = await apiDelete<{ deal: Deal }>(`/api/deals/${dealId}`);
  if (!response.data?.deal) {
    throw new Error('Failed to delete deal');
  }
  return response.data.deal;
}
