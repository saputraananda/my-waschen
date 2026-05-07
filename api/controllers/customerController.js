import { poolWaschenPos } from '../db/connection.js';
import { randomUUID } from 'crypto';

// ─── Controller: POST /api/customers/:id/topup ─────────────────────────────
export const topupDeposit = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const { amount, payMethod } = req.body;

    if (!amount || Number(amount) < 1000) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Nominal top up minimal Rp 1.000.' });
    }

    const [custRows] = await conn.execute(
      'SELECT id, name FROM mst_customer WHERE id = ? AND is_active = 1 LIMIT 1',
      [id]
    );
    if (custRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Customer tidak ditemukan.' });
    }

    await conn.beginTransaction();

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
        `INSERT INTO mst_customer_wallet (id, customer_id, balance, status)
         VALUES (?, ?, ?, 'active')`,
        [randomUUID(), id, Number(amount)]
      );
    }

    const [[wallet]] = await conn.execute(
      'SELECT balance FROM mst_customer_wallet WHERE customer_id = ?',
      [id]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: `Top up Rp ${Number(amount).toLocaleString('id-ID')} berhasil.`,
      data: { newBalance: Number(wallet.balance) },
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

    // 3. Insert ke mst_membership (aktif 6 bulan dari sekarang)
    await conn.execute(
      `INSERT INTO mst_membership (
        id, customer_id, member_no, status, discount_pct, 
        topup_count, started_at, expired_at, registered_by, created_at, updated_at
      ) VALUES (?, ?, ?, 'active', 20.00, 0, NOW(), DATE_ADD(NOW(), INTERVAL 6 MONTH), ?, NOW(), NOW())`,
      [randomUUID(), id, memberNo, userId || id]
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

// ─── Helper: Get default awareness source id ──────────────────────────────────
const getDefaultAwarenessSource = async () => {
  const [rows] = await poolWaschenPos.execute(
    "SELECT id FROM mst_awareness_source WHERE is_active = 1 ORDER BY sort_order LIMIT 1"
  );
  if (rows.length > 0) return rows[0].id;
  const newId = randomUUID();
  await poolWaschenPos.execute("INSERT INTO mst_awareness_source (id, code, name) VALUES (?, 'DEFAULT', 'Walk In')", [newId]);
  return newId;
};

// ─── Helper: Get default area zone id ──────────────────────────────────────────
const getDefaultAreaZone = async () => {
  const [rows] = await poolWaschenPos.execute(
    "SELECT id FROM mst_area_zone WHERE is_active = 1 ORDER BY name LIMIT 1"
  );
  if (rows.length > 0) return rows[0].id;

  const [outlets] = await poolWaschenPos.execute("SELECT id FROM mst_outlet LIMIT 1");
  if (outlets.length === 0) return null; // Edge case

  const newId = randomUUID();
  await poolWaschenPos.execute(
    "INSERT INTO mst_area_zone (id, outlet_id, code, name, delivery_fee) VALUES (?, ?, 'DEF', 'Default Area', 0)",
    [newId, outlets[0].id]
  );
  return newId;
};

// ─── Helper: Generate customer number ───────────────────────────────────────────
const generateCustomerNo = async () => {
  const prefix = 'CUS';
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const [rows] = await poolWaschenPos.execute(
    "SELECT COUNT(*) as count FROM mst_customer WHERE DATE(created_at) = CURDATE()"
  );
  const seq = String(rows[0].count + 1).padStart(4, '0');
  return `${prefix}-${dateStr}-${seq}`;
};

// ─── Controller: GET /api/customers ────────────────────────────────────────────
export const getCustomers = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.gender,
        c.greeting,
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
        COALESCE(w.balance, 0) AS deposit,
        COALESCE(tx.total_tx, 0) AS totalTx
      FROM mst_customer c
      LEFT JOIN mst_area_zone az ON az.id = c.area_zone_id
      LEFT JOIN mst_customer_wallet w ON w.customer_id = c.id
      LEFT JOIN (
        SELECT customer_id, COUNT(*) AS total_tx
        FROM tr_transaction
        WHERE deleted_at IS NULL AND status != 'cancelled'
        GROUP BY customer_id
      ) tx ON tx.customer_id = c.id
      WHERE c.is_active = 1
      ORDER BY c.name`
    );

    const customers = rows.map((c) => ({
      ...c,
      avatar: c.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      isPremium: c.isMember === 1 || c.isMember === true,
      deposit: Number(c.deposit) || 0,
      totalTx: Number(c.totalTx) || 0,
    }));

    return res.status(200).json({ success: true, data: customers });
  } catch (err) {
    console.error('[getCustomers] Error:', err);
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

    // Validasi mandatory fields
    if (!name || !phone || !gender || !greeting || !area_zone_id || !address_housing || !address_block || !address_no || !address_detail || !awareness_source_id) {
      return res.status(400).json({
        success: false,
        message: 'Semua field wajib (nama, hp, gender, sapaan, sumber info, area/zona, perumahan, blok, no, detail) harus diisi',
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

    const id = randomUUID();
    const customerNo = await generateCustomerNo();

    const finalEmail = email || null;
    const finalNotes = notes || null;
    const finalAwarenessOther = awareness_other_text || null;

    await poolWaschenPos.execute(
      `INSERT INTO mst_customer (
        id, customer_no, name, phone, gender, greeting, email,
        awareness_source_id, awareness_other_text, area_zone_id,
        address_housing, address_block, address_no, address_detail,
        is_member, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, TRUE, NOW(), NOW())`,
      [
        id, customerNo, name.trim(), phone.trim(), gender, greeting,
        finalEmail, awareness_source_id, finalAwarenessOther, area_zone_id,
        address_housing, address_block, address_no, address_detail,
        finalNotes,
      ]
    );

    // Buat wallet untuk customer baru
    await poolWaschenPos.execute(
      `INSERT INTO mst_customer_wallet (id, customer_id, balance, status)
       VALUES (?, ?, 0, 'active')`,
      [randomUUID(), id]
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

    const defaultAwareness = awarenessSourceId || await getDefaultAwarenessSource();
    const defaultAreaZone = areaZoneId || await getDefaultAreaZone();

    await poolWaschenPos.execute(
      `UPDATE mst_customer SET 
        name = ?, phone = ?, gender = ?, greeting = ?, email = ?,
        awareness_source_id = ?, area_zone_id = ?,
        address_housing = ?, address_block = ?, address_no = ?, address_detail = ?,
        notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        name.trim(), phone.trim(), gender || 'other', greeting || 'Other', email || null,
        defaultAwareness, defaultAreaZone,
        addressHousing || '', addressBlock || '', addressNo || '', addressDetail || '',
        notes || null, id
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
    await poolWaschenPos.execute('UPDATE mst_customer SET is_active = 0, updated_at = NOW() WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Pelanggan berhasil dihapus' });
  } catch (err) {
    console.error('[deleteCustomer] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus pelanggan.' });
  }
};
