// ─────────────────────────────────────────────────────────────────────────────
// pickupReminderCron.js — Pickup Reminder Notification System
// Task 31.3: Create pickup reminder notifications
// Phase 5: Implement Auto-Notification System
// ─────────────────────────────────────────────────────────────────────────────
// Cron Job: Send pickup reminders 1 hour before scheduled pickup time
// Runs every 15 minutes during operating hours (08:00 - 20:00)
// ─────────────────────────────────────────────────────────────────────────────
import cron from 'node-cron';
import { poolWaschenPos } from '../db/connection.js';
import { sendPickupReminderNotification } from '../services/whatsappService.js';

const isProduction = process.env.NODE_ENV === 'production';

// ── Logging Helper ──────────────────────────────────────────────────────────
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [PickupReminderCron] [${level}]`;
  if (level === 'ERROR') {
    console.error(prefix, message, ...args);
  } else {
    console.log(prefix, message, ...args);
  }
}

// ─── Get pickup reminder settings ──────────────────────────────────────────────
async function getSettings() {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT setting_key, setting_value FROM mst_config WHERE setting_key IN ('pickup_reminder_enabled', 'pickup_reminder_minutes_before')`
    );
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    return {
      enabled: settings['pickup_reminder_enabled'] !== '0',
      minutesBefore: parseInt(settings['pickup_reminder_minutes_before'] || '60', 10), // Default 1 hour before
    };
  } catch (err) {
    console.warn('[pickupReminderCron] Failed to get settings, using defaults:', err.message);
    return { enabled: true, minutesBefore: 60 };
  }
}

// ─── Check if reminder already sent ─────────────────────────────────────────────
async function hasReminderSent(transactionId) {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) as cnt FROM tr_notification
       WHERE transaction_id = ? AND type = 'pickup_reminder'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [transactionId]
    );
    return rows[0].cnt > 0;
  } catch {
    return false;
  }
}

// ─── Main: Process pickup reminders ────────────────────────────────────────────
export async function processPickupReminders() {
  const settings = await getSettings();

  if (!settings.enabled) {
    log('INFO', 'Pickup reminder cron is disabled');
    return { processedCount: 0, sentCount: 0, skippedCount: 0 };
  }

  const now = new Date();
  const hour = now.getHours();

  // Only run during operating hours (08:00 - 20:00)
  if (hour < 8 || hour >= 20) {
    log('INFO', 'Outside operating hours (08:00-20:00), skipping');
    return { processedCount: 0, sentCount: 0, skippedCount: 0 };
  }

  log('INFO', 'Starting pickup reminder check...');

  let processedCount = 0;
  let sentCount = 0;
  let skippedCount = 0;

  try {
    // Find items ready for pickup and scheduled within the reminder window
    // (e.g., 60 minutes before scheduled pickup time)
    const reminderWindow = settings.minutesBefore; // minutes before pickup

    const [reminderItems] = await poolWaschenPos.execute(`
      SELECT DISTINCT
        t.id as transaction_id,
        t.transaction_no,
        t.customer_id,
        t.outlet_id,
        t.pickup_type,
        t.pickup_schedule_at,
        t.estimated_done_at,
        c.name as customer_name,
        c.phone as customer_phone,
        o.name as outlet_name,
        o.address as outlet_address,
        o.phone as outlet_phone
      FROM tr_transaction t
      JOIN tr_item_unit iu ON iu.transaction_id = t.id
      JOIN mst_customer c ON t.customer_id = c.id
      LEFT JOIN mst_outlet o ON t.outlet_id = o.id
      WHERE t.deleted_at IS NULL
        AND t.pickup_type IN ('pickup', 'self_pickup')
        AND t.status NOT IN ('cancelled', 'completed', 'taken')
        AND t.picked_up_at IS NULL
        AND iu.production_status IN ('ready', 'done')
        -- Scheduled within the reminder window
        AND t.pickup_schedule_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? MINUTE)
        AND t.pickup_schedule_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR) -- Don't remind for past pickups
      ORDER BY t.pickup_schedule_at ASC
      LIMIT 30
    `, [reminderWindow]);

    log('INFO', `Found ${reminderItems.length} items ready for pickup reminder`);

    for (const item of reminderItems) {
      processedCount++;

      // Skip if no phone number
      if (!item.customer_phone) {
        skippedCount++;
        log('WARN', `Skipping ${item.transaction_no}: No phone number`);
        continue;
      }

      // Skip if no scheduled pickup time
      if (!item.pickup_schedule_at) {
        skippedCount++;
        continue;
      }

      // Check if reminder already sent (within 24 hours)
      const alreadySent = await hasReminderSent(item.transaction_id);
      if (alreadySent) {
        skippedCount++;
        log('INFO', `Skipping ${item.transaction_no}: Reminder already sent`);
        continue;
      }

      // Send pickup reminder
      try {
        const result = await sendPickupReminderNotification({
          customerPhone: item.customer_phone,
          customerName: item.customer_name,
          transactionNo: item.transaction_no,
          transactionId: item.transaction_id,
          outletId: item.outlet_id,
          pickupScheduleAt: item.pickup_schedule_at,
          outletName: item.outlet_name,
          outletAddress: item.outlet_address,
          outletPhone: item.outlet_phone,
        });

        if (result.success) {
          sentCount++;
          const pickupTime = new Date(item.pickup_schedule_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          log('INFO', `Sent pickup reminder for ${item.transaction_no} (pickup at ${pickupTime})`);
        }
      } catch (err) {
        log('ERROR', `Failed to send pickup reminder for ${item.transaction_no}:`, err.message);
      }
    }

    log('INFO', `Pickup reminder check completed: ${processedCount} processed, ${sentCount} sent, ${skippedCount} skipped`);

    return { processedCount, sentCount, skippedCount };

  } catch (err) {
    log('ERROR', 'Pickup reminder cron failed:', err.message);
    return { processedCount, sentCount, skippedCount, error: err.message };
  }
}

// ─── Cron Job: Run every 15 minutes during operating hours ─────────────────────
// Schedule: */15 8-19 * * * (every 15 min from 8:00 to 19:59)
const pickupReminderJob = cron.schedule('*/15 8-19 * * *', async () => {
  log('INFO', '=== Starting scheduled pickup reminder check ===');
  try {
    const result = await processPickupReminders();
    log('INFO', `=== Scheduled pickup reminder check completed: ${result.sentCount} sent ===`);
  } catch (err) {
    log('ERROR', 'Scheduled pickup reminder job failed:', err.message);
  }
}, {
  scheduled: isProduction,
  timezone: 'Asia/Jakarta',
});

// ─── Utility: Run manually ───────────────────────────────────────────────────
async function runManually() {
  log('INFO', 'Running pickup reminder cron manually...');
  const result = await processPickupReminders();
  console.log('\nResult:', JSON.stringify(result, null, 2));
  return result;
}

// ─── CLI Execution ──────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Pickup Reminder Cron Job');
  console.log('═══════════════════════════════════════════════════════════════\n');

  runManually()
    .then(() => {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('  ✅ Completed');
      console.log('═══════════════════════════════════════════════════════════════\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n═══════════════════════════════════════════════════════════════');
      console.error('  ❌ Failed');
      console.error('═══════════════════════════════════════════════════════════════');
      console.error(err);
      process.exit(1);
    });
}

export { pickupReminderJob, runManually };
