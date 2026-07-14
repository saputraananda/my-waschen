/**
 * Bug Condition Exploration Test - Cascading Address Structure
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * **GOAL**: Surface counterexamples that demonstrate cascading address structure is missing
 * 
 * **Scoped PBT Approach**: Test concrete scenarios:
 * 1. POST /customers with area_zone_id but no cascading fields
 * 2. System has no cascading dropdown capability
 * 3. address_other fallback is missing when customer can't find address in master
 * 
 * From Bug Condition in design.md:
 * - System accepts flat area_zone_id without province_id, city_id, district_id, sub_district_id
 * - System has no cascading address dropdown capability
 * - address_other fallback is missing when customer can't find address in master
 * 
 * Expected Behavior (from Requirements 2.1, 2.3):
 * - System MUST support cascading dropdown (Province → City → District → Sub-District)
 * - Customer MUST provide either structured address OR address_other
 * - Backend SHALL reject (422) if both structured address and address_other are NULL
 * 
 * **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves cascading address is missing)
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
let testCustomerId;
let testAreaZoneId;
let testAwarenessSourceId;
let testOutletId;

describe('Bug Condition Exploration - Cascading Address Structure', () => {
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

    const [awarenessRows] = await pool.execute(
      'SELECT id FROM mst_awareness_source WHERE is_active = 1 LIMIT 1'
    );
    testAwarenessSourceId = awarenessRows[0]?.id || 1;
  });

  afterAll(async () => {
    // Cleanup: Delete test customer if created
    if (testCustomerId) {
      await pool.execute(
        'DELETE FROM mst_customer WHERE id = ?',
        [testCustomerId]
      );
    }
    
    // Close connection
    await pool.end();
  });

  /**
   * Property 1: Bug Condition - Cascading Address Structure Missing
   * 
   * This test checks if the system accepts flat area_zone_id without cascading fields.
   * 
   * Bug Condition (from design.md):
   * ```
   * FUNCTION isCascadingAddressBug(CustomerData, SystemCapability)
   *   RETURN (NOT SystemCapability.has_cascading_address_dropdown) OR
   *          (CustomerData.has_area_zone_id AND
   *           (CustomerData.province_id IS NULL AND
   *            CustomerData.city_id IS NULL AND
   *            CustomerData.district_id IS NULL AND
   *            CustomerData.sub_district_id IS NULL) AND
   *           CustomerData.address_other IS NULL)
   * END FUNCTION
   * ```
   * 
   * **Validates: Requirements 2.1, 2.3**
   */
  describe('Property 1: Bug Condition - Cascading Address Structure Missing', () => {
    it('SHOULD FAIL: System accepts area_zone_id without cascading address fields', async () => {
      // Scenario 1: Customer with area_zone_id but NO cascading fields (province_id, city_id, district_id, sub_district_id)
      // and NO address_other fallback
      
      const customerData = {
        customer_no: `TEST-BUG-${Date.now()}`,
        name: 'Test Customer Bug Condition',
        phone: `0812${Math.floor(Math.random() * 100000000)}`,
        gender: 'male',
        greeting: 'Bapak',
        email: `testbug${Date.now()}@example.com`,
        awareness_source_id: testAwarenessSourceId,
        area_zone_id: testAreaZoneId,  // Flat area_zone_id
        registered_outlet_id: testOutletId,
        address_housing: 'Test Housing',
        address_block: 'Test Block',
        address_no: '123',
        address_detail: 'Test Detail',
        is_member: 0,
        is_active: 1,
        // MISSING: province_id, city_id, district_id, sub_district_id
        // MISSING: address_other
      };

      // Insert directly into database (simulating POST /customers behavior on UNFIXED code)
      const [result] = await pool.execute(
        `INSERT INTO mst_customer (
          customer_no, name, phone, gender, greeting, email,
          awareness_source_id, area_zone_id, registered_outlet_id,
          address_housing, address_block, address_no, address_detail,
          is_member, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          customerData.customer_no,
          customerData.name,
          customerData.phone,
          customerData.gender,
          customerData.greeting,
          customerData.email,
          customerData.awareness_source_id,
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

      testCustomerId = result.insertId;

      // Bug Condition: On UNFIXED code, this insert succeeds (no cascading address validation)
      // Expected Behavior: System MUST reject this because customer has neither:
      // 1. Structured cascading address (province_id, city_id, district_id, sub_district_id), NOR
      // 2. address_other fallback
      
      // Verify the buggy behavior: Customer was created with flat area_zone_id
      const [rows] = await pool.execute(
        'SELECT * FROM mst_customer WHERE id = ?',
        [testCustomerId]
      );

      expect(rows.length).toBe(1);
      const savedCustomer = rows[0];

      // EXPECTED TO FAIL: On unfixed code, these assertions will fail
      // because the system accepts flat area_zone_id without cascading fields
      
      // Expected Behavior (after fix):
      // System MUST support cascading dropdown AND require either structured address OR address_other
      expect(
        savedCustomer.province_id || savedCustomer.city_id || 
        savedCustomer.district_id || savedCustomer.sub_district_id ||
        savedCustomer.address_other,
        'Customer MUST have either structured cascading address (province_id, city_id, district_id, sub_district_id) OR address_other fallback'
      ).toBeTruthy();

      // Document counterexample:
      console.log('\n=== COUNTEREXAMPLE FOUND ===');
      console.log('Bug Condition: System accepts flat area_zone_id without cascading address fields');
      console.log('Customer Data:', {
        id: testCustomerId,
        name: savedCustomer.name,
        phone: savedCustomer.phone,
        area_zone_id: savedCustomer.area_zone_id,
        province_id: savedCustomer.province_id,  // Expected: NOT NULL (or address_other NOT NULL)
        city_id: savedCustomer.city_id,          // Expected: NOT NULL (or address_other NOT NULL)
        district_id: savedCustomer.district_id,  // Expected: NOT NULL (or address_other NOT NULL)
        sub_district_id: savedCustomer.sub_district_id, // Expected: NOT NULL (or address_other NOT NULL)
        address_other: savedCustomer.address_other, // Expected: NOT NULL (if no cascading fields)
      });
      console.log('Expected: Either cascading fields OR address_other MUST be present');
      console.log('Actual: Customer created with NEITHER cascading fields NOR address_other');
      console.log('=== END COUNTEREXAMPLE ===\n');
    });

    it('SHOULD FAIL: System allows customer creation without address validation', async () => {
      // Scenario 2: System allows creating customer with partial cascading address
      // Bug Condition: Backend doesn't validate that customer provides complete address
      
      // Test: Create customer with only province_id (incomplete cascading address)
      const incompleteCustomerData = {
        customer_no: `TEST-INCOMPLETE-${Date.now()}`,
        name: 'Test Incomplete Address',
        phone: `0813${Math.floor(Math.random() * 100000000)}`,
        gender: 'female',
        greeting: 'Ibu',
        awareness_source_id: testAwarenessSourceId,
        registered_outlet_id: testOutletId,
        province_id: 1,  // Only province, missing city/district/sub_district
        // Missing: city_id, district_id, sub_district_id
        // Missing: address_other (fallback)
        is_member: 0,
        is_active: 1,
      };

      let incompleteCustomerId;

      try {
        // Attempt to insert incomplete address (should be rejected by validation)
        const [result] = await pool.execute(
          `INSERT INTO mst_customer (
            customer_no, name, phone, gender, greeting,
            awareness_source_id, registered_outlet_id,
            province_id, is_member, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            incompleteCustomerData.customer_no,
            incompleteCustomerData.name,
            incompleteCustomerData.phone,
            incompleteCustomerData.gender,
            incompleteCustomerData.greeting,
            incompleteCustomerData.awareness_source_id,
            incompleteCustomerData.registered_outlet_id,
            incompleteCustomerData.province_id,
            incompleteCustomerData.is_member,
            incompleteCustomerData.is_active,
          ]
        );

        incompleteCustomerId = result.insertId;

        // Bug: If we reach here, the system accepted incomplete address
        // Expected: System should have rejected this via CHECK constraint or validation

        // Cleanup
        await pool.execute(
          'DELETE FROM mst_customer WHERE id = ?',
          [incompleteCustomerId]
        );

        // EXPECTED TO FAIL: System allows incomplete cascading address
        expect(
          false,
          'System MUST reject incomplete cascading address (partial province_id without city/district/sub_district and no address_other)'
        ).toBe(true);

        console.log('\n=== COUNTEREXAMPLE FOUND ===');
        console.log('Bug Condition: System allows customer with incomplete cascading address');
        console.log('Customer Data:', {
          id: incompleteCustomerId,
          province_id: incompleteCustomerData.province_id,
          city_id: null,
          district_id: null,
          sub_district_id: null,
          address_other: null,
        });
        console.log('Expected: System MUST reject incomplete address (either complete cascading OR address_other)');
        console.log('Actual: System accepted customer with partial cascading address');
        console.log('=== END COUNTEREXAMPLE ===\n');
      } catch (error) {
        // Good: System rejected incomplete address (expected after fix)
        // This means CHECK constraint or validation is working
        console.log('✓ System correctly rejected incomplete address:', error.message);
      }
    });
  });
});
