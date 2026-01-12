import {
  createOrder,
  getMenuItemById,
  getDealById,
  getAllOrderLines,
  getOrderById,
  updateOrder,
  getAllOrders,
  updateOrderStatus,
  deleteOrder
} from '../services/order.service.js';
import { getAllMenuItems } from '../services/menu-item.service.js';
import { getAllDeals } from '../services/deal.service.js';
import { logAuditEvent } from '../utils/auditLogger.js';
import { validateStatusTransition } from '../utils/orderStatusFlow.js';

/**
 * @desc    Get all menu items (for order creation)
 * @route   GET /api/orders/menu-items
 * @access  Private
 */
export const getMenuItemsForOrderController = async (req, res) => {
  try {
    const menuItems = await getAllMenuItems();
    // Filter only active items for order creation
    const activeItems = menuItems.filter(item => item.isActive);

    res.json({
      success: true,
      count: activeItems.length,
      data: { menuItems: activeItems }
    });
  } catch (error) {
    console.error('Get menu items for order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching menu items',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Get all deals (for order creation)
 * @route   GET /api/orders/deals
 * @access  Private
 */
export const getDealsForOrderController = async (req, res) => {
  try {
    const deals = await getAllDeals();
    // Filter only active deals for order creation
    const activeDeals = deals.filter(deal => deal.isActive);

    res.json({
      success: true,
      count: activeDeals.length,
      data: { deals: activeDeals }
    });
  } catch (error) {
    console.error('Get deals for order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching deals',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Create a new order
 * @route   POST /api/orders
 * @access  Private (User and Manager)
 */
export const createOrderController = async (req, res) => {
  try {
    const { orderType, paymentMethod, paymentStatus, customerName, customerPhone, customerAddress, deliveryCharges, discount, orderLines } = req.body;
    const userId = req.user.id;

    // Validate order type
    if (!orderType || !['DINE', 'TAKEAWAY', 'DELIVERY'].includes(orderType)) {
      return res.status(400).json({
        success: false,
        message: 'Order type must be DINE, TAKEAWAY, or DELIVERY'
      });
    }

    // Validate order lines
    if (!orderLines || !Array.isArray(orderLines) || orderLines.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order lines are required. An order must contain at least one item.'
      });
    }

    // Validate delivery requires customer details
    if (orderType === 'DELIVERY') {
      if (!customerName || !customerPhone || !customerAddress) {
        return res.status(400).json({
          success: false,
          message: 'Delivery orders require customer name, phone, and address'
        });
      }
    }

    // Process and validate each order line
    const processedOrderLines = [];
    
    for (const line of orderLines) {
      if (!line.productType || !['ITEM', 'DEAL'].includes(line.productType)) {
        return res.status(400).json({
          success: false,
          message: 'Each order line must have productType as ITEM or DEAL'
        });
      }

      if (!line.productId || !line.quantity || line.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Each order line must have productId and quantity (minimum 1)'
        });
      }

      let product;
      let nameAtSale;
      let unitPriceAtSale;

      if (line.productType === 'ITEM') {
        product = await getMenuItemById(line.productId);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Menu item with ID ${line.productId} not found`
          });
        }
        if (!product.isActive) {
          return res.status(400).json({
            success: false,
            message: `Menu item ${product.name} is not active`
          });
        }
        nameAtSale = product.name;
        unitPriceAtSale = product.price;
      } else if (line.productType === 'DEAL') {
        product = await getDealById(line.productId);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Deal with ID ${line.productId} not found`
          });
        }
        if (!product.isActive) {
          return res.status(400).json({
            success: false,
            message: `Deal ${product.name} is not active`
          });
        }
        nameAtSale = product.name;
        unitPriceAtSale = product.price;
      }

      // Calculate line total
      const lineTotal = parseFloat(unitPriceAtSale) * line.quantity;

      processedOrderLines.push({
        productType: line.productType,
        productId: line.productId,
        nameAtSale,
        unitPriceAtSale: parseFloat(unitPriceAtSale),
        quantity: line.quantity,
        lineTotal: lineTotal
      });
    }

    // Validate payment status if provided
    if (paymentStatus && !['PAID', 'UNPAID'].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Payment status must be PAID or UNPAID'
      });
    }

    // Validate delivery charges if provided
    if (deliveryCharges !== undefined && deliveryCharges !== null) {
      const deliveryChargesNum = parseFloat(deliveryCharges);
      if (isNaN(deliveryChargesNum) || deliveryChargesNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Delivery charges must be a non-negative number'
        });
      }
    }

    // Validate discount if provided
    if (discount !== undefined && discount !== null) {
      const discountNum = parseFloat(discount);
      if (isNaN(discountNum) || discountNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Discount must be a non-negative number'
        });
      }
    }

    const orderData = {
      orderType,
      paymentMethod: paymentMethod || null,
      paymentStatus: paymentStatus || 'UNPAID',
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      customerAddress: customerAddress || null,
      deliveryCharges: deliveryCharges !== undefined && deliveryCharges !== null ? parseFloat(deliveryCharges) : (orderType === 'DELIVERY' ? 0 : undefined),
      discount: discount !== undefined && discount !== null ? parseFloat(discount) : 0,
      orderLines: processedOrderLines
    };

    const order = await createOrder(orderData, userId);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during order creation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Get all order lines
 * @route   GET /api/order-lines
 * @access  Private
 */
