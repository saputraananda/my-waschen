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

// Normalize phone: strip +, spaces, dashes. Convert 62xx → 0xx for consistent DB storage.
const normalizePhone = (v) => {
  if (v == null || typeof v !== 'string') return v; // pass through for Zod to handle
  const digits = v.replace(/[\s\-+()]/g, '');
  if (!digits) return v; // pass through - Zod string().regex() will catch empty
  // Convert 62 prefix to 0 (e.g. 62812... → 0812...)
  if (digits.startsWith('62') && digits.length >= 10) {
    return '0' + digits.slice(2);
  }
  return digits;
};

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  phone: z.preprocess(
    normalizePhone,
    z.string()
      .regex(/^0[8]\d{7,11}$/, 'Nomor HP tidak valid (contoh: 081234567890)')
  ),
  email: z.string().email('Email tidak valid').optional().nullable().or(z.literal('')),
  gender: z.enum(['male', 'female']).optional().nullable(),
  greeting: z.string().optional().nullable(),
  instansi: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(), // YYYY-MM-DD
  religion: z.string().optional().nullable(),
  awareness_source_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? null : (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v),
    z.number().int().positive().optional().nullable()
  ),
  awareness_other_text: z.string().optional().nullable(),
  area_zone_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? null : (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v),
    z.number().int().positive().optional().nullable()
  ),
  address_housing: z.string().optional().nullable(),
  address_block: z.string().optional().nullable(),
  address_no: z.string().optional().nullable(),
  address_detail: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// ─── Transaction Schemas ───────────────────────────────────────────────────────

export const transactionItemSchema = z.object({
  // Support string (numeric string "123") or UUID string or numeric serviceId
  serviceId: z.preprocess(
    (v) => typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v,
    z.union([z.string().uuid(), z.number().int().positive()])
  ),
  serviceName: z.string().optional().nullable(),
  qty: z.number().positive('Qty wajib > 0'),
  price: z.number().min(0),
  unit: z.string().optional().nullable(),
  isExpress: z.boolean().optional(),
  material: z.string().optional().nullable(),
  materialId: z.preprocess(
    (v) => typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v,
    z.union([z.string(), z.number().int().positive()])
  ).optional().nullable(),
  // Carpet dimensions in cm (from frontend)
  carpetPanjangCm: z.number().min(0).optional().nullable(),
  carpetLebarCm: z.number().min(0).optional().nullable(),
  // Legacy length/width (in meters or cm depending on context)
  length: z.number().optional().nullable(),
  width: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Extra fields passed through
  brand: z.string().optional().nullable(),
  specialCareAlert: z.string().optional().nullable(),
  subtotal: z.number().min(0).optional(),
});

export const checkoutTransactionSchema = z.object({
  // Support string (numeric string "123" or UUID) and numeric customerId
  customerId: z.preprocess(
    (v) => {
      if (typeof v === 'string') {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
      }
      return v;
    },
    z.union([z.string().uuid(), z.number().int().positive()])
  ),
  items: z.array(transactionItemSchema).min(1, 'Minimal 1 item wajib dipilih'),
  outletId: z.preprocess(
    (v) => {
      if (typeof v === 'string') {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
      }
      return v;
    },
    z.union([z.string().uuid(), z.number().int().positive()])
  ).optional(),

  // Payment
  payment: z.object({
    method: z.enum(['cash', 'transfer', 'qris', 'edc', 'deposit']).optional(),
    paidAmount: z.number().min(0).optional(),
    changeAmount: z.number().min(0).optional(),
    amount: z.number().min(0).optional(),
  }).optional(),

  // Payment intent (simplified flow from frontend)
  paymentIntent: z.object({
    paidAmount: z.number().min(0).optional(),
    verifiedByKasir: z.boolean().optional(),
    bankAccountId: z.union([z.string(), z.number()]).nullable().optional(),
    paymentPhotoBase64: z.string().optional().nullable(),
  }).optional(),

  // PIC (Penanggung Jawab)
  picId: z.union([z.string(), z.number()]).nullable().optional(),
  picName: z.string().optional().nullable(),

  // Promo
  promoId: z.union([z.string(), z.number()]).nullable().optional(),

  // Logistic / Pickup
  pickup: z.boolean().optional(),
  delivery: z.boolean().optional(),
  areaZoneId: z.union([z.string(), z.number()]).nullable().optional(),
  scheduleAt: z.string().optional().nullable(),
  courierName: z.string().optional().nullable(),
  deliveryNotes: z.string().optional().nullable(),

  // Financials
  subtotal: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  total: z.number().min(0).optional(),

  // Other
  notes: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  pickupType: z.union([
    z.enum(['self', 'pickup', 'delivery', 'both']),
    z.string(),       // accept any string value gracefully
  ]).optional().nullable(),
  promoCode: z.string().optional().nullable(),
  manualDiscount: z.number().min(0).optional(),
  pickupScheduleAt: z.string().optional().nullable(),
  deliveryScheduleAt: z.string().optional().nullable(),
  pickupAddressId: z.union([z.string(), z.number().int().positive()]).nullable().optional(),
  deliveryFee: z.number().min(0).optional(),
});

