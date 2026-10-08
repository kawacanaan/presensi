import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Send,
  Upload,
  Image as ImageIcon,
  FileText,
  Calendar,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HeartPulse,
  Info,
  ChevronDown,
} from 'lucide-react';
import type { Student, StudentLeaveRequest } from '../types';

interface ParentLeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  onSubmit: (req: Omit<StudentLeaveRequest, 'id' | 'status' | 'submittedAt'>) => Promise<{ success: boolean; message?: string }>;
  defaultDate?: string;
  allStudents?: Student[];
}

export const ParentLeaveRequestModal: React.FC<ParentLeaveRequestModalProps> = ({
  isOpen,
  onClose,
  student,
  onSubmit,
  defaultDate = new Date().toISOString().slice(0, 10),
  allStudents,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(student?.id || '');
  const [leaveType, setLeaveType] = useState<'sakit' | 'izin'>('sakit');
  const [subCategory, setSubCategory] = useState<string>('Sakit (Surat Dokter)');
  const [startDate, setStartDate] = useState<string>(defaultDate);
  const [endDate, setEndDate] = useState<string>(defaultDate);
  const [requesterName, setRequesterName] = useState<string>(student?.namaWali || '');
  const [requesterRole, setRequesterRole] = useState<'Ayah' | 'Ibu' | 'Wali' | 'Siswa'>(
    student?.hubungannya === 'Ibu' ? 'Ibu' : student?.hubungannya === 'Wali' ? 'Wali' : student?.hubungannya === 'Siswa' ? 'Siswa' : 'Ayah'
  );
  const [requesterPhone, setRequesterPhone] = useState<string>(student?.noHpWali || '');
  const [reason, setReason] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeStudent = useMemo(() => {
    if (allStudents && selectedStudentId) {
      const found = allStudents.find((s) => s.id === selectedStudentId);
      if (found) return found;
    }
    return student;
  }, [allStudents, selectedStudentId, student]);

  // Hitung jumlah hari izin/sakit
  const durationDays = useMemo(() => {
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const diffTime = e.getTime() - s.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 0 ? diffDays : 1;
    } catch {
      return 1;
    }
  }, [startDate, endDate]);

  if (!isOpen || !activeStudent) return null;

  const handleLeaveTypeChange = (type: 'sakit' | 'izin') => {
    setLeaveType(type);
    if (type === 'sakit') {
      setSubCategory('Sakit (Surat Dokter)');
    } else {
      setSubCategory('Acara Keluarga / Mendesak');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setErrorMsg('Harap pilih file gambar (JPG, PNG, WebP) atau berkas PDF surat.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal 8MB.');
      return;
    }

    setErrorMsg('');
    setAttachmentName(file.name);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxDim = 1400;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            setAttachmentUrl(compressed);
          } else {
            setAttachmentUrl(event.target?.result as string);
          }
        };
        img.onerror = () => {
          setAttachmentUrl(event.target?.result as string);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachmentUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachmentUrl('');
    setAttachmentName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Alasan pengajuan izin / sakit wajib diisi secara lengkap.');
      return;
    }
    if (!requesterName.trim()) {
      setErrorMsg('Nama Orang Tua / Wali pemohon wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await onSubmit({
        studentId: activeStudent.id,
        studentName: activeStudent.nama,
        nisn: activeStudent.nisn,
        classId: activeStudent.classId,
        className: activeStudent.className,
        requesterName: requesterName.trim(),
        requesterRole,
        requesterPhone: requesterPhone.trim() || undefined,
        leaveType,
        subCategory,
        startDate,
        endDate,
        reason: reason.trim(),
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
      });

      if (res.success) {
        onClose();
      } else if (res.message) {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengirim pengajuan surat izin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl my-auto overflow-hidden shadow-2xl border border-slate-200/90 flex flex-col max-h-[95vh] sm:max-h-[92vh]">
        
        {/* Header Dialog */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/10 border border-white/15 text-blue-300 flex items-center justify-center shadow-xs">
              <FileText size={20} className="sm:w-5.5 sm:h-5.5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg tracking-tight text-white leading-snug">
                Surat Permohonan Izin & Sakit
              </h3>
              <p className="text-xs text-blue-200/90 font-medium">
                Pencatatan resmi ketidakhadiran siswa terhubung langsung ke absensi sekolah
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            title="Tutup dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs font-sans">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in">
              <AlertCircle size={17} className="shrink-0 text-rose-600" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* Student Selector / Info Card */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                {activeStudent.nama?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Identitas Siswa
                </span>
                <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">
                  {activeStudent.nama}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span>Rombel {activeStudent.className || 'Kelas'}</span>
                  <span>•</span>
                  <span>NISN: {activeStudent.nisn || '-'}</span>
                </div>
              </div>
            </div>

            {/* Jika ada opsi pilih siswa (untuk admin / wali murid dengan banyak anak) */}
            {allStudents && allStudents.length > 1 && (
              <div className="sm:max-w-xs w-full">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Pilih Siswa</label>
                <div className="relative">
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                  >
                    {allStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({s.className || 'Kelas'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Responsive 2-Column Grid on Tablet/Laptop/Desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            
            {/* Left Column: Jenis Izin, Sub-kategori, Rentang Tanggal */}
            <div className="space-y-4">
              {/* Jenis Permohonan (Sakit vs Izin) */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Jenis Permohonan
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleLeaveTypeChange('sakit')}
                    className={`p-3 rounded-2xl border-2 font-black text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                      leaveType === 'sakit'
                        ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-xs ring-2 ring-rose-400/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <HeartPulse size={18} className={leaveType === 'sakit' ? 'text-rose-600' : 'text-slate-400'} />
                    <div className="text-left leading-tight">
                      <span className="block font-black">Sakit (S)</span>
                      <span className="text-[10px] font-normal opacity-80">Kondisi Medis</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLeaveTypeChange('izin')}
                    className={`p-3 rounded-2xl border-2 font-black text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                      leaveType === 'izin'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-xs ring-2 ring-amber-400/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileText size={18} className={leaveType === 'izin' ? 'text-amber-600' : 'text-slate-400'} />
                    <div className="text-left leading-tight">
                      <span className="block font-black">Izin Resmi (I)</span>
                      <span className="text-[10px] font-normal opacity-80">Acara / Keperluan</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Sub Kategori */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kategori Keterangan
                </label>
                <div className="relative">
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white pr-9"
                  >
                    {leaveType === 'sakit' ? (
                      <>
                        <option value="Sakit (Surat Dokter)">Sakit (Dengan Surat Keterangan Dokter)</option>
                        <option value="Sakit (Istirahat di Rumah)">Sakit (Istirahat di Rumah / Rawat Jalan)</option>
                        <option value="Sakit (Rawat Inap / Rumah Sakit)">Sakit (Rawat Inap / Rumah Sakit)</option>
                        <option value="Sakit Gigi / Terapi Khusus">Pemeriksaan Dokter Gigi / Terapi Medis</option>
                      </>
                    ) : (
                      <>
                        <option value="Acara Keluarga / Mendesak">Acara Keluarga / Keperluan Mendesak</option>
                        <option value="Dispensasi Kegiatan / Lomba">Dispensasi Lomba / Kegiatan Resmi</option>
                        <option value="Ibadah / Keagamaan">Ibadah / Kegiatan Keagamaan</option>
                        <option value="Duka Cita">Takziah / Berduka Cita</option>
                        <option value="Lainnya">Keperluan Mendesak Lainnya</option>
                      </>
                    )}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Rentang Tanggal Izin */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={13} className="text-blue-600" />
                    <span>Rentang Waktu</span>
                  </label>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Durasi: {durationDays} Hari
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 mb-1">Mulai Tanggal</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (e.target.value > endDate) setEndDate(e.target.value);
                      }}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 mb-1">Sampai Tanggal</span>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Identitas Pemohon & Upload Bukti Foto */}
            <div className="space-y-4">
              {/* Identitas Pemohon */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-3">
                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Identitas Pemohon
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Nama Orang Tua / Wali
                    </label>
                    <input
                      type="text"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      placeholder="Contoh: Bpk. Bambang"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Hubungan Keluarga
                    </label>
                    <select
                      value={requesterRole}
                      onChange={(e) => setRequesterRole(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                    >
                      <option value="Ayah">Ayah Kandung</option>
                      <option value="Ibu">Ibu Kandung</option>
                      <option value="Wali">Wali Murid</option>
                      <option value="Siswa">Siswa Bersangkutan</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                    <Phone size={11} className="text-emerald-600" />
                    <span>Nomor WhatsApp Aktif</span>
                  </label>
                  <input
                    type="tel"
                    value={requesterPhone}
                    onChange={(e) => setRequesterPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-600"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Pihak sekolah/wali kelas dapat mengonfirmasi permohonan melalui WhatsApp ini.
                  </span>
                </div>
              </div>

              {/* Upload Foto Surat Dokter / Bukti Surat Izin */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Lampiran Surat Dokter / Bukti Izin</span>
                  <span className="text-[10px] text-slate-400 font-normal">Sangat Dianjurkan</span>
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf"
                  className="hidden"
                />

                {attachmentUrl ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0 overflow-hidden border border-emerald-300">
                        {attachmentUrl.startsWith('data:image') || attachmentUrl.startsWith('http') ? (
                          <img src={attachmentUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <FileText size={20} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-950 truncate">
                          {attachmentName || 'Surat_Keterangan_Dokter.jpg'}
                        </p>
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          Berkas Terlampir
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-xl transition-colors cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl bg-slate-50/70 hover:bg-blue-50/30 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 group-hover:border-blue-300 text-slate-500 group-hover:text-blue-600 flex items-center justify-center shadow-2xs">
                      <Upload size={18} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
                      Ambil Foto / Unggah Berkas Surat
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Format JPG, PNG, atau PDF (Maks. 8MB)
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Full-width Alasan Detail */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Alasan / Keterangan Lengkap
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan kondisi sakit ananda atau keperluan izin secara jelas dan santun..."
              rows={3}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white resize-none leading-relaxed"
            />
          </div>

          {/* Notice Callout */}
          <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-start gap-2.5 text-slate-700">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-600">
              Setelah dikirim, permohonan akan langsung masuk ke daftar verifikasi pihak sekolah & wali kelas. Presensi siswa akan otomatis tercatat sebagai <strong>{leaveType === 'sakit' ? 'Sakit' : 'Izin'}</strong> setelah disetujui.
            </p>
          </div>

          {/* Dialog Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs rounded-xl shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-2 disabled:opacity-60 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Mengirimkan Permohonan...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Kirim Permohonan Resmi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
