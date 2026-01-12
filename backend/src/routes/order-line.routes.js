import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  getAllOrderLinesController
} from '../controllers/order.controller.js';

const router = express.Router();

/**
 * @route   GET /api/order-lines
 * @desc    Get all order lines
 * @access  Private
 */
router.get('/', authenticate, getAllOrderLinesController);

export default router;

