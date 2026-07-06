
import { rp } from '../../src/utils/helpers.js';
import { poolWaschenPos } from '../db/connection.js';

// Helper: Format phone number (remove leading 0, add country code if needed)
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  let cleaned = String(phone).replace(/\D/g, '');
  // If starts with 0, replace with 62 (Indonesia)
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  // If doesn't start with country code, assume 62
  if (!cleaned.startsWith('6')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
};

// ─── Helper: Get outlet info for notifications ─────────────────────────────────
async function getOutletInfo(outletId) {
  try {
    const [rows] = await poolWaschenPos.execute(
      'SELECT name, address, phone FROM mst_outlet WHERE id = ? LIMIT 1',
      [outletId]
    );
    if (rows.length > 0) {
      return {
        name: rows[0].name || 'Outlet Kami',
        address: rows[0].address || '',
        phone: rows[0].phone || '',
      };
    }
  } catch (err) {
    console.warn('[whatsappService] Failed to get outlet info:', err.message);
  }
  return { name: 'Outlet Kami', address: '', phone: '' };
}

// Helper: Send WhatsApp notification (placeholder for real API integration)
export const sendWhatsAppNotification = async ({
  toPhone,
  template,
  variables = {},
}) => {
  try {
    const formattedPhone = formatPhoneNumber(toPhone);
    if (!formattedPhone) {
      console.warn('[whatsappService] Invalid phone number:', toPhone);
      return { success: false, message: 'Invalid phone number' };
    }

    // TODO: Replace with actual WhatsApp Business API / webhook integration
    // Examples:
    // - WhatsApp Business API
    // - Wati
    // - Twilio
    // - ChatAPI

    // For now, log the notification as a placeholder
    console.log('[whatsappService] Sending WhatsApp notification:', {
      to: formattedPhone,
      template,
      variables,
    });

    // Return success for now
    return { success: true, message: 'Notification sent (placeholder)' };
  } catch (error) {
    console.error('[whatsappService] Error sending notification:', error);
    return { success: false, message: error.message };
  }
};

// Template: Order created
export const sendOrderCreatedNotification = async (customer, transaction) => {
  return sendWhatsAppNotification({
    toPhone: customer.phone,
    template: 'order_created',
    variables: {
      customerName: customer.name,
      transactionNo: transaction.transaction_no,
      totalAmount: rp(transaction.total),
    },
  });
};

// Template: Order status updated
export const sendOrderStatusUpdatedNotification = async (customer, transaction, newStatus) => {
  const statusText = {
    'baru': 'Diterima',
    'cuci': 'Dicuci',
    'setrika': 'Disetrika',
    'packing': 'Dipacking',
    'selesai': 'Selesai',
    'diambil': 'Diambil',
    'batal': 'Dibatalkan',
  }[newStatus] || newStatus;

  return sendWhatsAppNotification({
    toPhone: customer.phone,
    template: 'order_status_updated',
    variables: {
      customerName: customer.name,
      transactionNo: transaction.transaction_no,
      newStatus: statusText,
    },
  });
};

