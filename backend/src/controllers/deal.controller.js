import {
  createDeal,
  getAllDeals,
  getDealById,
  updateDeal,
  deleteDeal,
  dealReferenceNumberExists,
  getMenuItemById
} from '../services/deal.service.js';

/**
 * @desc    Create a new deal
 * @route   POST /api/deals
 * @access  Private (Manager only)
 */
export const createDealController = async (req, res) => {
  try {
    const { name, referenceNumber, description, price, isActive, dealItems } = req.body;

    // Check if reference number already exists
    if (await dealReferenceNumberExists(referenceNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Reference number already exists'
      });
    }

    // Validate dealItems
    if (!dealItems || !Array.isArray(dealItems) || dealItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Deal items are required. A deal must contain at least one menu item.'
      });
    }

    // Validate each menu item exists
    for (const item of dealItems) {
      if (!item.menuItemId || !item.quantity) {
        return res.status(400).json({
          success: false,
          message: 'Each deal item must have menuItemId and quantity'
        });
      }

      if (item.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be at least 1'
        });
      }

      const menuItem = await getMenuItemById(item.menuItemId);
      if (!menuItem) {
        return res.status(404).json({
          success: false,
          message: `Menu item with ID ${item.menuItemId} not found`
        });
      }
    }

    const dealData = {
      name,
      referenceNumber,
      description,
      price: parseFloat(price),
      isActive: isActive !== undefined ? isActive : true,
      dealItems
    };

    const deal = await createDeal(dealData);

    res.status(201).json({
      success: true,
      message: 'Deal created successfully',
      data: { deal }
    });
  } catch (error) {
    console.error('Create deal error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during deal creation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Get all deals
 * @route   GET /api/deals
 * @access  Private
 */
export const getAllDealsController = async (req, res) => {
  try {
    const deals = await getAllDeals();

    res.json({
      success: true,
      count: deals.length,
      data: { deals }
    });
  } catch (error) {
    console.error('Get all deals error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching deals',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Update a deal
 * @route   PATCH /api/deals/:id
 * @access  Private (Manager only)
 */
export const updateDealController = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, isActive, dealItems } = req.body;

    // Check if deal exists
    const existingDeal = await getDealById(id);
    if (!existingDeal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found'
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

    // Validate dealItems if provided
    if (dealItems !== undefined) {
      if (!Array.isArray(dealItems) || dealItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Deal items are required. A deal must contain at least one menu item.'
        });
      }

      // Validate each menu item exists
      for (const item of dealItems) {
        if (!item.menuItemId || !item.quantity) {
          return res.status(400).json({
            success: false,
            message: 'Each deal item must have menuItemId and quantity'
          });
        }

        if (item.quantity < 1) {
          return res.status(400).json({
            success: false,
            message: 'Quantity must be at least 1'
          });
        }

        const menuItem = await getMenuItemById(item.menuItemId);
        if (!menuItem) {
          return res.status(404).json({
            success: false,
            message: `Menu item with ID ${item.menuItemId} not found`
          });
        }
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (dealItems !== undefined) updateData.dealItems = dealItems;

    const updatedDeal = await updateDeal(id, updateData);

    res.json({
      success: true,
      message: 'Deal updated successfully',
      data: { deal: updatedDeal }
    });
  } catch (error) {
    console.error('Update deal error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during deal update',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Delete a deal
 * @route   DELETE /api/deals/:id
 * @access  Private (Manager only)
 */
export const deleteDealController = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if deal exists
    const existingDeal = await getDealById(id);
    if (!existingDeal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found'
      });
    }

    // Delete the deal
    const deletedDeal = await deleteDeal(id);

    res.json({
      success: true,
      message: 'Deal deleted successfully',
      data: { deal: deletedDeal }
    });
  } catch (error) {
    console.error('Delete deal error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during deal deletion',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
