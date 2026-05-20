// ─────────────────────────────────────────────────────────────────────────────
// Filter Preset Helper — save/load common filter combinations to localStorage
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'waschen_filter_presets';

/**
 * Built-in date range presets
 */
export function getDateRangePreset(key) {
  const end = new Date();
  const start = new Date();
  switch (key) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      start.setDate(end.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case 'this_week': {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday as start
      start.setDate(start.getDate() - diff);
      break;
    }
    case 'last_week': {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff - 7);
      end.setDate(end.getDate() - day - (day === 0 ? 0 : 1));
      break;
    }
    case '7d': start.setDate(end.getDate() - 6); break;
    case '14d': start.setDate(end.getDate() - 13); break;
    case '30d': start.setDate(end.getDate() - 29); break;
    case '90d': start.setDate(end.getDate() - 89); break;
    case 'this_month':
      start.setDate(1);
      break;
    case 'last_month':
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      end.setDate(0); // last day of previous month
      break;
    case '3m':
      start.setMonth(end.getMonth() - 2);
      start.setDate(1);
      break;
    case '6m':
      start.setMonth(end.getMonth() - 5);
      start.setDate(1);
      break;
    case 'this_year':
      start.setMonth(0);
      start.setDate(1);
      break;
    case 'ytd':
      start.setMonth(0);
      start.setDate(1);
      break;
    default:
      return null;
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/**
 * Built-in date preset options
 */
export const DATE_PRESETS = [
  { key: 'today',      label: 'Hari ini' },
  { key: 'yesterday',  label: 'Kemarin' },
  { key: '7d',         label: '7 hari' },
  { key: 'this_week',  label: 'Minggu ini' },
  { key: 'last_week',  label: 'Minggu lalu' },
  { key: '30d',        label: '30 hari' },
  { key: 'this_month', label: 'Bulan ini' },
  { key: 'last_month', label: 'Bulan lalu' },
  { key: '3m',         label: '3 bulan' },
  { key: '6m',         label: '6 bulan' },
  { key: 'ytd',        label: 'Tahun ini' },
];

// ─── User-defined presets ────────────────────────────────────────────────────

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAll(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

/**
 * List user-saved presets for a specific page (scope).
 * Scope examples: 'finance_report', 'shift_report', 'revenue_recap'
 */
export function listPresets(scope) {
  const all = loadAll();
  return all[scope] || [];
}

/**
 * Save a user preset.
 */
export function savePreset(scope, preset) {
  if (!scope || !preset?.name) return;
  const all = loadAll();
  if (!all[scope]) all[scope] = [];
  // Replace if name exists
  const idx = all[scope].findIndex(p => p.name === preset.name);
  if (idx >= 0) {
    all[scope][idx] = preset;
  } else {
    all[scope].push(preset);
  }
  saveAll(all);
}

/**
 * Delete a user preset.
 */
export function deletePreset(scope, name) {
  const all = loadAll();
  if (!all[scope]) return;
  all[scope] = all[scope].filter(p => p.name !== name);
  saveAll(all);
}
