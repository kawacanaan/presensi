import React, { useState } from 'react';
import { 
   Users, 
   UserCheck, 
   AlertCircle, 
   Clock, 
   Calendar, 
   CheckCircle2, 
   BarChart3, 
   FileSpreadsheet, 
   ShieldCheck, 
   BookOpen, 
   School, 
   FileCheck 
} from 'lucide-react';

interface DeviceMockupProps {
  lang?: 'ID' | 'EN';
}

export const DeviceMockup: React.FC<DeviceMockupProps> = ({ lang = 'ID' }) => {
  const [scannedFeedback, setScannedFeedback] = useState(false);

  const handleSimulateCheckIn = () => {
    setScannedFeedback(true);
    setTimeout(() => setScannedFeedback(false), 2000);
  };

  return (
    <div className="relative w-full max-w-[640px] mx-auto select-none">
      {/* Educational Blue Blur Accents */}
      <div className="absolute -top-10 -left-10 w-80 h-80 bg-blue-200/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-80 h-80 bg-sky-200/50 rounded-full blur-3xl pointer-events-none" />

      {/* Educational Vertical Label Marker */}
      <div className="absolute top-28 -left-14 rotate-[-90deg] text-[9px] uppercase tracking-[0.35em] font-bold text-blue-900/40 hidden sm:block select-none pointer-events-none">
        Kawacanaan Presensi
      </div>

      {/* 3D Container with perspective: flattened on mobile to prevent excessive vertical height */}
      <div className="relative flex items-center justify-center sm:[perspective:1400px]">
        
        {/* ===================== LAPTOP MOCKUP: WEB ADMIN & WALI KELAS SD ===================== */}
        <div 
          className="w-full sm:w-[92%] transition-transform duration-500 hover:scale-[1.01] transform-none sm:[transform:rotateY(-5deg)_rotateX(3deg)_translateZ(0px)] sm:[transform-style:preserve-3d]"
        >
          {/* Laptop Screen Bezel - Deep Navy Educational Style */}
          <div className="relative bg-[#0B1E3F] rounded-t-xl sm:rounded-t-2xl p-2 sm:p-3 border sm:border-2 border-blue-950 shadow-[0_10px_30px_-10px_rgba(11,30,63,0.3)] sm:shadow-[0_20px_50px_-15px_rgba(11,30,63,0.4)] backdrop-blur-md">
            {/* Webcam & Mic */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700 ring-1 ring-slate-600"></div>
              <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse"></div>
            </div>

            {/* Laptop Screen Content: WEB ADMIN & WALI KELAS SD */}
            <div className="bg-white rounded-lg overflow-hidden border border-slate-200 text-slate-900 font-sans text-xs shadow-xs">
              
              {/* Browser Address / Top bar */}
              <div className="bg-slate-100 px-2 sm:px-3 py-1 sm:py-1.5 border-b border-slate-200 flex items-center justify-between text-[9px] sm:text-[10px] text-slate-500">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-400 inline-block"></span>
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400 inline-block"></span>
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="ml-1 sm:ml-2 font-mono text-[8px] sm:text-[9px] text-slate-500 truncate max-w-[120px] sm:max-w-[200px]">
                    https://sdn01merdeka.kawacanaan.sch.id
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[10px] text-blue-800 font-bold uppercase tracking-wider truncate max-w-[90px] sm:max-w-none">
                  <School className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-700 shrink-0" />
                  <span className="truncate">{lang === 'ID' ? 'SDN 01 MERDEKA' : 'PRIMARY 01 MERDEKA'}</span>
                </div>
              </div>

              {/* Dashboard Layout - Ultra-compact vertical footprint on mobile < 375px */}
              <div className="flex min-h-[170px] min-[360px]:min-h-[195px] xs:min-h-[250px] sm:min-h-[340px]">
                {/* Left Mini Sidebar with required modules */}
                <div className="w-10 xs:w-12 sm:w-36 bg-slate-50 border-r border-slate-200 p-1.5 sm:p-2 flex flex-col justify-between shrink-0 text-left">
                  <div className="space-y-1 sm:space-y-1.5">
                    {/* Brand */}
                    <div className="flex items-center gap-1.5 pb-1 sm:pb-2 mb-1 sm:mb-2 border-b border-slate-200 px-0.5 sm:px-1">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-blue-700 flex items-center justify-center font-black text-white text-[9px] sm:text-[10px]">
                        K
                      </div>
                      <span className="hidden sm:inline font-bold text-slate-900 text-[11px] tracking-tight truncate uppercase">
                        Kawacanaan
                      </span>
                    </div>

                    {/* Navigation Items in Mockup */}
                    <div className="bg-blue-700 text-white rounded p-1.5 flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider shadow-xs">
                      <BarChart3 className="w-3 h-3 shrink-0" />
                      <span className="hidden sm:inline">{lang === 'ID' ? 'Ringkasan SD' : 'Summary'}</span>
                    </div>

                    <div className="text-slate-600 p-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider">
                      <Clock className="w-3 h-3 shrink-0 text-slate-500" />
                      <span className="hidden sm:inline">{lang === 'ID' ? 'Presensi Harian' : 'Daily Logs'}</span>
                    </div>

                    <div className="text-slate-600 p-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider">
                      <BookOpen className="w-3 h-3 shrink-0 text-slate-500" />
                      <span className="hidden sm:inline">{lang === 'ID' ? 'Mapel (PJOK/Agama)' : 'Subjects'}</span>
                    </div>

                    <div className="text-slate-600 p-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider">
                      <Users className="w-3 h-3 shrink-0 text-slate-500" />
                      <span className="hidden sm:inline">{lang === 'ID' ? 'Rombel 1-6' : 'Classes 1-6'}</span>
                    </div>

                    <div className="text-slate-600 p-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider">
                      <Calendar className="w-3 h-3 shrink-0 text-slate-500" />
                      <span className="hidden sm:inline">{lang === 'ID' ? 'Hari Efektif' : 'School Days'}</span>
                    </div>

                    <div className="text-slate-600 p-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider">
                      <FileSpreadsheet className="w-3 h-3 shrink-0 text-slate-500" />
                      <span className="hidden sm:inline">{lang === 'ID' ? 'Cetak Kedinasan' : 'Kedinasan Reports'}</span>
                    </div>
                  </div>

                  {/* Profile info footer in Mockup */}
                  <div className="pt-1.5 sm:pt-2 border-t border-slate-200 hidden sm:flex items-center gap-1.5 px-1">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[9px] text-blue-800">
                      WK
                    </div>
                    <div className="text-left overflow-hidden">
                      <div className="font-bold text-[9px] text-slate-900 truncate">Ibu Sri Rahayu</div>
                      <div className="text-[8px] text-slate-500 truncate">{lang === 'ID' ? 'Wali Kelas 4-B' : 'Grade 4-B Teacher'}</div>
                    </div>
                  </div>
                </div>

                {/* Right Dashboard Area */}
                <div className="flex-1 p-2 sm:p-3 bg-white space-y-1.5 sm:space-y-3 overflow-hidden text-left">
                  
                  {/* Top Stats Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1 sm:pb-2">
                    <div>
                      <h4 className="font-black uppercase tracking-tight text-[#0B2F64] text-[11px] sm:text-sm">
                        {lang === 'ID' ? 'Presensi Kelas 4-B' : 'Grade 4-B Attendance'}
                      </h4>
                      <p className="text-[8px] sm:text-[9px] text-slate-500">
                        {lang === 'ID' ? 'Semester Ganjil 2026/2027 • 28 Siswa' : 'Odd Semester 2026/2027 • 28 Students'}
                      </p>
                    </div>
                    <span className="px-1.5 sm:px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[8px] sm:text-[9px] font-bold">
                      22 {lang === 'ID' ? 'Hari Efektif' : 'Effective Days'}
                    </span>
                  </div>

                  {/* 4 Summary Stat Boxes */}
                  <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                    <div className="p-1 sm:p-1.5 bg-emerald-50 border border-emerald-100 rounded text-left">
                      <div className="text-[7px] sm:text-[8px] uppercase font-bold text-emerald-800">{lang === 'ID' ? 'Hadir' : 'Present'}</div>
                      <div className="text-[11px] sm:text-xs font-black text-emerald-950">27</div>
                    </div>
                    <div className="p-1 sm:p-1.5 bg-amber-50 border border-amber-100 rounded text-left">
                      <div className="text-[7px] sm:text-[8px] uppercase font-bold text-amber-800">{lang === 'ID' ? 'Sakit' : 'Sick'}</div>
                      <div className="text-[11px] sm:text-xs font-black text-amber-950">1</div>
                    </div>
                    <div className="p-1 sm:p-1.5 bg-blue-50 border border-blue-100 rounded text-left">
                      <div className="text-[7px] sm:text-[8px] uppercase font-bold text-blue-800">{lang === 'ID' ? 'Izin' : 'Permit'}</div>
                      <div className="text-[11px] sm:text-xs font-black text-blue-950">0</div>
                    </div>
                    <div className="p-1 sm:p-1.5 bg-rose-50 border border-rose-100 rounded text-left">
                      <div className="text-[7px] sm:text-[8px] uppercase font-bold text-rose-800">{lang === 'ID' ? 'Alfa' : 'Absent'}</div>
                      <div className="text-[11px] sm:text-xs font-black text-rose-950">0</div>
                    </div>
                  </div>

                  {/* Attendance Table Preview */}
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <div className="bg-slate-100 px-2 py-0.5 sm:py-1 flex items-center justify-between text-[7px] sm:text-[8px] font-bold text-slate-700 uppercase">
                      <span>{lang === 'ID' ? 'Daftar Siswa Kelas 4-B' : 'Grade 4-B Student List'}</span>
                      <span className="text-blue-700">{lang === 'ID' ? 'Status Harian' : 'Daily Status'}</span>
                    </div>
                    <div className="divide-y divide-slate-100 text-[8px]">
                      <div className="p-1 sm:p-1.5 flex items-center justify-between bg-white">
                        <div className="truncate max-w-[110px] sm:max-w-none">
                          <span className="font-bold text-slate-900">01. Ahmad Fathan</span>
                          <span className="text-slate-400 ml-1 hidden min-[400px]:inline">NISN: 0129384751</span>
                        </div>
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[7px] sm:text-[8px] shrink-0">
                          {lang === 'ID' ? 'Hadir (06:48)' : 'Present (06:48)'}
                        </span>
                      </div>
                      <div className="p-1 sm:p-1.5 flex items-center justify-between bg-slate-50/50">
                        <div className="truncate max-w-[110px] sm:max-w-none">
                          <span className="font-bold text-slate-900">02. Aisyah Putri</span>
                          <span className="text-slate-400 ml-1 hidden min-[400px]:inline">NISN: 0129384752</span>
                        </div>
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[7px] sm:text-[8px] shrink-0">
                          {lang === 'ID' ? 'Hadir (06:55)' : 'Present (06:55)'}
                        </span>
                      </div>
                      <div className="p-1 sm:p-1.5 hidden xs:flex items-center justify-between bg-white">
                        <div className="truncate max-w-[110px] sm:max-w-none">
                          <span className="font-bold text-slate-900">03. Bilqis Humaira</span>
                          <span className="text-slate-400 ml-1 hidden min-[400px]:inline">NISN: 0129384753</span>
                        </div>
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[7px] sm:text-[8px] shrink-0">
                          {lang === 'ID' ? 'Sakit (Ket. Dokter)' : 'Sick (Doctor Note)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Footer */}
                  <div className="p-1 sm:p-2 bg-blue-50/50 border border-blue-200 rounded flex items-center justify-between text-[7px] sm:text-[8px] text-slate-600">
                    <span className="flex items-center gap-1 font-semibold truncate">
                      <FileCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="truncate">{lang === 'ID' ? 'Format Cetak A4 Kedinasan' : 'Kedinasan A4 Printable'}</span>
                    </span>
                    <span className="font-mono font-bold text-blue-800 shrink-0">96.4% Kehadiran</span>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Laptop Base Stand */}
          <div className="relative -mt-0.5 h-3.5 sm:h-5 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 rounded-b-xl shadow-lg flex items-center justify-center border-t border-slate-600">
            <div className="w-14 sm:w-24 h-1 bg-slate-950/60 rounded-full"></div>
          </div>
        </div>

        {/* ===================== SMARTPHONE MOCKUP: PORTAL PRESENSI SISWA SD ===================== */}
        <div 
          className="absolute -right-1 xs:-right-2 sm:-right-4 -bottom-2 sm:-bottom-8 w-[115px] min-[360px]:w-[135px] xs:w-[175px] sm:w-[225px] md:w-[245px] transition-all duration-500 hover:scale-[1.03] z-20 transform-none sm:[transform:rotateY(-10deg)_rotateX(4deg)_translateZ(40px)] sm:[transform-style:preserve-3d]"
        >
          {/* Phone Frame */}
          <div className="relative bg-slate-950 rounded-[18px] xs:rounded-[34px] sm:rounded-[40px] p-1 xs:p-2 sm:p-2.5 border-2 xs:border-[3px] sm:border-4 border-slate-800 shadow-[0_12px_30px_rgba(15,23,42,0.3)] sm:shadow-[0_25px_60px_rgba(15,23,42,0.35)] ring-1 ring-slate-700">
            
            {/* Dynamic Island Notch */}
            <div className="absolute top-1.5 xs:top-2 sm:top-3 left-1/2 -translate-x-1/2 w-8 xs:w-16 sm:w-20 h-2 xs:h-2.5 sm:h-4 bg-slate-900 rounded-full flex items-center justify-center z-30 ring-1 ring-slate-800">
              <div className="w-1 xs:w-1.5 sm:w-2.5 h-1 xs:h-1.5 sm:h-2.5 rounded-full bg-slate-950 mr-0.5 xs:mr-1 sm:mr-1.5"></div>
              <div className="w-0.5 xs:w-1 sm:w-1.5 h-0.5 xs:h-1 sm:h-1.5 rounded-full bg-blue-500"></div>
            </div>

            {/* Phone Screen: PORTAL PRESENSI SISWA SD */}
            <div className="relative bg-white rounded-[14px] xs:rounded-[28px] sm:rounded-[32px] overflow-hidden text-slate-900 font-sans text-xs border border-slate-200 flex flex-col justify-between min-h-[195px] min-[360px]:min-h-[220px] xs:min-h-[300px] sm:min-h-[460px]">
              
              {/* Header: Portal Presensi Siswa & Nama Siswa */}
              <div className="bg-[#0B2F64] p-2 xs:p-3 pt-3.5 xs:pt-6 rounded-b-xl sm:rounded-b-2xl shadow-xs text-white">
                <div className="flex items-center justify-between text-[8px] xs:text-[10px] text-blue-200 mb-1 xs:mb-2">
                  <span className="font-bold">07:15</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] xs:text-[9px] font-bold">4G</span>
                    <div className="w-2.5 xs:w-3.5 h-1.5 xs:h-2 border border-white rounded-xs p-0.5 flex items-center">
                      <div className="w-full h-full bg-emerald-400 rounded-xs"></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <div className="text-[7px] xs:text-[8px] text-blue-200 uppercase tracking-widest font-bold">
                      {lang === 'ID' ? 'PORTAL SISWA SD' : 'SD STUDENT PORTAL'}
                    </div>
                    <div className="font-black text-white text-[10px] xs:text-xs sm:text-sm truncate max-w-[80px] xs:max-w-none">Ahmad Fathan</div>
                    <div className="text-[7px] xs:text-[9px] text-blue-200/80 truncate max-w-[80px] xs:max-w-none">
                      {lang === 'ID' ? 'Kelas 4-B' : 'Grade 4-B'}
                    </div>
                  </div>
                  <div className="w-6 h-6 xs:w-8 xs:h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-[9px] xs:text-xs shadow border border-blue-400/40 shrink-0">
                    AF
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-1.5 xs:p-2.5 sm:p-3 space-y-1 xs:space-y-2 sm:space-y-2.5 flex-1 bg-slate-50 overflow-y-auto text-left">
                
                {/* Status Kehadiran Hari Ini */}
                <div className="bg-white border border-slate-200 rounded-lg sm:rounded-xl p-1.5 xs:p-2 sm:p-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[7px] xs:text-[8px] uppercase font-bold text-slate-400">{lang === 'ID' ? 'Status Hari Ini' : 'Today Status'}</div>
                      <div className="font-black text-slate-900 text-[9px] xs:text-xs sm:text-sm">
                        {lang === 'ID' ? 'Hadir Terverifikasi' : 'Present Verified'}
                      </div>
                      <div className="text-[7px] xs:text-[8px] text-emerald-600 font-bold flex items-center gap-0.5 mt-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                        <span>06:48 WIB</span>
                      </div>
                    </div>
                    <div className="w-5 h-5 xs:w-7 xs:h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3 h-3 xs:w-4 xs:h-4" />
                    </div>
                  </div>
                </div>

                {/* Tombol Presensi Masuk & Tombol Presensi Pulang */}
                <div className="grid grid-cols-2 gap-1 xs:gap-1.5">
                  <button
                    type="button"
                    onClick={handleSimulateCheckIn}
                    className="p-1 xs:p-2 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white rounded-md xs:rounded-lg text-center cursor-pointer transition-all shadow-xs"
                  >
                    <div className="text-[6px] xs:text-[8px] uppercase font-bold text-blue-200">{lang === 'ID' ? 'Presensi' : 'Check-In'}</div>
                    <div className="text-[8px] xs:text-[10px] font-black tracking-wide flex items-center justify-center gap-0.5 xs:gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 xs:w-3 xs:h-3" /> {lang === 'ID' ? 'Masuk' : 'Entry'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleSimulateCheckIn}
                    className="p-1 xs:p-2 bg-[#0B2F64] hover:bg-blue-950 active:scale-95 text-white rounded-md xs:rounded-lg text-center cursor-pointer transition-all shadow-xs"
                  >
                    <div className="text-[6px] xs:text-[8px] uppercase font-bold text-blue-300">{lang === 'ID' ? 'Presensi' : 'Check-Out'}</div>
                    <div className="text-[8px] xs:text-[10px] font-black tracking-wide flex items-center justify-center gap-0.5 xs:gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 xs:w-3 xs:h-3" /> {lang === 'ID' ? 'Pulang' : 'Exit'}
                    </div>
                  </button>
                </div>

                {/* Feedback simulation indicator */}
                {scannedFeedback && (
                  <div className="p-1 xs:p-1.5 bg-emerald-100 text-emerald-800 rounded text-center text-[7px] xs:text-[9px] font-bold">
                    ✓ {lang === 'ID' ? 'Data presensi disinkronkan!' : 'Attendance synchronized!'}
                  </div>
                )}

                {/* Jadwal Mapel Hari Ini */}
                <div className="bg-white border border-slate-200 rounded-lg sm:rounded-xl p-1.5 xs:p-2 sm:p-2.5 space-y-1 sm:space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[7px] xs:text-[9px]">
                    <span className="font-bold text-[#0B2F64] uppercase tracking-wider flex items-center gap-0.5 xs:gap-1">
                      <BookOpen className="w-2.5 h-2.5 xs:w-3 xs:h-3 text-blue-700" />
                      <span>{lang === 'ID' ? 'Mapel Hari Ini' : 'Today Subjects'}</span>
                    </span>
                    <span className="text-[7px] xs:text-[8px] text-blue-700 font-bold uppercase tracking-wider">
                      Kelas 4-B
                    </span>
                  </div>
                  <div className="space-y-0.5 xs:space-y-1 text-[7px] xs:text-[8px] text-slate-600">
                    <div className="flex justify-between p-0.5 xs:p-1 bg-slate-50 rounded">
                      <span className="truncate max-w-[65px] xs:max-w-none">07:30 PJOK</span>
                      <span className="text-emerald-700 font-bold shrink-0">Hadir</span>
                    </div>
                    <div className="flex justify-between p-0.5 xs:p-1 bg-slate-50 rounded">
                      <span className="truncate max-w-[65px] xs:max-w-none">09:15 PABP</span>
                      <span className="text-emerald-700 font-bold shrink-0">Hadir</span>
                    </div>
                  </div>
                </div>

                {/* Riwayat Kehadiran - ditutup di layar sangat kecil agar tidak memakan ruang vertikal */}
                <div className="hidden xs:block bg-white border border-slate-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 space-y-1 sm:space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="font-bold text-slate-900 uppercase tracking-wider">{lang === 'ID' ? 'Rekap Kehadiran' : 'Attendance Recap'}</span>
                    <span className="text-[8px] text-slate-400">{lang === 'ID' ? '21 / 22 Hari' : '21 / 22 Days'}</span>
                  </div>

                  <div className="space-y-1 text-[8px] xs:text-[9px]">
                    <div className="p-1 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-slate-700">
                      <span>{lang === 'ID' ? 'Rabu, 19 Agu' : 'Wed, Aug 19'}</span>
                      <span className="text-emerald-700 font-bold">{lang === 'ID' ? 'Hadir' : 'Present'}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Mobile Bottom Navigation Bar */}
              <div className="bg-white border-t border-slate-200 p-1 xs:p-1.5 sm:p-2 px-1.5 xs:px-2.5 sm:px-3 flex items-center justify-between text-[6px] xs:text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                <div className="flex flex-col items-center text-blue-700">
                  <div className="w-2 xs:w-3.5 h-2 xs:h-3.5 flex items-center justify-center font-black">●</div>
                  <span>{lang === 'ID' ? 'Beranda' : 'Home'}</span>
                </div>
                <div className="flex flex-col items-center">
                  <AlertCircle className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                  <span>{lang === 'ID' ? 'Izin' : 'Leave'}</span>
                </div>
                <div className="flex flex-col items-center">
                  <Calendar className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                  <span>{lang === 'ID' ? 'Riwayat' : 'History'}</span>
                </div>
                <div className="flex flex-col items-center">
                  <UserCheck className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                  <span>{lang === 'ID' ? 'Profil' : 'Profile'}</span>
                </div>
              </div>

              {/* iPhone Home Bar Indicator */}
              <div className="w-12 xs:w-16 sm:w-20 h-0.5 sm:h-1 bg-slate-300 rounded-full mx-auto my-0.5 sm:my-1"></div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

