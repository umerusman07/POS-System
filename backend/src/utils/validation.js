import { validationResult, body } from 'express-validator';

/**
 * Middleware to check validation results
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Validation rules for login
 */
export const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

/**
 * Validation rules for change password
 */
export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

/**
 * Validation rules for create user
 */
export const createUserValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Username must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['Manager', 'User'])
    .withMessage('Role must be either Manager or User'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters')
];

/**
 * Validation rules for update user
 */
export const updateUserValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

/**
 * Validation rules for reset password
 */
export const resetPasswordValidation = [
  body('newPassword')
    .optional()
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

/**
 * Validation rules for create menu item
 */
export const createMenuItemValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 120 })
    .withMessage('Name must be less than 120 characters'),
  body('referenceNumber')
    .trim()
    .notEmpty()
    .withMessage('Reference number is required')
    .isLength({ max: 30 })
    .withMessage('Reference number must be less than 30 characters'),
  body('description')
    .optional()
    .trim(),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

/**
 * Validation rules for create deal
 */
export const createDealValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 120 })
    .withMessage('Name must be less than 120 characters'),
  body('referenceNumber')
    .trim()
    .notEmpty()
    .withMessage('Reference number is required')
    .isLength({ max: 30 })
    .withMessage('Reference number must be less than 30 characters'),
  body('description')
    .optional()
    .trim(),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('dealItems')
    .isArray({ min: 1 })
    .withMessage('Deal items are required. A deal must contain at least one menu item.'),
  body('dealItems.*.menuItemId')
    .notEmpty()
    .withMessage('Each deal item must have a menuItemId')
    .isUUID()
    .withMessage('menuItemId must be a valid UUID'),
  body('dealItems.*.quantity')
    .notEmpty()
    .withMessage('Each deal item must have a quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1')
];

/**
 * Validation rules for create order
 */
export const createOrderValidation = [
  body('orderType')
    .notEmpty()
    .withMessage('Order type is required')
    .isIn(['DINE', 'TAKEAWAY', 'DELIVERY'])
    .withMessage('Order type must be DINE, TAKEAWAY, or DELIVERY'),
  body('paymentMethod')
    .optional()
    .isIn(['CASH', 'ONLINE'])
    .withMessage('Payment method must be CASH or ONLINE'),
  body('customerName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Customer name must be less than 100 characters'),
  body('customerPhone')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Customer phone must be less than 30 characters'),
  body('customerAddress')
    .optional()
    .trim(),
  body('orderLines')
    .isArray({ min: 1 })
    .withMessage('Order lines are required. An order must contain at least one item.'),
  body('orderLines.*.productType')
    .notEmpty()
    .withMessage('Each order line must have a productType')
    .isIn(['ITEM', 'DEAL'])
    .withMessage('Product type must be ITEM or DEAL'),
  body('orderLines.*.productId')
    .notEmpty()
    .withMessage('Each order line must have a productId')
    .isUUID()
    .withMessage('productId must be a valid UUID'),
  body('orderLines.*.quantity')
    .notEmpty()
    .withMessage('Each order line must have a quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1')
];

/**
 * Validation rules for update order
 */
export const updateOrderValidation = [
  body('paymentMethod')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      return ['CASH', 'ONLINE'].includes(value);
    })
    .withMessage('Payment method must be CASH, ONLINE, or null'),
  body('paymentStatus')
    .optional()
    .isIn(['PAID', 'UNPAID'])
    .withMessage('Payment status must be PAID or UNPAID'),
  body('customerName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Customer name must be less than 100 characters'),
  body('customerPhone')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Customer phone must be less than 30 characters'),
  body('customerAddress')
    .optional()
    .trim(),
  body('orderLines')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Order lines must be a non-empty array if provided'),
  body('orderLines.*.productType')
    .optional()
    .isIn(['ITEM', 'DEAL'])
    .withMessage('Product type must be ITEM or DEAL'),
  body('orderLines.*.productId')
    .optional()
    .isUUID()
    .withMessage('productId must be a valid UUID'),
  body('orderLines.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1')
];

/**
 * Validation rules for update order status
 */
export const updateOrderStatusValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['DRAFT', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PICKED_UP', 'FINISHED', 'CANCELLED'])
    .withMessage('Order status must be one of: DRAFT, PREPARING, READY, OUT_FOR_DELIVERY, DELIVERED, PICKED_UP, FINISHED, CANCELLED')
];

