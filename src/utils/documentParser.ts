import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

// Configure pdfjs-dist
let pdfjsLib: any = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    try {
      if (pdfjsLib.GlobalWorkerOptions) {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
          ).toString();
        } catch {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.3.289'}/build/pdf.worker.min.mjs`;
        }
      }
    } catch (e) {
      console.warn('[documentParser] Unable to set pdfjs workerSrc:', e);
    }
  }
  return pdfjsLib;
}

export interface ParsedDocumentResult {
  fileName: string;
  fileType: 'excel' | 'csv' | 'docx' | 'pdf' | 'text';
  rows: string[][];
  rawText: string;
}

export interface ParsedTeacherItem {
  nama: string;
  nip: string;
  jenisKelamin: 'L' | 'P';
  tugasUtama: string;
  isValid: boolean;
  error?: string;
}

export interface ParsedStudentItem {
  nama: string;
  gender: 'L' | 'P';
  nisn: string;
  classNameInput?: string;
  matchedClassId?: string | null;
  matchedClassName?: string;
  isValid: boolean;
  error?: string;
}

/**
 * Extract rows and raw text from Excel (.xlsx, .xls)
 */
export async function parseExcelFile(file: File): Promise<ParsedDocumentResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to 2D string array
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
  const rows: string[][] = rawRows
    .map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []))
    .filter((row) => row.some((cell) => cell.length > 0));

  const rawText = rows.map((r) => r.join('\t')).join('\n');

  return {
    fileName: file.name,
    fileType: 'excel',
    rows,
    rawText,
  };
}

/**
 * Extract rows and raw text from CSV / TSV text
 */
export async function parseCsvFile(file: File): Promise<ParsedDocumentResult> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const splitLine = (line: string): string[] => {
    let delimiter = ',';
    if (line.includes('\t')) delimiter = '\t';
    else if (line.includes(';')) delimiter = ';';

    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        tokens.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    tokens.push(current.trim().replace(/^["']|["']$/g, ''));
    return tokens;
  };

  const rows: string[][] = lines.map(splitLine).filter((r) => r.some((c) => c.length > 0));

  return {
    fileName: file.name,
    fileType: 'csv',
    rows,
    rawText: text,
  };
}

/**
 * Extract rows and raw text from Word (.docx)
 * Extracts HTML tables if present, otherwise falls back to paragraphs.
 */
export async function parseDocxFile(file: File): Promise<ParsedDocumentResult> {
  const arrayBuffer = await file.arrayBuffer();

  // First attempt: Convert to HTML to preserve <table> structures
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const html = htmlResult.value || '';

  const rows: string[][] = [];

  if (html.includes('<table')) {
    // Parse table elements in browser DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tables = doc.querySelectorAll('table');

    tables.forEach((table) => {
      const trs = table.querySelectorAll('tr');
      trs.forEach((tr) => {
        const cells: string[] = [];
        const tds = tr.querySelectorAll('td, th');
        tds.forEach((td) => {
          cells.push((td.textContent || '').trim());
        });
        if (cells.some((c) => c.length > 0)) {
          rows.push(cells);
        }
      });
    });
  }

  // Fallback: If no tables found or empty, extract raw text
  let rawText = '';
  if (rows.length === 0) {
    const rawResult = await mammoth.extractRawText({ arrayBuffer });
    rawText = rawResult.value || '';
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    lines.forEach((line) => {
      const tokens = line.split(/[\t;,]/).map((t) => t.trim());
      if (tokens.some((c) => c.length > 0)) {
        rows.push(tokens);
      }
    });
  } else {
    rawText = rows.map((r) => r.join('\t')).join('\n');
  }

  return {
    fileName: file.name,
    fileType: 'docx',
    rows,
    rawText,
  };
}

/**
 * Extract rows and raw text from PDF (.pdf)
 * Groups text items by vertical Y coordinates into lines, then sorts by horizontal X coordinates.
 */
export async function parsePdfFile(file: File): Promise<ParsedDocumentResult> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const allRows: string[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as any[];

    if (!items || items.length === 0) continue;

    interface TextItem {
      text: string;
      x: number;
      y: number;
    }

    const textItems: TextItem[] = items
      .filter((it) => it.str && it.str.trim().length > 0)
      .map((it) => ({
        text: it.str.trim(),
        x: it.transform ? it.transform[4] : 0,
        y: it.transform ? it.transform[5] : 0,
      }));

    // Sort items top-to-bottom (Y desc in PDF), then left-to-right (X asc)
    textItems.sort((a, b) => {
      if (Math.abs(b.y - a.y) > 4) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

    // Group into visual lines
    const lines: TextItem[][] = [];
    let currentLine: TextItem[] = [];
    let currentY: number | null = null;

    textItems.forEach((item) => {
      if (currentY === null || Math.abs(item.y - currentY) <= 5) {
        currentLine.push(item);
        if (currentY === null) currentY = item.y;
      } else {
        lines.push(currentLine);
        currentLine = [item];
        currentY = item.y;
      }
    });
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    // Convert each line into cells
    lines.forEach((line) => {
      line.sort((a, b) => a.x - b.x);
      const cells = line.map((it) => it.text);
      if (cells.length > 0) {
        allRows.push(cells);
      }
    });
  }

  const rawText = allRows.map((r) => r.join('\t')).join('\n');

  return {
    fileName: file.name,
    fileType: 'pdf',
    rows: allRows,
    rawText,
  };
}

/**
 * Universal file reader for Excel, CSV, Word, and PDF
 */
export async function parseImportDocument(file: File): Promise<ParsedDocumentResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelFile(file);
  }
  if (ext === 'docx') {
    return parseDocxFile(file);
  }
  if (ext === 'pdf') {
    return parsePdfFile(file);
  }
  // Default to CSV / Text
  return parseCsvFile(file);
}

/**
 * Helper: Normalisasi gender L / P
 */
export function normalizeGender(genderRaw: string): 'L' | 'P' {
  const gUpper = (genderRaw || '').trim().toUpperCase();
  if (
    gUpper === 'P' ||
    gUpper.startsWith('PEREMPUAN') ||
    gUpper.startsWith('PUTRI') ||
    gUpper.startsWith('WANITA') ||
    gUpper === 'F' ||
    gUpper === 'FEMALE' ||
    gUpper === 'W'
  ) {
    return 'P';
  }
  return 'L';
}

/**
 * Helper: Normalisasi string kelas untuk pencocokan akurat (mendukung angka Romawi & variasi tanda baca)
 */
export function normalizeClassToken(input: string): string {
  if (!input) return '';
  let s = input.toLowerCase()
    .replace(/^(kelas|tingkat|rombel|kls|grade)\s*/i, '')
    .trim();
  // Map Angka Romawi umum (I sampai VI)
  s = s
    .replace(/\bvi\b/g, '6')
    .replace(/\bv\b/g, '5')
    .replace(/\biv\b/g, '4')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bi\b/g, '1');
  return s.replace(/[^a-z0-9]/g, '');
}

