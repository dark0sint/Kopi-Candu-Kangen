const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
require('./seed')();

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) { console.error('JWT_SECRET wajib diisi (min 16 karakter)'); process.exit(1); }
const MIDTRANS_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const MIDTRANS_PROD = process.env.MIDTRANS_PRODUCTION === 'true';
const MAX_KM = 15;

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 60 }));
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));

// ---------- helpers ----------
const wrap = (fn) => (req, res) => { try { const r = fn(req, res); if (r && r.catch) r.catch(e => fail(res, e)); } catch (e) { fail(res, e); } };
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
function fail(res, e) {
  if (e instanceof HttpError) return res.status(e.code).json({ error: e.message });
  console.error(e); res.status(500).json({ error: 'Terjadi kesalahan server' });
}
const bad = (m) => new HttpError(400, m);
const sign = (u) => jwt.sign({ id: u.id, role: u.role, name: u.name }, SECRET, { expiresIn: '30d' });
const pubUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

function auth(roles) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Silakan login dulu' });
    try { req.user = jwt.verify(h.slice(7), SECRET); } catch { return res.status(401).json({ error: 'Sesi berakhir, login ulang' }); }
    if (roles && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Akses ditolak' });
    next();
  };
}
function km(a, b, c, d) {
  const R = 6371, r = Math.PI / 180;
  const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const deliveryFee = (distKm) => Math.max(5000, Math.round((5000 + 2500 * Math.max(0, distKm - 1)) / 500) * 500);
const wibHour = (d = new Date()) => (d.getUTCHours() + 7) % 24;
const isOpen = (o, d) => { const h = wibHour(d); return h >= o.open_hour && h < o.close_hour; };

function loadOrder(id) {
  const o = db.prepare(`SELECT o.*, ot.name outlet_name, ot.address outlet_address, ot.lat outlet_lat, ot.lng outlet_lng,
      u.name customer_name, u.phone customer_phone, c.name courier_name
    FROM orders o JOIN outlets ot ON ot.id=o.outlet_id JOIN users u ON u.id=o.user_id LEFT JOIN users c ON c.id=o.courier_id WHERE o.id=?`).get(id);
  if (!o) return null;
  o.items = db.prepare('SELECT name, qty, options_text, unit_price FROM order_items WHERE order_id=?').all(id);
  return o;
}
const touch = (id, fields) => {
  const keys = Object.keys(fields);
  db.prepare(`UPDATE orders SET ${keys.map(k => k + '=?').join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...keys.map(k => fields[k]), id);
};

// ---------- auth ----------
app.post('/api/auth/register', wrap((req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !password) throw bad('Nama, email, dan password wajib diisi');
  if (password.length < 6) throw bad('Password minimal 6 karakter');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email.toLowerCase())) throw bad('Email sudah terdaftar');
  const id = db.prepare('INSERT INTO users(name,phone,email,password_hash) VALUES (?,?,?,?)')
    .run(name.trim(), phone || '', email.toLowerCase().trim(), bcrypt.hashSync(password, 10)).lastInsertRowid;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  res.json({ token: sign(u), user: pubUser(u) });
}));
app.post('/api/auth/login', wrap((req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get((email || '').toLowerCase().trim());
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) throw new HttpError(401, 'Email atau password salah');
  res.json({ token: sign(u), user: pubUser(u) });
}));
app.get('/api/me', auth(), wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!u) throw new HttpError(401, 'Akun tidak ditemukan');
  res.json(pubUser(u));
}));

// ---------- outlets & menu ----------
app.get('/api/outlets', wrap((req, res) => {
  const { lat, lng, q, sort } = req.query;
  let rows = db.prepare('SELECT * FROM outlets WHERE active=1').all();
  if (q) rows = rows.filter(o => o.name.toLowerCase().includes(String(q).toLowerCase()) || o.address.toLowerCase().includes(String(q).toLowerCase()));
  rows = rows.map(o => ({ ...o, open: isOpen(o), distance_km: lat && lng ? +km(+lat, +lng, o.lat, o.lng).toFixed(1) : null }));
  if (sort === 'rating') rows.sort((a, b) => b.rating - a.rating);
  else if (lat && lng) rows.sort((a, b) => a.distance_km - b.distance_km);
  res.json(rows);
}));
app.get('/api/outlets/:id/menu', wrap((req, res) => {
  const o = db.prepare('SELECT * FROM outlets WHERE id=? AND active=1').get(req.params.id);
  if (!o) throw new HttpError(404, 'Outlet tidak ditemukan');
  const products = db.prepare('SELECT * FROM products WHERE outlet_id=? ORDER BY id').all(o.id)
    .map(p => ({ ...p, options: JSON.parse(p.options || '[]'), available: !!p.available }));
  res.json({ outlet: { ...o, open: isOpen(o) }, categories: [...new Set(products.map(p => p.category))], products });
}));
app.get('/api/quote', wrap((req, res) => {
  const o = db.prepare('SELECT * FROM outlets WHERE id=?').get(req.query.outlet_id);
  if (!o || !req.query.lat || !req.query.lng) throw bad('Outlet dan lokasi wajib diisi');
  const d = km(+req.query.lat, +req.query.lng, o.lat, o.lng);
  res.json({ distance_km: +d.toFixed(1), deliverable: d <= MAX_KM, delivery_fee: deliveryFee(d), max_km: MAX_KM });
}));

// ---------- payments (Midtrans Snap) ----------
async function createSnap(order, user) {
  if (!MIDTRANS_KEY) return null;
  const enabled = { qris: ['qris'], ewallet: ['gopay', 'shopeepay'], bank: ['bca_va', 'bni_va', 'bri_va', 'permata_va'] }[order.payment_method];
  const base = MIDTRANS_PROD ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
  const r = await fetch(base + '/snap/v1/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Basic ' + Buffer.from(MIDTRANS_KEY + ':').toString('base64') },
    body: JSON.stringify({
      transaction_details: { order_id: order.code, gross_amount: order.total },
      enabled_payments: enabled,
      customer_details: { first_name: user.name, email: user.email, phone: user.phone || '' },
      expiry: { unit: 'minutes', duration: 30 }
    })
  });
  const j = await r.json();
  if (!r.ok) { console.error('Midtrans:', j); throw new HttpError(502, 'Gagal membuat pembayaran, coba lagi'); }
  return j.redirect_url;
}

app.post('/api/payments/midtrans/webhook', wrap((req, res) => {
  const b = req.body || {};
  const expected = crypto.createHash('sha512').update(String(b.order_id) + b.status_code + b.gross_amount + MIDTRANS_KEY).digest('hex');
  if (!MIDTRANS_KEY || b.signature_key !== expected) return res.status(403).json({ error: 'signature tidak valid' });
  const o = db.prepare('SELECT * FROM orders WHERE code=?').get(b.order_id);
  if (!o) return res.json({ ok: true });
  const st = b.transaction_status;
  if ((st === 'settlement' || st === 'capture') && b.fraud_status !== 'deny') {
    touch(o.id, { payment_status: 'paid', status: o.status === 'pending_payment' ? 'placed' : o.status });
  } else if (['expire', 'cancel', 'deny', 'failure'].includes(st) && o.payment_status !== 'paid') {
    touch(o.id, { payment_status: 'failed', status: 'cancelled' });
  }
  res.json({ ok: true });
}));

// ---------- orders (customer) ----------
app.post('/api/orders', auth(), wrap(async (req, res) => {
  const { outlet_id, type, items, address, lat, lng, notes, scheduled_at, payment_method } = req.body || {};
  const outlet = db.prepare('SELECT * FROM outlets WHERE id=? AND active=1').get(outlet_id);
  if (!outlet) throw bad('Outlet tidak ditemukan');
  if (!['delivery', 'pickup'].includes(type)) throw bad('Tipe pesanan tidak valid');
  if (!['cod', 'qris', 'ewallet', 'bank'].includes(payment_method)) throw bad('Metode pembayaran tidak valid');
  if (!Array.isArray(items) || !items.length || items.length > 30) throw bad('Keranjang kosong');

  let when = null;
  if (scheduled_at) {
    const d = new Date(scheduled_at);
    if (isNaN(d)) throw bad('Jadwal tidak valid');
    if (d.getTime() < Date.now() + 15 * 60000) throw bad('Jadwal minimal 15 menit dari sekarang');
    if (d.getTime() > Date.now() + 7 * 86400000) throw bad('Jadwal maksimal 7 hari ke depan');
    if (!isOpen(outlet, d)) throw bad(`Outlet buka jam ${outlet.open_hour}:00-${outlet.close_hour}:00 WIB`);
    when = d.toISOString();
  } else if (!isOpen(outlet)) throw bad(`Outlet sedang tutup (buka ${outlet.open_hour}:00-${outlet.close_hour}:00 WIB). Coba pesan terjadwal.`);

  let fee = 0;
  if (type === 'delivery') {
    if (!address || address.trim().length < 5 || typeof lat !== 'number' || typeof lng !== 'number') throw bad('Alamat & titik lokasi pengantaran wajib diisi');
    const d = km(lat, lng, outlet.lat, outlet.lng);
    if (d > MAX_KM) throw bad(`Lokasi di luar jangkauan antar (maks ${MAX_KM} km)`);
    fee = deliveryFee(d);
  }

  let subtotal = 0; const lines = [];
  for (const it of items) {
    const p = db.prepare('SELECT * FROM products WHERE id=? AND outlet_id=?').get(it.product_id, outlet.id);
    const qty = Math.floor(+it.qty);
    if (!p || !p.available) throw bad('Ada menu yang tidak tersedia');
    if (!(qty >= 1 && qty <= 20)) throw bad('Jumlah tidak valid');
    let unit = p.price; const texts = [];
    for (const def of JSON.parse(p.options || '[]')) {
      let sel = (it.options || {})[def.name];
      sel = Array.isArray(sel) ? sel : sel ? [sel] : [];
      if (!sel.length && def.required) sel = [def.choices[0].label];
      if (!def.multiple && sel.length > 1) throw bad('Pilihan tidak valid');
      for (const label of sel) {
        const c = def.choices.find(c => c.label === label);
        if (!c) throw bad('Pilihan tidak valid');
        unit += c.price;
      }
      if (sel.length) texts.push(`${def.name}: ${sel.join(', ')}`);
    }
    subtotal += unit * qty;
    lines.push({ p, qty, unit, text: texts.join(' | ') });
  }
  const total = subtotal + fee;
  const online = payment_method !== 'cod';
  const code = 'KCK-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + crypto.randomInt(1000, 9999);

  const orderId = db.transaction(() => {
    const id = db.prepare(`INSERT INTO orders(code,user_id,outlet_id,type,status,scheduled_at,address,lat,lng,notes,subtotal,delivery_fee,total,payment_method)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(code, req.user.id, outlet.id, type, online ? 'pending_payment' : 'placed', when,
      type === 'delivery' ? address.trim() : null, type === 'delivery' ? lat : null, type === 'delivery' ? lng : null,
      (notes || '').slice(0, 300), subtotal, fee, total, payment_method).lastInsertRowid;
    const ins = db.prepare('INSERT INTO order_items(order_id,product_id,name,qty,options_text,unit_price) VALUES (?,?,?,?,?,?)');
    for (const l of lines) ins.run(id, l.p.id, l.p.name, l.qty, l.text, l.unit);
    return id;
  })();

  if (online) {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    try { const url = await createSnap({ code, total, payment_method }, user); if (url) touch(orderId, { payment_url: url }); }
    catch (e) { touch(orderId, { status: 'cancelled', payment_status: 'failed' }); throw e; }
  }
  res.json(loadOrder(orderId));
}));

