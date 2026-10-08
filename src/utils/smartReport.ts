import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface CanonicalReportParams {
  classId?: string;
  className?: string;
  date?: string;
  attendanceType?: 'DAILY' | 'SUBJECT';
  subjectId?: string | null;
  reportType?: 'Laporan Harian' | 'Laporan Mingguan' | 'Laporan Bulanan' | 'Laporan Semester' | 'Laporan Kepala Sekolah (Bulanan)' | 'Laporan Kepala Sekolah (Semester)';
  selectedWeek?: string;
  month?: string;
  year?: string;
  semester?: 'Ganjil' | 'Genap';
  academicYear?: string;
  schoolId?: string | null;
}

/**
 * Mapping nama periode ke shortcode URL canonical
 */
export function reportTypeToPeriodCode(type?: string): string {
  switch (type) {
    case 'Laporan Mingguan':
      return 'weekly';
    case 'Laporan Bulanan':
      return 'monthly';
    case 'Laporan Semester':
      return 'semester';
    case 'Laporan Kepala Sekolah (Bulanan)':
      return 'kepsek';
    case 'Laporan Kepala Sekolah (Semester)':
      return 'kepsek_semester';
    case 'Laporan Harian':
    default:
      return 'daily';
  }
}

/**
 * Mapping shortcode URL canonical ke tipe laporan resmi
 */
export function periodCodeToReportType(code?: string | null): 'Laporan Harian' | 'Laporan Mingguan' | 'Laporan Bulanan' | 'Laporan Semester' | 'Laporan Kepala Sekolah (Bulanan)' | 'Laporan Kepala Sekolah (Semester)' {
  const clean = String(code || '').toLowerCase().trim();
  if (clean === 'kepsek' || clean === 'kepsek_monthly' || clean === 'laporan kepala sekolah (bulanan)') {
    return 'Laporan Kepala Sekolah (Bulanan)';
  }
  if (clean === 'kepsek_semester' || clean === 'laporan kepala sekolah (semester)') {
    return 'Laporan Kepala Sekolah (Semester)';
  }
  if (clean === 'weekly' || clean === 'mingguan' || clean === 'laporan mingguan') {
    return 'Laporan Mingguan';
  }
  if (clean === 'monthly' || clean === 'bulanan' || clean === 'laporan bulanan') {
    return 'Laporan Bulanan';
  }
  if (clean === 'semester' || clean === 'laporan semester') {
    return 'Laporan Semester';
  }
  return 'Laporan Harian';
}

/**
 * Membangun URL Canonical Smart Link yang lengkap, akurat, dan aman dibagikan.
 * URL ini selalu memuat parameter lengkap agar penerima di WhatsApp/browser manapun
 * langsung membuka lembar dokumen presensi yang sama persis tanpa tergantung memori lokal.
 */
export function buildCanonicalReportUrl(params: CanonicalReportParams): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  const path = window.location.pathname === '/' ? '' : window.location.pathname;
  const searchParams = new URLSearchParams();

  // Flag wajib dokumen presensi
  searchParams.set('report', 'attendance');

  const cleanClassId = String(params.classId || '').trim();
  if (cleanClassId && cleanClassId !== 'null' && cleanClassId !== 'undefined') {
    searchParams.set('r', cleanClassId);
  }

  const cleanClassName = String(params.className || '').trim();
  if (cleanClassName && cleanClassName !== 'null' && cleanClassName !== 'undefined') {
    searchParams.set('cn', cleanClassName);
  }

  const cleanSchoolId = String(params.schoolId || '').trim();
  if (cleanSchoolId && cleanSchoolId !== 'null' && cleanSchoolId !== 'undefined') {
    searchParams.set('sid', cleanSchoolId);
  }

  const effectiveDate = params.date || new Date().toISOString().split('T')[0];
  searchParams.set('d', effectiveDate);

  const periodCode = reportTypeToPeriodCode(params.reportType);
  if (periodCode && periodCode !== 'daily') {
    searchParams.set('p', periodCode);
  }

  if (params.attendanceType === 'SUBJECT') {
    searchParams.set('m', 'subject');
    if (params.subjectId && params.subjectId !== 'null') {
      searchParams.set('s', params.subjectId);
    }
  }

  if (params.selectedWeek && params.reportType === 'Laporan Mingguan') {
    searchParams.set('w', params.selectedWeek);
  }
  if (params.month) {
    searchParams.set('mo', params.month);
  }
  if (params.year) {
    searchParams.set('y', String(params.year));
  }
  if (params.semester) {
    searchParams.set('sem', params.semester);
  }
  if (params.academicYear) {
    searchParams.set('ay', params.academicYear);
  }

  return `${origin}${path}?${searchParams.toString()}`;
}

