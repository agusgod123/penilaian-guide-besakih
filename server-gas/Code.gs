/**
 * ============================================================
 *  Backend Penilaian Guide Kawasan Besakih
 *  Google Apps Script Web App (terikat pada spreadsheet)
 * ============================================================
 *
 *  CARA PAKAI
 *  1. Buka spreadsheet "Penilaian Guide Besakih — Basis Data"
 *  2. Menu Extensions (Ekstensi) → Apps Script
 *  3. Hapus isi bawaan, tempel SELURUH file ini, lalu simpan (Ctrl+S)
 *  4. Pilih fungsi "setup" di dropdown, tekan Run. Setujui izin saat diminta.
 *     → Tab Guides, Evaluations, dan Petunjuk dibuat otomatis, DAN pembaruan
 *       rekap otomatis langsung dinyalakan.
 *  5. Deploy → New deployment → Web app
 *        Execute as     : Me
 *        Who has access : Anyone
 *  6. Salin URL yang berakhiran /exec
 *  7. Di aplikasi (HP/tablet staff): Pengaturan → Alamat Server → tempel URL
 *     → tekan "Tes Koneksi Server"
 *
 *  Kalau script ini diubah, deploy ulang lewat
 *  Deploy → Manage deployments → Edit (ikon pensil) → Version: New version
 *  supaya URL-nya TIDAK berubah.
 *
 *  ------------------------------------------------------------
 *  KALAU HASIL DARI LAPANGAN TIDAK TERLIHAT DI SPREADSHEET
 *
 *  Yang ditulis aplikasi adalah tab Evaluations. Tab "Rekap ..." disusun
 *  belakangan oleh trigger, jadi tab rekap yang belum diperbarui akan
 *  terlihat kosong walaupun datanya sudah masuk.
 *
 *  1. Lihat tab Evaluations — kalau baris baru ada di sana, data AMAN.
 *  2. Cek cap "Diperbarui: ..." di pojok kanan atas tiap tab rekap.
 *  3. Menu Penilaian Guide → "Periksa Kesehatan Data" untuk menyusun ulang
 *     rekap sekarang juga sekaligus melihat apakah ada baris yang tercecer.
 *  4. Kalau trigger terhitung 0: menu → "Nyalakan Pembaruan Otomatis".
 * ============================================================
 */

var SHEET_EVAL    = 'Evaluations';
var SHEET_GUIDES  = 'Guides';
var SHEET_INFO    = 'Petunjuk';

var HEADER_EVAL   = ['evaluationId', 'timestamp', 'pos', 'guideId', 'guideName',
                     'uniform', 'idCard', 'review', 'etika', 'catatan', 'receivedAt'];
var LEBAR_EVAL    = [290, 190, 50, 90, 200, 80, 70, 70, 70, 240, 190];
var HEADER_GUIDES = ['guideId', 'guideName', 'kategori', 'regu', 'aktif'];

// Batas wajar, disamakan dengan aplikasi supaya kiriman aneh tidak masuk rekap.
var REVIEW_MAKS   = 20;
var CATATAN_MAKS  = 500;
var BATCH_MAKS    = 200;

// Bulan yang perlu dirangkum ulang, dititipkan oleh doPost dan dikerjakan
// oleh trigger `rekapOtomatis`. Lihat bagian "Pembaruan otomatis".
var PROP_TERTUNDA = 'rekapTertunda';

