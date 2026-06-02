// ─────────────────────────────────────────────────────────────────────────────
// Seed Data Alamat — Komplek & Blok per Kawasan
// ─────────────────────────────────────────────────────────────────────────────
// Sumber: data lapangan kasir Waschen area Cibubur (Depok / Bogor / Bekasi)
// Setiap housing punya regionId yang dipakai untuk cascading filter.
// Daftar blok mengikuti format penulisan alamat yang valid agar kurir tidak
// salah masuk gerbang kluster (terutama Legenda Wisata & CitraGran).
// ─────────────────────────────────────────────────────────────────────────────

export const HOUSING_REGIONS = [
  { id: 'cibubur-depok',  name: 'Cibubur - Depok' },
  { id: 'cibubur-bogor',  name: 'Cibubur - Bogor' },
  { id: 'cibubur-bekasi', name: 'Cibubur - Bekasi' },
  { id: 'other',          name: 'Lainnya / Luar Cibubur' },
];

export const HOUSINGS = [
  {
    regionId: 'cibubur-depok',
    name: 'Perumahan Raffles Hills',
    note: 'Blok alfabet murni (sering digabung angka) untuk area lama, nama kluster untuk area baru/premium.',
    blocks: [
      'Blok A', 'Blok B1', 'Blok B2', 'Blok B3', 'Blok C', 'Blok D', 'Blok E',
      'Blok F', 'Blok G', 'Blok HA', 'Blok HB', 'Blok I', 'Blok J', 'Blok K',
      'Blok L', 'Blok M', 'Blok N1', 'Blok N2', 'Blok N3', 'Blok N4', 'Blok N5',
      'Blok O', 'Blok P', 'Blok Q1', 'Blok Q2', 'Blok Q3', 'Blok R', 'Blok S',
      'Blok T', 'Blok U1', 'Blok U2', 'Blok U3',
      'Cluster Boulevard', 'Cluster Wonderland', 'Cluster Exquisite',
      'Cluster Unity Land', 'Cluster Paradise', 'Cluster Spring Land',
      'Cluster Royal Land',
    ],
  },
  {
    regionId: 'cibubur-bogor',
    name: 'Kota Wisata - Cluster Canadian',
    note: 'Penulisan seragam: inisial CB diikuti nomor blok.',
    blocks: [
      'Blok CB 1', 'Blok CB 2', 'Blok CB 3', 'Blok CB 5', 'Blok CB 6',
      'Blok CB 7', 'Blok CB 8', 'Blok CB 9', 'Blok CB 10', 'Blok CB 11',
      'Blok CB 12', 'Blok CB 15', 'Blok CB 16',
    ],
  },
  {
    regionId: 'cibubur-bogor',
    name: 'Perumahan Legenda Wisata',
    note: 'Wajib menyertakan nama kluster + inisial blok dalam kurung agar kurir masuk gerbang yang tepat.',
    blocks: [
      'Cluster Acropolis (Blok A)', 'Cluster Beethoven (Blok B)',
      'Cluster Columbus (Blok C)', 'Cluster Da Vinci (Blok D)',
      'Cluster Einstein (Blok E)', 'Cluster Rembrandt (Blok F)',
      'Cluster Picasso (Blok G)', 'Cluster El Dorado (Blok H)',
      'Cluster Galileo (Blok I)', 'Cluster Cleopatra (Blok K)',
      'Cluster Lincoln (Blok L)', 'Cluster Mozart (Blok M)',
      'Cluster Napoleon (Blok N)', 'Cluster Onassis (Blok O)',
      'Cluster Pizarro (Blok P)', 'Cluster Shakespeare (Blok S)',
      'Cluster Vivaldi (Blok V)', 'Cluster Washington (Blok W)',
      'Cluster Marco Polo', 'Cluster Green Wood',
    ],
  },
  {
    regionId: 'cibubur-bekasi',
    name: 'Perumahan CitraGran Cibubur',
    note: 'Kluster bernuansa barat dengan inisial blok bervariasi (1 atau 2 huruf).',
    blocks: [
      'Cluster A (Blok A)', 'Cluster B (Blok B)',
      'Cluster Castle Garden (Blok C)', 'Cluster D (Blok D)',
      'Cluster E (Blok E)', 'Cluster Green Valley (Blok G)',
      'Cluster Lake View (Blok L)', 'Cluster N (Blok N)',
      'Cluster T (Blok T)', 'Cluster West Wood (Blok W)',
      'Cluster Golden Wood (Blok GW)', 'Cluster Clover Garden (Blok CC)',
      'Cluster The Meadows', 'Cluster Fountain Blue',
      'Cluster Visual Zone', 'Cluster Sun Terrace',
    ],
  },
  {
    regionId: 'cibubur-bogor',
    name: 'Ruko Sentra Eropa Kota Wisata',
    note: 'Komersial: blok besar A–G, dipisah lagi per lajur/lorong (SE A 1, SE A 2, dst).',
    blocks: [
      'Blok SE A 1', 'Blok SE A 2', 'Blok SE B 1', 'Blok SE B 2',
      'Blok SE C 1', 'Blok SE C 2', 'Blok SE D 1', 'Blok SE D 2',
      'Blok SE E 1', 'Blok SE E 2', 'Blok SE F 1', 'Blok SE F 2',
      'Blok SE G 1', 'Blok SE G 2', 'Blok SE G 3',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers — terpisah dari komponen UI biar gampang di-test
// ─────────────────────────────────────────────────────────────────────────────

/** Daftar housing yang ada di region tertentu. Kalau regionId kosong → semua. */
export function getHousingsByRegion(regionId) {
  if (!regionId) return HOUSINGS;
  if (regionId === 'other') return [];
  return HOUSINGS.filter((h) => h.regionId === regionId);
}

/** Daftar blok untuk housing tertentu (match by nama, case-insensitive). */
export function getBlocksByHousing(housingName) {
  if (!housingName) return [];
  const target = String(housingName).trim().toLowerCase();
  const found = HOUSINGS.find((h) => h.name.toLowerCase() === target);
  return found ? found.blocks : [];
}

/** Cari region yang cocok dari nama housing yang diketik bebas. */
export function inferRegionFromHousing(housingName) {
  if (!housingName) return null;
  const target = String(housingName).trim().toLowerCase();
  const found = HOUSINGS.find((h) => h.name.toLowerCase() === target);
  return found?.regionId || null;
}

/** Filter list (string[] atau {name}[]) dengan substring case-insensitive. */
export function filterByQuery(list, query, getKey = (x) => x) {
  if (!query || !query.trim()) return list;
  const q = query.trim().toLowerCase();
  return list.filter((it) => String(getKey(it) || '').toLowerCase().includes(q));
}