// ─── Service Schemas ───────────────────────────────────────────────────────────
// NOTE: Field names MUST match what the frontend sends and controller destructures.
// Controller expects camelCase: category, price, unit, active, expressExtra,
// expressEligible, minQty, slaRegular, slaExpress, durasiHari, outletId
export const createServiceSchema = z.object({
  name: z.string().min(1, 'Nama layanan wajib diisi').max(100),
  // category: string category name (e.g. "Cuci", "Dry Clean") — controller calls getOrCreateCategory()
  category: z.string().min(1, 'Kategori wajib diisi').optional(),
  // category_id: numeric ID — either this OR category name must be provided
  category_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v),
    z.number().int().positive().optional()
  ),
  price: z.number().min(0, 'Harga tidak boleh negatif'),
  // unit: freeform string (controller accepts any string)
  unit: z.string().min(1, 'Satuan wajib diisi').optional(),
  estimated_hours: z.number().int().nonnegative().optional().nullable(),
  durasiHari: z.number().int().nonnegative().optional().nullable(), // alias
  sla_regular_hours: z.number().int().nonnegative().optional().nullable(),
  slaExpress: z.number().int().nonnegative().optional().nullable(), // camelCase alias
  sla_regular: z.number().int().nonnegative().optional().nullable(), // camelCase alias
  sla_express_hours: z.number().int().nonnegative().optional().nullable(),
  is_express_available: z.boolean().optional(),
  expressEligible: z.boolean().optional(), // camelCase alias
  express_multiplier: z.number().min(0).optional().nullable(),
  expressExtra: z.number().min(0).optional().nullable(), // nominal express surcharge
  requires_material: z.boolean().optional(),
  min_stock_qty: z.number().min(0).optional().nullable(),
  minQty: z.number().min(0).optional().nullable(), // camelCase alias
  is_active: z.boolean().optional(),
  active: z.boolean().optional(), // camelCase alias
  outletId: z.number().int().positive().optional(), // camelCase
  outlet_ids: z.array(z.number().int().positive()).optional(), // snake_case (legacy)
});

// ─── Promo Schemas ─────────────────────────────────────────────────────────────
// NOTE: Field names MUST match what the frontend sends and controller destructures.
// Controller expects camelCase: minTrxAmount, maxDiscount, validFrom, validUntil,
// isGlobal, outletIds, promoType, applicableType, applicableServices, applicableCategories
export const createPromoSchema = z.object({
  code: z.string().min(1, 'Kode promo wajib diisi').max(50),
  name: z.string().min(1, 'Nama promo wajib diisi').max(100),
  type: z.enum(['percent', 'nominal']),
  value: z.number().min(0, 'Nilai tidak boleh negatif'),
  // Support both camelCase and snake_case from frontend
  minTrxAmount: z.number().min(0).optional(),
  min_trx_amount: z.number().min(0).optional(), // snake_case fallback
  maxDiscount: z.number().min(0).optional(),
  max_discount: z.number().min(0).optional(), // snake_case fallback
  promoType: z.enum(['general', 'birthday', 'campaign', 'loyalty']).optional(),
  promo_type: z.enum(['general', 'birthday', 'campaign', 'loyalty']).optional(), // snake_case fallback
  // Service/category applicability
  applicableType: z.enum(['all', 'category', 'service']).optional(),
  applicable_type: z.enum(['all', 'category', 'service']).optional(), // snake_case fallback
  applicableServices: z.array(z.number().int().positive()).optional(),
  applicable_services: z.array(z.number().int().positive()).optional(), // snake_case fallback
  applicableCategories: z.array(z.string()).optional(),
  applicable_categories: z.array(z.string()).optional(), // snake_case fallback
  autoApply: z.boolean().optional(),
  auto_apply: z.boolean().optional(), // snake_case fallback
  isGlobal: z.boolean().optional(),
  is_global: z.boolean().optional(), // snake_case fallback
  outletIds: z.array(z.number().int().positive()).optional(),
  outlet_ids: z.array(z.number().int().positive()).optional(), // snake_case fallback
  validFrom: z.string().optional(),
  valid_from: z.string().optional(), // snake_case fallback
  validUntil: z.string().optional(),
  valid_until: z.string().optional(), // snake_case fallback
  is_active: z.boolean().optional(),
  active: z.boolean().optional(), // camelCase fallback
  isActive: z.boolean().optional(),
  is_active: z.boolean().optional(),
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
  // Support both camelCase (controller expects) and snake_case (legacy)
  categoryId: z.number().int().positive('Kategori wajib dipilih'),
  category_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v),
    z.number().int().positive().optional()
  ),
  name: z.string().min(1, 'Nama item wajib diisi').max(100),
  unit: z.string().min(1, 'Satuan wajib').optional(),
  itemCode: z.string().optional(),
  item_code: z.string().optional(), // snake_case fallback
  minStockDefault: z.number().min(0).optional(),
  min_stock_default: z.number().min(0).optional(), // snake_case fallback
  is_active: z.boolean().optional(),
  active: z.boolean().optional(), // camelCase fallback
});

