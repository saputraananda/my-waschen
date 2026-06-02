// ─────────────────────────────────────────────────────────────────────────────
// AddressCascadingPicker — 3 field cascading: Region → Housing → Block
// ─────────────────────────────────────────────────────────────────────────────
// - Region pakai Select biasa (data terbatas, tidak butuh search).
// - Housing & Block pakai Combobox: dropdown searchable + bisa free-text.
// - Cascading: pilihan Housing tergantung Region, Block tergantung Housing.
//   Tapi user TETAP bisa ketik manual di Housing/Block walau cascade kosong.
// - Logic filter dipisah ke `housingSeed.js` (pure helpers).
//
// Props (controlled component):
//   value: { regionId, housing, block }
//   onChange: (next) => void   — selalu dapat object lengkap
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useEffect, useRef } from 'react';
import { Select } from './ui';
import { Combobox } from './ui/Combobox';
import {
  HOUSING_REGIONS,
  getHousingsByRegion,
  getBlocksByHousing,
  inferRegionFromHousing,
} from '../data/housingSeed';
import { C } from '../utils/theme';

export default function AddressCascadingPicker({
  value,
  onChange,
  regionLabel = 'Pilih Area/Zona',
  housingLabel = 'Nama Komplek/Perumahan',
  blockLabel = 'Blok',
  /** Catatan info per housing (auto display dari seed). */
  showHousingNote = true,
}) {
  const v = value || {};
  const { regionId = '', housing = '', block = '' } = v;

  // ── Derive opsi cascading dari pure helpers ────────────────────────────────
  const housingOptions = useMemo(() => {
    return getHousingsByRegion(regionId).map((h) => h.name);
  }, [regionId]);

  const blockOptions = useMemo(() => {
    return getBlocksByHousing(housing);
  }, [housing]);

  // Cari objek housing terpilih untuk display note
  const selectedHousing = useMemo(() => {
    const t = String(housing || '').trim().toLowerCase();
    if (!t) return null;
    const all = getHousingsByRegion(regionId);
    return all.find((h) => h.name.toLowerCase() === t) || null;
  }, [housing, regionId]);

  // ── Auto-cascade: kalau region berubah, validasi housing/block sebelumnya.
  // Aman: tidak dihapus kalau user sebelumnya isi free-text (biar input mereka tidak hilang).
  const lastRegion = useRef(regionId);
  useEffect(() => {
    if (lastRegion.current !== regionId) {
      const stillExists = getHousingsByRegion(regionId)
        .some((h) => h.name.toLowerCase() === String(housing || '').toLowerCase());
      // Reset hanya kalau housing yang sebelumnya cocok dengan list region lama
      // tapi bukan free-text. Free-text dibiarkan agar tidak hilang tidak sengaja.
      const wasInOldList = getHousingsByRegion(lastRegion.current)
        .some((h) => h.name.toLowerCase() === String(housing || '').toLowerCase());
      if (wasInOldList && !stillExists) {
        onChange({ regionId, housing: '', block: '' });
      }
      lastRegion.current = regionId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId]);

  // ── Auto-fill region kalau user pilih housing dari list (tapi region kosong)
  const handleHousingChange = (next) => {
    const updated = { ...v, housing: next };
    // Kalau hasil pilih cocok dengan salah satu housing seed, isi region otomatis
    const inferredRegion = inferRegionFromHousing(next);
    if (inferredRegion && (!regionId || regionId === 'other')) {
      updated.regionId = inferredRegion;
    }
    // Reset block kalau housing berubah dan block lama tidak ada di daftar baru
    const newBlocks = getBlocksByHousing(next);
    const blockStillValid = newBlocks
      .some((b) => b.toLowerCase() === String(block || '').toLowerCase());
    const oldBlocks = getBlocksByHousing(housing);
    const blockWasFromOldList = oldBlocks
      .some((b) => b.toLowerCase() === String(block || '').toLowerCase());
    if (blockWasFromOldList && !blockStillValid) {
      updated.block = '';
    }
    onChange(updated);
  };

  return (
    <div>
      {/* 1. Region — Select biasa */}
      <Select
        label={regionLabel}
        value={regionId}
        onChange={(val) => onChange({ ...v, regionId: val })}
        options={[
          { value: '', label: 'Pilih Area...' },
          ...HOUSING_REGIONS.map((r) => ({ value: r.id, label: r.name })),
        ]}
      />

      {/* 2. Housing — Combobox searchable + free-text */}
      <Combobox
        label={housingLabel}
        value={housing}
        onChange={handleHousingChange}
        options={housingOptions}
        placeholder="Mis. Perumahan Raffles Hills"
        autoCapitalize
        helperText={
          regionId
            ? housingOptions.length > 0
              ? `${housingOptions.length} komplek di area ini — atau ketik bebas.`
              : 'Belum ada data komplek untuk area ini — silakan ketik manual.'
            : 'Pilih area dulu, atau ketik nama komplek langsung.'
        }
      />

      {/* Note dinamis per housing yang dipilih dari seed */}
      {showHousingNote && selectedHousing?.note && (
        <div style={{
          marginTop: -10, marginBottom: 14,
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: 8, padding: '8px 10px',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ fontSize: 14, lineHeight: 1.2 }}>💡</span>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#1E40AF', lineHeight: 1.5 }}>
            <strong>Format alamat valid: </strong>{selectedHousing.note}
          </div>
        </div>
      )}

      {/* 3. Block — Combobox searchable + free-text, tergantung housing */}
      <Combobox
        label={blockLabel}
        value={block}
        onChange={(val) => onChange({ ...v, block: val })}
        options={blockOptions}
        placeholder={
          housing
            ? blockOptions.length > 0
              ? 'Pilih atau ketik blok'
              : 'Ketik blok / nomor unit'
            : 'Isi nama komplek dulu, atau ketik bebas'
        }
        autoCapitalize
        helperText={
          housing
            ? blockOptions.length > 0
              ? `${blockOptions.length} blok terdaftar — bisa juga ketik manual.`
              : 'Komplek ini belum punya daftar blok — ketik manual saja.'
            : 'Tetap bisa diisi manual walau komplek belum dipilih.'
        }
      />
    </div>
  );
}
