import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import { notDeleted, softDeleteRecord } from '../utils/softDelete.js';

// ─── Controller: POST /api/customers/:id/topup ─────────────────────────────
export const topupDeposit = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const { amount, payMethod } = req.body;

    // Ambil min deposit dari config (default Rp 500.000)
    let minDeposit = 500000;
    try {
      const [[cfg]] = await conn.execute(
        "SELECT config_val FROM mst_app_config WHERE config_key = 'min_deposit_amount' AND is_active = 1 LIMIT 1"
      );
      if (cfg?.config_val) minDeposit = Number(cfg.config_val) || 500000;
    } catch { /* config table belum ada, pakai default */ }

    if (!amount || Number(amount) < minDeposit) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: `Nominal top up minimal Rp ${minDeposit.toLocaleString('id-ID')}.`,
      });
    }

    const [custRows] = await conn.execute(
      'SELECT id, name, is_member FROM mst_customer WHERE id = ? AND is_active = 1 LIMIT 1',
      [id]
    );
    if (custRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Customer tidak ditemukan.' });
    }

    await conn.beginTransaction();

    // 1. Update / create wallet
    const [walletRows] = await conn.execute(
      'SELECT id, balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1',
      [id]
    );

    if (walletRows.length > 0) {
      await conn.execute(
        'UPDATE mst_customer_wallet SET balance = balance + ? WHERE customer_id = ?',
        [Number(amount), id]
      );
    } else {
      await conn.execute(
        `INSERT INTO mst_customer_wallet (customer_id, balance, status)
         VALUES (?, ?, 'active')`,
        [id, Number(amount)]
      );
    }

    const [[wallet]] = await conn.execute(
      'SELECT balance FROM mst_customer_wallet WHERE customer_id = ?',
      [id]
    );

    // BUG FIX: Membership Auto-Extend Logic (Requirements 2.14, 2.15)
    // Top up >= minDeposit should:
    // - Active member: extend from OLD end_date (not from today)
    // - Expired member: reactivate with end_date = today + 6 months
    // - Non-member: automatically upgrade to premium!
    let membershipExtended = false;
    let membershipExtendedTo = null;
    let membershipUpgraded = false;

    if (!custRows[0].is_member) {
      // Case: Non-member → auto-upgrade to premium!
      try {
        const memberNo = 'MBR-' + Date.now().toString().slice(-6);
        await conn.execute(
          `INSERT INTO mst_membership (
            customer_id, member_no, status, discount_pct, 
            topup_count, started_at, expired_at, registered_by, created_at, updated_at
          ) VALUES (?, ?, 'active', 20.00, 1, NOW(), DATE_ADD(NOW(), INTERVAL 6 MONTH), ?, NOW(), NOW())`,
          [id, memberNo, req.user?.userId || id]
        );
        await conn.execute('UPDATE mst_customer SET is_member = 1, updated_at = NOW() WHERE id = ?', [id]);
        membershipUpgraded = true;
        membershipExtended = true;
        const [[newMemb]] = await conn.execute('SELECT expired_at FROM mst_membership WHERE customer_id = ? ORDER BY id DESC LIMIT 1', [id]);
        membershipExtendedTo = newMemb.expired_at;
        console.log(`[topupDeposit] Customer ${id} automatically upgraded to premium member!`);
      } catch (mErr) {
        console.warn('[topupDeposit] gagal auto-upgrade membership:', mErr?.message);
      }
    } else {
      try {
        const [[memb]] = await conn.execute(
          `SELECT id, status, expired_at FROM mst_membership
           WHERE customer_id = ?
           ORDER BY expired_at DESC LIMIT 1`,
          [id]
        );
        
        if (memb) {
          const now = new Date();
          const expiredAt = new Date(memb.expired_at);
          const isExpired = expiredAt < now || memb.status === 'expired';

          if (isExpired) {
            // Case: Expired member - reactivate with new end_date from today
            await conn.execute(
              `UPDATE mst_membership
               SET status = 'active',
                   expired_at = DATE_ADD(NOW(), INTERVAL 6 MONTH),
                   topup_count = topup_count + 1,
                   last_topup_at = NOW(),
                   updated_at = NOW()
               WHERE id = ?`,
              [memb.id]
            );
            
            const [[newMemb]] = await conn.execute(
              'SELECT expired_at FROM mst_membership WHERE id = ?',
              [memb.id]
            );
            membershipExtendedTo = newMemb.expired_at;
            membershipExtended = true;
            console.log(`[topupDeposit] Membership reactivated for customer ${id}, new end_date: ${membershipExtendedTo}`);
          } else {
            // Case: Active member - extend from OLD end_date (not from today)
            await conn.execute(
              `UPDATE mst_membership
               SET expired_at = DATE_ADD(?, INTERVAL 6 MONTH),
                   topup_count = topup_count + 1,
                   last_topup_at = NOW(),
                   updated_at = NOW()
               WHERE id = ?`,
              [memb.expired_at, memb.id]
            );
            
            const [[newMemb]] = await conn.execute(
              'SELECT expired_at FROM mst_membership WHERE id = ?',
              [memb.id]
            );
            membershipExtendedTo = newMemb.expired_at;
            membershipExtended = true;
            console.log(`[topupDeposit] Membership extended for customer ${id} from ${memb.expired_at} to ${membershipExtendedTo}`);
          }
        }
      } catch (mErr) {
        console.warn('[topupDeposit] gagal perpanjang membership:', mErr?.message || mErr);
      }
    }

    // 3. Catat riwayat top-up
    try {
      await conn.execute(
        `INSERT INTO tr_wallet_topup_log
           (customer_id, amount, pay_method, recorded_by, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [id, Number(amount), payMethod || 'cash', req.user?.userId || null]
      );
    } catch { /* tabel log belum ada — skip */ }

    await conn.commit();

    writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      outletId: req.user?.outletId,
      entityType: 'customer_wallet',
      entityId: id,
      action: 'topup_deposit',
      newData: {
        amount: Number(amount),
        payMethod: payMethod || 'cash',
        newBalance: Number(wallet.balance),
        membershipExtended,
      },
      req,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Top up Rp ${Number(amount).toLocaleString('id-ID')} berhasil${membershipUpgraded ? '. Selamat, customer berhasil menjadi Premium Member!' : membershipExtended ? '. Membership diperpanjang 6 bulan!' : '.'}`,
      data: {
        newBalance: Number(wallet.balance),
        membershipExtended,
        membershipUpgraded,
        membershipExtendedTo: membershipExtendedTo ? membershipExtendedTo.toISOString().slice(0, 10) : null,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('[topupDeposit] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal melakukan top up deposit.' });
  } finally {
    conn.release();
  }
};

