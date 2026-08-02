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
 *     → Tab Guides, Evaluations, dan Petunjuk akan dibuat otomatis.
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
 * ============================================================
 */

var SHEET_EVAL    = 'Evaluations';
var SHEET_GUIDES  = 'Guides';
var SHEET_INFO    = 'Petunjuk';

var HEADER_EVAL   = ['evaluationId', 'timestamp', 'pos', 'guideId', 'guideName',
                     'idCard', 'uniform', 'etika', 'catatan', 'receivedAt'];
var HEADER_GUIDES = ['guideId', 'guideName', 'kategori', 'regu', 'aktif'];

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
    pasangHeader_(e, HEADER_EVAL, [290, 190, 50, 90, 200, 80, 80, 80, 240, 190]);
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

  return 'Setup selesai. Lanjut ke Deploy → New deployment → Web app.';
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
    var idAda = {};
    if (last > 1) {
      var kol = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < kol.length; i++) idAda[String(kol[i][0])] = true;
    }

    var baris = [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var errs = validasi_(it);
      if (errs.length) {
        rejected.push({ evaluationId: (it && it.evaluationId) || null, errors: errs });
        continue;
      }
      if (idAda[String(it.evaluationId)]) {
        accepted.push({ evaluationId: it.evaluationId, synced: true, duplicate: true });
        continue;
      }
      baris.push([
        String(it.evaluationId),
        String(it.timestamp),
        Number(it.pos),
        String(it.guideId),
        String(it.guideName),
        !!it.criteria.idCard,
        !!it.criteria.uniform,
        !!it.criteria.etika,
        String(it.catatan || ''),
        new Date().toISOString()
      ]);
      idAda[String(it.evaluationId)] = true;
      accepted.push({ evaluationId: it.evaluationId, synced: true, duplicate: false });
    }

    if (baris.length) {
      sh.getRange(sh.getLastRow() + 1, 1, baris.length, HEADER_EVAL.length).setValues(baris);
      SpreadsheetApp.flush();
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

function validasi_(it) {
  var errs = [];
  if (!it || typeof it !== 'object') return ['body bukan objek'];
  if (!it.evaluationId) errs.push('evaluationId wajib');
  if (!it.guideId)      errs.push('guideId wajib');
  if (!it.guideName)    errs.push('guideName wajib');
  if ([1, 2, 3].indexOf(Number(it.pos)) === -1) errs.push('pos harus 1, 2, atau 3');
  if (!it.timestamp || isNaN(Date.parse(it.timestamp))) errs.push('timestamp harus ISO8601');
  if (!it.criteria || typeof it.criteria !== 'object') {
    errs.push('criteria wajib');
  } else {
    ['idCard', 'uniform', 'etika'].forEach(function (k) {
      if (typeof it.criteria[k] !== 'boolean') errs.push('criteria.' + k + ' harus boolean');
    });
  }
  return errs;
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
  var pesan = GUIDES_AWAL.length + ' guide dimuat ke tab Guides.';
  Logger.log(pesan);
  return pesan;
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
    criteria: { idCard: true, uniform: false, etika: true },
    catatan: 'baris uji otomatis'
  }) } }).getContent());

  var ulang = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    evaluationId: id, guideId: 'G-001', guideName: 'Gusti Alit Astawa', pos: 1,
    timestamp: new Date().toISOString(),
    criteria: { idCard: true, uniform: false, etika: true }
  }) } }).getContent());

  var salah = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    guideId: 'G-002', pos: 9, criteria: { idCard: 'ya' }
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
