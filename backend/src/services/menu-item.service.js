import prisma from '../config/database.js';

/**
 * Create a new menu item
 */
export const createMenuItem = async (menuItemData) => {
  return await prisma.menuItem.create({
    data: {
      name: menuItemData.name,
      referenceNumber: menuItemData.referenceNumber,
      description: menuItemData.description,
      price: menuItemData.price,
      isActive: menuItemData.isActive !== undefined ? menuItemData.isActive : true
    },
    select: {
      id: true,
      name: true,
      referenceNumber: true,
      description: true,
      price: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
};

/**
 * Get all menu items
 */
export const getAllMenuItems = async () => {
  return await prisma.menuItem.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  });
};

/**
 * Get menu item by ID
 */
export const getMenuItemById = async (menuItemId) => {
  return await prisma.menuItem.findUnique({
    where: { id: menuItemId }
  });
};

/**
 * Update a menu item
 */
export const updateMenuItem = async (menuItemId, updateData) => {
  const dataToUpdate = {};
  
  if (updateData.name !== undefined) {
    dataToUpdate.name = updateData.name;
  }
  if (updateData.description !== undefined) {
    dataToUpdate.description = updateData.description;
  }
  if (updateData.price !== undefined) {
    dataToUpdate.price = parseFloat(updateData.price);
  }
  if (updateData.isActive !== undefined) {
    dataToUpdate.isActive = updateData.isActive;
  }

  return await prisma.menuItem.update({
    where: { id: menuItemId },
    data: dataToUpdate,
    select: {
      id: true,
      name: true,
      referenceNumber: true,
      description: true,
      price: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
};

/**
 * Delete a menu item
 */
export const deleteMenuItem = async (menuItemId) => {
  return await prisma.menuItem.delete({
    where: { id: menuItemId },
    select: {
      id: true,
      name: true,
      referenceNumber: true,
      description: true,
      price: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
};

/**
 * Check if reference number exists
 */
export const referenceNumberExists = async (referenceNumber, excludeId = null) => {
  const menuItem = await prisma.menuItem.findUnique({
    where: { referenceNumber }
  });
  
  if (!menuItem) return false;
  if (excludeId && menuItem.id === excludeId) return false;
  return true;
};

