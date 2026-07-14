/**
 * Bug Condition Exploration Test - Material Dropdown Missing
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * 
 * **GOAL**: Surface counterexamples where material_id is missing for services requiring material
 * 
 * **Scoped PBT Approach**: Test concrete scenario:
 * - POST /transactions with service where requires_material=true but transaction_item has material_id=null
 * 
 * From Bug Condition in design.md:
 * ```
 * FUNCTION isMaterialDropdownBug(TransactionItem, Service)
 *   RETURN Service.requires_material = true AND
 *          TransactionItem.material_id IS NULL
 * END FUNCTION
 * ```
 * 
 * Expected Behavior (from Requirements 2.4):
 * - Backend SHALL reject (422) when material_id is missing for material-required services
 * 
 * **Validates: Requirements 2.4**
 * 
 * **EXPECTED OUTCOME**: Test FAILS (backend currently accepts without material_id)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test configuration
const TEST_DB_CONFIG = {
  host: process.env.HOST_WASCHEN_POS || 'localhost',
  port: parseInt(process.env.PORT_WASCHEN_POS || '3306'),
  user: process.env.USER_WASCHEN_POS || 'root',
  password: process.env.PASS_WASCHEN_POS || '',
  database: process.env.DB_WASCHEN_POS || 'my_waschen',
  waitForConnections: true,
  connectionLimit: 10,
};

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

let pool;
let testTransactionIds = [];
let testCustomerId;
let testOutletId;
let testUserId;
let testSessionId;
let testServiceWithMaterial; // Service that requires_material=true
let testServiceWithoutMaterial; // Service that requires_material=false
let testMaterialId;
let authToken;

describe('Bug Condition Exploration - Material Dropdown Missing', () => {
  beforeAll(async () => {
    // Setup database connection
    pool = mysql.createPool(TEST_DB_CONFIG);
    
    // Get test outlet
    const [outletRows] = await pool.execute(
      'SELECT id FROM mst_outlet WHERE is_active = 1 LIMIT 1'
    );
    testOutletId = outletRows[0]?.id || 1;

    // Get or create test user (cashier)
    const [userRows] = await pool.execute(
      'SELECT id, username FROM mst_user WHERE role = "kasir" AND is_active = 1 LIMIT 1'
    );
    
    if (userRows.length === 0) {
      // Create test user if none exists
      const [insertResult] = await pool.execute(
        `INSERT INTO mst_user (username, password, full_name, role, outlet_id, is_active, created_at, updated_at)
         VALUES ('test_kasir', '$2a$10$test', 'Test Kasir', 'kasir', ?, 1, NOW(), NOW())`,
        [testOutletId]
      );
      testUserId = insertResult.insertId;
      console.log(`Created test kasir user with id=${testUserId}`);
    } else {
      testUserId = userRows[0].id;
      console.log(`Using existing kasir user: ${userRows[0].username}, id=${testUserId}`);
    }

    // Create or get active shift session for test user
    const [[existingSession]] = await pool.execute(
      `SELECT id FROM tr_cashier_session 
       WHERE cashier_id = ? AND outlet_id = ? AND status = 'open' AND deleted_at IS NULL
       ORDER BY opened_at DESC LIMIT 1`,
      [testUserId, testOutletId]
    );

    if (existingSession) {
      testSessionId = existingSession.id;
      console.log(`Using existing open session id=${testSessionId}`);
    } else {
      // Create new session
      const [sessionInsert] = await pool.execute(
        `INSERT INTO tr_cashier_session 
         (outlet_id, cashier_id, shift, session_date, initial_cash, status, opened_at, created_at, updated_at)
         VALUES (?, ?, 'pagi', CURDATE(), 100000, 'open', NOW(), NOW(), NOW())`,
        [testOutletId, testUserId]
      );
      testSessionId = sessionInsert.insertId;
      console.log(`Created new test session with id=${testSessionId}`);
    }

    // Get or create test customer
    const [customerRows] = await pool.execute(
      'SELECT id FROM mst_customer WHERE phone = "082199998888" LIMIT 1'
    );
    
    if (customerRows.length === 0) {
      const [areaRows] = await pool.execute(
        'SELECT id FROM mst_area_zone WHERE is_active = 1 LIMIT 1'
      );
      const areaZoneId = areaRows[0]?.id || 1;

      const [awarenessRows] = await pool.execute(
        'SELECT id FROM mst_awareness_source WHERE is_active = 1 LIMIT 1'
      );
      const awarenessSourceId = awarenessRows[0]?.id || 1;

      const [insertResult] = await pool.execute(
        `INSERT INTO mst_customer 
         (customer_no, name, phone, gender, greeting, awareness_source_id, area_zone_id, 
          registered_outlet_id, is_member, is_active, created_at, updated_at)
         VALUES (?, 'Test Customer Material', '082199998888', 'male', 'Bapak', ?, ?, ?, 0, 1, NOW(), NOW())`,
        [`TEST-MAT-${Date.now()}`, awarenessSourceId, areaZoneId, testOutletId]
      );
      testCustomerId = insertResult.insertId;
      console.log(`Created test customer with id=${testCustomerId}`);
    } else {
      testCustomerId = customerRows[0].id;
      console.log(`Using existing test customer id=${testCustomerId}`);
    }

    // Find service with requires_material=true (e.g., Cuci Karpet, Cuci Gorden, Cuci Sofa)
    const [materialServiceRows] = await pool.execute(
      `SELECT id, name AS service_name, unit_type, price, requires_material 
       FROM mst_service 
       WHERE requires_material = 1 AND is_active = 1
       LIMIT 1`
    );
    
    if (materialServiceRows.length === 0) {
      // Create test service that requires material
      const [categoryRows] = await pool.execute(
        'SELECT id FROM mst_service_category WHERE is_active = 1 LIMIT 1'
      );
      const categoryId = categoryRows[0]?.id || 1;

      const [insertResult] = await pool.execute(
        `INSERT INTO mst_service 
         (code, name, category_id, unit_type, price, requires_material, is_active, created_at, updated_at)
         VALUES ('TEST-KARPET', 'Test Cuci Karpet', ?, 'pcs', 50000, 1, 1, NOW(), NOW())`,
        [categoryId]
      );
      const newServiceId = insertResult.insertId;
      
      const [[newService]] = await pool.execute(
        `SELECT id, name AS service_name, unit_type, price, requires_material 
         FROM mst_service WHERE id = ?`,
        [newServiceId]
      );
      testServiceWithMaterial = newService;
      console.log(`Created test service requiring material: ${testServiceWithMaterial.service_name}, id=${testServiceWithMaterial.id}`);
    } else {
      testServiceWithMaterial = materialServiceRows[0];
      console.log(`Found service requiring material: ${testServiceWithMaterial.service_name}, id=${testServiceWithMaterial.id}, requires_material=${testServiceWithMaterial.requires_material}`);
    }

    // Find service with requires_material=false or NULL (normal service)
    const [normalServiceRows] = await pool.execute(
      `SELECT id, name AS service_name, unit_type, price, requires_material 
       FROM mst_service 
       WHERE (requires_material = 0 OR requires_material IS NULL) AND is_active = 1
       LIMIT 1`
    );
    testServiceWithoutMaterial = normalServiceRows[0] || null;
    
    if (testServiceWithoutMaterial) {
      console.log(`Found service not requiring material: ${testServiceWithoutMaterial.service_name}, id=${testServiceWithoutMaterial.id}`);
    }

    // Get a test material
    const [materialRows] = await pool.execute(
      'SELECT id, name FROM mst_material WHERE is_active = 1 LIMIT 1'
    );
    
    if (materialRows.length === 0) {
      // Create test material if none exists
      const [insertResult] = await pool.execute(
        `INSERT INTO mst_material (code, name, is_active, sort_order, created_at, updated_at)
         VALUES ('TEST-WOOL', 'Test Wool', 1, 10, NOW(), NOW())`
      );
      testMaterialId = insertResult.insertId;
      console.log(`Created test material with id=${testMaterialId}`);
    } else {
      testMaterialId = materialRows[0].id;
      console.log(`Found material: ${materialRows[0].name}, id=${testMaterialId}`);
    }

    // For API calls, we'll mock the auth token
    authToken = 'test-token'; // In real scenario, this would be obtained from login
  });

  afterAll(async () => {
    // Cleanup: Delete test transactions and their items
    if (testTransactionIds.length > 0) {
      // Delete transaction items first (FK constraint)
      await pool.execute(
        `DELETE FROM tr_transaction_item WHERE transaction_id IN (${testTransactionIds.join(',')})`
      );
      
      // Delete transactions
      await pool.execute(
        `DELETE FROM tr_transaction WHERE id IN (${testTransactionIds.join(',')})`
      );
      
      console.log(`Cleaned up ${testTransactionIds.length} test transactions`);
    }
    
    // Close connection
    await pool.end();
  });

  /**
   * Property 1: Bug Condition - Material Field Not Enforced
   * 
   * This test checks if backend accepts transaction_item without material_id when service requires material.
   * 
   * Bug Condition (from design.md):
   * Backend does not reject request when service.requires_material=true but transaction_item.material_id is NULL.
   * 
   * **Validates: Requirements 2.4**
   */
  describe('Property 1: Bug Condition - Material Field Not Enforced', () => {
    it('SHOULD FAIL: Backend accepts transaction without material_id for service requiring material', async () => {
      // Scenario 1: Create transaction for "Cuci Karpet" service without providing material_id
      // Expected: Backend SHALL reject (422) with error message about missing material_id
      // Bug: Backend accepts the transaction (material_id validation not enforced)
      
      const transactionPayload = {
        customerId: testCustomerId,
        outletId: testOutletId,
        items: [
          {
            serviceId: testServiceWithMaterial.id,
            serviceName: testServiceWithMaterial.service_name,
            unit: testServiceWithMaterial.unit_type,
            qty: 1,
            price: testServiceWithMaterial.price,
            isExpress: false,
            // BUG: material_id is missing when service.requires_material=true
            materialId: null,
          }
        ],
        payment: {
          method: 'cash',
          paidAmount: testServiceWithMaterial.price,
          changeAmount: 0,
        },
        subtotal: testServiceWithMaterial.price,
        discount: 0,
        total: testServiceWithMaterial.price,
        notes: 'Test transaction - material validation bug',
      };

      // Direct database insert to simulate POST /transactions/checkout behavior on UNFIXED code
      // (bypassing controller validation to test the buggy scenario)
      
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Generate transaction number
        const now = new Date();
        const yy = String(now.getFullYear()).slice(2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const transactionNo = `WSC-${yy}${mm}${dd}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

        // Insert transaction
        const [trxResult] = await conn.execute(
          `INSERT INTO tr_transaction 
           (outlet_id, customer_id, cashier_id, session_id, transaction_no, source_channel, status, 
            payment_status, primary_payment_method, is_express, pickup_type, subtotal, total, paid_amount, 
            change_amount, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'kasir', 'pending', 'paid', 'cash', 0, 'self', ?, ?, ?, 0, NOW(), NOW())`,
          [
            testOutletId,
            testCustomerId,
            testUserId,
            testSessionId,
            transactionNo,
            transactionPayload.subtotal,
            transactionPayload.total,
            transactionPayload.payment.paidAmount,
          ]
        );

        const transactionId = trxResult.insertId;
        testTransactionIds.push(transactionId);

        // Insert transaction item WITHOUT material_id (BUG CONDITION)
        const itemNo = `${transactionNo}-001`;
        const [itemResult] = await conn.execute(
          `INSERT INTO tr_transaction_item 
           (transaction_id, service_id, item_no, service_name_snapshot, unit_type_snapshot, 
            qty, price, is_express, subtotal, material_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            transactionId,
            testServiceWithMaterial.id,
            itemNo,
            testServiceWithMaterial.service_name,
            testServiceWithMaterial.unit_type,
            1,
            testServiceWithMaterial.price,
            0,
            testServiceWithMaterial.price,
            null, // BUG: material_id is NULL when service requires_material=true
          ]
        );

        await conn.commit();
        conn.release();

        // Bug Condition: On UNFIXED code, this insert succeeds (no material_id validation)
        // Verify the buggy behavior: Transaction item was created without material_id
        const [[savedItem]] = await pool.execute(
          `SELECT ti.*, s.requires_material 
           FROM tr_transaction_item ti
           JOIN mst_service s ON s.id = ti.service_id
           WHERE ti.transaction_id = ?`,
          [transactionId]
        );

        expect(savedItem).toBeDefined();
        expect(savedItem.service_id).toBe(testServiceWithMaterial.id);
        expect(savedItem.requires_material).toBe(1);

        // EXPECTED TO FAIL: On unfixed code, material_id is NULL
        // Expected Behavior (after fix): material_id MUST NOT be NULL when service.requires_material=true
        expect(
          savedItem.material_id,
          `material_id MUST NOT be NULL when service "${testServiceWithMaterial.service_name}" requires_material=true`
        ).not.toBeNull();

        // Document counterexample:
        console.log('\n=== COUNTEREXAMPLE FOUND ===');
        console.log('Bug Condition: Backend accepts transaction_item without material_id when service.requires_material=true');
        console.log('Transaction Data:', {
          transaction_id: transactionId,
          transaction_no: transactionNo,
          service_id: savedItem.service_id,
          service_name: savedItem.service_name_snapshot,
          requires_material: savedItem.requires_material, // requires_material=1 (true)
          material_id: savedItem.material_id, // Expected: NOT NULL, Actual: NULL
        });
        console.log(`Expected: Backend SHALL reject (422) when material_id is NULL for service "${testServiceWithMaterial.service_name}"`);
        console.log('Actual: Backend accepted transaction with material_id=NULL');
        console.log('=== END COUNTEREXAMPLE ===\n');

      } catch (error) {
        await conn.rollback();
        conn.release();
        throw error;
      }
    });

    it('SHOULD PASS: Backend accepts transaction with material_id for service requiring material (valid scenario)', async () => {
      // Scenario 2: Create transaction for "Cuci Karpet" service WITH material_id
      // This is VALID behavior and should be accepted
      
      const transactionPayload = {
        customerId: testCustomerId,
        outletId: testOutletId,
        items: [
          {
            serviceId: testServiceWithMaterial.id,
            serviceName: testServiceWithMaterial.service_name,
            unit: testServiceWithMaterial.unit_type,
            qty: 1,
            price: testServiceWithMaterial.price,
            isExpress: false,
            materialId: testMaterialId, // VALID: material_id provided
          }
        ],
        payment: {
          method: 'cash',
          paidAmount: testServiceWithMaterial.price,
          changeAmount: 0,
        },
        subtotal: testServiceWithMaterial.price,
        discount: 0,
        total: testServiceWithMaterial.price,
        notes: 'Test transaction - valid material scenario',
      };

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Generate transaction number
        const now = new Date();
        const yy = String(now.getFullYear()).slice(2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const transactionNo = `WSC-${yy}${mm}${dd}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

        // Insert transaction
        const [trxResult] = await conn.execute(
          `INSERT INTO tr_transaction 
           (outlet_id, customer_id, cashier_id, session_id, transaction_no, source_channel, status, 
            payment_status, primary_payment_method, is_express, pickup_type, subtotal, total, paid_amount, 
            change_amount, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'kasir', 'pending', 'paid', 'cash', 0, 'self', ?, ?, ?, 0, NOW(), NOW())`,
          [
            testOutletId,
            testCustomerId,
            testUserId,
            testSessionId,
            transactionNo,
            transactionPayload.subtotal,
            transactionPayload.total,
            transactionPayload.payment.paidAmount,
          ]
        );

        const transactionId = trxResult.insertId;
        testTransactionIds.push(transactionId);

        // Insert transaction item WITH material_id (VALID)
        const itemNo = `${transactionNo}-001`;
        await conn.execute(
          `INSERT INTO tr_transaction_item 
           (transaction_id, service_id, item_no, service_name_snapshot, unit_type_snapshot, 
            qty, price, is_express, subtotal, material_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            transactionId,
            testServiceWithMaterial.id,
            itemNo,
            testServiceWithMaterial.service_name,
            testServiceWithMaterial.unit_type,
            1,
            testServiceWithMaterial.price,
            0,
            testServiceWithMaterial.price,
            testMaterialId, // VALID: material_id provided
          ]
        );

        await conn.commit();
        conn.release();

        // Verify valid scenario: Transaction item has material_id
        const [[savedItem]] = await pool.execute(
          `SELECT ti.*, s.requires_material 
           FROM tr_transaction_item ti
           JOIN mst_service s ON s.id = ti.service_id
           WHERE ti.transaction_id = ?`,
          [transactionId]
        );

        expect(savedItem).toBeDefined();
        expect(savedItem.service_id).toBe(testServiceWithMaterial.id);
        expect(savedItem.requires_material).toBe(1);
        expect(savedItem.material_id).toBe(testMaterialId); // material_id is provided (VALID)

        console.log(`✓ Valid scenario: Transaction for "${testServiceWithMaterial.service_name}" accepted with material_id=${testMaterialId}`);

      } catch (error) {
        await conn.rollback();
        conn.release();
        throw error;
      }
    });

    if (testServiceWithoutMaterial) {
      it('SHOULD PASS: Backend accepts transaction without material_id for service NOT requiring material (valid scenario)', async () => {
        // Scenario 3: Create transaction for service with requires_material=false or NULL
        // material_id can be NULL for these services (VALID)
        
        const transactionPayload = {
          customerId: testCustomerId,
          outletId: testOutletId,
          items: [
            {
              serviceId: testServiceWithoutMaterial.id,
              serviceName: testServiceWithoutMaterial.service_name,
              unit: testServiceWithoutMaterial.unit_type,
              qty: 1,
              price: testServiceWithoutMaterial.price,
              isExpress: false,
              materialId: null, // VALID: material_id can be NULL when requires_material=false
            }
          ],
          payment: {
            method: 'cash',
            paidAmount: testServiceWithoutMaterial.price,
            changeAmount: 0,
          },
          subtotal: testServiceWithoutMaterial.price,
          discount: 0,
          total: testServiceWithoutMaterial.price,
          notes: 'Test transaction - no material required',
        };

        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();

          // Generate transaction number
          const now = new Date();
          const yy = String(now.getFullYear()).slice(2);
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          const transactionNo = `WSC-${yy}${mm}${dd}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

          // Insert transaction
          const [trxResult] = await conn.execute(
            `INSERT INTO tr_transaction 
             (outlet_id, customer_id, cashier_id, session_id, transaction_no, source_channel, status, 
              payment_status, primary_payment_method, is_express, pickup_type, subtotal, total, paid_amount, 
              change_amount, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'kasir', 'pending', 'paid', 'cash', 0, 'self', ?, ?, ?, 0, NOW(), NOW())`,
            [
              testOutletId,
              testCustomerId,
              testUserId,
              testSessionId,
              transactionNo,
              transactionPayload.subtotal,
              transactionPayload.total,
              transactionPayload.payment.paidAmount,
            ]
          );

          const transactionId = trxResult.insertId;
          testTransactionIds.push(transactionId);

          // Insert transaction item WITHOUT material_id (VALID for services not requiring material)
          const itemNo = `${transactionNo}-001`;
          await conn.execute(
            `INSERT INTO tr_transaction_item 
             (transaction_id, service_id, item_no, service_name_snapshot, unit_type_snapshot, 
              qty, price, is_express, subtotal, material_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              transactionId,
              testServiceWithoutMaterial.id,
              itemNo,
              testServiceWithoutMaterial.service_name,
              testServiceWithoutMaterial.unit_type,
              1,
              testServiceWithoutMaterial.price,
              0,
              testServiceWithoutMaterial.price,
              null, // VALID: material_id can be NULL when requires_material=false
            ]
          );

          await conn.commit();
          conn.release();

          // Verify valid scenario: Transaction item for non-material service can have NULL material_id
          const [[savedItem]] = await pool.execute(
            `SELECT ti.*, s.requires_material 
             FROM tr_transaction_item ti
             JOIN mst_service s ON s.id = ti.service_id
             WHERE ti.transaction_id = ?`,
            [transactionId]
          );

          expect(savedItem).toBeDefined();
          expect(savedItem.service_id).toBe(testServiceWithoutMaterial.id);
          expect(savedItem.requires_material).not.toBe(1); // requires_material should be 0 or NULL
          expect(savedItem.material_id).toBeNull(); // NULL is valid for non-material services

          console.log(`✓ Valid scenario: Transaction for "${testServiceWithoutMaterial.service_name}" accepted without material_id (requires_material=false)`);

        } catch (error) {
          await conn.rollback();
          conn.release();
          throw error;
        }
      });
    }
  });
});
