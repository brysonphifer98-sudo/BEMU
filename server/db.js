const path = require('path')
const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, 'bemu.sqlite')
const exists = fs.existsSync(DB_PATH)
const db = new sqlite3.Database(DB_PATH)

db.serialize(()=>{
  // users
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // orders
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    stripe_session_id TEXT,
    status TEXT DEFAULT 'pending',
    total_cents INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // order items
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    name TEXT,
    unit_price_cents INTEGER,
    quantity INTEGER,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  )`)
})

module.exports = db
