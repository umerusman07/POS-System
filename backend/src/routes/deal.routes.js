import express from 'express';
import { authenticate, isManager } from '../middleware/auth.middleware.js';
import {
  createDealController,
  getAllDealsController,
  updateDealController,
  deleteDealController
} from '../controllers/deal.controller.js';
import {
  validate,
  createDealValidation
} from '../utils/validation.js';

const router = express.Router();

/**
 * @route   GET /api/deals
 * @desc    Get all deals
 * @access  Private
 */
router.get('/', authenticate, getAllDealsController);

/**
 * @route   POST /api/deals
 * @desc    Create a new deal
 * @access  Private (Manager only)
 */
router.post('/', authenticate, isManager, createDealValidation, validate, createDealController);

/**
 * @route   PATCH /api/deals/:id
 * @desc    Update a deal
 * @access  Private (Manager only)
 */
router.patch('/:id', authenticate, isManager, updateDealController);

/**
 * @route   DELETE /api/deals/:id
 * @desc    Delete a deal
 * @access  Private (Manager only)
 */
router.delete('/:id', authenticate, isManager, deleteDealController);

export default router;

