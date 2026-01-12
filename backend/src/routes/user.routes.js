import express from 'express';
import { authenticate, isManager } from '../middleware/auth.middleware.js';
import {
  createUserController,
  getAllUsersController,
  getUserByIdController,
  updateUserController,
  resetPasswordController,
  deleteUserController
} from '../controllers/user.controller.js';
import {
  validate,
  createUserValidation,
  updateUserValidation,
  resetPasswordValidation
} from '../utils/validation.js';

const router = express.Router();

// All routes require authentication and Manager role
router.use(authenticate);
router.use(isManager);

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Private (Manager only)
 */
router.post('/', createUserValidation, validate, createUserController);

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (Manager only)
 */
router.get('/', getAllUsersController);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Manager only)
 */
router.get('/:id', getUserByIdController);

/**
 * @route   PATCH /api/users/:id
 * @desc    Update user (name, isActive)
 * @access  Private (Manager only)
 */
router.patch('/:id', updateUserValidation, validate, updateUserController);

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    Reset user password
 * @access  Private (Manager only)
 */
router.post('/:id/reset-password', resetPasswordValidation, validate, resetPasswordController);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user
 * @access  Private (Manager only)
 */
router.delete('/:id', deleteUserController);

export default router;

