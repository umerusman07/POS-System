import express from 'express';
import { login, getCurrentUser, changePassword } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate, loginValidation, changePasswordValidation } from '../utils/validation.js';

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get JWT token
 * @access  Public
 */
router.post('/login', loginValidation, validate, login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me', authenticate, getCurrentUser);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change current user's password
 * @access  Private
 */
router.post('/change-password', authenticate, changePasswordValidation, validate, changePassword);

export default router;

