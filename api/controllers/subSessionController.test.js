// ─────────────────────────────────────────────────────────────────────────────
// subSessionController.test.js — Unit Tests for Sub-Session Management
// Phase 3: Shift Management Enhancement - Task 16.1
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { poolWaschenPos as db } from '../db/connection.js';
import {
  openSubSession,
  closeSubSession,
  getCurrentSubSession,
  getAllSubSessions,
  getSubSessionById,
} from './subSessionController.js';

// Create test express app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock authentication middleware
  app.use((req, res, next) => {
    req.user = {
      userId: 1,
      id: 1,
      roleCode: 'kasir',
      outletId: 1,
    };
    next();
  });
  
  // Register routes
  app.post('/api/shift/sub-session/open', openSubSession);
  app.post('/api/shift/sub-session/close', closeSubSession);
  app.get('/api/shift/sub-session/current', getCurrentSubSession);
  app.get('/api/shift/sub-session/:sessionId/all', getAllSubSessions);
  app.get('/api/shift/sub-session/:id', getSubSessionById);
  
  return app;
};

let app;
let testSessionId;
let testSubSessionId;
let testCashierId;
let testOutletId;

describe('Sub-Session Controller - Task 16.1', () => {
  beforeAll(async () => {
    app = createTestApp();
    
    // Setup: Create a test main session
    const conn = await db.getConnection();
    try {
      // Get or create test outlet
      const [outlets] = await conn.execute(
        'SELECT id FROM mst_outlet WHERE deleted_at IS NULL LIMIT 1'
      );
      testOutletId = outlets[0]?.id || 1;
      
      // Get or create test user
      const [users] = await conn.execute(
        'SELECT id FROM mst_user WHERE deleted_at IS NULL LIMIT 1'
      );
      testCashierId = users[0]?.id || 1;
      
      // Create test main session
      const [result] = await conn.execute(`
        INSERT INTO tr_cashier_session (
          outlet_id, shift, session_date, opened_at, status, created_at, updated_at
        ) VALUES (?, 'fulltime', CURDATE(), NOW(), 'open', NOW(), NOW())
      `, [testOutletId]);
      
      testSessionId = result.insertId;
    } finally {
      conn.release();
    }
  });
  
  afterAll(async () => {
    // Cleanup: Remove test data
    const conn = await db.getConnection();
    try {
      await conn.execute('DELETE FROM tr_cashier_sub_session WHERE session_id = ?', [testSessionId]);
      await conn.execute('DELETE FROM tr_cashier_session WHERE id = ?', [testSessionId]);
    } finally {
      conn.release();
    }
  });
  
  describe('POST /api/shift/sub-session/open', () => {
    it('should create a new sub-session when valid data is provided', async () => {
      const response = await request(app)
        .post('/api/shift/sub-session/open')
        .send({
          sessionId: testSessionId,
          beginningCash: 500000,
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('berhasil dibuka');
      expect(response.body.data).toHaveProperty('subSessionId');
      expect(response.body.data.sessionId).toBe(testSessionId);
      expect(response.body.data.status).toBe('open');
      expect(response.body.data.beginningCash).toBe(500000);
      
      // Store for subsequent tests
      testSubSessionId = response.body.data.subSessionId;
    });
    
    it('should return 400 when sessionId is missing', async () => {
      const response = await request(app)
        .post('/api/shift/sub-session/open')
        .send({
          beginningCash: 500000,
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Session ID wajib diisi');
    });
    
    it('should return 400 when cashier already has an open sub-session', async () => {
      const response = await request(app)
        .post('/api/shift/sub-session/open')
        .send({
          sessionId: testSessionId,
          beginningCash: 500000,
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('sudah memiliki sub-session aktif');
      expect(response.body.data.alreadyOpen).toBe(true);
    });
    
    it('should return 404 when main session does not exist', async () => {
      const response = await request(app)
        .post('/api/shift/sub-session/open')
        .send({
          sessionId: 999999,
          beginningCash: 500000,
        });
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('tidak ditemukan');
    });
  });
  
  describe('GET /api/shift/sub-session/current', () => {
    it('should return current active sub-session for logged-in cashier', async () => {
      const response = await request(app)
        .get('/api/shift/sub-session/current');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasActiveSubSession).toBe(true);
      expect(response.body.data.subSessionId).toBe(testSubSessionId);
      expect(response.body.data.status).toBe('open');
    });
  });
  
  describe('GET /api/shift/sub-session/:sessionId/all', () => {
    it('should return all sub-sessions for a main shift', async () => {
      const response = await request(app)
        .get(`/api/shift/sub-session/${testSessionId}/all`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('cashierName');
      expect(response.body.data[0]).toHaveProperty('status');
    });
  });
  
  describe('GET /api/shift/sub-session/:id', () => {
    it('should return sub-session details by ID', async () => {
      const response = await request(app)
        .get(`/api/shift/sub-session/${testSubSessionId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testSubSessionId);
      expect(response.body.data).toHaveProperty('cashierName');
      expect(response.body.data).toHaveProperty('outletName');
      expect(response.body.data).toHaveProperty('transactions');
      expect(response.body.data).toHaveProperty('summary');
    });
    
    it('should return 404 when sub-session does not exist', async () => {
      const response = await request(app)
        .get('/api/shift/sub-session/999999');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('tidak ditemukan');
    });
  });
  
  describe('POST /api/shift/sub-session/close', () => {
    it('should close a sub-session and calculate variance', async () => {
      const response = await request(app)
        .post('/api/shift/sub-session/close')
        .send({
          subSessionId: testSubSessionId,
          endingCash: 500000,
          varianceNotes: 'Test closing',
          handoverNotes: 'Shift ended',
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('berhasil ditutup');
      expect(response.body.data.status).toBe('closed');
      expect(response.body.data.subSessionId).toBe(testSubSessionId);
      expect(response.body.data).toHaveProperty('variance');
      expect(response.body.data).toHaveProperty('expectedCash');
      expect(response.body.data).toHaveProperty('endingCash');
    });
    
    it('should return 400 when subSessionId is missing', async () => {
      const response = await request(app)
        .post('/api/shift/sub-session/close')
        .send({
          endingCash: 500000,
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Sub-session ID wajib diisi');
    });
    
    it('should return 400 when sub-session is already closed', async () => {
      const response = await request(app)
        .post('/api/shift/sub-session/close')
        .send({
          subSessionId: testSubSessionId,
          endingCash: 500000,
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('sudah ditutup');
    });
  });
});

describe('Sub-Session Business Logic Validation', () => {
  let mainSessionId;
  let subSessionId;
  
  beforeEach(async () => {
    // Create fresh test session for each test
    const conn = await db.getConnection();
    try {
      const [result] = await conn.execute(`
        INSERT INTO tr_cashier_session (
          outlet_id, shift, session_date, opened_at, status, created_at, updated_at
        ) VALUES (?, 'pagi', CURDATE(), NOW(), 'open', NOW(), NOW())
      `, [testOutletId]);
      mainSessionId = result.insertId;
    } finally {
      conn.release();
    }
  });
  
  afterEach(async () => {
    // Cleanup
    const conn = await db.getConnection();
    try {
      await conn.execute('DELETE FROM tr_cashier_sub_session WHERE session_id = ?', [mainSessionId]);
      await conn.execute('DELETE FROM tr_cashier_session WHERE id = ?', [mainSessionId]);
    } finally {
      conn.release();
    }
  });
  
  it('should validate that sub-session links to main session correctly', async () => {
    const conn = await db.getConnection();
    try {
      // Create sub-session
      const [result] = await conn.execute(`
        INSERT INTO tr_cashier_sub_session (
          session_id, cashier_id, outlet_id, shift, session_date,
          opened_at, status, beginning_cash, created_at, updated_at
        ) VALUES (?, ?, ?, 'pagi', CURDATE(), NOW(), 'open', 100000, NOW(), NOW())
      `, [mainSessionId, testCashierId, testOutletId]);
      
      subSessionId = result.insertId;
      
      // Verify link
      const [rows] = await conn.execute(`
        SELECT ss.*, s.status as main_session_status
        FROM tr_cashier_sub_session ss
        JOIN tr_cashier_session s ON ss.session_id = s.id
        WHERE ss.id = ?
      `, [subSessionId]);
      
      expect(rows.length).toBe(1);
      expect(rows[0].session_id).toBe(mainSessionId);
      expect(rows[0].main_session_status).toBe('open');
      expect(rows[0].shift).toBe('pagi');
    } finally {
      conn.release();
    }
  });
  
  it('should calculate expected_cash correctly from transactions', async () => {
    const conn = await db.getConnection();
    try {
      // Create sub-session
      const [ssResult] = await conn.execute(`
        INSERT INTO tr_cashier_sub_session (
          session_id, cashier_id, outlet_id, shift, session_date,
          opened_at, status, beginning_cash, created_at, updated_at
        ) VALUES (?, ?, ?, 'pagi', CURDATE(), NOW(), 'open', 500000, NOW(), NOW())
      `, [mainSessionId, testCashierId, testOutletId]);
      
      subSessionId = ssResult.insertId;
      
      // Create mock transaction
      await conn.execute(`
        INSERT INTO tr_transaction (
          transaction_no, outlet_id, sub_session_id, customer_id,
          total, paid_amount, change_amount, payment_status,
          status, created_at, updated_at
        ) VALUES (
          'TEST-001', ?, ?, 1,
          100000, 150000, 50000, 'paid',
          'received', NOW(), NOW()
        )
      `, [testOutletId, subSessionId]);
      
      // Calculate expected cash
      const [[summary]] = await conn.execute(`
        SELECT
          COALESCE(SUM(paid_amount), 0) as total_paid,
          COALESCE(SUM(change_amount), 0) as total_change
        FROM tr_transaction
        WHERE sub_session_id = ? AND deleted_at IS NULL
      `, [subSessionId]);
      
      const beginningCash = 500000;
      const expectedCash = beginningCash + Number(summary.total_paid) - Number(summary.total_change);
      
      // Should be: 500000 + 150000 - 50000 = 600000
      expect(expectedCash).toBe(600000);
    } finally {
      // Cleanup transactions
      await conn.execute('DELETE FROM tr_transaction WHERE sub_session_id = ?', [subSessionId]);
      conn.release();
    }
  });
});
