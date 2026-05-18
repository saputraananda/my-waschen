import Swal from 'sweetalert2';
import { C } from './theme';

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
  title: 'Informasi',
  confirmButtonText: 'OK',
  ...opts,
});

export const alertInfo = (text, opts = {}) => fire({
  icon: 'info',
  iconColor: C.primary,
  text,
  timer: 1800,
  timerProgressBar: true,
  showConfirmButton: false,
  ...opts,
});

export const alertSuccess = (text, opts = {}) => fire({
  icon: 'success',
  iconColor: C.success,
  text,
  timer: 1600,
  timerProgressBar: true,
  showConfirmButton: false,
  ...opts,
});

export const alertWarning = (text, opts = {}) => fire({
  icon: 'warning',
  iconColor: C.warning,
  text,
  ...opts,
});

export const alertError = (text, opts = {}) => fire({
  icon: 'error',
  iconColor: C.danger,
  text,
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
