// ─────────────────────────────────────────────────────────────────────────────
// birthdayPromoCron.js — Daily Cron for Birthday Program Automation
// Task 36.2-36.3: Birthday promo auto-application and WhatsApp greeting
// ─────────────────────────────────────────────────────────────────────────────
// This script handles:
// 1. Find customers with birthday TODAY
// 2. Create birthday promo record (10% discount, valid 7 days)
// 3. Send WhatsApp birthday greeting
// ─────────────────────────────────────────────────────────────────────────────
// Schedule: Daily at 08:00 AM
// Run manually: node api/crons/birthdayPromoCron.js
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos as db } from '../db/connection.js';

// Birthday benefit rules from requirements
const BIRTHDAY_BENEFITS = {
  'loyal': { discount: 15, message: '15% DISKON' },      // Loyal: 15% discount
  'regular': { discount: 10, message: '10% DISKON' },  // Regular: 10% discount
  'one_time': { discount: 0, message: 'HADIAH SPESIAL' }, // One-time: Greeting only
  'member': { discount: 10, message: '15% DISKON' },    // Members: 10-15% based on tier
};

function generatePromoCode(customerName, birthdayDate) {
  const namePart = customerName.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  const datePart = birthdayDate.replace(/-/g, '').substring(4); // MMDD
  return `BDAY${namePart}${datePart}`;
}

async function sendBirthdayWhatsApp(customer, promo, benefit) {
  // This is a placeholder for WhatsApp integration
  // In production, this would call the WhatsApp API
  console.log(`[BirthdayCron] WhatsApp to ${customer.phone}:`);
  console.log(`   Selamat Ulang Tahun ${customer.name}! 🎉`);
  if (benefit.discount > 0) {
    console.log(`   Kami berikan ${benefit.message} berlaku 7 hari!`);
    console.log(`   Kode Promo: ${promo?.code || 'AUTO-APPLIED'}`);
  }
  console.log(`   Terima kasih sudah setia dengan My Waschen!`);

  return true;
}

async function createBirthdayPromo(conn, customer, benefit) {
  const promoCode = generatePromoCode(customer.name, customer.date_of_birth);
  const validFrom = new Date();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 7); // Valid for 7 days

  // Create promo
  await conn.execute(`
    INSERT INTO mst_promo (
      code, name, type, value, valid_from, valid_until,
      is_global, is_active, created_at, updated_at
    ) VALUES (?, ?, 'percent', ?, ?, ?, 1, 1, NOW(), NOW())
  `, [
    promoCode,
    `ULTahir ${customer.name}`,
    benefit.discount,
    validFrom,
    validUntil,
  ]);

  // Get the created promo
  const [[promo]] = await conn.execute(
    `SELECT id, code FROM mst_promo WHERE code = ? LIMIT 1`,
    [promoCode]
  );

  return promo;
}

async function processBirthdays() {
  const conn = await db.getConnection();
  let processedCount = 0;
  let promoCreatedCount = 0;
  let whatsappSentCount = 0;
  const results = {
    birthdays: [],
    errors: [],
  };

  try {
    await conn.beginTransaction();

    // ── STEP 1: Find customers with birthday today ────────────────────────────────
    // Extract MONTH and DAY from date_of_birth and compare with TODAY
    const [birthdayCustomers] = await conn.execute(`
      SELECT
        c.id as customer_id,
        c.name as customer_name,
        c.phone,
        c.date_of_birth,
        c.segment,
        c.is_member,
        m.tier as membership_tier,
        m.status as membership_status
      FROM mst_customer c
      LEFT JOIN mst_membership m ON m.customer_id = c.id AND m.status = 'active'
      WHERE c.deleted_at IS NULL
        AND c.date_of_birth IS NOT NULL
        AND MONTH(c.date_of_birth) = MONTH(CURDATE())
        AND DAY(c.date_of_birth) = DAY(CURDATE())
    `);

    console.log(`[BirthdayCron] Found ${birthdayCustomers.length} customers with birthday today`);

    for (const customer of birthdayCustomers) {
      try {
        // Determine benefit based on segment/membership
        let benefit = BIRTHDAY_BENEFITS.one_time;

        if (customer.membership_status === 'active') {
          // Members get better benefits
          if (customer.membership_tier === 'diamond') {
            benefit = { discount: 15, message: '15% DISKON' };
          } else {
            benefit = { discount: 10, message: '10% DISKON' };
          }
        } else if (customer.segment === 'loyal') {
          benefit = BIRTHDAY_BENEFITS.loyal;
        } else if (customer.segment === 'regular') {
          benefit = BIRTHDAY_BENEFITS.regular;
        }

        // Create birthday promo for non-one-time customers
        let promo = null;
        if (benefit.discount > 0) {
          promo = await createBirthdayPromo(conn, customer, benefit);
          promoCreatedCount++;
        }

        // Send WhatsApp greeting
        const whatsappSent = await sendBirthdayWhatsApp(customer, promo, benefit);
        if (whatsappSent) {
          whatsappSentCount++;
        }

        // Log notification in tr_notification
        await conn.execute(`
          INSERT INTO tr_notification (
            template_id, type, send_mode, recipient_customer_id,
            wa_number, message_body, status, sent_by, created_at
          ) VALUES (NULL, 'birthday_greeting', 'wa_business_api', ?, ?, ?, 'sent', NULL, NOW())
        `, [
          customer.customer_id,
          customer.phone,
          `Selamat Ulang Tahun ${customer.customer_name}! Kami berikan ${benefit.message} berlaku 7 hari. Terima kasih sudah setia dengan My Waschen!`
        ]);

        results.birthdays.push({
          customerId: customer.customer_id,
          customerName: customer.customer_name,
          phone: customer.phone,
          segment: customer.segment,
          isMember: customer.membership_status === 'active',
          discount: benefit.discount,
          promoCode: promo?.code || null,
          whatsappSent,
        });

        processedCount++;
        console.log(`[BirthdayCron] Processed: ${customer.customer_name} (${customer.segment || 'no segment'}) - ${benefit.message}`);

      } catch (err) {
        results.errors.push({ customerId: customer.customer_id, error: err.message });
        console.error(`[BirthdayCron] Error processing ${customer.customer_name}:`, err.message);
      }
    }

    await conn.commit();

  } catch (error) {
    await conn.rollback();
    console.error('[BirthdayCron] Fatal error:', error);
    throw error;
  } finally {
    conn.release();
  }

  return {
    processedCount,
    promoCreatedCount,
    whatsappSentCount,
    results,
  };
}

// ── CLI Execution ─────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Birthday Promo & Greeting Cron Job');
  console.log('  Date:', new Date().toISOString().split('T')[0]);
  console.log('═══════════════════════════════════════════════════════════════');

  processBirthdays()
    .then(({ processedCount, promoCreatedCount, whatsappSentCount }) => {
      console.log('\n✅ Birthday Cron Completed');
      console.log(`   Customers Processed: ${processedCount}`);
      console.log(`   Promos Created: ${promoCreatedCount}`);
      console.log(`   WhatsApp Sent: ${whatsappSentCount}`);
      console.log('═══════════════════════════════════════════════════════════════\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Birthday Cron Failed:', err);
      console.log('═══════════════════════════════════════════════════════════════\n');
      process.exit(1);
    });
}

export { processBirthdays };
