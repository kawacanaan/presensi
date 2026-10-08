/**
 * Utility untuk menyederhanakan dan merapikan gelar/jabatan tanda tangan Guru Mata Pelajaran
 * pada hasil cetak laporan / printout absensi sekolah dasar.
 *
 * Contoh:
 * - "Pendidikan Jasmani, Olahraga & Kesehatan (PJOK)" -> "Guru PJOK"
 * - "Pendidikan Agama & Budi Pekerti (PABP)" -> "Guru PABP"
 * - "Pendidikan Lingkungan dan Budaya Jakarta (PLBJ)" -> "Guru PLBJ"
 * - "Seni Budaya & Prakarya (SBdP)" -> "Guru SBdP"
 * - "Bahasa Inggris" -> "Guru Bahasa Inggris" (pengecualian tetap lengkap)
 */

export function formatSubjectTeacherTitle(rawSubjectName?: string | null): string {
  if (!rawSubjectName || !rawSubjectName.trim()) {
    return 'Guru Mata Pelajaran';
  }

  const name = rawSubjectName.trim();
  const lower = name.toLowerCase();

  // 1. PJOK (Pendidikan Jasmani, Olahraga & Kesehatan)
  if (
    lower.includes('pjok') ||
    lower.includes('jasmani') ||
    lower.includes('olahraga') ||
    lower.includes('penjas')
  ) {
    return 'Guru PJOK';
  }

  // 2. PABP / PAI / Pendidikan Agama & Budi Pekerti
  if (
    lower.includes('pabp') ||
    lower.includes('budi pekerti') ||
    lower.includes('agama & budi') ||
    lower.includes('agama dan budi') ||
    lower.includes('pendidikan agama islam') ||
    lower.includes('pai')
  ) {
    if (lower.includes('kristen')) return 'Guru PABP (Kristen)';
    if (lower.includes('katolik')) return 'Guru PABP (Katolik)';
    if (lower.includes('hindu')) return 'Guru PABP (Hindu)';
    if (lower.includes('buddha') || lower.includes('budha')) return 'Guru PABP (Buddha)';
    if (lower.includes('konghucu')) return 'Guru PABP (Konghucu)';
    return 'Guru PABP';
  }

  // 3. PLBJ (Pendidikan Lingkungan dan Budaya Jakarta)
  if (
    lower.includes('plbj') ||
    lower.includes('budaya jakarta') ||
    lower.includes('lingkungan dan budaya jakarta') ||
    lower.includes('lingkungan & budaya jakarta')
  ) {
    return 'Guru PLBJ';
  }

  // 4. SBdP (Seni Budaya & Prakarya)
  if (
    lower.includes('sbdp') ||
    lower.includes('seni budaya') ||
    lower.includes('prakarya')
  ) {
    return 'Guru SBdP';
  }

  // 5. Pengecualian khusus: Bahasa Inggris tetap "Guru Bahasa Inggris"
  if (lower.includes('inggris') || lower.includes('english')) {
    return 'Guru Bahasa Inggris';
  }

  // 6. Bahasa Daerah / Muatan Lokal (Mulok)
  if (
    lower.includes('bahasa daerah') ||
    lower.includes('sunda') ||
    lower.includes('jawa') ||
    lower.includes('mulok') ||
    lower.includes('muatan lokal')
  ) {
    if (lower.includes('sunda')) return 'Guru Bahasa Sunda';
    if (lower.includes('jawa')) return 'Guru Bahasa Jawa';
    if (lower.includes('bali')) return 'Guru Bahasa Bali';
    return 'Guru Muatan Lokal';
  }

  // 7. PPKn / Pendidikan Pancasila
  if (
    lower.includes('ppkn') ||
    lower.includes('pancasila') ||
    lower.includes('kewarganegaraan')
  ) {
    return 'Guru Pendidikan Pancasila';
  }

  // 8. IPAS (Ilmu Pengetahuan Alam dan Sosial)
  if (lower.includes('ipas') || (lower.includes('alam') && lower.includes('sosial'))) {
    return 'Guru IPAS';
  }

  // 9. Matematika
  if (lower.includes('matematika') || lower.includes('mtk')) {
    return 'Guru Matematika';
  }

  // 10. Bahasa Indonesia
  if (lower.includes('bahasa indonesia')) {
    return 'Guru Bahasa Indonesia';
  }

  // 11. Jika terdapat singkatan dalam tanda kurung, misal "Teknologi Informasi & Komunikasi (TIK)" -> "Guru TIK"
  const matchParen = name.match(/\(([^)]+)\)/);
  if (matchParen && matchParen[1] && matchParen[1].length <= 6) {
    return `Guru ${matchParen[1].toUpperCase()}`;
  }

  // 12. Fallback bersih
  const cleanName = name
    .replace(/^mata\s+pelajaran\s+/i, '')
    .replace(/^mapel\s+/i, '')
    .trim();

  return `Guru ${cleanName}`;
}