// ─── Controller: POST /api/customers/:id/upgrade ───────────────────────────────
export const upgradeToPremium = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    await conn.beginTransaction();

    // 1. Cek customer
    const [custRows] = await conn.execute('SELECT id, is_member FROM mst_customer WHERE id = ?', [id]);
    if (custRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Customer tidak ditemukan.' });
    }

    if (custRows[0].is_member) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Customer ini sudah menjadi member Premium.' });
    }

    // 2. Generate Member No
    const memberNo = 'MBR-' + Date.now().toString().slice(-6);

    // 3. Insert ke mst_membership (aktif 6 bulan dari sekarang) — id AUTO_INCREMENT
    await conn.execute(
      `INSERT INTO mst_membership (
        customer_id, member_no, status, discount_pct, 
        topup_count, started_at, expired_at, registered_by, created_at, updated_at
      ) VALUES (?, ?, 'active', 20.00, 0, NOW(), DATE_ADD(NOW(), INTERVAL 6 MONTH), ?, NOW(), NOW())`,
      [id, memberNo, userId || id]
    );

    // 4. Update mst_customer.is_member = 1
    await conn.execute('UPDATE mst_customer SET is_member = 1, updated_at = NOW() WHERE id = ?', [id]);

    await conn.commit();
    return res.status(200).json({ success: true, message: 'Customer berhasil diupgrade menjadi Premium!' });
  } catch (error) {
    await conn.rollback();
    console.error('[upgradeToPremium] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal meng-upgrade customer.' });
  } finally {
    conn.release();
  }
};

// ─── Controller: POST /api/customers/:id/downgrade ───────────────────────────
export const downgradeFromPremium = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;

    await conn.beginTransaction();

    const [custRows] = await conn.execute('SELECT id, is_member FROM mst_customer WHERE id = ?', [id]);
    if (custRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Customer tidak ditemukan.' });
    }

    if (!custRows[0].is_member) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Customer ini bukan member Premium.' });
    }

    await conn.execute(
      "UPDATE mst_membership SET status = 'expired', expired_at = NOW(), updated_at = NOW() WHERE customer_id = ? AND status = 'active'",
      [id]
    );

    await conn.execute('UPDATE mst_customer SET is_member = 0, updated_at = NOW() WHERE id = ?', [id]);

    await conn.commit();
    return res.status(200).json({ success: true, message: 'Customer berhasil diturunkan menjadi member biasa.' });
  } catch (error) {
    await conn.rollback();
    console.error('[downgradeFromPremium] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menurunkan status member.' });
  } finally {
    conn.release();
  }
};

// ─── Helper: Get default awareness source id ──────────────────────────────────
const getDefaultAwarenessSource = async () => {
  const [rows] = await poolWaschenPos.execute(
    "SELECT id FROM mst_awareness_source WHERE is_active = 1 ORDER BY sort_order LIMIT 1"
  );
  if (rows.length > 0) return rows[0].id;
  // id AUTO_INCREMENT — biarkan DB yang generate
  const [result] = await poolWaschenPos.execute(
    "INSERT INTO mst_awareness_source (code, name) VALUES ('DEFAULT', 'Walk In')"
  );
  return result.insertId;
};

// ─── Helper: Get default area zone id ──────────────────────────────────────────
const getDefaultAreaZone = async () => {
  const [rows] = await poolWaschenPos.execute(
    "SELECT id FROM mst_area_zone WHERE is_active = 1 ORDER BY name LIMIT 1"
  );
  if (rows.length > 0) return rows[0].id;

  const [outlets] = await poolWaschenPos.execute("SELECT id FROM mst_outlet LIMIT 1");
  if (outlets.length === 0) return null; // Edge case

  // id AUTO_INCREMENT — biarkan DB yang generate
  const [result] = await poolWaschenPos.execute(
    "INSERT INTO mst_area_zone (outlet_id, code, name, delivery_fee) VALUES (?, 'DEF', 'Default Area', 0)",
    [outlets[0].id]
  );
  return result.insertId;
};

