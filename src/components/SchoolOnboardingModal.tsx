import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Building2,
  User,
  ShieldCheck,
  Check,
  Copy,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  Zap,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  School,
  Download,
  Receipt,
  Phone,
  GraduationCap,
  BookOpen,
  Sparkles,
  Calendar,
  Layers,
  FileText,
  DollarSign,
  CreditCard,
  Hash,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../context/AppContext';

// 3D Picture Assets
import school3dImg from '../assets/images/pricing_school_3d_1789854004156.jpg';
import waliKelasWanitaImg from '../assets/images/wali_kelas_wanita_1789830539387.jpg';
import guruMapelPriaImg from '../assets/images/guru_mapel_pria_1789830556851.jpg';
import directSub3dImg from '../assets/images/superadmin_direct_sub_3d_1789903520542.jpg';

export interface SchoolOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'superadmin' | 'public';
  lang?: 'ID' | 'EN';
  onSchoolCreated?: (newSchool: any) => Promise<void> | void;
}

export type OnboardingStep = 'pilih_ruang_kerja' | 'pendaftaran' | 'selesai';
export type WorkspaceSelection = 'school' | 'personal';
export type TeacherRoleSelection = 'WALI KELAS' | 'GURU MAPEL';
export type DurationPreset = 'monthly' | 'yearly' | 'permanent' | 'custom';

export interface CreatedSchoolData {
  schoolId?: string;
  schoolName: string;
  schoolCode: string;
  adminName: string;
  username: string;
  password: string;
  role: string;
  teacherRole?: string;
  targetGrade?: number;
  subjectName?: string;
  npsn?: string;
  email?: string;
  phone?: string;
  workspaceType: WorkspaceSelection;
  durationPreset: DurationPreset;
  subscriptionExpiresAt: string;
  invoiceNo?: string;
  priceAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentNotes?: string;
  rawSchool?: any;
}

