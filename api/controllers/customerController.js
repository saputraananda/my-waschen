import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';

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

    // 2. Auto-perpanjang membership 6 bulan jika customer sudah member
    let membershipExtended = false;
    if (custRows[0].is_member) {
      try {
        const [[memb]] = await conn.execute(
          `SELECT id, expired_at, topup_count FROM mst_membership
           WHERE customer_id = ? AND status = 'active' LIMIT 1`,
          [id]
        );
        if (memb) {
          // Perpanjang 6 bulan dari expired_at saat ini (jika belum expired) atau dari NOW
          const baseDate = new Date(memb.expired_at) > new Date() ? memb.expired_at : new Date();
          await conn.execute(
            `UPDATE mst_membership
             SET expired_at = DATE_ADD(?, INTERVAL 6 MONTH),
                 topup_count = topup_count + 1,
                 last_topup_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [baseDate, memb.id]
          );
          membershipExtended = true;
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
      message: `Top up Rp ${Number(amount).toLocaleString('id-ID')} berhasil${membershipExtended ? '. Membership diperpanjang 6 bulan!' : '.'}`,
      data: {
        newBalance: Number(wallet.balance),
        membershipExtended,
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
    COALESCE(tx.total_tx, 0) AS totalTx
  FROM mst_customer c
  LEFT JOIN mst_area_zone az ON az.id = c.area_zone_id
  LEFT JOIN mst_outlet o ON o.id = c.registered_outlet_id
  LEFT JOIN mst_customer_wallet w ON w.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, COUNT(*) AS total_tx
    FROM tr_transaction
    WHERE deleted_at IS NULL AND status != 'cancelled'
    GROUP BY customer_id
  ) tx ON tx.customer_id = c.id`;

const mapCustomerRow = (c) => ({
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
  totalTx: Number(c.totalTx) || 0,
  registeredOutletId: c.registeredOutletId || null,
  registeredOutletName: c.registeredOutletName || null,
});

// ─── Controller: GET /api/customers ────────────────────────────────────────────
export const getCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 100, outletId: queryOutletId, sort, member } = req.query;
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

    const [insertResult] = await poolWaschenPos.execute(
      `INSERT INTO mst_customer (
        customer_no, name, phone, gender, greeting, email,
        awareness_source_id, awareness_other_text, area_zone_id,
        registered_outlet_id,
        address_housing, address_block, address_no, address_detail,
        is_member, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, TRUE, NOW(), NOW())`,
      [
        customerNo, name.trim(), phone.trim(), finalGender, finalGreeting,
        finalEmail, finalAwarenessId, finalAwarenessOther, finalAreaZoneId,
        req.user?.outletId || null,
        (address_housing || '').trim() || '-',
        (address_block || '').trim() || '-',
        (address_no || '').trim() || '-',
        (address_detail || '').trim() || '-',
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

    await poolWaschenPos.execute(
      `UPDATE mst_customer SET 
        name = ?, phone = ?, gender = ?, greeting = ?, email = ?,
        awareness_source_id = ?, area_zone_id = ?,
        address_housing = ?, address_block = ?, address_no = ?, address_detail = ?,
        notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        name.trim(), phone.trim(), gender || 'other', finalGreeting, finalEmail,
        defaultAwareness, defaultAreaZone,
        finalAddressHousing, finalAddressBlock, finalAddressNo, finalAddressDetail,
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