var GUIDES_AWAL = [
  ['G-001', 'Gusti Alit Astawa', 'Asing', 'A1', true],
  ['G-002', 'I Gede Astawa', 'Asing', 'A1', true],
  ['G-003', 'I Gede Budiarsana', 'Asing', 'A1', true],
  ['G-004', 'I Gede Darmayasa', 'Asing', 'A1, A2', true],
  ['G-005', 'I Gede Darta', 'Domestik', 'D2', true],
  ['G-006', 'I Gede Dauh', 'Asing', 'A2', true],
  ['G-007', 'I Gede Kariasa', 'Asing', 'A2', true],
  ['G-008', 'I Gede Karya', 'Asing', 'A2', true],
  ['G-009', 'I Gede Karyawan', 'Asing', 'A2', true],
  ['G-010', 'I Gede Kastika', 'Asing', 'A2', true],
  ['G-011', 'I Gede Kutawan', 'Asing', 'A2', true],
  ['G-012', 'I Gede Pande Sudarta', 'Asing', 'A1', true],
  ['G-013', 'I Gede Paruna', 'Asing', 'A1', true],
  ['G-014', 'I Gede Pondal', 'Asing', 'A2', true],
  ['G-015', 'I Gede Rsi', 'Domestik', 'D2', true],
  ['G-016', 'I Gede Sudarma', 'Asing', 'A2', true],
  ['G-017', 'I Gede Sudiasa', 'Asing', 'A2', true],
  ['G-018', 'I Gede Suweca', 'Domestik', 'D1', true],
  ['G-019', 'I Gede Toni Ermawan', 'Asing', 'A2', true],
  ['G-020', 'I Gede Yuda Pratama', 'Asing', 'A2', true],
  ['G-021', 'I Gusti A Armawan', 'Asing', 'A2', true],
  ['G-022', 'I Gusti Bagus Arimbawa', 'Asing', 'A2', true],
  ['G-023', 'I Gusti Bagus Asmara', 'Asing', 'A2', true],
  ['G-024', 'I Gusti Ketut Men', 'Asing', 'A2', true],
  ['G-025', 'I Gusti Ketut Putra', 'Asing', 'A2', true],
  ['G-026', 'I Gusti Lanang Andika', 'Asing', 'A1', true],
  ['G-027', 'I Gusti Lanang Oka', 'Asing', 'A2', true],
  ['G-028', 'I Gusti Ngurah Arpama', 'Domestik', 'D1', true],
  ['G-029', 'I Gusti Ngurah Artanawa', 'Asing', 'A1', true],
  ['G-030', 'I Gusti Ngurah Artawan', 'Asing', 'A1', true],
  ['G-031', 'I Gusti Ngurah Arya Utama', 'Asing', 'A2', true],
  ['G-032', 'I Gusti Ngurah Aryawan', 'Asing', 'A1', true],
  ['G-033', 'I Gusti Ngurah Bauguna', 'Asing', 'A2', true],
  ['G-034', 'I Gusti Ngurah Darmayasa', 'Asing, Domestik', 'A1, D1', true],
  ['G-035', 'I Gusti Ngurah Ema Putra', 'Asing', 'A2', true],
  ['G-036', 'I Gusti Ngurah Mantra', 'Asing', 'A1', true],
  ['G-037', 'I Gusti Ngurah Mariana', 'Asing', 'A1', true],
  ['G-038', 'I Gusti Ngurah Marjaya', 'Asing', 'A2', true],
  ['G-039', 'I Gusti Ngurah Muliarta', 'Asing', 'A2', true],
  ['G-040', 'I Gusti Ngurah Putra', 'Asing', 'A1', true],
  ['G-041', 'I Gusti Ngurah Putra Yata', 'Asing', 'A2', true],
  ['G-042', 'I Gusti Putu Wirawan', 'Asing', 'A2', true],
  ['G-043', 'I Kadek Adiarta', 'Asing', 'A2', true],
  ['G-044', 'I Kadek Agus', 'Domestik', 'D1', true],
  ['G-045', 'I Kadek Ardana', 'Domestik', 'D2', true],
  ['G-046', 'I Kadek Ariawan', 'Asing', 'A2', true],
  ['G-047', 'I Kadek Budiasa', 'Domestik', 'D1', true],
  ['G-048', 'I Kadek Ema Putra', 'Asing', 'A2', true],
  ['G-049', 'I Kadek Kariawan', 'Domestik', 'D1', true],
  ['G-050', 'I Kadek Korya', 'Asing', 'A1', true],
  ['G-051', 'I Kadek Lanus', 'Domestik', 'D2', true],
  ['G-052', 'I Kadek Murdiasa', 'Domestik', 'D1', true],
  ['G-053', 'I Kadek Ngenu', 'Domestik', 'D1', true],
  ['G-054', 'I Kadek Oden', 'Domestik', 'D1', true],
  ['G-055', 'I Kadek Pageh', 'Asing', 'A2', true],
  ['G-056', 'I Kadek Pepek', 'Asing', 'A1', true],
  ['G-057', 'I Kadek Purna', 'Asing', 'A2', true],
  ['G-058', 'I Kadek Rudiarta', 'Asing', 'A2', true],
  ['G-059', 'I Kadek Suartana', 'Domestik', 'D2', true],
  ['G-060', 'I Kadek Sudarma', 'Asing', 'A2', true],
  ['G-061', 'I Kadek Sudarta', 'Asing', 'A1', true],
  ['G-062', 'I Kadek Sudiarta', 'Domestik', 'D1', true],
  ['G-063', 'I Kadek Wardana', 'Asing, Domestik', 'A1, D1', true],
  ['G-064', 'I Ketut Arnawan', 'Asing', 'A2', true],
  ['G-065', 'I Ketut Artana', 'Asing', 'A1', true],
  ['G-066', 'I Ketut Artika', 'Domestik', 'D2', true],
  ['G-067', 'I Ketut Astawa', 'Domestik', 'D2', true],
  ['G-068', 'I Ketut Budiana', 'Asing', 'A1', true],
  ['G-069', 'I Ketut Budiantara', 'Asing', 'A1', true],
  ['G-070', 'I Ketut Budiasta', 'Asing', 'A1', true],
  ['G-071', 'I Ketut Budiawan', 'Asing', 'A1', true],
  ['G-072', 'I Ketut Dukut', 'Asing', 'A1', true],
  ['G-073', 'I Ketut Juliarta', 'Asing', 'A1', true],
  ['G-074', 'I Ketut Kasih', 'Asing', 'A1', true],
  ['G-075', 'I Ketut Konten', 'Domestik', 'D1', true],
  ['G-076', 'I Ketut Kusuma', 'Asing', 'A1', true],
  ['G-077', 'I Ketut Ngenu', 'Asing', 'A2', true],
  ['G-078', 'I Ketut Pariasa', 'Asing', 'A1', true],
  ['G-079', 'I Ketut Pica', 'Asing', 'A1', true],
  ['G-080', 'I Ketut Rawi', 'Asing', 'A2', true],
  ['G-081', 'I Ketut Rawiana', 'Asing', 'A2', true],
  ['G-082', 'I Ketut Sadia', 'Asing', 'A2', true],
  ['G-083', 'I Ketut Sandiasa', 'Asing', 'A1', true],
  ['G-084', 'I Ketut Setiawan', 'Domestik', 'D2', true],
  ['G-085', 'I Ketut Suadnyana', 'Asing', 'A1', true],
  ['G-086', 'I Ketut Suandika', 'Asing', 'A2', true],
  ['G-087', 'I Ketut Sudana', 'Asing', 'A2', true],
  ['G-088', 'I Ketut Sudi Artawan', 'Asing', 'A1', true],
  ['G-089', 'I Ketut Sugiarta', 'Asing', 'A1', true],
  ['G-090', 'I Ketut Suji', 'Asing', 'A1', true],
  ['G-091', 'I Ketut Sutama', 'Domestik', 'D2', true],
  ['G-092', 'I Ketut Sutama Yasa', 'Asing', 'A2', true],
  ['G-093', 'I Ketut Sutarma', 'Asing', 'A1', true],
  ['G-094', 'I Ketut Uliantara', 'Domestik', 'D1', true],
  ['G-095', 'I Ketut Wandri', 'Domestik', 'D1', true],
  ['G-096', 'I Ketut Wardana', 'Asing', 'A2', true],
  ['G-097', 'I Ketut Wartawan', 'Domestik', 'D2', true],
  ['G-098', 'I Ketut Watra', 'Asing', 'A1', true],
  ['G-099', 'I Ketut Widarta', 'Asing', 'A2', true],
  ['G-100', 'I Ketut Widya', 'Asing', 'A1', true],
  ['G-101', 'I Ketut Wijanta', 'Asing', 'A2', true],
  ['G-102', 'I Ketut Wirya', 'Asing', 'A2', true],
  ['G-103', 'I Komang Artawan', 'Domestik', 'D1', true],
  ['G-104', 'I Komang Bayu', 'Asing', 'A1', true],
  ['G-105', 'I Komang Irvan', 'Asing', 'A2', true],
  ['G-106', 'I Komang Kayun', 'Asing', 'A1', true],
  ['G-107', 'I Komang Rema', 'Asing', 'A2', true],
  ['G-108', 'I Komang Sudiarta', 'Asing, Domestik', 'A1, D1', true],
  ['G-109', 'I Komang Supardika', 'Asing', 'A1', true],
  ['G-110', 'I Komang Widana', 'Asing', 'A1', true],
  ['G-111', 'I Komang Wiratawan', 'Domestik', 'D1', true],
  ['G-112', 'I Made Astika', 'Domestik', 'D2', true],
  ['G-113', 'I Made Pageh', 'Asing', 'A1', true],
  ['G-114', 'I Made Simpen', 'Asing', 'A2', true],
  ['G-115', 'I Made Suastika', 'Asing', 'A2', true],
  ['G-116', 'I Made Suwadnya', 'Asing', 'A2', true],
  ['G-117', 'I Made Tunas', 'Domestik', 'D1', true],
  ['G-118', 'I Mangku Sudarta', 'Domestik', 'D2', true],
  ['G-119', 'I Mangku Wayan Sama', 'Domestik', 'D2', true],
  ['G-120', 'I Nengah Adi Purnawan', 'Asing', 'A1', true],
  ['G-121', 'I Nengah Ardana', 'Asing', 'A1', true],
  ['G-122', 'I Nengah Artawan', 'Domestik', 'D1', true],
  ['G-123', 'I Nengah Budayasa', 'Asing', 'A1', true],
  ['G-124', 'I Nengah Dadi', 'Domestik', 'D1', true],
  ['G-125', 'I Nengah Dana', 'Domestik', 'D1', true],
  ['G-126', 'I Nengah Darma', 'Domestik', 'D2', true],
  ['G-127', 'I Nengah Darmawan', 'Asing', 'A2', true],
  ['G-128', 'I Nengah Darmayasa', 'Asing', 'A1', true],
  ['G-129', 'I Nengah Darmika', 'Asing', 'A1', true],
  ['G-130', 'I Nengah Diatmika', 'Asing', 'A2', true],
  ['G-131', 'I Nengah Gejer', 'Asing', 'A2', true],
  ['G-132', 'I Nengah Jemet', 'Asing', 'A1', true],
  ['G-133', 'I Nengah Juliarta', 'Asing', 'A2', true],
  ['G-134', 'I Nengah Kariana', 'Asing', 'A1', true],
  ['G-135', 'I Nengah Lebut', 'Asing', 'A1', true],
  ['G-136', 'I Nengah Madia', 'Asing', 'A1', true],
  ['G-137', 'I Nengah Marta', 'Asing', 'A2', true],
  ['G-138', 'I Nengah Monas', 'Asing', 'A1', true],
  ['G-139', 'I Nengah Mudana', 'Domestik', 'D2', true],
  ['G-140', 'I Nengah Murniawan', 'Asing', 'A2', true],
  ['G-141', 'I Nengah Murti', 'Asing', 'A2', true],
  ['G-142', 'I Nengah Pani', 'Asing', 'A1', true],
  ['G-143', 'I Nengah Putrawan', 'Asing', 'A2', true],
  ['G-144', 'I Nengah Riasa', 'Asing', 'A2', true],
  ['G-145', 'I Nengah Sadya', 'Domestik', 'D1', true],
  ['G-146', 'I Nengah Sarmadi', 'Asing', 'A1', true],
  ['G-147', 'I Nengah Sedeng', 'Asing', 'A2', true],
  ['G-148', 'I Nengah Suardana', 'Asing', 'A1', true],
  ['G-149', 'I Nengah Suartamayasa', 'Asing', 'A2', true],
  ['G-150', 'I Nengah Suartana', 'Asing', 'A1', true],
  ['G-151', 'I Nengah Sudarna', 'Asing', 'A1', true],
  ['G-152', 'I Nengah Sudarta', 'Asing', 'A1, A2', true],
  ['G-153', 'I Nengah Sujata', 'Domestik', 'D1', true],
  ['G-154', 'I Nengah Sukarta', 'Asing', 'A1', true],
  ['G-155', 'I Nengah Sumada', 'Asing', 'A1', true],
  ['G-156', 'I Nengah Supartama', 'Asing', 'A1', true],
  ['G-157', 'I Nengah Suta', 'Asing', 'A2', true],
  ['G-158', 'I Nengah Tantra', 'Asing', 'A2', true],
  ['G-159', 'I Nengah Tapak', 'Domestik', 'D1', true],
  ['G-160', 'I Nengah Widana', 'Asing', 'A2', true],
  ['G-161', 'I Nengah Wispa', 'Asing', 'A2', true],
  ['G-162', 'I Nengah Yasa', 'Asing', 'A1', true],
  ['G-163', 'I Ngurah P.Darma Y.', 'Asing', 'A2', true],
  ['G-164', 'I Noman Sribet', 'Domestik', 'D2', true],
  ['G-165', 'I Nyoman Adi Sudarmaya', 'Asing', 'A2', true],
  ['G-166', 'I Nyoman Adnyana', 'Asing', 'A1', true],
  ['G-167', 'I Nyoman Ardana', 'Asing', 'A2', true],
  ['G-168', 'I Nyoman Artawan', 'Asing', 'A1', true],
  ['G-169', 'I Nyoman Astawa', 'Asing', 'A1, A2', true],
  ['G-170', 'I Nyoman Darta', 'Asing', 'A2', true],
  ['G-171', 'I Nyoman Darta (Angsoka)', 'Domestik', 'D1', true],
  ['G-172', 'I Nyoman Darta (Kidul)', 'Domestik', 'D1', true],
  ['G-173', 'I Nyoman Diasa', 'Asing', 'A2', true],
  ['G-174', 'I Nyoman Donik', 'Asing', 'A2', true],
  ['G-175', 'I Nyoman Ganti', 'Asing', 'A2', true],
  ['G-176', 'I Nyoman Gumbreg', 'Domestik', 'D2', true],
  ['G-177', 'I Nyoman Gunarsa', 'Asing', 'A1', true],
  ['G-178', 'I Nyoman Hendra', 'Asing', 'A1', true],
  ['G-179', 'I Nyoman Kebek', 'Domestik', 'D2', true],
  ['G-180', 'I Nyoman Mande', 'Domestik', 'D2', true],
  ['G-181', 'I Nyoman Mangku Jati', 'Asing', 'A1', true],
  ['G-182', 'I Nyoman Mangku Ridana', 'Asing', 'A1', true],
  ['G-183', 'I Nyoman Mangku Warta', 'Asing', 'A2', true],
  ['G-184', 'I Nyoman Nyunyur', 'Asing', 'A1', true],
  ['G-185', 'I Nyoman Palgunada', 'Asing', 'A2', true],
  ['G-186', 'I Nyoman Pasta', 'Asing', 'A1', true],
  ['G-187', 'I Nyoman Polos', 'Domestik', 'D1', true],
  ['G-188', 'I Nyoman Pula Astawa', 'Asing', 'A2', true],
  ['G-189', 'I Nyoman Regog', 'Domestik', 'D1', true],
  ['G-190', 'I Nyoman Reneng', 'Asing', 'A1', true],
  ['G-191', 'I Nyoman Sandi Yasa', 'Asing', 'A1', true],
  ['G-192', 'I Nyoman Santoso', 'Domestik', 'D2', true],
  ['G-193', 'I Nyoman Selamat', 'Domestik', 'D1', true],
  ['G-194', 'I Nyoman Suartana', 'Asing', 'A1, A2', true],
  ['G-195', 'I Nyoman Suartika', 'Asing', 'A2', true],
  ['G-196', 'I Nyoman Subawa', 'Domestik', 'D1', true],
  ['G-197', 'I Nyoman Sudarsana', 'Asing', 'A1', true],
  ['G-198', 'I Nyoman Sudarta', 'Asing', 'A1, A2', true],
  ['G-199', 'I Nyoman Sudiatmika', 'Asing', 'A2', true],
  ['G-200', 'I Nyoman Sumerta', 'Asing', 'A1', true],
  ['G-201', 'I Nyoman Sura', 'Asing', 'A2', true],
  ['G-202', 'I Nyoman Suri', 'Asing', 'A1', true],
  ['G-203', 'I Nyoman Tawa', 'Domestik', 'D1', true],
  ['G-204', 'I Nyoman Wanta', 'Asing', 'A2', true],
  ['G-205', 'I Nyoman Weni Artawan', 'Asing', 'A2', true],
  ['G-206', 'I Nyoman Wiradarma', 'Asing', 'A1', true],
  ['G-207', 'I Nyoman Wirawan', 'Asing', 'A1', true],
  ['G-208', 'I Nyoman Wirayasa', 'Asing', 'A1', true],
  ['G-209', 'I Nyoman Witadana', 'Asing', 'A2', true],
  ['G-210', 'I Putu Agus Santika', 'Domestik', 'D1', true],
  ['G-211', 'I Putu Agus Wiranata', 'Asing', 'A2', true],
  ['G-212', 'I Putu Ariasta', 'Asing', 'A2', true],
  ['G-213', 'I Putu Ariawan', 'Asing', 'A2', true],
  ['G-214', 'I Putu Dedi Sudarta', 'Domestik', 'D1', true],
  ['G-215', 'I Putu Edi Astika', 'Asing', 'A2', true],
  ['G-216', 'I Putu Gede Darma', 'Asing', 'A1', true],
  ['G-217', 'I Putu Jati Suantika', 'Asing', 'A1', true],
  ['G-218', 'I Putu Kariana', 'Domestik', 'D2', true],
  ['G-219', 'I Putu Mastra', 'Asing', 'A1', true],
  ['G-220', 'I Putu Rembun', 'Asing', 'A1', true],
  ['G-221', 'I Putu Setiawan', 'Asing', 'A1', true],
  ['G-222', 'I Putu Suanda', 'Asing', 'A1', true],
  ['G-223', 'I Putu Suantara', 'Asing', 'A2', true],
  ['G-224', 'I Putu Suantara Yasa', 'Asing', 'A1', true],
  ['G-225', 'I Putu Sudarta', 'Asing', 'A1', true],
  ['G-226', 'I Putu Supriadi', 'Asing', 'A2', true],
  ['G-227', 'I Putu Suyasa', 'Asing', 'A1', true],
  ['G-228', 'I Putu Widana', 'Asing', 'A1', true],
  ['G-229', 'I Putu Wirawan', 'Asing', 'A2', true],
  ['G-230', 'I Wayan Ada', 'Domestik', 'D1', true],
  ['G-231', 'I Wayan Andika', 'Asing', 'A2', true],
  ['G-232', 'I Wayan Ardana', 'Asing, Domestik', 'A1, D1', true],
  ['G-233', 'I Wayan Badra', 'Asing', 'A2', true],
  ['G-234', 'I Wayan Budiarta', 'Asing', 'A2', true],
  ['G-235', 'I Wayan Dapid', 'Asing', 'A2', true],
  ['G-236', 'I Wayan Darmana', 'Asing', 'A1', true],
  ['G-237', 'I Wayan Darmayasa', 'Asing, Domestik', 'A1, D1', true],
  ['G-238', 'I Wayan Darpa', 'Asing', 'A2', true],
  ['G-239', 'I Wayan Darsana', 'Asing', 'A1', true],
  ['G-240', 'I Wayan Darta', 'Asing', 'A2', true],
  ['G-241', 'I Wayan Degdeg', 'Asing', 'A2', true],
  ['G-242', 'I Wayan Eka Sudiantara', 'Asing', 'A2', true],
  ['G-243', 'I Wayan Esti Asa', 'Asing', 'A1', true],
  ['G-244', 'I Wayan Jiguh', 'Asing', 'A1', true],
  ['G-245', 'I Wayan Juliarta', 'Asing', 'A1', true],
  ['G-246', 'I Wayan Kariada', 'Asing', 'A2', true],
  ['G-247', 'I Wayan Kartika', 'Asing', 'A2', true],
  ['G-248', 'I Wayan Kenzet', 'Asing', 'A2', true],
  ['G-249', 'I Wayan Lampung', 'Domestik', 'D1', true],
  ['G-250', 'I Wayan Marna', 'Asing', 'A1', true],
  ['G-251', 'I Wayan Mentik', 'Asing', 'A1', true],
  ['G-252', 'I Wayan Mester', 'Asing', 'A1', true],
  ['G-253', 'I Wayan Mudana', 'Asing, Domestik', 'A1, D1, D2', true],
  ['G-254', 'I Wayan Mudastra', 'Asing', 'A2', true],
  ['G-255', 'I Wayan Nuasa', 'Domestik', 'D2', true],
  ['G-256', 'I Wayan Pait', 'Domestik', 'D1', true],
  ['G-257', 'I Wayan Pasek', 'Asing', 'A2', true],
  ['G-258', 'I Wayan Rahasia', 'Domestik', 'D1', true],
  ['G-259', 'I Wayan Rapet', 'Domestik', 'D1', true],
  ['G-260', 'I Wayan Rauh', 'Asing', 'A1', true],
  ['G-261', 'I Wayan Rempeg', 'Domestik', 'D1', true],
  ['G-262', 'I Wayan Sriana', 'Domestik', 'D2', true],
  ['G-263', 'I Wayan Srimulih', 'Asing', 'A1', true],
  ['G-264', 'I Wayan Suastika', 'Domestik', 'D1', true],
  ['G-265', 'I Wayan Subagia', 'Domestik', 'D1', true],
  ['G-266', 'I Wayan Suda', 'Asing', 'A2', true],
  ['G-267', 'I Wayan Sudana', 'Domestik', 'D1', true],
  ['G-268', 'I Wayan Sudarma', 'Domestik', 'D2', true],
  ['G-269', 'I Wayan Sudarta', 'Asing', 'A1, A2', true],
  ['G-270', 'I Wayan Sudiarta', 'Asing, Domestik', 'A2, D2', true],
  ['G-271', 'I Wayan Sujana', 'Asing', 'A2', true],
  ['G-272', 'I Wayan Sujatiyasa', 'Asing', 'A1', true],
  ['G-273', 'I Wayan Sukarta', 'Asing', 'A2', true],
  ['G-274', 'I Wayan Sumarta', 'Asing', 'A2', true],
  ['G-275', 'I Wayan Suparta', 'Asing, Domestik', 'A2, D2', true],
  ['G-276', 'I Wayan Sutama', 'Asing', 'A2', true],
  ['G-277', 'I Wayan Sweta', 'Asing', 'A2', true],
  ['G-278', 'I Wayan Tegal', 'Domestik', 'D1', true],
  ['G-279', 'I Wayan Temen', 'Domestik', 'D2', true],
  ['G-280', 'I Wayan Warta', 'Asing', 'A1', true],
  ['G-281', 'I Wayan Wirya', 'Domestik', 'D1, D2', true],
  ['G-282', 'I Wayan Yasa', 'Domestik', 'D1', true],
  ['G-283', 'Kadek Suastika', 'Domestik', 'D1', true],
  ['G-284', 'Ketut Aryawan', 'Domestik', 'D2', true],
  ['G-285', 'Komang Ada', 'Asing', 'A1', true],
  ['G-286', 'Komang Made Rauh', 'Domestik', 'D1', true],
  ['G-287', 'Komang Suparta', 'Domestik', 'D1', true],
  ['G-288', 'Mangku Gel-gel', 'Asing', 'A2', true],
  ['G-289', 'Manik Suastika', 'Asing', 'A2', true],
  ['G-290', 'Neengah Sudiana/Onni', 'Asing', 'A1', true],
  ['G-291', 'Nengah Suarnawa', 'Asing', 'A2', true],
  ['G-292', 'Nengah Suyadnya', 'Domestik', 'D2', true],
  ['G-293', 'Nengah Tebeng', 'Domestik', 'D1', true],
  ['G-294', 'Nyoman Darmawan', 'Asing', 'A1', true],
  ['G-295', 'Nyoman Putra', 'Domestik', 'D2', true],
  ['G-296', 'Wayan Nitra', 'Asing', 'A1', true]
];

