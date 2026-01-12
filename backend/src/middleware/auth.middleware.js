import jwt from 'jsonwebtoken';
import { findUserById } from '../services/auth.service.js';

/**
 * Middleware to verify JWT token and authenticate user
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Access denied.'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists and is active
    const user = await findUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token invalid.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive. Access denied.'
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Middleware to check if user has Manager role
 */
export const isManager = (req, res, next) => {
  if (req.user && req.user.role === 'Manager') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Manager role required.'
    });
  }
};

/**
 * Middleware to check if user has User role
 */
export const isUser = (req, res, next) => {
  if (req.user && req.user.role === 'User') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. User role required.'
    });
  }
};

/**
 * Middleware to check if user has Manager or User role
 */
export const isManagerOrUser = (req, res, next) => {
  if (req.user && (req.user.role === 'Manager' || req.user.role === 'User')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Invalid role.'
    });
  }
};