/**
 * Utility untuk memformat label Tugas Utama Wali Kelas pada tabel data guru & profil.
 * Mencegah duplikasi kata "Kelas" (misal: "Wali Kelas Kelas 2" -> "Wali Kelas 2").
 *
 * Contoh:
 * - "Kelas 2" -> "Wali Kelas 2"
 * - "Kelas 2A" -> "Wali Kelas 2A"
 * - "2" -> "Wali Kelas 2"
 * - "Kelas 6B" -> "Wali Kelas 6B"
 * - "" atau null -> "Wali Kelas"
 */
export function formatHomeroomDutyLabel(rawClassName?: string | null): string {
  if (!rawClassName || !rawClassName.trim()) {
    return 'Wali Kelas';
  }

  const name = rawClassName.trim();
  const lower = name.toLowerCase();

  if (lower === 'semua kelas' || lower === 'semua' || lower === 'all') {
    return 'Wali Kelas';
  }

  // Bersihkan prefiks kata "Kelas" atau "kelas" yang sudah ada
  const cleanClassName = name.replace(/^kelas\s+/i, '').trim();

  if (!cleanClassName) {
    return 'Wali Kelas';
  }

  return `Wali Kelas ${cleanClassName}`;
}

/**
 * Utility untuk memformat label Tugas Utama Guru Mapel pada tabel data guru.
 * Menyederhanakan penamaan mapel yang panjang menjadi akronim/nama baku ringkas
 * dengan awalan "Guru Mapel" dan tanpa embel-embel daftar kelas
 * (misal: "Pendidikan Jasmani Olahraga dan Kesehatan (Kelas 6B, Kelas 6A)" -> "Guru Mapel PJOK").
 *
 * Contoh:
 * - "Pendidikan Jasmani Olahraga dan Kesehatan" -> "Guru Mapel PJOK"
 * - "Pendidikan Agama & Budi Pekerti (PABP)" -> "Guru Mapel PABP"
 * - "Pendidikan Agama Islam" -> "Guru Mapel PAI"
 * - "Pendidikan Lingkungan dan Budaya Jakarta" -> "Guru Mapel PLBJ"
 * - "Seni Budaya & Prakarya" -> "Guru Mapel SBdP"
 * - "Bahasa Inggris" -> "Guru Mapel Bahasa Inggris"
 */