/**
 * Helper: Fuzzy match class name with available classes in workspace
 */
export function matchClassByName(
  input: string,
  availableClasses: Array<{ id: string; name: string; grade?: number }>
) {
  if (!input) return undefined;
  const rawClean = normalizeClassToken(input);
  if (!rawClean) return undefined;

  return availableClasses.find((c) => {
    const cClean = normalizeClassToken(c.name);
    return cClean === rawClean || c.name.toLowerCase().trim() === input.toLowerCase().trim();
  });
}

/**
 * Parses rows into ParsedTeacherItem[]
 */
export function mapRowsToTeachers(rows: string[][], rawTextFallback: string = ''): ParsedTeacherItem[] {
  if (!rows || rows.length === 0) {
    if (rawTextFallback.trim()) {
      const lines = rawTextFallback.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      rows = lines.map((l) => l.split(/[\t;,]/).map((t) => t.trim()));
    } else {
      return [];
    }
  }

  // Filter out completely blank rows
  const cleanRows = rows
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((c) => c.length > 0));

  if (cleanRows.length === 0) return [];

  // Detect header indices
  let nameCol = -1;
  let nipCol = -1;
  let genderCol = -1;
  let tugasCol = -1;

  const firstRow = cleanRows[0].map((c) => c.toLowerCase());
  const hasHeader = firstRow.some(
    (c) =>
      c.includes('nama') ||
      c.includes('nip') ||
      c.includes('nuptk') ||
      c.includes('guru') ||
      c.includes('pendidik') ||
      c.includes('gender') ||
      c.includes('jenis kelamin') ||
      c.includes('tugas') ||
      c.includes('jabatan')
  );

  if (hasHeader) {
    firstRow.forEach((col, idx) => {
      if (nameCol === -1 && (col.includes('nama') || col.includes('guru') || col.includes('pendidik'))) {
        nameCol = idx;
      } else if (nipCol === -1 && (col.includes('nip') || col.includes('nuptk') || col.includes('nik'))) {
        nipCol = idx;
      } else if (genderCol === -1 && (col.includes('jk') || col.includes('jenis kelamin') || col.includes('gender') || col.includes('l/p') || col.includes('lp'))) {
        genderCol = idx;
      } else if (tugasCol === -1 && (col.includes('tugas') || col.includes('jabatan') || col.includes('peran') || col.includes('role'))) {
        tugasCol = idx;
      }
    });
  }

  const dataRows = hasHeader ? cleanRows.slice(1) : cleanRows;
  const results: ParsedTeacherItem[] = [];
  const seenNipsInBatch = new Set<string>();

  dataRows.forEach((row) => {
    // Skip rows that look like repeating headers or page footers
    const joined = row.join(' ').toLowerCase();
    if (joined.includes('halaman') || joined.includes('page') || (joined.includes('nama guru') && joined.includes('nip'))) {
      return;
    }

    let nama = '';
    let nip = '-';
    let genderRaw = 'L';
    let tugasUtama = 'Belum Ditugaskan';

    if (nameCol !== -1) {
      nama = row[nameCol] || '';
      nip = nipCol !== -1 ? row[nipCol] || '-' : '-';
      genderRaw = genderCol !== -1 ? row[genderCol] || 'L' : 'L';
      tugasUtama = tugasCol !== -1 ? row[tugasCol] || 'Belum Ditugaskan' : 'Belum Ditugaskan';
    } else {
      // Heuristic parsing:
      // Check if row[0] is just row sequence number (e.g. "1", "2", "3")
      let startIdx = 0;
      if (/^\d{1,3}$/.test(row[0]) && row.length > 1 && !/^\d{8,}$/.test(row[0])) {
        startIdx = 1;
      }

      const candidateTokens = row.slice(startIdx);
      if (candidateTokens.length >= 1) {
        nama = candidateTokens[0] || '';
      }
      if (candidateTokens.length >= 2) {
        const token1Clean = candidateTokens[1].replace(/\s+/g, '');
        // Is token 1 a NIP or Gender?
        if (/^\d{8,18}$/.test(token1Clean) || candidateTokens[1] === '-') {
          nip = token1Clean;
          genderRaw = candidateTokens[2] || 'L';
          tugasUtama = candidateTokens[3] || 'Belum Ditugaskan';
        } else if (['L', 'P', 'LAKI-LAKI', 'PEREMPUAN'].includes(candidateTokens[1].toUpperCase())) {
          genderRaw = candidateTokens[1];
          nip = candidateTokens[2] ? candidateTokens[2].replace(/\s+/g, '') : '-';
          tugasUtama = candidateTokens[3] || 'Belum Ditugaskan';
        } else {
          nip = candidateTokens[1];
          genderRaw = candidateTokens[2] || 'L';
          tugasUtama = candidateTokens[3] || 'Belum Ditugaskan';
        }
      }
    }

    // Clean nama: strip any leading numbering like "1. " or "1) "
    nama = nama.replace(/^\d+[\.\)]\s*/, '').trim();

    // Clean gender
    const gender = normalizeGender(genderRaw);

    // Clean NIP
    let cleanNip = nip.trim();
    if (cleanNip === '' || cleanNip === '-' || cleanNip === '0') {
      cleanNip = '-';
    } else {
      const stripped = cleanNip.replace(/\s+/g, '');
      if (/^\d{8,18}$/.test(stripped)) {
        cleanNip = stripped;
      }
    }

    // Clean tugas utama
    let cleanTugas = tugasUtama.trim();
    const tugasLower = cleanTugas.toLowerCase();
    if (tugasLower.includes('wali')) {
      cleanTugas = 'Wali Kelas';
    } else if (tugasLower.includes('mapel') || tugasLower.includes('mata pelajaran')) {
      cleanTugas = 'Guru Mapel';
    } else if (!cleanTugas || tugasLower.includes('belum')) {
      cleanTugas = 'Belum Ditugaskan';
    }

    let isValid = nama.length > 0;
    let error: string | undefined = undefined;

    if (!nama) {
      isValid = false;
      error = 'Nama guru kosong';
    } else if (cleanNip !== '-') {
      if (seenNipsInBatch.has(cleanNip)) {
        isValid = false;
        error = 'Duplikat NIP dalam file';
      } else {
        seenNipsInBatch.add(cleanNip);
      }
    }

    if (nama) {
      results.push({
        nama,
        nip: cleanNip,
        jenisKelamin: gender,
        tugasUtama: cleanTugas,
        isValid,
        error,
      });
    }
  });

  return results;
}