const normalizeGreeting = (value) => {
  if (!value) return 'Other';
  const key = String(value).trim().toLowerCase();
  const map = {
    pak: 'Bapak',
    bapak: 'Bapak',
    bu: 'Ibu',
    ibu: 'Ibu',
    kak: 'Kak',
    mas: 'Mas',
    mbak: 'Mbak',
    other: 'Other',
  };
  return map[key] || 'Other';
};

// ─── Helper: Generate customer number ───────────────────────────────────────────
const generateCustomerNo = async () => {
  const prefix = 'CUS';
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  // Hitung HANYA customer yang belum dihapus untuk sequence harian.
  // Kalau pakai semua customer (termasuk deleted), sequence bisa skip atau dobel
  // saat ada customer dihapus lalu daftar lagi di hari yang sama.
  const [rows] = await poolWaschenPos.execute(
    "SELECT COUNT(*) as count FROM mst_customer WHERE DATE(created_at) = CURDATE() AND deleted_at IS NULL"
  );
  const seq = String(rows[0].count + 1).padStart(4, '0');
  return `${prefix}-${dateStr}-${seq}`;
};

const CUSTOMER_SELECT = `
  SELECT
    c.id,
    c.name,
    c.phone,
    c.email,
    c.gender,
    c.greeting,
    c.awareness_source_id AS awareness_source_id,
    c.awareness_other_text AS awareness_other_text,
    c.area_zone_id AS area_zone_id,
    c.registered_outlet_id AS registeredOutletId,
    c.address_housing AS addressHousing,
    c.address_block AS addressBlock,
    c.address_no AS addressNo,
    c.address_detail AS addressDetail,
    c.is_member AS isMember,
    c.notes,
    c.is_active AS active,
    c.created_at AS createdAt,
    c.updated_at AS updatedAt,
    az.name AS areaZoneName,
    o.name AS registeredOutletName,
    COALESCE(w.balance, 0) AS deposit,
    COALESCE(tx.total_tx, 0) AS totalTx,
    COALESCE(tx.last_tx_date, NULL) AS lastTxDate,
    m.status AS membershipStatus,
    m.discount_pct AS membershipDiscountPct,
    m.expired_at AS membershipExpiredAt,
    CASE 
      WHEN m.status = 'active' AND m.expired_at >= NOW() THEN 'active'
      WHEN m.expired_at IS NOT NULL AND m.expired_at < NOW() THEN 'expired'
      ELSE NULL
    END AS membershipActiveStatus,
    CASE 
      WHEN m.status = 'active' AND m.expired_at >= NOW() AND DATEDIFF(m.expired_at, NOW()) <= 7 THEN 1
      ELSE 0
    END AS membershipExpiringSoon
  FROM mst_customer c
  LEFT JOIN mst_area_zone az ON az.id = c.area_zone_id
  LEFT JOIN mst_outlet o ON o.id = c.registered_outlet_id
  LEFT JOIN mst_customer_wallet w ON w.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, COUNT(*) AS total_tx, MAX(created_at) AS last_tx_date
    FROM tr_transaction
    WHERE deleted_at IS NULL AND status != 'cancelled'
    GROUP BY customer_id
  ) tx ON tx.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, status, discount_pct, expired_at
    FROM mst_membership
    WHERE (customer_id, expired_at) IN (
      SELECT customer_id, MAX(expired_at)
      FROM mst_membership
      GROUP BY customer_id
    )
  ) m ON m.customer_id = c.id`;

const mapCustomerRow = (c) => {
  // Compute loyalty category based on transaction history
  const totalTx = Number(c.totalTx) || 0;
  const lastTxDate = c.lastTxDate ? new Date(c.lastTxDate) : null;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const isRecent = lastTxDate && lastTxDate >= thirtyDaysAgo;
  let loyaltyCategory;
  if (!isRecent && lastTxDate) {
    loyaltyCategory = 'churn'; // last tx > 30 days ago
  } else if (totalTx >= 5) {
    loyaltyCategory = 'loyal'; // ≥5 transactions, last tx ≤30 days
  } else if (totalTx >= 2) {
    loyaltyCategory = 'regular'; // 2-4 transactions, last tx ≤30 days
  } else if (totalTx === 1) {
    loyaltyCategory = 'one_time'; // exactly 1 transaction
  } else {
    loyaltyCategory = 'new'; // no transactions yet
  }

  return {
    ...c,
    avatar: (c.name || '')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    isPremium: c.isMember === 1 || c.isMember === true,
    deposit: Number(c.deposit) || 0,
    totalTx,
    loyaltyCategory,
    registeredOutletId: c.registeredOutletId || null,
    registeredOutletName: c.registeredOutletName || null,
  };
};

