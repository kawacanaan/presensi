import React, { useState } from 'react';
import { 
  X, 
  QrCode, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Download, 
  Search, 
  Sparkles,
  Smartphone,
  Send,
  User,
  ShieldCheck,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { StudentAttendance } from '../types';

interface LiveDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ID' | 'EN';
}

export const LiveDemoModal: React.FC<LiveDemoModalProps> = ({ isOpen, onClose, lang }) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'dashboard' | 'wa'>('scan');
  const [selectedStudent, setSelectedStudent] = useState<string>('std-1');
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentAttendance[]>([
    {
      id: 'std-1',
      name: 'Muhammad Fathan Al-Ghifari',
      nisn: '0129384751',
      className: lang === 'ID' ? 'Kelas 4A (SDN 01)' : 'Grade 4A (Primary 01)',
      time: '06:48 WIB',
      status: 'hadir',
      parentPhone: '0812-3456-7890',
    },
    {
      id: 'std-2',
      name: 'Aisyah Putri Rahmadani',
      nisn: '0129384752',
      className: lang === 'ID' ? 'Kelas 3B (SDN 01)' : 'Grade 3B (Primary 01)',
      time: '06:55 WIB',
      status: 'hadir',
      parentPhone: '0813-8877-6655',
    },
    {
      id: 'std-3',
      name: 'Kenzo Ardiansyah',
      nisn: '0129384753',
      className: lang === 'ID' ? 'Kelas 1A (SDN 01)' : 'Grade 1A (Primary 01)',
      time: '07:02 WIB',
      status: 'hadir',
      parentPhone: '0821-4455-6677',
    },
    {
      id: 'std-4',
      name: 'Nayla Salsabila',
      nisn: '0129384754',
      className: lang === 'ID' ? 'Kelas 5C (SDN 01)' : 'Grade 5C (Primary 01)',
      time: '07:12 WIB',
      status: 'terlambat',
      parentPhone: '0857-1122-3344',
    },
    {
      id: 'std-5',
      name: 'Raditya Putra Wicaksana',
      nisn: '0129384755',
      className: lang === 'ID' ? 'Kelas 6A (SDN 01)' : 'Grade 6A (Primary 01)',
      time: '-',
      status: 'izin',
      parentPhone: '0878-9988-7766',
    },
  ]);

  if (!isOpen) return null;

  const currentStudentData = students.find((s) => s.id === selectedStudent) || students[0];

  const handleSimulateQRScan = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`;

    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, time: timeStr, status: 'hadir' } : s))
    );
    setSelectedStudent(studentId);
    setScanSuccessMessage(
      lang === 'ID'
        ? `✓ Berhasil Presensi: ${student.name} (${timeStr}) — Notifikasi WhatsApp otomatis terkirim ke orang tua!`
        : `✓ Attendance Recorded: ${student.name} (${timeStr}) — Automated WhatsApp message sent to parent!`
    );

    setTimeout(() => {
      setScanSuccessMessage(null);
    }, 4500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden text-slate-900 flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="bg-[#0B2F64] px-6 py-4 border-b border-blue-900 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-black text-sm">
              K
            </div>
            <div>
              <h3 className="font-black uppercase tracking-tight text-white text-base">
                Interactive Live Demo — Kawacanaan
              </h3>
              <p className="text-xs text-blue-200">
                {lang === 'ID' ? 'Simulasi sistem presensi digital sekolah' : 'Digital school attendance system simulation'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded bg-blue-900 text-blue-200 hover:text-white hover:bg-blue-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-[11px] font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('scan')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'scan'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>{lang === 'ID' ? '1. Simulasi Scanner QR' : '1. QR Scanner Simulation'}</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{lang === 'ID' ? '2. Dashboard Rekap SD' : '2. Attendance Dashboard'}</span>
          </button>

          <button
            onClick={() => setActiveTab('wa')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'wa'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{lang === 'ID' ? '3. Notifikasi WhatsApp' : '3. WhatsApp Notification'}</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          
          {/* Notification feedback banner */}
          {scanSuccessMessage && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{scanSuccessMessage}</span>
            </div>
          )}

          {/* TAB 1: QR SCANNER SIMULATOR */}
          {activeTab === 'scan' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Left: Interactive QR Scanner Simulator */}
                <div className="md:col-span-6 bg-white p-5 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      {lang === 'ID' ? 'Kamera Pemindai Gerbang SD' : 'School Gate QR Scanner'}
                    </span>
                    <span className="text-[9px] text-blue-700 bg-blue-50 border border-blue-200 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                      {lang === 'ID' ? 'STANDBY' : 'READY'}
                    </span>
                  </div>

                  {/* Scanner Visual Frame */}
                  <div className="relative aspect-4/3 bg-slate-950 rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-4 overflow-hidden group">
                    <div className="absolute inset-x-8 top-1/4 bottom-1/4 border-2 border-blue-400 rounded pointer-events-none">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-300"></div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-300"></div>
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-300"></div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-300"></div>
                      {/* Laser scanner line animation */}
                      <div className="w-full h-0.5 bg-blue-400 shadow-[0_0_10px_#3b82f6] animate-pulse"></div>
                    </div>

                    <QrCode className="w-16 h-16 text-slate-700 mb-2 group-hover:text-blue-400/50 transition-colors" />
                    <span className="text-xs text-slate-300 text-center max-w-xs font-normal">
                      {lang === 'ID' ? (
                        <>Arahkan QR Card Siswa atau klik <strong className="text-white">Scan Now</strong> di daftar siswa</>
                      ) : (
                        <>Point Student QR Card or click <strong className="text-white">Scan Now</strong> in the student list</>
                      )}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    💡 <strong>{lang === 'ID' ? 'Kecepatan Scan:' : 'Scan Speed:'}</strong> {lang === 'ID' ? '0.3 detik per siswa. Mendukung kartu fisik ber-QR, barcode kartu pelajar SD, atau kamera smartphone guru piket.' : '0.3s per student. Supports QR cards, school ID barcodes, or duty teacher smartphone cameras.'}
                  </p>
                </div>

                {/* Right: List of SD Students ready to scan */}
                <div className="md:col-span-6 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    <span>{lang === 'ID' ? 'Pilih Siswa SD untuk Di-Scan:' : 'Select Student to Scan:'}</span>
                    <span className="text-slate-500">{lang === 'ID' ? '5 Siswa Demo' : '5 Demo Students'}</span>
                  </div>

                  <div className="space-y-2">
                    {students.map((student) => (
                      <div
                        key={student.id}
                        className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                          selectedStudent === student.id
                            ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                        onClick={() => setSelectedStudent(student.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-800 text-xs">
                            {student.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {student.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              NISN: {student.nisn} • <span className="text-blue-700 font-semibold">{student.className}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              student.status === 'hadir'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : student.status === 'terlambat'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {student.status === 'hadir' ? (lang === 'ID' ? 'hadir' : 'present') : student.status === 'terlambat' ? (lang === 'ID' ? 'terlambat' : 'late') : (lang === 'ID' ? 'izin' : 'excused')} ({student.time})
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSimulateQRScan(student.id);
                            }}
                            className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Scan Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* TAB 2: DASHBOARD WALI KELAS & REKAP */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {lang === 'ID' ? 'Total Siswa SD' : 'Total Students'}
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">1.234</div>
                  <div className="text-[10px] text-slate-500">{lang === 'ID' ? 'Kelas 1 s/d 6' : 'Grades 1 to 6'}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {lang === 'ID' ? 'Hadir Hari Ini' : 'Present Today'}
                  </div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">1.215</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">{lang === 'ID' ? '98.4% Kehadiran' : '98.4% Attendance'}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {lang === 'ID' ? 'Izin / Sakit' : 'Excused / Sick'}
                  </div>
                  <div className="text-2xl font-black text-amber-600 mt-1">19</div>
                  <div className="text-[10px] text-amber-700">{lang === 'ID' ? 'Surat Terverifikasi' : 'Verified Notes'}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {lang === 'ID' ? 'Alpa (Tanpa Ket.)' : 'Unexcused'}
                  </div>
                  <div className="text-2xl font-black text-slate-400 mt-1">0</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">{lang === 'ID' ? 'Disiplin Tinggi' : 'High Discipline'}</div>
                </div>
              </div>

              {/* Table of Classes SD */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="font-bold text-xs uppercase tracking-wider text-[#0B2F64]">
                    {lang === 'ID' ? 'Rekap Kehadiran Real-time per Rombel SD' : 'Real-time Attendance Recap per Classroom'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
                    </button>
                    <button className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                      <FileText className="w-3.5 h-3.5" /> Download PDF
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                      <tr>
                        <th className="p-3">{lang === 'ID' ? 'Kelas' : 'Class'}</th>
                        <th className="p-3">{lang === 'ID' ? 'Wali Kelas' : 'Homeroom Teacher'}</th>
                        <th className="p-3 text-center">{lang === 'ID' ? 'Jumlah Siswa' : 'Total Students'}</th>
                        <th className="p-3 text-center text-emerald-700">{lang === 'ID' ? 'Hadir' : 'Present'}</th>
                        <th className="p-3 text-center text-amber-700">{lang === 'ID' ? 'Sakit/Izin' : 'Sick/Excused'}</th>
                        <th className="p-3 text-center">{lang === 'ID' ? 'Persentase' : 'Percentage'}</th>
                        <th className="p-3 text-right">{lang === 'ID' ? 'Aksi' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      <tr className="hover:bg-slate-50/80">
                        <td className="p-3 font-bold text-slate-900">{lang === 'ID' ? 'Kelas 1A' : 'Grade 1A'}</td>
                        <td className="p-3">Ibu Nurhasanah, S.Pd.SD</td>
                        <td className="p-3 text-center">28</td>
                        <td className="p-3 text-center text-emerald-700 font-bold">28</td>
                        <td className="p-3 text-center text-slate-400">0</td>
                        <td className="p-3 text-center text-emerald-700 font-bold">100%</td>
                        <td className="p-3 text-right">
                          <span className="text-blue-700 hover:text-blue-900 font-bold uppercase tracking-wider text-[10px] cursor-pointer">
                            {lang === 'ID' ? 'Rincian →' : 'Details →'}
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/80">
                        <td className="p-3 font-bold text-slate-900">{lang === 'ID' ? 'Kelas 2B' : 'Grade 2B'}</td>
                        <td className="p-3">Bpk. Slamet Riyadi, S.Pd.</td>
                        <td className="p-3 text-center">30</td>
                        <td className="p-3 text-center text-emerald-700 font-bold">29</td>
                        <td className="p-3 text-center text-amber-700 font-bold">1 ({lang === 'ID' ? 'Sakit' : 'Sick'})</td>
                        <td className="p-3 text-center text-blue-700 font-bold">96.7%</td>
                        <td className="p-3 text-right">
                          <span className="text-blue-700 hover:text-blue-900 font-bold uppercase tracking-wider text-[10px] cursor-pointer">
                            {lang === 'ID' ? 'Rincian →' : 'Details →'}
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/80">
                        <td className="p-3 font-bold text-slate-900">{lang === 'ID' ? 'Kelas 4A' : 'Grade 4A'}</td>
                        <td className="p-3">Ibu Dewi Anggraeni, M.Pd.</td>
                        <td className="p-3 text-center">32</td>
                        <td className="p-3 text-center text-emerald-700 font-bold">32</td>
                        <td className="p-3 text-center text-slate-400">0</td>
                        <td className="p-3 text-center text-emerald-700 font-bold">100%</td>
                        <td className="p-3 text-right">
                          <span className="text-blue-700 hover:text-blue-900 font-bold uppercase tracking-wider text-[10px] cursor-pointer">
                            {lang === 'ID' ? 'Rincian →' : 'Details →'}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SIMULASI NOTIFIKASI WHATSAPP WALI MURID */}
          {activeTab === 'wa' && (
            <div className="max-w-md mx-auto bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-sm">
              <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  {lang === 'ID' ? 'Notifikasi WA Orang Tua' : 'Parent WhatsApp Notification'}
                </span>
                <span className="text-[9px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold uppercase tracking-wider">
                  {lang === 'ID' ? 'Otomatis' : 'Automated'}
                </span>
              </div>

              {/* WhatsApp Chat Box */}
              <div className="bg-[#e5ddd5] p-3.5 rounded-lg border border-slate-300 space-y-3 text-slate-900 font-sans">
                
                {/* School Sender Header */}
                <div className="flex items-center gap-2 pb-2 border-b border-slate-300">
                  <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                    KA
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">SD Kawacanaan Official Bot</div>
                    <div className="text-[9px] text-emerald-700 font-semibold">
                      {lang === 'ID' ? 'Terverifikasi • Akun Resmi' : 'Verified • Official Account'}
                    </div>
                  </div>
                </div>

                {/* Message Bubble */}
                <div className="bg-white p-3 rounded-lg rounded-tl-none text-xs space-y-2 border border-slate-200 shadow-xs">
                  <div className="font-bold text-emerald-700">
                    🟢 {lang === 'ID' ? 'NOTIFIKASI KEHADIRAN SISWA' : 'STUDENT ATTENDANCE NOTIFICATION'}
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    {lang === 'ID' ? (
                      <>Yth. Bapak/Ibu Orang Tua / Wali dari <strong>{currentStudentData.name}</strong>,</>
                    ) : (
                      <>Dear Parents / Guardians of <strong>{currentStudentData.name}</strong>,</>
                    )}
                  </p>
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[10px] space-y-1">
                    <div>📌 <strong>{lang === 'ID' ? 'Nama:' : 'Name:'}</strong> {currentStudentData.name}</div>
                    <div>🏫 <strong>{lang === 'ID' ? 'Kelas:' : 'Class:'}</strong> {currentStudentData.className}</div>
                    <div>⏰ <strong>{lang === 'ID' ? 'Waktu Scan Masuk:' : 'Check-in Scan Time:'}</strong> {currentStudentData.time}</div>
                    <div>📍 <strong>{lang === 'ID' ? 'Lokasi:' : 'Location:'}</strong> {lang === 'ID' ? 'Gerbang Utama SD Kawacanaan' : 'Main Entrance Gate'}</div>
                    <div>📊 <strong>{lang === 'ID' ? 'Status:' : 'Status:'}</strong> <span className="text-emerald-700 uppercase font-bold">{currentStudentData.status === 'hadir' ? (lang === 'ID' ? 'hadir' : 'present') : currentStudentData.status}</span></div>
                  </div>
                  <p className="text-[10px] text-slate-600">
                    {lang === 'ID'
                      ? 'Ananda telah tiba di sekolah dengan selamat dan siap mengikuti proses pembelajaran. Terima kasih.'
                      : 'The student has safely arrived at school and is ready for class activities. Thank you.'}
                  </p>
                  <div className="text-[9px] text-slate-400 text-right font-medium">07:15 ✓✓</div>
                </div>

              </div>

              <p className="text-[11px] text-slate-500 text-center">
                {lang === 'ID'
                  ? '*Notifikasi dikirim melalui integrasi WhatsApp Gateway resmi tanpa perlu install aplikasi tambahan di HP orang tua.'
                  : '*Notifications are dispatched through an official WhatsApp Gateway without requiring parents to install extra apps.'}
              </p>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="text-[11px] font-medium">
            {lang === 'ID' ? 'Tertarik mengaplikasikan di sekolah Anda?' : 'Interested in implementing this in your school?'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs"
          >
            {lang === 'ID' ? 'Tutup Demo & Mulai Uji Coba' : 'Close Demo & Start Free Trial'}
          </button>
        </div>
      </div>
    </div>
  );
};
