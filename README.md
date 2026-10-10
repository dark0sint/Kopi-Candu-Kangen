# Kopi Candu Kangen

Aplikasi pesan-antar minuman: pelanggan memesan dari outlet lewat aplikasi Android, kurir mengantar, atau pelanggan mengambil sendiri di outlet.

## Struktur proyek
```
kopi-candu-kangen/
├── backend/            API Node.js + Express + SQLite
│   ├── src/server.js   semua endpoint (auth, outlet, pesanan, pembayaran, admin, kurir)
│   ├── src/db.js       skema database
│   ├── src/seed.js     admin, kurir, outlet, dan menu contoh
│   └── public/admin/   panel admin web (/admin)
├── mobile/             aplikasi Android (Expo / React Native)
│   ├── App.js          navigasi
│   └── src/screens/    Auth, Home, Menu, Checkout, Orders, OrderDetail, Profile, Courier
├── docker-compose.yml  API + Caddy (HTTPS otomatis)
├── Caddyfile           ganti dengan domain Anda
├── .env.example        salin menjadi .env lalu isi
└── DEPLOY.md           panduan deploy server, Midtrans, build Android, Play Store
```

## Fitur
- Katalog menu digital dengan opsi (level es, tingkat manis, topping)
- Cari outlet, urutkan berdasarkan jarak atau rating
- Alamat antar dengan GPS dan pin di peta, ongkir otomatis per jarak
- Pesanan terjadwal
- Pembayaran: QRIS, e-wallet, transfer bank (Midtrans), dan bayar di tempat
- Pelacakan status dan posisi kurir di peta
- Ambil sendiri di outlet (pickup)
- Peran: pelanggan, kurir, admin

## Mulai cepat

### Backend (lokal)
```bash
cd backend
npm install
JWT_SECRET=string-acak-minimal-16-karakter ADMIN_PASSWORD=passwordkuat node src/server.js
```
API di `http://localhost:3000`, panel admin di `http://localhost:3000/admin`.

### Backend (server, Docker)
```bash
cp .env.example .env     # isi JWT_SECRET dan password
nano Caddyfile           # ganti domain
docker compose up -d --build
```

### Aplikasi mobile
```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://IP-KOMPUTER-ANDA:3000 npx expo start
```
Scan QR dengan Expo Go. Peta butuh development build dan Google Maps API key (lihat `DEPLOY.md`).

## Akun awal
| Peran | Email | Password |
|---|---|---|
| Admin | `ADMIN_EMAIL` di .env | `ADMIN_PASSWORD` di .env |
| Kurir | kurir@kopicandukangen.id | `COURIER_PASSWORD` di .env (default `kurir12345`) |

Ganti semua password default sebelum dipakai publik.

## Endpoint utama
| Method | Path | Fungsi |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | Daftar dan masuk |
| GET | /api/outlets | Daftar outlet (query: lat, lng, q, sort) |
| GET | /api/outlets/:id/menu | Menu outlet |
| GET | /api/quote | Hitung ongkir |
| POST | /api/orders | Buat pesanan |
| GET | /api/orders, /api/orders/:id | Riwayat dan detail |
| POST | /api/orders/:id/pay, /cancel | Bayar dan batalkan |
| POST | /api/payments/midtrans/webhook | Notifikasi Midtrans |
| GET/PATCH | /api/admin/... | Pesanan, kurir, harga, dan stok menu |
| GET/POST | /api/courier/... | Tugas kurir, status, dan lokasi |

## Alur status pesanan
- Antar: `placed → preparing → ready → delivering → completed`
- Ambil sendiri: `placed → preparing → ready → completed`
- Pembayaran online diawali `pending_payment`. Pesanan bisa `cancelled` selama belum diproses.

## Catatan
- Kode belum diuji jalan di lingkungan pembuatnya (tanpa internet). Uji dulu di sandbox Midtrans dan di HP sebelum rilis.
- Outlet dan koordinat contoh ada di Bandar Lampung. Ubah di `backend/src/seed.js` sebelum database pertama dibuat, atau lewat database langsung.
- Jangan commit file `.env`.
