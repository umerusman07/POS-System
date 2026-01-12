import prisma from '../config/database.js';

/**
 * Generate unique order number with random 5 digits: ORD-AC-XXXXX
 */
const generateOrderNumber = async () => {
  let orderNumber;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop

  // Generate random 5-digit number and check for uniqueness
  while (exists && attempts < maxAttempts) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000); // Generates 10000-99999
    orderNumber = `ORD-AC-${randomDigits}`;
    exists = await prisma.order.findUnique({ where: { orderNumber } });
    attempts++;
  }

  // If we couldn't find a unique number after max attempts, throw error
  if (exists) {
    throw new Error('Unable to generate unique order number after multiple attempts');
  }

  return orderNumber;
};

/**
 * Helper function to calculate total price from order
 * Total = subtotal + deliveryCharges - discount
 */
const calculateOrderTotal = (order) => {
  const subtotal = parseFloat(order.subtotal || 0);
  const deliveryCharges = parseFloat(order.deliveryCharges || 0);
  const discount = parseFloat(order.discount || 0);
  const total = subtotal + deliveryCharges - discount;
  return parseFloat(Math.max(0, total).toFixed(2)); // Ensure total is not negative
};

/**
 * Helper function to add total field to order object
 */
const addTotalToOrder = (order) => {
  if (!order) return order;
  return {
    ...order,
    total: calculateOrderTotal(order)
  };
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
    where: { id: dealId }
  });
};

/**
 * Create a new order with order lines
 */
export const createOrder = async (orderData, userId) => {
  // Generate unique random order number
  const orderNumber = await generateOrderNumber();

  // Calculate subtotal from order lines
  const subtotal = orderData.orderLines.reduce((sum, line) => {
    return sum + parseFloat(line.lineTotal);
  }, 0);

  // Get delivery charges (default to 0 if not provided)
  const deliveryCharges = orderData.deliveryCharges ? parseFloat(orderData.deliveryCharges) : 0;

  // Get discount (default to 0 if not provided)
  const discount = orderData.discount !== undefined && orderData.discount !== null ? parseFloat(orderData.discount) : 0;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      orderType: orderData.orderType,
      status: 'DRAFT',
      paymentMethod: orderData.paymentMethod || null,
      paymentStatus: orderData.paymentStatus || 'UNPAID',
      customerName: orderData.customerName || null,
      customerPhone: orderData.customerPhone || null,
      customerAddress: orderData.customerAddress || null,
      subtotal: subtotal,
      deliveryCharges: deliveryCharges,
      discount: discount,
      createdByUserId: userId,
      orderLines: {
        create: orderData.orderLines.map(line => ({
          productType: line.productType,
          productId: line.productId,
          nameAtSale: line.nameAtSale,
          unitPriceAtSale: line.unitPriceAtSale,
          quantity: line.quantity,
          lineTotal: line.lineTotal
        }))
      }
    },
    include: {
      orderLines: true,
      createdByUser: {
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });
  
  // Add total field to the returned order
  return addTotalToOrder(order);
};

/**
 * Get all order lines
 */
export const getAllOrderLines = async () => {
  return await prisma.orderLine.findMany({
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          orderType: true,
          status: true,
          subtotal: true,
          createdAt: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};

/**
 * Get order by ID
 */
export const getOrderById = async (orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderLines: true,
      createdByUser: {
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });
  
  return addTotalToOrder(order);
};

/**
 * Get all orders
 */
export const getAllOrders = async (queryParams = {}) => {
  const { status, orderType, paymentStatus, page = 1, limit = 50 } = queryParams;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (status) where.status = status;
  if (orderType) where.orderType = orderType;
  if (paymentStatus) where.paymentStatus = paymentStatus;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        orderLines: true,
        createdByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: parseInt(limit)
    }),
    prisma.order.count({ where })
  ]);

  // Add total field to each order
  const ordersWithTotal = orders.map(order => addTotalToOrder(order));

  return {
    orders: ordersWithTotal,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    }
  };
};

/**
 * Update order status
 */
export const updateOrderStatus = async (orderId, status) => {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: {
      orderLines: true,
      createdByUser: {
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });
  
  return addTotalToOrder(order);
};

/**
 * Update an existing order
 */
export const updateOrder = async (orderId, orderData) => {
  // If orderLines are provided, replace all existing order lines
  if (orderData.orderLines && Array.isArray(orderData.orderLines)) {
    // Calculate new subtotal
    const subtotal = orderData.orderLines.reduce((sum, line) => {
      return sum + parseFloat(line.lineTotal);
    }, 0);

    // Delete existing order lines and create new ones
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(orderData.orderType !== undefined && { orderType: orderData.orderType }),
        ...(orderData.paymentMethod !== undefined && { paymentMethod: orderData.paymentMethod }),
        ...(orderData.paymentStatus && { paymentStatus: orderData.paymentStatus }),
        ...(orderData.customerName !== undefined && { customerName: orderData.customerName }),
        ...(orderData.customerPhone !== undefined && { customerPhone: orderData.customerPhone }),
        ...(orderData.customerAddress !== undefined && { customerAddress: orderData.customerAddress }),
        ...(orderData.deliveryCharges !== undefined && { deliveryCharges: orderData.deliveryCharges }),
        ...(orderData.discount !== undefined && { discount: orderData.discount }),
        subtotal: subtotal,
        orderLines: {
          deleteMany: {},
          create: orderData.orderLines.map(line => ({
            productType: line.productType,
            productId: line.productId,
            nameAtSale: line.nameAtSale,
            unitPriceAtSale: line.unitPriceAtSale,
            quantity: line.quantity,
            lineTotal: line.lineTotal
          }))
        }
      },
      include: {
        orderLines: true,
        createdByUser: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  
    return addTotalToOrder(updatedOrder);
  }

  // Update without changing order lines
  const updateData = {
    ...(orderData.orderType !== undefined && { orderType: orderData.orderType }),
    ...(orderData.paymentMethod !== undefined && { paymentMethod: orderData.paymentMethod }),
    ...(orderData.paymentStatus && { paymentStatus: orderData.paymentStatus }),
    ...(orderData.customerName !== undefined && { customerName: orderData.customerName }),
    ...(orderData.customerPhone !== undefined && { customerPhone: orderData.customerPhone }),
    ...(orderData.customerAddress !== undefined && { customerAddress: orderData.customerAddress }),
    ...(orderData.deliveryCharges !== undefined && { deliveryCharges: orderData.deliveryCharges }),
    ...(orderData.discount !== undefined && { discount: orderData.discount })
  };

  // If order lines exist but weren't provided, recalculate subtotal from existing lines
  if (Object.keys(updateData).length === 0) {
    return await getOrderById(orderId);
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
    include: {
      orderLines: true,
      createdByUser: {
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });
  
  return addTotalToOrder(updatedOrder);
};

/**
 * Delete an order (only for Manager role)
 * This will cascade delete order lines due to Prisma schema relation
 */
export const deleteOrder = async (orderId) => {
  // First check if order exists
  const order = await getOrderById(orderId);
  if (!order) {
    return null;
  }

  // Delete order (order lines will be cascade deleted)
  await prisma.order.delete({
    where: { id: orderId }
  });

  return order;
};

