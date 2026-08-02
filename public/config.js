/* =========================================================
   config.js — Konfigurasi aplikasi
   ---------------------------------------------------------
   `serverUrl` diisi alamat Web App Google Apps Script yang menulis
   ke spreadsheet "Penilaian Guide Besakih — Basis Data".

   Diisi di sini supaya aplikasi LANGSUNG SIAP PAKAI di perangkat mana
   pun tanpa perlu diatur manual. Staff tetap bisa menimpanya lewat
   menu Pengaturan bila suatu saat alamatnya berubah.

   ---------------------------------------------------------
   CATATAN KEAMANAN
   Repositori ini publik, jadi alamat di bawah dapat dibaca siapa saja.
   Web App di-deploy dengan akses "Anyone", sehingga pihak yang
   menemukannya bisa mengirim baris penilaian palsu ke spreadsheet.

   Data tidak bisa dihapus atau diubah dari luar (bersifat append-only),
   dan daftar penilaian tidak bisa dibaca lewat alamat ini.

   Bila alamat ini perlu dicabut:
   1. Apps Script → Deploy → Manage deployments → Archive deployment lama
   2. Deploy → New deployment → Web app  (menghasilkan URL baru)
   3. Perbarui nilai serverUrl di bawah, lalu commit
   ========================================================= */
window.APP_CONFIG = {
  serverUrl: 'https://script.google.com/macros/s/AKfycbzxwu_2j1NUqKSkE7WaBWyN5WpXgm37jRQfeiTnp2refg-tanQO_CXrFlik_n0YU2Gs/exec',
};
