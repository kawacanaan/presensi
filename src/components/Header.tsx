import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { SchoolLogo } from './SchoolLogo';
import { KawacanaanEmblem } from './KawacanaanEmblem';
import { UserProfileModal } from './UserProfileModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { 
  LogOut, 
  UserCircle, 
  Settings, 
  Bell, 
  ArrowLeft, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Calendar,
  CheckCircle2,
  X,
  CreditCard,
  Layers,
  PlusCircle,
  Building2,
  UserCheck,
  ChevronDown,
  Heart,
  Key
} from 'lucide-react';
import { getTenantLifecycleInfo } from '../utils/tenantLifecycle';

export const Header: React.FC = () => {
  const { 
    currentUser, 
    setCurrentUser, 
    schoolProfile, 
    systemConfig, 
    setActiveView, 
    showToast, 
    stopImpersonation, 
    globalAnnouncement,
    academicEvents,
    userWorkspaces,
    activeWorkspace,
    openOnboarding,
    logout,
    isSchoolPro,
    isTeacherPro,
    openUpgradeModal,
    leaveRequests,
  } = useApp();

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const roleLabel = useMemo(() => {
    if (!currentUser) return '';
    if (currentUser.role === 'SUPER_ADMIN') return 'Super Admin';
    if (currentUser.role === 'ADMIN') return 'Admin';
    if (currentUser.role === 'KEPALA SEKOLAH') return 'Kepala Sekolah';
    if (currentUser.role === 'WALI KELAS') return 'Wali Kelas';
    if (currentUser.role === 'GURU MAPEL') return 'Guru Mapel';
    if (currentUser.role === 'SISWA') return 'Siswa';
    return currentUser.role;
  }, [currentUser]);

  const isPersonalWorkspace =
    activeWorkspace?.workspaceType === 'personal' ||
    activeWorkspace?.workspaceType === 'individu' ||
    (currentUser?.subscriptionPlan === 'mulai' && !currentUser?.schoolId);

  const isCurrentlyPersonal = isPersonalWorkspace;

  const notifStorageKey = useMemo(() => {
    const userId = currentUser?.id || currentUser?.username || 'guest';
    return `kawacanaan_read_notifs_${userId}`;
  }, [currentUser?.id, currentUser?.username]);

  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const key = `kawacanaan_read_notifs_${currentUser?.id || currentUser?.username || 'guest'}`;
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  // Sync with localStorage on user change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(notifStorageKey);
      if (saved) {
        setReadNotifIds(JSON.parse(saved));
      } else {
        setReadNotifIds([]);
      }
    } catch (_) {}
  }, [notifStorageKey]);

  const tenantLifecycle = currentUser?.role !== 'SUPER_ADMIN' ? getTenantLifecycleInfo({
    status: currentUser?.subscriptionStatus,
    subscription_expires_at: currentUser?.subscriptionExpiresAt,
  }) : null;

  interface HeaderNotificationItem {
    id: string;
    title: string;
    message: string;
    type: 'alert' | 'warning' | 'info' | 'event' | 'success';
    time: string;
  }

  const notificationItems = useMemo<HeaderNotificationItem[]>(() => {
    const list: HeaderNotificationItem[] = [];

    const isTeacherOrAdmin = currentUser?.role === 'WALI KELAS' || currentUser?.role === 'ADMIN' || currentUser?.role === 'KEPALA SEKOLAH';
    if (isTeacherOrAdmin && Array.isArray(leaveRequests)) {
      const pendingLeaves = leaveRequests.filter((r) => r.status === 'PENDING');
      if (pendingLeaves.length > 0) {
        const first = pendingLeaves[0];
        list.push({
          id: `notif_leave_pending_${first.id}_${pendingLeaves.length}`,
          title: 'Surat Izin / Sakit Menunggu Verifikasi',
          message: `${pendingLeaves.length} surat izin/sakit (${first.studentName}${pendingLeaves.length > 1 ? ` dkk` : ''}) menunggu verifikasi Anda di menu Absensi Siswa.`,
          type: 'warning',
          time: 'Baru',
        });
      }
    }

    if (globalAnnouncement?.active && globalAnnouncement.message) {
      // Dynamic ID based on content & update time to trigger red dot upon new announcements
      const msgHash = encodeURIComponent(globalAnnouncement.message.trim().slice(0, 40));
      const updateStamp = globalAnnouncement.updatedAt || '';
      list.push({
        id: `notif_global_${globalAnnouncement.id || 'broadcast'}_${globalAnnouncement.type}_${msgHash}_${updateStamp}`,
        title: 'Pengumuman Global Super Admin',
        message: globalAnnouncement.message,
        type: globalAnnouncement.type === 'alert' ? 'alert' : globalAnnouncement.type === 'warning' ? 'warning' : 'info',
        time: 'Terkini',
      });
    }

    if (tenantLifecycle && (tenantLifecycle.isGracePeriod || (tenantLifecycle.isExpiringSoon && (tenantLifecycle.daysRemaining ?? 99) <= 7))) {
      list.push({
        id: `notif_tenant_${tenantLifecycle.isGracePeriod ? 'grace' : 'expiring'}_${tenantLifecycle.daysRemaining}`,
        title: tenantLifecycle.isGracePeriod ? 'Masa Tenggang Langganan' : 'Pengingat Masa Aktif',
        message: tenantLifecycle.isGracePeriod
          ? `Masa tenggang sekolah tersisa ${tenantLifecycle.graceDaysRemaining} hari lagi. Segera hubungi administrator.`
          : `Masa aktif langganan sekolah tersisa ${tenantLifecycle.daysRemaining} hari.`,
        type: tenantLifecycle.isGracePeriod ? 'alert' : 'warning',
        time: 'Akun',
      });
    }

    if (academicEvents && academicEvents.length > 0) {
      const topEvent = academicEvents[0];
      list.push({
        id: `notif_event_${topEvent.id || topEvent.title}_${topEvent.date}`,
        title: 'Agenda Terdekat',
        message: `${topEvent.title} (${topEvent.date})`,
        type: 'event',
        time: topEvent.date || 'Kalender',
      });
    }

    list.push({
      id: `notif_presensi_${schoolProfile.semester}_${schoolProfile.tahunPelajaran}`,
      title: 'Presensi Digital Aktif',
      message: `Sistem presensi terhubung untuk Semester ${schoolProfile.semester} TP ${schoolProfile.tahunPelajaran}.`,
      type: 'info',
      time: 'Semester Ini',
    });

    list.push({
      id: `notif_realtime_sync_v1`,
      title: 'Sinkronisasi Real-Time',
      message: 'Rekapitulasi presensi otomatis disinkronkan ke cloud database.',
      type: 'success',
      time: 'Sistem',
    });

    return list;
  }, [globalAnnouncement, tenantLifecycle, academicEvents, schoolProfile.semester, schoolProfile.tahunPelajaran, leaveRequests, currentUser?.role]);

  const unreadNotifications = useMemo(() => {
    return notificationItems.filter((item) => !readNotifIds.includes(item.id)).length;
  }, [notificationItems, readNotifIds]);

  const saveReadNotifs = (ids: string[]) => {
    setReadNotifIds(ids);
    try {
      localStorage.setItem(notifStorageKey, JSON.stringify(ids));
    } catch (_) {}
  };

  const markAllAsRead = () => {
    const allIds = Array.from(new Set([...readNotifIds, ...notificationItems.map((n) => n.id)]));
    saveReadNotifs(allIds);
  };

  const markSingleAsRead = (id: string) => {
    if (readNotifIds.includes(id)) return;
    const updated = [...readNotifIds, id];
    saveReadNotifs(updated);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    setShowProfileDropdown(false);
    try {
      await logout();
      showToast('Anda telah berhasil keluar (Logout)', 'info');
    } catch (err) {
      console.warn('Logout error:', err);
    }
  };

  // Helper to extract initials (e.g. Maulana Yusuf -> MY)
  const getInitials = (name?: string, username?: string): string => {
    const target = (name || username || 'MY').trim();
    const words = target.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return target.slice(0, 2).toUpperCase();
  };

  // Helper to format date in Indonesian (e.g. Sabtu, 22 Agustus 2026)
  const getFormattedDate = (): string => {
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dayName = days[now.getDay()];
    const dayDate = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    return `${dayName}, ${dayDate} ${monthName} ${year}`;
  };

  const userInitials = getInitials(currentUser?.name, currentUser?.username);
  const userDisplayName = currentUser ? (currentUser.name || currentUser.username).toUpperCase() : '';
  const userDisplayEmail = currentUser?.email || (currentUser?.username ? (currentUser.username.includes('@') ? currentUser.username : `${currentUser.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`) : 'user@sekolah.sch.id');

  return (
    <>
      {/* Impersonation Banner */}
      {currentUser?.impersonatedFrom && (
        <div className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white px-4 py-2 text-xs font-semibold shadow-md flex items-center justify-between z-40 sticky top-0">
          <div className="flex items-center gap-2 max-w-2xl truncate">
            <span className="px-2 py-0.5 rounded bg-white/20 text-[10px] font-black uppercase tracking-wider">
              Mode Simulasi Support
            </span>
            <span className="truncate">
              Anda sedang login sebagai <strong>{currentUser.name}</strong> ({schoolProfile.namaSekolah || 'Sekolah Terpilih'}).
            </span>
          </div>
          <button
            onClick={stopImpersonation}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-amber-900 rounded-lg font-bold text-xs hover:bg-amber-50 transition shadow-xs active:scale-95 shrink-0 cursor-pointer"
          >
            <ArrowLeft size={13} />
            Kembali ke Super Admin
          </button>
        </div>
      )}

      {/* Subscription Grace Period / Critical Expiring Banner */}
      {tenantLifecycle && (tenantLifecycle.isGracePeriod || (tenantLifecycle.isExpiringSoon && (tenantLifecycle.daysRemaining ?? 99) <= 7)) && (
        <div
          className={`w-full px-4 py-2 text-xs font-semibold flex items-center justify-between gap-3 border-b sticky top-0 z-40 ${
            tenantLifecycle.isGracePeriod
              ? 'bg-orange-600 text-white border-orange-700'
              : 'bg-amber-500 text-white border-amber-600'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <AlertTriangle size={14} className="shrink-0 text-white animate-pulse" />
            <span className="truncate">
              {tenantLifecycle.isGracePeriod
                ? `Pemberitahuan Masa Tenggang: Langganan sekolah telah lewat batas (${tenantLifecycle.graceDaysRemaining} hari masa tenggang tersisa). Segera hubungi Admin untuk perpanjangan.`
                : `Pemberitahuan Langganan: Masa aktif paket sekolah tersisa ${tenantLifecycle.daysRemaining} hari lagi (${currentUser?.subscriptionExpiresAt}).`}
            </span>
          </div>
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/20 shrink-0">
            {tenantLifecycle.label}
          </span>
        </div>
      )}

      {/* Global Platform Announcement / Broadcast */}
      {globalAnnouncement?.active && globalAnnouncement.message && (
        <div
          className={`w-full px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 border-b ${
            globalAnnouncement.type === 'alert'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : globalAnnouncement.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          {globalAnnouncement.type === 'alert' ? (
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
          ) : globalAnnouncement.type === 'warning' ? (
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
          ) : (
            <Info size={14} className="text-indigo-600 shrink-0" />
          )}
          <span className="truncate max-w-4xl">{globalAnnouncement.message}</span>
        </div>
      )}

      <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 lg:px-8 py-2.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl 2xl:max-w-[1500px] mx-auto flex items-center justify-between gap-3">
          
          {/* Left: Brand / School Info */}
          <div
            onClick={() => {
              if (currentUser?.role === 'SUPER_ADMIN') {
                setActiveView('superadmin');
              } else if (currentUser?.role === 'SISWA') {
                setActiveView('portal-siswa');
              } else {
                setActiveView('dashboard');
              }
            }}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none min-w-0"
            id="header-school-brand"
          >
            <div className="flex-shrink-0">
              {currentUser?.role === 'SUPER_ADMIN' ? (
                <KawacanaanEmblem size={36} className="sm:w-[40px] sm:h-[40px]" />
              ) : (
                <SchoolLogo size={36} className="sm:w-[40px] sm:h-[40px]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-[#1E40AF] text-sm sm:text-base lg:text-lg leading-tight tracking-tight group-hover:text-blue-800 transition-colors truncate">
                  {currentUser?.role === 'SUPER_ADMIN' ? 'Platform Super Admin' : (schoolProfile.namaSekolah || 'Sistem Informasi Sekolah')}
                </h1>
              </div>
              <p className="text-[9px] sm:text-[10px] font-bold tracking-[0.15em] sm:tracking-[0.2em] text-slate-500 uppercase truncate">
                {currentUser?.role === 'SUPER_ADMIN' ? 'KONTROL MULTI-TENANT SEKOLAH' : (systemConfig.appTitle ? systemConfig.appTitle.toUpperCase() : 'ABSENSI SISWA')}
              </p>
            </div>
          </div>

          {/* Right: Date, Notifications, and Profile Avatar */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2.5">

                {/* Compact Permanent Workspace Indicator */}
                {currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'SISWA' && (
                  <div
                    title={`Ruang Kerja: ${isCurrentlyPersonal ? 'Ruang Kerja Individu' : 'Ruang Kerja Sekolah'}${schoolProfile.namaSekolah ? ` (${schoolProfile.namaSekolah})` : ''}`}
                    className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border text-xs font-bold select-none bg-slate-50 border-slate-200/90 text-slate-700 shadow-2xs"
                    id="header-workspace-indicator"
                  >
                    <Building2 size={13} className={isCurrentlyPersonal ? "text-emerald-600 shrink-0" : "text-indigo-600 shrink-0"} />
                    <span>
                      {isCurrentlyPersonal ? 'Ruang Kerja Individu' : 'Ruang Kerja Sekolah'}
                    </span>
                  </div>
                )}
                
                {/* Date Pill (Desktop & Tablet) */}
                <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200/90 bg-slate-50/90 text-slate-700 text-xs font-semibold select-none shadow-2xs">
                  <Calendar size={13} className="text-slate-500" />
                  <span>{getFormattedDate()}</span>
                  <ChevronDown size={11} className="text-slate-400 ml-0.5" />
                </div>

                {/* Notification Bell */}
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotificationDropdown(!showNotificationDropdown);
                      setShowProfileDropdown(false);
                    }}
                    className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-100/80 transition-colors cursor-pointer active:scale-95"
                    title="Notifikasi & Pengumuman"
                    id="btn-header-notification"
                  >
                    <Bell size={20} className="stroke-[1.8]" />
                    {unreadNotifications > 0 && (
                      <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 bg-[#FF2D78] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs border-2 border-white">
                        {unreadNotifications}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {showNotificationDropdown && (
                    <div className="absolute top-full right-0 mt-2.5 w-84 sm:w-96 bg-white rounded-2xl p-4 shadow-2xl border border-slate-200/80 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Pemberitahuan
                          </span>
                          {unreadNotifications > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200">
                              {unreadNotifications} baru
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Semua Terbaca
                            </span>
                          )}
                        </div>
                        {unreadNotifications > 0 ? (
                          <button
                            type="button"
                            onClick={markAllAsRead}
                            className="text-[11px] text-blue-600 font-bold hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                          >
                            Tandai semua dibaca
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Up to date
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                        {notificationItems.map((item) => {
                          const isUnread = !readNotifIds.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                markSingleAsRead(item.id);
                                if (item.id.startsWith('notif_leave_pending')) {
                                  setActiveView('absensi');
                                  setShowNotificationDropdown(false);
                                }
                              }}
                              className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-1 relative ${
                                isUnread
                                  ? item.type === 'alert'
                                    ? 'bg-rose-50/90 border-rose-200 hover:bg-rose-100/70 text-rose-950'
                                    : item.type === 'warning'
                                    ? 'bg-amber-50/90 border-amber-200 hover:bg-amber-100/70 text-amber-950'
                                    : item.type === 'event'
                                    ? 'bg-indigo-50/80 border-indigo-200 hover:bg-indigo-100/60 text-indigo-950'
                                    : item.type === 'success'
                                    ? 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/60 text-emerald-950'
                                    : 'bg-blue-50/80 border-blue-200 hover:bg-blue-100/60 text-blue-950'
                                  : 'bg-slate-50/70 border-slate-200/60 hover:bg-slate-100/80 text-slate-700 opacity-75'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 font-bold min-w-0">
                                  {item.type === 'alert' ? (
                                    <AlertCircle size={14} className="text-rose-600 shrink-0" />
                                  ) : item.type === 'warning' ? (
                                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                                  ) : item.type === 'event' ? (
                                    <Calendar size={14} className="text-indigo-600 shrink-0" />
                                  ) : item.type === 'success' ? (
                                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                  ) : (
                                    <Info size={14} className="text-blue-600 shrink-0" />
                                  )}
                                  <span className="truncate">{item.title}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] text-slate-400 font-medium">{item.time}</span>
                                  {isUnread && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                                  )}
                                </div>
                              </div>
                              <p className="text-[11px] leading-relaxed text-slate-600">
                                {item.message}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Avatar Circle & Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileDropdown(!showProfileDropdown);
                      setShowNotificationDropdown(false);
                    }}
                    className="flex items-center gap-2 p-0.5 sm:pr-2.5 rounded-full hover:bg-slate-100/80 transition-all cursor-pointer active:scale-95 select-none"
                    title={`Profil: ${currentUser.name || currentUser.username}`}
                    id="btn-header-profile-avatar"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0095FF] hover:bg-[#0080FF] text-white flex items-center justify-center font-black text-xs sm:text-sm tracking-wider shadow-xs">
                      {userInitials}
                    </div>
                    <div className="hidden sm:flex flex-col text-left">
                      <span className="text-xs font-extrabold text-slate-800 leading-tight truncate max-w-[90px]">
                        {userInitials}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold leading-none flex items-center gap-0.5">
                        {roleLabel} <ChevronDown size={10} className="text-slate-400 shrink-0" />
                      </span>
                    </div>
                  </button>

                  {/* Profile Dropdown Popup - Matching user's uploaded mockup */}
                  {showProfileDropdown && (
                    <div 
                      className="absolute top-full right-0 mt-3 w-72 sm:w-80 bg-white rounded-3xl p-6 shadow-2xl border border-slate-100/90 z-50 text-left animate-in fade-in zoom-in-95 duration-150"
                      id="profile-dropdown-card"
                    >
                      {/* Header in Card: User Name (Bold Uppercase) & Email (Italic) */}
                      <div className="space-y-0.5 pb-2">
                        <h4 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight truncate">
                          {userDisplayName}
                        </h4>
                        <p className="text-xs italic text-slate-500 font-medium truncate">
                          {userDisplayEmail}
                        </p>
                      </div>

                      {/* Menu List */}
                      <div className="mt-4 space-y-1">
                        {/* 1. Profil Pengguna */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileDropdown(false);
                            setShowProfileModal(true);
                          }}
                          className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors group cursor-pointer"
                          id="btn-menu-profil-pengguna"
                        >
                          <UserCircle className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors stroke-[1.75]" />
                          <span className="font-semibold">Profil Pengguna</span>
                        </button>

                        {/* 2. Pengaturan Sistem (Di Ruang Kerja Individu & untuk Admin/Kepala Sekolah) */}
                        {(isCurrentlyPersonal || currentUser.role === 'ADMIN' || currentUser.role === 'KEPALA SEKOLAH') && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileDropdown(false);
                              setActiveView('pengaturan');
                            }}
                            className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors group cursor-pointer"
                            id="btn-menu-pengaturan-sistem"
                          >
                            <Settings className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors stroke-[1.75]" />
                            <span className="font-semibold">Pengaturan Sistem</span>
                          </button>
                        )}

                        {/* 3. Ubah Password */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileDropdown(false);
                            setShowPasswordModal(true);
                          }}
                          className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors group cursor-pointer"
                          id="btn-menu-ubah-password"
                        >
                          <Key className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors stroke-[1.75]" />
                          <span className="font-semibold">Ubah Password</span>
                        </button>

                        {/* 3. Dukung Pengembangan (Ruang Kerja Individu - Paket Gratis) */}
                        {isCurrentlyPersonal && !isTeacherPro && !isSchoolPro && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileDropdown(false);
                              openUpgradeModal();
                            }}
                            className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-[#1D68F2] hover:bg-blue-50/80 transition-colors group cursor-pointer"
                            id="btn-menu-dukung-pengembangan"
                          >
                            <div className="w-5 h-5 rounded-full bg-[#1D68F2] text-white flex items-center justify-center shrink-0">
                              <Heart size={11} className="fill-white text-white" />
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-slate-900 group-hover:text-[#1D68F2]">Dukung Pengembangan</span>
                              <span className="text-[10px] text-slate-500 font-normal">Bantu kami terus berkembang</span>
                            </div>
                          </button>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="border-t border-slate-100 my-2.5" />

                      {/* 3. Keluar (Logout) */}
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileDropdown(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-700 hover:text-rose-600 hover:bg-rose-50/70 transition-colors group cursor-pointer"
                          id="btn-menu-keluar"
                        >
                          <LogOut className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors stroke-[1.75]" />
                          <span className="font-semibold">Keluar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <button
                onClick={() => setActiveView('login')}
                className="text-xs font-bold px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl transition-all shadow-xs cursor-pointer"
                id="btn-header-login"
              >
                Masuk / Login
              </button>
            )}
          </div>

        </div>
      </header>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onOpenChangePassword={() => setShowPasswordModal(true)}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  );
};
