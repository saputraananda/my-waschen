// ─── Controller: GET /api/users/me ────────────────────────────────────────────
export const getMe = (req, res) => {
  return res.json({ success: true, data: req.user });
};

// ─── Controller: GET /api/users ───────────────────────────────────────────────
export const getAllUsers = (req, res) => {
  return res.json({ success: true, message: 'Daftar user (admin only)', data: [] });
};
