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
        'UPDATE mst_customer_wallet SET balance = balance + ?, updated_at = NOW() WHERE customer_id = ?',
        [Number(amount), id]
      );
    } else {
      await conn.execute(
        `INSERT INTO mst_customer_wallet (id, customer_id, balance, is_active, created_at, updated_at)
         VALUES (?, ?, ?, TRUE, NOW(), NOW())`,
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

// ─── Helper: Get default awareness source id ──────────────────────────────────
const getDefaultAwarenessSource = async () => {
  const [rows] = await poolWaschenPos.execute(
    "SELECT id FROM mst_awareness_source WHERE is_active = 1 ORDER BY sort_order LIMIT 1"
  );
  return rows.length > 0 ? rows[0].id : null;
};

// ─── Helper: Get default area zone id ──────────────────────────────────────────
const getDefaultAreaZone = async () => {
  const [rows] = await poolWaschenPos.execute(
    "SELECT id FROM mst_area_zone WHERE is_active = 1 ORDER BY name LIMIT 1"
  );
  return rows.length > 0 ? rows[0].id : null;
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
        WHERE is_active = 1
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
      areaZoneId,
      addressHousing,
      addressBlock,
      addressNo,
      addressDetail,
      awarenessSourceId,
      notes,
    } = req.body;

    // Validasi minimal
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

    const id = randomUUID();
    const customerNo = await generateCustomerNo();
    const defaultAwareness = awarenessSourceId || await getDefaultAwarenessSource();
    const defaultAreaZone = areaZoneId || await getDefaultAreaZone();

    // Default values untuk field mandatory
    const finalGender = gender || 'other';
    const finalGreeting = greeting || 'Other';
    const finalAddressHousing = addressHousing || '';
    const finalAddressBlock = addressBlock || '';
    const finalAddressNo = addressNo || '';
    const finalAddressDetail = addressDetail || (addressHousing ? `${addressHousing} ${addressBlock || ''} No.${addressNo || ''}` : '');
    const finalEmail = email || null;
    const finalNotes = notes || null;

    await poolWaschenPos.execute(
      `INSERT INTO mst_customer (
        id, customer_no, name, phone, gender, greeting, email,
        awareness_source_id, area_zone_id,
        address_housing, address_block, address_no, address_detail,
        is_member, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, TRUE, NOW(), NOW())`,
      [
        id, customerNo, name.trim(), phone.trim(), finalGender, finalGreeting,
        finalEmail, defaultAwareness, defaultAreaZone,
        finalAddressHousing, finalAddressBlock, finalAddressNo, finalAddressDetail,
        finalNotes,
      ]
    );

    // Buat wallet untuk customer baru
    await poolWaschenPos.execute(
      `INSERT INTO mst_customer_wallet (id, customer_id, balance, is_active, created_at, updated_at)
       VALUES (?, ?, 0, TRUE, NOW(), NOW())`,
      [randomUUID(), id]
    );

    const newCustomer = {
      id,
      name: name.trim(),
      phone: phone.trim(),
      email: finalEmail,
      gender: finalGender,
      greeting: finalGreeting,
      addressHousing: finalAddressHousing,
      addressBlock: finalAddressBlock,
      addressNo: finalAddressNo,
      addressDetail: finalAddressDetail,
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
