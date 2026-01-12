import prisma from '../config/database.js';

/**
 * Create a new deal with deal items
 */
export const createDeal = async (dealData) => {
  return await prisma.deal.create({
    data: {
      name: dealData.name,
      referenceNumber: dealData.referenceNumber,
      description: dealData.description,
      price: dealData.price,
      isActive: dealData.isActive !== undefined ? dealData.isActive : true,
      dealItems: {
        create: dealData.dealItems.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity
        }))
      }
    },
    include: {
      dealItems: {
        select: {
          id: true,
          dealId: true,
          menuItemId: true,
          quantity: true,
          createdAt: true,
          updatedAt: true,
          menuItem: {
            select: {
              id: true,
              name: true,
              referenceNumber: true,
              price: true,
              description: true
            }
          }
        }
      }
    }
  });
};

/**
 * Get all deals with their items
 */
export const getAllDeals = async () => {
  return await prisma.deal.findMany({
    include: {
      dealItems: {
        select: {
          id: true,
          dealId: true,
          menuItemId: true,
          quantity: true,
          createdAt: true,
          updatedAt: true,
          menuItem: {
            select: {
              id: true,
              name: true,
              referenceNumber: true,
              price: true,
              description: true
            }
          }
        }
      }
    },
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
 * Get deal by ID
 */
export const getDealById = async (dealId) => {
  return await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      dealItems: {
        select: {
          id: true,
          dealId: true,
          menuItemId: true,
          quantity: true,
          createdAt: true,
          updatedAt: true,
          menuItem: {
            select: {
              id: true,
              name: true,
              referenceNumber: true,
              price: true,
              description: true
            }
          }
        }
      }
    }
  });
};

/**
 * Update a deal
 */
export const updateDeal = async (dealId, updateData) => {
  // First, delete existing deal items if new ones are provided
  if (updateData.dealItems) {
    await prisma.dealItem.deleteMany({
      where: { dealId }
    });
  }

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
  if (updateData.dealItems) {
    dataToUpdate.dealItems = {
      create: updateData.dealItems.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity
      }))
    };
  }

  return await prisma.deal.update({
    where: { id: dealId },
    data: dataToUpdate,
    include: {
      dealItems: {
        select: {
          id: true,
          dealId: true,
          menuItemId: true,
          quantity: true,
          createdAt: true,
          updatedAt: true,
          menuItem: {
            select: {
              id: true,
              name: true,
              referenceNumber: true,
              price: true,
              description: true
            }
          }
        }
      }
    }
  });
};

/**
 * Delete a deal
 */
export const deleteDeal = async (dealId) => {
  // Delete deal items first (cascade should handle this, but being explicit)
  await prisma.dealItem.deleteMany({
    where: { dealId }
  });

  return await prisma.deal.delete({
    where: { id: dealId },
    include: {
      dealItems: {
        select: {
          id: true,
          dealId: true,
          menuItemId: true,
          quantity: true,
          createdAt: true,
          updatedAt: true,
          menuItem: {
            select: {
              id: true,
              name: true,
              referenceNumber: true,
              price: true,
              description: true
            }
          }
        }
      }
    }
  });
};

/**
 * Check if reference number exists
 */
export const dealReferenceNumberExists = async (referenceNumber, excludeId = null) => {
  const deal = await prisma.deal.findUnique({
    where: { referenceNumber }
  });
  
  if (!deal) return false;
  if (excludeId && deal.id === excludeId) return false;
  return true;
};

