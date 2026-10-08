import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import {
  Shield,
  ShieldCheck,
  MapPin,
  Lock,
  User,
  Building2,
  Calendar,
  FileText,
  CreditCard,
  ExternalLink,
  Smartphone,
  Download,
  Loader2,
  Copy,
  Check,
  QrCode,
} from 'lucide-react';

export interface LoginCredentialCardData {
  workspaceType: 'school' | 'personal';
  schoolName: string;
  personInCharge: string;
  username: string;
  password: string;
  role?: string;
  schoolCode?: string;
  expiryDateText?: string;
  invoiceNo?: string;
  nominalText?: string;
  paymentMethodText?: string;
  portalUrl?: string;
  referenceId?: string;
  registeredDateText?: string;
  photoUrl?: string;
}

interface LoginCredentialCardProps {
  data: LoginCredentialCardData;
  onEnterSystem?: () => void;
  className?: string;
}

/**
 * Komponen Kartu Kredensial Login Resmi 480 × 300 px
 *
 * Mengikuti referensi visual:
 * - Layout, style, dan komposisi acuan utama kartu kredensial login ukuran 480 × 300 px.
 * - Tampilan visual bersih: menghapus gambar gedung sekolah, cukup barcode saja (layout dirapikan).
 * - Teks kartu kredensial resmi pendidikan diganti dengan teks:
 *   "RUANG KERJA SEKOLAH" atau "RUANG KERJA INDIVIDU".
 * - Fitur unduh/download tepat 1 tombol dengan teks "Unduh" berkinerja tinggi & handal.
 */
