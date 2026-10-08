import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GeneratedAccountResult, SchoolProfile, SystemConfig } from '../types';

export interface ExportPdfOptions {
  schoolProfile: SchoolProfile;
  systemConfig?: SystemConfig;
  accounts: GeneratedAccountResult[];
  categoryFilter?: string; // 'ALL' | 'ADMIN' | 'GURU' | 'SISWA' | 'KEPALA SEKOLAH'
  adminName?: string;
  documentTitle?: string;
}

// Helper to load image as HTMLImageElement for jsPDF
const loadImageElement = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
};

export const exportGeneratedAccountsPdf = async ({
  schoolProfile,
  systemConfig,
  accounts,
  categoryFilter = 'ALL',
  adminName = 'Administrator Sekolah',
  documentTitle,
}: ExportPdfOptions) => {
  if (!accounts || accounts.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  let currentY = 12;

  const showLetterhead = systemConfig?.showLetterhead ?? true;
  const isCustomImageLetterhead =
    showLetterhead &&
    systemConfig?.letterheadType === 'custom_image' &&
    !!systemConfig.letterheadImageUrl;

  // 1. KOP SURAT RESMI (Sama dengan Pengaturan Sistem & Cetak Absensi)
  if (showLetterhead) {
    if (isCustomImageLetterhead && systemConfig?.letterheadImageUrl) {
      try {
        const kopImg = await loadImageElement(systemConfig.letterheadImageUrl);
        const kopWidth = pageWidth - marginX * 2;
        // Keep aspect ratio capped at 36mm height
        const aspectRatio = kopImg.naturalWidth / (kopImg.naturalHeight || 1);
        const calculatedHeight = Math.min(36, kopWidth / aspectRatio);

        doc.addImage(
          kopImg,
          'PNG',
          marginX,
          currentY,
          kopWidth,
          calculatedHeight
        );
        currentY += calculatedHeight + 2;

        // Bottom separator line under custom kop
        doc.setDrawColor(15, 23, 42); // slate-900
        doc.setLineWidth(0.6);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 5;
      } catch (_) {
        // Fallback to text letterhead if image load fails
        currentY = renderStandardTextLetterhead(doc, schoolProfile, systemConfig, pageWidth, marginX, currentY);
      }
    } else {
      // Standard Text Letterhead with School Logo & Double Lines
      try {
        if (systemConfig?.schoolLogoUrl) {
          const logoImg = await loadImageElement(systemConfig.schoolLogoUrl);
          doc.addImage(logoImg, 'PNG', marginX, currentY, 18, 18);
        }
      } catch (_) {
        // Continue if logo fails
      }
      currentY = renderStandardTextLetterhead(doc, schoolProfile, systemConfig, pageWidth, marginX, currentY);
    }
  } else {
    currentY += 4;
  }

  // 2. JUDUL DOKUMEN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(30, 58, 138); // blue-900

  const defaultTitle =
    categoryFilter === 'ADMIN'
      ? 'DAFTAR AKUN PENGGUNA ADMINISTRATOR SISTEM'
      : categoryFilter === 'GURU'
      ? 'DAFTAR AKUN LOGIN PENDIDIK & TENAGA KEPENDIDIKAN (GURU)'
      : categoryFilter === 'SISWA'
      ? 'DAFTAR AKUN LOGIN PESERTA DIDIK (SISWA)'
      : categoryFilter === 'KEPALA SEKOLAH'
      ? 'DAFTAR AKUN LOGIN KEPALA SEKOLAH'
      : 'DAFTAR AKUN PENGGUNA SISTEM ABSENSI DIGITAL';

  const titleText = documentTitle || defaultTitle;
  doc.text(titleText, pageWidth / 2, currentY, { align: 'center' });
  currentY += 4.5;

  // Sub-header Metadata
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Dicetak: ${dateFormatted} pukul ${timeFormatted} WIB  •  Semester: ${schoolProfile.semester || 'GANJIL'}  •  Tahun Pelajaran: ${schoolProfile.tahunPelajaran || '2025/2026'}`,
    pageWidth / 2,
    currentY,
    { align: 'center' }
  );
  currentY += 5.5;

  // 3. STATISTIK RINGKASAN
  const totalAdmin = accounts.filter((a) => a.category === 'ADMIN' || a.role === 'ADMIN').length;
  const totalGuru = accounts.filter((a) => a.category === 'GURU' || a.role === 'GURU MAPEL' || a.role === 'WALI KELAS').length;
  const totalSiswa = accounts.filter((a) => a.category === 'SISWA' || a.role === 'SISWA').length;
  const totalKepsek = accounts.filter((a) => a.category === 'KEPALA SEKOLAH' || a.role === 'KEPALA SEKOLAH').length;

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 7.5, 1.2, 1.2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);

  const summaryText = `Total: ${accounts.length} Akun  |  Admin: ${totalAdmin}  |  Guru: ${totalGuru}  |  Siswa: ${totalSiswa}  |  Kepala Sekolah: ${totalKepsek}`;
  doc.text(summaryText, pageWidth / 2, currentY + 4.8, { align: 'center' });
  currentY += 10.5;

  // 4. TABEL AKUN (AUTOTABLE)
  const tableData = accounts.map((acc, index) => {
    let roleLabel = acc.role || acc.category || '-';
    if (roleLabel === 'WALI KELAS') roleLabel = 'Wali Kelas';
    else if (roleLabel === 'GURU MAPEL') roleLabel = 'Guru Mapel';
    else if (roleLabel === 'ADMIN') roleLabel = 'Administrator';
    else if (roleLabel === 'SISWA') roleLabel = 'Siswa';
    else if (roleLabel === 'KEPALA SEKOLAH') roleLabel = 'Kepala Sekolah';

    let penugasan = acc.className || '-';
    if (acc.category === 'KEPALA SEKOLAH' || acc.role === 'KEPALA SEKOLAH') {
      penugasan = 'Pimpinan Satuan Pendidikan (Semua Rombel)';
    } else if (acc.category === 'ADMIN' || acc.role === 'ADMIN') {
      penugasan = 'Pengelola Data & Sistem IT';
    }

    const statusLabel =
      acc.status === 'CREATED'
        ? 'Baru Dibuat'
        : acc.status === 'UPDATED'
        ? 'Password Baru'
        : 'Aktif';

    // Prioritize actual generated/randomized password string
    const rawPassword = (acc.password || '').trim();
    const displayPassword = rawPassword && rawPassword !== 'Tersimpan (Aman)' && rawPassword !== '***'
      ? rawPassword
      : (rawPassword || '-');

    return [
      index + 1,
      acc.name || '-',
      acc.username || '-',
      displayPassword,
      roleLabel,
      penugasan,
      statusLabel,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX, bottom: 20 },
    head: [
      [
        'NO',
        'NAMA PENGGUNA',
        'USERNAME / NISN',
        'PASSWORD ACAK',
        'HAK AKSES',
        'ROMBEL / PENUGASAN',
        'STATUS',
      ],
    ],
    body: tableData,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59], // slate-800
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 58, 138], // blue-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 42 },
      2: { halign: 'left', font: 'courier', fontStyle: 'bold', cellWidth: 32 },
      3: { halign: 'center', font: 'courier', fontStyle: 'bold', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 24 },
      5: { halign: 'left', cellWidth: 30 },
      6: { halign: 'center', cellWidth: 17 },
    },
    didDrawPage: (data) => {
      // Header for page 2+
      if (data.pageNumber > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `${titleText} — ${schoolProfile.namaSekolah || 'Sekolah'}`,
          marginX,
          10
        );
        doc.text(
          `Tanggal: ${dateFormatted}`,
          pageWidth - marginX,
          10,
          { align: 'right' }
        );
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, 12, pageWidth - marginX, 12);
      }

      // Footer
      const totalPagesExp = '{total_pages_count_string}';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400

      doc.text(
        'Sistem Absensi Digital Kawacanaan — Dokumen Rahasia Akun Pengguna',
        marginX,
        pageHeight - 10
      );

      const pageStr = `Halaman ${data.pageNumber} dari ${totalPagesExp}`;
      doc.text(pageStr, pageWidth - marginX, pageHeight - 10, { align: 'right' });
    },
  });

  // Calculate position after table for signatures
  let finalY = (doc as any).lastAutoTable.finalY + 8;

  // If not enough space for signature block (need ~35mm), add new page
  if (finalY + 35 > pageHeight - 20) {
    doc.addPage();
    finalY = 25;
  }

  // Confidentiality Notice
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    '* Catatan: Informasi akun ini bersifat rahasia dan wajib didistribusikan kepada masing-masing pemilik akun secara tertutup.',
    marginX,
    finalY
  );
  finalY += 8;

  // Signature Block
  const sigLeftX = marginX + 20;
  const sigRightX = pageWidth - marginX - 45;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  // Left Sign: Kepala Sekolah
  doc.text('Mengetahui,', sigLeftX, finalY, { align: 'center' });
  doc.text('Kepala Sekolah', sigLeftX, finalY + 4, { align: 'center' });

  // Right Sign: Administrator / Pembuat Dokumen
  doc.text(`${schoolProfile.kabupatenKota || 'Jakarta'}, ${dateFormatted}`, sigRightX, finalY, { align: 'center' });
  doc.text('Administrator Sistem', sigRightX, finalY + 4, { align: 'center' });

  const sigNameY = finalY + 22;

  // Kepala Sekolah Name & NIP
  doc.setFont('helvetica', 'bold');
  const kepsekName = schoolProfile.namaKepalaSekolah || '( ........................................ )';
  doc.text(kepsekName, sigLeftX, sigNameY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    schoolProfile.nipKepalaSekolah ? `NIP. ${schoolProfile.nipKepalaSekolah}` : 'NIP. -',
    sigLeftX,
    sigNameY + 4,
    { align: 'center' }
  );

  // Administrator Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(adminName || 'Administrator', sigRightX, sigNameY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Pengelola Data & IT Sekolah', sigRightX, sigNameY + 4, { align: 'center' });

  // Replace total pages placeholder in all pages
  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages('{total_pages_count_string}');
  }

  // Save the PDF file
  const fileName = `Daftar_Akun_Pengguna_${(schoolProfile.namaSekolah || 'Sekolah')
    .replace(/[^a-zA-Z0-9]/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};

// Helper for rendering standard text letterhead
function renderStandardTextLetterhead(
  doc: jsPDF,
  schoolProfile: SchoolProfile,
  systemConfig: SystemConfig | undefined,
  pageWidth: number,
  marginX: number,
  startY: number
): number {
  let currentY = startY;

  const prov = schoolProfile.provinsi ? schoolProfile.provinsi.toUpperCase() : 'DAERAH KHUSUS IBUKOTA JAKARTA';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`PEMERINTAH PROVINSI ${prov}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;

  doc.text('DINAS PENDIDIKAN', pageWidth / 2, currentY, { align: 'center' });
  currentY += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  const schoolName = (schoolProfile.namaSekolah || 'SD NEGERI NUSANTARA').toUpperCase();
  doc.text(schoolName, pageWidth / 2, currentY, { align: 'center' });
  currentY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600

  const addressLine = [
    schoolProfile.jalan,
    schoolProfile.desaKelurahan,
    schoolProfile.kecamatan,
    schoolProfile.kabupatenKota,
    schoolProfile.provinsi,
  ]
    .filter(Boolean)
    .join(', ') || schoolProfile.alamat || 'Indonesia';

  doc.text(addressLine, pageWidth / 2, currentY, { align: 'center' });
  currentY += 3.8;

  const metaLine = [
    schoolProfile.npsn ? `NPSN: ${schoolProfile.npsn}` : null,
    schoolProfile.kodeSekolah ? `Kode Sekolah: ${schoolProfile.kodeSekolah}` : null,
    schoolProfile.teleponFax ? `Telp: ${schoolProfile.teleponFax}` : null,
    schoolProfile.email ? `Email: ${schoolProfile.email}` : null,
    schoolProfile.website ? `Website: ${schoolProfile.website}` : null,
  ]
    .filter(Boolean)
    .join('  |  ');

  if (metaLine) {
    doc.text(metaLine, pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.8;
  }

  // Double Line Divider (Kop Surat Garis Ganda)
  doc.setDrawColor(15, 23, 42); // slate-900
  doc.setLineWidth(0.8);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  doc.setLineWidth(0.25);
  doc.line(marginX, currentY + 0.9, pageWidth - marginX, currentY + 0.9);
  currentY += 6;

  return currentY;
}