// ─── Controller: GET /api/customers ────────────────────────────────────────────
export const getCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 100, outletId: queryOutletId, sort, member, loyalty } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 100));
    const offset = (pageNum - 1) * limitNum;

    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobalRole = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);

    let where = 'c.is_active = 1 AND c.deleted_at IS NULL';
    const params = [];

    // Outlet filter logic:
    // - Database satu sumber — semua role bisa lihat semua customer
    // - Semua role (termasuk kasir) bisa filter berdasarkan outlet asal customer
    // - Customer di-tag dengan registered_outlet_id untuk identifikasi asal
    if (queryOutletId) {
      where += ' AND c.registered_outlet_id = ?';
      params.push(queryOutletId);
    }

    if (search && search.trim()) {
      // Cari di nama, HP, email, dan alamat (housing/block/no/detail)
      where += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
        OR c.address_housing LIKE ? OR c.address_block LIKE ?
        OR c.address_no LIKE ? OR c.address_detail LIKE ?)`;
      const q = `%${search.trim()}%`;
      params.push(q, q, q, q, q, q, q);
    }

    if (member === 'premium') {
      where += ' AND c.is_member = 1';
    } else if (member === 'regular') {
      where += ' AND (c.is_member = 0 OR c.is_member IS NULL)';
    }

    // Loyalty filter - applied in-memory since it's computed (not stored in DB)
    // We still need to filter customers who match the loyalty category
    // This is handled in the query by joining with transaction data
    if (loyalty && ['loyal', 'regular', 'one_time', 'churn', 'new'].includes(loyalty)) {
      // Get customer IDs matching the loyalty criteria
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

      // Subquery to get loyalty classification per customer
      if (loyalty === 'new') {
        where += ' AND (SELECT COUNT(*) FROM tr_transaction WHERE customer_id = c.id AND deleted_at IS NULL AND status != \'cancelled\') = 0';
      } else if (loyalty === 'one_time') {
        where += ' AND (SELECT COUNT(*) FROM tr_transaction WHERE customer_id = c.id AND deleted_at IS NULL AND status != \'cancelled\') = 1';
      } else if (loyalty === 'loyal') {
        where += ` AND (SELECT COUNT(*) FROM tr_transaction WHERE customer_id = c.id AND deleted_at IS NULL AND status != \'cancelled\') >= 5`;
        where += ` AND (SELECT MAX(created_at) FROM tr_transaction WHERE customer_id = c.id AND deleted_at IS NULL AND status != \'cancelled\') >= '${thirtyDaysAgoStr}'`;
      } else if (loyalty === 'regular') {
        where += ` AND (SELECT COUNT(*) FROM tr_transaction WHERE customer_id = c.id AND deleted_at IS NULL AND status != \'cancelled\') BETWEEN 2 AND 4`;
        where += ` AND (SELECT MAX(created_at) FROM tr_transaction WHERE customer_id = c.id AND deleted_at IS NULL AND status != \'cancelled\') >= '${thirtyDaysAgoStr}'`;
      } else if (loyalty === 'churn') {
        where += ` AND (SELECT COUNT(*) FROM tr_transaction WHERE customer_id = c.id AND deleted_at IS NULL AND status != \'cancelled\') > 0`;
        where += ` AND (SELECT MAX(created_at) FROM tr_transaction WHERE customer_id = c.id AND deleted_at IS NULL AND status != \'cancelled\') < '${thirtyDaysAgoStr}'`;
      }
    }

    // Count total
    const [countRows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS total FROM mst_customer c WHERE ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    // Fetch rows
    const sortKey = String(sort || 'name_asc').toLowerCase();
    const sortSql = {
      name_asc: 'c.name ASC',
      newest: 'c.created_at DESC',
      frequent: 'COALESCE(tx.total_tx, 0) DESC, c.name ASC',
    };
    const orderBy = sortSql[sortKey] || sortSql.name_asc;

    const [rows] = await poolWaschenPos.execute(
      `${CUSTOMER_SELECT} WHERE ${where} ORDER BY ${orderBy} LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    return res.status(200).json({
      success: true,
      data: rows.map(mapCustomerRow),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error('[getCustomers] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data pelanggan.' });
  }
};

// ─── Controller: GET /api/customers/lookup ────────────────────────────────────
// Fast autocomplete search by name OR phone — used at checkout
export const lookupCustomers = async (req, res) => {
  try {
    const { q } = req.query;
    const query = (q || '').trim();
    if (query.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobalRole = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);

    const searchPattern = `%${query}%`;
    const phoneClean = query.replace(/\D/g, '');

    // Database terpusat — semua user bisa akses semua customer
    // registered_outlet_id tetap sebagai tag asal customer
    const outletFilter = '';
    const outletParam = [];

    const [rows] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone, c.is_member, c.gender,
              c.registered_outlet_id AS registeredOutletId,
              o.name AS registeredOutletName,
              c.address_housing AS addressHousing,
              c.address_block AS addressBlock,
              c.address_no AS addressNo,
              w.balance AS depositBalance
       FROM mst_customer c
       LEFT JOIN mst_customer_wallet w ON w.customer_id = c.id
       LEFT JOIN mst_outlet o ON o.id = c.registered_outlet_id
       WHERE c.is_active = 1 AND c.deleted_at IS NULL
         ${outletFilter}
         AND (c.name LIKE ? OR c.phone LIKE ?
              OR c.address_housing LIKE ? OR c.address_block LIKE ?
              OR c.address_no LIKE ? OR c.address_detail LIKE ?
              ${phoneClean ? "OR REPLACE(REPLACE(c.phone,'+',''),'-','') LIKE ?" : ''})
       ORDER BY
         CASE WHEN c.phone = ? THEN 0
              WHEN c.phone LIKE ? THEN 1
              WHEN c.name LIKE ? THEN 2
              ELSE 3 END,
         c.name
       LIMIT 15`,
      phoneClean
        ? [...outletParam, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, `%${phoneClean}%`, query, `${query}%`, `${query}%`]
        : [...outletParam, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, query, `${query}%`, `${query}%`]
    );

    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      isMember: r.is_member === 1,
      gender: r.gender,
      registeredOutletId: r.registeredOutletId,
      registeredOutletName: r.registeredOutletName || null,
      addressHousing: r.addressHousing || null,
      addressBlock: r.addressBlock || null,
      addressNo: r.addressNo || null,
      depositBalance: r.depositBalance != null ? Number(r.depositBalance) : 0,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[lookupCustomers] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mencari customer.' });
  }
};

