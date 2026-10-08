import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, BookMarked, Sparkles } from 'lucide-react';
import { DataSekolahView } from './DataSekolahView';
import { DataGuruView } from './DataGuruView';
import { DataSiswaView } from './DataSiswaView';
import { DataKelasView } from './DataKelasView';
import { DataMapelView } from './DataMapelView';
import { getUserRoleScope } from '../utils/userScope';

type ReferensiTab = 'sekolah' | 'guru' | 'kelas' | 'siswa' | 'mapel';

const TAB_LABELS: Record<ReferensiTab, string> = {
  sekolah: 'Identitas Sekolah',
  guru: 'Data Guru',
  kelas: 'Data Kelas',
  siswa: 'Data Siswa',
  mapel: 'Data Mata Pelajaran',
};

const TAB_ORDER: ReferensiTab[] = ['sekolah', 'guru', 'kelas', 'siswa', 'mapel'];

export const DataReferensiView: React.FC = () => {
  const {
    currentUser,
    setActiveView,
    classes,
    subjects,
    teachers,
  } = useApp();

  const userScope = useMemo(
    () => getUserRoleScope(currentUser, classes, subjects, teachers),
    [currentUser, classes, subjects, teachers]
  );

  const allowedTabs = useMemo<ReferensiTab[]>(() => {
    if (!currentUser) return [];
    return TAB_ORDER;
  }, [currentUser]);

  // If Guru Mapel, prioritize 'mapel' tab by default
  const defaultTab = useMemo<ReferensiTab>(() => {
    try {
      const saved = localStorage.getItem('kawacanaan_last_referensi_tab') as ReferensiTab;
      if (saved && allowedTabs.includes(saved)) {
        return saved;
      }
    } catch (_) {}
    if (userScope.isGuruMapel) return 'mapel';
    return allowedTabs[0] || 'sekolah';
  }, [userScope.isGuruMapel, allowedTabs]);

  const [activeTab, setActiveTabState] = useState<ReferensiTab>(defaultTab);
  const setActiveTab = (tab: ReferensiTab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('kawacanaan_last_referensi_tab', tab);
    } catch (_) {}
  };
  const currentTab = allowedTabs.includes(activeTab) ? activeTab : (allowedTabs[0] || 'sekolah');

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-5 animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setActiveView('dashboard')}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
          id="btn-back-dashboard"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>

        {userScope.isGuruMapel && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold shadow-2xs">
            <Sparkles size={13} className="text-indigo-600" />
            <span>Akses Guru Mapel</span>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
          <BookMarked size={22} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Data Referensi</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Kelola data induk sekolah, guru, mata pelajaran kurikulum SD, siswa, dan kelas dalam satu tempat.
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit border border-slate-200 overflow-x-auto max-w-full">
        {TAB_ORDER.filter((t) => allowedTabs.includes(t)).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            id={`tab-referensi-${tab}`}
            className={`px-5 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{TAB_LABELS[tab]}</span>
            {tab === 'mapel' && userScope.isGuruMapel && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {currentTab === 'sekolah' && <DataSekolahView />}
      {currentTab === 'guru' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <DataGuruView />
        </div>
      )}
      {currentTab === 'kelas' && <DataKelasView />}
      {currentTab === 'siswa' && <DataSiswaView />}
      {currentTab === 'mapel' && <DataMapelView />}
    </div>
  );
};