export const getAllOrderLinesController = async (req, res) => {
  try {
    const orderLines = await getAllOrderLines();

    res.json({
      success: true,
      count: orderLines.length,
      data: { orderLines }
    });
  } catch (error) {
    console.error('Get all order lines error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching order lines',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Update an existing order
 * @route   PUT /api/orders/:id
 * @access  Private (User and Manager)
 */
export const updateOrderController = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderType, paymentMethod, paymentStatus, customerName, customerPhone, customerAddress, deliveryCharges, discount, orderLines } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;
    const username = req.user.username;

    // Check if order exists
    const existingOrder = await getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Editing Rules:
    // 1. Only DRAFT orders are editable (except payment status which can be updated at any status)
    // 2. USER role cannot edit orders that are PREPARING or beyond (except payment status)
    // 3. MANAGER can re-open PREPARING orders back to DRAFT (handled via status endpoint)
    // 4. Payment status can be updated at any order status
    
    // Validate order type if provided
    if (orderType !== undefined && !['DINE', 'TAKEAWAY', 'DELIVERY'].includes(orderType)) {
      return res.status(400).json({
        success: false,
        message: 'Order type must be DINE, TAKEAWAY, or DELIVERY'
      });
    }

    // Check if this is only a payment status update (allowed at any status)
    const isOnlyPaymentStatusUpdate = paymentStatus !== undefined && 
                                      orderType === undefined &&
                                      paymentMethod === undefined && 
                                      customerName === undefined && 
                                      customerPhone === undefined && 
                                      customerAddress === undefined && 
                                      deliveryCharges === undefined &&
                                      discount === undefined &&
                                      orderLines === undefined;
    
    // If not just a payment status update, apply the normal editing restrictions
    if (!isOnlyPaymentStatusUpdate && existingOrder.status !== 'DRAFT') {
      // If user is USER role, block editing of non-DRAFT orders
      if (userRole === 'User') {
        return res.status(403).json({
          success: false,
          message: 'Only DRAFT orders can be edited. Current order status: ' + existingOrder.status
        });
      }
      
      // If user is MANAGER but order is not DRAFT or PREPARING, block editing
      // (Managers can only reopen PREPARING orders to DRAFT via status endpoint)
      if (userRole === 'Manager' && existingOrder.status !== 'PREPARING') {
        return res.status(403).json({
          success: false,
          message: `Order status is ${existingOrder.status}. Only DRAFT orders can be edited. Managers can reopen PREPARING orders to DRAFT first.`
        });
      }
      
      // If Manager tries to edit a PREPARING order directly, inform them they need to reopen it first
      if (userRole === 'Manager' && existingOrder.status === 'PREPARING') {
        return res.status(403).json({
          success: false,
          message: 'Cannot edit PREPARING order directly. Please change status to DRAFT first using POST /orders/:id/status endpoint.'
        });
      }
    }

    // Validate payment method if provided
    if (paymentMethod !== undefined && paymentMethod !== null && !['CASH', 'ONLINE'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Payment method must be CASH or ONLINE'
      });
    }

    // Validate payment status if provided
    if (paymentStatus && !['PAID', 'UNPAID'].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Payment status must be PAID or UNPAID'
      });
    }

    // If orderLines are provided, validate and process them
    let processedOrderLines = null;
    if (orderLines !== undefined) {
      if (!Array.isArray(orderLines) || orderLines.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Order lines must be a non-empty array if provided'
        });
      }

      processedOrderLines = [];
      
      for (const line of orderLines) {
        if (!line.productType || !['ITEM', 'DEAL'].includes(line.productType)) {
          return res.status(400).json({
            success: false,
            message: 'Each order line must have productType as ITEM or DEAL'
          });
        }

        if (!line.productId || !line.quantity || line.quantity < 1) {
          return res.status(400).json({
            success: false,
            message: 'Each order line must have productId and quantity (minimum 1)'
          });
        }

        let product;
        let nameAtSale;
        let unitPriceAtSale;

        if (line.productType === 'ITEM') {
          product = await getMenuItemById(line.productId);
          if (!product) {
            return res.status(404).json({
              success: false,
              message: `Menu item with ID ${line.productId} not found`
            });
          }
          if (!product.isActive) {
            return res.status(400).json({
              success: false,
              message: `Menu item ${product.name} is not active`
            });
          }
          nameAtSale = product.name;
          unitPriceAtSale = product.price;
        } else if (line.productType === 'DEAL') {
          product = await getDealById(line.productId);
          if (!product) {
            return res.status(404).json({
              success: false,
              message: `Deal with ID ${line.productId} not found`
            });
          }
          if (!product.isActive) {
            return res.status(400).json({
              success: false,
              message: `Deal ${product.name} is not active`
            });
          }
          nameAtSale = product.name;
          unitPriceAtSale = product.price;
        }

        // Calculate line total
        const lineTotal = parseFloat(unitPriceAtSale) * line.quantity;

        processedOrderLines.push({
          productType: line.productType,
          productId: line.productId,
          nameAtSale,
          unitPriceAtSale: parseFloat(unitPriceAtSale),
          quantity: line.quantity,
          lineTotal: lineTotal
        });
      }
    }

    // Validate delivery charges if provided
    if (deliveryCharges !== undefined && deliveryCharges !== null) {
      const deliveryChargesNum = parseFloat(deliveryCharges);
      if (isNaN(deliveryChargesNum) || deliveryChargesNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Delivery charges must be a non-negative number'
        });
      }
    }

    // Validate discount if provided
    if (discount !== undefined && discount !== null) {
      const discountNum = parseFloat(discount);
      if (isNaN(discountNum) || discountNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Discount must be a non-negative number'
        });
      }
    }

    // Determine the final order type (use new if provided, otherwise existing)
    const finalOrderType = orderType !== undefined ? orderType : existingOrder.orderType;

    // Validate delivery orders require customer details
    // Check if order type is DELIVERY or changing TO DELIVERY
    if (finalOrderType === 'DELIVERY') {
      const finalCustomerName = customerName !== undefined ? customerName : existingOrder.customerName;
      const finalCustomerPhone = customerPhone !== undefined ? customerPhone : existingOrder.customerPhone;
      const finalCustomerAddress = customerAddress !== undefined ? customerAddress : existingOrder.customerAddress;
      
      if (!finalCustomerName || !finalCustomerPhone || !finalCustomerAddress) {
        return res.status(400).json({
          success: false,
          message: 'Delivery orders require customer name, phone, and address'
        });
      }

      // If changing to DELIVERY, ensure delivery charges are set
      if (orderType === 'DELIVERY' && deliveryCharges === undefined && existingOrder.deliveryCharges === null) {
        return res.status(400).json({
          success: false,
          message: 'Delivery orders require delivery charges'
        });
      }
    }

    const orderData = {
      ...(orderType !== undefined && { orderType }),
      ...(paymentMethod !== undefined && { paymentMethod }),
      ...(paymentStatus && { paymentStatus }),
      ...(customerName !== undefined && { customerName }),
      ...(customerPhone !== undefined && { customerPhone }),
      ...(customerAddress !== undefined && { customerAddress }),
      ...(deliveryCharges !== undefined && { deliveryCharges: parseFloat(deliveryCharges) }),
      ...(discount !== undefined && discount !== null && { discount: parseFloat(discount) }),
      ...(processedOrderLines && { orderLines: processedOrderLines })
    };

    const updatedOrder = await updateOrder(id, orderData);

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: { order: updatedOrder }
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during order update',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Get all orders
 * @route   GET /api/orders
 * @access  Private
 */
