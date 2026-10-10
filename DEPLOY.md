# Kopi Candu Kangen: Panduan Deploy

## Isi paket
- `backend/` API (Node.js + Express + SQLite) dan panel admin web di `/admin`
- `mobile/` aplikasi Android (Expo / React Native)
- `docker-compose.yml` + `Caddyfile` untuk menjalankan di server dengan HTTPS otomatis

## 1. Jalankan backend di server (VPS Ubuntu)
Syarat: VPS (1 GB RAM cukup), domain, port 80/443 terbuka.

1. Arahkan A record `api.domainanda.com` ke IP VPS.
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Upload folder proyek ke server (`scp -r` atau git), lalu:
   ```bash
   cp .env.example .env && nano .env      # isi JWT_SECRET, password admin
   nano Caddyfile                         # ganti api.kopicandukangen.id dengan domain Anda
   docker compose up -d --build
   curl https://api.domainanda.com/health # harus {"ok":true}
   ```
4. Buka `https://api.domainanda.com/admin`, login dengan ADMIN_EMAIL / ADMIN_PASSWORD.
5. Backup: salin volume `kck_data` (berisi `kopi.db`) secara berkala:
   `docker run --rm -v kopi-candu-kangen_kck_data:/d -v $PWD:/b alpine tar czf /b/backup.tgz /d`

Tanpa Docker: `cd backend && npm install && JWT_SECRET=... node src/server.js` (pakai pm2 + nginx).

## 2. Pembayaran online (Midtrans)
1. Daftar di midtrans.com, ambil Server Key (Sandbox dulu).
2. Isi `MIDTRANS_SERVER_KEY` di `.env`, jalankan ulang: `docker compose up -d`.
3. Di dashboard Midtrans, Settings > Configuration > Payment Notification URL isi:
   `https://api.domainanda.com/api/payments/midtrans/webhook`
4. Setelah tes sandbox berhasil, ganti ke key production dan `MIDTRANS_PRODUCTION=true`.
Tanpa Midtrans, pesanan online berstatus "menunggu pembayaran" sampai admin menekan "Konfirmasi bayar" di panel admin. COD berjalan tanpa Midtrans.

## 3. Build aplikasi Android
Syarat: Node 20+, akun gratis di expo.dev, Google Maps API key (Maps SDK for Android).

```bash
cd mobile
npm install
# edit app.json: android.config.googleMaps.apiKey
# edit eas.json: EXPO_PUBLIC_API_URL ke https://api.domainanda.com
npm i -g eas-cli && eas login && eas build:configure
eas build -p android --profile preview      # APK untuk uji coba di HP
eas build -p android --profile production   # AAB untuk Play Store
```
Uji cepat tanpa build: `npx expo start`, lalu scan QR dengan Expo Go (peta butuh development build).

## 4. Publikasi di Play Store
1. Daftar Google Play Console (biaya sekali US$25, perlu verifikasi identitas).
2. Buat aplikasi "Kopi Candu Kangen", upload file `.aab` dari langkah 3 ke track Internal testing dulu.
3. Isi: deskripsi, ikon 512x512, feature graphic 1024x500, minimal 2 screenshot HP, kebijakan privasi (URL wajib karena app memakai lokasi dan akun), Data safety, content rating, target audience.
4. Akun pribadi baru wajib uji tertutup dengan minimal 12 tester selama 14 hari sebelum bisa rilis produksi. Cek syarat terbaru di Play Console.
5. Kirim untuk review (biasanya beberapa hari), lalu rilis ke Production.
Update berikutnya: naikkan `android.versionCode` di app.json, build ulang, upload.

## Akun awal
- Admin: ADMIN_EMAIL / ADMIN_PASSWORD (.env)
- Kurir contoh: kurir@kopicandukangen.id / COURIER_PASSWORD. Tambah kurir lain via API `POST /api/admin/couriers`. Login di app dengan akun kurir untuk melihat tab "Kurir".

## Catatan
- Pelacakan memakai polling 5 detik dan lokasi kurir dikirim saat layar Kurir terbuka (foreground).
- SQLite cukup untuk puluhan ribu pesanan. Untuk skala besar, pindah ke PostgreSQL.
- Ongkir: Rp5.000 + Rp2.500/km setelah 1 km, maksimal 15 km (ubah di `server.js`).
- Ganti outlet dan koordinat contoh (Bandar Lampung) lewat database/seed sesuai outlet asli.