app.get('/api/orders', auth(), wrap((req, res) => {
  const rows = db.prepare('SELECT id FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id);
  res.json(rows.map(r => loadOrder(r.id)));
}));
app.get('/api/orders/:id', auth(), wrap((req, res) => {
  const o = loadOrder(req.params.id);
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan');
  const ok = req.user.role === 'admin' || o.user_id === req.user.id || o.courier_id === req.user.id;
  if (!ok) throw new HttpError(403, 'Akses ditolak');
  res.json(o);
}));
app.post('/api/orders/:id/pay', auth(), wrap(async (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!o || o.status !== 'pending_payment') throw bad('Pesanan tidak bisa dibayar');
  if (!o.payment_url) {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    const url = await createSnap(o, user);
    if (url) touch(o.id, { payment_url: url });
  }
  res.json(loadOrder(o.id));
}));
app.post('/api/orders/:id/cancel', auth(), wrap((req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan');
  if (!['pending_payment', 'placed'].includes(o.status)) throw bad('Pesanan sudah diproses, tidak bisa dibatalkan');
  if (o.payment_status === 'paid') throw bad('Pesanan sudah dibayar. Hubungi outlet untuk pembatalan.');
  touch(o.id, { status: 'cancelled' });
  res.json(loadOrder(o.id));
}));

