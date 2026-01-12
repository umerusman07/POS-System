import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';

/**
 * Generate JWT token
 */
export const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Find user by email
 */
export const findUserByEmail = async (email) => {
  return await prisma.user.findUnique({
    where: {
      email: email.toLowerCase()
    }
  });
};

/**
 * Find user by username (kept for backward compatibility if needed)
 */
export const findUserByUsername = async (username) => {
  return await prisma.user.findUnique({
    where: {
      username: username.toLowerCase()
    }
  });
};

/**
 * Find user by ID
 */
export const findUserById = async (userId) => {
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
 * Verify password
 */
export const verifyPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Hash password
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/**
 * Update user password
 */
export const updateUserPassword = async (userId, newPassword) => {
  const hashedPassword = await hashPassword(newPassword);
  return await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      firstName: true,
      lastName: true
    }
  });
};

/**
 * Check if password matches
 */
export const checkPasswordMatch = async (userId, currentPassword) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true }
  });
  
  if (!user) {
    return false;
  }
  
  return await verifyPassword(currentPassword, user.password);
};

