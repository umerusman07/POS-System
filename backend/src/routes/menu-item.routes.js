import express from 'express';
import { authenticate, isManager } from '../middleware/auth.middleware.js';
import {
  createMenuItemController,
  getAllMenuItemsController,
  updateMenuItemController,
  deleteMenuItemController
} from '../controllers/menu-item.controller.js';
import {
  validate,
  createMenuItemValidation
} from '../utils/validation.js';

const router = express.Router();

/**
 * @route   GET /api/menu-items
 * @desc    Get all menu items
 * @access  Private
 */
router.get('/', authenticate, getAllMenuItemsController);

/**
 * @route   POST /api/menu-items
 * @desc    Create a new menu item
 * @access  Private (Manager only)
 */
router.post('/', authenticate, isManager, createMenuItemValidation, validate, createMenuItemController);

/**
 * @route   PATCH /api/menu-items/:id
 * @desc    Update a menu item
 * @access  Private (Manager only)
 */
router.patch('/:id', authenticate, isManager, updateMenuItemController);

/**
 * @route   DELETE /api/menu-items/:id
 * @desc    Delete a menu item
 * @access  Private (Manager only)
 */
router.delete('/:id', authenticate, isManager, deleteMenuItemController);

export default router;