// Template: Order ready for pickup
// Called when ALL items in a transaction are marked 'ready'
export const sendOrderReadyNotification = async (customer, transaction, outletInfo = null) => {
  const outlet = outletInfo || await getOutletInfo(transaction.outlet_id);

  return sendWhatsAppNotification({
    toPhone: customer.phone,
    template: 'order_ready',
    variables: {
      customerName: customer.name,
      transactionNo: transaction.transaction_no,
      outletName: outlet.name,
      outletPhone: outlet.phone,
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Notification: Production Ready (all items packed)
// Called automatically when production status = 'ready' for all items
// ─────────────────────────────────────────────────────────────────────────────
export const sendProductionReadyNotification = async ({
  customerPhone,
  customerName,
  transactionNo,
  transactionId,
  customerId,
  outletId,
  pickupType = 'pickup',
  pickupScheduleAt = null,
  sentBy = null, // user ID who triggered (null for auto)
}) => {
  const outlet = await getOutletInfo(outletId);

  // Determine message based on pickup type
  let messageBody = '';
  if (pickupType === 'delivery') {
    messageBody = `Hai ${customerName}! 👋

🥳 Pesanan Anda sudah SIAP!

📋 No. Nota: ${transactionNo}
🏪 Outlet: ${outlet.name}
${outlet.address ? `📍 Alamat: ${outlet.address}` : ''}
${outlet.phone ? `📞 Kontak: ${outlet.phone}` : ''}

Kami akan segera mengantarkan pesanan Anda. Mohon bersiap untuk menerima delivery.

Terima kasih sudah percaya pada ${outlet.name}! 🙏`;
  } else {
    // Pickup
    let scheduleText = '';
    if (pickupScheduleAt) {
      const pickupDate = new Date(pickupScheduleAt);
      const timeStr = pickupDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const dateStr = pickupDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
      scheduleText = `\n📅 Jadwal Ambil: ${dateStr} pukul ${timeStr}`;
    }

    messageBody = `Hai ${customerName}! 👋

🥳 Pesanan Anda sudah SIAP untuk diambil!

📋 No. Nota: ${transactionNo}
🏪 Outlet: ${outlet.name}
${outlet.address ? `📍 Alamat: ${outlet.address}` : ''}
${outlet.phone ? `📞 Kontak: ${outlet.phone}` : ''}${scheduleText}

Silakan datang ke outlet kami untuk mengambil pesanan. Jangan lupa membawa nota sebagai bukti pengambilan ya!

Terima kasih sudah percaya pada ${outlet.name}! 🙏`;
  }

  const formattedPhone = formatPhoneNumber(customerPhone);

  // Log to tr_notification table
  try {
    await poolWaschenPos.execute(`
      INSERT INTO tr_notification (
        transaction_id, template_id, type, send_mode,
        recipient_customer_id, wa_number, wa_link,
        message_body, status, sent_by, sent_at, created_at
      ) VALUES (?, NULL, 'selesai', 'auto_production', ?, ?, NULL, ?, 'queued', ?, NOW(), NOW())
    `, [
      transactionId || null,
      customerId || null,
      formattedPhone,
      messageBody,
      sentBy || 1, // Default to user ID 1 for auto-triggered
    ]);
    console.log(`[whatsappService] Notification logged to tr_notification for ${transactionNo}`);
  } catch (logErr) {
    console.warn('[whatsappService] Failed to log notification:', logErr.message);
  }

  // Log the notification for now (actual WhatsApp API integration placeholder)
  console.log('[whatsappService] Production Ready Notification:', {
    to: formattedPhone,
    transactionNo,
    pickupType,
    outlet: outlet.name,
  });

  // TODO: Replace with actual WhatsApp Business API / webhook integration
  return {
    success: true,
    message: 'Notification queued (placeholder)',
    data: {
      phone: formattedPhone,
      message: messageBody,
      transactionNo,
      outletName: outlet.name,
    }
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Notification: Delay Warning
// Called when estimated_done_at is exceeded
// ─────────────────────────────────────────────────────────────────────────────
export const sendDelayNotification = async ({
  customerPhone,
  customerName,
  transactionNo,
  transactionId,
  outletId,
  estimatedDoneAt,
  currentStage,
}) => {
  const outlet = await getOutletInfo(outletId);
  const estimatedDate = new Date(estimatedDoneAt);
  const dateStr = estimatedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  const messageBody = `Hai ${customerName}! 🙏

Mohon maaf atas keterlambatan pesanan Anda.

📋 No. Nota: ${transactionNo}
⏰ Estimasi: ${dateStr}
🔄 Status Saat Ini: ${currentStage || 'Sedang diproses'}

Tim kami sedang berusaha menyelesaikan pesanan Anda secepat mungkin.

Kami akan segera menghubungi Anda begitu pesanan siap.

Terima kasih atas kesabarannya! 🙏`;

  const formattedPhone = formatPhoneNumber(customerPhone);

  // Log to tr_notification table
  try {
    await poolWaschenPos.execute(`
      INSERT INTO tr_notification (
        transaction_id, template_id, type, send_mode,
        recipient_customer_id, wa_number, wa_link,
        message_body, status, sent_by, sent_at, created_at
      ) VALUES (?, NULL, 'pickup_reminder', 'cron_job', NULL, ?, NULL, ?, 'queued', 1, NOW(), NOW())
    `, [
      transactionId || null,
      formattedPhone,
      messageBody,
    ]);
    console.log(`[whatsappService] Delay notification logged to tr_notification for ${transactionNo}`);
  } catch (logErr) {
    console.warn('[whatsappService] Failed to log delay notification:', logErr.message);
  }

  console.log('[whatsappService] Delay Warning Notification:', {
    to: formattedPhone,
    transactionNo,
  });

  return {
    success: true,
    message: 'Delay notification queued (placeholder)',
    data: {
      phone: formattedPhone,
      message: messageBody,
      transactionNo,
    }
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Notification: Pickup Reminder
// Called 1 hour before scheduled pickup time
// ─────────────────────────────────────────────────────────────────────────────
export const sendPickupReminderNotification = async ({
  customerPhone,
  customerName,
  transactionNo,
  transactionId,
  outletId,
  pickupScheduleAt,
  outletName,
  outletAddress,
  outletPhone,
}) => {
  const outlet = outletName ? { name: outletName, address: outletAddress, phone: outletPhone } : await getOutletInfo(outletId);

  // Format pickup time
  let pickupTimeStr = '';
  if (pickupScheduleAt) {
    const pickupDate = new Date(pickupScheduleAt);
    pickupTimeStr = pickupDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  const messageBody = `Hai ${customerName}! 👋

⏰ Pengingat: Pesanan Anda siap diambil!

📋 No. Nota: ${transactionNo}
🏪 Outlet: ${outlet.name}
${outlet.address ? `📍 Alamat: ${outlet.address}` : ''}
${outlet.phone ? `📞 Kontak: ${outlet.phone}` : ''}
${pickupTimeStr ? `🕐 Jadwal Ambil: ${pickupTimeStr}` : ''}

Pesanan Anda sudah menunggu di outlet kami! Segera ambil ya~

Jangan lupa membawa nota sebagai bukti pengambilan. Terima kasih! 🙏`;

  const formattedPhone = formatPhoneNumber(customerPhone);

  // Log to tr_notification table
  try {
    await poolWaschenPos.execute(`
      INSERT INTO tr_notification (
        transaction_id, template_id, type, send_mode,
        recipient_customer_id, wa_number, wa_link,
        message_body, status, sent_by, sent_at, created_at
      ) VALUES (?, NULL, 'pickup_reminder', 'cron_job', NULL, ?, NULL, ?, 'queued', 1, NOW(), NOW())
    `, [
      transactionId || null,
      formattedPhone,
      messageBody,
    ]);
    console.log(`[whatsappService] Pickup reminder logged to tr_notification for ${transactionNo}`);
  } catch (logErr) {
    console.warn('[whatsappService] Failed to log pickup reminder:', logErr.message);
  }

  console.log('[whatsappService] Pickup Reminder Notification:', {
    to: formattedPhone,
    transactionNo,
    pickupTime: pickupTimeStr,
  });

  return {
    success: true,
    message: 'Pickup reminder queued (placeholder)',
    data: {
      phone: formattedPhone,
      message: messageBody,
      transactionNo,
    }
  };
};