export function formatSubjectTeacherDutyLabel(
  rawSubjectName?: string | null,
  rawSubjectCode?: string | null
): string {
  // Jika ada subject code spesifik (misal PJOK, PABP, PAI, SBdP, PLBJ, TIK, IPAS, MTK)
  const code = (rawSubjectCode || '').trim();
  const codeLower = code.toLowerCase();

  if (code) {
    if (codeLower === 'pjok') return 'Guru Mapel PJOK';
    if (codeLower === 'pai') return 'Guru Mapel PAI';
    if (codeLower === 'pak') return 'Guru Mapel PAK';
    if (codeLower === 'koding') return 'Guru Mapel KODING';
    if (codeLower === 'pabp') return 'Guru Mapel PABP';
    if (codeLower === 'plbj') return 'Guru Mapel PLBJ';
    if (codeLower === 'sbdp') return 'Guru Mapel SBdP';
    if (codeLower === 'ipas') return 'Guru Mapel IPAS';
    if (codeLower === 'mtk') return 'Guru Mapel Matematika';
    if (codeLower === 'tik') return 'Guru Mapel TIK';
    if (codeLower === 'inggris' || codeLower === 'bing' || codeLower === 'b. inggris' || codeLower === 'b.inggris') return 'Guru Mapel Bahasa Inggris';
    if (codeLower === 'sunda' || codeLower === 'b. sunda' || codeLower === 'b.sunda') return 'Guru Mapel Bahasa Sunda';
    if (codeLower === 'jawa' || codeLower === 'b. jawa' || codeLower === 'b.jawa') return 'Guru Mapel Bahasa Jawa';
    if (codeLower === 'indonesia' || codeLower === 'bind') return 'Guru Mapel Bahasa Indonesia';
    if (codeLower === 'ppkn') return 'Guru Mapel PPKn';
  }

  if (!rawSubjectName || !rawSubjectName.trim()) {
    return 'Guru Mapel';
  }

  const name = rawSubjectName.trim();
  const lower = name.toLowerCase();

  // 1. PJOK (Pendidikan Jasmani, Olahraga & Kesehatan)
  if (
    lower.includes('pjok') ||
    lower.includes('jasmani') ||
    lower.includes('olahraga') ||
    lower.includes('penjas')
  ) {
    return 'Guru Mapel PJOK';
  }

  // 2. PAI / PABP (Pendidikan Agama dan Budi Pekerti)
  if (
    lower.includes('pabp') ||
    lower.includes('budi pekerti') ||
    lower.includes('agama & budi') ||
    lower.includes('agama dan budi') ||
    lower.includes('pendidikan agama islam') ||
    lower.includes('pai')
  ) {
    if (lower.includes('kristen')) return 'Guru Mapel PABP (Kristen)';
    if (lower.includes('katolik')) return 'Guru Mapel PABP (Katolik)';
    if (lower.includes('hindu')) return 'Guru Mapel PABP (Hindu)';
    if (lower.includes('buddha') || lower.includes('budha')) return 'Guru Mapel PABP (Buddha)';
    if (lower.includes('konghucu')) return 'Guru Mapel PABP (Konghucu)';
    if (lower.includes('islam') || lower.includes('pai')) return 'Guru Mapel PAI';
    return 'Guru Mapel PABP';
  }

  // 3. PLBJ (Pendidikan Lingkungan dan Budaya Jakarta)
  if (
    lower.includes('plbj') ||
    lower.includes('budaya jakarta') ||
    lower.includes('lingkungan dan budaya jakarta') ||
    lower.includes('lingkungan & budaya jakarta')
  ) {
    return 'Guru Mapel PLBJ';
  }

  // 4. SBdP (Seni Budaya dan Prakarya)
  if (
    lower.includes('sbdp') ||
    lower.includes('seni budaya') ||
    lower.includes('prakarya') ||
    lower.includes('seni rupa') ||
    lower.includes('seni musik') ||
    lower.includes('seni tari') ||
    lower.includes('seni teater')
  ) {
    if (lower.includes('sbdp')) return 'Guru Mapel SBdP';
    if (lower.includes('seni rupa')) return 'Guru Mapel Seni Rupa';
    if (lower.includes('seni musik')) return 'Guru Mapel Seni Musik';
    if (lower.includes('seni tari')) return 'Guru Mapel Seni Tari';
    if (lower.includes('seni teater')) return 'Guru Mapel Seni Teater';
    return 'Guru Mapel SBdP';
  }

  // 5. Bahasa Inggris
  if (lower.includes('inggris') || lower.includes('english')) {
    return 'Guru Mapel Bahasa Inggris';
  }

  // 6. Bahasa Daerah / Muatan Lokal
  if (
    lower.includes('bahasa daerah') ||
    lower.includes('sunda') ||
    lower.includes('jawa') ||
    lower.includes('mulok') ||
    lower.includes('muatan lokal')
  ) {
    if (lower.includes('sunda')) return 'Guru Mapel Bahasa Sunda';
    if (lower.includes('jawa')) return 'Guru Mapel Bahasa Jawa';
    if (lower.includes('bali')) return 'Guru Mapel Bahasa Bali';
    return 'Guru Mapel Muatan Lokal';
  }

  // 7. PPKn / Pendidikan Pancasila
  if (
    lower.includes('ppkn') ||
    lower.includes('pancasila') ||
    lower.includes('kewarganegaraan')
  ) {
    return 'Guru Mapel PPKn';
  }

  // 8. IPAS (Ilmu Pengetahuan Alam dan Sosial)
  if (lower.includes('ipas') || (lower.includes('alam') && lower.includes('sosial'))) {
    return 'Guru Mapel IPAS';
  }

  // 9. Matematika
  if (lower.includes('matematika') || lower.includes('mtk')) {
    return 'Guru Mapel Matematika';
  }

  // 10. Bahasa Indonesia
  if (lower.includes('bahasa indonesia')) {
    return 'Guru Mapel Bahasa Indonesia';
  }

  // 11. Singkatan dalam tanda kurung, misal "Teknologi Informasi & Komunikasi (TIK)" -> "Guru Mapel TIK"
  const matchParen = name.match(/\(([^)]+)\)/);
  if (matchParen && matchParen[1] && matchParen[1].length <= 8) {
    return `Guru Mapel ${matchParen[1].toUpperCase()}`;
  }

  // 12. Fallback bersih
  const cleanName = name
    .replace(/^mata\s+pelajaran\s+/i, '')
    .replace(/^mapel\s+/i, '')
    .replace(/^guru\s+mapel\s+/i, '')
    .replace(/^guru\s+/i, '')
    .replace(/\s*\([^)]*\)/g, '') // hilangkan kurung kelas jika ada
    .trim();

  return `Guru Mapel ${cleanName || 'Mapel'}`;
}