// ─── Controller: GET /api/customers/:id ──────────────────────────────────────
export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await poolWaschenPos.execute(
      `${CUSTOMER_SELECT} WHERE c.id = ? AND c.is_active = 1 LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer tidak ditemukan.' });
    }
    const base = mapCustomerRow(rows[0]);

    // Tambah info membership aktif + loyalty points (best-effort)
    try {
      const [membRows] = await poolWaschenPos.execute(
        `SELECT id, member_no, status, discount_pct, expired_at, started_at, topup_count
         FROM mst_membership
         WHERE customer_id = ? AND status = 'active'
         ORDER BY expired_at DESC LIMIT 1`,
        [id]
      );
      if (membRows.length > 0) {
        const m = membRows[0];
        base.membership = {
          id: m.id,
          memberNo: m.member_no,
          status: m.status,
          discountPct: Number(m.discount_pct),
          startedAt: m.started_at,
          expiredAt: m.expired_at,
          topupCount: Number(m.topup_count) || 0,
          isExpired: new Date(m.expired_at) < new Date(),
        };

        // Hitung loyalty balance (sum of remaining_points untuk earn yang belum expire)
        const [[balRow]] = await poolWaschenPos.execute(
          `SELECT COALESCE(SUM(remaining_points), 0) AS balance
           FROM tr_loyalty_ledger
           WHERE membership_id = ? AND type = 'earn'
             AND (expired_at IS NULL OR expired_at >= NOW())`,
          [m.id]
        );
        base.loyaltyPoints = Number(balRow?.balance || 0);
      } else {
        base.membership = null;
        base.loyaltyPoints = 0;
      }
    } catch (mErr) {
      console.warn('[getCustomerById] gagal ambil membership/loyalty:', mErr?.message || mErr);
      base.membership = null;
      base.loyaltyPoints = 0;
    }

    return res.status(200).json({ success: true, data: base });
  } catch (err) {
    console.error('[getCustomerById] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data pelanggan.' });
  }
};

// ─── Controller: POST /api/customers ───────────────────────────────────────────
export const createCustomer = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      gender,
      greeting,
      area_zone_id,
      address_housing,
      address_block,
      address_no,
      address_detail,
      awareness_source_id,
      awareness_other_text,
      notes,
    } = req.body;

    // Validasi: hanya nama dan HP yang wajib
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Nama dan nomor HP wajib diisi',
      });
    }

    // Cek duplikat phone
    const [existing] = await poolWaschenPos.execute(
      'SELECT id FROM mst_customer WHERE phone = ? AND is_active = 1',
      [phone.trim()]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Nomor HP sudah terdaftar',
      });
    }

    // BUG FIX: Cascading Address Validation (Requirements 2.1, 2.3)
    // Customer MUST provide EITHER structured cascading address OR address_other fallback
    const {
      province_id,
      city_id,
      district_id,
      sub_district_id,
      address_other,
    } = req.body;

    const hasStructuredAddress = province_id && city_id && district_id && sub_district_id;
    const hasAddressOther = address_other && address_other.trim();

    if (!hasStructuredAddress && !hasAddressOther) {
      return res.status(422).json({
        success: false,
        message: 'Alamat wajib diisi. Pilih dari cascading dropdown (Province → City → District → Sub-District) atau isi "Alamat Lainnya" jika tidak ditemukan di master.',
        errors: {
          address: 'Required: Either (province_id, city_id, district_id, sub_district_id) OR address_other'
        }
      });
    }

    // Validate partial cascading address (must be complete or none)
    if ((province_id || city_id || district_id || sub_district_id) && !hasStructuredAddress) {
      return res.status(422).json({
        success: false,
        message: 'Alamat cascading tidak lengkap. Harap lengkapi semua field: Province, City, District, Sub-District.',
        errors: {
          address: 'Incomplete cascading address'
        }
      });
    }

    // Gunakan auto-increment ID dari database (bukan UUID)
    const customerNo = await generateCustomerNo();

    // Default fallback untuk field yang masih NOT NULL di DDL — auto-isi dari master
    const finalAwarenessId = awareness_source_id || await getDefaultAwarenessSource();
    const finalAreaZoneId  = area_zone_id || await getDefaultAreaZone();
    const finalEmail = email ? email.trim() : null;
    const finalNotes = notes || null;
    const finalAwarenessOther = awareness_other_text || null;
    const finalGreeting = normalizeGreeting(greeting || 'Other');
    const finalGender = ['male', 'female', 'other'].includes(gender) ? gender : 'other';

    // BUG FIX: Awareness Source "Lainnya" Validation (Requirements 2.2)
    // If awareness source has is_other=true, awareness_other_text MUST NOT be empty
    if (finalAwarenessId) {
      const [[awarenessSource]] = await poolWaschenPos.execute(
        'SELECT is_other FROM mst_awareness_source WHERE id = ? LIMIT 1',
        [finalAwarenessId]
      );
      
      if (awarenessSource && awarenessSource.is_other === 1) {
        if (!awareness_other_text || !awareness_other_text.trim()) {
          return res.status(422).json({
            success: false,
            message: 'Jika memilih "Lainnya" sebagai sumber informasi, harap isi detail sumber informasi.',
            errors: {
              awareness_other_text: 'Required when awareness source is "Lainnya"'
            }
          });
        }
      }
    }

    const [insertResult] = await poolWaschenPos.execute(
      `INSERT INTO mst_customer (
        customer_no, name, phone, gender, greeting, email,
        awareness_source_id, awareness_other_text, area_zone_id,
        registered_outlet_id,
        province_id, city_id, district_id, sub_district_id, address_detail, address_other,
        address_housing, address_block, address_no,
        is_member, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, TRUE, NOW(), NOW())`,
      [
        customerNo, name.trim(), phone.trim(), finalGender, finalGreeting,
        finalEmail, finalAwarenessId, finalAwarenessOther, finalAreaZoneId,
        req.user?.outletId || null,
        province_id || null,
        city_id || null,
        district_id || null,
        sub_district_id || null,
        (address_detail || '').trim() || null,
        address_other ? address_other.trim() : null,
        (address_housing || '').trim() || '-',
        (address_block || '').trim() || '-',
        (address_no || '').trim() || '-',
        finalNotes,
      ]
    );

    // Ambil ID auto-increment yang baru dibuat
    const id = insertResult.insertId || insertResult.insertId?.toString();

    // Buat wallet untuk customer baru
    await poolWaschenPos.execute(
      `INSERT INTO mst_customer_wallet (customer_id, balance, status)
       VALUES (?, 0, 'active')`,
      [id]
    );

    const newCustomer = {
      id,
      name: name.trim(),
      phone: phone.trim(),
      email: finalEmail,
      gender: gender,
      greeting: greeting,
      addressHousing: address_housing,
      addressBlock: address_block,
      addressNo: address_no,
      addressDetail: address_detail,
      isMember: false,
      isPremium: false,
      notes: finalNotes,
      active: true,
      deposit: 0,
      totalTx: 0,
      avatar: name
        .trim()
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    };

    return res.status(201).json({
      success: true,
      message: 'Pelanggan berhasil ditambahkan',
      data: newCustomer,
    });
  } catch (err) {
    console.error('[createCustomer] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menambahkan pelanggan.' });
  }
};

// ─── Controller: PUT /api/customers/:id ────────────────────────────────────────
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      email,
      gender,
      greeting,
      areaZoneId,
      addressHousing,
      addressBlock,
      addressNo,
      addressDetail,
      awarenessSourceId,
      notes,
      awareness_source_id,
      area_zone_id,
      address_housing,
      address_block,
      address_no,
      address_detail,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Nama dan nomor HP wajib diisi' });
    }

    // Cek duplikat phone
    const [existing] = await poolWaschenPos.execute(
      'SELECT id FROM mst_customer WHERE phone = ? AND is_active = 1 AND id != ?',
      [phone.trim(), id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Nomor HP sudah terdaftar pada customer lain' });
    }

    const defaultAwareness = awarenessSourceId || awareness_source_id || await getDefaultAwarenessSource();
    const defaultAreaZone = areaZoneId || area_zone_id || await getDefaultAreaZone();
    const finalGreeting = normalizeGreeting(greeting);
    const finalEmail = email ? email.trim() : null;
    const finalAddressHousing = typeof (addressHousing ?? address_housing) === 'string'
      ? (addressHousing ?? address_housing).trim()
      : (addressHousing ?? address_housing) || '';
    const finalAddressBlock = typeof (addressBlock ?? address_block) === 'string'
      ? (addressBlock ?? address_block).trim()
      : (addressBlock ?? address_block) || '';
    const finalAddressNo = typeof (addressNo ?? address_no) === 'string'
      ? (addressNo ?? address_no).trim()
      : (addressNo ?? address_no) || '';
    const finalAddressDetail = typeof (addressDetail ?? address_detail) === 'string'
      ? (addressDetail ?? address_detail).trim()
      : (addressDetail ?? address_detail) || '';
    const finalNotes = typeof notes === 'string' ? notes.trim() || null : notes || null;

    // BUG FIX: Add cascading address support to updateCustomer
    const {
      province_id,
      city_id,
      district_id,
      sub_district_id,
      address_other,
    } = req.body;

    // Validate cascading address if provided (must be complete or none)
    const hasAnyProvinceData = province_id !== undefined || city_id !== undefined || 
                               district_id !== undefined || sub_district_id !== undefined;

    if (hasAnyProvinceData) {
      const hasCompleteStructuredAddress = province_id && city_id && district_id && sub_district_id;
      
      if (!hasCompleteStructuredAddress && !address_other) {
        return res.status(422).json({
          success: false,
          message: 'Alamat cascading tidak lengkap. Harap lengkapi semua field atau gunakan "Alamat Lainnya".',
          errors: {
            address: 'Incomplete cascading address'
          }
        });
      }
    }

    await poolWaschenPos.execute(
      `UPDATE mst_customer SET 
        name = ?, phone = ?, gender = ?, greeting = ?, email = ?,
        awareness_source_id = ?, area_zone_id = ?,
        province_id = ?, city_id = ?, district_id = ?, sub_district_id = ?,
        address_detail = ?, address_other = ?,
        address_housing = ?, address_block = ?, address_no = ?,
        notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        name.trim(), phone.trim(), gender || 'other', finalGreeting, finalEmail,
        defaultAwareness, defaultAreaZone,
        province_id || null,
        city_id || null,
        district_id || null,
        sub_district_id || null,
        finalAddressDetail || null,
        address_other ? address_other.trim() : null,
        finalAddressHousing, finalAddressBlock, finalAddressNo,
        finalNotes, id
      ]
    );

    return res.status(200).json({ success: true, message: 'Pelanggan berhasil diupdate' });
  } catch (err) {
    console.error('[updateCustomer] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengupdate pelanggan.' });
  }
};