/* ================= Utilitas ================= */

function ss_()  { return SpreadsheetApp.getActiveSpreadsheet(); }

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_(nama) {
  var sh = ss_().getSheetByName(nama);
  if (!sh) throw new Error('Tab "' + nama + '" belum ada. Jalankan fungsi setup() dulu.');
  return sh;
}

function pasangHeader_(sh, header, lebar) {
  sh.getRange(1, 1, 1, header.length).setValues([header])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0B5D3B')
    .setHorizontalAlignment('center');
  sh.setFrozenRows(1);
  for (var i = 0; i < lebar.length; i++) sh.setColumnWidth(i + 1, lebar[i]);
}

/* ================= Setup sekali jalan ================= */

function setup() {
  var ss = ss_();

  // --- Tab Guides ---
  // Ditulis ulang bila tab masih kosong ATAU headernya belum sesuai skema
  // terbaru (mis. spreadsheet lama yang masih memakai kolom "lisensi").
  var g = ss.getSheetByName(SHEET_GUIDES) || ss.insertSheet(SHEET_GUIDES);
  var headerSekarang = g.getLastRow() > 0
    ? g.getRange(1, 1, 1, HEADER_GUIDES.length).getValues()[0].join('|')
    : '';
  // getLastRow() < 2 berarti tab kosong atau hanya berisi header — daftar guide
  // yang kosong sama saja dengan rusak, jadi ikut ditulis ulang.
  if (g.getLastRow() < 2 || headerSekarang !== HEADER_GUIDES.join('|')) {
    resetGuides();
  }

  // --- Tab Evaluations ---
  var e = ss.getSheetByName(SHEET_EVAL) || ss.insertSheet(SHEET_EVAL);
  if (e.getLastRow() === 0) {
    pasangHeader_(e, HEADER_EVAL, LEBAR_EVAL);
  } else {
    migrasiEvaluations_(e);
  }

  // --- Tab Petunjuk ---
  var p = ss.getSheetByName(SHEET_INFO) || ss.insertSheet(SHEET_INFO);
  if (p.getLastRow() === 0) {
    var teks = [
      ['PENILAIAN GUIDE KAWASAN BESAKIH — Basis Data'],
      [''],
      ['Spreadsheet ini adalah "server" aplikasi penilaian guide di lapangan.'],
      [''],
      ['Tab Guides      : daftar guide. Tambah baris untuk guide baru.'],
      ['                  Isi kolom aktif dengan FALSE untuk menonaktifkan tanpa menghapus.'],
      ['Tab Evaluations : hasil penilaian dari lapangan — DIISI OTOMATIS oleh aplikasi.'],
      ['                  Jangan mengubah atau menghapus baris di tab ini.'],
      ['Tab Rekap ...   : ringkasan bulanan, DISUSUN ULANG oleh trigger tiap 5 menit.'],
      ['                  Boleh dicoret-coret; isinya ditimpa lagi saat rekap disusun.'],
      [''],
      ['KALAU HASIL TIDAK TERLIHAT'],
      ['- Yang paling dulu terisi adalah tab Evaluations. Cek ke sana lebih dulu.'],
      ['- Tiap tab rekap punya cap "Diperbarui: ..." di pojok kanan atas.'],
      ['  Kalau capnya lama, rekapnya memang belum disusun ulang — bukan datanya hilang.'],
      ['- Menu "Penilaian Guide" → "Periksa Kesehatan Data" menyusun ulang sekarang juga.'],
      [''],
      ['CATATAN PENTING'],
      ['- Jangan menulis URL /exec di repositori GitHub yang bersifat publik.'],
      ['- Kalau script diubah: Deploy → Manage deployments → Edit → New version,'],
      ['  supaya URL tidak berubah dan perangkat staff tidak perlu diatur ulang.'],
      ['- Aplikasi hanya menambah baris (append-only), jadi data lama aman.']
    ];
    p.getRange(1, 1, teks.length, 1).setValues(teks);
    p.setColumnWidth(1, 700);
    p.getRange('A1').setFontWeight('bold').setFontSize(13).setFontColor('#0B5D3B');
    p.getRange('A10').setFontWeight('bold');
  }

  // Buang tab bawaan "Sheet1" / "Sheet 1" kalau masih kosong
  ['Sheet1', 'Sheet 1', 'Sheet'].forEach(function (nama) {
    var s = ss.getSheetByName(nama);
    if (s && ss.getSheets().length > 1 && s.getLastRow() === 0) ss.deleteSheet(s);
  });

  // Pembaruan rekap otomatis dipasang di sini juga. Sebelumnya ini langkah
  // terpisah yang mudah terlewat — akibatnya tab rekap tidak pernah diperbarui
  // dan hasil dari lapangan terlihat "tidak masuk" padahal datanya ada.
  var otomatis;
  try {
    pasangTriggerHarian();
    otomatis = 'Pembaruan rekap otomatis: aktif (tiap 5 menit + tiap malam).';
  } catch (e) {
    otomatis = 'Pembaruan rekap otomatis BELUM aktif (' + e + ').\n' +
               'Jalankan menu Penilaian Guide → Nyalakan Pembaruan Otomatis.';
  }

  return 'Setup selesai. ' + otomatis + '\nLanjut ke Deploy → New deployment → Web app.';
}

