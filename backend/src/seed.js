const bcrypt = require('bcryptjs');
const db = require('./db');

const ICE = { name: 'Level Es', required: true, multiple: false, choices: [{ label: 'Normal', price: 0 }, { label: 'Less Ice', price: 0 }, { label: 'No Ice', price: 0 }] };
const SWEET = { name: 'Tingkat Manis', required: true, multiple: false, choices: [{ label: 'Normal', price: 0 }, { label: 'Less Sugar', price: 0 }, { label: 'No Sugar', price: 0 }] };
const TOP = { name: 'Topping', required: false, multiple: true, choices: [{ label: 'Extra Shot', price: 5000 }, { label: 'Boba', price: 4000 }, { label: 'Cream Cheese', price: 5000 }] };

const MENU = [
  ['Kopi', 'Kopi Susu Candu', 'Signature: espresso, susu segar, gula aren.', 18000],
  ['Kopi', 'Kopi Kangen', 'Kopi susu karamel asin, bikin balik lagi.', 25000],
  ['Kopi', 'Aren Latte', 'Latte dengan gula aren pekat.', 24000],
  ['Kopi', 'Americano', 'Espresso & air, bersih dan tegas.', 16000],
  ['Kopi', 'Cafe Latte', 'Espresso dengan susu lembut.', 22000],
  ['Kopi', 'Cappuccino', 'Busa susu tebal, espresso kuat.', 22000],
  ['Teh', 'Teh Tarik', 'Teh pekat berbusa susu.', 15000],
  ['Teh', 'Lemon Tea', 'Teh dingin dengan lemon segar.', 14000],
  ['Teh', 'Thai Tea', 'Teh Thailand creamy manis.', 17000],
  ['Non-Kopi', 'Matcha Latte', 'Matcha Jepang dengan susu.', 24000],
  ['Non-Kopi', 'Coklat Dingin', 'Coklat pekat dengan es.', 20000],
  ['Non-Kopi', 'Red Velvet', 'Red velvet latte lembut.', 22000]
];

function seed() {
  const admin = process.env.ADMIN_EMAIL || 'admin@kopicandukangen.id';
  if (!db.prepare('SELECT 1 FROM users WHERE email=?').get(admin)) {
    const ins = db.prepare('INSERT INTO users(name,phone,email,password_hash,role) VALUES (?,?,?,?,?)');
    ins.run('Admin', '', admin, bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'ganti-password-ini', 10), 'admin');
    ins.run('Kurir Demo', '081200000000', 'kurir@kopicandukangen.id', bcrypt.hashSync(process.env.COURIER_PASSWORD || 'kurir12345', 10), 'courier');
    console.log('Admin & kurir dibuat:', admin);
  }
  if (db.prepare('SELECT COUNT(*) c FROM outlets').get().c === 0) {
    const outlets = [
      ['Kopi Candu Kangen - Kedaton', 'Jl. ZA. Pagar Alam, Kedaton, Bandar Lampung', -5.3689, 105.2471, 4.8],
      ['Kopi Candu Kangen - Tanjung Karang', 'Jl. Raden Intan, Tanjung Karang, Bandar Lampung', -5.4270, 105.2610, 4.7],
      ['Kopi Candu Kangen - Teluk Betung', 'Jl. Yos Sudarso, Teluk Betung, Bandar Lampung', -5.4511, 105.2680, 4.6]
    ];
    const io = db.prepare('INSERT INTO outlets(name,address,lat,lng,rating) VALUES (?,?,?,?,?)');
    const ip = db.prepare('INSERT INTO products(outlet_id,category,name,description,price,options) VALUES (?,?,?,?,?,?)');
    for (const o of outlets) {
      const id = io.run(...o).lastInsertRowid;
      for (const [cat, name, desc, price] of MENU) {
        const opts = name === 'Teh Tarik' ? [SWEET, TOP] : [ICE, SWEET, TOP];
        ip.run(id, cat, name, desc, price, JSON.stringify(opts));
      }
    }
    console.log('Outlet & menu contoh dibuat');
  }
}
module.exports = seed;
if (require.main === module) seed();
