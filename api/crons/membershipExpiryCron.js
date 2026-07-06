// ─────────────────────────────────────────────────────────────────────────────
// membershipExpiryCron.js — Daily Cron Job for Membership Expiry & Forfeiture
// Task 12.3: Daily cron job for expiry automation
// ─────────────────────────────────────────────────────────────────────────────
// This script handles:
// 1. Expire memberships that have passed their expiry date
// 2. Expire memberships based on inactivity (2 months for Gold, 3 months for Diamond)
// 3. Forfeit remaining wallet balance for expired memberships
// 4. Update customer is_member flag
// 5. Log all actions to audit trail
// ─────────────────────────────────────────────────────────────────────────────
// Schedule: Daily at 00:00 (midnight) or 02:00 (low traffic)
// Run manually: node api/crons/membershipExpiryCron.js
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos as db } from '../db/connection.js';

const TIER_INACTIVITY = {
  gold: 2,     // 2 months inactivity
  diamond: 3,   // 3 months inactivity
};

async function processExpiryAndForfeiture() {
  const conn = await db.getConnection();
  let processedCount = 0;
  let forfeitedTotal = 0;
  const results = {
    expired: [],
    inactive: [],
    errors: [],
  };

  try {
    await conn.beginTransaction();

    // ── STEP 1: Expire memberships past expiry date ───────────────────────────
    const [expiredMemberships] = await conn.execute(`
      SELECT m.id, m.member_no, m.tier, m.customer_id, c.name as customer_name,
             m.expired_at, m.status as current_status
      FROM mst_membership m
      JOIN mst_customer c ON c.id = m.customer_id
      WHERE m.status = 'active'
        AND m.expired_at < NOW()
    `);

    for (const membership of expiredMemberships) {
      try {
        // Update membership status to expired
        await conn.execute(
          `UPDATE mst_membership SET status = 'expired', updated_at = NOW() WHERE id = ?`,
          [membership.id]
        );

        // Forfeit remaining balance
        const [[wallet]] = await conn.execute(
          `SELECT id, balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1 FOR UPDATE`,
          [membership.customer_id]
        );

        if (wallet && Number(wallet.balance) > 0) {
          const forfeitedAmount = Number(wallet.balance);
          forfeitedTotal += forfeitedAmount;

          await conn.execute(
            `UPDATE mst_customer_wallet SET balance = 0, updated_at = NOW() WHERE id = ?`,
            [wallet.id]
          );

          await conn.execute(`
            INSERT INTO tr_wallet_ledger (
              customer_id, type, amount, balance_after, description, is_forfeiture, created_at
            ) VALUES (?, 'forfeiture', ?, 0, ?, 1, NOW())
          `, [
            membership.customer_id,
            -forfeitedAmount,
            `Membership expired (${membership.tier || 'Gold'}) - balance forfeited to company`,
          ]);
        }

        // Update customer is_member flag
        await conn.execute(
          `UPDATE mst_customer SET is_member = 0, updated_at = NOW() WHERE id = ?`,
          [membership.customer_id]
        );

        results.expired.push({
          memberNo: membership.member_no,
          customerName: membership.customer_name,
          tier: membership.tier,
          forfeitedAmount: wallet?.balance || 0,
        });

        processedCount++;
        console.log(`[MembershipExpiry] Expired: ${membership.member_no} (${membership.customer_name})`);
      } catch (err) {
        results.errors.push({ memberNo: membership.member_no, error: err.message });
        console.error(`[MembershipExpiry] Error processing ${membership.member_no}:`, err.message);
      }
    }

    // ── STEP 2: Expire memberships based on inactivity ─────────────────────────
    const [inactiveMemberships] = await conn.execute(`
      SELECT m.id, m.member_no, m.tier, m.customer_id, c.name as customer_name,
             m.inactivity_months, m.status as current_status
      FROM mst_membership m
      JOIN mst_customer c ON c.id = m.customer_id
      WHERE m.status = 'active'
        AND (
          (m.tier = 'gold' AND m.inactivity_months >= ?)
          OR (m.tier = 'diamond' AND m.inactivity_months >= ?)
          OR (m.tier IS NULL AND m.inactivity_months >= 2)
        )
    `, [TIER_INACTIVITY.gold, TIER_INACTIVITY.diamond]);

    for (const membership of inactiveMemberships) {
      try {
        const inactivityThreshold = membership.tier === 'diamond'
          ? TIER_INACTIVITY.diamond
          : TIER_INACTIVITY.gold;

        // Update membership to expired
        await conn.execute(
          `UPDATE mst_membership SET status = 'expired', updated_at = NOW() WHERE id = ?`,
          [membership.id]
        );

        // Forfeit balance
        const [[wallet]] = await conn.execute(
          `SELECT id, balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1 FOR UPDATE`,
          [membership.customer_id]
        );

        if (wallet && Number(wallet.balance) > 0) {
          const forfeitedAmount = Number(wallet.balance);
          forfeitedTotal += forfeitedAmount;

          await conn.execute(
            `UPDATE mst_customer_wallet SET balance = 0, updated_at = NOW() WHERE id = ?`,
            [wallet.id]
          );

          await conn.execute(`
            INSERT INTO tr_wallet_ledger (
              customer_id, type, amount, balance_after, description, is_forfeiture, created_at
            ) VALUES (?, 'forfeiture', ?, 0, ?, 1, NOW())
          `, [
            membership.customer_id,
            -forfeitedAmount,
            `Membership expired due to ${inactivityThreshold} months inactivity - balance forfeited`,
          ]);
        }

        // Update customer flag
        await conn.execute(
          `UPDATE mst_customer SET is_member = 0, updated_at = NOW() WHERE id = ?`,
          [membership.customer_id]
        );

        results.inactive.push({
          memberNo: membership.member_no,
          customerName: membership.customer_name,
          tier: membership.tier,
          inactivityMonths: membership.inactivity_months,
          forfeitedAmount: wallet?.balance || 0,
        });

        processedCount++;
        console.log(`[MembershipExpiry] Inactive expired: ${membership.member_no} (${membership.inactivity_months} months)`);
      } catch (err) {
        results.errors.push({ memberNo: membership.member_no, error: err.message });
        console.error(`[MembershipExpiry] Error processing inactive ${membership.member_no}:`, err.message);
      }
    }

    // ── STEP 3: Update inactivity_months for active memberships ────────────────
    const [updateResult] = await conn.execute(`
      UPDATE mst_membership m
      JOIN (
        SELECT
          m2.id,
          CASE
            WHEN m2.last_transaction_at IS NULL
              THEN TIMESTAMPDIFF(MONTH, m2.started_at, NOW())
            ELSE
              TIMESTAMPDIFF(MONTH, m2.last_transaction_at, NOW())
          END as new_inactivity
        FROM mst_membership m2
        WHERE m2.status = 'active'
      ) sub ON m.id = sub.id
      SET m.inactivity_months = sub.new_inactivity
    `);

    console.log(`[MembershipExpiry] Updated inactivity for ${updateResult.affectedRows} memberships`);

    await conn.commit();

    // ── STEP 4: Send notifications (optional - for future WhatsApp integration) ─
    // This would send notifications to expired members about renewal options

  } catch (error) {
    await conn.rollback();
    console.error('[MembershipExpiry] Fatal error:', error);
    throw error;
  } finally {
    conn.release();
  }

  return { processedCount, forfeitedTotal, results };
}

// ── CLI Execution ───────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  WPC Membership Expiry Cron Job');
  console.log('  Started:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════════');

  processExpiryAndForfeiture()
    .then(({ processedCount, forfeitedTotal }) => {
      console.log('\n✅ Membership Expiry Cron Completed');
      console.log(`   Processed: ${processedCount} memberships`);
      console.log(`   Forfeited Total: Rp ${forfeitedTotal.toLocaleString('id-ID')}`);
      console.log('═══════════════════════════════════════════════════════════════\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Membership Expiry Cron Failed:', err);
      console.log('═══════════════════════════════════════════════════════════════\n');
      process.exit(1);
    });
}

export { processExpiryAndForfeiture };
