const db = require("./db");

const products = [
  { id:"p01", name:"Hass Avocado",            category:"Fruits",     price:2.49, unit:"each",    emoji:"🥑", tag:"Organic",     rating:4.8 },
  { id:"p02", name:"Strawberries",            category:"Fruits",     price:4.99, unit:"250 g",   emoji:"🍓", tag:"Fresh",       rating:4.9 },
  { id:"p03", name:"Bananas",                 category:"Fruits",     price:1.29, unit:"bunch",   emoji:"🍌", tag:"Best value",  rating:4.6 },
  { id:"p04", name:"Baby Spinach",            category:"Vegetables", price:3.29, unit:"200 g",   emoji:"🥬", tag:"Organic",     rating:4.7 },
  { id:"p05", name:"Cherry Tomatoes",         category:"Vegetables", price:2.99, unit:"300 g",   emoji:"🍅", tag:"Local",       rating:4.8 },
  { id:"p06", name:"Broccoli",                category:"Vegetables", price:1.99, unit:"each",    emoji:"🥦", tag:"Fresh",       rating:4.5 },
  { id:"p07", name:"Whole Milk",              category:"Dairy",      price:2.79, unit:"1 L",     emoji:"🥛", tag:"Chilled",     rating:4.7 },
  { id:"p08", name:"Aged Cheddar",            category:"Dairy",      price:6.49, unit:"200 g",   emoji:"🧀", tag:"Artisan",     rating:4.9 },
  { id:"p09", name:"Free-range Eggs",         category:"Dairy",      price:4.29, unit:"12 pack", emoji:"🥚", tag:"Free-range",  rating:4.8 },
  { id:"p10", name:"Sourdough Loaf",          category:"Bakery",     price:4.49, unit:"each",    emoji:"🍞", tag:"Baked today", rating:4.9 },
  { id:"p11", name:"Butter Croissant",        category:"Bakery",     price:1.89, unit:"each",    emoji:"🥐", tag:"Baked today", rating:4.7 },
  { id:"p12", name:"Orange Juice",            category:"Beverages",  price:3.99, unit:"1 L",     emoji:"🧃", tag:"Cold press",  rating:4.6 },
  { id:"p13", name:"Cold Brew Coffee",        category:"Beverages",  price:5.49, unit:"750 ml",  emoji:"☕", tag:"Chilled",     rating:4.8 },
  { id:"p14", name:"Wild Honey",              category:"Pantry",     price:7.99, unit:"340 g",   emoji:"🍯", tag:"Raw",         rating:4.9 },
  { id:"p15", name:"Basmati Rice",            category:"Pantry",     price:8.49, unit:"2 kg",    emoji:"🍚", tag:"Pantry",      rating:4.7 },
  { id:"p16", name:"Extra Virgin Olive Oil",  category:"Pantry",     price:9.99, unit:"500 ml",  emoji:"🫒", tag:"Cold press",  rating:4.8 }
];

const insert = db.prepare(`
  INSERT OR REPLACE INTO products
    (id, name, category, price, unit, emoji, tag, rating)
  VALUES
    (@id, @name, @category, @price, @unit, @emoji, @tag, @rating)
`);

const seedAll = db.transaction(list => list.forEach(p => insert.run(p)));
seedAll(products);

console.log(`✅ Seeded ${products.length} products into greencart.db`);