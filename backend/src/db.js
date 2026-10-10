const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'kopi.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer', -- customer | courier | admin
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS outlets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  rating REAL DEFAULT 4.7,
  open_hour INTEGER DEFAULT 8,
  close_hour INTEGER DEFAULT 22,
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outlet_id INTEGER NOT NULL REFERENCES outlets(id),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL,
  image_url TEXT,
  options TEXT DEFAULT '[]',
  available INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  outlet_id INTEGER NOT NULL REFERENCES outlets(id),
  type TEXT NOT NULL,              -- delivery | pickup
  status TEXT NOT NULL,            -- pending_payment | placed | preparing | ready | delivering | completed | cancelled
  scheduled_at TEXT,
  address TEXT, lat REAL, lng REAL, notes TEXT,
  subtotal INTEGER NOT NULL, delivery_fee INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
  payment_method TEXT NOT NULL,    -- cod | qris | ewallet | bank
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | paid | failed
  payment_url TEXT,
  courier_id INTEGER REFERENCES users(id),
  courier_lat REAL, courier_lng REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  options_text TEXT DEFAULT '',
  unit_price INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`);

module.exports = db;
