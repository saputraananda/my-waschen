// ─────────────────────────────────────────────────────────────────────────────
// validationSchemas.js — Zod Validation Schemas
// Phase 8: Technical Debt & Optimization
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod';

// ─── Common Schemas ────────────────────────────────────────────────────────────

export const idSchema = z.number().int().positive();
export const stringSchema = z.string();
export const optionalString = z.string().optional();
export const optionalNumber = z.number().optional();

// ─── Customer Schemas ──────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  phone: z.string().regex(/^8\d{7,12}$/, 'Nomor HP tidak valid (08xxxxxxxxxx)'),
  email: z.string().email('Email tidak valid').optional().or(z.literal('')),
  gender: z.enum(['male', 'female']).optional(),
  greeting: z.string().optional(),
  instansi: z.string().optional(),
  birth_date: z.string().optional(), // YYYY-MM-DD
  religion: z.string().optional(),
  awareness_source_id: z.number().int().positive().optional(),
  awareness_other_text: z.string().optional(),
  area_zone_id: z.number().int().positive().optional(),
  address_housing: z.string().optional(),
  address_block: z.string().optional(),
  address_no: z.string().optional(),
  address_detail: z.string().optional(),
  notes: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// ─── Transaction Schemas ───────────────────────────────────────────────────────

export const transactionItemSchema = z.object({
  serviceId: z.number().int().positive('Service ID wajib diisi'),
  serviceName: z.string().optional(),
  qty: z.number().positive('Qty wajib > 0'),
  price: z.number().min(0),
  unit: z.string().optional(),
  isExpress: z.boolean().optional(),
  material: z.string().optional(),
  materialId: z.number().int().positive().optional(),
  length: z.number().optional(),
  width: z.number().optional(),
  notes: z.string().optional(),
});

export const checkoutTransactionSchema = z.object({
  customerId: z.number().int().positive('Customer ID wajib diisi'),
  items: z.array(transactionItemSchema).min(1, 'Minimal 1 item wajib dipilih'),
  outletId: z.number().int().positive('Outlet ID wajib diisi'),

  // Payment
  payment: z.object({
    method: z.enum(['cash', 'transfer', 'qris', 'deposit']).optional(),
    paidAmount: z.number().min(0).optional(),
    changeAmount: z.number().min(0).optional(),
  }).optional(),

  // Optional fields
  notes: z.string().optional(),
  promoCode: z.string().optional(),
  manualDiscount: z.number().min(0).optional(),
  dueDate: z.string().optional(),
  pickupType: z.enum(['self', 'pickup', 'delivery']).optional(),
  pickupScheduleAt: z.string().optional(),
  deliveryScheduleAt: z.string().optional(),
  pickupAddressId: z.number().int().positive().optional(),
  deliveryFee: z.number().min(0).optional(),
});

// ─── Service Schemas ───────────────────────────────────────────────────────────

export const createServiceSchema = z.object({
  name: z.string().min(1, 'Nama layanan wajib diisi').max(100),
  category_id: z.number().int().positive('Kategori wajib dipilih'),
  price: z.number().min(0, 'Harga tidak boleh negatif'),
  unit: z.enum(['pcs', 'kg', 'm2', 'liter', 'meter']).default('pcs'),
  estimated_hours: z.number().int().positive().optional(),
  sla_regular_hours: z.number().int().positive().optional(),
  sla_express_hours: z.number().int().positive().optional(),
  is_express_available: z.boolean().default(false),
  express_multiplier: z.number().min(1).optional(),
  requires_material: z.boolean().default(false),
  min_stock_qty: z.number().min(0).optional(),
  is_active: z.boolean().default(true),
  outlet_ids: z.array(z.number().int().positive()).optional(),
});

// ─── Promo Schemas ─────────────────────────────────────────────────────────────

export const createPromoSchema = z.object({
  code: z.string().min(1, 'Kode promo wajib diisi').max(50),
  name: z.string().min(1, 'Nama promo wajib diisi').max(100),
  type: z.enum(['percent', 'nominal']),
  value: z.number().min(0, 'Nilai tidak boleh negatif'),
  min_trx_amount: z.number().min(0).optional(),
  max_discount: z.number().min(0).optional(),
  promo_type: z.enum(['general', 'birthday', 'referral', 'loyalty', 'first_time']).optional(),
  auto_apply: z.boolean().optional(),
  is_global: z.boolean().optional(),
  outlet_ids: z.array(z.number().int().positive()).optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  is_active: z.boolean().default(true),
});

// ─── Shift Schemas ─────────────────────────────────────────────────────────────

// openShiftSchema: outletId dari user context (bukan body), modal dari openingCash
export const openShiftSchema = z.object({
  openingCash: z.number().min(0, 'Modal awal tidak boleh negatif').default(0),
  shift: z.enum(['pagi', 'siang', 'malam', 'full']).default('full'),
  shiftUserName: z.string().optional(), // nama kasir pengganti (untuk handover)
});

export const closeShiftSchema = z.object({
  closingCash: z.number().min(0, 'Kas akhir tidak boleh negatif'),
  notes: z.string().optional(),
  photos: z.array(z.object({
    label: z.string().optional(),
    data: z.string().optional(),
  })).optional(),
});

