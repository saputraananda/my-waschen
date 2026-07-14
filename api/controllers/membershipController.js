// ─────────────────────────────────────────────────────────────────────────────
// membershipController.js — WPC (Waschen Priority Club) Membership System
// Phase 2: Membership System Overhaul
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos as db } from '../db/connection.js';
import logger from '../utils/logger.js';
import { recordMembershipHistory } from './membershipHistoryController.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Membership tier configurations
const TIER_CONFIG = {
  gold: {
    name: 'Gold',
    minTopup: 500000,        // Minimum top-up to qualify
    durationMonths: 6,        // Membership duration
    discountPct: 20,         // 20% discount
    inactivityMonths: 2,     // Expire after 2 months inactivity
    benefits: ['20% discount', 'Priority queue'],
  },
  diamond: {
    name: 'Diamond',
    minTopup: 1000000,       // Minimum top-up to qualify
    durationMonths: 12,      // Membership duration
    discountPct: 25,         // 25% discount
    inactivityMonths: 3,     // Expire after 3 months inactivity
    benefits: ['25% discount', 'Priority queue', 'Free pickup/delivery'],
  },
};

// Status values
const STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
};

/**
 * Generate unique member number: MBR-YYMMDD-XXX
 */
async function generateMemberNo(conn) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `MBR-${yy}${mm}${dd}-`;

  // Find last member number for today
  const [rows] = await conn.execute(
    `SELECT member_no FROM mst_membership
     WHERE member_no LIKE ?
     ORDER BY member_no DESC LIMIT 1 FOR UPDATE`,
    [`${datePrefix}%`]
  );

  let nextSeq = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].member_no;
    const lastSeqStr = lastNo.slice(datePrefix.length);
    const lastSeq = parseInt(lastSeqStr, 10);
    if (Number.isFinite(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${datePrefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Get config value from mst_app_config
 */
async function getConfig(conn, key, defaultValue = null) {
  try {
    const [[row]] = await conn.execute(
      'SELECT config_val FROM mst_app_config WHERE config_key = ? AND is_active = 1 LIMIT 1',
      [key]
    );
    return row?.config_val ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Check if column exists in table
 */
async function hasColumn(conn, tableName, columnName) {
  try {
    const [rows] = await conn.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [tableName, columnName]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BONUS CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const BONUS_CONFIG = {
  gold: 25000,     // Bonus for Gold tier
  diamond: 50000,  // Bonus for Diamond tier
};

/**
 * Check if membership bonus is enabled from settings
 */
async function isBonusEnabled(conn) {
  try {
    const [[row]] = await conn.execute(
      "SELECT setting_value FROM mst_setting WHERE setting_key = 'membership_bonus_enabled' LIMIT 1"
    );
    return row?.setting_value === 'true' || row?.setting_value === '1';
  } catch {
    return true; // Default to enabled if setting not found
  }
}

/**
 * Get bonus amount for a tier (if bonus is enabled)
 */
async function getBonusAmount(conn, tier) {
  const enabled = await isBonusEnabled(conn);
  if (!enabled) return 0;
  return BONUS_CONFIG[tier] || 0;
}

/**
 * GET /api/membership/status/:customerId
 * Get membership status for a customer (for checkout validation)
 */
export async function getMembershipStatus(req, res) {
  try {
    const { customerId } = req.params;
    const user = req.user;

    // Query active membership with real-time expiry check
    const [rows] = await db.execute(`
      SELECT
        m.id,
        m.member_no,
        m.status,
        m.tier,
        m.discount_pct,
        m.expired_at,
        m.last_transaction_at,
        m.inactivity_months,
        m.started_at,
        c.name as customer_name
      FROM mst_membership m
      JOIN mst_customer c ON c.id = m.customer_id
      WHERE m.customer_id = ?
        AND m.status = 'active'
        AND m.expired_at >= NOW()
      ORDER BY m.expired_at DESC
      LIMIT 1
    `, [customerId]);

    if (rows.length === 0) {
      // Check if expired membership exists
      const [expiredRows] = await db.execute(`
        SELECT
          m.id,
          m.member_no,
          m.status,
          m.tier,
          m.expired_at
        FROM mst_membership m
        WHERE m.customer_id = ?
          AND m.status IN ('active', 'expired')
        ORDER BY m.expired_at DESC
        LIMIT 1
      `, [customerId]);

      if (expiredRows.length > 0) {
        return res.json({
          success: true,
          data: {
            hasMembership: true,
            isActive: false,
            status: expiredRows[0].status,
            expiredAt: expiredRows[0].expired_at,
            message: 'Membership sudah expired. Silakan renew untuk menikmati kembali benefit.',
            canRenew: expiredRows[0].status === 'expired',
          },
        });
      }

      return res.json({
        success: true,
        data: {
          hasMembership: false,
          isActive: false,
          status: null,
          message: 'Customer belum menjadi member.',
        },
      });
    }

    const membership = rows[0];

    // Calculate days until expiry
    const now = new Date();
    const expiryDate = new Date(membership.expired_at);
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    return res.json({
      success: true,
      data: {
        hasMembership: true,
        isActive: true,
        id: membership.id,
        memberNo: membership.member_no,
        status: membership.status,
        tier: membership.tier || 'gold',
        discountPct: Number(membership.discount_pct),
        expiredAt: membership.expired_at,
        daysUntilExpiry,
        isExpiringSoon: daysUntilExpiry <= 7,
        startedAt: membership.started_at,
        customerName: membership.customer_name,
        benefits: TIER_CONFIG[membership.tier || 'gold']?.benefits || [],
      },
    });
  } catch (error) {
    logger.error('Gagal mengambil status membership', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil status membership.',
    });
  }
}

/**
 * GET /api/membership/:customerId
 * Get full membership details (admin/kasir view)
 */
export async function getMembershipDetails(req, res) {
  try {
    const { customerId } = req.params;
    const user = req.user;

    // Get membership
    const [rows] = await db.execute(`
      SELECT
        m.*,
        c.name as customer_name,
        c.phone as customer_phone
      FROM mst_membership m
      JOIN mst_customer c ON c.id = m.customer_id
      WHERE m.customer_id = ?
      ORDER BY m.created_at DESC
      LIMIT 1
    `, [customerId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Membership tidak ditemukan untuk customer ini.',
      });
    }

    const membership = rows[0];

    // Get customer transaction count
    const [txCount] = await db.execute(`
      SELECT COUNT(*) as total_transactions
      FROM tr_transaction
      WHERE customer_id = ? AND status != 'cancelled'
    `, [customerId]);

    // Get wallet balance
    const [wallet] = await db.execute(`
      SELECT balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1
    `, [customerId]);

    // Get recent transactions
    const [recentTx] = await db.execute(`
      SELECT
        id, transaction_no, total, status, created_at
      FROM tr_transaction
      WHERE customer_id = ? AND status != 'cancelled'
      ORDER BY created_at DESC
      LIMIT 10
    `, [customerId]);

    return res.json({
      success: true,
      data: {
        ...membership,
        totalTransactions: txCount[0]?.total_transactions || 0,
        walletBalance: Number(wallet[0]?.balance || 0),
        recentTransactions: recentTx,
        tierConfig: TIER_CONFIG[membership.tier || 'gold'],
      },
    });
  } catch (error) {
    logger.error('Gagal mengambil detail membership', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil detail membership.',
    });
  }
}

/**
 * GET /api/membership
 * List all memberships (admin)
 */
export async function listMemberships(req, res) {
  try {
    const {
      status = 'active',
      tier,
      page = 1,
      limit = 50,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Status filter
    if (status === 'active') {
      whereClause += ` AND m.status = 'active' AND (m.expired_at IS NULL OR m.expired_at >= NOW())`;
    } else if (status === 'expired') {
      whereClause += ` AND (m.status = 'expired' OR m.expired_at < NOW())`;
    } else if (status !== 'all') {
      whereClause += ` AND m.status = ?`;
      params.push(status);
    }

    // Tier filter
    if (tier) {
      whereClause += ` AND m.tier = ?`;
      params.push(tier);
    }

    // Search
    if (search) {
      whereClause += ` AND (c.name LIKE ? OR c.phone LIKE ? OR m.member_no LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    // Count total
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM mst_membership m
       JOIN mst_customer c ON c.id = m.customer_id
       ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Get memberships - use query() instead of execute() for flexibility
    const [memberships] = await db.query(`
      SELECT
        m.id,
        m.customer_id,
        m.member_no,
        m.status,
        m.tier,
        m.discount_pct,
        m.expired_at,
        m.started_at,
        m.last_transaction_at,
        m.inactivity_months,
        c.name as customer_name,
        c.phone as customer_phone,
        w.balance as wallet_balance
      FROM mst_membership m
      JOIN mst_customer c ON c.id = m.customer_id
      LEFT JOIN mst_customer_wallet w ON w.customer_id = c.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    return res.json({
      success: true,
      data: memberships.map((m) => ({
        ...m,
        isExpired: new Date(m.expired_at) < new Date(),
        daysUntilExpiry: Math.ceil((new Date(m.expired_at) - new Date()) / (1000 * 60 * 60 * 24)),
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Gagal mengambil daftar membership', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar membership.',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: CREATE MEMBERSHIP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/membership/register
 * Register new membership
 *
 * Body: { customerId, tier, topupAmount }
 */
export async function registerMembership(req, res) {
  const conn = await db.getConnection();

  try {
    const { customerId, tier = 'gold', topupAmount } = req.body;
    const userId = req.user?.userId || req.user?.id;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!customerId) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Customer ID wajib diisi.',
      });
    }

    // Validate tier
    const tierKey = tier?.toLowerCase();
    if (!TIER_CONFIG[tierKey]) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Tier membership tidak valid. Pilih Gold atau Diamond.',
      });
    }

    const tierInfo = TIER_CONFIG[tierKey];

    // Check minimum top-up requirement
    if (topupAmount != null) {
      const minTopup = Number(topupAmount);
      if (!Number.isFinite(minTopup) || minTopup < tierInfo.minTopup) {
        conn.release();
        return res.status(400).json({
          success: false,
          message: `Minimal top-up untuk membership ${tierInfo.name} adalah Rp ${tierInfo.minTopup.toLocaleString('id-ID')}.`,
        });
      }
    }

    await conn.beginTransaction();

    // ── Check if customer exists ─────────────────────────────────────────────
    const [[customer]] = await conn.execute(
      'SELECT id, name, is_member FROM mst_customer WHERE id = ? LIMIT 1',
      [customerId]
    );

    if (!customer) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Customer tidak ditemukan.',
      });
    }

    // ── Check for existing active membership ────────────────────────────────
    const [existingMembership] = await conn.execute(`
      SELECT id, status, tier, expired_at FROM mst_membership
      WHERE customer_id = ? AND status IN ('active', 'suspended')
      ORDER BY expired_at DESC LIMIT 1
    `, [customerId]);

    if (existingMembership.length > 0) {
      const existing = existingMembership[0];
      if (existing.status === 'active' && new Date(existing.expired_at) > new Date()) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          success: false,
          message: `Customer sudah memiliki membership ${existing.tier || 'Gold'} aktif hingga ${new Date(existing.expired_at).toLocaleDateString('id-ID')}. Tidak dapat membuat membership baru.`,
        });
      }
    }

    // ── Update expired membership to expired status ────────────────────────
    if (existingMembership.length > 0 && existingMembership[0].status === 'active') {
      await conn.execute(
        `UPDATE mst_membership SET status = 'expired' WHERE id = ?`,
        [existingMembership[0].id]
      );
    }

    // ── Generate member number ──────────────────────────────────────────────
    const memberNo = await generateMemberNo(conn);

    // ── Calculate expiry date ────────────────────────────────────────────────
    const startedAt = new Date();
    const expiredAt = new Date(startedAt);
    expiredAt.setMonth(expiredAt.getMonth() + tierInfo.durationMonths);

    // ── Create membership record ───────────────────────────────────────────
    const [insertResult] = await conn.execute(`
      INSERT INTO mst_membership (
        customer_id, member_no, status, tier, discount_pct,
        started_at, expired_at,
        registered_by, created_at, updated_at
      ) VALUES (?, ?, 'active', ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      customerId,
      memberNo,
      tierKey,
      tierInfo.discountPct,
      startedAt,
      expiredAt,
      userId,
    ]);

    const membershipId = insertResult.insertId;

    // ── Update customer is_member flag ─────────────────────────────────────
    await conn.execute(
      'UPDATE mst_customer SET is_member = 1, updated_at = NOW() WHERE id = ?',
      [customerId]
    );

    // ── Create wallet if not exists ───────────────────────────────────────
    const [walletRows] = await conn.execute(
      'SELECT id FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1',
      [customerId]
    );

    if (walletRows.length === 0) {
      await conn.execute(
        'INSERT INTO mst_customer_wallet (customer_id, balance, created_at, updated_at) VALUES (?, 0, NOW(), NOW())',
        [customerId]
      );
    }

    // ── If topupAmount provided, process deposit ───────────────────────────
    let bonusApplied = 0;
    let totalDeposit = 0;

    if (topupAmount && Number(topupAmount) > 0) {
      // Check if bonus is enabled
      const bonusEnabled = await isBonusEnabled(conn);
      const bonusAmount = bonusEnabled ? (BONUS_CONFIG[tierKey] || 0) : 0;
      totalDeposit = Number(topupAmount);
      bonusApplied = bonusAmount;

      // Add base amount
      await conn.execute(
        'UPDATE mst_customer_wallet SET balance = balance + ?, updated_at = NOW() WHERE customer_id = ?',
        [totalDeposit, customerId]
      );

      // Add bonus if enabled
      if (bonusApplied > 0) {
        await conn.execute(
          'UPDATE mst_customer_wallet SET balance = balance + ?, updated_at = NOW() WHERE customer_id = ?',
          [bonusApplied, customerId]
        );

        // Record bonus in ledger
        await conn.execute(`
          INSERT INTO tr_wallet_ledger (
            customer_id, type, amount, balance_after, description, created_by, created_at
          ) VALUES (?, 'bonus', ?, (SELECT balance FROM mst_customer_wallet WHERE customer_id = ?), ?, ?, NOW())
        `, [customerId, bonusApplied, customerId, `Bonus top-up WPC ${tierInfo.name} Membership`, userId]);
      }

      await conn.execute(`
        INSERT INTO tr_wallet_ledger (
          customer_id, type, amount, balance_after, description, created_by, created_at
        ) VALUES (?, 'topup', ?, (SELECT balance FROM mst_customer_wallet WHERE customer_id = ?), ?, ?, NOW())
      `, [customerId, totalDeposit, customerId, `Registration fee for WPC ${tierInfo.name} Membership`, userId]);
    }

    await conn.commit();

    // Record membership history
    await recordMembershipHistory(conn, {
      customerId,
      membershipId,
      action: 'register',
      oldTier: null,
      newTier: tierKey,
      oldExpiredAt: null,
      newExpiredAt: expiredAt,
      oldStatus: null,
      newStatus: 'active',
      amount: topupAmount ? Number(topupAmount) : null,
      bonus: bonusApplied > 0 ? bonusApplied : null,
      notes: `WPC ${tierInfo.name} Membership Registration${bonusApplied > 0 ? ` (Bonus: Rp ${bonusApplied.toLocaleString('id-ID')})` : ''}`,
      createdBy: userId,
      picId: userId,
      picName: user?.name || 'Unknown',
    }).catch(err => logger.warn('[membership]', 'Failed to record history', { error: err.message }));

    return res.status(201).json({
      success: true,
      message: `Membership ${tierInfo.name} berhasil dibuat!${bonusApplied > 0 ? ` Bonus Rp ${bonusApplied.toLocaleString('id-ID')} ditambahkan!` : ''}`,
      data: {
        id: membershipId,
        memberNo,
        customerId,
        customerName: customer.name,
        tier: tierKey,
        tierName: tierInfo.name,
        discountPct: tierInfo.discountPct,
        benefits: tierInfo.benefits,
        startedAt,
        expiredAt,
        status: 'active',
        bonusApplied,
        totalDeposit: totalDeposit + bonusApplied,
      },
    });
  } catch (error) {
    await conn.rollback();
    logger.error('Gagal membuat membership', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat membership.',
      error: error.message,
    });
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: RENEW MEMBERSHIP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/membership/:id/renew
 * Renew an existing membership
 *
 * Body: { topupAmount }
 */
export async function renewMembership(req, res) {
  const conn = await db.getConnection();

  try {
    const { id } = req.params;
    const { topupAmount } = req.body;
    const userId = req.user?.userId || req.user?.id;

    await conn.beginTransaction();

    // ── Get current membership ──────────────────────────────────────────────
    const [[membership]] = await conn.execute(`
      SELECT m.*, c.name as customer_name
      FROM mst_membership m
      JOIN mst_customer c ON c.id = m.customer_id
      WHERE m.id = ?
      LIMIT 1 FOR UPDATE
    `, [id]);

    if (!membership) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Membership tidak ditemukan.',
      });
    }

    const tierKey = membership.tier || 'gold';
    const tierInfo = TIER_CONFIG[tierKey];

    // ── Check if can renew ─────────────────────────────────────────────────
    // Can renew if: active (with expiry warning) or expired (within 30 days)
    const now = new Date();
    const expiryDate = new Date(membership.expired_at);
    const daysSinceExpiry = Math.ceil((now - expiryDate) / (1000 * 60 * 60 * 24));

    if (membership.status === 'suspended') {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Membership dalam status suspended. Hubungi admin.',
      });
    }

    if (daysSinceExpiry > 30 && membership.status === 'expired') {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Membership sudah tidak dapat direnew. Masa tenggang 30 hari sudah lewat. Silakan daftar ulang.',
      });
    }

    // ── Calculate new expiry date ─────────────────────────────────────────
    // Extend from current expiry, not from now
    const currentExpiry = new Date(membership.expired_at);
    const newExpiry = new Date(currentExpiry > now ? currentExpiry : now);
    newExpiry.setMonth(newExpiry.getMonth() + tierInfo.durationMonths);

    // ── Update membership ────────────────────────────────────────────────────
    await conn.execute(`
      UPDATE mst_membership SET
        status = 'active',
        expired_at = ?,
        last_transaction_at = NOW(),
        inactivity_months = 0,
        updated_at = NOW()
      WHERE id = ?
    `, [newExpiry, id]);

    // ── Process top-up if provided ─────────────────────────────────────────
    let bonusApplied = 0;
    let totalDeposit = 0;

    if (topupAmount && Number(topupAmount) > 0) {
      // Check if bonus is enabled
      const bonusEnabled = await isBonusEnabled(conn);
      const bonusAmount = bonusEnabled ? (BONUS_CONFIG[tierKey] || 0) : 0;
      totalDeposit = Number(topupAmount);
      bonusApplied = bonusAmount;

      // Add base amount
      await conn.execute(
        'UPDATE mst_customer_wallet SET balance = balance + ?, updated_at = NOW() WHERE customer_id = ?',
        [totalDeposit, membership.customer_id]
      );

      // Add bonus if enabled
      if (bonusApplied > 0) {
        await conn.execute(
          'UPDATE mst_customer_wallet SET balance = balance + ?, updated_at = NOW() WHERE customer_id = ?',
          [bonusApplied, membership.customer_id]
        );

        // Record bonus in ledger
        await conn.execute(`
          INSERT INTO tr_wallet_ledger (
            customer_id, type, amount, balance_after, description, created_by, created_at
          ) VALUES (?, 'bonus', ?, (SELECT balance FROM mst_customer_wallet WHERE customer_id = ?), ?, ?, NOW())
        `, [membership.customer_id, bonusApplied, membership.customer_id, `Bonus top-up WPC ${tierInfo.name} Membership`, userId]);
      }

      const [[wallet]] = await conn.execute(
        'SELECT balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1',
        [membership.customer_id]
      );

      await conn.execute(`
        INSERT INTO tr_wallet_ledger (
          customer_id, type, amount, balance_after, description, created_by, created_at
        ) VALUES (?, 'topup', ?, ?, ?, ?, NOW())
      `, [
        membership.customer_id,
        totalDeposit,
        wallet?.balance || 0,
        `Renewal fee for WPC ${tierInfo.name} Membership`,
        userId,
      ]);
    }

    await conn.commit();

    // Record membership history
    await recordMembershipHistory(conn, {
      customerId: membership.customer_id,
      membershipId: membership.id,
      action: 'renew',
      oldTier: tierKey,
      newTier: tierKey,
      oldExpiredAt: membership.expired_at,
      newExpiredAt: newExpiry,
      oldStatus: 'active',
      newStatus: 'active',
      amount: topupAmount ? Number(topupAmount) : null,
      bonus: bonusApplied > 0 ? bonusApplied : null,
      notes: `WPC ${tierInfo.name} Membership Renewal${bonusApplied > 0 ? ` (Bonus: Rp ${bonusApplied.toLocaleString('id-ID')})` : ''}`,
      createdBy: userId,
      picId: userId,
      picName: user?.name || 'Unknown',
    }).catch(err => logger.warn('[membership]', 'Failed to record history', { error: err.message }));

    return res.status(200).json({
      success: true,
      message: `Membership ${tierInfo.name} berhasil direnew!${bonusApplied > 0 ? ` Bonus Rp ${bonusApplied.toLocaleString('id-ID')} ditambahkan!` : ''}`,
      data: {
        id: membership.id,
        memberNo: membership.member_no,
        customerName: membership.customer_name,
        tier: tierKey,
        tierName: tierInfo.name,
        discountPct: tierInfo.discountPct,
        previousExpiry: membership.expired_at,
        newExpiry,
        status: 'active',
        bonusApplied,
        totalDeposit: totalDeposit + bonusApplied,
      },
    });
  } catch (error) {
    await conn.rollback();
    logger.error('Gagal merenew membership', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal merenew membership.',
      error: error.message,
    });
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: UPGRADE TIER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/membership/:id/upgrade
 * Upgrade from Gold to Diamond
 */
export async function upgradeTier(req, res) {
  const conn = await db.getConnection();

  try {
    const { id } = req.params;
    const { topupAmount } = req.body;
    const userId = req.user?.userId || req.user?.id;

    await conn.beginTransaction();

    // Get membership
    const [[membership]] = await conn.execute(`
      SELECT m.*, c.name as customer_name
      FROM mst_membership m
      JOIN mst_customer c ON c.id = m.customer_id
      WHERE m.id = ?
      LIMIT 1 FOR UPDATE
    `, [id]);

    if (!membership) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Membership tidak ditemukan.',
      });
    }

    // Can only upgrade from Gold to Diamond
    if (membership.tier === 'diamond') {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Anda sudah memiliki tier Diamond tertinggi.',
      });
    }

    // Check minimum top-up for Diamond
    const diamondMinTopup = TIER_CONFIG.diamond.minTopup;
    if (!topupAmount || Number(topupAmount) < diamondMinTopup) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: `Minimal top-up untuk upgrade ke Diamond adalah Rp ${diamondMinTopup.toLocaleString('id-ID')}.`,
      });
    }

    // Update to Diamond
    await conn.execute(`
      UPDATE mst_membership SET
        tier = 'diamond',
        discount_pct = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [TIER_CONFIG.diamond.discountPct, id]);

    // Process top-up with bonus
    let bonusApplied = 0;
    let totalDeposit = Number(topupAmount);

    // Check if bonus is enabled
    const bonusEnabled = await isBonusEnabled(conn);
    if (bonusEnabled) {
      bonusApplied = BONUS_CONFIG.diamond || 0;
    }

    // Add base amount
    await conn.execute(
      'UPDATE mst_customer_wallet SET balance = balance + ?, updated_at = NOW() WHERE customer_id = ?',
      [totalDeposit, membership.customer_id]
    );

    // Add bonus if enabled
    if (bonusApplied > 0) {
      await conn.execute(
        'UPDATE mst_customer_wallet SET balance = balance + ?, updated_at = NOW() WHERE customer_id = ?',
        [bonusApplied, membership.customer_id]
      );

      // Record bonus in ledger
      await conn.execute(`
        INSERT INTO tr_wallet_ledger (
          customer_id, type, amount, balance_after, description, created_by, created_at
        ) VALUES (?, 'bonus', ?, (SELECT balance FROM mst_customer_wallet WHERE customer_id = ?), ?, ?, NOW())
      `, [membership.customer_id, bonusApplied, membership.customer_id, `Bonus top-up WPC Diamond Membership Upgrade`, userId]);
    }

    const [[wallet]] = await conn.execute(
      'SELECT balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1',
      [membership.customer_id]
    );

    await conn.execute(`
      INSERT INTO tr_wallet_ledger (
        customer_id, type, amount, balance_after, description, created_by, created_at
      ) VALUES (?, 'topup', ?, ?, ?, ?, NOW())
    `, [
      membership.customer_id,
      totalDeposit,
      wallet?.balance || 0,
      `Upgrade to WPC Diamond Membership${bonusApplied > 0 ? ` (Bonus: Rp ${bonusApplied.toLocaleString('id-ID')})` : ''}`,
      userId,
    ]);

    await conn.commit();

    // Record membership history
    await recordMembershipHistory(conn, {
      customerId: membership.customer_id,
      membershipId: membership.id,
      action: 'upgrade',
      oldTier: tierKey,
      newTier: 'diamond',
      oldExpiredAt: membership.expired_at,
      newExpiredAt: membership.expired_at,
      oldStatus: 'active',
      newStatus: 'active',
      amount: totalDeposit,
      bonus: bonusApplied > 0 ? bonusApplied : null,
      notes: `WPC Gold to Diamond Membership Upgrade${bonusApplied > 0 ? ` (Bonus: Rp ${bonusApplied.toLocaleString('id-ID')})` : ''}`,
      createdBy: userId,
      picId: userId,
      picName: user?.name || 'Unknown',
    }).catch(err => logger.warn('[membership]', 'Failed to record history', { error: err.message }));

    return res.status(200).json({
      success: true,
      message: `Berhasil upgrade ke Diamond Membership!${bonusApplied > 0 ? ` Bonus Rp ${bonusApplied.toLocaleString('id-ID')} ditambahkan!` : ''}`,
      data: {
        id: membership.id,
        memberNo: membership.member_no,
        customerName: membership.customer_name,
        previousTier: 'gold',
        newTier: 'diamond',
        discountPct: TIER_CONFIG.diamond.discountPct,
        benefits: TIER_CONFIG.diamond.benefits,
        topupAmount: totalDeposit,
        bonusApplied,
        totalDeposit: totalDeposit + bonusApplied,
      },
    });
  } catch (error) {
    await conn.rollback();
    logger.error('Gagal upgrade membership', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal upgrade membership.',
      error: error.message,
    });
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: CANCEL/SUSPEND MEMBERSHIP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/membership/:id/cancel
 * Cancel/suspend membership (admin only)
 */
export async function cancelMembership(req, res) {
  const conn = await db.getConnection();

  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.roleCode;

    // Only admin can cancel
    if (!['admin'].includes(userRole)) {
      conn.release();
      return res.status(403).json({
        success: false,
        message: 'Hanya admin yang dapat membatalkan membership.',
      });
    }

    await conn.beginTransaction();

    const [[membership]] = await conn.execute(
      'SELECT * FROM mst_membership WHERE id = ? LIMIT 1',
      [id]
    );

    if (!membership) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Membership tidak ditemukan.',
      });
    }

    // Forfeit remaining balance (per business rules)
    const [[wallet]] = await conn.execute(
      'SELECT id, balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1 FOR UPDATE',
      [membership.customer_id]
    );

    if (wallet && Number(wallet.balance) > 0) {
      // Forfeit balance
      const forfeitedAmount = Number(wallet.balance);

      await conn.execute(
        'UPDATE mst_customer_wallet SET balance = 0, updated_at = NOW() WHERE id = ?',
        [wallet.id]
      );

      // Log forfeiture
      await conn.execute(`
        INSERT INTO tr_wallet_ledger (
          customer_id, type, amount, balance_after, description, is_forfeiture, created_by, created_at
        ) VALUES (?, 'forfeiture', ?, 0, ?, 1, ?, NOW())
      `, [
        membership.customer_id,
        -forfeitedAmount,
        `Membership cancelled - balance forfeited. Reason: ${reason || 'None'}`,
        userId,
      ]);
    }

    // Update membership status
    await conn.execute(`
      UPDATE mst_membership SET
        status = 'suspended',
        updated_at = NOW()
      WHERE id = ?
    `, [id]);

    // Update customer is_member flag
    await conn.execute(
      'UPDATE mst_customer SET is_member = 0, updated_at = NOW() WHERE id = ?',
      [membership.customer_id]
    );

    await conn.commit();

    // Record membership history
    await recordMembershipHistory(conn, {
      customerId: membership.customer_id,
      membershipId: membership.id,
      action: 'cancel',
      oldTier: membership.tier,
      newTier: null,
      oldExpiredAt: membership.expired_at,
      newExpiredAt: null,
      oldStatus: 'active',
      newStatus: 'suspended',
      amount: forfeitedAmount || null,
      bonus: null,
      notes: reason ? `Membership cancelled. Reason: ${reason}` : 'Membership cancelled by user/admin',
      createdBy: userId,
      picId: userId,
      picName: user?.name || 'Unknown',
    }).catch(err => logger.warn('[membership]', 'Failed to record history', { error: err.message }));

    return res.status(200).json({
      success: true,
      message: 'Membership berhasil dibatalkan. Sisa deposit telah disita sesuai ketentuan.',
    });
  } catch (error) {
    await conn.rollback();
    logger.error('Gagal membatalkan membership', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal membatalkan membership.',
    });
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON JOB: PROCESS EXPIRY & FORFEITURE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/membership/cron/expiry-check
 * Daily cron job to check and expire memberships
 * Also forfeits balance for expired memberships
 *
 * NOTE: This should be called daily by a scheduler (e.g., node-cron)
 */