/**
 * Parsing URL Query Parameter menjadi objek CanonicalReportParams yang terpadu.
 * Mendukung format canonical baru (?report=attendance&r=...&d=...) maupun alias terdahulu.
 */
export function parseCanonicalReportParams(searchParams: URLSearchParams): CanonicalReportParams | null {
  const isExplicitReport = searchParams.get('report') === 'attendance' || searchParams.get('report') === 'true';
  const rawClassId = searchParams.get('r') || searchParams.get('class') || searchParams.get('classId') || '';
  const classId = (rawClassId === 'null' || rawClassId === 'undefined') ? '' : rawClassId;
  const dateParam = searchParams.get('d') || searchParams.get('date') || '';
  const periodParam = searchParams.get('p') || searchParams.get('period') || '';
  const isSubjectMode = searchParams.get('m') === 'subject' || searchParams.get('type') === 'subject';
  const rawSubjectId = searchParams.get('s') || searchParams.get('subjectId') || null;
  const subjectId = (rawSubjectId === 'null' || rawSubjectId === 'undefined') ? null : rawSubjectId;
  const rawSchoolId = searchParams.get('sid') || searchParams.get('schoolId') || searchParams.get('school_id') || null;
  const schoolId = (rawSchoolId === 'null' || rawSchoolId === 'undefined') ? null : rawSchoolId;

  // Deteksi apakah link ini merupakan Smart Link Dokumen Presensi
  const isReportLink = Boolean(
    isExplicitReport ||
    classId ||
    periodParam ||
    (dateParam && (searchParams.get('m') || searchParams.get('s') || searchParams.get('cn')))
  );

  if (!isReportLink) return null;

  const resolvedReportType = periodCodeToReportType(periodParam);
  const now = new Date();
  const defaultYear = String(now.getFullYear());
  const indoMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const defaultMonth = indoMonths[now.getMonth()] || 'September';
  const rawClassName = searchParams.get('cn') || searchParams.get('className') || '';
  const className = (rawClassName === 'null' || rawClassName === 'undefined') ? '' : rawClassName;

  return {
    classId: classId || '',
    className,
    schoolId,
    date: dateParam || now.toISOString().split('T')[0],
    attendanceType: isSubjectMode ? 'SUBJECT' : 'DAILY',
    subjectId,
    reportType: resolvedReportType,
    selectedWeek: searchParams.get('w') || searchParams.get('week') || 'Minggu Ke-1',
    month: searchParams.get('mo') || searchParams.get('month') || defaultMonth,
    year: searchParams.get('y') || searchParams.get('year') || defaultYear,
    semester: (searchParams.get('sem') === 'Genap' || searchParams.get('semester') === 'Genap') ? 'Genap' : 'Ganjil',
    academicYear: searchParams.get('ay') || searchParams.get('academicYear') || `${defaultYear}/${Number(defaultYear) + 1}`,
  };
}

/**
 * Pemicu unduh file blob yang aman dan kompatibel dengan semua jenis browser (Desktop, Android, iOS Safari, PWA)
 */