/**
 * Sesuaikan tab Evaluations lama ke skema terbaru.
 *
 * Versi awal memakai urutan  idCard | uniform | etika  dengan nilai TRUE/FALSE.
 * Versi sekarang memakai      uniform | idCard | review dengan angka 1/0/n,
 * mengikuti cara penilaian yang dipakai di lapangan selama ini.
 * Nilai lama dipindahkan, tidak dihapus.
 */
function migrasiEvaluations_(e) {
  var lebarLama = Math.max(e.getLastColumn(), 1);
  var header = e.getRange(1, 1, 1, lebarLama).getValues()[0].map(function (x) {
    return String(x || '').trim();
  });
  if (header.join('|') === HEADER_EVAL.join('|')) return false;   // sudah sesuai

  // Dipetakan berdasarkan NAMA kolom, bukan posisi. Skema tab ini sudah
  // berganti beberapa kali — kolom bertambah, urutan uniform/idCard sempat
  // tertukar — dan pemetaan posisional akan salah pada salah satu di antaranya.
  var idx = {};
  for (var h = 0; h < header.length; h++) if (header[h]) idx[header[h]] = h;

  var jmlBaris = e.getLastRow() - 1;
  var baru = [];
  if (jmlBaris > 0) {
    var data = e.getRange(2, 1, jmlBaris, lebarLama).getValues();
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      var ambil = function (nama) { return idx[nama] === undefined ? '' : r[idx[nama]]; };
      var yaTidak = function (v) { return (v === true || Number(v) === 1) ? 1 : 0; };
      var angka = function (v) {
        if (v === true) return 1;                    // skema paling lama: TRUE/FALSE
        return Math.min(REVIEW_MAKS, Math.max(0, Number(v) || 0));
      };
      baru.push([
        ambil('evaluationId'), ambil('timestamp'), Number(ambil('pos')) || 0,
        ambil('guideId'), ambil('guideName'),
        yaTidak(ambil('uniform')), yaTidak(ambil('idCard')),
        angka(ambil('review')), angka(ambil('etika')),
        ambil('catatan'), ambil('receivedAt')
      ]);
    }
  }

  e.clearContents();
  pasangHeader_(e, HEADER_EVAL, LEBAR_EVAL);
  if (baru.length) e.getRange(2, 1, baru.length, HEADER_EVAL.length).setValues(baru);
  Logger.log('Tab Evaluations dimigrasikan ke skema ' + HEADER_EVAL.join('/') + '.');
  return true;
}

