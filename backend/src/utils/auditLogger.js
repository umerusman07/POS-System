/**
 * Audit logger utility
 * Logs order-related actions for audit purposes
 * TODO: In the future, this could be enhanced to store logs in a database
 */

/**
 * Log an audit event
 * @param {Object} params - Audit log parameters
 * @param {string} params.action - Action performed (e.g., 'ORDER_STATUS_CHANGED', 'ORDER_REOPENED')
 * @param {string} params.orderId - Order ID
 * @param {string} params.orderNumber - Order number
 * @param {string} params.userId - User ID who performed the action
 * @param {string} params.username - Username who performed the action
 * @param {string} params.userRole - User role
 * @param {Object} params.details - Additional details about the action
 */
export const logAuditEvent = ({
  action,
  orderId,
  orderNumber,
  userId,
  username,
  userRole,
  details = {}
}) => {
  const auditLog = {
    timestamp: new Date().toISOString(),
    action,
    orderId,
    orderNumber,
    userId,
    username,
    userRole,
    details
  };

  // Log to console (can be enhanced to write to database/file)
  console.log('[AUDIT LOG]', JSON.stringify(auditLog, null, 2));

  return auditLog;
};

