// ─────────────────────────────────────────────────────────────────────────────
// scheduler.js — Main Cron Job Scheduler
// Runs all daily/periodic cron jobs for the My Waschen POS system
// ─────────────────────────────────────────────────────────────────────────────
// Cron Jobs Schedule:
// - 00:00 (midnight): Membership expiry check
// - 02:00 (early morning): Customer segmentation update
// - 08:00 (morning): Birthday promo & WhatsApp greeting
// - */30 7-20 * * * (every 30 min, 7AM-8PM): Delay notification check
// - */15 8-19 * * * (every 15 min, 8AM-7PM): Pickup reminder check
// ─────────────────────────────────────────────────────────────────────────────
import cron from 'node-cron';

// Import cron job functions
import { processExpiryAndForfeiture } from './membershipExpiryCron.js';
import { updateCustomerSegmentation } from './updateCustomerSegmentation.js';
import { processBirthdays } from './birthdayPromoCron.js';
import { processDelayNotifications, delayNotificationJob } from './delayNotificationCron.js';
import { processPickupReminders, pickupReminderJob } from './pickupReminderCron.js';

const isProduction = process.env.NODE_ENV === 'production';

// ── Logging Helper ──────────────────────────────────────────────────────────
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [CronScheduler] [${level}]`;
  if (level === 'ERROR') {
    console.error(prefix, message, ...args);
  } else {
    console.log(prefix, message, ...args);
  }
}

// ── Cron Job: Membership Expiry ───────────────────────────────────────────
// Runs daily at midnight (00:00)
const membershipExpiryJob = cron.schedule('0 0 * * *', async () => {
  log('INFO', 'Starting Membership Expiry Cron...');
  try {
    const result = await processExpiryAndForfeiture();
    log('INFO', `Membership Expiry Cron completed: ${result.processedCount} processed, Rp ${result.forfeitedTotal.toLocaleString('id-ID')} forfeited`);
  } catch (err) {
    log('ERROR', 'Membership Expiry Cron failed:', err.message);
  }
}, {
  scheduled: isProduction,
  timezone: 'Asia/Jakarta',
});

// ── Cron Job: Customer Segmentation ────────────────────────────────────────
// Runs daily at 02:00 (early morning - low traffic)
const segmentationJob = cron.schedule('0 2 * * *', async () => {
  log('INFO', 'Starting Customer Segmentation Cron...');
  try {
    const result = await updateCustomerSegmentation();
    log('INFO', `Segmentation Cron completed: ${result.updatedCount} updated`);
    log('INFO', `Distribution:`, result.segmentCounts);
  } catch (err) {
    log('ERROR', 'Segmentation Cron failed:', err.message);
  }
}, {
  scheduled: isProduction,
  timezone: 'Asia/Jakarta',
});

// ── Cron Job: Birthday Promo & WhatsApp ───────────────────────────────────
// Runs daily at 08:00 (morning)
const birthdayJob = cron.schedule('0 8 * * *', async () => {
  log('INFO', 'Starting Birthday Promo Cron...');
  try {
    const result = await processBirthdays();
    log('INFO', `Birthday Cron completed: ${result.processedCount} processed, ${result.whatsappSentCount} WhatsApp sent`);
  } catch (err) {
    log('ERROR', 'Birthday Cron failed:', err.message);
  }
}, {
  scheduled: isProduction,
  timezone: 'Asia/Jakarta',
});

// ── Cron Job: Delay Notification Check ─────────────────────────────────────
// Runs every 30 minutes during operating hours (07:00 - 21:00)
// Note: delayNotificationJob is imported and managed separately
// to allow independent scheduling
const delayJob = cron.schedule('*/30 7-20 * * *', async () => {
  log('INFO', 'Starting Delay Notification Cron...');
  try {
    const result = await processDelayNotifications();
    log('INFO', `Delay Cron completed: ${result.sentCount} sent, ${result.skippedCount} skipped`);
  } catch (err) {
    log('ERROR', 'Delay Cron failed:', err.message);
  }
}, {
  scheduled: isProduction,
  timezone: 'Asia/Jakarta',
});

// ── Cron Job: Pickup Reminder Check ───────────────────────────────────────
// Runs every 15 minutes during operating hours (08:00 - 20:00)
// Note: pickupReminderJob is imported and managed separately
const pickupJob = cron.schedule('*/15 8-19 * * *', async () => {
  log('INFO', 'Starting Pickup Reminder Cron...');
  try {
    const result = await processPickupReminders();
    log('INFO', `Pickup Reminder Cron completed: ${result.sentCount} sent, ${result.skippedCount} skipped`);
  } catch (err) {
    log('ERROR', 'Pickup Reminder Cron failed:', err.message);
  }
}, {
  scheduled: isProduction,
  timezone: 'Asia/Jakarta',
});

// ── Utility: Run specific job manually ────────────────────────────────────
async function runJob(jobName) {
  switch (jobName) {
    case 'membership-expiry':
      log('INFO', 'Running Membership Expiry manually...');
      return await processExpiryAndForfeiture();
    case 'segmentation':
      log('INFO', 'Running Segmentation manually...');
      return await updateCustomerSegmentation();
    case 'birthday':
      log('INFO', 'Running Birthday manually...');
      return await processBirthdays();
    case 'delay-notification':
      log('INFO', 'Running Delay Notification manually...');
      return await processDelayNotifications();
    case 'pickup-reminder':
      log('INFO', 'Running Pickup Reminder manually...');
      return await processPickupReminders();
    case 'all':
      log('INFO', 'Running all cron jobs manually...');
      const expiry = await processExpiryAndForfeiture();
      const seg = await updateCustomerSegmentation();
      const bday = await processBirthdays();
      const delay = await processDelayNotifications();
      const pickup = await processPickupReminders();
      return { expiry, seg, bday, delay, pickup };
    default:
      log('ERROR', `Unknown job: ${jobName}`);
      return null;
  }
}

// ── Utility: Get scheduler status ──────────────────────────────────────────
function getStatus() {
  return {
    isProduction,
    jobs: [
      { name: 'membership-expiry', schedule: '0 0 * * *', running: membershipExpiryJob.running },
      { name: 'segmentation', schedule: '0 2 * * *', running: segmentationJob.running },
      { name: 'birthday', schedule: '0 8 * * *', running: birthdayJob.running },
      { name: 'delay-notification', schedule: '*/30 7-20 * * *', running: delayJob.running },
      { name: 'pickup-reminder', schedule: '*/15 8-19 * * *', running: pickupJob.running },
    ],
  };
}

// ── Export ─────────────────────────────────────────────────────────────────
export {
  membershipExpiryJob,
  segmentationJob,
  birthdayJob,
  delayJob,
  pickupJob,
  runJob,
  getStatus,
};

// ── CLI Execution ──────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const jobName = args[0] || 'all';

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  My Waschen Cron Job Scheduler');
  console.log('  Mode:', isProduction ? 'Production' : 'Development');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (args[0] === '--status') {
    const status = getStatus();
    console.log('Scheduler Status:');
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
  }

  if (args[0] === '--help') {
    console.log('Usage: node scheduler.js [job]');
    console.log('');
    console.log('Jobs:');
    console.log('  membership-expiry  - Run membership expiry cron');
    console.log('  segmentation       - Run customer segmentation cron');
    console.log('  birthday           - Run birthday promo cron');
    console.log('  delay-notification - Run delay notification cron');
    console.log('  pickup-reminder   - Run pickup reminder cron');
    console.log('  all                - Run all cron jobs (default)');
    console.log('');
    console.log('Options:');
    console.log('  --status           - Show scheduler status');
    console.log('  --help             - Show this help');
    console.log('');
    console.log('Schedule (Production):');
    console.log('  membership-expiry:   00:00 (midnight)');
    console.log('  segmentation:        02:00 (early morning)');
    console.log('  birthday:            08:00 (morning)');
    console.log('  delay-notification:  */30 7-20 * * * (every 30 min, 7AM-8PM)');
    console.log('  pickup-reminder:     */15 8-19 * * * (every 15 min, 8AM-7PM)');
    process.exit(0);
  }

  runJob(jobName)
    .then((result) => {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('  ✅ Cron Jobs Completed Successfully');
      console.log('═══════════════════════════════════════════════════════════════\n');
      console.log('Result:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n═══════════════════════════════════════════════════════════════');
      console.error('  ❌ Cron Jobs Failed');
      console.error('═══════════════════════════════════════════════════════════════\n');
      console.error(err);
      process.exit(1);
    });
}