export const getAllOrdersController = async (req, res) => {
  try {
    const { status, orderType, paymentStatus, page, limit } = req.query;
    
    // Validate status if provided
    const validStatuses = ['DRAFT', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PICKED_UP', 'FINISHED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`
      });
    }

    // Validate orderType if provided
    const validOrderTypes = ['DINE', 'TAKEAWAY', 'DELIVERY'];
    if (orderType && !validOrderTypes.includes(orderType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid orderType. Valid order types are: ${validOrderTypes.join(', ')}`
      });
    }

    // Validate paymentStatus if provided
    const validPaymentStatuses = ['PAID', 'UNPAID'];
    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid paymentStatus. Valid payment statuses are: ${validPaymentStatuses.join(', ')}`
      });
    }

    // Validate pagination parameters
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;
    
    if (pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be greater than 0'
      });
    }
    
    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }
    
    const result = await getAllOrders({
      status,
      orderType,
      paymentStatus,
      page: pageNum,
      limit: limitNum
    });

    res.json({
      success: true,
      count: result.orders.length,
      pagination: result.pagination,
      data: { orders: result.orders }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching orders',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Get order by ID (Order details)
 * @route   GET /api/orders/:id
 * @access  Private
 */
export const getOrderByIdController = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await getOrderById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Update order status
 * @route   POST /api/orders/:id/status
 * @access  Private (User and Manager)
 */
export const updateOrderStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;
    const username = req.user.username;

    // Check if order exists
    const existingOrder = await getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Validate status
    if (!status || !['DRAFT', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PICKED_UP', 'FINISHED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status. Must be one of: DRAFT, PREPARING, READY, OUT_FOR_DELIVERY, DELIVERED, PICKED_UP, FINISHED, CANCELLED'
      });
    }

    // Validate status transition based on order type flow
    const isManager = userRole === 'Manager';
    const validation = validateStatusTransition(
      existingOrder.orderType,
      existingOrder.status,
      status,
      isManager
    );

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    // Log audit event for manager override (backward transitions)
    if (validation.isManagerOverride) {
      logAuditEvent({
        action: 'ORDER_REOPENED',
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        userId,
        username,
        userRole,
        details: {
          previousStatus: existingOrder.status,
          newStatus: status,
          orderType: existingOrder.orderType,
          reason: `Manager override: Reverting order from ${existingOrder.status} to ${status}`
        }
      });
    }

    const updatedOrder = await updateOrderStatus(id, status);

    // Log audit event for status change (if not already logged above as manager override)
    if (!validation.isManagerOverride) {
      logAuditEvent({
        action: status === 'CANCELLED' ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED',
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        userId,
        username,
        userRole,
        details: {
          previousStatus: existingOrder.status,
          newStatus: status,
          orderType: existingOrder.orderType
        }
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order: updatedOrder }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during order status update',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Delete an order (Manager only)
 * @route   DELETE /api/orders/:id
 * @access  Private (Manager only)
 */
export const deleteOrderController = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const username = req.user.username;
    const userRole = req.user.role;

    // Check if order exists
    const existingOrder = await getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Delete the order
    const deletedOrder = await deleteOrder(id);

    // Log audit event
    logAuditEvent({
      action: 'ORDER_DELETED',
      orderId: existingOrder.id,
      orderNumber: existingOrder.orderNumber,
      userId,
      username,
      userRole,
      details: {
        deletedOrder: {
          orderNumber: existingOrder.orderNumber,
          status: existingOrder.status,
          orderType: existingOrder.orderType,
          subtotal: existingOrder.subtotal
        },
        reason: 'Order deleted by manager'
      }
    });

    res.json({
      success: true,
      message: 'Order deleted successfully',
      data: {
        deletedOrder: {
          id: deletedOrder.id,
          orderNumber: deletedOrder.orderNumber,
          status: deletedOrder.status
        }
      }
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during order deletion',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

