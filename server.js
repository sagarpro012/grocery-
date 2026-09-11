const express = require("express");
const path    = require("path");
const db      = require("./db");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = process.env.FRONTEND_URL;
  if (origin && (!allowed || origin === allowed)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.static(__dirname));

/* ---------- health ---------- */
app.get("/api/health", (req, res) => res.json({ ok: true }));

/* ---------- products ---------- */
app.get("/api/products", (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, category AS cat, price, unit, emoji, tag, rating, stock
    FROM products
    ORDER BY rating DESC, name ASC
  `).all();
  res.json({ products: rows });
});

app.get("/api/products/:id", (req, res) => {
  const row = db.prepare(`
    SELECT id, name, category AS cat, price, unit, emoji, tag, rating, stock
    FROM products WHERE id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ product: row });
});

/* ---------- orders ---------- */
app.get("/api/orders", (req, res) => {
  const orders = db.prepare(`
    SELECT id, name, email, address, city, zip, notes, payment,
           subtotal, delivery, total, status, created_at AS placedAt
    FROM orders
    ORDER BY created_at DESC
  `).all();

  const itemsStmt = db.prepare(`
    SELECT product_id AS id, name, qty, price
    FROM order_items
    WHERE order_id = ?
  `);

  const result = orders.map(o => ({
    id: o.id,
    placedAt: o.placedAt,
    status: o.status,
    subtotal: o.subtotal,
    delivery: o.delivery,
    total: o.total,
    customer: {
      name: o.name, email: o.email, address: o.address,
      city: o.city, zip: o.zip, notes: o.notes, payment: o.payment
    },
    items: itemsStmt.all(o.id)
  }));

  res.json({ orders: result });
});

const insertOrder = db.prepare(`
  INSERT INTO orders
    (id, name, email, address, city, zip, notes, payment, subtotal, delivery, total, status)
  VALUES
    (@id, @name, @email, @address, @city, @zip, @notes, @payment,
     @subtotal, @delivery, @total, @status)
`);

const insertItem = db.prepare(`
  INSERT INTO order_items (order_id, product_id, name, qty, price)
  VALUES (?, ?, ?, ?, ?)
`);

const createOrder = db.transaction(order => {
  insertOrder.run({
    id:       order.id,
    name:     order.customer.name,
    email:    order.customer.email,
    address:  order.customer.address,
    city:     order.customer.city,
    zip:      order.customer.zip,
    notes:    order.customer.notes || "",
    payment:  order.customer.payment,
    subtotal: order.subtotal,
    delivery: order.delivery,
    total:    order.total,
    status:   "Pending"
  });
  for (const item of order.items) {
    insertItem.run(order.id, item.id, item.name, item.qty, item.price);
  }
});

app.post("/api/orders", (req, res) => {
  const body = req.body || {};
  if (!body.customer || !Array.isArray(body.items) || !body.items.length) {
    return res.status(400).json({ error: "Invalid order payload" });
  }

  const id = body.id || ("GC-" + Date.now().toString(36).toUpperCase().slice(-6));
  try {
    createOrder({ ...body, id });
    res.status(201).json({ id, eta: "45 minutes" });
  } catch (err) {
    console.error("Order insert failed:", err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

app.patch("/api/orders/:id", (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: "status required" });
  const info = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

/* ---------- SPA fallback ---------- */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ---------- boot ---------- */
app.listen(PORT, () => {
  console.log(`\n🥬  GreenCart running at http://localhost:${PORT}`);
  console.log(`    Admin: view orders at http://localhost:${PORT}/api/orders\n`);
});