import { Student, SchoolClass, AttendanceRecord, AttendanceStatus, AttendanceType } from '../types';
import { UserRoleScope } from './userScope';

export interface PendingAttendanceRecord {
  studentId: string;
  studentName: string;
  className: string;
  classId?: string | null;
  date: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "9 September 2026"
  status: AttendanceStatus;
  previousStatus?: AttendanceStatus | null;
  existingRecordId?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  notes?: string | null;
}

export interface PendingAction {
  id: string;
  type: 'create_attendance' | 'update_attendance';
  records: PendingAttendanceRecord[];
  createdAt: number;
}

export interface StudentMatchResult {
  status: 'found' | 'ambiguous' | 'not_found';
  queryName: string;
  student?: Student;
  className?: string;
  candidates?: Array<{ student: Student; className: string }>;
}

export interface IntentRecordInput {
  student_name: string;
  status?: string | null;
  date?: string | null;
  check_in_time?: string | null;
  notes?: string | null;
}

export interface ResolveIntentResult {
  ready: boolean;
  pendingAction?: PendingAction;
  ambiguous?: {
    queryName: string;
    candidates: Array<{ student: Student; className: string }>;
    remainingRecords?: IntentRecordInput[];
  };
  notFound?: {
    queryName: string;
  };
  permissionDenied?: {
    studentName: string;
    className: string;
  };
  error?: string;
}

/**
 * Format tanggal YYYY-MM-DD menjadi format tanggal Indonesia (misal: "9 September 2026")
 */