/* ================= GET ================= */
/**
 * ?action=guides  → daftar guide aktif (dipakai dropdown aplikasi)
 * ?action=health  → cek server hidup (tombol "Tes Koneksi Server")
 *
 * Sengaja TIDAK ada endpoint untuk membaca daftar penilaian: web app ini
 * dideploy sebagai "Anyone", jadi endpoint semacam itu akan membuat seluruh
 * data penilaian bisa diunduh siapa saja. Rekap dilihat dari spreadsheet ini.
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'health';

  if (action === 'guides') {
    var rows = sheet_(SHEET_GUIDES).getDataRange().getValues().slice(1);
    var guides = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0]) continue;
      if (String(r[4]).toUpperCase() === 'FALSE') continue;
      guides.push({
        guideId:   String(r[0]).trim(),
        guideName: String(r[1]).trim(),
        kategori:  String(r[2] || '').trim(),
        regu:      String(r[3] || '').trim(),
        aktif:     true
      });
    }
    return json_({ guides: guides });
  }

  var last = sheet_(SHEET_EVAL).getLastRow();
  return json_({
    ok: true,
    storage: 'google-sheets',
    total: Math.max(0, last - 1),
    serverTime: new Date().toISOString()
  });
}


/* ================= POST ================= */
/**
 * Menerima satu penilaian, atau batch { evaluations: [...] }.
 * Bersifat append-only dan idempoten: mengirim ulang evaluationId yang sama
 * tidak menggandakan baris, sehingga retry dari aplikasi selalu aman.
 *
 * Aplikasi mengirim body dengan Content-Type text/plain agar tidak memicu
 * preflight CORS — Apps Script tidak bisa menjawab permintaan OPTIONS.
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ accepted: [], rejected: [{ evaluationId: null, errors: ['JSON tidak valid'] }] });
  }

  var items = (body && Object.prototype.toString.call(body.evaluations) === '[object Array]')
    ? body.evaluations : [body];

  if (items.length > BATCH_MAKS) {
    return json_({ accepted: [], rejected: [{ evaluationId: null,
      errors: ['maksimal ' + BATCH_MAKS + ' entri per kiriman'] }] });
  }

  var accepted = [], rejected = [];

  // Kunci: mencegah dua pos menulis ke baris yang sama secara bersamaan.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    // Tidak dapat kunci → beri tahu aplikasi agar mencoba lagi nanti.
    return json_({ accepted: [], rejected: [], busy: true });
  }

  try {
    var sh = sheet_(SHEET_EVAL);
    var last = sh.getLastRow();
    var idAda = {}, posAda = {};
    if (last > 1) {
      // Kolom A..D: evaluationId, timestamp, pos, guideId
      var kol = sh.getRange(2, 1, last - 1, 4).getValues();
      for (var i = 0; i < kol.length; i++) {
        idAda[String(kol[i][0])] = true;
        var w = new Date(kol[i][1]);
        if (!isNaN(w.getTime())) {
          posAda[kunciPos_(String(kol[i][3]), kol[i][2], kodeTanggal_(w))] = true;
        }
      }
    }

    // Nama guide diambil dari tab Guides, bukan dari kiriman aplikasi: kalau
    // perangkat memakai daftar guide lama, nama yang salah akan membuat baris
    // itu tidak pernah cocok dengan siapa pun di rekap.
    var namaResmi = petaGuides_();

    var baris = [], bulanTersentuh = {};
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var errs = validasi_(it, namaResmi);
      if (errs.length) {
        rejected.push({ evaluationId: (it && it.evaluationId) || null, errors: errs });
        continue;
      }
      if (idAda[String(it.evaluationId)]) {
        accepted.push({ evaluationId: it.evaluationId, synced: true, duplicate: true });
        continue;
      }
      var gid = String(it.guideId).trim();

      // SATU POS HANYA MENILAI SATU KALI PER HARI.
      // Pemeriksaannya di sini, bukan di aplikasi: hanya server yang memegang
      // data seluruh pos. Perangkat di Pos 1 tidak mungkin tahu apa yang sudah
      // dicatat perangkat lain — jadi kalau aturan ini ditegakkan di aplikasi,
      // penilaian ganda antar perangkat akan lolos begitu saja.
      // Pos LAIN tetap boleh menilai guide yang sama pada hari yang sama.
      var tglIt = kodeTanggal_(new Date(it.timestamp));
      var kunci = kunciPos_(gid, it.pos, tglIt);
      if (posAda[kunci]) {
        rejected.push({
          evaluationId: it.evaluationId,
          errors: [(namaResmi[gid] || gid) + ' sudah dinilai di Pos ' + Number(it.pos) +
                   ' pada ' + tglIt + ' — satu pos hanya menilai satu kali per hari'],
          sudahDinilai: true
        });
        continue;
      }
      posAda[kunci] = true;      // cegah juga penggandaan di dalam satu kiriman
      baris.push([
        String(it.evaluationId),
        String(it.timestamp),
        Number(it.pos),
        gid,
        namaResmi[gid] || String(it.guideName),
        it.criteria.uniform ? 1 : 0,
        it.criteria.idCard ? 1 : 0,
        Math.min(REVIEW_MAKS, Math.max(0, Number(it.criteria.review) || 0)),
        Math.min(REVIEW_MAKS, Math.max(0, Number(it.criteria.etika) || 0)),
        String(it.catatan || '').slice(0, CATATAN_MAKS),
        new Date().toISOString()
      ]);
      idAda[String(it.evaluationId)] = true;
      bulanTersentuh[kodeBulan_(new Date(it.timestamp))] = true;
      accepted.push({ evaluationId: it.evaluationId, synced: true, duplicate: false });
    }

    if (baris.length) {
      sh.getRange(sh.getLastRow() + 1, 1, baris.length, HEADER_EVAL.length).setValues(baris);
      SpreadsheetApp.flush();
      // Titipkan ke trigger: rekap harus disusun ulang. Rekapnya TIDAK dibangun
      // di sini supaya balasan ke aplikasi tetap cepat (lihat rekapOtomatis).
      tandaiRekapTertunda_(Object.keys(bulanTersentuh));
    }
  } catch (err) {
    // Gagal menulis → jangan balas "accepted", supaya aplikasi menahan data
    // di antrean dan mencobanya lagi.
    return json_({ accepted: [], rejected: [], error: String(err) });
  } finally {
    lock.releaseLock();
  }

  return json_({ accepted: accepted, rejected: rejected, total: sheet_(SHEET_EVAL).getLastRow() - 1 });
}

/* ================= Validasi ================= */

/**
 * @param {Object=} namaResmi peta guideId -> guideName dari tab Guides.
 *   Bila diberikan, guideId yang tidak terdaftar akan ditolak — baris seperti
 *   itu tidak akan pernah muncul di rekap, jadi lebih baik ditolak sejak awal
 *   supaya aplikasi menahannya dan petugas tahu ada yang salah.
 */
function validasi_(it, namaResmi) {
  var errs = [];
  if (!it || typeof it !== 'object') return ['body bukan objek'];
  if (!it.evaluationId) errs.push('evaluationId wajib');
  if (!it.guideId)      errs.push('guideId wajib');
  if (!it.guideName)    errs.push('guideName wajib');
  if (it.guideId && namaResmi && !namaResmi[String(it.guideId).trim()]) {
    errs.push('guideId "' + it.guideId + '" tidak ada di tab Guides');
  }
  if ([1, 2, 3].indexOf(Number(it.pos)) === -1) errs.push('pos harus 1, 2, atau 3');
  if (!it.timestamp || isNaN(Date.parse(it.timestamp))) errs.push('timestamp harus ISO8601');
  if (!it.criteria || typeof it.criteria !== 'object') {
    errs.push('criteria wajib');
  } else {
    ['idCard', 'uniform'].forEach(function (k) {
      if (typeof it.criteria[k] !== 'boolean') errs.push('criteria.' + k + ' harus boolean');
    });
    var rv = Number(it.criteria.review);
    if (!isFinite(rv) || rv < 0) errs.push('criteria.review harus angka >= 0');
    // Etika BOLEH tidak dikirim dan dianggap 0. Perangkat yang belum sempat
    // memperbarui aplikasinya tetap bisa mengirim — kalau ini diwajibkan,
    // penilaiannya akan ditolak permanen dan datanya hilang.
    if (it.criteria.etika !== undefined && it.criteria.etika !== null) {
      var et = Number(it.criteria.etika);
      if (!isFinite(et) || et < 0) errs.push('criteria.etika harus angka >= 0');
    }
  }
  return errs;
}

/**
 * Peta guideId -> guideName dari tab Guides (termasuk yang nonaktif, supaya
 * penilaian atas guide yang baru dinonaktifkan tetap bisa masuk).
 * Disimpan sebentar di cache agar tidak dibaca ulang tiap kiriman.
 */
/** Kunci "satu pos satu kali sehari": guideId + pos + tanggal setempat. */
function kunciPos_(guideId, pos, tgl) {
  return String(guideId).trim() + '|' + (Number(pos) || 0) + '|' + tgl;
}

function petaGuides_() {
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  if (cache) {
    var simpan = cache.get('petaGuides');
    if (simpan) { try { return JSON.parse(simpan); } catch (e) {} }
  }

  var rows = sheet_(SHEET_GUIDES).getDataRange().getValues().slice(1);
  var peta = {};
  for (var i = 0; i < rows.length; i++) {
    var id = String(rows[i][0] || '').trim();
    if (id) peta[id] = String(rows[i][1] || '').trim();
  }
  if (cache) { try { cache.put('petaGuides', JSON.stringify(peta), 300); } catch (e) {} }
  return peta;
}


/**
 * Tulis ulang tab Guides dari GUIDES_AWAL.
 * Dipakai saat daftar guide diperbarui dari kantor. Data penilaian di tab
 * Evaluations TIDAK tersentuh.
 */
function resetGuides() {
  var ss = ss_();
  var g = ss.getSheetByName(SHEET_GUIDES) || ss.insertSheet(SHEET_GUIDES);
  g.clear();
  pasangHeader_(g, HEADER_GUIDES, [90, 230, 130, 110, 70]);
  g.getRange(2, 1, GUIDES_AWAL.length, HEADER_GUIDES.length).setValues(GUIDES_AWAL);
  SpreadsheetApp.flush();
  try { CacheService.getScriptCache().remove('petaGuides'); } catch (e) {}
  var pesan = GUIDES_AWAL.length + ' guide dimuat ke tab Guides.';
  Logger.log(pesan);
  return pesan;
}

/* ==================================================================
   REKAP BULANAN — meniru format "NILAI REWARD" yang dipakai selama ini
   ==================================================================
   Satu tab per regu per bulan:
     baris  = nama guide
     kolom  = tanggal x (UNI FORM, ID, REVIEW), lalu blok TOTAL berumus

   Penggabungan bila satu guide dinilai di beberapa pos pada hari sama:
     UNI FORM & ID : diambil yang PALING BURUK (0 mengalahkan 1)
     REVIEW        : diambil yang TERTINGGI, supaya review yang tercatat
                     di salah satu pos tidak terhapus
   Rincian per pos tetap bisa dilihat di tab "Rekap per Pos".
   ================================================================== */

var REGU_INFO = [
  { kode: 'A1', kategori: 'Asing',    nomor: 1 },
  { kode: 'A2', kategori: 'Asing',    nomor: 2 },
  { kode: 'D1', kategori: 'Domestik', nomor: 1 },
  { kode: 'D2', kategori: 'Domestik', nomor: 2 }
];

/** 'YYYY-MM' dari objek Date, memakai zona waktu spreadsheet. */
function kodeBulan_(d) {
  return Utilities.formatDate(d, ss_().getSpreadsheetTimeZone(), 'yyyy-MM');
}

