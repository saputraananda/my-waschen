export const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');

/**
 * Formats a string of numbers into a Rupiah currency format (e.g., "100.000").
 * @param {string} value - The number string to format.
 * @param {string} prefix - The currency prefix.
 * @returns {string} The formatted currency string.
 */
export const formatRupiah = (value, prefix = 'Rp ') => {
  if (value === null || value === undefined) return '';
  let number_string = String(value).replace(/[^,\d]/g, '').toString();
  let split = number_string.split(',');
  let sisa = split[0].length % 3;
  let rupiah = split[0].substr(0, sisa);
  let ribuan = split[0].substr(sisa).match(/\d{3}/gi);

  if (ribuan) {
    let separator = sisa ? '.' : '';
    rupiah += separator + ribuan.join('.');
  }

  rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;
  return prefix ? (rupiah ? 'Rp ' + rupiah : '') : rupiah;
};

/**
 * Parses a formatted Rupiah string back to a plain number.
 * @param {string} value - The formatted Rupiah string.
 * @returns {number} The parsed number.
 */
export const parseRupiah = (value) => {
  if (!value) return 0;
  return parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
};


export const STAGES = ['Diterima', 'Cuci', 'Pengeringan', 'Setrika', 'Packing', 'Selesai'];

export const STATUS_COLORS = {
  baru: { bg: '#EFF6FF', text: '#2563EB' },
  proses: { bg: '#FFF7ED', text: '#F59E0B' },
  selesai: { bg: '#ECFDF5', text: '#10B981' },
  diambil: { bg: '#F6F1F7', text: '#475569' },
  dibatalkan: { bg: '#FEF2F2', text: '#EF4444' },
  Gold: { bg: '#FEF9C3', text: '#92400E' },
  Silver: { bg: '#F6F1F7', text: '#475569' },
  Regular: { bg: '#F3E6F5', text: '#5B005F' },
  pending: { bg: '#FFF7ED', text: '#F59E0B' },
  approved: { bg: '#ECFDF5', text: '#10B981' },
  rejected: { bg: '#FEF2F2', text: '#EF4444' },
};

/**
 * Compresses an image file and returns a base64 DataURL (JPEG).
 * @param {File} file - The image file to compress.
 * @param {number} [maxWidth=800] - Maximum width of the compressed image.
 * @param {number} [maxHeight=800] - Maximum height of the compressed image.
 * @param {number} [quality=0.7] - Quality of the JPEG (0 to 1).
 * @returns {Promise<string>}
 */
export const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

/**
 * Crops an image based on pixel coordinates and returns a base64 DataURL (JPEG).
 */
export const getCroppedImg = (imageSrc, pixelCrop, targetSize = 800, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetSize,
        targetSize
      );

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = (error) => reject(error);
  });
};