export function formatIndonesianDate(dateStr: string): string {
  try {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Normalisasi teks untuk pencarian nama siswa
 */
export function normalizeSearch(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalisasi status absensi ke enum AttendanceStatus yang sah dalam aplikasi
 */
export function normalizeStatus(rawStatus?: string | null): AttendanceStatus {
  if (!rawStatus) return 'Hadir';
  const clean = rawStatus.trim().toLowerCase();
  if (clean === 'sakit' || clean === 's') return 'Sakit';
  if (clean === 'izin' || clean === 'ijin' || clean === 'i') return 'Izin';
  if (clean === 'alfa' || clean === 'alpa' || clean === 'a' || clean === 'tanpa keterangan') return 'Alfa';
  if (clean === 'hadir' || clean === 'masuk' || clean === 'h' || clean === 'terlambat' || clean === 'telat') return 'Hadir';
  return 'Hadir';
}

// ==========================================
// TOOL 1: get_students
// Mengambil daftar siswa yang dapat diakses pengguna sesuai role dan scope
// ==========================================
export function get_students(
  userScope: UserRoleScope,
  allStudents: Student[]
): Student[] {
  if (userScope.isAdmin || userScope.isSuperAdmin || userScope.isKepalaSekolah) {
    return allStudents;
  }

  const accessibleIds = new Set(userScope.accessibleClassIds);
  return allStudents.filter((s) => s.classId && accessibleIds.has(s.classId));
}

// ==========================================
// TOOL 2: get_student_by_name
// Mencari siswa berdasarkan nama dalam lingkup hak akses pengguna
// ==========================================
export function get_student_by_name(
  nameQuery: string,
  userScope: UserRoleScope,
  allStudents: Student[],
  classes: SchoolClass[]
): StudentMatchResult {
  const cleanQuery = normalizeSearch(nameQuery);
  if (!cleanQuery) {
    return { status: 'not_found', queryName: nameQuery };
  }

  // Dapatkan seluruh siswa dalam scope hak akses
  const scopedStudents = get_students(userScope, allStudents);

  const classMap = new Map<string, string>();
  classes.forEach((c) => {
    classMap.set(c.id, c.name);
  });

  const getClassName = (student: Student) => {
    if (student.className) return student.className;
    if (student.classId && classMap.has(student.classId)) {
      return classMap.get(student.classId)!;
    }
    return 'Kelas';
  };

  // 1. Cek kecocokan nama persis (exact match)
  const exactMatches = scopedStudents.filter(
    (s) => normalizeSearch(s.nama) === cleanQuery
  );

  if (exactMatches.length === 1) {
    return {
      status: 'found',
      queryName: nameQuery,
      student: exactMatches[0],
      className: getClassName(exactMatches[0]),
    };
  }

  if (exactMatches.length > 1) {
    return {
      status: 'ambiguous',
      queryName: nameQuery,
      candidates: exactMatches.map((s) => ({
        student: s,
        className: getClassName(s),
      })),
    };
  }

  // 2. Cek kecocokan kata depan atau substring per kata
  const queryTokens = cleanQuery.split(' ');
  const partialMatches = scopedStudents.filter((s) => {
    const studentTokens = normalizeSearch(s.nama).split(' ');
    // Jika semua kata dalam query cocok dengan awal kata nama siswa
    return queryTokens.every((q) =>
      studentTokens.some((st) => st.startsWith(q) || st === q)
    );
  });

  if (partialMatches.length === 1) {
    return {
      status: 'found',
      queryName: nameQuery,
      student: partialMatches[0],
      className: getClassName(partialMatches[0]),
    };
  }

  if (partialMatches.length > 1) {
    return {
      status: 'ambiguous',
      queryName: nameQuery,
      candidates: partialMatches.map((s) => ({
        student: s,
        className: getClassName(s),
      })),
    };
  }

  // 3. Fallback: pencarian includes biasa
  const includesMatches = scopedStudents.filter((s) =>
    normalizeSearch(s.nama).includes(cleanQuery)
  );

  if (includesMatches.length === 1) {
    return {
      status: 'found',
      queryName: nameQuery,
      student: includesMatches[0],
      className: getClassName(includesMatches[0]),
    };
  }

  if (includesMatches.length > 1) {
    return {
      status: 'ambiguous',
      queryName: nameQuery,
      candidates: includesMatches.map((s) => ({
        student: s,
        className: getClassName(s),
      })),
    };
  }

  return { status: 'not_found', queryName: nameQuery };
}

// ==========================================
// TOOL 3: get_today_attendance
// Mengambil catatan absensi siswa pada tanggal tertentu
// ==========================================
export function get_today_attendance(
  studentId: string,
  date: string,
  attendanceRecords: AttendanceRecord[]
): AttendanceRecord | null {
  return (
    attendanceRecords.find(
      (r) =>
        r.studentId === studentId &&
        r.date === date &&
        (!r.type || r.type === 'DAILY')
    ) || null
  );
}

// ==========================================
// TOOL 4: create_attendance
// Menyimpan record absensi baru menggunakan saveDailyAttendance yang sudah ada
// ==========================================
export async function create_attendance(
  records: PendingAttendanceRecord[],
  saveDailyAttendanceFn: (
    date: string,
    records: AttendanceRecord[],
    options?: {
      type?: AttendanceType;
      subjectId?: string | null;
      subjectName?: string | null;
      classId?: string | null;
    }
  ) => Promise<any>
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!records || records.length === 0) {
    return { success: false, count: 0, error: 'Tidak ada data absensi untuk disimpan.' };
  }

  // 1. Kelompokkan records berdasarkan tanggal agar tidak tertimpa/tercampur
  const groupedByDate: Record<string, PendingAttendanceRecord[]> = {};
  for (const record of records) {
    const d = record.date;
    if (!groupedByDate[d]) groupedByDate[d] = [];
    groupedByDate[d].push(record);
  }

  let totalSaved = 0;

  // 2. Simpan per tanggal secara sekuensial (menghindari race condition)
  try {
    for (const [targetDate, dateRecords] of Object.entries(groupedByDate)) {
      const attendancePayload: AttendanceRecord[] = dateRecords.map((r) => ({
        id: r.existingRecordId || `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: targetDate,
        studentId: r.studentId,
        studentName: r.studentName,
        classId: r.classId || null,
        status: r.status,
        checkInTime: r.checkInTime || (r.status === 'Hadir' ? '07:00' : '-'),
        checkOutTime: r.checkOutTime || '-',
        notes: r.notes || (r.status === 'Sakit' ? 'Sakit' : r.status === 'Izin' ? 'Izin' : ''),
        type: 'DAILY',
      }));

      const result = await saveDailyAttendanceFn(targetDate, attendancePayload, {
        type: 'DAILY',
        classId: dateRecords[0]?.classId || null,
      });

      if (result && result.success === false) {
        return {
          success: false,
          count: totalSaved,
          error: result.error || `Gagal menyimpan absensi tanggal ${targetDate}.`,
        };
      }

      totalSaved += dateRecords.length;
    }

    return { success: true, count: totalSaved };
  } catch (err: any) {
    return {
      success: false,
      count: totalSaved,
      error: err?.message || 'Absensi belum tersimpan karena terjadi kesalahan pada server.',
    };
  }
}

// ==========================================
// TOOL 5: update_attendance
// Memperbarui absensi yang sudah ada menggunakan saveDailyAttendance yang sudah ada
// ==========================================
export async function update_attendance(
  records: PendingAttendanceRecord[],
  saveDailyAttendanceFn: (
    date: string,
    records: AttendanceRecord[],
    options?: {
      type?: AttendanceType;
      subjectId?: string | null;
      subjectName?: string | null;
      classId?: string | null;
    }
  ) => Promise<any>
): Promise<{ success: boolean; count: number; error?: string }> {
  return create_attendance(records, saveDailyAttendanceFn);
}

// ==========================================
// RESOLVER & VALIDATOR INTENT DARI AI
// Memvalidasi daftar siswa, mencari di database lokal, mengecek scope role, dan menyusun pendingAction
// ==========================================
export function resolveAttendanceIntent(
  intentRecords: IntentRecordInput[],
  intentAction: 'create_attendance' | 'update_attendance',
  options: {
    userScope: UserRoleScope;
    allStudents: Student[];
    classes: SchoolClass[];
    attendanceRecords: AttendanceRecord[];
    defaultDate?: string;
  }
): ResolveIntentResult {
  const { userScope, allStudents, classes, attendanceRecords, defaultDate } = options;
  const targetDate = defaultDate || new Date().toISOString().split('T')[0];

  const pendingRecords: PendingAttendanceRecord[] = [];

  for (let i = 0; i < intentRecords.length; i++) {
    const item = intentRecords[i];
    const match = get_student_by_name(item.student_name, userScope, allStudents, classes);

    if (match.status === 'not_found') {
      return {
        ready: false,
        notFound: { queryName: item.student_name },
        error: `Saya tidak menemukan siswa bernama "${item.student_name}" dalam data yang dapat Anda akses.`,
      };
    }

    if (match.status === 'ambiguous') {
      return {
        ready: false,
        ambiguous: {
          queryName: item.student_name,
          candidates: match.candidates || [],
          remainingRecords: intentRecords.slice(i + 1),
        },
      };
    }

    const student = match.student!;
    const className = match.className || 'Kelas';

    // Verifikasi izin akses: pastikan siswa berada dalam scope kelas yang diizinkan
    const isAllowed =
      userScope.isAdmin ||
      userScope.isSuperAdmin ||
      userScope.isKepalaSekolah ||
      (student.classId && userScope.accessibleClassIds.includes(student.classId));

    if (!isAllowed) {
      return {
        ready: false,
        permissionDenied: { studentName: student.nama, className },
        error: `Anda tidak memiliki akses untuk mengubah absensi siswa ${student.nama} (${className}).`,
      };
    }

    const itemDate = item.date || targetDate;
    const existingRec = get_today_attendance(student.id, itemDate, attendanceRecords);

    const validStatus = normalizeStatus(item.status);

    let checkInTime = item.check_in_time || null;
    let notes = item.notes || null;

    // Jika diperintahkan terlambat
    const isLate =
      (item.notes && item.notes.toLowerCase().includes('terlambat')) ||
      (item.status && item.status.toLowerCase().includes('terlambat'));

    if (isLate) {
      if (!notes) notes = 'Terlambat';
      if (!checkInTime) checkInTime = '07:15';
    }

    pendingRecords.push({
      studentId: student.id,
      studentName: student.nama,
      className,
      classId: student.classId,
      date: itemDate,
      formattedDate: formatIndonesianDate(itemDate),
      status: validStatus,
      previousStatus: existingRec ? existingRec.status : null,
      existingRecordId: existingRec ? existingRec.id : null,
      checkInTime: checkInTime || (existingRec?.checkInTime && existingRec.checkInTime !== '-' ? existingRec.checkInTime : null),
      notes: notes || existingRec?.notes || null,
    });
  }

  // Tentukan apakah aksi sebenarnya update jika ada record sebelumnya
  const hasExisting = pendingRecords.some((r) => r.previousStatus && r.previousStatus !== r.status);
  const finalActionType = intentAction === 'update_attendance' || hasExisting ? 'update_attendance' : 'create_attendance';

  const pendingAction: PendingAction = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: finalActionType,
    records: pendingRecords,
    createdAt: Date.now(),
  };

  return {
    ready: true,
    pendingAction,
  };
}

// ==========================================
// CLIENT-SIDE COMMAND INTENT DETECTOR (FALLBACK / INSTANT DETECTION)
// Mendeteksi apakah input pengguna berupa perintah tindakan absensi
// ==========================================
export function detectLocalCommandIntent(
  text: string,
  todayStr: string
): { isCommand: boolean; action?: 'create_attendance' | 'update_attendance'; records?: IntentRecordInput[] } {
  const t = text.trim();
  const lower = t.toLowerCase();

  // Pertanyaan biasa jangan dideteksi sebagai perintah tindakan
  const isQuestion =
    lower.startsWith('siapa') ||
    lower.startsWith('berapa') ||
    lower.startsWith('apakah') ||
    lower.startsWith('bagaimana') ||
    lower.includes('?') ||
    lower.includes('paling sering') ||
    lower.includes('terendah') ||
    lower.includes('rekap') ||
    lower.includes('persentase') ||
    lower.includes('belum memiliki absensi') ||
    lower.includes('belum absen');

  if (isQuestion) {
    return { isCommand: false };
  }

  // 1. Deteksi kata kunci perintah
  const actionKeywords = ['input', 'catat', 'tandai', 'absen', 'ubah', 'ganti', 'jadikan', 'masukkan'];
  const hasActionKeyword = actionKeywords.some((kw) => lower.includes(kw));

  // Pola status
  const hasStatus =
    lower.includes('sakit') ||
    lower.includes('izin') ||
    lower.includes('hadir') ||
    lower.includes('alfa') ||
    lower.includes('alpa') ||
    lower.includes('terlambat') ||
    lower.includes('telat');

  if (!hasActionKeyword && !hasStatus) {
    return { isCommand: false };
  }

  // Deteksi Update / Koreksi spesifik
  // Contoh: "Tadi saya salah input Andi sakit. Ubah menjadi hadir."
  // atau "Ubah absensi Budi dari sakit menjadi hadir."
  const updateMatch = lower.match(/ubah(?:\s+absensi)?\s+([a-zA-Z\s]+?)\s+(?:dari\s+\w+\s+)?menjadi\s+(hadir|sakit|izin|alfa)/i);
  if (updateMatch) {
    const studentName = updateMatch[1].replace(/^(absensi|data)\s+/i, '').trim();
    const newStatus = normalizeStatus(updateMatch[2]);
    return {
      isCommand: true,
      action: 'update_attendance',
      records: [
        {
          student_name: studentName,
          status: newStatus,
          date: todayStr,
        },
      ],
    };
  }

  // Deteksi Terlambat dengan jam:
  // Contoh: "Catat Andi terlambat masuk jam 07.18" atau "Andi terlambat 07:15"
  const lateMatch = lower.match(/(?:catat|tandai|input)?\s*([a-zA-Z\s]+?)\s+terlambat(?:\s+masuk)?(?:\s+jam|\s+pukul)?\s*([0-2]?[0-9][.:][0-5][0-9])/i);
  if (lateMatch) {
    const studentName = lateMatch[1].replace(/^(tolong|mohon|catat|input|tandai)\s+/i, '').trim();
    const timeClean = lateMatch[2].replace('.', ':');
    return {
      isCommand: true,
      action: 'create_attendance',
      records: [
        {
          student_name: studentName,
          status: 'Hadir',
          check_in_time: timeClean,
          notes: `Terlambat masuk jam ${timeClean}`,
          date: todayStr,
        },
      ],
    };
  }

  // Deteksi Perintah Campuran:
  // Contoh: "Andi sakit, Budi izin, Citra terlambat"
  const multiMixedParts = lower.split(/[,;&]\s*/);
  if (multiMixedParts.length > 1) {
    const parsedRecords: IntentRecordInput[] = [];
    for (const part of multiMixedParts) {
      const matchStatus = part.match(/(?:yang\s+)?(?:sakit|izin|hadir|alfa|alpa|terlambat)\s+([a-zA-Z\s]+)/i) ||
                          part.match(/([a-zA-Z\s]+)\s+(?:sebagai\s+)?(sakit|izin|hadir|alfa|alpa|terlambat)/i);
      if (matchStatus) {
        let name = '';
        let st = '';
        if (part.includes('sakit')) st = 'Sakit';
        else if (part.includes('izin')) st = 'Izin';
        else if (part.includes('alfa') || part.includes('alpa')) st = 'Alfa';
        else if (part.includes('terlambat') || part.includes('telat')) st = 'Hadir';
        else if (part.includes('hadir')) st = 'Hadir';

        name = part
          .replace(/^(tolong|mohon|catat|input|tandai|dan|lalu)\s+/i, '')
          .replace(/\b(sakit|izin|hadir|alfa|alpa|terlambat|telat|sebagai)\b/gi, '')
          .trim();

        if (name && name.length >= 2) {
          parsedRecords.push({
            student_name: name,
            status: st,
            notes: part.includes('terlambat') ? 'Terlambat' : undefined,
            check_in_time: part.includes('terlambat') ? '07:15' : undefined,
            date: todayStr,
          });
        }
      }
    }

    if (parsedRecords.length > 1) {
      return {
        isCommand: true,
        action: 'create_attendance',
        records: parsedRecords,
      };
    }
  }

  // Deteksi Banyak Siswa dengan 1 status:
  // Contoh: "Yang sakit hari ini Andi, Budi, dan Citra."
  const multiSameMatch = lower.match(/(?:yang\s+)?(sakit|izin|hadir|alfa|alpa|terlambat)\s+(?:hari ini\s+)?(?:adalah\s+)?([a-zA-Z,\s]+)/i) ||
                         lower.match(/(?:input|catat|tandai)\s+(?:absensi\s+)?(?:hari ini\s+)?(?:yang\s+)?(sakit|izin|hadir|alfa|alpa|terlambat)\s+([a-zA-Z,\s]+)/i);

  if (multiSameMatch) {
    const rawStatus = multiSameMatch[1];
    const namesPart = multiSameMatch[2];
    const names = namesPart
      .replace(/\s+dan\s+/gi, ',')
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length >= 2 && !['hari', 'ini', 'siswa', 'anak'].includes(n));

    if (names.length > 0) {
      const isLate = rawStatus === 'terlambat';
      return {
        isCommand: true,
        action: 'create_attendance',
        records: names.map((name) => ({
          student_name: name,
          status: isLate ? 'Hadir' : normalizeStatus(rawStatus),
          notes: isLate ? 'Terlambat' : undefined,
          check_in_time: isLate ? '07:15' : undefined,
          date: todayStr,
        })),
      };
    }
  }

  // Deteksi Standar 1 Siswa:
  // Contoh: "Tolong input absensi hari ini yang sakit Andi."
  // atau "Catat Budi sebagai izin hari ini."
  // atau "Tandai Citra hadir."
  const singleMatch =
    lower.match(/(?:input|catat|tandai|absen)\s+(?:absensi\s+)?(?:hari ini\s+)?(?:yang\s+)?(sakit|izin|hadir|alfa|alpa|terlambat)\s+([a-zA-Z\s]+)/i) ||
    lower.match(/(?:catat|tandai|input)\s+([a-zA-Z\s]+?)\s+(?:sebagai\s+)?(sakit|izin|hadir|alfa|alpa|terlambat)/i) ||
    lower.match(/(?:tandai|absen)\s+([a-zA-Z\s]+?)\s+(hadir|sakit|izin|alfa|alpa|terlambat)/i);

  if (singleMatch) {
    let name = '';
    let statusRaw = '';

    if (['sakit', 'izin', 'hadir', 'alfa', 'alpa', 'terlambat'].includes(singleMatch[1])) {
      statusRaw = singleMatch[1];
      name = singleMatch[2];
    } else {
      name = singleMatch[1];
      statusRaw = singleMatch[2];
    }

    name = name
      .replace(/\b(hari ini|hari|ini|sebagai|tolong|mohon)\b/gi, '')
      .trim();

    if (name.length >= 2) {
      const isLate = statusRaw === 'terlambat';
      return {
        isCommand: true,
        action: 'create_attendance',
        records: [
          {
            student_name: name,
            status: isLate ? 'Hadir' : normalizeStatus(statusRaw),
            notes: isLate ? 'Terlambat' : undefined,
            check_in_time: isLate ? '07:15' : undefined,
            date: todayStr,
          },
        ],
      };
    }
  }

  return { isCommand: false };
}
