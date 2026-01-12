/**
 * Menu Items API service
 * 
 * This service handles all API calls related to menu items.
 * Backend endpoints:
 * - GET /api/menu-items - Get all menu items (Private, requires authentication)
 * - POST /api/menu-items - Create menu item (Private, Manager only, requires authentication)
 * - PATCH /api/menu-items/:id - Update menu item (Private, Manager only)
 * - DELETE /api/menu-items/:id - Delete menu item (Private, Manager only)
 */

import { apiGet, apiPost, apiRequest, apiDelete } from '../api';

export interface MenuItem {
  id: string;
  name: string;
  referenceNumber: string;
  description?: string;
  price: number | string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMenuItemData {
  name: string;
  referenceNumber: string;
  description?: string;
  price: number | string;
  isActive?: boolean;
}

export interface UpdateMenuItemData {
  name?: string;
  description?: string;
  price?: number | string;
  isActive?: boolean;
}

export interface MenuItemsResponse {
  menuItems: MenuItem[];
}

/**
 * Get all menu items from the backend
 * 
 * Backend endpoint: GET /api/menu-items
 * Response format: { success: true, count: number, data: { menuItems: MenuItem[] } }
 * 
 * @returns Promise<MenuItem[]> Array of menu items
 * @throws Error if request fails or authentication is invalid
 */
export async function getAllMenuItems(): Promise<MenuItem[]> {
  const response = await apiGet<MenuItemsResponse>('/api/menu-items');
  return response.data?.menuItems || [];
}

/**
 * Create a new menu item via the backend API
 * 
 * Backend endpoint: POST /api/menu-items
 * Requires: Manager role and authentication token
 * Request body: { name, referenceNumber, description?, price, isActive? }
 * Response format: { success: true, message: string, data: { menuItem: MenuItem } }
 * 
 * Validation errors that may be thrown:
 * - "Reference number already exists" (400)
 * - "Name is required" (400)
 * - "Price is required" (400)
 * - Other validation errors from backend
 * 
 * @param data - Menu item data to create
 * @returns Promise<MenuItem> The created menu item
 * @throws Error if creation fails or validation errors occur
 */
export async function createMenuItem(data: CreateMenuItemData): Promise<MenuItem> {
  const response = await apiPost<{ menuItem: MenuItem }>('/api/menu-items', data);
  if (!response.data?.menuItem) {
    throw new Error('Failed to create menu item');
  }
  return response.data.menuItem;
}

/**
 * Update a menu item via the backend API
 * 
 * Backend endpoint: PATCH /api/menu-items/:id
 * Requires: Manager role and authentication token
 * Request body: { name?, description?, price?, isActive? }
 * Response format: { success: true, message: string, data: { menuItem: MenuItem } }
 * 
 * @param menuItemId - Menu item ID to update
 * @param data - Menu item data to update
 * @returns Promise<MenuItem> The updated menu item
 * @throws Error if update fails
 */
export async function updateMenuItem(menuItemId: string, data: UpdateMenuItemData): Promise<MenuItem> {
  const response = await apiRequest<{ menuItem: MenuItem }>(`/api/menu-items/${menuItemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!response.data?.menuItem) {
    throw new Error('Failed to update menu item');
  }
  return response.data.menuItem;
}

/**
 * Delete a menu item via the backend API
 * 
 * Backend endpoint: DELETE /api/menu-items/:id
 * Requires: Manager role and authentication token
 * Response format: { success: true, message: string, data: { menuItem: MenuItem } }
 * 
 * @param menuItemId - Menu item ID to delete
 * @returns Promise<MenuItem> The deleted menu item
 * @throws Error if deletion fails
 */
export async function deleteMenuItem(menuItemId: string): Promise<MenuItem> {
  const response = await apiDelete<{ menuItem: MenuItem }>(`/api/menu-items/${menuItemId}`);
  if (!response.data?.menuItem) {
    throw new Error('Failed to delete menu item');
  }
  return response.data.menuItem;
}