/**
 * Utility untuk memformat gelar/jabatan tanda tangan Guru Kelas / Wali Kelas
 * pada hasil cetak laporan / printout absensi sekolah dasar.
 *
 * Mencegah kata "Kelas" menjadi double/duplikat (misal: "Guru Kelas Kelas 5" -> "Guru Kelas 5").
 *
 * Contoh:
 * - "Kelas 5" -> "Guru Kelas 5 / Wali Kelas"
 * - "5" -> "Guru Kelas 5 / Wali Kelas"
 * - "Kelas 5A" -> "Guru Kelas 5A / Wali Kelas"
 * - "Semua Kelas" atau null -> "Guru Kelas / Wali Kelas"
 */
export function formatHomeroomTeacherTitle(rawClassName?: string | null): string {
  if (!rawClassName || !rawClassName.trim()) {
    return 'Guru Kelas / Wali Kelas';
  }

  const name = rawClassName.trim();
  const lower = name.toLowerCase();

  if (lower === 'semua kelas' || lower === 'semua' || lower === 'all') {
    return 'Guru Kelas / Wali Kelas';
  }

  // Bersihkan prefiks kata "Kelas" atau "kelas" yang sudah ada
  const cleanClassName = name.replace(/^kelas\s*/i, '').trim();

  if (!cleanClassName) {
    return 'Guru Kelas / Wali Kelas';
  }

  return `Guru Kelas ${cleanClassName} / Wali Kelas`;
}
