// ─────────────────────────────────────────────────────────────────────────────
// Realtime SSE Routes
// ─────────────────────────────────────────────────────────────────────────────
// Single endpoint: GET /api/realtime/events (SSE stream)
//
// Cara kerja:
//   - Client buka EventSource('/api/realtime/events?token=...')
//   - Server kirim event JSON tiap kali ada publish dari eventBus
//   - Filter per outlet: user cuma terima event yang outletId-nya match
//     (admin terima semua)
//   - Heartbeat tiap 30 detik (comment line ':') supaya Cloudflare/proxy ga close
//   - Cleanup listener saat client disconnect
//
// Auth: SSE ga bisa pakai header Authorization (browser limitation), jadi
// terima token via query param. Kalau invalid, balas 401 dan close.
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bus from '../services/eventBus.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const GLOBAL_ROLES = ['admin'];

// Verify token dari query param (SSE limitation: ga bisa custom headers)
function verifyTokenQuery(req) {
  const token = req.query?.token || req.headers?.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

router.get('/events', (req, res) => {
  const user = verifyTokenQuery(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized: token invalid' });
  }

  const userOutletId = Number(user.outletId) || 0;
  const isGlobal = GLOBAL_ROLES.includes(user.roleCode);

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // disable buffer di nginx kalau ada
  });

  // Initial hello — kasih tau client koneksi sukses
  res.write(`event: hello\ndata: ${JSON.stringify({ ts: Date.now(), userId: user.userId, outletId: userOutletId, isGlobal })}\n\n`);

  // Listener untuk forward event dari bus ke client ini
  const listener = (event) => {
    // Filter: kalau bukan global role, cuma forward event yang outletId match
    // outletId 0 = broadcast (semua user)
    if (!isGlobal && event.outletId !== 0 && event.outletId !== userOutletId) return;

    try {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {
      // res closed mid-write — cleanup
      cleanup();
    }
  };

  bus.on('event', listener);

  // Heartbeat tiap 30 detik supaya proxy ga timeout
  const heartbeat = setInterval(() => {
    try {
      res.write(`: hb ${Date.now()}\n\n`);
    } catch {
      cleanup();
    }
  }, 30_000);

  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    bus.off('event', listener);
    try { res.end(); } catch {}
  }

  req.on('close', cleanup);
  req.on('error', cleanup);
});

export default router;
