import { getDashboardStats } from '../services/dashboard.service.js';

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/dashboard
 * @access  Private (User - view only, Manager - full access)
 */
export const getDashboardController = async (req, res) => {
  try {
    const userRole = req.user.role;
    
    const stats = await getDashboardStats();

    // For regular users, return view-only data (no delete/edit capabilities in response)
    const response = {
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      userRole,
      isManager: userRole === 'Manager',
      data: stats
    };

    res.json(response);
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

