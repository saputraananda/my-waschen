import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getProvinces,
  getCities,
  getDistricts,
  getSubDistricts,
  getMaterials,
  getServices,
  getOutlets,
  getFragrances,
  getDepositPackages,
  getAwarenessSources,
  getAreaZones,
} from '../controllers/masterController.js';

const router = Router();
// Fixed import: authenticate (not authenticateToken)

// ═══════════════════════════════════════════════════════════════════════════
// Cascading Address Endpoints
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/master/provinces
 * Returns all provinces for cascading address dropdown
 * Bug Fix 1: Cascading Address Structure (Requirements 2.1, 2.3)
 */
router.get('/provinces', authenticate, getProvinces);

/**
 * GET /api/master/cities?province_id=1
 * Returns cities for a specific province
 * Bug Fix 1: Cascading Address Structure (Requirements 2.1, 2.3)
 */
router.get('/cities', authenticate, getCities);

/**
 * GET /api/master/districts?city_id=1
 * Returns districts for a specific city
 * Bug Fix 1: Cascading Address Structure (Requirements 2.1, 2.3)
 */
router.get('/districts', authenticate, getDistricts);

/**
 * GET /api/master/sub-districts?district_id=1
 * Returns sub-districts (kelurahan/desa) for a specific district
 * Bug Fix 1: Cascading Address Structure (Requirements 2.1, 2.3)
 */
router.get('/sub-districts', authenticate, getSubDistricts);

// ═══════════════════════════════════════════════════════════════════════════
// Materials Endpoint
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/master/materials
 * Returns all materials for material dropdown
 * Bug Fix 3: Material Dropdown Missing (Requirements 2.4)
 */
router.get('/materials', authenticate, getMaterials);

// ═══════════════════════════════════════════════════════════════════════════
// Outlets Endpoint
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/master/outlets
 * Returns all active outlets
 * Used by admin pages for outlet selection dropdown
 */
router.get('/outlets', authenticate, getOutlets);

// ═══════════════════════════════════════════════════════════════════════════
// Optional: Services Endpoint (if needed)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/master/services?outlet_id=1
 * Returns all active services (optionally filtered by outlet)
 */
router.get('/services', authenticate, getServices);

// ═══════════════════════════════════════════════════════════════════════════
// Fragrance & Deposit Package Endpoints
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/master/fragrances
 * Returns all active fragrances for laundry service dropdown
 */
router.get('/fragrances', authenticate, getFragrances);

/**
 * GET /api/master/deposit-packages
 * Returns all active deposit packages for topup selection
 */
router.get('/deposit-packages', authenticate, getDepositPackages);

/**
 * GET /api/master/awareness
 * Returns all awareness sources for customer form
 */
router.get('/awareness', authenticate, getAwarenessSources);

/**
 * GET /api/master/area-zones
 * Returns all area zones for customer form
 */
router.get('/area-zones', authenticate, getAreaZones);

export default router;