// ─── Sub-Session Schemas ─────────────────────────────────────────────────────────
export const openSubSessionSchema = z.object({
  sessionId: z.number().int().positive('Session ID wajib diisi'),
  beginningCash: z.number().min(0).default(0),
});

export const closeSubSessionSchema = z.object({
  subSessionId: z.number().int().positive('Sub-Session ID wajib diisi'),
  endingCash: z.number().min(0, 'Kas akhir tidak boleh negatif'),
  varianceNotes: z.string().optional(),
  handoverNotes: z.string().optional(),
});

export const handoverSchema = z.object({
  handoverCash: z.number().min(0, 'Jumlah handover tidak boleh negatif'),
  notes: z.string().optional(),
});

export const acceptHandoverSchema = z.object({
  sessionId: z.number().int().positive('Session ID wajib diisi'),
  acceptedCash: z.number().min(0).optional(),
});

// ─── Membership Schemas ─────────────────────────────────────────────────────────

export const createMembershipSchema = z.object({
  customerId: z.number().int().positive('Customer ID wajib diisi'),
  tier: z.enum(['gold', 'diamond']).default('gold'),
});

export const renewMembershipSchema = z.object({
  topUpAmount: z.number().min(0).optional(),
});

// ─── Inventory Schemas ─────────────────────────────────────────────────────────

export const createInventoryItemSchema = z.object({
  category_id: z.number().int().positive('Kategori wajib dipilih'),
  name: z.string().min(1, 'Nama item wajib diisi').max(100),
  unit: z.string().default('pcs'),
  item_code: z.string().optional(),
  min_stock_default: z.number().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const createPurchaseRequestSchema = z.object({
  outletId: z.number().int().positive('Outlet ID wajib diisi'),
  items: z.array(z.object({
    inventory_id: z.number().int().positive(),
    qty: z.number().positive(),
    unit_price: z.number().min(0),
    notes: z.string().optional(),
  })).min(1, 'Minimal 1 item wajib'),
  notes: z.string().optional(),
});

// ─── User Schemas ─────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter').max(50),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  role_code: z.enum(['admin', 'kasir', 'frontline', 'produksi', 'delivery', 'finance', 'owner', 'superadmin']),
  outlet_id: z.number().int().positive().optional(),
  is_active: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });

// ─── Outlet Schemas ─────────────────────────────────────────────────────────────

export const createOutletSchema = z.object({
  name: z.string().min(1, 'Nama outlet wajib diisi').max(100),
  code: z.string().min(1).max(20).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  is_active: z.boolean().default(true),
});

// ─── Helper: Validate with error response ───────────────────────────────────────

/**
 * Validate request body against a Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
export const validate = (schema) => (req, res, next) => {
  try {
    const result = schema.parse(req.body);
    req.body = result;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (!error.errors || !Array.isArray(error.errors)) {
        return res.status(422).json({
          success: false,
          message: 'Validasi gagal',
          errors: {},
        });
      }

      const errors = error.errors.reduce((acc, err) => {
        if (!err) return acc;
        const path = Array.isArray(err.path) ? err.path.join('.') : String(err.path || '');
        acc[path] = err.message || 'Invalid value';
        return acc;
      }, {});

      return res.status(422).json({
        success: false,
        message: 'Validasi gagal',
        errors,
      });
    }
    next(error);
  }
};

/**
 * Validate request query params
 * @param {z.ZodSchema} schema - Zod schema
 * @returns {Function} Express middleware
 */
export const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (!error.errors || !Array.isArray(error.errors)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: {},
        });
      }

      const errors = error.errors.reduce((acc, err) => {
        if (!err) return acc;
        const path = Array.isArray(err.path) ? err.path.join('.') : String(err.path || '');
        acc[path] = err.message || 'Invalid value';
        return acc;
      }, {});

      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors,
      });
    }
    next(error);
  }
};

// ─── Reusable validation middlewares ───────────────────────────────────────────

export const validateCustomerCreate = validate(createCustomerSchema);
export const validateCustomerUpdate = validate(updateCustomerSchema);
export const validateCheckout = validate(checkoutTransactionSchema);
export const validateServiceCreate = validate(createServiceSchema);
export const validatePromoCreate = validate(createPromoSchema);
export const validateShiftOpen = validate(openShiftSchema);
export const validateShiftClose = validate(closeShiftSchema);
export const validateSubSessionOpen = validate(openSubSessionSchema);
export const validateSubSessionClose = validate(closeSubSessionSchema);
export const validateHandover = validate(handoverSchema);
export const validateAcceptHandover = validate(acceptHandoverSchema);
export const validateMembershipCreate = validate(createMembershipSchema);
export const validateInventoryCreate = validate(createInventoryItemSchema);
export const validatePurchaseRequest = validate(createPurchaseRequestSchema);
export const validateUserCreate = validate(createUserSchema);
export const validateUserUpdate = validate(updateUserSchema);
export const validateOutletCreate = validate(createOutletSchema);