export function triggerPdfDownload(blob: Blob, name: string): void {
  const safeName = name.endsWith('.pdf') ? name : `${name}.pdf`;
  try {
    if (typeof window !== 'undefined' && (window.navigator as any)?.msSaveOrOpenBlob) {
      (window.navigator as any).msSaveOrOpenBlob(blob, safeName);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.position = 'fixed';
    a.style.left = '-9999px';
    a.style.opacity = '0';
    a.href = url;
    a.download = safeName;
    a.rel = 'noopener noreferrer';
    a.target = '_self';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 10000);
  } catch (e) {
    console.error('[triggerPdfDownload Error]', e);
    try {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (_) {}
  }
}

/**
 * Ekspor dokumen presensi resmi langsung ke berkas PDF A4 beresolusi tinggi.
 * Menghasilkan berkas PDF yang terintegrasi dan sama persis dengan tampilan laporan di aplikasi
 * tanpa terpotong atau terpengaruh oleh scaling tampilan mobile.
 */
export async function exportReportToPdf(element: HTMLElement, filename = 'Laporan_Presensi.pdf'): Promise<boolean> {
  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  // 1. Simpan konfigurasi gaya elemen live DOM sebelum proses rendering
  const originalTransform = element.style.transform;
  const originalTransformOrigin = element.style.transformOrigin;
  const originalWidth = element.style.width;
  const originalMinWidth = element.style.minWidth;
  const originalMaxWidth = element.style.maxWidth;

  const parent = element.parentElement;
  const originalParentWidth = parent?.style.width || '';
  const originalParentHeight = parent?.style.height || '';
  const originalParentOverflow = parent?.style.overflow || '';

  const inlinedImages: { img: HTMLImageElement; originalSrc: string }[] = [];

  try {
    // 2. Pre-inline semua tag <img> di dalam dokumen ke base64 data-URL
    // Menghindari kegagalan CORS pada gambar logo / kop surat
    const imgs = Array.from(element.querySelectorAll('img'));
    await Promise.all(
      imgs.map(async (img) => {
        if (!img.src || img.src.startsWith('data:')) return;
        try {
          if (img.complete && img.naturalWidth > 0) {
            try {
              const c = document.createElement('canvas');
              c.width = img.naturalWidth;
              c.height = img.naturalHeight;
              const ctx = c.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const dataUrl = c.toDataURL('image/png');
                inlinedImages.push({ img, originalSrc: img.src });
                img.src = dataUrl;
                return;
              }
            } catch (_) {}
          }
          const resp = await fetch(img.src, { mode: 'cors' });
          if (resp.ok) {
            const b = await resp.blob();
            const reader = new FileReader();
            await new Promise((res) => {
              reader.onloadend = () => {
                if (reader.result) {
                  inlinedImages.push({ img, originalSrc: img.src });
                  img.src = reader.result as string;
                }
                res(null);
              };
              reader.readAsDataURL(b);
            });
          }
        } catch (_) {}
      })
    );

    // 3. Normalkan live DOM sejenak ke ukuran A4 standar (794px lebar)
    // agar html2canvas mengukur dimensi bounding client asli tanpa dipangkas oleh overflow/scaling HP
    element.style.transform = 'none';
    element.style.transformOrigin = 'top left';
    element.style.width = '794px';
    element.style.minWidth = '794px';
    element.style.maxWidth = '794px';
    if (parent) {
      parent.style.width = 'auto';
      parent.style.height = 'auto';
      parent.style.overflow = 'visible';
    }

    // Jeda singkat agar browser menyelesaikan kalkulasi layout
    await new Promise((resolve) => setTimeout(resolve, 80));

    // 4. Render canvas menggunakan html2canvas dengan resolusi tinggi (scale: 2)
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200, // Mengaktifkan breakpoint desktop Tailwind (sm:, md:)
      imageTimeout: 15000,
      onclone: (_clonedDoc, clonedEl) => {
        clonedEl.style.transform = 'none';
        clonedEl.style.width = '794px';
        clonedEl.style.minWidth = '794px';
        clonedEl.style.maxWidth = '794px';
        clonedEl.style.margin = '0 auto';
        clonedEl.style.boxSizing = 'border-box';
        clonedEl.style.padding = '32px 36px';
        clonedEl.style.backgroundColor = '#ffffff';

        clonedEl.classList.remove('shadow-xl', 'shadow-sm', 'border', 'border-slate-300');

        if (clonedEl.parentElement) {
          clonedEl.parentElement.style.width = 'auto';
          clonedEl.parentElement.style.height = 'auto';
          clonedEl.parentElement.style.overflow = 'visible';
          clonedEl.parentElement.style.transform = 'none';
        }

        clonedEl.querySelectorAll('.overflow-x-auto').forEach((el) => {
          (el as HTMLElement).style.overflow = 'visible';
          (el as HTMLElement).style.width = '100%';
        });
        clonedEl.querySelectorAll('table').forEach((tbl) => {
          (tbl as HTMLElement).style.width = '100%';
          (tbl as HTMLElement).style.minWidth = '100%';
        });
      },
    });

    // 5. Susun halaman PDF A4
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfPageWidth = 210;
    const pdfPageHeight = 297;
    const marginX = 8;
    const marginY = 8;
    const printableWidth = pdfPageWidth - marginX * 2; // 194 mm
    const printableHeight = pdfPageHeight - marginY * 2; // 281 mm

    const totalHeightMm = (canvas.height * printableWidth) / canvas.width;

    if (totalHeightMm <= printableHeight + 12) {
      // Muat dalam 1 lembar A4 penuh
      const finalHeight = Math.min(totalHeightMm, printableHeight);
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imgData, 'JPEG', marginX, marginY, printableWidth, finalHeight);
    } else {
      // Pembagian halaman bertingkat yang rapi tanpa tumpang tindih
      const pxPerPage = Math.floor(canvas.width * (printableHeight / printableWidth));
      let currentY = 0;
      let pageIdx = 0;

      while (currentY < canvas.height) {
        const slicePx = Math.min(pxPerPage, canvas.height - currentY);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = slicePx;
        const pageCtx = pageCanvas.getContext('2d');
        if (pageCtx) {
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(
            canvas,
            0, currentY, canvas.width, slicePx,
            0, 0, canvas.width, slicePx
          );
          const sliceImgData = pageCanvas.toDataURL('image/jpeg', 0.98);
          const sliceHeightMm = (slicePx * printableWidth) / canvas.width;

          if (pageIdx > 0) {
            pdf.addPage();
          }
          pdf.addImage(sliceImgData, 'JPEG', marginX, marginY, printableWidth, sliceHeightMm);
        }
        currentY += pxPerPage;
        pageIdx++;
      }
    }

    const blob = pdf.output('blob');
    triggerPdfDownload(blob, safeFilename);
    return true;
  } catch (err) {
    console.warn('[html2canvas PDF Export Error, trying comprehensive programmatic PDF fallback]', err);
    try {
      const fallbackPdf = generateReportPdfProgrammatic(element);
      const blob = fallbackPdf.output('blob');
      triggerPdfDownload(blob, safeFilename);
      return true;
    } catch (fallbackErr) {
      console.error('[Fatal PDF Generation Error]', fallbackErr);
      return false;
    }
  } finally {
    // 6. Kembalikan kondisi asli elemen di tampilan web
    element.style.transform = originalTransform;
    element.style.transformOrigin = originalTransformOrigin;
    element.style.width = originalWidth;
    element.style.minWidth = originalMinWidth;
    element.style.maxWidth = originalMaxWidth;
    if (parent) {
      parent.style.width = originalParentWidth;
      parent.style.height = originalParentHeight;
      parent.style.overflow = originalParentOverflow;
    }
    inlinedImages.forEach(({ img, originalSrc }) => {
      img.src = originalSrc;
    });
  }
}