/** 'YYYY-MM-DD' */
function kodeTanggal_(d) {
  return Utilities.formatDate(d, ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

/** Ubah kolom regu ("A1, D1") menjadi array kode. */
function pecahRegu_(teks) {
  return String(teks || '').split(',').map(function (x) { return x.trim(); })
    .filter(function (x) { return x; });
}

/** Baca tab Guides menjadi daftar objek. */
function bacaGuides_() {
  var rows = sheet_(SHEET_GUIDES).getDataRange().getValues().slice(1);
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    if (String(r[4]).toUpperCase() === 'FALSE') continue;
    out.push({
      guideId: String(r[0]).trim(),
      guideName: String(r[1]).trim(),
      kategori: String(r[2] || '').trim(),
      regu: pecahRegu_(r[3])
    });
  }
  return out;
}

/**
 * Rangkum penilaian satu bulan.
 * @return {{ harian: Object, perPos: Object, kehadiran: Object, tanggal: Array }}
 *   harian[guideId][tgl]    = { uniform, idCard, review }   (digabung lintas pos)
 *   perPos[guideId][pos]    = { jml, uniform, idCard, review }
 *   kehadiran[guideId][tgl] = berapa POS yang memeriksa guide itu hari itu (1..3)
 *
 * SATU POS BERNILAI SATU. Diperiksa berkali-kali di pos yang sama pada hari
 * yang sama tetap dihitung satu — pemeriksaan kedua biasanya koreksi, bukan
 * kehadiran tambahan. Karena itu penggabungan dilakukan pada tingkat
 * (guide, pos, tanggal) lebih dulu, baru dijumlahkan.
 */
function rangkumBulan_(bulan) {
  var sh = sheet_(SHEET_EVAL);
  var last = sh.getLastRow();
  var harian = {}, perPosHari = {}, setTanggal = {};
  if (last < 2) return { harian: harian, perPos: {}, kehadiran: {}, tanggal: [] };

  var data = sh.getRange(2, 1, last - 1, HEADER_EVAL.length).getValues();
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var waktu = new Date(r[1]);
    if (isNaN(waktu.getTime())) continue;
    if (kodeBulan_(waktu) !== bulan) continue;

    var tgl = kodeTanggal_(waktu);
    var pos = Number(r[2]) || 0;
    var gid = String(r[3]).trim();
    var uniform = Number(r[5]) ? 1 : 0;
    var idCard = Number(r[6]) ? 1 : 0;
    var review = Math.max(0, Number(r[7]) || 0);
    var etika = Math.max(0, Number(r[8]) || 0);

    setTanggal[tgl] = true;

    if (!harian[gid]) harian[gid] = {};
    var sel = harian[gid][tgl];
    if (!sel) {
      harian[gid][tgl] = { uniform: uniform, idCard: idCard, review: review, etika: etika };
    } else {
      sel.uniform = Math.min(sel.uniform, uniform);   // paling buruk
      sel.idCard = Math.min(sel.idCard, idCard);      // paling buruk
      sel.review = Math.max(sel.review, review);      // jangan hilangkan review
      sel.etika = Math.max(sel.etika, etika);         // jangan hilangkan etika
    }

    // Gabungan pada tingkat (guide, pos, tanggal) — dasar hitungan kehadiran
    if (!perPosHari[gid]) perPosHari[gid] = {};
    if (!perPosHari[gid][pos]) perPosHari[gid][pos] = {};
    var ph = perPosHari[gid][pos][tgl];
    if (!ph) {
      perPosHari[gid][pos][tgl] = { uniform: uniform, idCard: idCard, review: review, etika: etika };
    } else {
      ph.uniform = Math.min(ph.uniform, uniform);
      ph.idCard = Math.min(ph.idCard, idCard);
      ph.review = Math.max(ph.review, review);
      ph.etika = Math.max(ph.etika, etika);
    }
  }

  // Turunkan rincian per pos dan kehadiran harian dari gabungan di atas
  var perPos = {}, kehadiran = {};
  for (var g in perPosHari) {
    perPos[g] = {};
    kehadiran[g] = {};
    for (var p in perPosHari[g]) {
      var hari = perPosHari[g][p];
      var jml = 0, jUniform = 0, jIdCard = 0, jReview = 0, jEtika = 0;
      for (var t in hari) {
        jml++;                                   // satu hari di pos ini = satu kehadiran
        jUniform += hari[t].uniform;
        jIdCard += hari[t].idCard;
        jReview += hari[t].review;
        jEtika += hari[t].etika;
        kehadiran[g][t] = (kehadiran[g][t] || 0) + 1;
      }
      perPos[g][p] = { jml: jml, uniform: jUniform, idCard: jIdCard, review: jReview, etika: jEtika };
    }
  }

  var tanggal = Object.keys(setTanggal).sort();
  return { harian: harian, perPos: perPos, kehadiran: kehadiran, tanggal: tanggal };
}

function namaTabRekap_(kode, bulan) { return 'Rekap ' + kode + ' ' + bulan; }

/**
 * Kosongkan tab bila sudah ada, atau buat baru.
 *
 * Sel gabungan TIDAK ikut hilang oleh clear(), padahal jumlah kolom tanggal
 * berubah tiap hari. Sisa gabungan dari susunan kemarin bisa menggeser atau
 * menelan nilai yang ditulis hari ini, jadi dilepas dulu.
 */
function siapkanTab_(nama) {
  var ss = ss_();
  var sh = ss.getSheetByName(nama);
  if (sh) {
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
    sh.clear();
    sh.clearFormats();
  } else {
    sh = ss.insertSheet(nama);
  }
  return sh;
}

/** Label "kapan rekap ini dibangun", supaya rekap basi langsung ketahuan. */
function capWaktu_() {
  return 'Diperbarui: ' +
    Utilities.formatDate(new Date(), ss_().getSpreadsheetTimeZone(), 'd MMM yyyy HH:mm');
}

/** Bangun satu tab rekap untuk satu regu. */
function bangunRekapRegu_(info, bulan, ringkasan, guides) {
  var anggota = guides.filter(function (g) { return g.regu.indexOf(info.kode) > -1; })
    .sort(function (a, b) { return a.guideName.toLowerCase() < b.guideName.toLowerCase() ? -1 : 1; });

  // Hanya tanggal yang benar-benar ada penilaian bagi anggota regu ini
  var punya = {};
  anggota.forEach(function (g) {
    var h = ringkasan.harian[g.guideId];
    if (h) Object.keys(h).forEach(function (t) { punya[t] = true; });
  });
  var tanggal = Object.keys(punya).sort();

  var sh = siapkanTab_(namaTabRekap_(info.kode, bulan));
  var jmlKolom = 1 + (tanggal.length + 1) * 4;   // nama + (tanggal + TOTAL) x 4

  // --- baris 1: judul ---
  // Sengaja TIDAK di-merge: sel gabungan yang melintasi batas kolom beku
  // membuat setFrozenColumns gagal ("can't freeze columns which contain only
  // part of a merged cell"). Warna latar tetap dipasang di seluruh baris.
  sh.getRange(1, 1).setValue(
    'REKAP PENILAIAN GUIDE — ' + info.kategori.toUpperCase() +
    ' REGU ' + info.nomor + ' — ' + bulan);
  sh.getRange(1, 1, 1, jmlKolom)
    .setFontWeight('bold').setFontSize(12)
    .setFontColor('#FFFFFF').setBackground('#0B5D3B');
  // Cap waktu di ujung kanan baris judul — ikut terbeku bersama baris 1..3,
  // jadi selalu kelihatan walau digulir jauh ke bawah.
  sh.getRange(1, jmlKolom).setValue(capWaktu_())
    .setFontWeight('normal').setFontSize(9).setHorizontalAlignment('right');

  // --- baris 2: tanggal ---
  sh.getRange(2, 1).setValue('REGU: ' + info.nomor + ' (' + info.kategori + ')')
    .setFontWeight('bold');
  for (var i = 0; i < tanggal.length; i++) {
    var kol = 2 + i * 4;
    var bagian = tanggal[i].split('-');
    sh.getRange(2, kol, 1, 4).merge()
      .setValue('TGL: ' + Number(bagian[2]) + '-' + Number(bagian[1]) + '-' + bagian[0])
      .setHorizontalAlignment('center').setFontWeight('bold');
  }
  var kolTotal = 2 + tanggal.length * 4;
  sh.getRange(2, kolTotal, 1, 4).merge().setValue('TOTAL')
    .setHorizontalAlignment('center').setFontWeight('bold')
    .setBackground('#C8942B').setFontColor('#FFFFFF');

  // --- baris 3: sub-header ---
  var head = ['NAME'];
  for (var t = 0; t <= tanggal.length; t++) head.push('UNI FORM', 'ID', 'REVIEW', 'ETIKA');
  sh.getRange(3, 1, 1, head.length).setValues([head])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0B5D3B')
    .setHorizontalAlignment('center');

  // --- baris 5 dst: data ---
  var terisi = 0;                    // berapa sel harian yang benar-benar berisi
  if (anggota.length) {
    var baris = [];
    for (var a = 0; a < anggota.length; a++) {
      var g = anggota[a];
      var row = [g.guideName];
      var h = ringkasan.harian[g.guideId] || {};
      for (var d = 0; d < tanggal.length; d++) {
        var sel = h[tanggal[d]];
        if (sel) { row.push(sel.uniform, sel.idCard, sel.review, sel.etika || 0); terisi++; }
        else row.push('', '', '', '');   // kosong = tidak bertugas / tidak diperiksa
      }
      row.push('', '', '', '');          // tempat rumus TOTAL
      baris.push(row);
    }
    sh.getRange(5, 1, baris.length, head.length).setValues(baris);

    // Rumus TOTAL per kriteria — tetap hidup bila sel diperbaiki manual
    if (tanggal.length) {
      var rumus = [];
      for (var b = 0; b < anggota.length; b++) {
        var nb = 5 + b;
        var satu = [];
        for (var k = 0; k < 4; k++) {
          var sel2 = [];
          for (var dd = 0; dd < tanggal.length; dd++) {
            sel2.push(kolomHuruf_(2 + dd * 4 + k) + nb);
          }
          satu.push('=SUM(' + sel2.join(',') + ')');
        }
        rumus.push(satu);
      }
      sh.getRange(5, kolTotal, rumus.length, 4).setFormulas(rumus)
        .setFontWeight('bold').setBackground('#FFF6E0');
    }
  }

  sh.setFrozenRows(3);
  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 210);
  for (var c = 2; c <= jmlKolom; c++) sh.setColumnWidth(c, 58);
  return { anggota: anggota.length, terisi: terisi, tanggal: tanggal.length };
}