// ─── Controller: DELETE /api/customers/:id ─────────────────────────────────────
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBy = req.user?.userId || null;
    await poolWaschenPos.execute(
      'UPDATE mst_customer SET is_active = 0, deleted_at = NOW(), deleted_by = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [deletedBy, id]
    );
    return res.status(200).json({ success: true, message: 'Pelanggan berhasil dihapus.' });
  } catch (err) {
    console.error('[deleteCustomer] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus pelanggan.' });
  }
};

// ─── GET /api/customers/:id/favorite-services — layanan favorit customer ───
export const getCustomerFavoriteServices = async (req, res) => {
  try {
    const { id } = req.params;

    const [custRows] = await poolWaschenPos.execute(
      'SELECT id FROM mst_customer WHERE id = ? AND is_active = 1 LIMIT 1',
      [id]
    );
    if (!custRows.length) return res.status(404).json({ success: false, message: 'Customer tidak ditemukan.' });

    const [rows] = await poolWaschenPos.execute(
      `SELECT f.service_id AS serviceId, f.usage_count AS usageCount,
              f.last_used_at AS lastUsedAt, f.is_manual_pin AS isManualPin,
              s.name AS serviceName, s.icon AS serviceIcon,
              s.base_price AS basePrice, s.unit_type AS unitType,
              s.is_express AS hasExpress, s.is_active AS serviceIsActive
       FROM mst_customer_service_favorite f
       JOIN mst_service s ON s.id = f.service_id
       WHERE f.customer_id = ?
       ORDER BY f.is_manual_pin DESC, f.usage_count DESC`,
      [id]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[getCustomerFavoriteServices]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat layanan favorit.' });
  }
};

// ─── PUT /api/customers/:id/favorite-services — update pin status layanan favorit ───
export const updateCustomerFavoriteService = async (req, res) => {
  try {
    const { id } = req.params;
    const { service_id, is_manual_pin } = req.body;

    if (!service_id) return res.status(400).json({ success: false, message: 'service_id wajib diisi.' });

    await poolWaschenPos.execute(
      `INSERT INTO mst_customer_service_favorite (customer_id, service_id, usage_count, is_manual_pin, last_used_at)
       VALUES (?, ?, 0, ?, NOW())
       ON DUPLICATE KEY UPDATE is_manual_pin = ?`,
      [id, service_id, is_manual_pin ? 1 : 0, is_manual_pin ? 1 : 0]
    );

    return res.status(200).json({ success: true, message: 'Layanan favorit berhasil diupdate.' });
  } catch (err) {
    console.error('[updateCustomerFavoriteService]', err);
    return res.status(500).json({ success: false, message: 'Gagal update layanan favorit.' });
  }
};

// ─── DELETE /api/customers/:id/favorite-services/:serviceId — hapus dari favorit ───
export const removeCustomerFavoriteService = async (req, res) => {
  try {
    const { id, serviceId } = req.params;

    await poolWaschenPos.execute(
      'DELETE FROM mst_customer_service_favorite WHERE customer_id = ? AND service_id = ?',
      [id, serviceId]
    );

    return res.status(200).json({ success: true, message: 'Layanan dihapus dari favorit.' });
  } catch (err) {
    console.error('[removeCustomerFavoriteService]', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus favorit.' });
  }
};
// Export customer transaction history as Excel or PDF
export const exportCustomerTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'xlsx', from, to } = req.query;

    // Validate customer exists
    const [custRows] = await poolWaschenPos.execute(
      'SELECT id, name, phone FROM mst_customer WHERE id = ? AND is_active = 1 LIMIT 1',
      [id]
    );
    if (custRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer tidak ditemukan.' });
    }
    const customer = custRows[0];

    // Build transaction query
    const params = [id];
    let where = 't.customer_id = ? AND t.deleted_at IS NULL AND t.status != \'cancelled\'';
    if (from) {
      where += ' AND DATE(t.created_at) >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND DATE(t.created_at) <= ?';
      params.push(to);
    }

    const [txRows] = await poolWaschenPos.execute(
      `SELECT
        t.id,
        t.transaction_no AS transactionNo,
        t.created_at AS createdAt,
        t.total,
        t.paid_amount AS paidAmount,
        t.payment_status AS paymentStatus,
        t.primary_payment_method AS payMethod,
        t.status AS dbStatus,
        t.picked_up_at AS pickedUpAt,
        o.name AS outletName
       FROM tr_transaction t
       LEFT JOIN mst_outlet o ON o.id = t.outlet_id
       WHERE ${where}
       ORDER BY t.created_at DESC`,
      params
    );

    // Get items per transaction
    const txIds = txRows.map(r => r.id);
    let allItems = [];
    if (txIds.length > 0) {
      const placeholders = txIds.map(() => '?').join(',');
      const [itemRows] = await poolWaschenPos.execute(
        `SELECT ti.transaction_id, ti.service_name_snapshot AS serviceName,
                ti.unit_type_snapshot AS unit, ti.qty, ti.price, ti.subtotal
         FROM tr_transaction_item ti
         WHERE ti.transaction_id IN (${placeholders}) AND ti.is_active = 1`,
        txIds
      );
      allItems = itemRows;
    }

    // Helper functions
    const fmtDate = (v) => {
      if (!v) return '-';
      try { return new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
      catch { return String(v); }
    };
    const fmtCurrency = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;
    const payStatusLabels = { 'paid': 'Lunas', 'partial': 'Sebagian', 'unpaid': 'Belum Bayar' };
    const payMethodLabels = {
      'cash': 'Tunai', 'transfer': 'Transfer', 'qris': 'QRIS',
      'gopay': 'GoPay', 'shopeepay': 'ShopeePay', 'ovo': 'OVO',
      'dana': 'DANA', 'deposit': 'Deposit', 'mixed': 'Campuran'
    };

    // Create flat rows for export
    const rows = txRows.map(tx => {
      const txItems = allItems.filter(i => i.transaction_id === tx.id);
      const itemSummary = txItems.map(i => `${i.serviceName} (${i.qty} ${i.unit})`).join(', ') || '-';
      return {
        tanggal: fmtDate(tx.createdAt),
        noNota: tx.transactionNo || tx.id,
        layanan: itemSummary,
        qty: txItems.reduce((s, i) => s + Number(i.qty || 0), 0),
        total: fmtCurrency(tx.total),
        statusBayar: payStatusLabels[tx.paymentStatus] || tx.paymentStatus,
        metodeBayar: payMethodLabels[tx.payMethod] || tx.payMethod,
        outlet: tx.outletName || '-',
      };
    });

    // Summary
    const totalAmount = txRows.reduce((s, t) => s + Number(t.total || 0), 0);
    const totalPaid = txRows.reduce((s, t) => s + Number(t.paidAmount || 0), 0);
    const periodLabel = from && to ? `${fmtDate(from)} - ${fmtDate(to)}` : 'Semua Periode';
    const safeName = customer.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
    const dateSuffix = new Date().toISOString().slice(0, 10);

    if (format === 'pdf') {
      // Build PDF
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN TRANSAKSI CUSTOMER', 14, 15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Nama: ${customer.name}  |  HP: ${customer.phone}  |  Periode: ${periodLabel}`, 14, 22);

      // Summary box
      doc.setFillColor(79, 70, 229);
      doc.rect(14, 26, pageWidth - 28, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(`${txRows.length} transaksi  |  Total: ${fmtCurrency(totalAmount)}  |  Dibayar: ${fmtCurrency(totalPaid)}`, 17, 33);
      doc.setTextColor(0);

      // Table
      autoTable(doc, {
        startY: 42,
        head: [['Tanggal', 'No. Nota', 'Layanan / Item', 'Qty', 'Total', 'Status Bayar', 'Metode', 'Outlet']],
        body: rows.map(r => [r.tanggal, r.noNota, r.layanan, r.qty, r.total, r.statusBayar, r.metodeBayar, r.outlet]),
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 0, 95], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 22 }, 1: { cellWidth: 28 }, 2: { cellWidth: 55 },
          3: { cellWidth: 10 }, 4: { cellWidth: 25 }, 5: { cellWidth: 20 },
          6: { cellWidth: 18 }, 7: { cellWidth: 30 }
        },
        didDrawPage: (data) => {
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(`Halaman ${data.pageNumber} — Generated: ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
          doc.setTextColor(0);
        }
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="transaksi_${safeName}_${dateSuffix}.pdf"`);
      return res.send(Buffer.from(doc.output('arraybuffer')));
    } else {
      // Build XLSX (default)
      const XLSX = (await import('xlsx')).default;
      const wsData = [];

      // Header info
      wsData.push(['LAPORAN TRANSAKSI CUSTOMER']);
      wsData.push([`Nama: ${customer.name}`]);
      wsData.push([`HP: ${customer.phone}`]);
      wsData.push([`Periode: ${periodLabel}`]);
      wsData.push([`Total Transaksi: ${txRows.length}`]);
      wsData.push([`Total Nilai: ${fmtCurrency(totalAmount)}`]);
      wsData.push([`Sudah Dibayar: ${fmtCurrency(totalPaid)}`]);
      wsData.push([]);
      wsData.push(['Tanggal', 'No. Nota', 'Layanan', 'Qty', 'Total', 'Status Bayar', 'Metode', 'Outlet']);

      rows.forEach(r => {
        wsData.push([r.tanggal, r.noNota, r.layanan, r.qty, r.total, r.statusBayar, r.metodeBayar, r.outlet]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 6 },
        { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 18 }
      ];
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');

      const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="transaksi_${safeName}_${dateSuffix}.xlsx"`);
      return res.send(Buffer.from(xlsxBuffer));
    }
  } catch (err) {
    console.error('[exportCustomerTransactions] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal export transaksi.' });
  }
};
