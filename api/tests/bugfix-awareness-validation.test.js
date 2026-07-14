/**
 * Bug Condition Exploration Test - Awareness Source Validation
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * 
 * **GOAL**: Surface counterexamples where awareness_other_text is empty when is_other=true
 * 
 * **Scoped PBT Approach**: Test concrete scenario:
 * - POST /customers with awareness_source that has is_other=true but awareness_other_text=null or empty
 * 
 * From Bug Condition in design.md:
 * ```
 * FUNCTION isAwarenessValidationBug(CustomerData, AwarenessSource)
 *   RETURN AwarenessSource.is_other = true AND
 *          (CustomerData.awareness_other_text IS NULL OR
 *           CustomerData.awareness_other_text = "")
 * END FUNCTION
 * ```
 * 
 * Expected Behavior (from Requirements 2.2):
 * - Backend SHALL reject (422) when awareness_other_text is missing for is_other=true
 * 
 * **Validates: Requirements 2.2**
 * 
 * **EXPECTED OUTCOME**: Test FAILS (backend currently accepts invalid requests)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
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

let pool;
let testCustomerIds = [];
let testAwarenessSourceOtherId;
let testAwarenessSourceNormalId;
let testAreaZoneId;
let testOutletId;

describe('Bug Condition Exploration - Awareness Source Validation', () => {
  beforeAll(async () => {
    // Setup database connection
    pool = mysql.createPool(TEST_DB_CONFIG);
    
    // Get test data IDs
    const [outletRows] = await pool.execute(
      'SELECT id FROM mst_outlet WHERE is_active = 1 LIMIT 1'
    );
    testOutletId = outletRows[0]?.id || 1;

    const [areaRows] = await pool.execute(
      'SELECT id FROM mst_area_zone WHERE is_active = 1 LIMIT 1'
    );
    testAreaZoneId = areaRows[0]?.id || 1;

    // Find awareness source with is_other=true (e.g., "Lainnya")
    const [awarenessOtherRows] = await pool.execute(
      'SELECT id, name FROM mst_awareness_source WHERE is_other = 1 AND is_active = 1 LIMIT 1'
    );
    
    if (awarenessOtherRows.length === 0) {
      // Create "Lainnya" awareness source if it doesn't exist
      const [insertResult] = await pool.execute(
        `INSERT INTO mst_awareness_source (code, name, is_other, is_active, sort_order, created_at, updated_at)
         VALUES ('OTHER', 'Lainnya', 1, 1, 99, NOW(), NOW())`
      );
      testAwarenessSourceOtherId = insertResult.insertId;
      console.log(`Created test awareness source "Lainnya" with id=${testAwarenessSourceOtherId}`);
    } else {
      testAwarenessSourceOtherId = awarenessOtherRows[0].id;
      console.log(`Found awareness source "${awarenessOtherRows[0].name}" with is_other=1, id=${testAwarenessSourceOtherId}`);
    }

    // Find normal awareness source (is_other=false)
    const [awarenessNormalRows] = await pool.execute(
      'SELECT id FROM mst_awareness_source WHERE (is_other = 0 OR is_other IS NULL) AND is_active = 1 LIMIT 1'
    );
    testAwarenessSourceNormalId = awarenessNormalRows[0]?.id || null;
  });

  afterAll(async () => {
    // Cleanup: Delete test customers
    if (testCustomerIds.length > 0) {
      await pool.execute(
        `DELETE FROM mst_customer WHERE id IN (${testCustomerIds.join(',')})` 
      );
    }
    
    // Close connection
    await pool.end();
  });

  /**
   * Property 1: Bug Condition - Awareness "Lainnya" Not Validated
   * 
   * This test checks if backend accepts empty awareness_other_text when is_other=true.
   * 
   * Bug Condition (from design.md):
   * Backend does not reject request when awareness_source has is_other=true but awareness_other_text is empty.
   * 
   * **Validates: Requirements 2.2**
   */
  describe('Property 1: Bug Condition - Awareness "Lainnya" Not Validated', () => {
    it('SHOULD FAIL: Backend accepts awareness_source with is_other=true but awareness_other_text is NULL', async () => {
      // Scenario 1: Customer selects "Lainnya" awareness source but doesn't provide text
      
      const customerData = {
        customer_no: `TEST-AWARE-NULL-${Date.now()}`,
        name: 'Test Awareness Null',
        phone: `0821${Math.floor(Math.random() * 100000000)}`,
        gender: 'male',
        greeting: 'Bapak',
        email: `testawareness${Date.now()}@example.com`,
        awareness_source_id: testAwarenessSourceOtherId, // is_other=true
        awareness_other_text: null, // BUG: NULL when is_other=true
        area_zone_id: testAreaZoneId,
        registered_outlet_id: testOutletId,
        address_housing: 'Test Housing',
        address_block: 'Block A',
        address_no: '100',
        address_detail: 'Test address detail',
        is_member: 0,
        is_active: 1,
      };

      // Insert directly into database (simulating POST /customers behavior on UNFIXED code)
      const [result] = await pool.execute(
        `INSERT INTO mst_customer (
          customer_no, name, phone, gender, greeting, email,
          awareness_source_id, awareness_other_text, area_zone_id, registered_outlet_id,
          address_housing, address_block, address_no, address_detail,
          is_member, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          customerData.customer_no,
          customerData.name,
          customerData.phone,
          customerData.gender,
          customerData.greeting,
          customerData.email,
          customerData.awareness_source_id,
          customerData.awareness_other_text,
          customerData.area_zone_id,
          customerData.registered_outlet_id,
          customerData.address_housing,
          customerData.address_block,
          customerData.address_no,
          customerData.address_detail,
          customerData.is_member,
          customerData.is_active,
        ]
      );

      const customerId = result.insertId;
      testCustomerIds.push(customerId);

      // Bug Condition: On UNFIXED code, this insert succeeds (no awareness_other_text validation)
      // Expected Behavior: Backend SHALL reject (422) when awareness_other_text is NULL/empty for is_other=true
      
      // Verify the buggy behavior: Customer was created with is_other=true but awareness_other_text=NULL
      const [[savedCustomer]] = await pool.execute(
        `SELECT c.*, aw.is_other 
         FROM mst_customer c
         JOIN mst_awareness_source aw ON aw.id = c.awareness_source_id
         WHERE c.id = ?`,
        [customerId]
      );

      expect(savedCustomer).toBeDefined();
      expect(savedCustomer.awareness_source_id).toBe(testAwarenessSourceOtherId);
      expect(savedCustomer.is_other).toBe(1);

      // EXPECTED TO FAIL: On unfixed code, awareness_other_text is NULL
      // Expected Behavior (after fix): awareness_other_text MUST NOT be NULL when is_other=true
      expect(
        savedCustomer.awareness_other_text,
        'awareness_other_text MUST NOT be NULL when awareness_source has is_other=true'
      ).not.toBeNull();

      expect(
        savedCustomer.awareness_other_text && savedCustomer.awareness_other_text.trim() !== '',
        'awareness_other_text MUST NOT be empty string when awareness_source has is_other=true'
      ).toBe(true);

      // Document counterexample:
      console.log('\n=== COUNTEREXAMPLE FOUND ===');
      console.log('Bug Condition: Backend accepts awareness_source with is_other=true but awareness_other_text is NULL');
      console.log('Customer Data:', {
        id: customerId,
        name: savedCustomer.name,
        phone: savedCustomer.phone,
        awareness_source_id: savedCustomer.awareness_source_id,
        awareness_source_is_other: savedCustomer.is_other, // is_other=1 (true)
        awareness_other_text: savedCustomer.awareness_other_text, // Expected: NOT NULL, Actual: NULL
      });
      console.log('Expected: Backend SHALL reject (422) when awareness_other_text is NULL for is_other=true');
      console.log('Actual: Backend accepted customer with awareness_other_text=NULL');
      console.log('=== END COUNTEREXAMPLE ===\n');
    });

    it('SHOULD FAIL: Backend accepts awareness_source with is_other=true but awareness_other_text is empty string', async () => {
      // Scenario 2: Customer selects "Lainnya" but provides empty string
      
      const customerData = {
        customer_no: `TEST-AWARE-EMPTY-${Date.now()}`,
        name: 'Test Awareness Empty',
        phone: `0822${Math.floor(Math.random() * 100000000)}`,
        gender: 'female',
        greeting: 'Ibu',
        email: `testawareness2-${Date.now()}@example.com`,
        awareness_source_id: testAwarenessSourceOtherId, // is_other=true
        awareness_other_text: '', // BUG: Empty string when is_other=true
        area_zone_id: testAreaZoneId,
        registered_outlet_id: testOutletId,
        address_housing: 'Test Complex',
        address_block: 'Block B',
        address_no: '200',
        address_detail: 'Test address detail 2',
        is_member: 0,
        is_active: 1,
      };

      // Insert directly into database
      const [result] = await pool.execute(
        `INSERT INTO mst_customer (
          customer_no, name, phone, gender, greeting, email,
          awareness_source_id, awareness_other_text, area_zone_id, registered_outlet_id,
          address_housing, address_block, address_no, address_detail,
          is_member, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          customerData.customer_no,
          customerData.name,
          customerData.phone,
          customerData.gender,
          customerData.greeting,
          customerData.email,
          customerData.awareness_source_id,
          customerData.awareness_other_text,
          customerData.area_zone_id,
          customerData.registered_outlet_id,
          customerData.address_housing,
          customerData.address_block,
          customerData.address_no,
          customerData.address_detail,
          customerData.is_member,
          customerData.is_active,
        ]
      );

      const customerId = result.insertId;
      testCustomerIds.push(customerId);

      // Verify the buggy behavior
      const [[savedCustomer]] = await pool.execute(
        `SELECT c.*, aw.is_other 
         FROM mst_customer c
         JOIN mst_awareness_source aw ON aw.id = c.awareness_source_id
         WHERE c.id = ?`,
        [customerId]
      );

      expect(savedCustomer).toBeDefined();
      expect(savedCustomer.awareness_source_id).toBe(testAwarenessSourceOtherId);
      expect(savedCustomer.is_other).toBe(1);

      // EXPECTED TO FAIL: On unfixed code, awareness_other_text is empty string
      expect(
        savedCustomer.awareness_other_text && savedCustomer.awareness_other_text.trim() !== '',
        'awareness_other_text MUST NOT be empty when awareness_source has is_other=true'
      ).toBe(true);

      // Document counterexample:
      console.log('\n=== COUNTEREXAMPLE FOUND ===');
      console.log('Bug Condition: Backend accepts awareness_source with is_other=true but awareness_other_text is empty string');
      console.log('Customer Data:', {
        id: customerId,
        name: savedCustomer.name,
        phone: savedCustomer.phone,
        awareness_source_id: savedCustomer.awareness_source_id,
        awareness_source_is_other: savedCustomer.is_other, // is_other=1 (true)
        awareness_other_text: `"${savedCustomer.awareness_other_text}"`, // Expected: NOT empty, Actual: ""
      });
      console.log('Expected: Backend SHALL reject (422) when awareness_other_text is empty for is_other=true');
      console.log('Actual: Backend accepted customer with awareness_other_text=""');
      console.log('=== END COUNTEREXAMPLE ===\n');
    });

    it('SHOULD PASS: Backend accepts awareness_source with is_other=false and awareness_other_text=NULL (valid scenario)', async () => {
      // Scenario 3: Normal awareness source (is_other=false) - awareness_other_text can be NULL
      // This is VALID behavior and should NOT be blocked by validation
      
      if (!testAwarenessSourceNormalId) {
        console.log('Skipping: No normal awareness source (is_other=false) found');
        return;
      }

      const customerData = {
        customer_no: `TEST-AWARE-NORMAL-${Date.now()}`,
        name: 'Test Awareness Normal',
        phone: `0823${Math.floor(Math.random() * 100000000)}`,
        gender: 'male',
        greeting: 'Bapak',
        email: `testawareness3-${Date.now()}@example.com`,
        awareness_source_id: testAwarenessSourceNormalId, // is_other=false
        awareness_other_text: null, // VALID: NULL is OK when is_other=false
        area_zone_id: testAreaZoneId,
        registered_outlet_id: testOutletId,
        address_housing: 'Normal Housing',
        address_block: 'Block C',
        address_no: '300',
        address_detail: 'Normal address detail',
        is_member: 0,
        is_active: 1,
      };

      // This should succeed (valid scenario)
      const [result] = await pool.execute(
        `INSERT INTO mst_customer (
          customer_no, name, phone, gender, greeting, email,
          awareness_source_id, awareness_other_text, area_zone_id, registered_outlet_id,
          address_housing, address_block, address_no, address_detail,
          is_member, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          customerData.customer_no,
          customerData.name,
          customerData.phone,
          customerData.gender,
          customerData.greeting,
          customerData.email,
          customerData.awareness_source_id,
          customerData.awareness_other_text,
          customerData.area_zone_id,
          customerData.registered_outlet_id,
          customerData.address_housing,
          customerData.address_block,
          customerData.address_no,
          customerData.address_detail,
          customerData.is_member,
          customerData.is_active,
        ]
      );

      const customerId = result.insertId;
      testCustomerIds.push(customerId);

      // Verify valid scenario: awareness_other_text can be NULL when is_other=false
      const [[savedCustomer]] = await pool.execute(
        `SELECT c.*, aw.is_other 
         FROM mst_customer c
         JOIN mst_awareness_source aw ON aw.id = c.awareness_source_id
         WHERE c.id = ?`,
        [customerId]
      );

      expect(savedCustomer).toBeDefined();
      expect(savedCustomer.is_other).not.toBe(1); // is_other should be 0 or NULL
      expect(savedCustomer.awareness_other_text).toBeNull(); // NULL is valid for non-"Lainnya" sources

      console.log('✓ Valid scenario: Customer with normal awareness source (is_other=false) accepted with awareness_other_text=NULL');
    });
  });
});
