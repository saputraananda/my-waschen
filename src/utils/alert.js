import Swal from 'sweetalert2';
import { toast } from 'sonner';
import { C } from './theme';

// ─── Sonner: lightweight toasts for simple feedback ───────────────
export const alertSuccess = (text) => toast.success(text, { duration: 2500 });
export const alertError = (text) => toast.error(text, { duration: 3500 });
export const alertInfo = (text) => toast(text, { duration: 2500 });
export const alertWarning = (text) => toast.warning(text, { duration: 3000 });

// ─── SweetAlert2: kept ONLY for confirmations (needs user action) ──
const swalBase = Swal.mixin({
  customClass: {
    popup: 'waschen-swal',
    title: 'waschen-swal__title',
    htmlContainer: 'waschen-swal__text',
    actions: 'waschen-swal__actions',
    confirmButton: 'waschen-swal__btn waschen-swal__btn--confirm',
    cancelButton: 'waschen-swal__btn waschen-swal__btn--cancel',
  },
  buttonsStyling: false,
  reverseButtons: true,
  focusConfirm: false,
});

const fire = (opts) => swalBase.fire({
  title: 'Konfirmasi',
  confirmButtonText: 'OK',
  ...opts,
});

export const confirmAction = async ({
  title = 'Konfirmasi',
  text,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  icon = 'warning',
  iconColor = C.warning,
}) => {
  const res = await fire({
    title,
    text,
    icon,
    iconColor,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    allowOutsideClick: false,
  });
  return res.isConfirmed;
};

// Shorthand: alertConfirm('Yakin hapus data ini?')
export const alertConfirm = async (text, opts = {}) => {
  const res = await fire({
    title: opts.title || 'Konfirmasi',
    text,
    icon: opts.icon || 'warning',
    iconColor: opts.iconColor || C.warning,
    showCancelButton: true,
    confirmButtonText: opts.confirmText || 'Ya, Lanjutkan',
    cancelButtonText: opts.cancelText || 'Batal',
    allowOutsideClick: false,
    ...opts,
  });
  return res.isConfirmed;
};
