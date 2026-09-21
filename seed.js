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
  { id:"p16", name:"Extra Virgin Olive Oil",  category:"Pantry",     price:9.99, unit:"500 ml",  emoji:"🫒", tag:"Cold press",  rating:4.8 },

  { id:"p17", name:"Classic Potato Chips",    category:"Junk Food",  price:2.29, unit:"180 g",   emoji:"🍟", tag:"Crunchy",     rating:4.5 },
  { id:"p18", name:"Chocolate Cookies",       category:"Junk Food",  price:3.19, unit:"pack",    emoji:"🍪", tag:"Sweet",       rating:4.6 },
  { id:"p19", name:"Instant Noodles",         category:"Junk Food",  price:1.79, unit:"pack",    emoji:"🍜", tag:"Quick meal",  rating:4.3 },
  { id:"p20", name:"Sparkling Cola",          category:"Junk Food",  price:1.99, unit:"330 ml",  emoji:"🥤", tag:"Fizz",        rating:4.2 },

  { id:"p21", name:"Paracetamol",             category:"Medicine",   price:4.49, unit:"20 tabs", emoji:"💊", tag:"Relief",      rating:4.8 },
  { id:"p22", name:"Vitamin C Boost",         category:"Medicine",   price:6.99, unit:"60 tabs", emoji:"🧴", tag:"Wellness",    rating:4.7 },
  { id:"p23", name:"Cough Syrup",             category:"Medicine",   price:5.29, unit:"150 ml",  emoji:"🍯", tag:"Cold care",   rating:4.6 },
  { id:"p24", name:"First Aid Kit",           category:"Medicine",   price:12.99, unit:"set",    emoji:"🩹", tag:"Essentials",  rating:4.9 },

  { id:"p25", name:"Classic Sunglasses",       category:"Eyewear",    price:19.99, unit:"pair",   emoji:"🕶️", tag:"UV",          rating:4.7 },
  { id:"p26", name:"Blue Light Glasses",       category:"Eyewear",    price:24.99, unit:"pair",   emoji:"👓", tag:"Digital",     rating:4.8 },
  { id:"p27", name:"Reading Glasses",          category:"Eyewear",    price:17.49, unit:"pair",   emoji:"🔍", tag:"Comfort",     rating:4.5 },
  { id:"p28", name:"Polarized Sports Glasses", category:"Eyewear",    price:29.99, unit:"pair",   emoji:"🥽", tag:"Outdoor",     rating:4.9 },

  { id:"p29", name:"Dog Biscuits",            category:"Pet Food",   price:7.49, unit:"1 kg",    emoji:"🐶", tag:"Protein",     rating:4.7 },
  { id:"p30", name:"Cat Tuna Treats",         category:"Pet Food",   price:6.29, unit:"120 g",   emoji:"🐱", tag:"Favorite",    rating:4.8 },
  { id:"p31", name:"Bird Seed Mix",           category:"Pet Food",   price:5.99, unit:"500 g",   emoji:"🐦", tag:"Foraging",    rating:4.5 },
  { id:"p32", name:"Premium Fish Food",       category:"Pet Food",   price:8.99, unit:"250 g",   emoji:"🐟", tag:"Nutritious",  rating:4.8 },

  { id:"p33", name:"Mechanical Keyboard",     category:"PC Parts",   price:64.99, unit:"unit",   emoji:"⌨️", tag:"Gaming",      rating:4.9 },
  { id:"p34", name:"Wireless Mouse",          category:"PC Parts",   price:32.49, unit:"unit",   emoji:"🖱️", tag:"Ergonomic",   rating:4.7 },
  { id:"p35", name:"Noise Cancelling Headset", category:"PC Parts",  price:59.99, unit:"unit",   emoji:"🎧", tag:"Audio",       rating:4.8 },
  { id:"p36", name:"NVMe SSD 1TB",            category:"PC Parts",   price:74.99, unit:"drive",  emoji:"💾", tag:"Fast",        rating:4.9 }
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