export const SchoolOnboardingModal: React.FC<SchoolOnboardingModalProps> = ({
  isOpen,
  onClose,
  onSchoolCreated,
}) => {
  const { showToast } = useApp();

  // 1. Step Navigation: pilih_ruang_kerja -> pendaftaran -> selesai
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('pilih_ruang_kerja');

  // 2. Ruang Kerja State
  const [workspaceType, setWorkspaceType] = useState<WorkspaceSelection>('school');

  // 3. Form: Ruang Kerja Individu State
  const [teacherRole, setTeacherRole] = useState<TeacherRoleSelection>('WALI KELAS');
  const [teacherGrade, setTeacherGrade] = useState<number>(1);
  const [teacherSubject, setTeacherSubject] = useState<string>('Pendidikan Jasmani, Olahraga & Kesehatan (PJOK)');
  const [teacherName, setTeacherName] = useState<string>('');
  const [teacherNip, setTeacherNip] = useState<string>('');
  const [teacherOriginSchool, setTeacherOriginSchool] = useState<string>('');

  // 4. Form: Ruang Kerja Sekolah State
  const [schoolName, setSchoolName] = useState<string>('');
  const [npsn, setNpsn] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('');

  // 5. Shared Account State
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  // 6. Subscription & Duration State
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('yearly');
  const [customExpiresAt, setCustomExpiresAt] = useState<string>('');

  // 7. Transaksi & Input Harga Finansial State (Direct Owner)
  const [priceAmount, setPriceAmount] = useState<number>(1500000);
  const [paymentMethod, setPaymentMethod] = useState<string>('Transfer Bank Langsung ke Owner');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [paymentNotes, setPaymentNotes] = useState<string>('Pembayaran langsung ke owner (Direct Sub)');

  // 8. Result & UI State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [createdData, setCreatedData] = useState<CreatedSchoolData | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [active3dBase64, setActive3dBase64] = useState<string>('');
  const [isDownloadingJpeg, setIsDownloadingJpeg] = useState<boolean>(false);
  const [isDownloadingPng, setIsDownloadingPng] = useState<boolean>(false);
  const [copiedCredentials, setCopiedCredentials] = useState<boolean>(false);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [isCopyingImage, setIsCopyingImage] = useState<boolean>(false);
  const [fallbackImageUrl, setFallbackImageUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  const credentialCardRef = useRef<HTMLDivElement>(null);

  // Auto-calculate expiry date
  useEffect(() => {
    if (isOpen) {
      if (durationPreset === 'monthly') {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        setCustomExpiresAt(d.toISOString().slice(0, 10));
      } else if (durationPreset === 'yearly') {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        setCustomExpiresAt(d.toISOString().slice(0, 10));
      } else if (durationPreset === 'permanent') {
        setCustomExpiresAt('');
      }
    }
  }, [isOpen, durationPreset]);

  // Adjust default price when workspace type or duration changes
  useEffect(() => {
    if (workspaceType === 'personal') {
      if (durationPreset === 'monthly') setPriceAmount(50000);
      else if (durationPreset === 'yearly') setPriceAmount(500000);
      else if (durationPreset === 'permanent') setPriceAmount(1000000);
    } else {
      if (durationPreset === 'monthly') setPriceAmount(150000);
      else if (durationPreset === 'yearly') setPriceAmount(1500000);
      else if (durationPreset === 'permanent') setPriceAmount(3000000);
    }
  }, [workspaceType, durationPreset]);

  // Generate QR Code & Pre-convert 3D image on Step 'selesai'
  useEffect(() => {
    if (currentStep === 'selesai' && createdData) {
      const loginUrl = `${window.location.origin}/login`;
      QRCode.toDataURL(loginUrl, {
        width: 280,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.warn('Gagal render QRCode login:', err));

      const rawSrc =
        createdData.workspaceType === 'school'
          ? school3dImg
          : createdData.teacherRole === 'WALI KELAS'
          ? waliKelasWanitaImg
          : guruMapelPriaImg;

      // Konversi gambar visual 3D ke Data URL via fetch blob (bebas kendala CORS/taint)
      fetch(rawSrc)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              setActive3dBase64(reader.result);
            }
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {
          setActive3dBase64(rawSrc);
        });
    }
  }, [currentStep, createdData]);

  // Reset form
  const handleResetModal = () => {
    if (isSubmitting) return;
    setCurrentStep('pilih_ruang_kerja');
    setWorkspaceType('school');
    setTeacherRole('WALI KELAS');
    setTeacherGrade(1);
    setTeacherSubject('Pendidikan Jasmani, Olahraga & Kesehatan (PJOK)');
    setTeacherName('');
    setTeacherNip('');
    setTeacherOriginSchool('');
    setSchoolName('');
    setNpsn('');
    setAdminName('');
    setUsername('');
    setPassword('');
    setEmail('');
    setPhone('');
    setDurationPreset('yearly');
    setPriceAmount(1500000);
    setPaymentMethod('Transfer Bank Langsung ke Owner');
    setPaymentStatus('paid');
    setPaymentNotes('Pembayaran langsung ke owner (Direct Sub)');
    setFormError('');
    setCreatedData(null);
    setQrCodeUrl('');
    setActive3dBase64('');
    setFallbackImageUrl('');
    setCopiedCredentials(false);
    setCopiedImage(false);
    setCopiedCode(false);
    onClose();
  };

  // Quick username suggestion
  const generateSuggestedUsername = () => {
    if (workspaceType === 'school') {
      const clean = (schoolName || 'sekolah')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 12);
      setUsername(`admin.${clean || 'sd'}`);
    } else {
      const clean = (teacherName || 'guru')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 10);
      const rolePrefix = teacherRole === 'WALI KELAS' ? `wali.k${teacherGrade}` : 'mapel';
      setUsername(`${rolePrefix}.${clean || 'sd'}`);
    }
  };

  // Quick random password generator
  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let rand = '';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(`Sdm@${rand}`);
  };

  // Submission handler
  const handleSubmitRegistration = async () => {
    setFormError('');

    // Validations
    if (workspaceType === 'school') {
      if (!schoolName.trim()) {
        setFormError('Nama Satuan Pendidikan wajib diisi.');
        return;
      }
      if (!adminName.trim()) {
        setFormError('Nama Administrator / Penanggung Jawab sekolah wajib diisi.');
        return;
      }
    } else {
      if (!teacherName.trim()) {
        setFormError('Nama Lengkap Pendidik wajib diisi.');
        return;
      }
      if (!teacherOriginSchool.trim()) {
        setFormError('Nama Satuan Pendidikan / Asal Sekolah pendidik wajib diisi.');
        return;
      }
    }

    if (!username.trim()) {
      setFormError('Username login akun wajib ditentukan.');
      return;
    }
    if (!password.trim() || password.trim().length < 6) {
      setFormError('Kata sandi login minimal 6 karakter demi keamanan akun.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Safe auth token retrieval (prevents Cannot read properties of undefined reading 'auth')
      let token: string | null = null;
      try {
        if (supabase && typeof supabase.auth?.getSession === 'function') {
          const { data: sessionData } = await supabase.auth.getSession();
          token = sessionData?.session?.access_token || null;
        }
      } catch (authErr) {
        console.warn('Gagal membaca token auth supabase:', authErr);
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const effectiveSchoolName =
        workspaceType === 'school' ? schoolName.trim() : teacherOriginSchool.trim();
      const effectiveFullName =
        workspaceType === 'school' ? adminName.trim() : teacherName.trim();
      const effectivePlan = workspaceType === 'school' ? 'sekolah_pro' : 'guru_pro';

      const payload = {
        mode: 'superadmin',
        isSuperadmin: true,
        workspace_type: workspaceType,
        workspaceType,
        schoolName: effectiveSchoolName,
        adminName: effectiveFullName,
        fullName: effectiveFullName,
        username: username.trim().toLowerCase(),
        password: password.trim(),
        npsn: npsn.trim() || undefined,
        email: email.trim() || undefined,
        adminEmail: email.trim() || undefined,
        adminPhone: phone.trim() || undefined,
        plan: effectivePlan,
        teacherType: workspaceType === 'personal' ? (teacherRole === 'GURU MAPEL' ? 'GURU_MAPEL' : 'WALI_KELAS') : undefined,
        role: workspaceType === 'personal' ? teacherRole : 'ADMIN',
        teacherGrade: workspaceType === 'personal' && teacherRole === 'WALI KELAS' ? teacherGrade : undefined,
        teacherSubject: workspaceType === 'personal' && teacherRole === 'GURU MAPEL' ? teacherSubject.trim() : undefined,
        teacherNip: workspaceType === 'personal' ? teacherNip.trim() : undefined,
        subscription_expires_at: durationPreset === 'permanent' ? null : (customExpiresAt || null),
        price: priceAmount,
        amount: priceAmount,
        paymentMethod,
        paymentStatus,
        paymentNotes: paymentNotes.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      };

      const res = await fetch('/api/register-school', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.ok) {
        throw new Error(resData.error || 'Gagal memproses pendaftaran ruang kerja.');
      }

      const createdSchool = resData.school;
      const createdAdmin = resData.admin;
      const invoiceNo = resData.invoiceNo || resData.payment?.invoice_no || `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

      const successInfo: CreatedSchoolData = {
        schoolId: createdSchool?.id,
        schoolName: createdSchool?.name || effectiveSchoolName,
        schoolCode: createdSchool?.code || createdSchool?.schoolCode || 'SCH-' + Math.floor(100000 + Math.random() * 900000),
        adminName: createdAdmin?.name || effectiveFullName,
        username: createdAdmin?.username || username.trim().toLowerCase(),
        password: password.trim(),
        role: workspaceType === 'school' ? 'ADMIN' : teacherRole,
        teacherRole: workspaceType === 'personal' ? teacherRole : undefined,
        targetGrade: teacherRole === 'WALI KELAS' ? teacherGrade : undefined,
        subjectName: teacherRole === 'GURU MAPEL' ? teacherSubject : undefined,
        npsn: npsn.trim() || createdSchool?.npsn || undefined,
        email: email.trim() || createdAdmin?.email || undefined,
        phone: phone.trim() || undefined,
        workspaceType,
        durationPreset,
        subscriptionExpiresAt: durationPreset === 'permanent' ? 'Permanen (Seumur Hidup)' : (customExpiresAt ? `${customExpiresAt}` : '1 Tahun'),
        invoiceNo,
        priceAmount,
        paymentMethod,
        paymentStatus,
        paymentNotes,
        rawSchool: createdSchool,
      };

      setCreatedData(successInfo);
      setCurrentStep('selesai');
      showToast('Pendaftaran ruang kerja berhasil disimpan dan diaktifkan!', 'success');
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem saat memproses data pendaftaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to safely draw rounded rectangles in Canvas2D
  const drawRoundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }
  };

  // Fallback high-DPI Canvas 2D card generator
  const generateDirectCanvasBlob = async (
    data: CreatedSchoolData,
    qrUrl: string,
    img3dUrl: string,
    mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg'
  ): Promise<Blob | null> => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 700;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Background Gradient (Dark Navy / Indigo)
      const grad = ctx.createLinearGradient(0, 0, 1200, 700);
      grad.addColorStop(0, '#020617');
      grad.addColorStop(0.5, '#0f172a');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 700);

      // Card Outer Border
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, 1184, 684);

      // Header Logo Icon
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      drawRoundRect(ctx, 40, 36, 46, 46, 12);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('K', 63, 59);

      // Brand Name & Subtitle
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '900 22px sans-serif';
      ctx.fillText('KAWACANAAN SD', 98, 55);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 12px sans-serif';
      ctx.fillText('KARTU KREDENSIAL RESMI PENDIDIK & SEKOLAH', 98, 75);

      // Top Right Workspace Badge
      const workspaceLabel =
        data.workspaceType === 'school'
          ? 'RUANG KERJA SEKOLAH'
          : data.teacherRole === 'WALI KELAS'
          ? 'GURU WALI KELAS'
          : 'GURU MATA PELAJARAN';

      ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      drawRoundRect(ctx, 880, 36, 280, 42, 21);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(workspaceLabel, 1020, 62);

      // Divider Line
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(40, 100);
      ctx.lineTo(1160, 100);
      ctx.stroke();

      // Helper to safely load image without CORS tainting for data URLs
      const loadImage = (src: string): Promise<HTMLImageElement | null> => {
        return new Promise((resolve) => {
          if (!src) return resolve(null);
          const img = new Image();
          if (src.startsWith('http://') || src.startsWith('https://')) {
            img.crossOrigin = 'anonymous';
          }
          img.onload = () => resolve(img);
          img.onerror = () => {
            console.warn('Canvas image load fallback for:', src.slice(0, 40));
            resolve(null);
          };
          img.src = src;
        });
      };

      // 3D Picture Left Panel
      try {
        const rawSrc =
          img3dUrl ||
          active3dBase64 ||
          (data.workspaceType === 'school'
            ? school3dImg
            : data.teacherRole === 'WALI KELAS'
            ? waliKelasWanitaImg
            : guruMapelPriaImg);
        const img3d = await loadImage(rawSrc);
        if (img3d) {
          ctx.save();
          ctx.beginPath();
          drawRoundRect(ctx, 40, 125, 240, 235, 16);
          ctx.clip();
          ctx.drawImage(img3d, 40, 125, 240, 235);
          ctx.restore();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(40, 125, 240, 235);
        } else {
          throw new Error('Fallback to placeholder badge');
        }
      } catch {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        drawRoundRect(ctx, 40, 125, 240, 235, 16);
        ctx.fill();
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('3D Visual Kawacanaan', 160, 245);
      }

      // QR Code Left Panel
      try {
        if (qrUrl) {
          const qrImg = await loadImage(qrUrl);
          if (qrImg) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            drawRoundRect(ctx, 40, 385, 240, 235, 16);
            ctx.fill();
            ctx.drawImage(qrImg, 55, 400, 210, 205);
          }
        }
      } catch (e) {
        console.warn('Direct canvas QR error:', e);
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Scan untuk Masuk ke Portal', 160, 642);

      // Right Panel Information
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('SATUAN PENDIDIKAN', 315, 135);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(data.schoolName.slice(0, 50), 315, 168);

      const roleDetail =
        data.workspaceType === 'school'
          ? `Penanggung Jawab: ${data.adminName} (Administrator)`
          : data.teacherRole === 'WALI KELAS'
          ? `Penanggung Jawab: ${data.adminName} (Wali Kelas ${data.targetGrade || 1})`
          : `Penanggung Jawab: ${data.adminName} (${data.subjectName || 'Guru Mapel'})`;

      ctx.fillStyle = '#60a5fa';
      ctx.font = '500 15px sans-serif';
      ctx.fillText(roleDetail, 315, 196);

      // High-Contrast Credentials Box
      ctx.fillStyle = '#0b1329';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      drawRoundRect(ctx, 315, 222, 845, 240, 16);
      ctx.fill();
      ctx.stroke();

      // Box row 1: Username & Password
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('USERNAME LOGIN', 345, 260);
      ctx.fillText('PASSWORD LOGIN', 755, 260);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(data.username, 345, 296);

      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(data.password, 755, 296);

      // Box row 2: Role & Duration
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('PERAN / HAK AKSES', 345, 355);
      ctx.fillText('MASA AKTIF LISENSI', 755, 355);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(data.role === 'ADMIN' ? 'ADMINISTRATOR' : (data.role || 'ADMINISTRATOR'), 345, 388);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(data.subscriptionExpiresAt || '1 Tahun', 755, 388);

      // Status Pill
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('● STATUS: AKTIF (TERDAFTAR)', 345, 432);

      // Invoice & Payment Details
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`No. Invoice : ${data.invoiceNo || '-'}`, 315, 498);
      ctx.fillText(
        `Nominal     : Rp ${data.priceAmount.toLocaleString('id-ID')} (${
          data.paymentStatus === 'paid' ? 'LUNAS' : 'PENDING'
        })`,
        315,
        525
      );
      ctx.fillText(`Metode      : ${data.paymentMethod || 'Manual / Owner'}`, 315, 552);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '14px monospace';
      ctx.fillText(`Portal Akses: ${window.location.origin}/login`, 315, 586);

      // Footer Divider & Security Seal
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(315, 615);
      ctx.lineTo(1160, 615);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '11px monospace';
      ctx.fillText('SISTEM TERVALIDASI KAWACANAAN SD • SUPER ADMIN REGISTER', 315, 642);
      ctx.textAlign = 'right';
      ctx.fillText(
        `ID: ${data.schoolId?.slice(0, 8) || 'SCH-AUTH'} • ${new Date().toLocaleDateString('id-ID')}`,
        1160,
        642
      );

      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, mimeType, 0.95);
      });
    } catch (err) {
      console.error('generateDirectCanvasBlob fatal error:', err);
      return null;
    }
  };

  // Generic Card Download handler for JPEG and PNG
  const handleDownloadCard = async (format: 'jpeg' | 'png' = 'jpeg') => {
    if (!createdData) return;
    if (format === 'jpeg') setIsDownloadingJpeg(true);
    else setIsDownloadingPng(true);

    try {
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      let blob: Blob | null = null;

      // 1. Direct High-DPI 2D Canvas (cepat, tajam, 100% bebas error CORS DOM)
      blob = await generateDirectCanvasBlob(createdData, qrCodeUrl, active3dBase64, mimeType);

      // 2. Fallback via html2canvas bila direct canvas belum berhasil
      if (!blob && credentialCardRef.current) {
        try {
          const canvas = await html2canvas(credentialCardRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#090d16',
            logging: false,
          });
          blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, mimeType, 0.95);
          });
        } catch (domErr) {
          console.warn('html2canvas rendering error:', domErr);
        }
      }

      if (!blob) {
        throw new Error('Gagal menghasilkan file gambar kartu kredensial.');
      }

      const cleanSchool = (createdData.schoolName || 'sekolah').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const ext = format === 'png' ? 'png' : 'jpg';
      const filename = `kredensial-kawacanaan-${cleanSchool}-${createdData.username}.${ext}`;

      const blobUrl = URL.createObjectURL(blob);
      setFallbackImageUrl(blobUrl);

      // Unduh file secara langsung
      const link = document.createElement('a');
      link.download = filename;
      link.href = blobUrl;
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
      }, 1500);

      showToast(`Kartu kredensial (${format.toUpperCase()}) berhasil diunduh!`, 'success');
    } catch (err: any) {
      console.error(`Gagal mengunduh kartu ${format}:`, err);
      showToast(`Gagal mengunduh kartu ${format.toUpperCase()}: ` + (err.message || 'Silakan gunakan tombol pratinjau gambar.'), 'error');
    } finally {
      setIsDownloadingJpeg(false);
      setIsDownloadingPng(false);
    }
  };

  const handleDownloadJpeg = () => handleDownloadCard('jpeg');
  const handleDownloadPng = () => handleDownloadCard('png');

  // Salin Gambar Kartu ke Clipboard (Bisa langsung Ctrl+V di WhatsApp / Telegram)
  const handleCopyImage = async () => {
    if (!createdData) return;
    setIsCopyingImage(true);

    try {
      let blob: Blob | null = null;

      if (credentialCardRef.current) {
        try {
          const canvas = await html2canvas(credentialCardRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#090d16',
            logging: false,
          });
          blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
        } catch (e) {
          console.warn('html2canvas blob failed for copy:', e);
        }
      }

      if (!blob) {
        blob = await generateDirectCanvasBlob(createdData, qrCodeUrl, active3dBase64, 'image/png');
      }

      if (!blob) throw new Error('Gagal merender gambar untuk clipboard.');

      if (navigator.clipboard && (window as any).ClipboardItem) {
        const item = new (window as any).ClipboardItem({
          'image/png': blob,
        });
        await navigator.clipboard.write([item]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 3000);
        showToast('Gambar kartu berhasil disalin ke clipboard! Siap di-paste di WhatsApp.', 'success');
      } else {
        // Fallback jika ClipboardItem tidak didukung: trigger download
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `kartu-kredensial-${createdData.username}.png`;
        a.click();
        showToast('Clipboard gambar tidak didukung di browser ini. File telah otomatis diunduh.', 'info');
      }
    } catch (err: any) {
      console.error('Gagal salin gambar:', err);
      showToast(err.message || 'Gagal menyalin gambar kartu.', 'error');
    } finally {
      setIsCopyingImage(false);
    }
  };

  // Copy plain credentials
  const handleCopyCredentials = () => {
    if (!createdData) return;
    const roleLabel =
      createdData.workspaceType === 'school'
        ? 'Administrator Satuan Pendidikan'
        : createdData.teacherRole === 'WALI KELAS'
        ? `Wali Kelas (Kelas ${createdData.targetGrade || 1})`
        : `Guru Mapel (${createdData.subjectName || 'Mata Pelajaran'})`;

    const text = `=========================================
KREDENSIAL RESMI KAWACANAAN SD
=========================================
Satuan Pendidikan: ${createdData.schoolName}
Tipe Ruang Kerja : ${createdData.workspaceType === 'school' ? 'Ruang Kerja Sekolah (Terpadu)' : 'Ruang Kerja Individu (Guru Mandiri)'}
Peran Pengguna   : ${roleLabel}
${createdData.npsn ? `NPSN             : ${createdData.npsn}\n` : ''}Penanggung Jawab : ${createdData.adminName}
-----------------------------------------
USERNAME LOGIN   : ${createdData.username}
PASSWORD LOGIN   : ${createdData.password}
-----------------------------------------
No. Faktur Inv.  : ${createdData.invoiceNo || '-'}
Nominal Bayar    : Rp ${createdData.priceAmount.toLocaleString('id-ID')} (${createdData.paymentStatus === 'paid' ? 'LUNAS' : 'MENUNGGU'})
Metode Bayar     : ${createdData.paymentMethod}
Masa Aktif Akun  : ${createdData.subscriptionExpiresAt}
Portal Masuk     : ${window.location.origin}/login
=========================================`;

    navigator.clipboard.writeText(text);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2500);
    showToast('Teks kredensial berhasil disalin ke clipboard!', 'info');
  };

  const handleCopyCode = () => {
    if (!createdData?.schoolCode) return;
    navigator.clipboard.writeText(createdData.schoolCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleOpenPreview = async () => {
    if (!fallbackImageUrl && createdData) {
      const blob = await generateDirectCanvasBlob(createdData, qrCodeUrl, active3dBase64, 'image/jpeg');
      if (blob) {
        setFallbackImageUrl(URL.createObjectURL(blob));
      }
    }
    setShowPreviewModal(true);
  };

  const handleFinish = async () => {
    try {
      if (onSchoolCreated && createdData) {
        await onSchoolCreated(
          createdData.rawSchool || {
            id: createdData.schoolId,
            school_id: createdData.schoolId,
            name: createdData.schoolName,
          }
        );
      }
    } catch (err) {
      console.warn('onSchoolCreated callback error:', err);
    }
    handleResetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl md:max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[92vh]">
        
        {/* ========================================================================= */}
        {/* TOP BAR: Brand & Stepper Progress (Pilih Ruang Kerja -> Pendaftaran -> Selesai) */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 rounded-xl flex items-center justify-center text-white font-black text-sm sm:text-base shadow-sm shadow-blue-700/25 shrink-0 border border-blue-500/40">
              <span>K</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-slate-900 text-sm sm:text-base tracking-tight uppercase">
                  Kawacanaan
                </span>
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-black rounded font-mono uppercase tracking-wider border border-blue-200">
                  SD
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-semibold truncate hidden sm:block">
                Tambah Sekolah &amp; Aktivasi Ruang Kerja Super Admin
              </p>
            </div>
          </div>

          {/* Stepper Steps Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Step 1 */}
            <div
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                currentStep === 'pilih_ruang_kerja'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : currentStep === 'pendaftaran' || currentStep === 'selesai'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 text-current flex items-center justify-center text-[9px] font-black">
                {currentStep === 'pendaftaran' || currentStep === 'selesai' ? '✓' : '1'}
              </span>
              <span className="hidden sm:inline">Pilih Ruang Kerja</span>
            </div>

            <span className="text-slate-300 text-xs">›</span>

            {/* Step 2 */}
            <div
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                currentStep === 'pendaftaran'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : currentStep === 'selesai'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 text-current flex items-center justify-center text-[9px] font-black">
                {currentStep === 'selesai' ? '✓' : '2'}
              </span>
              <span className="hidden sm:inline">Pendaftaran</span>
            </div>

            <span className="text-slate-300 text-xs">›</span>

            {/* Step 3 */}
            <div
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                currentStep === 'selesai'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 text-current flex items-center justify-center text-[9px] font-black">
                3
              </span>
              <span className="hidden sm:inline">Selesai</span>
            </div>

            {/* Exit button */}
            <button
              type="button"
              onClick={handleResetModal}
              disabled={isSubmitting}
              className="ml-1 sm:ml-2 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center disabled:opacity-40"
              id="btn-close-school-onboarding"
              title="Tutup Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL BODY CONTAINER (Scrollable) */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Error Banner */}
          {formError && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in shake duration-200">
              <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold">{formError}</div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: PILIH RUANG KERJA (Sekolah Terpadu vs Individu Guru) */}
          {/* ========================================================================= */}
          {currentStep === 'pilih_ruang_kerja' && (
            <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Pilih Tipe Ruang Kerja
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Tentukan jenis ekosistem presensi yang ingin didaftarkan untuk satuan pendidikan atau pendidik.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PILIHAN 1: RUANG KERJA SEKOLAH */}
                <div
                  onClick={() => setWorkspaceType('school')}
                  className={`group relative rounded-2xl p-4 sm:p-5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    workspaceType === 'school'
                      ? 'border-blue-600 bg-blue-50/30 shadow-md shadow-blue-500/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header Image & Badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-blue-100 shadow-2xs bg-blue-50 shrink-0">
                        <img
                          src={school3dImg}
                          alt="Ruang Kerja Sekolah"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider mb-1">
                          Sekolah Terpadu
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                          Ruang Kerja Sekolah
                        </h3>
                        <p className="text-[11px] font-semibold text-blue-600">
                          Satu Ekosistem Satuan Pendidikan
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Didesain untuk satu sekolah utuh. Memiliki akun Administrator Sekolah untuk mengelola seluruh rombel kelas, guru kelas, guru mapel, dan rekapitulasi kedinasan.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                        Akun Admin Sekolah
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                        Multi-Rombel Kelas
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                        Rekap Sekolah Terpadu
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {workspaceType === 'school' ? '✓ Terpilih' : 'Klik untuk memilih'}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                        workspaceType === 'school'
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                  </div>
                </div>

                {/* PILIHAN 2: RUANG KERJA INDIVIDU */}
                <div
                  onClick={() => setWorkspaceType('personal')}
                  className={`group relative rounded-2xl p-4 sm:p-5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    workspaceType === 'personal'
                      ? 'border-indigo-600 bg-indigo-50/30 shadow-md shadow-indigo-500/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header Image & Badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-indigo-100 shadow-2xs bg-indigo-50 shrink-0">
                        <img
                          src={waliKelasWanitaImg}
                          alt="Ruang Kerja Individu"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase tracking-wider mb-1">
                          Guru Mandiri
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                          Ruang Kerja Individu
                        </h3>
                        <p className="text-[11px] font-semibold text-indigo-600">
                          Wali Kelas atau Guru Mapel
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Didesain untuk guru perorangan (Wali Kelas harian atau Guru Mapel). Mandiri, cepat, dan terfokus pada kelas binaan atau jadwal mengajar tanpa perlu operator sekolah.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                        Pilih Wali Kelas / Guru Mapel
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                        Presensi Cepat Harian
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                        Jurnal Mengajar Otomatis
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {workspaceType === 'personal' ? '✓ Terpilih' : 'Klik untuk memilih'}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                        workspaceType === 'personal'
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResetModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep('pendaftaran');
                    generateSuggestedUsername();
                    generateRandomPassword();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/25 transition cursor-pointer"
                  id="btn-next-to-registration"
                >
                  <span>Lanjutkan ke Formulir Pendaftaran</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: PENDAFTARAN (Form Ruang Kerja Sekolah vs Form Ruang Kerja Individu) */}
          {/* ========================================================================= */}
          {currentStep === 'pendaftaran' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                    {workspaceType === 'school'
                      ? 'Formulir Pendaftaran Ruang Kerja Sekolah'
                      : 'Formulir Pendaftaran Ruang Kerja Individu'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Lengkapi identitas lembaga, kredensial login, durasi, dan catatan transaksi pembayaran.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStep('pilih_ruang_kerja')}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer transition shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ubah Tipe Ruang Kerja</span>
                </button>
              </div>

              {/* =================================================================== */}
              {/* KHUSUS RUANG KERJA INDIVIDU: PILIH PERAN (Wali Kelas / Guru Mapel) */}
              {/* =================================================================== */}
              {workspaceType === 'personal' && (
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
                  <label className="block text-xs font-black text-indigo-950 uppercase tracking-wider">
                    Pilih Peran Pendidik di Ruang Kerja Individu:
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Kartu Peran Wali Kelas */}
                    <div
                      onClick={() => {
                        setTeacherRole('WALI KELAS');
                        generateSuggestedUsername();
                      }}
                      className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                        teacherRole === 'WALI KELAS'
                          ? 'border-blue-600 bg-white shadow-xs'
                          : 'border-slate-200 bg-white/60 hover:bg-white'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-blue-200 shrink-0">
                        <img
                          src={waliKelasWanitaImg}
                          alt="Wali Kelas"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900">Wali Kelas SD</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          Presensi 1 rombel binaan harian
                        </p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold ${
                          teacherRole === 'WALI KELAS'
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 text-transparent'
                        }`}
                      >
                        ✓
                      </div>
                    </div>

                    {/* Kartu Peran Guru Mapel */}
                    <div
                      onClick={() => {
                        setTeacherRole('GURU MAPEL');
                        generateSuggestedUsername();
                      }}
                      className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                        teacherRole === 'GURU MAPEL'
                          ? 'border-emerald-600 bg-white shadow-xs'
                          : 'border-slate-200 bg-white/60 hover:bg-white'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-emerald-200 shrink-0">
                        <img
                          src={guruMapelPriaImg}
                          alt="Guru Mapel"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900">Guru Mapel SD</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          Presensi per jam &amp; multi-rombel
                        </p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold ${
                          teacherRole === 'GURU MAPEL'
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 text-transparent'
                        }`}
                      >
                        ✓
                      </div>
                    </div>
                  </div>

                  {/* Sub-form Peran Wali Kelas: Pilihan Kelas Binaan */}
                  {teacherRole === 'WALI KELAS' && (
                    <div className="pt-2 border-t border-indigo-100 flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-700 shrink-0">
                        Pilih Kelas Binaan:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[1, 2, 3, 4, 5, 6].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              setTeacherGrade(g);
                              generateSuggestedUsername();
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              teacherGrade === g
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            Kelas {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sub-form Peran Guru Mapel: Pilihan / Input Mata Pelajaran */}
                  {teacherRole === 'GURU MAPEL' && (
                    <div className="pt-2 border-t border-indigo-100 space-y-2">
                      <label className="block text-xs font-bold text-slate-700">
                        Nama Mata Pelajaran yang Diampu:
                      </label>
                      <input
                        type="text"
                        value={teacherSubject}
                        onChange={(e) => setTeacherSubject(e.target.value)}
                        placeholder="Contoh: PJOK, PABP, Bahasa Inggris, SBdP, dll"
                        className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:outline-blue-600"
                      />
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-semibold">Pilihan Cepat:</span>
                        {[
                          'Pendidikan Jasmani, Olahraga & Kesehatan (PJOK)',
                          'Pendidikan Agama & Budi Pekerti (PABP)',
                          'Bahasa Inggris',
                          'Seni Budaya & Prakarya (SBdP)',
                          'Muatan Lokal / Bahasa Daerah',
                        ].map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setTeacherSubject(sub)}
                            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-blue-600 text-[10px] font-medium cursor-pointer"
                          >
                            {sub.split('(')[0].trim()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* =================================================================== */}
              {/* FORM DATA IDENTITAS & LEMBAGA */}
              {/* =================================================================== */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    {workspaceType === 'school' ? 'Data Satuan Pendidikan (Sekolah)' : 'Data Pendidik & Sekolah Asal'}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {workspaceType === 'school' ? (
                    <>
                      {/* Form Sekolah */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Nama Satuan Pendidikan <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          onBlur={generateSuggestedUsername}
                          placeholder="Contoh: SDN 01 Rawamangun Pagi"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-semibold focus:outline-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          NPSN (Nomor Pokok Sekolah Nasional)
                        </label>
                        <input
                          type="text"
                          value={npsn}
                          onChange={(e) => setNpsn(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          placeholder="8 digit angka (opsional)"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono font-semibold focus:outline-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Nama Administrator / Kepala Sekolah <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="Contoh: Bpk. Hendra Gunawan, M.Pd"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-semibold focus:outline-blue-600"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Form Individu Guru */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Nama Lengkap Pendidik <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={teacherName}
                          onChange={(e) => setTeacherName(e.target.value)}
                          onBlur={generateSuggestedUsername}
                          placeholder="Contoh: Ibu Siti Rahmawati, S.Pd"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-semibold focus:outline-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          NIP (Nomor Induk Pegawai)
                        </label>
                        <input
                          type="text"
                          value={teacherNip}
                          onChange={(e) => setTeacherNip(e.target.value)}
                          placeholder="Contoh: 198504122010012015 (opsional)"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono font-semibold focus:outline-blue-600"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Nama Satuan Pendidikan / Asal Sekolah <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={teacherOriginSchool}
                          onChange={(e) => setTeacherOriginSchool(e.target.value)}
                          placeholder="Contoh: SDN Menteng 01 Pagi"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-semibold focus:outline-blue-600"
                        />
                      </div>
                    </>
                  )}

                  {/* Kontak Shared */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      No. WhatsApp / Telepon PIC
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono font-semibold focus:outline-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Alamat Email (Opsional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@sekolah.sch.id"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-semibold focus:outline-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* =================================================================== */}
              {/* KREDENSIAL LOGIN PENGGUNA */}
              {/* =================================================================== */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Kredensial Akses Masuk (Login)
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={generateSuggestedUsername}
                      className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Saran Username
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[10px] font-bold text-amber-700 hover:underline cursor-pointer"
                    >
                      Acak Sandi
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Username Login <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                      placeholder="Contoh: admin.sdn01 / guru.siti"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:outline-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Kata Sandi (Password) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:outline-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* =================================================================== */}
              {/* DURASI LISENSI */}
              {/* =================================================================== */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Durasi Masa Aktif Langganan
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'monthly', label: '1 Bulan', sub: '30 Hari Aktif' },
                    { id: 'yearly', label: '1 Tahun', sub: '365 Hari (Rekomendasi)' },
                    { id: 'permanent', label: 'Permanen', sub: 'Seumur Hidup' },
                    { id: 'custom', label: 'Custom', sub: 'Pilih Tanggal' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDurationPreset(p.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        durationPreset === p.id
                          ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs">{p.label}</div>
                      <div className="text-[10px] text-slate-500 font-medium truncate">{p.sub}</div>
                    </button>
                  ))}
                </div>

                {durationPreset === 'custom' && (
                  <div className="pt-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tentukan Tanggal Kedaluwarsa:
                    </label>
                    <input
                      type="date"
                      value={customExpiresAt}
                      onChange={(e) => setCustomExpiresAt(e.target.value)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:outline-blue-600"
                    />
                  </div>
                )}
              </div>

              {/* =================================================================== */}
              {/* BAGIAN TRANSAKSI & INVOICE: INPUT HARGA & METODE PEMBAYARAN LANGSUNG */}
              {/* =================================================================== */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-700" />
                    <div>
                      <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                        Pencatatan Transaksi Finansial &amp; Penerbitan Invoice
                      </h3>
                      <p className="text-[10px] text-emerald-700 font-medium">
                        Catat riwayat pembayaran riil (misal bayar ke owner langsung) agar invoice otomatis terbit.
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                    Direct Owner
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  {/* Input Harga Nominal */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      Nominal Harga Transaksi (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        Rp
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={priceAmount}
                        onChange={(e) => setPriceAmount(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-emerald-300 bg-white font-mono font-bold text-slate-900 text-sm focus:outline-emerald-600"
                      />
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-emerald-800 font-semibold">Preset Cepat:</span>
                      {[
                        { label: 'Gratis (Rp 0)', val: 0 },
                        { label: '50rb', val: 50000 },
                        { label: '150rb', val: 150000 },
                        { label: '500rb', val: 500000 },
                        { label: '1.5 Juta', val: 1500000 },
                        { label: '3 Juta', val: 3000000 },
                      ].map((pr) => (
                        <button
                          key={pr.val}
                          type="button"
                          onClick={() => setPriceAmount(pr.val)}
                          className="px-2 py-0.5 rounded bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-bold cursor-pointer transition"
                        >
                          {pr.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status & Metode Pembayaran */}
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">
                        Metode Pembayaran
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white font-semibold text-slate-800 focus:outline-emerald-600 cursor-pointer"
                      >
                        <option value="Transfer Bank Langsung ke Owner">Transfer Bank Langsung ke Rekening Owner</option>
                        <option value="Tunai / Cash Langsung">Tunai / Cash Langsung</option>
                        <option value="Tagihan Invoice Sekolah (Tempo/APBD)">Tagihan Invoice Sekolah (Tempo/APBD)</option>
                        <option value="Subsidi / Khusus / Tanpa Biaya">Subsidi / Khusus / Tanpa Biaya</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">
                        Status Pembayaran Awal
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-800">
                          <input
                            type="radio"
                            name="payStatus"
                            checked={paymentStatus === 'paid'}
                            onChange={() => setPaymentStatus('paid')}
                            className="accent-emerald-600"
                          />
                          <span>Lunas (Settled)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-800">
                          <input
                            type="radio"
                            name="payStatus"
                            checked={paymentStatus === 'pending'}
                            onChange={() => setPaymentStatus('pending')}
                            className="accent-emerald-600"
                          />
                          <span>Menunggu Pembayaran (Pending)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Catatan Transaksi */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      Catatan / Keterangan Transaksi Pembayaran
                    </label>
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Contoh: Transfer BCA a/n Kepala Sekolah Bpk Hendra, Dana BOS Tahap 1, dll."
                      className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 bg-white font-medium text-slate-900 focus:outline-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setCurrentStep('pilih_ruang_kerja')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                >
                  Kembali
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitRegistration}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/25 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  id="btn-submit-registration"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Memproses Pendaftaran &amp; Invoice...</span>
                    </>
                  ) : (
                    <>
                      <span>Daftarkan &amp; Terbitkan Kredensial</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SELESAI & KARTU KREDENSIAL LOGIN (JPEG Download with 3D Picture) */}
          {/* ========================================================================= */}
          {currentStep === 'selesai' && createdData && (
            <div className="space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200">
              {/* Success Badge */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-emerald-950">
                    Pendaftaran Berhasil &amp; Kredensial Siap Digunakan!
                  </h3>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Ruang kerja dan akun login telah aktif. Invoice nomor{' '}
                    <strong className="font-mono">{createdData.invoiceNo}</strong> sebesar{' '}
                    <strong>Rp {createdData.priceAmount.toLocaleString('id-ID')}</strong> berhasil dicatat di sistem.
                  </p>
                </div>
              </div>

              {/* =================================================================== */}
              {/* KARTU KREDENSIAL LOGIN (High-Fidelity DOM Target for JPEG Download) */}
              {/* =================================================================== */}
              <div
                ref={credentialCardRef}
                id="credential-card-canvas"
                className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-800 shadow-2xl overflow-hidden"
              >
                {/* Subtle Decorative Background Circles */}
                <div data-html2canvas-ignore="true" className="absolute -top-12 -right-12 w-48 h-48 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />
                <div data-html2canvas-ignore="true" className="absolute -bottom-12 -left-12 w-48 h-48 bg-indigo-600/15 rounded-full blur-2xl pointer-events-none" />

                {/* Card Header */}
                <div className="relative z-10 flex items-center justify-between pb-3.5 border-b border-slate-800/90 gap-2">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                      K
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-white text-xs sm:text-sm tracking-tight uppercase">
                          Kawacanaan
                        </span>
                        <span className="px-1.5 py-0.2 bg-blue-500/30 text-blue-300 text-[8px] font-black rounded border border-blue-400/40">
                          SD
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">
                        Kartu Kredensial Akses Pendidik &amp; Sekolah
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                      {createdData.workspaceType === 'school'
                        ? 'Ruang Kerja Sekolah'
                        : createdData.teacherRole === 'WALI KELAS'
                        ? 'Wali Kelas'
                        : 'Guru Mapel'}
                    </span>
                    <p className="text-[9px] text-emerald-400 font-mono mt-0.5">
                      ● Status: AKTIF (TERDAFTAR)
                    </p>
                  </div>
                </div>

                {/* Card Body: 3D Picture + Information Grid + QR Code */}
                <div className="relative z-10 pt-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  
                  {/* Left Column: 3D Picture & QR Code Box */}
                  <div className="md:col-span-4 flex flex-row md:flex-col items-center justify-around gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
                    {/* 3D Educator / School Picture */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-blue-400/40 shadow-md bg-slate-800 shrink-0 relative group">
                      <img
                        src={
                          active3dBase64 ||
                          (createdData.workspaceType === 'school'
                            ? school3dImg
                            : createdData.teacherRole === 'WALI KELAS'
                            ? waliKelasWanitaImg
                            : guruMapelPriaImg)
                        }
                        alt="Visual 3D Ruang Kerja"
                        className="w-full h-full object-cover object-top"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
                      <span className="absolute bottom-1 left-1.5 text-[8px] font-black px-1.5 py-0.5 bg-blue-600/90 text-white rounded">
                        3D OFFICIAL
                      </span>
                    </div>

                    {/* QR Code */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 p-1.5 bg-white rounded-xl shadow-md flex items-center justify-center">
                        {qrCodeUrl ? (
                          <img
                            src={qrCodeUrl}
                            alt="QR Login"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-[9px] text-slate-400 text-center font-bold">
                            QR Code...
                          </div>
                        )}
                      </div>
                      <span className="text-[8px] font-mono text-slate-400 mt-1 text-center">
                        Scan untuk Masuk
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Complete Information Details */}
                  <div className="md:col-span-8 space-y-3">
                    {/* Title & Organization */}
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Satuan Pendidikan / Ruang Kerja
                      </span>
                      <h4 className="text-sm sm:text-base font-black text-white tracking-tight mt-0.5">
                        {createdData.schoolName}
                      </h4>
                      <p className="text-[11px] text-blue-300 font-medium">
                        Penanggung Jawab: {createdData.adminName}
                        {createdData.teacherRole === 'WALI KELAS' && ` (Wali Kelas ${createdData.targetGrade || 1})`}
                        {createdData.teacherRole === 'GURU MAPEL' && ` (${createdData.subjectName || 'Mata Pelajaran'})`}
                      </p>
                    </div>

                    {/* High-contrast Credentials Box */}
                    <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Username Login
                        </span>
                        <span className="font-mono font-black text-amber-300 text-xs sm:text-sm tracking-wide mt-0.5 block select-all">
                          {createdData.username}
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Password Login
                        </span>
                        <span className="font-mono font-black text-emerald-300 text-xs sm:text-sm tracking-wide mt-0.5 block select-all">
                          {createdData.password}
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Peran / Hak Akses
                        </span>
                        <span className="font-sans font-bold text-white text-xs mt-0.5 block select-all">
                          {createdData.role === 'ADMIN' ? 'ADMINISTRATOR' : createdData.role}
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Masa Aktif Akun
                        </span>
                        <span className="font-semibold text-slate-200 text-[11px] mt-0.5 block">
                          {createdData.subscriptionExpiresAt}
                        </span>
                      </div>
                    </div>

                    {/* Invoice & Transaction Summary Row */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-400">No. Invoice: </span>
                        <span className="font-mono font-bold text-slate-200">{createdData.invoiceNo}</span>
                      </div>

                      <div>
                        <span className="text-slate-400">Nominal: </span>
                        <span className="font-mono font-bold text-emerald-400">
                          Rp {createdData.priceAmount.toLocaleString('id-ID')}
                        </span>
                        <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">
                          {createdData.paymentStatus === 'paid' ? 'LUNAS' : 'PENDING'}
                        </span>
                      </div>

                      <div className="text-slate-400 font-mono text-[9px]">
                        {window.location.origin}/login
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Security Seal Footer */}
                <div className="relative z-10 mt-3.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[8px] text-slate-500 font-mono">
                  <span>SISTEM TERVALIDASI KAWACANAAN SD • SUPER ADMIN REGISTER</span>
                  <span>ID: {createdData.schoolId?.slice(0, 8) || 'SCH-AUTH'}</span>
                </div>
              </div>

              {/* =================================================================== */}
              {/* ACTION BUTTONS (Download JPEG, Copy Credentials, Finish) */}
              {/* =================================================================== */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Download JPEG Button */}
                  <button
                    type="button"
                    onClick={handleDownloadJpeg}
                    disabled={isDownloadingJpeg}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/25 transition cursor-pointer disabled:opacity-50"
                    id="btn-download-jpeg-card"
                  >
                    {isDownloadingJpeg ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Merender JPEG...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Unduh (JPEG)</span>
                      </>
                    )}
                  </button>

                  {/* Download PNG Button */}
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    disabled={isDownloadingPng}
                    className="px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 active:scale-98 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-sm"
                    id="btn-download-png-card"
                  >
                    {isDownloadingPng ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>Merender PNG...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-indigo-600" />
                        <span>Unduh (PNG)</span>
                      </>
                    )}
                  </button>

                  {/* Preview & Manual Save Button */}
                  <button
                    type="button"
                    onClick={handleOpenPreview}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-98 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                    title="Buka pratinjau kartu gambar penuh untuk simpan manual"
                    id="btn-preview-card"
                  >
                    <Eye className="w-4 h-4 text-slate-600" />
                    <span className="hidden sm:inline">Pratinjau / Simpan</span>
                  </button>

                  {/* Copy Image to Clipboard Button (Direct paste in WhatsApp/Telegram) */}
                  <button
                    type="button"
                    onClick={handleCopyImage}
                    disabled={isCopyingImage}
                    className="px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    title="Salin gambar kartu ke clipboard untuk ditempel langsung (Ctrl+V) di WhatsApp / Telegram"
                    id="btn-copy-card-image"
                  >
                    {isCopyingImage ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>Menyalin...</span>
                      </>
                    ) : copiedImage ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Gambar Disalin!</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        <span className="hidden sm:inline">Salin Gambar</span>
                      </>
                    )}
                  </button>

                  {/* Copy Text Button */}
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    id="btn-copy-card-text"
                  >
                    {copiedCredentials ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-500" />
                        <span className="hidden sm:inline">Salin Teks</span>
                      </>
                    )}
                  </button>

                  {/* Fallback View / Open in Tab */}
                  {fallbackImageUrl && (
                    <a
                      href={fallbackImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center justify-center gap-1 transition"
                      title="Buka gambar hasil render di tab baru"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Tab Baru</span>
                    </a>
                  )}
                </div>

                {/* Finish & Open School Detail */}
                <button
                  type="button"
                  onClick={handleFinish}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 transition cursor-pointer"
                  id="btn-finish-school-onboarding"
                >
                  <span>Selesai &amp; Buka Manajemen Sekolah</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL PRATINJAU KARTU GAMBAR PENUH & SIMPAN MANUAL */}
      {/* ========================================================================= */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header Modal Pratinjau */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    Pratinjau Kartu Kredensial Resmi
                  </h4>
                  <p className="text-xs text-slate-400">
                    Resolusi tinggi siap unduh dan dibagikan ke pengguna
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Gambar Kartu Display */}
            <div className="flex-1 overflow-auto py-4 flex flex-col items-center justify-center bg-slate-950/60 rounded-xl p-2 sm:p-4 my-2 border border-slate-800">
              {fallbackImageUrl ? (
                <img
                  src={fallbackImageUrl}
                  alt="Kartu Kredensial Resmi"
                  className="max-w-full max-h-[55vh] object-contain rounded-xl shadow-2xl border border-slate-800"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-xs font-medium">Sedang memproses gambar kartu...</span>
                </div>
              )}
              <p className="text-[11px] text-slate-400 text-center mt-3">
                💡 <em>Tips: Jika unduhan otomatis terblokir oleh peramban, Anda dapat langsung mengklik kanan pada gambar di atas lalu memilih <strong>"Simpan Gambar Sebagai..."</strong> (Save image as...).</em>
              </p>
            </div>

            {/* Tombol Aksi di Bawah Modal Pratinjau */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-800 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadJpeg}
                  disabled={isDownloadingJpeg}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh JPEG</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={isDownloadingPng}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-indigo-400" />
                  <span>Unduh PNG</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyImage}
                  disabled={isCopyingImage}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                  <span>Salin Gambar</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolOnboardingModal;
