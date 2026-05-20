// ─────────────────────────────────────────────────────────────────────────────
// Haptic Feedback — Web Vibration API wrapper
// Works on Android Chrome, iOS Safari 13+
// ─────────────────────────────────────────────────────────────────────────────

const canVibrate = () =>
  typeof navigator !== 'undefined' && 'vibrate' in navigator;

/**
 * Light tap — for button presses, selections
 */
export const hapticLight = () => {
  if (canVibrate()) navigator.vibrate(10);
};

/**
 * Medium tap — for confirmations, toggles
 */
export const hapticMedium = () => {
  if (canVibrate()) navigator.vibrate(25);
};

/**
 * Heavy — for important actions (checkout success, delete)
 */
export const hapticHeavy = () => {
  if (canVibrate()) navigator.vibrate(50);
};

/**
 * Success pattern — double short pulse
 */
export const hapticSuccess = () => {
  if (canVibrate()) navigator.vibrate([15, 50, 15]);
};

/**
 * Error pattern — long pulse
 */
export const hapticError = () => {
  if (canVibrate()) navigator.vibrate([80, 30, 80]);
};

/**
 * Warning — single medium pulse
 */
export const hapticWarning = () => {
  if (canVibrate()) navigator.vibrate(40);
};

/**
 * Notification — triple short
 */
export const hapticNotification = () => {
  if (canVibrate()) navigator.vibrate([10, 30, 10, 30, 10]);
};