/** Nomor kolom -> huruf (1 -> A, 27 -> AA). */
function kolomHuruf_(n) {
  var s = '';
  while (n > 0) {
    var sisa = (n - 1) % 26;
    s = String.fromCharCode(65 + sisa) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Tab kehadiran harian — "satu pos bernilai satu".
 *
 * Baris  = seluruh guide aktif (yang belum pernah hadir pun ikut tercantum,
 *          supaya terlihat siapa yang tidak pernah diperiksa)
 * Kolom  = tanggal, berisi angka 1..3 = berapa pos yang memeriksa hari itu
 * Kosong = tidak hadir atau tidak diperiksa sama sekali hari itu
 */
function bangunRekapKehadiran_(bulan, ringkasan, guides) {
  var sh = siapkanTab_('Rekap Kehadiran ' + bulan);
  var tanggal = ringkasan.tanggal;
  var kolTotal = 3 + tanggal.length;             // NAME, REGU, tanggal..., lalu 2 kolom total
  var jmlKolom = kolTotal + 1;

  sh.getRange(1, 1).setValue('KEHADIRAN GUIDE — ' + bulan);
  sh.getRange(1, 1, 1, jmlKolom)
    .setFontWeight('bold').setFontSize(12)
    .setFontColor('#FFFFFF').setBackground('#0B5D3B');
  sh.getRange(1, jmlKolom).setValue(capWaktu_())
    .setFontWeight('normal').setFontSize(9).setHorizontalAlignment('right');

  sh.getRange(2, 1).setValue(
    'Angka = berapa pos yang memeriksa guide itu pada hari tersebut (maksimal 3). ' +
    'Diperiksa dua kali di pos yang sama pada hari yang sama tetap dihitung satu.')
    .setFontSize(9).setFontColor('#5C6360');

  var head = ['NAME', 'REGU'];
  for (var i = 0; i < tanggal.length; i++) {
    var bagian = tanggal[i].split('-');
    head.push(Number(bagian[2]) + '-' + Number(bagian[1]));
  }
  head.push('TOTAL POS', 'HARI HADIR');
  sh.getRange(3, 1, 1, head.length).setValues([head])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0B5D3B')
    .setHorizontalAlignment('center');

  var urut = guides.slice().sort(function (a, b) {
    return a.guideName.toLowerCase() < b.guideName.toLowerCase() ? -1 : 1;
  });

  var adaIsi = 0;
  if (urut.length) {
    var baris = [];
    for (var a = 0; a < urut.length; a++) {
      var g = urut[a];
      var k = ringkasan.kehadiran[g.guideId] || {};
      var row = [g.guideName, g.regu.join(', ')];
      for (var d = 0; d < tanggal.length; d++) {
        var n = k[tanggal[d]] || 0;
        row.push(n || '');                       // kosong, bukan 0, bila tidak hadir
        if (n) adaIsi++;
      }
      row.push('', '');                          // tempat rumus
      baris.push(row);
    }
    sh.getRange(5, 1, baris.length, head.length).setValues(baris);

    if (tanggal.length) {
      var awal = kolomHuruf_(3), akhir = kolomHuruf_(2 + tanggal.length);
      var rumus = [];
      for (var b = 0; b < baris.length; b++) {
        var nb = 5 + b;
        rumus.push([
          '=SUM(' + awal + nb + ':' + akhir + nb + ')',
          '=COUNTIF(' + awal + nb + ':' + akhir + nb + ',">0")'
        ]);
      }
      sh.getRange(5, kolTotal, rumus.length, 2).setFormulas(rumus)
        .setFontWeight('bold').setBackground('#FFF6E0');
    }

    // --- Baris penutup: dibaca MENURUN, menjawab "hari itu berapa guide hadir" ---
    // Tabel di atas dibaca menyamping (satu guide, banyak tanggal). Dua baris
    // ini kebalikannya: satu tanggal, berapa banyak guide.
    if (tanggal.length) {
      var barisAkhir = 4 + baris.length;
      var fJml = ['JUMLAH GUIDE HADIR', ''];
      var fPos = ['TOTAL KEHADIRAN POS', ''];
      for (var kc = 3; kc <= 2 + tanggal.length; kc++) {
        var h = kolomHuruf_(kc);
        fJml.push('=COUNTIF(' + h + '5:' + h + barisAkhir + ',">0")');
        fPos.push('=SUM(' + h + '5:' + h + barisAkhir + ')');
      }
      var hTotal = kolomHuruf_(kolTotal);
      fJml.push('=COUNTIF(' + hTotal + '5:' + hTotal + barisAkhir + ',">0")', '');
      fPos.push('=SUM(' + hTotal + '5:' + hTotal + barisAkhir + ')', '');

      var barisJml = barisAkhir + 2;
      // Label ditulis dengan setValues, RUMUS saja yang lewat setFormulas.
      // setFormulas memperlakukan setiap sel sebagai rumus — teks biasa akan
      // diberi "=" di depannya dan berubah menjadi #ERROR!.
      sh.getRange(barisJml, 1, 2, 2).setValues([
        [fJml[0], ''],
        [fPos[0], '']
      ]);
      sh.getRange(barisJml, 3, 2, jmlKolom - 2).setFormulas([
        fJml.slice(2),
        fPos.slice(2)
      ]);
      sh.getRange(barisJml, 1, 2, jmlKolom)
        .setFontWeight('bold').setBackground('#E7F3EC');
      sh.getRange(barisJml, 1, 2, 1).setHorizontalAlignment('left');
      // Kolom TOTAL POS pada baris pertama berarti "guide berbeda sebulan"
      sh.getRange(barisJml, kolTotal).setNote(
        'Berapa guide BERBEDA yang hadir sepanjang bulan ini — ' +
        'bukan penjumlahan angka harian, karena satu guide bisa hadir berkali-kali.');
    }
  }

  sh.setFrozenRows(3);
  sh.setFrozenColumns(2);
  sh.setColumnWidth(1, 210);
  sh.setColumnWidth(2, 90);
  for (var c = 3; c <= 2 + tanggal.length; c++) sh.setColumnWidth(c, 34);
  sh.setColumnWidth(kolTotal, 82);
  sh.setColumnWidth(kolTotal + 1, 82);
  return { baris: urut.length, terisi: adaIsi };
}

/** Tab rincian: capaian tiap guide dipisah per pos pemeriksaan. */
function bangunRekapPerPos_(bulan, ringkasan, guides) {
  var sh = siapkanTab_('Rekap per Pos ' + bulan);
  var head = ['NAME', 'REGU'];
  for (var p = 1; p <= 3; p++) {
    head.push('P' + p + ' Hadir', 'P' + p + ' Uniform', 'P' + p + ' ID', 'P' + p + ' Review', 'P' + p + ' Etika');
  }
  head.push('Total Kehadiran');

  sh.getRange(1, 1).setValue('RINCIAN PER POS PEMERIKSAAN — ' + bulan);
  sh.getRange(1, 1, 1, head.length)
    .setFontWeight('bold').setFontSize(12)
    .setFontColor('#FFFFFF').setBackground('#0B5D3B');
  sh.getRange(1, head.length).setValue(capWaktu_())
    .setFontWeight('normal').setFontSize(9).setHorizontalAlignment('right');
  sh.getRange(2, 1, 1, head.length).setValues([head])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0B5D3B')
    .setHorizontalAlignment('center');

  var baris = [];
  for (var i = 0; i < guides.length; i++) {
    var g = guides[i];
    var pp = ringkasan.perPos[g.guideId];
    if (!pp) continue;                       // hanya yang pernah dinilai bulan ini
    var row = [g.guideName, g.regu.join(', ')];
    var total = 0;
    for (var pos = 1; pos <= 3; pos++) {
      var d = pp[pos] || { jml: 0, uniform: 0, idCard: 0, review: 0, etika: 0 };
      row.push(d.jml, d.uniform, d.idCard, d.review, d.etika || 0);
      total += d.jml;
    }
    row.push(total);
    baris.push(row);
  }
  if (baris.length) {
    baris.sort(function (a, b) { return b[17] - a[17]; });   // paling sering dinilai di atas
    sh.getRange(3, 1, baris.length, head.length).setValues(baris);
  }
  sh.setFrozenRows(2);
  sh.setColumnWidth(1, 210);
  sh.setColumnWidth(2, 90);
  for (var c = 3; c <= head.length; c++) sh.setColumnWidth(c, 78);
  return baris.length;
}

/**
 * Susun ulang seluruh tab rekap untuk satu bulan.
 * @param {string=} bulan 'YYYY-MM'. Kosong = bulan berjalan.
 */
function bangunRekap(bulan) {
  bulan = bulan || kodeBulan_(new Date());
  var lock = LockService.getScriptLock();
  // Dilempar, bukan dikembalikan sebagai teks: pemanggilnya (rekapOtomatis)
  // harus tahu rekap TIDAK jadi disusun supaya bulan ini ditandai ulang.
  try { lock.waitLock(30000); } catch (e) { throw new Error('SIBUK: sedang dipakai proses lain'); }

  try {
    var guides = bacaGuides_();
    var ringkasan = rangkumBulan_(bulan);
    var hasil = [], totalTerisi = 0;
    for (var i = 0; i < REGU_INFO.length; i++) {
      var n = bangunRekapRegu_(REGU_INFO[i], bulan, ringkasan, guides);
      hasil.push(REGU_INFO[i].kode + ':' + n.anggota + '/' + n.terisi);
      totalTerisi += n.terisi;
    }
    var nPos = bangunRekapPerPos_(bulan, ringkasan, guides);
    var hadir = bangunRekapKehadiran_(bulan, ringkasan, guides);
    SpreadsheetApp.flush();

    // Pemeriksaan mandiri: ada penilaian bulan ini tapi tidak satu pun nilai
    // harian mendarat di tab regu = ada yang salah (mis. guideId di tab
    // Evaluations tidak ada di tab Guides). Lebih baik berteriak daripada
    // menampilkan rekap kosong yang disangka "memang belum ada data".
    var peringatan = '';
    if (ringkasan.tanggal.length && totalTerisi === 0) {
      peringatan = ' ⚠️ ADA PENILAIAN TAPI TIDAK ADA YANG MASUK REKAP —' +
                   ' periksa apakah guideId di tab Evaluations terdaftar di tab Guides.';
    }

    var pesan = 'Rekap ' + bulan + ' selesai. ' + hasil.join(' ') +
                ' (anggota/terisi) | tanggal terisi: ' + ringkasan.tanggal.length +
                ' | guide dinilai: ' + nPos +
                ' | kehadiran tercatat: ' + hadir.terisi + ' guide-hari' + peringatan;
    Logger.log(pesan);
    return pesan;
  } finally {
    lock.releaseLock();
  }
}

/* ================= Pembaruan otomatis ================= */
/**
 * Rekap TIDAK dibangun langsung di dalam doPost: menyusun empat tab regu
 * memakan waktu belasan detik, sedangkan aplikasi di lapangan menunggu balasan
 * dan akan menganggap penilaian gagal bila terlalu lama. Jadi doPost hanya
 * menitipkan "bulan mana yang berubah", lalu trigger tiap 5 menit yang
 * mengerjakannya.
 */
function tandaiRekapTertunda_(daftarBulan) {
  if (!daftarBulan || !daftarBulan.length) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var kumpul = {};
    String(props.getProperty(PROP_TERTUNDA) || '').split(',').forEach(function (b) {
      if (b) kumpul[b] = true;
    });
    daftarBulan.forEach(function (b) { if (b) kumpul[b] = true; });
    props.setProperty(PROP_TERTUNDA, Object.keys(kumpul).join(','));
  } catch (e) {
    Logger.log('gagal menandai rekap tertunda: ' + e);
  }
}

/** Dijalankan trigger tiap 5 menit. Tidak melakukan apa pun bila tak ada perubahan. */
function rekapOtomatis() {
  var props;
  try { props = PropertiesService.getScriptProperties(); } catch (e) { return; }
  var tertunda = String(props.getProperty(PROP_TERTUNDA) || '').split(',')
    .filter(function (b) { return b; });
  if (!tertunda.length) return;

  // Dibersihkan lebih dulu supaya penilaian yang masuk saat rekap sedang
  // disusun tetap tercatat sebagai perubahan baru untuk putaran berikutnya.
  props.deleteProperty(PROP_TERTUNDA);
  for (var i = 0; i < tertunda.length; i++) {
    try { bangunRekap(tertunda[i]); }
    catch (e) { Logger.log('rekapOtomatis ' + tertunda[i] + ': ' + e); tandaiRekapTertunda_([tertunda[i]]); }
  }
}

/** Dipanggil trigger harian — jaring pengaman kalau trigger 5 menit terlewat. */
function rekapHarian() {
  bangunRekap();
}

/* ================= Menu & trigger ================= */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Penilaian Guide')
    .addItem('Perbarui Rekap Bulan Ini', 'menuRekapSekarang')
    .addItem('Perbarui Rekap Bulan Lalu', 'menuRekapBulanLalu')
    .addSeparator()
    .addItem('Nyalakan Pembaruan Otomatis', 'pasangTriggerHarian')
    .addItem('Periksa Kesehatan Data', 'menuPeriksa')
    .addToUi();
}