export const createPurchaseRequestSchema = z.object({
  outletId: z.number().int().positive('Outlet ID wajib diisi'),
  items: z.array(z.object({
    inventoryId: z.number().int().positive(),
    inventory_id: z.number().int().positive().optional(),
    qty: z.number().positive(),
    unit_price: z.number().min(0).optional(),
    unitPrice: z.number().min(0).optional(),
    notes: z.string().optional(),
  })).min(1, 'Minimal 1 item wajib'),
  notes: z.string().optional(),
});

// ─── User Schemas ─────────────────────────────────────────────────────────────
// NOTE: Field names MUST match what the frontend sends and controller destructures.
// Controller expects: username, password, name, role, outletId, email, outlet, gender
export const createUserSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter').max(50).optional(),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  email: z.string().email('Email tidak valid').optional().nullable().or(z.literal('')),
  // Support both role (camelCase from frontend) and role_code (snake_case)
  role: z.enum(['admin', 'frontline', 'produksi']).optional(),
  role_code: z.enum(['admin', 'frontline', 'produksi']).optional(),
  outletId: z.number().int().positive().optional(),
  outlet_id: z.number().int().positive().optional(), // snake_case fallback
  outlet: z.string().optional(), // outlet name (for lookup)
  gender: z.enum(['male', 'female']).optional().nullable(),
  is_active: z.boolean().optional(),
  active: z.boolean().optional(), // camelCase fallback
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email('Email tidak valid').optional().nullable().or(z.literal('')),
  role: z.enum(['admin', 'frontline', 'produksi']).optional(),
  role_code: z.enum(['admin', 'frontline', 'produksi']).optional(),
  outletId: z.number().int().positive().optional(),
  outlet_id: z.number().int().positive().optional(),
  outlet: z.string().optional(),
  gender: z.enum(['male', 'female']).optional().nullable(),
  is_active: z.boolean().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6, 'Password minimal 6 karakter').optional(),
});

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
    // Zod v4 uses .issues, Zod v3 uses .errors
    const issues = error.issues || error.errors;
    if (error instanceof z.ZodError && Array.isArray(issues)) {
      // Log validation errors for debugging — wrapped in try/catch so logging never breaks error handling
      try {
        console.error('[VALIDATION] Zod validation failed:', {
          path: req.path,
          errors: issues.map(e => ({
            path: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
            message: e.message,
            code: e.code,
          })),
          bodyKeys: Object.keys(req.body || {}),
          bodyCustomerId: req.body?.customerId,
          bodyCustomerIdType: typeof req.body?.customerId,
          bodyItemsCount: Array.isArray(req.body?.items) ? req.body.items.length : null,
          bodyItemsServiceIds: Array.isArray(req.body?.items)
            ? req.body.items.map(i => ({ id: i?.serviceId, type: typeof i?.serviceId }))
            : null,
        });
      } catch (logErr) {
        // Logging failure must never prevent error response from being sent
        console.error('[VALIDATION] Logging failed:', logErr.message);
      }

      const errors = issues.reduce((acc, err) => {
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
    // Zod v4 uses .issues, Zod v3 uses .errors
    const issues = error.issues || error.errors;
    if (error instanceof z.ZodError && Array.isArray(issues)) {
      const errors = issues.reduce((acc, err) => {
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