/**
 * Fallback generator PDF resmi lengkap menggunakan jsPDF + jspdf-autotable.
 * Memuat seluruh struktur identik aplikasi: Kop Surat, Judul Periode, Matriks Atribut, Tabel Presensi, dan Pengesahan Tanda Tangan.
 */
function generateReportPdfProgrammatic(element: HTMLElement): jsPDF {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 12;

  // 1. Ekstraksi Data Kop Surat
  const pemda = element.querySelector('h4:nth-of-type(1)')?.textContent?.trim() || 'PEMERINTAH DAERAH';
  const dinas = element.querySelector('h4:nth-of-type(2)')?.textContent?.trim() || 'DINAS PENDIDIKAN';
  const schoolName = element.querySelector('h2')?.textContent?.trim() || 'SEKOLAH';
  const addressParagraphs = element.querySelectorAll('.flex-1 p');
  const address = addressParagraphs[0]?.textContent?.trim() || '';
  const metaLine = addressParagraphs[1]?.textContent?.trim() || '';

  let currentY = 12;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text(pemda.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;
  pdf.text(dinas.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  pdf.setFontSize(13);
  pdf.text(schoolName.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
  currentY += 4.5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  if (address) {
    pdf.text(address, pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.8;
  }
  if (metaLine) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.text(metaLine, pageWidth / 2, currentY, { align: 'center' });
    currentY += 4.5;
  }

  // Garis ganda pembatas kop surat
  pdf.setLineWidth(0.7);
  pdf.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 0.8;
  pdf.setLineWidth(0.2);
  pdf.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 6;

  // 2. Judul Laporan & Periode
  const reportTitle = element.querySelector('h3')?.textContent?.trim() || 'LAPORAN REKAPITULASI PRESENSI RESMI';
  const reportSubtitle = element.querySelector('h3 + p')?.textContent?.trim() || '';

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(reportTitle.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;

  if (reportSubtitle) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(reportSubtitle, pageWidth / 2, currentY, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    currentY += 5.5;
  }

  // 3. Tabel Kehadiran
  const tableEl = element.querySelector('table');
  if (tableEl) {
    autoTable(pdf, {
      html: tableEl,
      startY: currentY,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 1.5,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: 0.2,
        lineColor: [148, 163, 184],
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
      tableLineColor: [148, 163, 184],
      tableLineWidth: 0.2,
      margin: { left: marginX, right: marginX },
    });

    currentY = (pdf as any).lastAutoTable.finalY + 8;
  }

  // 4. Lembar Pengesahan Tanda Tangan Resmi (2 Kolom Berdampingan)
  if (currentY > 235) {
    pdf.addPage();
    currentY = 20;
  }

  const signColLeft = marginX + 30;
  const signColRight = pageWidth - marginX - 30;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('Mengetahui,', signColLeft, currentY, { align: 'center' });
  pdf.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, signColRight, currentY, { align: 'center' });
  currentY += 4;

  pdf.setFont('helvetica', 'bold');
  pdf.text(`Kepala ${schoolName}`, signColLeft, currentY, { align: 'center' });
  pdf.text('Wali Kelas / Guru Pengajar', signColRight, currentY, { align: 'center' });
  currentY += 18;

  // Nama Pejabat & Tanda Tangan
  const principalEl = element.querySelector('.grid-cols-2 > div:first-child p.underline');
  const teacherEl = element.querySelector('.grid-cols-2 > div:last-child p.underline');
  const pName = principalEl?.textContent?.trim() || 'Kepala Sekolah';
  const tName = teacherEl?.textContent?.trim() || 'Wali Kelas / Guru';

  pdf.text(pName, signColLeft, currentY, { align: 'center' });
  pdf.text(tName, signColRight, currentY, { align: 'center' });
  currentY += 3.8;

  const principalNipEl = element.querySelector('.grid-cols-2 > div:first-child p.font-mono');
  const teacherNipEl = element.querySelector('.grid-cols-2 > div:last-child p.font-mono');
  const pNip = principalNipEl?.textContent?.trim() || 'NIP. -';
  const tNip = teacherNipEl?.textContent?.trim() || 'NIP. -';

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text(pNip, signColLeft, currentY, { align: 'center' });
  pdf.text(tNip, signColRight, currentY, { align: 'center' });

  return pdf;
}
