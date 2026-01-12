import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  resetUserPassword,
  deleteUser,
  isOnlyActiveManager,
  usernameExists,
  emailExists
} from '../services/user.service.js';

/**
 * @desc    Create a new user
 * @route   POST /api/users
 * @access  Private (Manager only)
 */
export const createUserController = async (req, res) => {
  try {
    const { username, email, password, role, isActive, firstName, lastName } = req.body;

    // Check if username already exists
    if (await usernameExists(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Check if email already exists
    if (await emailExists(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Force role to User unless explicitly creating a Manager
    // Only allow creating Manager if the current user is a Manager
    const userRole = role === 'Manager' ? 'Manager' : 'User';

    const userData = {
      username,
      email,
      password,
      role: userRole,
      isActive: isActive !== undefined ? isActive : true,
      firstName,
      lastName
    };

    const user = await createUser(userData);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user creation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Private (Manager only)
 */
export const getAllUsersController = async (req, res) => {
  try {
    const users = await getAllUsers();

    res.json({
      success: true,
      count: users.length,
      data: { users }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Private (Manager only)
 */
export const getUserByIdController = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Update user (name, isActive)
 * @route   PATCH /api/users/:id
 * @access  Private (Manager only)
 */
export const updateUserController = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, isActive } = req.body;
    const currentUserId = req.user.id;

    // Check if user exists
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-demotion: If trying to deactivate or change role of the only manager
    if (id === currentUserId) {
      const isOnlyManager = await isOnlyActiveManager(id);
      
      if (isOnlyManager) {
        // Check if trying to deactivate self
        if (isActive === false) {
          return res.status(400).json({
            success: false,
            message: 'Cannot deactivate yourself. You are the only active manager.'
          });
        }
      }
    } else {
      // If updating another user who is the only manager
      if (existingUser.role === 'Manager' && isActive === false) {
        const isOnlyManager = await isOnlyActiveManager(id);
        if (isOnlyManager) {
          return res.status(400).json({
            success: false,
            message: 'Cannot deactivate the only active manager in the system.'
          });
        }
      }
    }

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedUser = await updateUser(id, updateData);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user update',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Reset user password
 * @route   POST /api/users/:id/reset-password
 * @access  Private (Manager only)
 */
export const resetPasswordController = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // Check if user exists
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Reset password (generate temp if not provided)
    const password = await resetUserPassword(id, newPassword);

    res.json({
      success: true,
      message: newPassword 
        ? 'Password reset successfully' 
        : 'Temporary password generated successfully',
      data: {
        userId: id,
        username: user.username,
        ...(newPassword ? {} : { temporaryPassword: password })
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/users/:id
 * @access  Private (Manager only)
 */
export const deleteUserController = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    // Check if user exists
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-deletion
    if (id === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Prevent deletion of the only active manager
    if (existingUser.role === 'Manager') {
      const isOnlyManager = await isOnlyActiveManager(id);
      if (isOnlyManager) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the only active manager in the system'
        });
      }
    }

    // Delete the user
    const deletedUser = await deleteUser(id);

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: { user: deletedUser }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user deletion',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