// ---------- admin ----------
const FLOW = { delivery: ['placed', 'preparing', 'ready', 'delivering', 'completed'], pickup: ['placed', 'preparing', 'ready', 'completed'] };
app.get('/api/admin/orders', auth(['admin']), wrap((req, res) => {
  const active = req.query.all ? '' : "WHERE status NOT IN ('completed','cancelled')";
  res.json(db.prepare(`SELECT id FROM orders ${active} ORDER BY id DESC LIMIT 100`).all().map(r => loadOrder(r.id)));
}));
app.patch('/api/admin/orders/:id/status', auth(['admin']), wrap((req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan');
  const { status } = req.body || {};
  if (status !== 'cancelled' && !FLOW[o.type].includes(status)) throw bad('Status tidak valid untuk tipe pesanan ini');
  if (status === 'delivering' && !o.courier_id) throw bad('Pilih kurir dulu');
  const f = { status };
  if (status === 'completed' && o.payment_method === 'cod') f.payment_status = 'paid';
  touch(o.id, f);
  res.json(loadOrder(o.id));
}));
app.patch('/api/admin/orders/:id/courier', auth(['admin']), wrap((req, res) => {
  const c = db.prepare("SELECT id FROM users WHERE id=? AND role='courier'").get(req.body.courier_id);
  if (!c) throw bad('Kurir tidak ditemukan');
  touch(req.params.id, { courier_id: c.id });
  res.json(loadOrder(req.params.id));
}));
app.patch('/api/admin/orders/:id/paid', auth(['admin']), wrap((req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan');
  touch(o.id, { payment_status: 'paid', status: o.status === 'pending_payment' ? 'placed' : o.status });
  res.json(loadOrder(o.id));
}));
app.get('/api/admin/couriers', auth(['admin']), wrap((req, res) => res.json(db.prepare("SELECT id,name,phone FROM users WHERE role='courier'").all())));
app.post('/api/admin/couriers', auth(['admin']), wrap((req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !password || password.length < 6) throw bad('Data kurir tidak lengkap');
  db.prepare("INSERT INTO users(name,phone,email,password_hash,role) VALUES (?,?,?,?, 'courier')").run(name, phone || '', email.toLowerCase(), bcrypt.hashSync(password, 10));
  res.json({ ok: true });
}));
app.get('/api/admin/products', auth(['admin']), wrap((req, res) =>
  res.json(db.prepare('SELECT p.id,p.name,p.category,p.price,p.available,o.name outlet FROM products p JOIN outlets o ON o.id=p.outlet_id ORDER BY o.id,p.id').all())));
