import {
  createMenuItem,
  getAllMenuItems,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
  referenceNumberExists
} from '../services/menu-item.service.js';

/**
 * @desc    Create a new menu item
 * @route   POST /api/menu-items
 * @access  Private (Manager only)
 */
export const createMenuItemController = async (req, res) => {
  try {
    const { name, referenceNumber, description, price, isActive } = req.body;

    // Check if reference number already exists
    if (await referenceNumberExists(referenceNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Reference number already exists'
      });
    }

    const menuItemData = {
      name,
      referenceNumber,
      description,
      price: parseFloat(price),
      isActive: isActive !== undefined ? isActive : true
    };

    const menuItem = await createMenuItem(menuItemData);

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: { menuItem }
    });
  } catch (error) {
    console.error('Create menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during menu item creation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Get all menu items
 * @route   GET /api/menu-items
 * @access  Private
 */
export const getAllMenuItemsController = async (req, res) => {
  try {
    const menuItems = await getAllMenuItems();

    res.json({
      success: true,
      count: menuItems.length,
      data: { menuItems }
    });
  } catch (error) {
    console.error('Get all menu items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching menu items',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Update a menu item
 * @route   PATCH /api/menu-items/:id
 * @access  Private (Manager only)
 */
export const updateMenuItemController = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, isActive } = req.body;

    // Check if menu item exists
    const existingItem = await getMenuItemById(id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    // Validate price if provided
    if (price !== undefined) {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be a positive number'
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedItem = await updateMenuItem(id, updateData);

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: { menuItem: updatedItem }
    });
  } catch (error) {
    console.error('Update menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during menu item update',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Delete a menu item
 * @route   DELETE /api/menu-items/:id
 * @access  Private (Manager only)
 */
export const deleteMenuItemController = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if menu item exists
    const existingItem = await getMenuItemById(id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    // Delete the menu item
    const deletedItem = await deleteMenuItem(id);

    res.json({
      success: true,
      message: 'Menu item deleted successfully',
      data: { menuItem: deletedItem }
    });
  } catch (error) {
    console.error('Delete menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during menu item deletion',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
