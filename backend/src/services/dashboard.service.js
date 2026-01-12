import prisma from '../config/database.js';

/**
 * Helper function to check if a date falls within the custom day cycle (6 AM to 5 AM next day)
 * @param {Date} orderDate - The order creation date
 * @param {Date} targetDate - The target date (date at 6 AM that starts the cycle)
 * @returns {boolean}
 */
const isWithinCustomDayCycle = (orderDate, targetDate) => {
  // Create the start of the cycle (6 AM on target date)
  const cycleStart = new Date(targetDate);
  cycleStart.setHours(6, 0, 0, 0); // 6:00 AM
  
  // Create the end of the cycle (5 AM next day)
  const cycleEnd = new Date(targetDate);
  cycleEnd.setDate(cycleEnd.getDate() + 1);
  cycleEnd.setHours(5, 0, 0, 0); // 5:00 AM next day
  
  return orderDate >= cycleStart && orderDate < cycleEnd;
};

/**
 * Get all unique day cycles from orders (6 AM to 5 AM next day)
 * Includes all completed cycles from first order date to yesterday
 * @param {Array} orders - Array of orders
 * @returns {Array} Array of day cycle dates
 */
const getDayCycles = (orders) => {
  const cycles = new Set();
  
  // Get all cycles that have orders
  orders.forEach(order => {
    const orderDate = new Date(order.createdAt);
    let cycleDate = new Date(orderDate);
    
    // If order is before 6 AM, it belongs to previous day's cycle
    if (orderDate.getHours() < 6) {
      cycleDate.setDate(cycleDate.getDate() - 1);
    }
    
    // Set to start of the day for the cycle
    cycleDate.setHours(0, 0, 0, 0);
    cycles.add(cycleDate.toISOString().split('T')[0]);
  });
  
  // Find the first order date (cycle date) to generate all cycles from there
  let firstCycleDate = null;
  if (orders.length > 0) {
    const firstOrder = orders[orders.length - 1]; // Orders are sorted desc, so last is first
    const firstOrderDate = new Date(firstOrder.createdAt);
    firstCycleDate = new Date(firstOrderDate);
    
    // If order is before 6 AM, it belongs to previous day's cycle
    if (firstOrderDate.getHours() < 6) {
      firstCycleDate.setDate(firstCycleDate.getDate() - 1);
    }
    firstCycleDate.setHours(0, 0, 0, 0);
  }
  
  // Determine the last COMPLETED cycle date (exclude current active cycle)
  const now = new Date();
  let lastCompletedCycleDate = null;
  
  if (now.getHours() >= 6) {
    // If current time is after 6 AM, today's cycle is active
    // So yesterday's cycle is the last completed cycle
    lastCompletedCycleDate = new Date(now);
    lastCompletedCycleDate.setDate(lastCompletedCycleDate.getDate() - 1);
    lastCompletedCycleDate.setHours(0, 0, 0, 0);
  } else {
    // If current time is before 6 AM, we're still in yesterday's cycle (which is active)
    // So the day before yesterday is the last completed cycle
    lastCompletedCycleDate = new Date(now);
    lastCompletedCycleDate.setDate(lastCompletedCycleDate.getDate() - 2);
    lastCompletedCycleDate.setHours(0, 0, 0, 0);
  }
  
  // Generate all COMPLETED cycles from first order date to last completed cycle (inclusive)
  // This ensures all completed cycles are included, even if they have no orders
  // The current/active day cycle is NOT included - it will appear in "Live Day History" only
  if (firstCycleDate && lastCompletedCycleDate) {
    const currentDate = new Date(firstCycleDate);
    
    // Generate all cycles from firstCycleDate to lastCompletedCycleDate (inclusive)
    while (currentDate <= lastCompletedCycleDate) {
      cycles.add(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  return Array.from(cycles).sort().reverse(); // Most recent first
};

/**
 * Calculate statistics for a given period
 * @param {Array} orders - Filtered orders for the period
 * @returns {Object} Statistics object
 */
const calculatePeriodStats = (orders) => {
  let totalRevenue = 0;
  let completedOrders = 0;
  let cancelledOrders = 0;
  let totalItemsQuantity = 0;
  let totalCashAmount = 0;
  let totalOnlineAmount = 0;
  let cashOrdersCount = 0;
  let onlineOrdersCount = 0;
  let totalDeliveryCharges = 0;
  let totalDiscount = 0;
  
  orders.forEach(order => {
    // Count completed orders (FINISHED, DELIVERED, PICKED_UP)
    if (order.status === 'FINISHED' || order.status === 'DELIVERED' || order.status === 'PICKED_UP') {
      completedOrders++;
      
      // Calculate order total: subtotal + deliveryCharges - discount
      const orderTotal = parseFloat(order.subtotal || 0) + parseFloat(order.deliveryCharges || 0) - parseFloat(order.discount || 0);
      totalRevenue += orderTotal;
      
      // Add delivery charges and discount for completed orders
      totalDeliveryCharges += parseFloat(order.deliveryCharges || 0);
      totalDiscount += parseFloat(order.discount || 0);
      
      // Calculate payment method totals for completed orders (using total after discount)
      if (order.paymentMethod === 'CASH') {
        totalCashAmount += orderTotal;
        cashOrdersCount++;
      } else if (order.paymentMethod === 'ONLINE') {
        totalOnlineAmount += orderTotal;
        onlineOrdersCount++;
      }
    }
    
    // Count cancelled orders
    if (order.status === 'CANCELLED') {
      cancelledOrders++;
    }
    
    // Calculate total items quantity - EXCLUDE DRAFT and CANCELLED orders
    if (order.status !== 'DRAFT' && order.status !== 'CANCELLED') {
      if (order.orderLines && Array.isArray(order.orderLines)) {
        order.orderLines.forEach(line => {
          totalItemsQuantity += parseInt(line.quantity || 0);
        });
      }
    }
  });
  
  return {
    totalOrders: orders.length,
    completedOrders,
    cancelledOrders,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalItemsQuantity,
    totalDeliveryCharges: parseFloat(totalDeliveryCharges.toFixed(2)),
    totalDiscount: parseFloat(totalDiscount.toFixed(2)),
    paymentMethods: {
      CASH: {
        amount: parseFloat(totalCashAmount.toFixed(2)),
        count: cashOrdersCount
      },
      ONLINE: {
        amount: parseFloat(totalOnlineAmount.toFixed(2)),
        count: onlineOrdersCount
      }
    }
  };
};

/**
 * Get dashboard statistics
 * @returns {Object} Dashboard statistics
 */
export const getDashboardStats = async () => {
  try {
    // Get all orders with necessary relations
    const orders = await prisma.order.findMany({
      include: {
        orderLines: true,
        createdByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate overall statistics
    const overallStats = calculatePeriodStats(orders);
    
    // Calculate statistics by day cycle (6 AM to 5 AM next day)
    const dayCycles = getDayCycles(orders);
    const dayHistory = {};
    
    dayCycles.forEach(cycleDateStr => {
      const cycleDate = new Date(cycleDateStr + 'T00:00:00');
      const cycleOrders = orders.filter(order => 
        isWithinCustomDayCycle(new Date(order.createdAt), cycleDate)
      );
      
      // Format date like "12-01-2026/12-02-26"
      const startDate = cycleDate;
      const endDate = new Date(cycleDate);
      endDate.setDate(endDate.getDate() + 1);
      
      const dateKey = `${String(startDate.getDate()).padStart(2, '0')}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${startDate.getFullYear()}/${String(endDate.getDate()).padStart(2, '0')}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getFullYear()).slice(-2)}`;
      
      dayHistory[dateKey] = {
        date: dateKey,
        cycleStart: cycleDate.toISOString(),
        ...calculatePeriodStats(cycleOrders)
      };
    });
    
    // Calculate monthly statistics (normal time: 12 AM to 11:59 PM)
    const monthlyStats = {};
    const monthlyMap = new Map();
    
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, []);
      }
      monthlyMap.get(monthKey).push(order);
    });
    
    monthlyMap.forEach((monthOrders, monthKey) => {
      const [year, month] = monthKey.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
      
      monthlyStats[monthKey] = {
        period: monthName,
        ...calculatePeriodStats(monthOrders)
      };
    });
    
    // Calculate yearly statistics (normal time: 12 AM to 11:59 PM)
    const yearlyStats = {};
    const yearlyMap = new Map();
    
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const yearKey = String(orderDate.getFullYear());
      
      if (!yearlyMap.has(yearKey)) {
        yearlyMap.set(yearKey, []);
      }
      yearlyMap.get(yearKey).push(order);
    });
    
    yearlyMap.forEach((yearOrders, yearKey) => {
      yearlyStats[yearKey] = {
        period: yearKey,
        ...calculatePeriodStats(yearOrders)
      };
    });

    // Calculate orders by type
    const ordersByType = {
      DINE: 0,
      TAKEAWAY: 0,
      DELIVERY: 0
    };

    // Calculate orders by status
    const ordersByStatus = {
      DRAFT: 0,
      PREPARING: 0,
      READY: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      PICKED_UP: 0,
      FINISHED: 0,
      CANCELLED: 0
    };

    // Calculate payment method totals
    let totalCashAmount = 0;
    let totalOnlineAmount = 0;
    let cashOrdersCount = 0;
    let onlineOrdersCount = 0;

    // Calculate top items and deals
    const itemQuantityMap = new Map(); // itemId -> { name, quantity, revenue }
    const dealQuantityMap = new Map(); // dealId -> { name, quantity, revenue }

    orders.forEach(order => {
      // Count by type - EXCLUDE DRAFT and CANCELLED orders
      if (order.status !== 'DRAFT' && order.status !== 'CANCELLED') {
        ordersByType[order.orderType] = (ordersByType[order.orderType] || 0) + 1;
      }
      
      // Count by status (include all statuses for informational purposes)
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
      
      // Calculate payment method totals (only from completed orders, using total after discount)
      if (order.status === 'FINISHED' || order.status === 'DELIVERED' || order.status === 'PICKED_UP') {
        const orderTotal = parseFloat(order.subtotal || 0) + parseFloat(order.deliveryCharges || 0) - parseFloat(order.discount || 0);
        if (order.paymentMethod === 'CASH') {
          totalCashAmount += orderTotal;
          cashOrdersCount++;
        } else if (order.paymentMethod === 'ONLINE') {
          totalOnlineAmount += orderTotal;
          onlineOrdersCount++;
        }
      }

      // Calculate top items and deals from order lines - EXCLUDE DRAFT and CANCELLED orders
      if (order.status !== 'DRAFT' && order.status !== 'CANCELLED') {
        if (order.orderLines && Array.isArray(order.orderLines)) {
          order.orderLines.forEach(line => {
            const quantity = parseInt(line.quantity || 0);
            const revenue = parseFloat(line.lineTotal || 0);

            if (line.productType === 'ITEM') {
              if (!itemQuantityMap.has(line.productId)) {
                itemQuantityMap.set(line.productId, {
                  id: line.productId,
                  name: line.nameAtSale,
                  quantity: 0,
                  revenue: 0
                });
              }
              const item = itemQuantityMap.get(line.productId);
              item.quantity += quantity;
              item.revenue += revenue;
            } else if (line.productType === 'DEAL') {
              if (!dealQuantityMap.has(line.productId)) {
                dealQuantityMap.set(line.productId, {
                  id: line.productId,
                  name: line.nameAtSale,
                  quantity: 0,
                  revenue: 0
                });
              }
              const deal = dealQuantityMap.get(line.productId);
              deal.quantity += quantity;
              deal.revenue += revenue;
            }
          });
        }
      }
    });

    // Get top items (sorted by quantity, then by revenue)
    const topItems = Array.from(itemQuantityMap.values())
      .sort((a, b) => {
        if (b.quantity !== a.quantity) {
          return b.quantity - a.quantity;
        }
        return b.revenue - a.revenue;
      })
      .slice(0, 10)
      .map(item => ({
        ...item,
        revenue: parseFloat(item.revenue.toFixed(2))
      }));

    // Get top deals (sorted by quantity, then by revenue)
    const topDeals = Array.from(dealQuantityMap.values())
      .sort((a, b) => {
        if (b.quantity !== a.quantity) {
          return b.quantity - a.quantity;
        }
        return b.revenue - a.revenue;
      })
      .slice(0, 10)
      .map(deal => ({
        ...deal,
        revenue: parseFloat(deal.revenue.toFixed(2))
      }));

    return {
      overview: {
        totalOrders: overallStats.totalOrders,
        completedOrders: overallStats.completedOrders,
        cancelledOrders: overallStats.cancelledOrders,
        totalRevenue: overallStats.totalRevenue,
        totalItemsQuantity: overallStats.totalItemsQuantity,
        totalDeliveryCharges: overallStats.totalDeliveryCharges || 0,
        totalDiscount: overallStats.totalDiscount || 0
      },
      orderSummary: {
        totalOrders: overallStats.totalOrders,
        ordersByType: {
          DINE: ordersByType.DINE || 0,
          TAKEAWAY: ordersByType.TAKEAWAY || 0,
          DELIVERY: ordersByType.DELIVERY || 0
        },
        ordersByStatus: {
          DRAFT: ordersByStatus.DRAFT || 0,
          PREPARING: ordersByStatus.PREPARING || 0,
          READY: ordersByStatus.READY || 0,
          OUT_FOR_DELIVERY: ordersByStatus.OUT_FOR_DELIVERY || 0,
          DELIVERED: ordersByStatus.DELIVERED || 0,
          PICKED_UP: ordersByStatus.PICKED_UP || 0,
          FINISHED: ordersByStatus.FINISHED || 0,
          CANCELLED: ordersByStatus.CANCELLED || 0
        },
        cancelledOrdersCount: ordersByStatus.CANCELLED || 0,
        paymentMethods: {
          CASH: {
            amount: parseFloat(totalCashAmount.toFixed(2)),
            count: cashOrdersCount
          },
          ONLINE: {
            amount: parseFloat(totalOnlineAmount.toFixed(2)),
            count: onlineOrdersCount
          }
        }
      },
      topItems: topItems,
      topDeals: topDeals,
      dayHistory: dayHistory, // Most recent first (already sorted)
      monthly: monthlyStats,
      yearly: yearlyStats,
      recentOrders: orders.slice(0, 10) // Last 10 orders
    };
  } catch (error) {
    console.error('Dashboard stats error:', error);
    throw error;
  }
};

