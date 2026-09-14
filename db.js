// db.js — uses Node 22+'s built-in SQLite (no npm package needed)
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const databasePath = process.env.DATABASE_PATH || path.join(__dirname, "greencart.db");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);

db.transaction = function (callback) {
  return (...args) => {
    db.exec("BEGIN");
    try {
      const result = callback(...args);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
};

// SQLite requires foreign keys to be enabled per connection
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");

// ---------- schema ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    category  TEXT NOT NULL,
    price     REAL NOT NULL,
    unit      TEXT NOT NULL,
    emoji     TEXT NOT NULL,
    tag       TEXT,
    rating    REAL DEFAULT 4.5,
    stock     INTEGER DEFAULT 100,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id        TEXT PRIMARY KEY,
    user_id    TEXT,
    name      TEXT NOT NULL,
    email     TEXT NOT NULL,
    address   TEXT NOT NULL,
    city      TEXT NOT NULL,
    zip       TEXT NOT NULL,
    notes     TEXT,
    payment   TEXT NOT NULL,
    subtotal  REAL NOT NULL,
    delivery  REAL NOT NULL,
    total     REAL NOT NULL,
    status    TEXT DEFAULT 'Pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   TEXT NOT NULL,
    product_id TEXT NOT NULL,
    name       TEXT NOT NULL,
    qty        INTEGER NOT NULL,
    price      REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_orders_email   ON orders(email);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_items_order    ON order_items(order_id);
`);

try { db.exec("ALTER TABLE orders ADD COLUMN user_id TEXT"); } catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
`);

module.exports = db;