/**
 * Parses rows into ParsedStudentItem[]
 */
export function mapRowsToStudents(
  rows: string[][],
  availableClasses: Array<{ id: string; name: string; grade?: number }>,
  defaultClassId: string,
  rawTextFallback: string = ''
): ParsedStudentItem[] {
  if (!rows || rows.length === 0) {
    if (rawTextFallback.trim()) {
      const lines = rawTextFallback.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      rows = lines.map((l) => l.split(/[\t;,]/).map((t) => t.trim()));
    } else {
      return [];
    }
  }

  const cleanRows = rows
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((c) => c.length > 0));

  if (cleanRows.length === 0) return [];

  // Detect header indices
  let nameCol = -1;
  let nisnCol = -1;
  let genderCol = -1;
  let classCol = -1;

  const firstRow = cleanRows[0].map((c) => c.toLowerCase());
  const hasHeader = firstRow.some(
    (c) =>
      c.includes('nama') ||
      c.includes('nisn') ||
      c.includes('nis') ||
      c.includes('siswa') ||
      c.includes('peserta didik') ||
      c.includes('gender') ||
      c.includes('jenis kelamin') ||
      c.includes('l/p') ||
      c.includes('kelas') ||
      c.includes('rombel')
  );

  if (hasHeader) {
    firstRow.forEach((col, idx) => {
      if (nameCol === -1 && (col.includes('nama') || col.includes('siswa') || col.includes('peserta didik'))) {
        nameCol = idx;
      } else if (nisnCol === -1 && (col.includes('nisn') || col.includes('nis') || col.includes('no induk') || col.includes('induk'))) {
        nisnCol = idx;
      } else if (genderCol === -1 && (col.includes('jk') || col.includes('jenis') || col.includes('gender') || col.includes('l/p') || col.includes('lp'))) {
        genderCol = idx;
      } else if (classCol === -1 && (col.includes('kelas') || col.includes('rombel') || col.includes('tingkat') || col.includes('class'))) {
        classCol = idx;
      }
    });
  }

  const dataRows = hasHeader ? cleanRows.slice(1) : cleanRows;
  const results: ParsedStudentItem[] = [];
  const seenNisns = new Set<string>();

  dataRows.forEach((row) => {
    // Skip page headers or footers
    const joined = row.join(' ').toLowerCase();
    if (joined.includes('halaman') || joined.includes('page') || (joined.includes('nama siswa') && joined.includes('nisn'))) {
      return;
    }

    let nama = '';
    let genderRaw = 'L';
    let nisn = '';
    let classRaw = '';

    if (nameCol !== -1) {
      nama = row[nameCol] || '';
      genderRaw = genderCol !== -1 ? row[genderCol] || 'L' : 'L';
      nisn = nisnCol !== -1 ? row[nisnCol] || '' : '';
      classRaw = classCol !== -1 ? row[classCol] || '' : '';
    } else {
      // Heuristic parsing
      let startIdx = 0;
      if (/^\d{1,3}$/.test(row[0]) && row.length > 2 && !/^\d{6,}$/.test(row[0])) {
        startIdx = 1;
      }
      const candidateTokens = row.slice(startIdx);

      // Check where NISN is (usually 6-16 digits)
      const digitIdx = candidateTokens.findIndex((t) => /^\d{6,16}$/.test(t));
      const genderIdx = candidateTokens.findIndex((t) =>
        ['L', 'P', 'LAKI-LAKI', 'PEREMPUAN'].includes(t.toUpperCase())
      );

      if (digitIdx !== -1) {
        nisn = candidateTokens[digitIdx];
      }
      if (genderIdx !== -1) {
        genderRaw = candidateTokens[genderIdx];
      }

      // Name is usually the first non-digit, non-gender string with length > 2
      const remainingForName = candidateTokens.filter(
        (_, i) => i !== digitIdx && i !== genderIdx
      );
      if (remainingForName.length > 0) {
        nama = remainingForName[0] || '';
        if (remainingForName.length > 1) {
          classRaw = remainingForName[1] || '';
        }
      }
    }

    // Clean nama
    nama = nama.replace(/^\d+[\.\)]\s*/, '').trim().toUpperCase();

    // Clean gender
    const gender = normalizeGender(genderRaw);

    // Clean NISN
    nisn = nisn.trim().replace(/[^0-9]/g, '');

    // Match class
    const cleanClassInput = (classRaw || '').trim();
    const matchedClass = cleanClassInput ? matchClassByName(cleanClassInput, availableClasses) : undefined;
    const matchedClassId = matchedClass?.id || defaultClassId || availableClasses[0]?.id || null;
    const matchedClassName =
      matchedClass?.name ||
      cleanClassInput ||
      availableClasses.find((c) => c.id === matchedClassId)?.name ||
      '';

    let isValid = nama.length > 0 && nisn.length > 0;
    let error: string | undefined = undefined;

    if (!nama) {
      isValid = false;
      error = 'Nama lengkap kosong';
    } else if (!nisn) {
      isValid = false;
      error = 'NISN kosong atau tidak valid';
    } else if (seenNisns.has(nisn)) {
      isValid = false;
      error = 'Duplikat NISN dalam file';
    } else {
      seenNisns.add(nisn);
    }

    if (nama || nisn) {
      results.push({
        nama,
        gender,
        nisn,
        classNameInput: cleanClassInput || undefined,
        matchedClassId,
        matchedClassName,
        isValid,
        error,
      });
    }
  });

  return results;
}