export async function processExpiryAndForfeiture(req, res) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Find memberships that have expired
    const [expiredMemberships] = await conn.execute(`
      SELECT m.*, c.name as customer_name
      FROM mst_membership m
      JOIN mst_customer c ON c.id = m.customer_id
      WHERE m.status = 'active'
        AND m.expired_at < NOW()
    `);

    let processedCount = 0;
    let forfeitedTotal = 0;

    for (const membership of expiredMemberships) {
      // ── Update membership status to expired ──────────────────────────────
      await conn.execute(
        `UPDATE mst_membership SET status = 'expired' WHERE id = ?`,
        [membership.id]
      );

      // ── Forfeit remaining balance ────────────────────────────────────────
      const [[wallet]] = await conn.execute(
        'SELECT id, balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1 FOR UPDATE',
        [membership.customer_id]
      );

      if (wallet && Number(wallet.balance) > 0) {
        const forfeitedAmount = Number(wallet.balance);
        forfeitedTotal += forfeitedAmount;

        await conn.execute(
          'UPDATE mst_customer_wallet SET balance = 0, updated_at = NOW() WHERE id = ?',
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

      // ── Update customer is_member flag ──────────────────────────────────
      await conn.execute(
        'UPDATE mst_customer SET is_member = 0, updated_at = NOW() WHERE id = ?',
        [membership.customer_id]
      );

      processedCount++;

      // [processExpiry] Membership expired
    }

    // ── Check for inactivity-based expiry ────────────────────────────────
    // Get inactivity threshold from config or use defaults
    const goldInactivity = await getConfig(conn, 'gold_inactivity_months', 2);
    const diamondInactivity = await getConfig(conn, 'diamond_inactivity_months', 3);

    const [inactiveMemberships] = await conn.execute(`
      SELECT m.*, c.name as customer_name
      FROM mst_membership m
      JOIN mst_customer c ON c.id = m.customer_id
      WHERE m.status = 'active'
        AND (
          (m.tier = 'gold' AND m.inactivity_months >= ?)
          OR (m.tier = 'diamond' AND m.inactivity_months >= ?)
        )
    `, [Number(goldInactivity), Number(diamondInactivity)]);

    for (const membership of inactiveMemberships) {
      const inactivityThreshold = membership.tier === 'diamond'
        ? Number(diamondInactivity)
        : Number(goldInactivity);

      // Update membership to expired
      await conn.execute(
        `UPDATE mst_membership SET status = 'expired' WHERE id = ?`,
        [membership.id]
      );

      // Forfeit balance
      const [[wallet]] = await conn.execute(
        'SELECT id, balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1 FOR UPDATE',
        [membership.customer_id]
      );

      if (wallet && Number(wallet.balance) > 0) {
        const forfeitedAmount = Number(wallet.balance);
        forfeitedTotal += forfeitedAmount;

        await conn.execute(
          'UPDATE mst_customer_wallet SET balance = 0, updated_at = NOW() WHERE id = ?',
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
        'UPDATE mst_customer SET is_member = 0, updated_at = NOW() WHERE id = ?',
        [membership.customer_id]
      );

      processedCount++;
      // Record membership history for expiry
      await recordMembershipHistory(conn, {
        customerId: membership.customer_id,
        membershipId: membership.id,
        action: 'expire',
        oldTier: membership.tier,
        newTier: null,
        oldExpiredAt: membership.expired_at,
        newExpiredAt: null,
        oldStatus: 'active',
        newStatus: 'expired',
        amount: null,
        bonus: null,
        notes: `Expired due to ${inactivityThreshold} months inactivity`,
        createdBy: null,
        picId: null,
        picName: 'System',
      }).catch(err => logger.warn('[membership]', 'Failed to record expiry history', { error: err.message }));
      // [processExpiry] Inactive membership expired
    }

    // ── Update inactivity_months for active memberships ───────────────────
    await conn.execute(`
      UPDATE mst_membership m
      JOIN (
        SELECT
          m2.id,
          CASE
            WHEN m2.last_transaction_at IS NULL
              THEN DATEDIFF(NOW(), m2.started_at) DIV 30
            ELSE
              DATEDIFF(NOW(), m2.last_transaction_at) DIV 30
          END as new_inactivity
        FROM mst_membership m2
        WHERE m2.status = 'active'
      ) sub ON m.id = sub.id
      SET m.inactivity_months = sub.new_inactivity
    `);

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: `Processed ${processedCount} expired memberships. Total forfeited: Rp ${forfeitedTotal.toLocaleString('id-ID')}`,
      data: {
        processedCount,
        forfeitedTotal,
      },
    });
  } catch (error) {
    await conn.rollback();
    logger.error('Gagal memproses expiry membership', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses expiry membership.',
      error: error.message,
    });
  } finally {
    conn.release();
  }
}

