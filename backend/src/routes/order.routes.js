import express from 'express';
import { authenticate, isManager } from '../middleware/auth.middleware.js';
import {
  createOrderController,
  getAllOrderLinesController,
  updateOrderController,
  getAllOrdersController,
  getOrderByIdController,
  updateOrderStatusController,
  deleteOrderController,
  getMenuItemsForOrderController,
  getDealsForOrderController
} from '../controllers/order.controller.js';
import {
  validate,
  createOrderValidation,
  updateOrderValidation,
  updateOrderStatusValidation
} from '../utils/validation.js';

const router = express.Router();

/**
 * @route   GET /api/orders
 * @desc    List all orders
 * @access  Private
 */
router.get('/', authenticate, getAllOrdersController);

/**
 * @route   GET /api/orders/menu-items
 * @desc    Get all active menu items (for order creation)
 * @access  Private
 */
router.get('/menu-items', authenticate, getMenuItemsForOrderController);

/**
 * @route   GET /api/orders/deals
 * @desc    Get all active deals (for order creation)
 * @access  Private
 */
router.get('/deals', authenticate, getDealsForOrderController);

/**
 * @route   POST /api/orders
 * @desc    Create a new order
 * @access  Private (User and Manager)
 */
router.post('/', authenticate, createOrderValidation, validate, createOrderController);

/**
 * @route   POST /api/orders/:id/status
 * @desc    Change order status
 * @access  Private (User and Manager)
 */
router.post('/:id/status', authenticate, updateOrderStatusValidation, validate, updateOrderStatusController);

/**
 * @route   DELETE /api/orders/:id
 * @desc    Delete an order
 * @access  Private (Manager only)
 */
router.delete('/:id', authenticate, isManager, deleteOrderController);

/**
 * @route   GET /api/orders/:id
 * @desc    Get order details
 * @access  Private
 */
router.get('/:id', authenticate, getOrderByIdController);

/**
 * @route   PUT /api/orders/:id
 * @desc    Update an existing order
 * @access  Private (User and Manager)
 */
router.put('/:id', authenticate, updateOrderValidation, validate, updateOrderController);

export default router;

