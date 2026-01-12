/**
 * Users API service
 * 
 * Backend endpoints:
 * - GET /api/users - Get all users (Manager only)
 * - POST /api/users - Create a new user (Manager only)
 * - GET /api/users/:id - Get user by ID (Manager only)
 * - PATCH /api/users/:id - Update user (Manager only)
 * - DELETE /api/users/:id - Delete user (Manager only)
 * - POST /api/users/:id/reset-password - Reset user password (Manager only)
 */

import { apiGet, apiPost, apiRequest, apiDelete } from '../api';

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface UpdateUserData {
  firstName?: string | null;
  lastName?: string | null;
  isActive?: boolean;
}

export interface ResetPasswordData {
  newPassword?: string;
}

export interface ResetPasswordResponse {
  userId: string;
  username: string;
  temporaryPassword?: string;
}

export interface UsersResponse {
  users: User[];
}

/**
 * Get all users
 * 
 * Backend endpoint: GET /api/users
 * Response format: { success: true, count: number, data: { users: User[] } }
 * 
 * @returns Promise<User[]> Array of users
 * @throws Error if request fails
 */
export async function getAllUsers(): Promise<User[]> {
  const response = await apiGet<UsersResponse>('/api/users');
  return response.data?.users || [];
}

/**
 * Create a new user
 * 
 * Backend endpoint: POST /api/users
 * Request body: { username, email, password, role, firstName?, lastName?, isActive? }
 * Response format: { success: true, message: string, data: { user: User } }
 * 
 * @param data - User data to create
 * @returns Promise<User> The created user
 * @throws Error if creation fails
 */
export async function createUser(data: CreateUserData): Promise<User> {
  const response = await apiPost<{ user: User }>('/api/users', data);
  if (!response.data?.user) {
    throw new Error('Failed to create user');
  }
  return response.data.user;
}

/**
 * Update a user
 * 
 * Backend endpoint: PATCH /api/users/:id
 * Request body: { firstName?, lastName?, isActive? }
 * Response format: { success: true, message: string, data: { user: User } }
 * 
 * @param userId - User ID to update
 * @param data - User data to update
 * @returns Promise<User> The updated user
 * @throws Error if update fails
 */
export async function updateUser(userId: string, data: UpdateUserData): Promise<User> {
  const response = await apiRequest<{ user: User }>(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!response.data?.user) {
    throw new Error('Failed to update user');
  }
  return response.data.user;
}

/**
 * Reset user password
 * 
 * Backend endpoint: POST /api/users/:id/reset-password
 * Request body: { newPassword?: string } (optional - if not provided, generates temp password)
 * Response format: { success: true, message: string, data: { userId, username, temporaryPassword?: string } }
 * 
 * @param userId - User ID to reset password for
 * @param data - Reset password data (optional newPassword)
 * @returns Promise<ResetPasswordResponse> Reset password response with temp password if generated
 * @throws Error if reset fails
 */
export async function resetUserPassword(userId: string, data: ResetPasswordData = {}): Promise<ResetPasswordResponse> {
  const response = await apiPost<ResetPasswordResponse>(`/api/users/${userId}/reset-password`, data);
  if (!response.data) {
    throw new Error('Failed to reset password');
  }
  return response.data;
}

/**
 * Delete a user
 * 
 * Backend endpoint: DELETE /api/users/:id
 * Response format: { success: true, message: string, data: { user: User } }
 * 
 * @param userId - User ID to delete
 * @returns Promise<User> The deleted user
 * @throws Error if deletion fails
 */
export async function deleteUser(userId: string): Promise<User> {
  const response = await apiDelete<{ user: User }>(`/api/users/${userId}`);
  if (!response.data?.user) {
    throw new Error('Failed to delete user');
  }
  return response.data.user;
}
