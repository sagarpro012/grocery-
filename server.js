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
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@greencart.test").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.email === ADMIN_EMAIL ? "admin" : "user" });

function isAdminCredentials(email = "", password = "") {
  return String(email).trim().toLowerCase() === ADMIN_EMAIL && String(password) === ADMIN_PASSWORD;
}

app.post("/api/auth/signup", (req, res) => {
  const { name = "", email = "", password = "" } = req.body || {};
  const cleanEmail = String(email).trim().toLowerCase();
  if (cleanEmail === ADMIN_EMAIL) {
    return res.status(403).json({ error: "This email is reserved for the store admin." });
  }
  if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail) || password.length < 6) {
    return res.status(400).json({ error: "Please provide a valid name, email, and password of at least 6 characters." });
  }
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
  const cleanEmail = String(email).trim().toLowerCase();

  if (isAdminCredentials(cleanEmail, password)) {
    return res.json({ user: { id: "admin_1", name: "Admin", email: ADMIN_EMAIL, role: "admin" } });
  }

  const user = userByEmail.get(cleanEmail);
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

app.post("/api/admin/products", (req, res) => {
  const { email = "", password = "", product = {} } = req.body || {};
  if (!isAdminCredentials(email, password)) {
    return res.status(403).json({ error: "Admin access only." });
  }

  const name = String(product.name || "").trim();
  const category = String(product.category || "").trim();
  const unit = String(product.unit || "").trim();
  const emoji = String(product.emoji || "").trim() || "🛒";
  const tag = String(product.tag || "").trim();
  const price = Number(product.price);

  if (!name || !category || !unit || !Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: "Name, category, unit, and a valid price are required." });
  }

  const id = String(product.id || `p_${Date.now().toString(36).toUpperCase()}`);
  const row = {
    id,
    name,
    cat: category,
    price: Number(price.toFixed(2)),
    unit,
    emoji,
    tag: tag || "New",
    rating: Number(product.rating || 4.5),
    stock: Number(product.stock || 100)
  };

  db.prepare(`
    INSERT INTO products (id, name, category, price, unit, emoji, tag, rating, stock)
    VALUES (@id, @name, @cat, @price, @unit, @emoji, @tag, @rating, @stock)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      price = excluded.price,
      unit = excluded.unit,
      emoji = excluded.emoji,
      tag = excluded.tag,
      rating = excluded.rating,
      stock = excluded.stock
  `).run(row);

  res.status(201).json({ product: row });
});

app.patch("/api/admin/products/:id", (req, res) => {
  const { email = "", password = "" } = req.body || {};
  if (!isAdminCredentials(email, password)) {
    return res.status(403).json({ error: "Admin access only." });
  }

  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found." });

  const updates = {};
  if (req.body.price !== undefined) {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: "Price must be a positive number." });
    updates.price = Number(price.toFixed(2));
  }
  if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
  if (req.body.category !== undefined) updates.category = String(req.body.category).trim();
  if (req.body.unit !== undefined) updates.unit = String(req.body.unit).trim();
  if (req.body.emoji !== undefined) updates.emoji = String(req.body.emoji).trim() || "🛒";
  if (req.body.tag !== undefined) updates.tag = String(req.body.tag).trim();
  if (req.body.rating !== undefined) updates.rating = Number(req.body.rating);
  if (req.body.stock !== undefined) updates.stock = Number(req.body.stock);

  if (!Object.keys(updates).length) return res.status(400).json({ error: "No product fields to update." });

  const setClauses = Object.keys(updates).map(key => `${key === "category" ? "category" : key} = @${key}`);
  const params = { ...updates, id: req.params.id };
  db.prepare(`UPDATE products SET ${setClauses.join(", ")} WHERE id = @id`).run(params);

  const product = db.prepare(`
    SELECT id, name, category AS cat, price, unit, emoji, tag, rating, stock
    FROM products WHERE id = ?
  `).get(req.params.id);
  res.json({ product });
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