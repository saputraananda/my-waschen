// ─────────────────────────────────────────────────────────────────────────────
// schemas.js — Zod Validation Schemas
// Phase 8: Technical Debt & Optimization
// Centralized validation schemas for API requests
// ─────────────────────────────────────────────────────────────────────────────

const { z } = require('zod');

// ─── Common Schemas ────────────────────────────────────────────────────────────

const ObjectIdSchema = z.string().regex(/^\d+$/, 'Invalid ID format').transform(Number);
const PaginationSchema = z.object({
  page: z.string().optional().transform(v => parseInt(v) || 1),
  limit: z.string().optional().transform(v => parseInt(v) || 20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const DateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, { message: 'Start date must be before end date' });

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

const LoginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(1, 'Password is required'),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// ─── Customer Schemas ─────────────────────────────────────────────────────────

const CreateCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().min(8, 'Phone number too short').max(20),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gender: z.enum(['male', 'female']).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  address: z.string().max(500).optional(),
  outletId: z.number().int().positive().optional(),
});

const UpdateCustomerSchema = CreateCustomerSchema.partial();

// ─── Transaction Schemas ──────────────────────────────────────────────────────

const TransactionItemSchema = z.object({
  serviceId: z.number().int().positive('Invalid service ID'),
  quantity: z.number().int().positive('Quantity must be positive').default(1),
  unitPrice: z.number().nonnegative(),
  notes: z.string().max(200).optional(),
});

const CreateTransactionSchema = z.object({
  customerId: z.number().int().positive('Customer ID is required'),
  outletId: z.number().int().positive('Outlet ID is required'),
  items: z.array(TransactionItemSchema).min(1, 'At least one item is required'),
  paymentMethod: z.enum(['cash', 'deposit', 'mixed', 'ewallet', 'qris']).optional(),
  cashReceived: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  promoCode: z.string().max(50).optional(),
  isPriority: z.boolean().optional(),
});

const UpdateTransactionStatusSchema = z.object({
  status: z.enum(['pending', 'process', 'done', 'picked_up', 'cancelled']),
  notes: z.string().max(200).optional(),
});

// ─── Service Schemas ───────────────────────────────────────────────────────────

const CreateServiceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  category: z.enum(['treatment', 'washing', 'dry', 'iron', 'packing', 'other']),
  price: z.number().positive('Price must be positive'),
  duration: z.number().int().nonnegative().optional(),
  outletId: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  image: z.string().url().optional(),
});

const UpdateServiceSchema = CreateServiceSchema.partial();

// ─── User Schemas ─────────────────────────────────────────────────────────────

const CreateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'frontline', 'produksi']),
  outletId: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});

const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'frontline', 'produksi']).optional(),
  outletId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

// ─── Outlet Schemas ────────────────────────────────────────────────────────────

const CreateOutletSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(2).max(100),
  address: z.string().max(300).optional(),
  phone: z.string().max(20).optional(),
  isActive: z.boolean().default(true),
});

const UpdateOutletSchema = CreateOutletSchema.partial();

// ─── Promo Schemas ────────────────────────────────────────────────────────────

const CreatePromoSchema = z.object({
  code: z.string().min(3).max(50),
  type: z.enum(['discount', 'deposit_bonus', 'free_service', 'buy_x_get_y']),
  value: z.number().positive(),
  minTransaction: z.number().nonnegative().optional(),
  maxDiscount: z.number().nonnegative().optional(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  usageLimit: z.number().int().nonnegative().optional(),
  outletId: z.number().int().positive().optional(),
});

const UpdatePromoSchema = CreatePromoSchema.partial();

// ─── Deposit Schemas ──────────────────────────────────────────────────────────

const DepositSchema = z.object({
  customerId: z.number().int().positive(),
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['topup', 'withdraw', 'bonus', 'refund']),
  method: z.enum(['cash', 'ewallet', 'transfer', 'qris']).optional(),
  notes: z.string().max(200).optional(),
});

const WithdrawDepositSchema = z.object({
  customerId: z.number().int().positive(),
  amount: z.number().positive(),
  method: z.enum(['cash', 'transfer']).optional(),
  notes: z.string().max(200).optional(),
});

// ─── Report Schemas ───────────────────────────────────────────────────────────

const ReportQuerySchema = z.object({
  ...DateRangeSchema.shape,
  ...PaginationSchema.shape,
  outletId: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  cashierId: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  status: z.enum(['pending', 'process', 'done', 'picked_up', 'cancelled']).optional(),
  paymentMethod: z.enum(['cash', 'deposit', 'mixed', 'ewallet', 'qris']).optional(),
});

// ─── Settings Schemas ──────────────────────────────────────────────────────────

const UpdateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  type: z.enum(['string', 'number', 'boolean']).optional(),
});

// ─── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  // Common
  ObjectIdSchema,
  PaginationSchema,
  DateRangeSchema,

  // Auth
  LoginSchema,
  ChangePasswordSchema,

  // Customer
  CreateCustomerSchema,
  UpdateCustomerSchema,

  // Transaction
  TransactionItemSchema,
  CreateTransactionSchema,
  UpdateTransactionStatusSchema,

  // Service
  CreateServiceSchema,
  UpdateServiceSchema,

  // User
  CreateUserSchema,
  UpdateUserSchema,

  // Outlet
  CreateOutletSchema,
  UpdateOutletSchema,

  // Promo
  CreatePromoSchema,
  UpdatePromoSchema,

  // Deposit
  DepositSchema,
  WithdrawDepositSchema,

  // Report
  ReportQuerySchema,

  // Settings
  UpdateSettingSchema,
};
