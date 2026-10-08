import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Sparkles,
  Radio,
  Megaphone,
  Shield,
  Database,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Info
} from 'lucide-react';
import { SystemPlatformTab } from './SystemPlatformTab';
import { SystemKokaAITab } from './SystemKokaAITab';
import { SystemEvolutionAPITab } from './SystemEvolutionAPITab';
import { SystemAnnouncementTab } from './SystemAnnouncementTab';
import { SystemSecurityTab } from './SystemSecurityTab';
import { SystemDatabaseTab } from './SystemDatabaseTab';

export interface SystemSectionProps {
  call: (action: string, payload?: any) => Promise<any>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

export const SystemSection: React.FC<SystemSectionProps> = ({
  call,
  showToast,
  activeSubTab = 'platform',
  onSubTabChange,
}) => {
  const [currentTab, setCurrentTab] = useState<string>(activeSubTab);
  const [loading, setLoading] = useState(true);
  const [settingsData, setSettingsData] = useState<{
    platform?: any;
    koka?: any;
    evolution_api?: any;
    announcement?: any;
    platform_stats?: any;
  }>({});

  // Sinkronisasi dengan activeSubTab dari SuperAdmin sidebar
  useEffect(() => {
    if (activeSubTab) {
      // Normalisasi id jika datang dari menu lama (misal 'konfigurasi' -> 'platform', 'gateway' -> 'evolution-api', 'backup' -> 'database')
      let mapped = activeSubTab;
      if (activeSubTab === 'konfigurasi') mapped = 'platform';
      if (activeSubTab === 'gateway') mapped = 'evolution-api';
      if (activeSubTab === 'backup') mapped = 'database';
      setCurrentTab(mapped);
    }
  }, [activeSubTab]);

  const setTab = (tab: string) => {
    setCurrentTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await call('get_system_settings');
      if (res.ok) {
        const s = res.settings || {};
        setSettingsData({
          platform: res.platform || s.platform_config,
          koka: res.koka || s.koka_config,
          evolution_api: res.evolution_api || s.evolution_api_config,
          announcement: res.announcement || s.announcement,
          platform_stats: res.platform_stats || s.platform_stats,
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat pengaturan sistem dari server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const tabs = [
    {
      id: 'platform',
      label: 'Konfigurasi Platform',
      sublabel: 'Tenant & Jam Presensi',
      icon: SlidersHorizontal,
      color: 'indigo',
    },
    {
      id: 'koka-ai',
      label: 'Mesin AI Presiden Konoha',
      sublabel: 'Cloudflare AI & Kuota',
      icon: Sparkles,
      color: 'violet',
    },
    {
      id: 'evolution-api',
      label: 'Gateway WhatsApp',
      sublabel: 'Evolution API Notifikasi',
      icon: Radio,
      color: 'emerald',
    },
    {
      id: 'siaran',
      label: 'Siaran Global',
      sublabel: 'Banner & Pengumuman',
      icon: Megaphone,
      color: 'amber',
    },
    {
      id: 'keamanan',
      label: 'Keamanan & Audit',
      sublabel: 'Forensik & Log Akses',
      icon: Shield,
      color: 'slate',
    },
    {
      id: 'database',
      label: 'Basis Data & Pemeliharaan',
      sublabel: 'PostgreSQL & Backup',
      icon: Database,
      color: 'cyan',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation Header (Full-View Tabs) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={`flex flex-col items-start p-3 rounded-xl text-left transition-all cursor-pointer relative overflow-hidden ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50/70 hover:bg-slate-100/90 text-slate-700 hover:text-slate-900 border border-slate-200/50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-700 border border-slate-200/70'
                    }`}
                  >
                    <Icon size={15} />
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  )}
                </div>
                <p className="text-xs font-bold leading-tight line-clamp-1">{tab.label}</p>
                <p
                  className={`text-[10px] mt-0.5 leading-tight line-clamp-1 ${
                    isActive ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {tab.sublabel}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Konten Halaman Penuh Sesuai Tab Aktif */}
      <div className="transition-opacity duration-200">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200/80 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw size={24} className="animate-spin text-indigo-600" />
            <p className="text-xs font-medium">Memuat konfigurasi sistem terpadu...</p>
          </div>
        ) : (
          <>
            {currentTab === 'platform' && (
              <SystemPlatformTab
                call={call}
                showToast={showToast}
                initialConfig={settingsData.platform}
                platformStats={settingsData.platform_stats}
                onSaved={(updated) =>
                  setSettingsData((prev) => ({ ...prev, platform: updated }))
                }
              />
            )}

            {currentTab === 'koka-ai' && (
              <SystemKokaAITab
                call={call}
                showToast={showToast}
                initialConfig={settingsData.koka}
                onSaved={(updated) =>
                  setSettingsData((prev) => ({ ...prev, koka: updated }))
                }
              />
            )}

            {currentTab === 'evolution-api' && (
              <SystemEvolutionAPITab
                call={call}
                showToast={showToast}
                initialConfig={settingsData.evolution_api}
                onSaved={(updated) =>
                  setSettingsData((prev) => ({ ...prev, evolution_api: updated }))
                }
              />
            )}

            {currentTab === 'siaran' && (
              <SystemAnnouncementTab
                call={call}
                showToast={showToast}
                initialAnnouncement={settingsData.announcement}
                onSaved={(updated) =>
                  setSettingsData((prev) => ({ ...prev, announcement: updated }))
                }
              />
            )}

            {currentTab === 'keamanan' && (
              <SystemSecurityTab call={call} showToast={showToast} />
            )}

            {currentTab === 'database' && (
              <SystemDatabaseTab call={call} showToast={showToast} />
            )}
          </>
        )}
      </div>
    </div>
  );
};
