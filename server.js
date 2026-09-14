const express = require("express");
const path    = require("path");
const crypto  = require("crypto");
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

/* ---------- accounts ---------- */
const userByEmail = db.prepare("SELECT id, name, email, password_hash AS passwordHash FROM users WHERE email = ?");
const insertUser = db.prepare("INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)");
const passwordHash = password => crypto.scryptSync(password, process.env.AUTH_SALT || "greencart-demo-salt", 32).toString("hex");
const publicUser = user => ({ id: user.id, name: user.name, email: user.email });

app.post("/api/auth/signup", (req, res) => {
  const { name = "", email = "", password = "" } = req.body || {};
  if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || password.length < 6) {
    return res.status(400).json({ error: "Please provide a valid name, email, and password of at least 6 characters." });
  }
  const cleanEmail = email.trim().toLowerCase();
  try {
    const user = { id: "u_" + crypto.randomUUID(), name: name.trim(), email: cleanEmail };
    insertUser.run(user.id, user.name, user.email, passwordHash(password));
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) return res.status(409).json({ error: "An account with this email already exists." });
    console.error("Signup failed:", error);
    res.status(500).json({ error: "Could not create the account." });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email = "", password = "" } = req.body || {};
  const user = userByEmail.get(email.trim().toLowerCase());
  const suppliedHash = passwordHash(password);
  if (!user || !password || !crypto.timingSafeEqual(Buffer.from(user.passwordHash, "hex"), Buffer.from(suppliedHash, "hex"))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  res.json({ user: publicUser(user) });
});

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
  const email = (req.query.email || "").trim().toLowerCase();
  const orders = db.prepare(`
    SELECT id, user_id AS userId, name, email, address, city, zip, notes, payment,
           subtotal, delivery, total, status, created_at AS placedAt
    FROM orders ${email ? "WHERE lower(email) = ?" : ""}
    ORDER BY created_at DESC
  `).all(...(email ? [email] : []));

  const itemsStmt = db.prepare(`
    SELECT product_id AS id, name, qty, price
    FROM order_items
    WHERE order_id = ?
  `);

  const result = orders.map(o => ({
    id: o.id,
    userId: o.userId,
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
    (id, user_id, name, email, address, city, zip, notes, payment, subtotal, delivery, total, status)
  VALUES
    (@id, @userId, @name, @email, @address, @city, @zip, @notes, @payment,
     @subtotal, @delivery, @total, @status)
`);

const insertItem = db.prepare(`
  INSERT INTO order_items (order_id, product_id, name, qty, price)
  VALUES (?, ?, ?, ?, ?)
`);

const createOrder = db.transaction(order => {
  insertOrder.run({
    id:       order.id,
    userId:   order.userId || null,
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