export const LoginCredentialCard: React.FC<LoginCredentialCardProps> = ({
  data,
  onEnterSystem,
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // URL Portal Login Akses
  const portalUrl =
    data.portalUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/?view=login`
      : 'https://kawacanaan-presensi.web.app/?view=login');

  const refId =
    data.referenceId ||
    `KWC-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${new Date().getFullYear()}`;

  const todayText =
    data.registeredDateText ||
    new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const roleDisplay = (() => {
    if (data.role) return data.role.toUpperCase();
    if (data.workspaceType === 'school') return 'ADMINISTRATOR';
    const picLower = (data.personInCharge || '').toLowerCase();
    if (picLower.includes('wali kelas')) return 'WALI KELAS';
    if (picLower.includes('guru mapel')) return 'GURU MAPEL';
    return 'PENDIDIK';
  })();

  // Normalisasi teks masa aktif lisensi: bagi pengguna gratis cukup "Aktif Selamanya"
  const cleanExpiryText = (() => {
    const raw = data.expiryDateText || '';
    if (!raw || raw.toLowerCase().includes('gratis') || raw.toLowerCase().includes('selamanya')) {
      return 'Aktif Selamanya';
    }
    return raw;
  })();

  // Generate QR Code Barcode beresolusi tinggi
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(portalUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 200,
      color: {
        dark: '#092552',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.error('QR generation error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [portalUrl]);

  /**
   * Fallback Generator Canvas 2D Native (Beresolusi 960 × 600 px)
   * Menjamin unduhan kartu 100% selalu berhasil dan tajam meskipun DOM parser / iframe membatasi html2canvas.
   */
  const generateDirectCanvas = async (): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    // Background Card Putih
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 960, 600);

    // 1. SISI KIRI (Navy Gradient: 0 -> 390 px)
    const leftGrad = ctx.createLinearGradient(0, 0, 0, 600);
    leftGrad.addColorStop(0, '#093570');
    leftGrad.addColorStop(0.5, '#0d4289');
    leftGrad.addColorStop(1, '#082a5c');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, 390, 600);

    // Tab Putih Logo di Kiri Atas
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(390, 0);
    ctx.lineTo(390, 90);
    ctx.quadraticCurveTo(390, 112, 340, 112);
    ctx.lineTo(0, 112);
    ctx.closePath();
    ctx.fill();

    // Kotak Icon Logo "K"
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(24, 28, 48, 48, 10) : ctx.fillRect(24, 28, 48, 48);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('K', 48, 52);

    // Teks Logo
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('KawaCanaan', 82, 44);
    ctx.fillStyle = '#2563eb';
    ctx.fillText('Presensi', 214, 44);

    ctx.fillStyle = '#64748b';
    ctx.font = '13px sans-serif';
    ctx.fillText('Platform Presensi Khusus Jenjang SD', 82, 68);

    // Badge Pill Ruang Kerja
    const badgeText = data.workspaceType === 'school' ? 'RUANG KERJA SEKOLAH' : 'RUANG KERJA INDIVIDU';
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(24, 134, 220, 26, 13) : ctx.fillRect(24, 134, 220, 26);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, 134, 151);

    // Header Satuan Pendidikan
    ctx.textAlign = 'left';
    ctx.fillStyle = '#bfdbfe';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('SATUAN PENDIDIKAN', 24, 184);

    // Nama Sekolah
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 19px sans-serif';
    const schoolDisplayName = (data.schoolName || 'SDN KAWACANAAN').toUpperCase();
    ctx.fillText(schoolDisplayName.length > 24 ? schoolDisplayName.substring(0, 24) + '...' : schoolDisplayName, 24, 210);

    // Penanggung Jawab
    ctx.fillStyle = '#e0e7ff';
    ctx.font = '13px sans-serif';
    const picText = `Penanggung Jawab: ${data.personInCharge || '-'}`;
    ctx.fillText(picText.length > 32 ? picText.substring(0, 32) + '...' : picText, 24, 232);

    // KOTAK BARCODE / QR CODE (TERPUSAT TANPA GEDUNG SEKOLAH)
    const qrBoxX = 105;
    const qrBoxY = 260;
    const qrBoxSize = 180;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 18) : ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
    ctx.fill();

    // Gambar QR Image jika ada
    if (qrCodeDataUrl) {
      await new Promise<void>((resolve) => {
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, qrBoxX + 10, qrBoxY + 10, qrBoxSize - 20, qrBoxSize - 20);
          resolve();
        };
        qrImg.onerror = () => resolve();
        qrImg.src = qrCodeDataUrl;
      });
    }

    // Label Pindai Akses
    ctx.textAlign = 'center';
    ctx.fillStyle = '#dbeafe';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('PINDAI UNTUK AKSES PORTAL', 195, 466);

    // Footer Sisi Kiri
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 520);
    ctx.lineTo(366, 520);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('KawaCanaan Presensi SD', 24, 550);
    ctx.fillStyle = '#93c5fd';
    ctx.font = '11px sans-serif';
    ctx.fillText('Sistem Presensi Digital Terverifikasi', 24, 570);

    // 2. SISI KANAN (White Canvas: 390 -> 960 px)
    // Garis Divider
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(390, 0);
    ctx.lineTo(390, 600);
    ctx.stroke();

    // Header Kredensial Login
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('KREDENSIAL LOGIN', 420, 48);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText('Absensi Tertib • Data Akurat • Sekolah Maju', 930, 48);

    // Header divider
    ctx.strokeStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(420, 64);
    ctx.lineTo(930, 64);
    ctx.stroke();

    // Helper fungsi gambar box info kredensial
    const drawInfoBox = (x: number, y: number, w: number, h: number, label: string, val: string, isMono = false) => {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, w, h, 12) : ctx.fillRect(x, y, w, h);
      ctx.fill();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, w, h, 12) : ctx.strokeRect(x, y, w, h);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(label, x + 14, y + 24);

      ctx.fillStyle = '#0f172a';
      ctx.font = isMono ? 'bold 18px monospace' : 'bold 17px sans-serif';
      ctx.fillText(val.length > 22 ? val.substring(0, 22) + '...' : val, x + 14, y + 54);
    };

    // Grid 2x2
    // Box 1: Username
    drawInfoBox(420, 80, 245, 72, 'USERNAME LOGIN', data.username, true);
    // Box 2: Password
    drawInfoBox(685, 80, 245, 72, 'PASSWORD LOGIN', data.password, true);
    // Box 3: Hak Akses / Peran
    drawInfoBox(420, 166, 245, 72, 'HAK AKSES / PERAN', roleDisplay, false);
    // Box 4: Masa Aktif
    drawInfoBox(685, 166, 245, 72, 'MASA AKTIF LISENSI', cleanExpiryText, false);

    // Status Aktif Pill
    ctx.fillStyle = '#ecfdf5';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(420, 252, 220, 28, 14) : ctx.fillRect(420, 252, 220, 28);
    ctx.fill();
    ctx.strokeStyle = '#a7f3d0';
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(436, 266, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('STATUS: AKTIF (TERDAFTAR)', 450, 270);

    // Rincian Transaksi
    ctx.strokeStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(420, 296);
    ctx.lineTo(930, 296);
    ctx.stroke();

    const drawRow = (y: number, label: string, val: string, isBold = false) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.fillText(label, 420, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a';
      ctx.font = isBold ? 'bold 14px sans-serif' : '13px sans-serif';
      ctx.fillText(val, 930, y);
    };

    const invText = data.invoiceNo || `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${refId.substring(0, 4).toUpperCase()}`;
    drawRow(326, 'No. Invoice', invText, true);
    drawRow(356, 'Nominal', data.nominalText || 'GRATIS (Rp 0)', true);
    drawRow(386, 'Metode Verifikasi', data.paymentMethodText || 'Pendaftaran Otomatis', false);

    // Box Portal Akses
    ctx.fillStyle = '#eff6ff';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(420, 416, 510, 44, 10) : ctx.fillRect(420, 416, 510, 44);
    ctx.fill();
    ctx.strokeStyle = '#bfdbfe';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Portal Akses :', 436, 443);
    ctx.fillStyle = '#2563eb';
    ctx.font = '12px monospace';
    ctx.fillText(portalUrl, 526, 443);

    // Footer Kanan
    ctx.strokeStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(420, 520);
    ctx.lineTo(930, 520);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('SISTEM TERVALIDASI KAWACANAAN SD', 420, 556);

    ctx.textAlign = 'right';
    ctx.fillText(`ID: ${refId} • ${todayText}`, 930, 556);

    return canvas;
  };

  /**
   * Eksekusi Unduh Kartu Kredensial
   * Menggunakan strategi ganda (Dual-Engine) agar 100% andal di segala kondisi browser & container iframe.
   */
  const handleDownloadCard = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      let finalCanvas: HTMLCanvasElement | null = null;

      // Percobaan 1: Coba html2canvas dari DOM jika tersedia
      if (cardRef.current) {
        try {
          finalCanvas = await html2canvas(cardRef.current, {
            scale: 2, // 960x600 px untuk kualitas super tajam
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: 480,
            height: 300,
            windowWidth: 480,
            windowHeight: 300,
            logging: false,
          });
        } catch (domErr) {
          console.warn('html2canvas DOM capture failed, switching to direct canvas engine:', domErr);
        }
      }

      // Percobaan 2: Fallback ke Native Canvas 2D Engine jika html2canvas gagal
      if (!finalCanvas) {
        finalCanvas = await generateDirectCanvas();
      }

      // Trigger download melalui Blob API yang stabil
      await new Promise<void>((resolve, reject) => {
        finalCanvas!.toBlob((blob) => {
          if (!blob) {
            // Fallback to dataURL
            try {
              const dataUrl = finalCanvas!.toDataURL('image/png', 1.0);
              const anchor = document.createElement('a');
              anchor.download = `Kartu-Kredensial-${(data.username || 'Login').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
              anchor.href = dataUrl;
              document.body.appendChild(anchor);
              anchor.click();
              setTimeout(() => {
                document.body.removeChild(anchor);
                resolve();
              }, 150);
            } catch (fallbackErr) {
              reject(fallbackErr);
            }
            return;
          }

          const blobUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.download = `Kartu-Kredensial-${(data.username || 'Login').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
          anchor.href = blobUrl;
          document.body.appendChild(anchor);
          anchor.click();
          setTimeout(() => {
            document.body.removeChild(anchor);
            URL.revokeObjectURL(blobUrl);
            resolve();
          }, 200);
        }, 'image/png', 1.0);
      });

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (error) {
      console.error('Gagal mengunduh kartu kredensial:', error);
      // Emergency direct canvas fallback
      try {
        const emergencyCanvas = await generateDirectCanvas();
        const dataUrl = emergencyCanvas.toDataURL('image/png');
        const anchor = document.createElement('a');
        anchor.download = `Kartu-Kredensial-${(data.username || 'Login').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
        anchor.href = dataUrl;
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(() => document.body.removeChild(anchor), 150);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
      } catch (emErr) {
        console.error('Emergency download failed:', emErr);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyCredentials = () => {
    const text = `KREDENSIAL LOGIN KAWACANAAN PRESENSI SD\n${
      data.workspaceType === 'school' ? 'Ruang Kerja Sekolah' : 'Ruang Kerja Individu'
    }: ${data.schoolName}\nPenanggung Jawab: ${data.personInCharge}\nPeran / Hak Akses: ${roleDisplay}\nUsername: ${
      data.username
    }\nPassword: ${data.password}\nMasa Aktif: ${
      cleanExpiryText
    }\nPortal Akses: ${portalUrl}`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className={`flex flex-col items-center gap-3.5 ${className}`}>
      {/* Wrapper kartu kredensial dengan scroll horizontal jika layar sangat kecil di mobile */}
      <div className="w-full overflow-x-auto pb-1 flex justify-center">
        {/* ========================================================================= */}
        {/* KARTU KREDENSIAL LOGIN: TEPAT 480 × 300 px (SESUAI INSTRUKSI SPESIFIK)    */}
        {/* Tampilan Visual Bersih: Menghapus Gedung Sekolah, Cukup Barcode Saja      */}
        {/* ========================================================================= */}
        <div
          ref={cardRef}
          style={{ width: '480px', height: '300px', minWidth: '480px', minHeight: '300px' }}
          className="relative bg-white rounded-[20px] shadow-xl border border-slate-200 overflow-hidden flex select-none text-slate-900 shrink-0 font-sans"
        >
          {/* ===================================================================== */}
          {/* SISI KIRI (Background Navy Gradient + Logo + Barcode Saja)              */}
          {/* ===================================================================== */}
          <div className="w-[195px] h-full bg-gradient-to-b from-[#093570] via-[#0d4289] to-[#082a5c] relative flex flex-col justify-between text-white p-2.5 overflow-hidden shrink-0">
            {/* Latar Belakang Lengkung Putih Bagian Atas Logo */}
            <div className="absolute top-0 left-0 right-0 h-[54px] bg-white rounded-br-[26px] shadow-sm z-0 flex items-center px-2.5 pt-1">
              <div className="flex items-center gap-1.5">
                {/* Logo K squircle */}
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xs shadow-xs border border-blue-400/40 shrink-0">
                  <span>K</span>
                </div>
                {/* Teks Logo */}
                <div className="leading-tight">
                  <div className="flex items-center gap-1 text-[11px] font-black tracking-tight">
                    <span className="text-slate-900">KawaCanaan</span>
                    <span className="text-blue-600">Presensi</span>
                  </div>
                  <div className="text-[6.5px] font-semibold text-slate-500 tracking-tight">
                    Platform Presensi Khusus Jenjang SD
                  </div>
                </div>
              </div>
            </div>

            {/* Konten Bagian Tengah Kiri: Badge + Info Sekolah */}
            <div className="relative z-10 pt-[52px] space-y-1.5">
              {/* Badge Ruang Kerja: Sesuai Instruksi Khusus User */}
              <div className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[7.5px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs tracking-wider border border-blue-300/30">
                <Building2 size={9} className="shrink-0" />
                <span className="truncate">
                  {data.workspaceType === 'school' ? 'RUANG KERJA SEKOLAH' : 'RUANG KERJA INDIVIDU'}
                </span>
              </div>

              {/* Satuan Pendidikan Header */}
              <div className="space-y-0.5">
                <div className="text-[6.5px] font-bold tracking-widest text-blue-200/90 uppercase">
                  SATUAN PENDIDIKAN
                </div>
                <div className="text-[12px] font-black text-white tracking-tight uppercase leading-snug line-clamp-1">
                  {data.schoolName || (data.workspaceType === 'school' ? 'SDN KAWACANAAN' : 'GURU INDIVIDU SD')}
                </div>
                <div className="flex items-center gap-1 text-[7px] text-blue-100/90 truncate font-medium">
                  <MapPin size={8} className="shrink-0 text-blue-300" />
                  <span className="truncate">Penanggung Jawab: {data.personInCharge}</span>
                </div>
              </div>

              {/* BARCODE / QR CODE SAJA (Gedung Sekolah Dihapus Sesuai Instruksi, Layout Dirapikan) */}
              <div className="pt-1 flex flex-col items-center justify-center">
                <div className="w-[84px] h-[84px] bg-white rounded-xl p-1 shadow-md border border-white/80 flex items-center justify-center">
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Barcode Portal"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-50 flex items-center justify-center text-[7px] text-slate-400 font-mono">
                      BARCODE
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[6.5px] text-blue-100 font-semibold tracking-wide mt-1">
                  <QrCode size={8} className="shrink-0 text-blue-300" />
                  <span>PINDAI AKSES CEPAT</span>
                </div>
              </div>
            </div>

            {/* Footer Kiri: Watermark & Motto */}
            <div className="relative z-10 pt-1 border-t border-blue-400/20 flex items-center gap-1 text-[6.5px] text-blue-100/80">
              <Shield size={8} className="shrink-0 text-blue-300" />
              <div className="leading-tight">
                <span className="font-bold text-white">KawaCanaan Presensi</span>
                <span className="opacity-75"> • Terverifikasi Jenjang SD</span>
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* SISI KANAN (White Background: Header, Kredensial 2x2, Invoice, Link) */}
          {/* ===================================================================== */}
          <div className="flex-1 h-full bg-white p-3 flex flex-col justify-between overflow-hidden">
            {/* Header Slogan Kanan Atas */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-900 tracking-wide">
                <div className="w-4 h-4 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Lock size={10} />
                </div>
                <span>KREDENSIAL LOGIN</span>
              </div>
              <div className="text-[7px] font-semibold text-slate-400 tracking-tight">
                Absensi Tertib • Data Akurat • Sekolah Maju
              </div>
            </div>

            {/* Grid 2x2 Field Kredensial */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {/* Box 1: Username */}
              <div className="bg-[#f0f5fc] border border-[#e0ebf9] rounded-lg p-1.5">
                <div className="flex items-center gap-1 text-[6.5px] font-bold text-slate-500 uppercase tracking-wider">
                  <User size={8} className="text-blue-600 shrink-0" />
                  <span>USERNAME LOGIN</span>
                </div>
                <div className="font-mono text-[10px] font-black text-slate-900 truncate mt-0.5 tracking-tight">
                  {data.username}
                </div>
              </div>

              {/* Box 2: Password */}
              <div className="bg-[#f0f5fc] border border-[#e0ebf9] rounded-lg p-1.5">
                <div className="flex items-center gap-1 text-[6.5px] font-bold text-slate-500 uppercase tracking-wider">
                  <Lock size={8} className="text-blue-600 shrink-0" />
                  <span>PASSWORD LOGIN</span>
                </div>
                <div className="font-mono text-[10px] font-black text-slate-900 truncate mt-0.5 tracking-tight">
                  {data.password}
                </div>
              </div>

              {/* Box 3: Hak Akses / Peran (Menggantikan Kode Akses) */}
              <div className="bg-[#f0f5fc] border border-[#e0ebf9] rounded-lg p-1.5">
                <div className="flex items-center gap-1 text-[6.5px] font-bold text-slate-500 uppercase tracking-wider">
                  <ShieldCheck size={8} className="text-blue-600 shrink-0" />
                  <span>PERAN / HAK AKSES</span>
                </div>
                <div className="font-sans text-[10px] font-black text-slate-900 truncate mt-0.5 tracking-tight">
                  {roleDisplay}
                </div>
              </div>

              {/* Box 4: Masa Aktif Lisensi */}
              <div className="bg-[#f0f5fc] border border-[#e0ebf9] rounded-lg p-1.5">
                <div className="flex items-center gap-1 text-[6.5px] font-bold text-slate-500 uppercase tracking-wider">
                  <Calendar size={8} className="text-blue-600 shrink-0" />
                  <span>MASA AKTIF LISENSI</span>
                </div>
                <div className="text-[10px] font-black text-slate-900 truncate mt-0.5">
                  {cleanExpiryText}
                </div>
              </div>
            </div>

            {/* Status Aktif Pill */}
            <div className="pt-0.5">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[7px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <span>STATUS: AKTIF (TERDAFTAR)</span>
              </div>
            </div>

            {/* Rincian Transaksi / Pendaftaran */}
            <div className="border-t border-slate-100 pt-1 space-y-0.5 text-[7px] text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1">
                  <FileText size={7} className="text-slate-400 shrink-0" />
                  <span>No. Invoice</span>
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {data.invoiceNo || `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${refId.substring(0, 4).toUpperCase()}`}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-100 text-blue-700 text-[5.5px] font-bold flex items-center justify-center shrink-0">
                    Rp
                  </span>
                  <span>Nominal</span>
                </span>
                <span className="font-bold text-slate-900">
                  {data.nominalText || 'GRATIS (Rp 0)'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1">
                  <CreditCard size={7} className="text-slate-400 shrink-0" />
                  <span>Metode</span>
                </span>
                <span className="text-slate-700 font-medium truncate max-w-[170px]">
                  {data.paymentMethodText || 'Pendaftaran Otomatis'}
                </span>
              </div>
            </div>

            {/* Portal Akses Highlight Box */}
            <div className="bg-[#eef4fd] border border-[#d6e4fa] rounded-lg px-2 py-1 flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <ExternalLink size={8} className="text-blue-600 shrink-0" />
                <span className="text-[6.5px] font-bold text-slate-600 shrink-0">Portal Akses :</span>
                <span className="text-[6.5px] font-mono text-blue-700 truncate font-semibold">
                  {portalUrl}
                </span>
              </div>
            </div>

            {/* Footer Kanan */}
            <div className="flex items-center justify-between text-[6px] text-slate-400 border-t border-slate-100 pt-1 font-medium uppercase">
              <span>SISTEM TERVALIDASI KAWACANAAN SD</span>
              <span>ID: {refId} • {todayText}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ACTION CONTROLS: Fitur Unduh Tepat 1 Tombol + Salin + Masuk ke Sistem     */}
      {/* "fitur unduh/download cukup 1 saja dengan teks unduh"                      */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1 w-full max-w-[480px]">
        {/* Tepat 1 Tombol Unduh Sesuai Instruksi User */}
        <button
          type="button"
          onClick={handleDownloadCard}
          disabled={isDownloading}
          id="btn-download-credential-card"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-60 min-h-[40px]"
        >
          {isDownloading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Menyiapkan...</span>
            </>
          ) : downloadSuccess ? (
            <>
              <Check size={14} className="text-emerald-300" />
              <span>Berhasil Diunduh!</span>
            </>
          ) : (
            <>
              <Download size={14} />
              <span>Unduh</span>
            </>
          )}
        </button>

        {/* Tombol Salin Kredensial */}
        <button
          type="button"
          onClick={handleCopyCredentials}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer min-h-[40px]"
        >
          {isCopied ? (
            <>
              <Check size={14} className="text-emerald-600" />
              <span className="text-emerald-700">Tersalin!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Salin Kredensial</span>
            </>
          )}
        </button>

        {/* Tombol Masuk ke Sistem Dashboard */}
        {onEnterSystem && (
          <button
            type="button"
            onClick={onEnterSystem}
            id="btn-enter-system-from-card"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer min-h-[40px]"
          >
            <span>Masuk ke Dashboard</span>
          </button>
        )}
      </div>
    </div>
  );
};
