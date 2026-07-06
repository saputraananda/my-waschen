// ─────────────────────────────────────────────────────────────────────────────
// updateCustomerSegmentation.js — Daily Cron for Customer Segmentation
// Task 34.2: Create automated segmentation cron job
// ─────────────────────────────────────────────────────────────────────────────
// This script handles:
// 1. Calculate total_transactions per customer
// 2. Update last_transaction_at from latest transaction
// 3. Calculate segment based on rules:
//    - one_time: total_transactions = 1
//    - regular: 2-9 transactions AND last < 60 days
//    - loyal: 10+ transactions AND last < 30 days
//    - churned: last_transaction > 90 days
// ─────────────────────────────────────────────────────────────────────────────
// Schedule: Daily at 02:00 (low traffic)
// Run manually: node api/crons/updateCustomerSegmentation.js
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos as db } from '../db/connection.js';

// Segmentation rules
const SEGMENT_RULES = {
  one_time: {
    name: 'One Time',
    minTx: 1,
    maxTx: 1,
    recencyDays: null,
  },
  regular: {
    name: 'Regular',
    minTx: 2,
    maxTx: 9,
    recencyDays: 60,
  },
  loyal: {
    name: 'Loyal',
    minTx: 10,
    maxTx: null,
    recencyDays: 30,
  },
  churned: {
    name: 'Churned',
    minTx: null,
    maxTx: null,
    recencyDays: 90,
    exclude: true, // Only if not matching other segments
  },
};

function calculateSegment(totalTx, lastTxDate) {
  if (!totalTx || totalTx === 0) {
    return null;
  }

  const now = new Date();
  const lastTx = lastTxDate ? new Date(lastTxDate) : null;
  const daysSinceLastTx = lastTx
    ? Math.floor((now - lastTx) / (1000 * 60 * 60 * 24))
    : null;

  // Check in order: loyal -> regular -> churned -> one_time
  const rules = [
    { segment: 'loyal', minTx: 10, maxTx: null, maxDays: 30 },
    { segment: 'regular', minTx: 2, maxTx: 9, maxDays: 60 },
    { segment: 'churned', minTx: 1, maxTx: null, maxDays: 90, churnedOnly: true },
  ];

  for (const rule of rules) {
    const meetsTxCriteria = totalTx >= rule.minTx && (rule.maxTx === null || totalTx <= rule.maxTx);
    const meetsDaysCriteria = rule.maxDays === null || (daysSinceLastTx !== null && daysSinceLastTx <= rule.maxDays);

    if (meetsTxCriteria && meetsDaysCriteria) {
      return rule.segment;
    }
  }

  // If one transaction and too old for regular, or any other edge case
  if (totalTx === 1) {
    if (daysSinceLastTx === null || daysSinceLastTx > 60) {
      return daysSinceLastTx !== null && daysSinceLastTx > 90 ? 'churned' : 'one_time';
    }
    return 'one_time';
  }

  // Default to regular if has transactions but doesn't fit other categories
  return 'regular';
}

async function updateCustomerSegmentation() {
  const conn = await db.getConnection();
  let updatedCount = 0;
  const segmentCounts = {
    one_time: 0,
    regular: 0,
    loyal: 0,
    churned: 0,
    null: 0,
  };
  const errors = [];

  try {
    await conn.beginTransaction();

    // ── STEP 1: Calculate and update total_transactions and last_transaction_at ───
    const [updateStats] = await conn.execute(`
      UPDATE mst_customer c
      LEFT JOIN (
        SELECT
          customer_id,
          COUNT(*) as total_transactions,
          MAX(created_at) as last_transaction_at
        FROM tr_transaction
        WHERE status != 'cancelled'
          AND deleted_at IS NULL
        GROUP BY customer_id
      ) tx ON c.id = tx.customer_id
      SET
        c.total_transactions = COALESCE(tx.total_transactions, 0),
        c.last_transaction_at = tx.last_transaction_at
      WHERE c.deleted_at IS NULL
    `);

    console.log(`[Segmentation] Updated stats for ${updateStats.affectedRows} customers`);

    // ── STEP 2: Get all customers with their stats ─────────────────────────────
    const [customers] = await conn.execute(`
      SELECT id, total_transactions, last_transaction_at, segment as current_segment
      FROM mst_customer
      WHERE deleted_at IS NULL
    `);

    // ── STEP 3: Calculate new segment for each customer ────────────────────────
    for (const customer of customers) {
      try {
        const newSegment = calculateSegment(
          customer.total_transactions,
          customer.last_transaction_at
        );

        // Only update if segment changed
        if (newSegment !== customer.current_segment) {
          await conn.execute(
            `UPDATE mst_customer SET segment = ?, updated_at = NOW() WHERE id = ?`,
            [newSegment, customer.id]
          );

          if (newSegment) {
            segmentCounts[newSegment]++;
          } else {
            segmentCounts.null++;
          }

          updatedCount++;
          console.log(`[Segmentation] ${customer.id}: ${customer.current_segment || 'NULL'} -> ${newSegment || 'NULL'}`);
        }
      } catch (err) {
        errors.push({ customerId: customer.id, error: err.message });
        console.error(`[Segmentation] Error processing customer ${customer.id}:`, err.message);
      }
    }

    await conn.commit();

    // ── STEP 4: Log segmentation distribution ──────────────────────────────────
    console.log('\n[Segmentation] Distribution Summary:');
    console.log(`   One Time: ${segmentCounts.one_time}`);
    console.log(`   Regular: ${segmentCounts.regular}`);
    console.log(`   Loyal: ${segmentCounts.loyal}`);
    console.log(`   Churned: ${segmentCounts.churned}`);
    console.log(`   No Segment: ${segmentCounts.null}`);
    console.log(`   Total Updated: ${updatedCount}`);

    if (errors.length > 0) {
      console.log(`\n[Segmentation] Errors: ${errors.length}`);
      errors.forEach(e => console.log(`   Customer ${e.customerId}: ${e.error}`));
    }

  } catch (error) {
    await conn.rollback();
    console.error('[Segmentation] Fatal error:', error);
    throw error;
  } finally {
    conn.release();
  }

  return {
    updatedCount,
    segmentCounts,
    errors,
  };
}

// ── CLI Execution ─────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Customer Segmentation Cron Job');
  console.log('  Started:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════════');

  updateCustomerSegmentation()
    .then(({ updatedCount, segmentCounts }) => {
      console.log('\n✅ Segmentation Cron Completed');
      console.log(`   Customers Updated: ${updatedCount}`);
      console.log('═══════════════════════════════════════════════════════════════\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Segmentation Cron Failed:', err);
      console.log('═══════════════════════════════════════════════════════════════\n');
      process.exit(1);
    });
}

export { updateCustomerSegmentation, calculateSegment };