/** Bungkus supaya kegagalan tampil sebagai pesan, bukan dialog error mentah. */
function jalankanRekap_(bulan) {
  try { return bangunRekap(bulan); }
  catch (e) { return 'Rekap tidak jadi disusun: ' + e.message; }
}

function menuRekapSekarang() {
  SpreadsheetApp.getUi().alert(jalankanRekap_());
}

function menuRekapBulanLalu() {
  var d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  SpreadsheetApp.getUi().alert(jalankanRekap_(kodeBulan_(d)));
}

/**
 * Pasang dua trigger sekaligus (yang lama dibuang dulu agar tidak menumpuk):
 *   - tiap 5 menit : menyusun ulang rekap HANYA bila ada penilaian baru
 *   - tiap malam   : jaring pengaman kalau trigger 5 menit sempat terlewat
 */
function pasangTriggerHarian() {
  var otomatis = ['rekapHarian', 'rekapOtomatis'];
  var lama = ScriptApp.getProjectTriggers();
  for (var i = 0; i < lama.length; i++) {
    if (otomatis.indexOf(lama[i].getHandlerFunction()) > -1) ScriptApp.deleteTrigger(lama[i]);
  }
  ScriptApp.newTrigger('rekapOtomatis').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('rekapHarian').timeBased().atHour(23).everyDays(1).create();

  var pesan = 'Pembaruan otomatis menyala.\n\n' +
              '• Rekap disusun ulang paling lambat 5 menit setelah penilaian masuk.\n' +
              '• Ditambah satu penyusunan menyeluruh tiap malam pukul 23.00.';
  try { SpreadsheetApp.getUi().alert(pesan); } catch (e) {}
  Logger.log(pesan);
  return pesan;
}

/**
 * Laporan singkat kondisi data — dipakai saat rekap terlihat kosong padahal
 * penilaian sudah dikirim dari lapangan.
 */
function periksaKesehatan() {
  var ev = sheet_(SHEET_EVAL);
  var last = ev.getLastRow();
  var jml = Math.max(0, last - 1);
  var peta = petaGuides_();
  var bulanIni = kodeBulan_(new Date());

  var yatim = {}, bulanan = {}, terbaru = '';
  if (jml) {
    var data = ev.getRange(2, 1, jml, HEADER_EVAL.length).getValues();
    for (var i = 0; i < data.length; i++) {
      var gid = String(data[i][3]).trim();
      if (!peta[gid]) yatim[gid] = (yatim[gid] || 0) + 1;
      var w = new Date(data[i][1]);
      if (!isNaN(w.getTime())) {
        var b = kodeBulan_(w);
        bulanan[b] = (bulanan[b] || 0) + 1;
        if (String(data[i][1]) > terbaru) terbaru = String(data[i][1]);
      }
    }
  }

  var idYatim = Object.keys(yatim);
  var baris = [
    'Total penilaian tersimpan : ' + jml,
    'Penilaian bulan ini (' + bulanIni + ') : ' + (bulanan[bulanIni] || 0),
    'Penilaian terakhir masuk  : ' + (terbaru || '—'),
    'Trigger otomatis aktif    : ' + ScriptApp.getProjectTriggers()
      .filter(function (t) { return t.getHandlerFunction() === 'rekapOtomatis'; }).length + ' buah',
    'Guide terdaftar di tab Guides : ' + Object.keys(peta).length,
    idYatim.length
      ? '⚠️ guideId tidak dikenal  : ' + idYatim.join(', ') + ' — baris ini tidak akan muncul di rekap'
      : '✅ Semua guideId dikenal — tidak ada baris yang tercecer'
  ].join('\n');

  Logger.log(baris);
  return baris;
}

function menuPeriksa() {
  SpreadsheetApp.getUi().alert(periksaKesehatan() + '\n\n' + jalankanRekap_());
}

/* ================= Uji mandiri (opsional) ================= */
/**
 * Jalankan fungsi ini dari editor Apps Script untuk memastikan tulis-baca
 * berfungsi tanpa perlu membuka aplikasi. Baris ujinya dihapus lagi di akhir.
 */
function ujiCepat() {
  var id = 'TEST-' + new Date().getTime();
  var res = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    evaluationId: id,
    guideId: 'G-001',
    guideName: 'Gusti Alit Astawa',
    pos: 1,
    timestamp: new Date().toISOString(),
    criteria: { idCard: true, uniform: false, review: 2 },
    catatan: 'baris uji otomatis'
  }) } }).getContent());

  var ulang = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    evaluationId: id, guideId: 'G-001', guideName: 'Gusti Alit Astawa', pos: 1,
    timestamp: new Date().toISOString(),
    criteria: { idCard: true, uniform: false, review: 2 }
  }) } }).getContent());

  var salah = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    guideId: 'G-002', pos: 9, criteria: { idCard: 'ya', review: -1 }
  }) } }).getContent());

  var guides = JSON.parse(doGet({ parameter: { action: 'guides' } }).getContent());

  // bersihkan baris uji
  var sh = sheet_(SHEET_EVAL);
  var kol = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();
  for (var i = kol.length - 1; i >= 0; i--) {
    if (String(kol[i][0]) === id) sh.deleteRow(i + 2);
  }

  var hasil = [
    'tulis pertama  : ' + (res.accepted.length === 1 && !res.accepted[0].duplicate ? 'OK' : 'GAGAL'),
    'kirim ulang    : ' + (ulang.accepted.length === 1 && ulang.accepted[0].duplicate ? 'OK (tidak ganda)' : 'GAGAL'),
    'data tidak sah : ' + (salah.rejected.length === 1 && salah.accepted.length === 0 ? 'OK (ditolak)' : 'GAGAL'),
    'daftar guide   : ' + guides.guides.length + ' guide aktif',
    'baris uji sudah dihapus kembali.'
  ].join('\n');

  Logger.log(hasil);
  return hasil;
}