/**
 * Generate and download template in Excel (.xlsx) or CSV format for Teachers
 */
export function downloadTeacherTemplateFile(format: 'xlsx' | 'csv' = 'xlsx') {
  const headers = ['NAMA GURU', 'NIP', 'JENIS KELAMIN', 'TUGAS UTAMA'];
  const data = [
    ['Budi Santoso, S.Pd.', '198503152010011012', 'L', 'Wali Kelas'],
    ['Siti Aminah, M.Pd.', '199008222015022003', 'P', 'Guru Mapel'],
    ['Rahmat Hidayat, S.Pd.', '198811102012011005', 'L', 'Guru Mapel'],
    ['Dewi Lestari, S.Pd.', '-', 'P', 'Wali Kelas'],
  ];

  if (format === 'xlsx') {
    const wsData = [headers, ...data];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Guru');
    XLSX.writeFile(wb, 'Template_Import_Data_Guru.xlsx');
  } else {
    const csvContent =
      '\uFEFF' +
      headers.join(',') +
      '\n' +
      data.map((r) => r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Template_Import_Data_Guru.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Generate and download template in Excel (.xlsx) or CSV format for Students
 */
export function downloadStudentTemplateFile(
  format: 'xlsx' | 'csv' = 'xlsx',
  defaultClassName: string = 'Kelas 1A'
) {
  const headers = ['NAMA LENGKAP', 'L/P', 'NISN', 'KELAS'];
  const data = [
    ['ADITYA PRATAMA', 'L', '3145678901', defaultClassName],
    ['AQILA SHAFA MAHYA', 'P', '3148157704', defaultClassName],
    ['BAGAS SATRIA PRATAMA', 'L', '3146473211', defaultClassName],
    ['CITRA LESTARI DEWI', 'P', '3149021145', defaultClassName],
  ];

  if (format === 'xlsx') {
    const wsData = [headers, ...data];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
    XLSX.writeFile(wb, 'Template_Import_Data_Siswa.xlsx');
  } else {
    const csvContent =
      '\uFEFF' +
      headers.join(',') +
      '\n' +
      data.map((r) => r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Template_Import_Data_Siswa.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Generate and download template in Excel (.xlsx) or CSV format for Classes
 */
export function downloadClassTemplateFile(format: 'xlsx' | 'csv' = 'xlsx') {
  const headers = ['NAMA WALI KELAS', 'NAMA ROMBEL / KELAS'];
  const data = [
    ['Budi Santoso, S.Pd.', 'Kelas 1A'],
    ['Siti Aminah, M.Pd.', 'Kelas 1B'],
    ['Rahmat Hidayat, S.Pd.', 'Kelas 2A'],
    ['Dewi Lestari, S.Pd.', 'Kelas 3A'],
    ['', 'Kelas 4A'],
    ['', 'Kelas 5A'],
    ['', 'Kelas 6A'],
  ];

  if (format === 'xlsx') {
    const wsData = [headers, ...data];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 32 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Kelas');
    XLSX.writeFile(wb, 'Template_Import_Data_Kelas.xlsx');
  } else {
    const csvContent =
      '\uFEFF' +
      headers.join(',') +
      '\n' +
      data.map((r) => r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Template_Import_Data_Kelas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
