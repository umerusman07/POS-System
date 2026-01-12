/**
 * Order status flow validation
 * Defines valid status transitions based on order type
 */

/**
 * Valid status transitions for each order type
 */
const STATUS_FLOWS = {
  DINE: {
    // Dine-in flow: DRAFT -> PREPARING -> READY -> FINISHED
    allowedTransitions: {
      DRAFT: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['FINISHED', 'CANCELLED'],
      FINISHED: [], // FINISHED is terminal
      CANCELLED: [], // CANCELLED is terminal
      OUT_FOR_DELIVERY: [], // Not applicable for DINE
      DELIVERED: [], // Not applicable for DINE
      PICKED_UP: [] // Not applicable for DINE
    },
    // Manager can go back to previous status for corrections
    managerOverrides: {
      PREPARING: ['DRAFT'],
      READY: ['PREPARING'],
      FINISHED: ['READY']
    }
  },
  TAKEAWAY: {
    // Takeaway flow: DRAFT -> PREPARING -> READY -> PICKED_UP -> FINISHED
    allowedTransitions: {
      DRAFT: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['PICKED_UP', 'CANCELLED'],
      PICKED_UP: ['FINISHED', 'CANCELLED'],
      FINISHED: [], // FINISHED is terminal
      CANCELLED: [], // CANCELLED is terminal
      OUT_FOR_DELIVERY: [], // Not applicable for TAKEAWAY
      DELIVERED: [] // Not applicable for TAKEAWAY
    },
    // Manager can go back to previous status for corrections
    managerOverrides: {
      PREPARING: ['DRAFT'],
      READY: ['PREPARING'],
      PICKED_UP: ['READY'],
      FINISHED: ['PICKED_UP']
    }
  },
  DELIVERY: {
    // Delivery flow: DRAFT -> PREPARING -> READY -> OUT_FOR_DELIVERY -> DELIVERED -> FINISHED
    allowedTransitions: {
      DRAFT: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
      DELIVERED: ['FINISHED', 'CANCELLED'],
      FINISHED: [], // FINISHED is terminal
      CANCELLED: [], // CANCELLED is terminal
      PICKED_UP: [] // Not applicable for DELIVERY
    },
    // Manager can go back to previous status for corrections
    managerOverrides: {
      PREPARING: ['DRAFT'],
      READY: ['PREPARING'],
      OUT_FOR_DELIVERY: ['READY'],
      DELIVERED: ['OUT_FOR_DELIVERY'],
      FINISHED: ['DELIVERED']
    }
  }
};

/**
 * Validate if a status transition is allowed for the given order type
 * @param {string} orderType - Order type (DINE, TAKEAWAY, DELIVERY)
 * @param {string} currentStatus - Current order status
 * @param {string} newStatus - New order status
 * @param {boolean} isManager - Whether the user is a Manager
 * @returns {Object} Validation result with isValid and message
 */
export const validateStatusTransition = (orderType, currentStatus, newStatus, isManager = false) => {
  const flow = STATUS_FLOWS[orderType];
  
  if (!flow) {
    return {
      isValid: false,
      message: `Invalid order type: ${orderType}`
    };
  }

  // CANCELLED can be set from any status (manager-only)
  if (newStatus === 'CANCELLED') {
    if (!isManager) {
      return {
        isValid: false,
        message: 'Only Managers can cancel orders'
      };
    }
    return {
      isValid: true,
      message: 'Status transition allowed'
    };
  }

  // Check if transition is in allowed transitions
  const allowedNextStatuses = flow.allowedTransitions[currentStatus] || [];
  if (allowedNextStatuses.includes(newStatus)) {
    return {
      isValid: true,
      message: 'Status transition allowed'
    };
  }

  // Check manager overrides (e.g., PREPARING -> DRAFT)
  if (isManager) {
    const overrideStatuses = flow.managerOverrides[currentStatus] || [];
    if (overrideStatuses.includes(newStatus)) {
      return {
        isValid: true,
        message: 'Status transition allowed (Manager override)',
        isManagerOverride: true
      };
    }
  }

  // Invalid transition
  const validStatuses = [...allowedNextStatuses];
  if (isManager && flow.managerOverrides[currentStatus]) {
    validStatuses.push(...flow.managerOverrides[currentStatus]);
  }

  return {
    isValid: false,
    message: `Invalid status transition from ${currentStatus} to ${newStatus} for ${orderType} order. Valid next statuses: ${validStatuses.join(', ')}`
  };
};

/**
 * Get valid next statuses for an order
 * @param {string} orderType - Order type (DINE, TAKEAWAY, DELIVERY)
 * @param {string} currentStatus - Current order status
 * @param {boolean} isManager - Whether the user is a Manager
 * @returns {Array} Array of valid next statuses
 */
export const getValidNextStatuses = (orderType, currentStatus, isManager = false) => {
  const flow = STATUS_FLOWS[orderType];
  
  if (!flow) {
    return [];
  }

  const validStatuses = [...(flow.allowedTransitions[currentStatus] || [])];
  
  // Add CANCELLED if manager (can cancel from any status, except terminal statuses)
  if (isManager && currentStatus !== 'CANCELLED' && currentStatus !== 'FINISHED') {
    if (!validStatuses.includes('CANCELLED')) {
      validStatuses.push('CANCELLED');
    }
  }
  
  // Add manager override statuses
  if (isManager && flow.managerOverrides[currentStatus]) {
    flow.managerOverrides[currentStatus].forEach(status => {
      if (!validStatuses.includes(status)) {
        validStatuses.push(status);
      }
    });
  }
  
  return validStatuses;
};

