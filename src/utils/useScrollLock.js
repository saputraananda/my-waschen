/**
 * useScrollLock.js
 * Custom hook untuk mencegah scroll pada container tertentu atau body
 * saat modal/bottom sheet terbuka
 *
 * @usage
 * const scrollRef = useRef(null);
 * useScrollLock(isModalOpen, scrollRef);
 *
 * // Atau tanpa ref (lock document.body):
 * useScrollLock(isModalOpen);
 */
import { useEffect, useRef } from 'react';

/**
 * Hook untuk lock scroll pada container spesifik atau document.body
 * @param {boolean} isLocked - kondisi modal terbuka/tertutup
 * @param {React.RefObject} [containerRef] - ref ke container yang mau di-lock (optional)
 */
export function useScrollLock(isLocked, containerRef) {
  const savedOverflowRef = useRef(null);

  useEffect(() => {
    // Tidak ada container ref, lock document.body
    if (!containerRef?.current) {
      if (isLocked) {
        savedOverflowRef.current = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = savedOverflowRef.current || '';
      }
      return;
    }

    // Ada container ref, lock container spesifik
    const container = containerRef.current;

    if (isLocked) {
      // Simpan overflow asli sebelum lock
      savedOverflowRef.current = container.style.overflowY || container.style.overflow || '';
      container.style.overflowY = 'hidden';
    } else {
      // Restore overflow asli
      container.style.overflowY = savedOverflowRef.current || 'auto';
    }

    return () => {
      // Cleanup: selalu restore ke nilai asli
      container.style.overflowY = savedOverflowRef.current || 'auto';
    };
  }, [isLocked, containerRef]);
}

export default useScrollLock;
