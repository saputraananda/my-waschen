// ─────────────────────────────────────────────────────────────────────────────
// delayNotificationCron.js — Delay Notification System
// Task 31.2: Create delay notification system
// Phase 5: Implement Auto-Notification System
// ─────────────────────────────────────────────────────────────────────────────
// Cron Job: Check for overdue items and send delay notifications
// Runs every 30 minutes during operating hours (07:00 - 21:00)
// ─────────────────────────────────────────────────────────────────────────────
import cron from 'node-cron';
import { poolWaschenPos } from '../db/connection.js';
import { sendDelayNotification } from '../services/whatsappService.js';

const isProduction = process.env.NODE_ENV === 'production';

// ── Logging Helper ──────────────────────────────────────────────────────────
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [DelayNotifCron] [${level}]`;
  if (level === 'ERROR') {
    console.error(prefix, message, ...args);
  } else {
    console.log(prefix, message, ...args);
  }
}

// ─── Get delay notification settings ────────────────────────────────────────
async function getSettings() {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT setting_key, setting_value FROM mst_config WHERE setting_key IN ('delay_notification_enabled', 'delay_notification_interval_minutes', 'delay_notification_max_attempts')`
    );
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    return {
      enabled: settings['delay_notification_enabled'] !== '0',
      intervalMinutes: parseInt(settings['delay_notification_interval_minutes'] || '30', 10),
      maxAttempts: parseInt(settings['delay_notification_max_attempts'] || '3', 10),
    };
  } catch (err) {
    console.warn('[delayNotificationCron] Failed to get settings, using defaults:', err.message);
    return { enabled: true, intervalMinutes: 30, maxAttempts: 3 };
  }
}

// ─── Check if notification already sent today ─────────────────────────────────
async function hasNotificationToday(transactionId) {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) as cnt FROM tr_notification
       WHERE transaction_id = ? AND type = 'pickup_reminder'
       AND DATE(created_at) = CURDATE()`,
      [transactionId]
    );
    return rows[0].cnt > 0;
  } catch {
    return false;
  }
}

// ─── Main: Process overdue items ───────────────────────────────────────────────
export async function processDelayNotifications() {
  const settings = await getSettings();

  if (!settings.enabled) {
    log('INFO', 'Delay notification cron is disabled');
    return { processedCount: 0, sentCount: 0, skippedCount: 0 };
  }

  const now = new Date();
  const hour = now.getHours();

  // Only run during operating hours (07:00 - 21:00)
  if (hour < 7 || hour >= 21) {
    log('INFO', 'Outside operating hours (07:00-21:00), skipping');
    return { processedCount: 0, sentCount: 0, skippedCount: 0 };
  }

  log('INFO', 'Starting delay notification check...');

  let processedCount = 0;
  let sentCount = 0;
  let skippedCount = 0;

  try {
    // Find items that are overdue (> 30 minutes past estimated_done_at)
    // and not yet ready
    const [overdueItems] = await poolWaschenPos.execute(`
      SELECT DISTINCT
        t.id as transaction_id,
        t.transaction_no,
        t.customer_id,
        t.estimated_done_at,
        t.outlet_id,
        c.name as customer_name,
        c.phone as customer_phone,
        iu.production_status as current_stage,
        TIMESTAMPDIFF(MINUTE, t.estimated_done_at, NOW()) as overdue_minutes
      FROM tr_transaction t
      JOIN tr_item_unit iu ON iu.transaction_id = t.id
      JOIN mst_customer c ON t.customer_id = c.id
      LEFT JOIN mst_outlet o ON t.outlet_id = o.id
      WHERE t.deleted_at IS NULL
        AND t.status NOT IN ('cancelled', 'completed', 'taken')
        AND t.picked_up_at IS NULL
        AND iu.production_status NOT IN ('ready', 'done')
        AND t.estimated_done_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
        AND (o.is_active = 1 OR o.is_active IS NULL)
      ORDER BY overdue_minutes DESC, t.is_express DESC
      LIMIT 50
    `);

    log('INFO', `Found ${overdueItems.length} overdue items to check`);

    for (const item of overdueItems) {
      processedCount++;

      // Skip if no phone number
      if (!item.customer_phone) {
        skippedCount++;
        log('WARN', `Skipping ${item.transaction_no}: No phone number`);
        continue;
      }

      // Check if already notified today
      const alreadyNotified = await hasNotificationToday(item.transaction_id);
      if (alreadyNotified) {
        skippedCount++;
        log('INFO', `Skipping ${item.transaction_no}: Already notified today`);
        continue;
      }

      // Send delay notification
      try {
        const result = await sendDelayNotification({
          customerPhone: item.customer_phone,
          customerName: item.customer_name,
          transactionNo: item.transaction_no,
          transactionId: item.transaction_id,
          outletId: item.outlet_id,
          estimatedDoneAt: item.estimated_done_at,
          currentStage: item.current_stage,
        });

        if (result.success) {
          sentCount++;
          log('INFO', `Sent delay notification for ${item.transaction_no} (${item.overdue_minutes}min overdue)`);
        }
      } catch (err) {
        log('ERROR', `Failed to send delay notification for ${item.transaction_no}:`, err.message);
      }
    }

    log('INFO', `Delay notification check completed: ${processedCount} processed, ${sentCount} sent, ${skippedCount} skipped`);

    return { processedCount, sentCount, skippedCount };

  } catch (err) {
    log('ERROR', 'Delay notification cron failed:', err.message);
    return { processedCount, sentCount, skippedCount, error: err.message };
  }
}

// ─── Cron Job: Run every 30 minutes during operating hours ─────────────────────
// Schedule: */30 7-20 * * * (every 30 min from 7:00 to 20:59)
const delayNotificationJob = cron.schedule('*/30 7-20 * * *', async () => {
  log('INFO', '=== Starting scheduled delay notification check ===');
  try {
    const result = await processDelayNotifications();
    log('INFO', `=== Scheduled check completed: ${result.sentCount} sent ===`);
  } catch (err) {
    log('ERROR', 'Scheduled delay notification job failed:', err.message);
  }
}, {
  scheduled: isProduction,
  timezone: 'Asia/Jakarta',
});

// ─── Utility: Run manually ───────────────────────────────────────────────────
async function runManually() {
  log('INFO', 'Running delay notification cron manually...');
  const result = await processDelayNotifications();
  console.log('\nResult:', JSON.stringify(result, null, 2));
  return result;
}

// ─── CLI Execution ──────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Delay Notification Cron Job');
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

export { delayNotificationJob, runManually };