/**
 * POST /api/membership/:id/update-last-transaction
 * Update last_transaction_at when customer makes a transaction
 * This should be called from checkout flow
 */
export async function updateLastTransaction(req, res) {
  try {
    const { id } = req.params;
    const { transactionId } = req.body;

    await db.execute(`
      UPDATE mst_membership SET
        last_transaction_at = NOW(),
        inactivity_months = 0,
        updated_at = NOW()
      WHERE id = ? AND status = 'active'
    `, [id]);

    return res.status(200).json({
      success: true,
      message: 'Last transaction updated.',
    });
  } catch (error) {
    logger.error('Gagal update last transaction', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal update last transaction.',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET MEMBERSHIP TIER INFO (public)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/membership/tiers
 * Get membership tier information (public, for display)
 */
export async function getTierInfo(req, res) {
  // Get bonus enabled status
  let bonusEnabled = true;
  try {
    const [[row]] = await db.execute(
      "SELECT setting_value FROM mst_setting WHERE setting_key = 'membership_bonus_enabled' LIMIT 1"
    );
    bonusEnabled = row?.setting_value === 'true' || row?.setting_value === '1';
  } catch { /* use default */ }

  return res.status(200).json({
    success: true,
    data: {
      bonusEnabled,
      tiers: Object.entries(TIER_CONFIG).map(([key, config]) => ({
        id: key,
        name: config.name,
        minTopup: config.minTopup,
        durationMonths: config.durationMonths,
        discountPct: config.discountPct,
        inactivityMonths: config.inactivityMonths,
        benefits: config.benefits,
        bonusAmount: bonusEnabled ? (BONUS_CONFIG[key] || 0) : 0,
      })),
    },
  });
}
