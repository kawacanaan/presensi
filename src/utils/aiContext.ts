import { UserAccount, Workspace, Student, SchoolClass, Teacher, Subject, AttendanceRecord } from '../types';
import { getUserRoleScope, UserRoleScope } from './userScope';

export interface AIContextOptions {
  currentUser: UserAccount | null;
  activeWorkspace: Workspace | null;
  students: Student[];
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  attendanceRecords: AttendanceRecord[];
}

export function buildAIAttendanceContext(options: AIContextOptions): string {
  const {
    currentUser,
    activeWorkspace,
    students,
    classes,
    teachers,
    subjects,
    attendanceRecords,
  } = options;

  if (!currentUser) {
    return 'Pengguna belum login atau data sesi tidak valid.';
  }

  const role = currentUser.role || 'GURU MAPEL';
  const userScope: UserRoleScope = getUserRoleScope(currentUser, classes, subjects, teachers);

  // 1. Tentukan batasan hak akses (Scope Filtering)
  let scopedStudents: Student[] = [];
  let scopedRecords: AttendanceRecord[] = [];
  let scopeTitle = '';

  const isWaliKelas = userScope.isWaliKelas || role === 'WALI KELAS';
  const isGuruMapel = userScope.isGuruMapel || role === 'GURU MAPEL';
  const isAdminOrKS = role === 'ADMIN' || role === 'KEPALA SEKOLAH' || role === 'SUPER_ADMIN';

  if (isWaliKelas && userScope.assignedWaliClassId) {
    const classId = userScope.assignedWaliClassId;
    const className = userScope.assignedWaliClassName || 'Kelas Binaan';
    scopeTitle = `Wali Kelas - ${className}`;

    scopedStudents = students.filter(
      (s) => s.classId === classId || s.className === className
    );
    const studentIds = new Set(scopedStudents.map((s) => s.id));

    scopedRecords = attendanceRecords.filter((r) => {
      if (r.classId && r.classId === classId) return true;
      if (studentIds.has(r.studentId)) return true;
      return false;
    });
  } else if (isGuruMapel) {
    const subjectNames = userScope.assignedSubjects.map((s) => s.name).join(', ') || 'Mata Pelajaran';
    scopeTitle = `Guru Mapel - ${subjectNames}`;

    const accessibleClassIds = new Set(userScope.accessibleClassIds);
    if (accessibleClassIds.size > 0) {
      scopedStudents = students.filter((s) => s.classId && accessibleClassIds.has(s.classId));
    } else {
      scopedStudents = [...students];
    }
    const studentIds = new Set(scopedStudents.map((s) => s.id));

    scopedRecords = attendanceRecords.filter((r) => {
      // Prioritaskan presensi tipe SUBJECT atau yang sesuai ID mapel/kelas guru
      if (r.type === 'SUBJECT') {
        if (userScope.assignedSubjectIds.length > 0 && r.subjectId) {
          return userScope.assignedSubjectIds.includes(r.subjectId);
        }
        return true;
      }
      if (studentIds.has(r.studentId)) return true;
      return false;
    });
  } else if (isAdminOrKS) {
    scopeTitle = `${role} - Seluruh Satuan Pendidikan`;
    scopedStudents = [...students];
    scopedRecords = [...attendanceRecords];
  } else {
    scopeTitle = `Pengguna (${role})`;
    scopedStudents = [...students];
    scopedRecords = [...attendanceRecords];
  }

  // 2. Waktu lokal & Tanggal acuan
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // 3. Agregasi Statistik per Siswa (Filter Data Bersih: Tanpa NISN, Tanpa Email, Tanpa Password)
  interface StudentAttendanceStat {
    name: string;
    className: string;
    hadir: number;
    sakit: number;
    izin: number;
    alfa: number;
    terlambat: number;
    totalHari: number;
    persentaseHadir: number;
  }

  const studentStats: Record<string, StudentAttendanceStat> = {};

  scopedStudents.forEach((st) => {
    studentStats[st.id] = {
      name: st.nama || 'Tanpa Nama',
      className: st.className || 'Kelas',
      hadir: 0,
      sakit: 0,
      izin: 0,
      alfa: 0,
      terlambat: 0,
      totalHari: 0,
      persentaseHadir: 0,
    };
  });

  // Tentukan apakah ada catatan terlambat
  const isLateRecord = (rec: AttendanceRecord) => {
    if (rec.status !== 'Hadir') return false;
    const note = (rec.notes || '').toLowerCase();
    if (note.includes('terlambat') || note.includes('telat')) return true;
    if (rec.checkInTime) {
      // Jika jam masuk di atas 07:00 pagi
      const cleanTime = rec.checkInTime.replace(/[^0-9:]/g, '');
      const [h, m] = cleanTime.split(':').map(Number);
      if (!isNaN(h) && (h > 7 || (h === 7 && m > 0))) return true;
    }
    return false;
  };

  scopedRecords.forEach((rec) => {
    let stat = studentStats[rec.studentId];
    if (!stat && rec.studentName) {
      stat = {
        name: rec.studentName,
        className: 'Kelas',
        hadir: 0,
        sakit: 0,
        izin: 0,
        alfa: 0,
        terlambat: 0,
        totalHari: 0,
        persentaseHadir: 0,
      };
      studentStats[rec.studentId] = stat;
    }

    if (stat) {
      stat.totalHari += 1;
      const status = String(rec.status || '').trim();
      if (status === 'Hadir') stat.hadir += 1;
      else if (status === 'Sakit') stat.sakit += 1;
      else if (status === 'Izin') stat.izin += 1;
      else if (status === 'Alfa') stat.alfa += 1;

      if (isLateRecord(rec)) {
        stat.terlambat += 1;
      }
    }
  });

  // Hitung persentase kehadiran per siswa
  Object.values(studentStats).forEach((stat) => {
    if (stat.totalHari > 0) {
      stat.persentaseHadir = Math.round((stat.hadir / stat.totalHari) * 100);
    }
  });

  // 4. Riwayat Harian (Urutkan dari tanggal terbaru, maksimal 30 tanggal aktif terakhir)
  const recordsByDate: Record<string, AttendanceRecord[]> = {};
  scopedRecords.forEach((r) => {
    if (!r.date) return;
    if (!recordsByDate[r.date]) recordsByDate[r.date] = [];
    recordsByDate[r.date].push(r);
  });

  const sortedDates = Object.keys(recordsByDate).sort((a, b) => b.localeCompare(a));
  const recentDates = sortedDates.slice(0, 30);

  // 5. Presensi Hari Ini
  const todayRecords = recordsByDate[todayStr] || [];
  const todayAbsentList: string[] = [];
  const todayLateList: string[] = [];
  let todayHadirCount = 0;
  let todaySakitCount = 0;
  let todayIzinCount = 0;
  let todayAlfaCount = 0;

  todayRecords.forEach((r) => {
    const studentName = r.studentName || studentStats[r.studentId]?.name || 'Siswa';
    if (r.status === 'Hadir') {
      todayHadirCount++;
      if (isLateRecord(r)) {
        todayLateList.push(`${studentName} (Masuk: ${r.checkInTime || '-'})`);
      }
    } else if (r.status === 'Sakit') {
      todaySakitCount++;
      todayAbsentList.push(`${studentName}: Sakit${r.notes ? ` (${r.notes})` : ''}`);
    } else if (r.status === 'Izin') {
      todayIzinCount++;
      todayAbsentList.push(`${studentName}: Izin${r.notes ? ` (${r.notes})` : ''}`);
    } else if (r.status === 'Alfa') {
      todayAlfaCount++;
      todayAbsentList.push(`${studentName}: Alfa / Tanpa Keterangan`);
    }
  });

  // Hitung siswa yang belum diabsen hari ini
  const recordedStudentIds = new Set(todayRecords.map((r) => r.studentId));
  const unrecordedStudents = scopedStudents.filter((s) => !recordedStudentIds.has(s.id));
  const unrecordedList = unrecordedStudents.map((s) => `${s.nama} (${s.className || 'Kelas'})`);

  // 6. Temuan Khusus (Paling sering terlambat & Kehadiran terendah)
  const allStatsList = Object.values(studentStats);
  const mostLateStudents = allStatsList
    .filter((s) => s.terlambat > 0)
    .sort((a, b) => b.terlambat - a.terlambat)
    .slice(0, 5);

  const lowestAttendanceStudents = allStatsList
    .filter((s) => s.totalHari >= 3)
    .sort((a, b) => a.persentaseHadir - b.persentaseHadir)
    .slice(0, 5);

  // Total Kehadiran Keseluruhan
  const totalAllHadir = allStatsList.reduce((sum, s) => sum + s.hadir, 0);
  const totalAllDays = allStatsList.reduce((sum, s) => sum + s.totalHari, 0);
  const overallPercentage = totalAllDays > 0 ? Math.round((totalAllHadir / totalAllDays) * 100) : 0;

  const matchedTeacher = teachers.find(
    (t) =>
      t.id === currentUser.teacherId ||
      (currentUser.nip && t.nip === currentUser.nip) ||
      (currentUser.name && t.nama && t.nama.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
  );
  const userGender: 'L' | 'P' =
    currentUser.jenisKelamin ||
    currentUser.gender ||
    matchedTeacher?.jenisKelamin ||
    (matchedTeacher as any)?.jenis_kelamin ||
    'L';
  const honorific = userGender === 'P' ? 'Ibu' : 'Bapak';
  const currentHour = new Date().getHours();
  const timeGreeting =
    currentHour >= 4 && currentHour < 11
      ? 'Selamat Pagi'
      : currentHour >= 11 && currentHour < 15
      ? 'Selamat Siang'
      : currentHour >= 15 && currentHour < 18
      ? 'Selamat Sore'
      : 'Selamat Malam';

  // 7. Format Teks Konteks
  let context = `[PROFIL PENGGUNA & RUANG KERJA]
Nama Guru: ${currentUser.name || 'Pendidik'}
Panggilan Resmi: ${honorific} ${currentUser.name || 'Guru'} (Wajib sapa dengan "${honorific} ${currentUser.name ? currentUser.name.split(' ')[0] : 'Guru'}")
Jenis Kelamin: ${userGender === 'P' ? 'Perempuan (P)' : 'Laki-laki (L)'}
Sapaan Waktu Saat Ini: ${timeGreeting}
Peran: ${role} (${scopeTitle})
Ruang Kerja: ${activeWorkspace?.name || 'Sekolah'}
Tanggal Sistem Hari Ini: ${todayStr}
Bulan Berjalan: ${currentMonthStr}

[RINGKASAN UMUM]
Total Siswa dalam Pengawasan: ${scopedStudents.length} siswa
Total Entri Catatan Presensi: ${scopedRecords.length} catatan
Rata-rata Persentase Kehadiran Keseluruhan: ${overallPercentage}%

[STATUS HARI INI (${todayStr})]
- Sudah diinput presensi hari ini: ${todayRecords.length > 0 ? `Ya (${todayRecords.length} siswa terdata)` : 'Belum diinput'}
- Hadir: ${todayHadirCount} siswa
- Sakit: ${todaySakitCount} siswa
- Izin: ${todayIzinCount} siswa
- Alfa: ${todayAlfaCount} siswa
- Siswa Tidak Hadir Hari Ini: ${todayAbsentList.length > 0 ? todayAbsentList.join('; ') : 'Semua hadir atau belum ada laporan'}
- Siswa Terlambat Hari Ini: ${todayLateList.length > 0 ? todayLateList.join('; ') : 'Tidak ada keterlambatan'}
- Siswa Belum Memiliki Absensi Hari Ini (${unrecordedStudents.length} siswa): ${
  unrecordedList.length > 0
    ? unrecordedList.join(', ')
    : 'Semua siswa dalam pengawasan Anda sudah memiliki catatan absensi hari ini.'
}

[SISWA PALING SERING TERLAMBAT]
${
  mostLateStudents.length > 0
    ? mostLateStudents.map((s, idx) => `${idx + 1}. ${s.name} (${s.className}) - Terlambat: ${s.terlambat} kali`).join('\n')
    : 'Tidak ada catatan siswa terlambat.'
}

[SISWA DENGAN PERSENTASE KEHADIRAN PALING RENDAH]
${
  lowestAttendanceStudents.length > 0
    ? lowestAttendanceStudents
        .map(
          (s, idx) =>
            `${idx + 1}. ${s.name} (${s.className}) - Kehadiran: ${s.persentaseHadir}% (Hadir: ${s.hadir}, Sakit: ${s.sakit}, Izin: ${s.izin}, Alfa: ${s.alfa})`
        )
        .join('\n')
    : 'Semua siswa memiliki kehadiran optimal atau data belum cukup.'
}

[DAFTAR RINGKAS SISWA & REKAP KEHADIRAN]
${allStatsList
  .map(
    (s) =>
      `- ${s.name} (${s.className}): Hadir=${s.hadir}, Sakit=${s.sakit}, Izin=${s.izin}, Alfa=${s.alfa}, Terlambat=${s.terlambat}, %Kehadiran=${s.persentaseHadir}%`
  )
  .join('\n')}

[REKAP TANGGAL PRESENSI TERAKHIR (${recentDates.length} HARI)]
${recentDates
  .map((date) => {
    const list = recordsByDate[date] || [];
    const h = list.filter((r) => r.status === 'Hadir').length;
    const s = list.filter((r) => r.status === 'Sakit').length;
    const i = list.filter((r) => r.status === 'Izin').length;
    const a = list.filter((r) => r.status === 'Alfa').length;
    const telat = list.filter(isLateRecord).length;
    const absentees = list
      .filter((r) => r.status !== 'Hadir')
      .map((r) => `${r.studentName || 'Siswa'}(${r.status})`)
      .join(', ');
    return `${date}: Hadir=${h}, Sakit=${s}, Izin=${i}, Alfa=${a}, Terlambat=${telat}${absentees ? ` [Tidak Hadir: ${absentees}]` : ''}`;
  })
  .join('\n')}`;

  return context;
}
