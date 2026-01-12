import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { getDashboardController } from '../controllers/dashboard.controller.js';

const router = express.Router();

/**
 * @route   GET /api/dashboard
 * @desc    Get dashboard statistics
 * @access  Private (User - view only, Manager - full access)
 */
router.get('/', authenticate, getDashboardController);

export default router;

