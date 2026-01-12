import prisma from '../config/database.js';
import { hashPassword } from './auth.service.js';
import crypto from 'crypto';

/**
 * Create a new user
 */
export const createUser = async (userData) => {
  const hashedPassword = await hashPassword(userData.password);
  
  return await prisma.user.create({
    data: {
      username: userData.username.toLowerCase(),
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      role: userData.role || 'User', // Default to User, Manager can override
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      firstName: userData.firstName,
      lastName: userData.lastName
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      updatedAt: true
    }
  });
};

/**
 * Get all users (minimal fields, no password)
 */
export const getAllUsers = async () => {
  return await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};

/**
 * Get user by ID
 */
export const getUserById = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      updatedAt: true
    }
  });
};

/**
 * Update user (name, isActive)
 */
export const updateUser = async (userId, updateData) => {
  const dataToUpdate = {};
  
  if (updateData.firstName !== undefined) {
    dataToUpdate.firstName = updateData.firstName;
  }
  if (updateData.lastName !== undefined) {
    dataToUpdate.lastName = updateData.lastName;
  }
  if (updateData.isActive !== undefined) {
    dataToUpdate.isActive = updateData.isActive;
  }

  return await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      updatedAt: true
    }
  });
};

/**
 * Reset user password
 */
export const resetUserPassword = async (userId, newPassword = null) => {
  // If no password provided, generate a temporary one
  const password = newPassword || generateTempPassword();
  
  const hashedPassword = await hashPassword(password);
  
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  return password; // Return the password (temp or provided) so manager can share it
};

/**
 * Generate temporary password
 */
const generateTempPassword = () => {
  // Generate a random 12-character password
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[crypto.randomInt(26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[crypto.randomInt(26)]; // Lowercase
  password += '0123456789'[crypto.randomInt(10)]; // Number
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[crypto.randomInt(charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
};

/**
 * Count managers in the system
 */
export const countManagers = async () => {
  return await prisma.user.count({
    where: {
      role: 'Manager',
      isActive: true
    }
  });
};

/**
 * Check if user is the only active manager
 */
export const isOnlyActiveManager = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true }
  });

  if (!user || user.role !== 'Manager' || !user.isActive) {
    return false;
  }

  const managerCount = await countManagers();
  return managerCount === 1;
};

/**
 * Check if username exists
 */
export const usernameExists = async (username, excludeUserId = null) => {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() }
  });
  
  if (!user) return false;
  if (excludeUserId && user.id === excludeUserId) return false;
  return true;
};

/**
 * Check if email exists
 */
export const emailExists = async (email, excludeUserId = null) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });
  
  if (!user) return false;
  if (excludeUserId && user.id === excludeUserId) return false;
  return true;
};

/**
 * Delete a user
 */
export const deleteUser = async (userId) => {
  return await prisma.user.delete({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      updatedAt: true
    }
  });
};
