/**
 * Authentication API service
 * 
 * Backend endpoints:
 * - POST /api/auth/login - Login user and get JWT token (Public)
 * - GET /api/auth/me - Get current user profile (Private, requires authentication)
 */

import { apiPost, apiGet } from '../api';

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

/**
 * Login user and get JWT token
 * 
 * Backend endpoint: POST /api/auth/login
 * Request body: { email, password }
 * Response format: { success: true, message: 'Login successful', data: { token, user } }
 * 
 * @param data - Login credentials (email and password)
 * @returns Promise<LoginResponse> Token and user data
 * @throws Error if login fails
 */
export async function login(data: LoginData): Promise<LoginResponse> {
  const response = await apiPost<LoginResponse>('/api/auth/login', data);
  if (!response.data) {
    throw new Error('Failed to login');
  }
  return response.data;
}

/**
 * Get current user profile
 * 
 * Backend endpoint: GET /api/auth/me
 * Response format: { success: true, data: { user } }
 * 
 * @returns Promise<User> Current user data
 * @throws Error if request fails
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiGet<{ user: User }>('/api/auth/me');
  if (!response.data?.user) {
    throw new Error('Failed to get current user');
  }
  return response.data.user;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

/**
 * Change current user's password
 * 
 * Backend endpoint: POST /api/auth/change-password
 * Request body: { currentPassword, newPassword }
 * Response format: { success: true, message: 'Password updated successfully' }
 * 
 * @param data - Password change data (current and new password)
 * @throws Error if request fails or current password is wrong
 */
export async function changePassword(data: ChangePasswordData): Promise<void> {
  await apiPost('/api/auth/change-password', data);
}

