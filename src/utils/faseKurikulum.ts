/**
 * Logika Fase Kurikulum Merdeka Jenjang Sekolah Dasar (SD)
 * - Kelas 1 & 2 -> Fase A
 * - Kelas 3 & 4 -> Fase B
 * - Kelas 5 & 6 -> Fase C
 */

export type FaseKurikulum = 'Fase A' | 'Fase B' | 'Fase C';

/**
 * Mendapatkan Fase berdasarkan angka tingkat kelas (1 - 6)
 */
export function getFaseByGrade(grade: number | string | null | undefined): FaseKurikulum {
  const num = typeof grade === 'string' ? parseInt(grade, 10) : Number(grade);
  if (num === 1 || num === 2) return 'Fase A';
  if (num === 3 || num === 4) return 'Fase B';
  if (num === 5 || num === 6) return 'Fase C';
  return 'Fase A'; // default fallback
}

/**
 * Ekstrak angka tingkat kelas (1-6) dari nama kelas (misal: "Kelas 1A" -> 1, "4B" -> 4, "Kelas VI" -> 6)
 */
export function getGradeFromClassName(className: string | null | undefined): number {
  if (!className) return 1;
  const str = className.trim();

  // Cek angka 1-6 langsung
  const matchNum = str.match(/\b([1-6])\b/) || str.match(/([1-6])/);
  if (matchNum) {
    return parseInt(matchNum[1], 10);
  }

  // Cek angka Romawi I - VI
  if (/\bVI\b/i.test(str)) return 6;
  if (/\bV\b/i.test(str)) return 5;
  if (/\bIV\b/i.test(str)) return 4;
  if (/\bIII\b/i.test(str)) return 3;
  if (/\bII\b/i.test(str)) return 2;
  if (/\bI\b/i.test(str)) return 1;

  return 1;
}

/**
 * Mendapatkan Fase dari nama kelas atau nilai grade eksplisit
 */
export function getFaseByClassName(
  className: string | null | undefined,
  explicitGrade?: number | null
): FaseKurikulum {
  if (explicitGrade && explicitGrade >= 1 && explicitGrade <= 6) {
    return getFaseByGrade(explicitGrade);
  }
  const grade = getGradeFromClassName(className);
  return getFaseByGrade(grade);
}

/**
 * Mendapatkan warna styling badge untuk masing-masing fase
 */
export function getFaseBadgeColor(fase: FaseKurikulum | string) {
  if (fase === 'Fase A') {
    return {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800',
      dot: 'bg-emerald-500',
      label: 'Fase A (Kelas 1 - 2)',
    };
  }
  if (fase === 'Fase B') {
    return {
      bg: 'bg-blue-50 text-blue-800 border-blue-200',
      badge: 'bg-blue-100 text-blue-800',
      dot: 'bg-blue-500',
      label: 'Fase B (Kelas 3 - 4)',
    };
  }
  return {
    bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-800',
    dot: 'bg-indigo-500',
    label: 'Fase C (Kelas 5 - 6)',
  };
}

/**
 * Format nama kelas untuk display dengan kata "Kelas" di depannya TANPA duplikasi
 * Contoh: "1A" -> "Kelas 1A", "Kelas 1A" -> "Kelas 1A", "kelas 6" -> "Kelas 6"
 */
export function formatClassDisplay(className: string | null | undefined, fallback = 'Semua Kelas'): string {
  if (!className) return fallback;
  const trimmed = className.trim();
  if (/^kelas\s+/i.test(trimmed)) {
    // Pastikan huruf kapital pada 'Kelas'
    return trimmed.replace(/^kelas\s+/i, 'Kelas ');
  }
  return `Kelas ${trimmed}`;
}

/**
 * Format nama kelas TANPA kata "Kelas" di depannya
 * Contoh: "Kelas 1A" -> "1A", "1A" -> "1A"
 */
export function formatClassClean(className: string | null | undefined, fallback = '6A'): string {
  if (!className) return fallback;
  const cleaned = className.trim().replace(/^kelas\s+/i, '');
  return cleaned || fallback;
}
