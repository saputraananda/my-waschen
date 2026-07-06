/**
 * Real-time Event Broadcasting Utility
 * Bug Fix 8: Reschedule Real-time Broadcast (Requirements 2.12)
 * 
 * This utility provides functions to broadcast real-time events via WebSocket/SSE
 * to connected clients for instant UI updates without manual refresh.
 */

// Socket.IO instance will be injected from server.js
let ioInstance = null;

/**
 * Initialize the Socket.IO instance
 * Call this from server.js after creating Socket.IO server
 */
export const initializeSocketIO = (io) => {
  ioInstance = io;
  console.log('[realtimeEvents] Socket.IO instance initialized');
};

/**
 * Broadcast transaction reschedule event to outlet channel
 * 
 * @param {number} transactionId - ID of the rescheduled transaction
 * @param {number} outletId - ID of the outlet (for channel routing)
 * @param {object} data - Event data containing old and new schedule info
 */
export const broadcastTransactionRescheduled = (transactionId, outletId, data) => {
  if (!ioInstance) {
    console.warn('[broadcastTransactionRescheduled] Socket.IO not initialized. Real-time broadcast skipped.');
    return false;
  }
  
  const event = {
    type: 'transaction.rescheduled',
    transaction_id: transactionId,
    outlet_id: outletId,
    timestamp: new Date().toISOString(),
    data: {
      transaction_code: data.transaction_code || null,
      old_pickup_schedule_at: data.old_pickup_schedule_at || null,
      new_pickup_schedule_at: data.new_pickup_schedule_at || null,
      old_delivery_schedule_at: data.old_delivery_schedule_at || null,
      new_delivery_schedule_at: data.new_delivery_schedule_at || null,
      changed_by_user_id: data.changed_by_user_id || null,
      changed_by_user_name: data.changed_by_user_name || 'Unknown',
      reason: data.reason || null,
    },
  };
  
  // Emit to outlet-specific channel
  const channelName = `outlet:${outletId}`;
  ioInstance.to(channelName).emit('transaction.rescheduled', event);
  
  console.log(`[broadcastTransactionRescheduled] Event emitted to channel: ${channelName}`, {
    transaction_id: transactionId,
    transaction_code: data.transaction_code,
  });
  
  return true;
};

/**
 * Broadcast transaction status change event
 * (Bonus feature - can be used for other real-time updates)
 * 
 * @param {number} transactionId
 * @param {number} outletId
 * @param {object} data - { old_status, new_status, changed_by }
 */
export const broadcastTransactionStatusChanged = (transactionId, outletId, data) => {
  if (!ioInstance) {
    console.warn('[broadcastTransactionStatusChanged] Socket.IO not initialized');
    return false;
  }
  
  const event = {
    type: 'transaction.status_changed',
    transaction_id: transactionId,
    outlet_id: outletId,
    timestamp: new Date().toISOString(),
    data: {
      transaction_code: data.transaction_code || null,
      old_status: data.old_status,
      new_status: data.new_status,
      changed_by_user_id: data.changed_by_user_id || null,
      changed_by_user_name: data.changed_by_user_name || 'System',
    },
  };
  
  const channelName = `outlet:${outletId}`;
  ioInstance.to(channelName).emit('transaction.status_changed', event);
  
  console.log(`[broadcastTransactionStatusChanged] Event emitted to channel: ${channelName}`);
  
  return true;
};

/**
 * Broadcast new transaction created event
 * (Bonus feature - useful for dashboard notifications)
 */
export const broadcastTransactionCreated = (transactionId, outletId, data) => {
  if (!ioInstance) {
    console.warn('[broadcastTransactionCreated] Socket.IO not initialized');
    return false;
  }
  
  const event = {
    type: 'transaction.created',
    transaction_id: transactionId,
    outlet_id: outletId,
    timestamp: new Date().toISOString(),
    data: {
      transaction_code: data.transaction_code,
      customer_name: data.customer_name,
      total_paid: data.total_paid,
      created_by_user_id: data.created_by_user_id || null,
    },
  };
  
  const channelName = `outlet:${outletId}`;
  ioInstance.to(channelName).emit('transaction.created', event);
  
  return true;
};

/**
 * Broadcast production item stage change event
 * (Bonus feature - useful for production dashboard)
 */
export const broadcastProductionStageChanged = (transactionId, itemId, outletId, data) => {
  if (!ioInstance) {
    console.warn('[broadcastProductionStageChanged] Socket.IO not initialized');
    return false;
  }
  
  const event = {
    type: 'production.stage_changed',
    transaction_id: transactionId,
    item_id: itemId,
    outlet_id: outletId,
    timestamp: new Date().toISOString(),
    data: {
      transaction_code: data.transaction_code,
      service_name: data.service_name,
      old_stage: data.old_stage,
      new_stage: data.new_stage,
      pic_user_id: data.pic_user_id || null,
      pic_user_name: data.pic_user_name || 'Unknown',
    },
  };
  
  const channelName = `outlet:${outletId}`;
  ioInstance.to(channelName).emit('production.stage_changed', event);
  
  return true;
};

/**
 * Get Socket.IO instance (for testing or advanced usage)
 */
export const getSocketIO = () => {
  return ioInstance;
};

/**
 * Check if Socket.IO is initialized
 */
export const isSocketIOInitialized = () => {
  return ioInstance !== null;
};