app.patch('/api/admin/products/:id', auth(['admin']), wrap((req, res) => {
  const { price, available } = req.body || {};
  if (price !== undefined) db.prepare('UPDATE products SET price=? WHERE id=?').run(Math.max(0, Math.floor(+price)), req.params.id);
  if (available !== undefined) db.prepare('UPDATE products SET available=? WHERE id=?').run(available ? 1 : 0, req.params.id);
  res.json({ ok: true });
}));

// ---------- courier ----------
app.get('/api/courier/orders', auth(['courier']), wrap((req, res) => {
  const rows = db.prepare("SELECT id FROM orders WHERE courier_id=? AND status IN ('ready','delivering') ORDER BY id").all(req.user.id);
  res.json(rows.map(r => loadOrder(r.id)));
}));
app.post('/api/courier/orders/:id/status', auth(['courier']), wrap((req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND courier_id=?').get(req.params.id, req.user.id);
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan');
  const { status } = req.body || {};
  const okMove = (o.status === 'ready' && status === 'delivering') || (o.status === 'delivering' && status === 'completed');
  if (!okMove) throw bad('Perubahan status tidak valid');
  const f = { status };
  if (status === 'completed' && o.payment_method === 'cod') f.payment_status = 'paid';
  touch(o.id, f);
  res.json(loadOrder(o.id));
}));
app.post('/api/courier/location', auth(['courier']), wrap((req, res) => {
  const { lat, lng } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') throw bad('Lokasi tidak valid');
  db.prepare("UPDATE orders SET courier_lat=?, courier_lng=?, updated_at=CURRENT_TIMESTAMP WHERE courier_id=? AND status='delivering'").run(lat, lng, req.user.id);
  res.json({ ok: true });
}));

app.get('/health', (_, res) => res.json({ ok: true }));
app.get('/', (_, res) => res.json({ app: 'Kopi Candu Kangen API', admin: '/admin' }));
app.use((req, res) => res.status(404).json({ error: 'Tidak ditemukan' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Kopi Candu Kangen API di :${port} (Midtrans: ${MIDTRANS_KEY ? 'aktif' : 'mode manual'})`));
