import React, { useEffect, useState } from 'react';
import { Check, Users, GraduationCap, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface PublicStatistics {
  jumlah_sekolah: number;
  jumlah_guru: number;
  jumlah_siswa: number;
  jumlah_pengguna: number;
}

interface PublicStatsBannerProps {
  lang?: 'ID' | 'EN';
}

export const PublicStatsBanner: React.FC<PublicStatsBannerProps> = ({ lang = 'ID' }) => {
  const [stats, setStats] = useState<PublicStatistics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchPublicStats = async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_statistics');
        
        if (error) {
          console.warn('Gagal memuat statistik publik:', error.message);
          if (isMounted) {
            setStats({
              jumlah_sekolah: 0,
              jumlah_guru: 0,
              jumlah_siswa: 0,
              jumlah_pengguna: 0,
            });
          }
          return;
        }

        // Response RPC get_public_statistics dapat berupa array objek atau objek tunggal
        const raw = Array.isArray(data) ? data[0] : data;
        if (isMounted && raw) {
          setStats({
            jumlah_sekolah: Number(raw.jumlah_sekolah ?? 0),
            jumlah_guru: Number(raw.jumlah_guru ?? 0),
            jumlah_siswa: Number(raw.jumlah_siswa ?? 0),
            jumlah_pengguna: Number(raw.jumlah_pengguna ?? 0),
          });
        }
      } catch (err: any) {
        console.warn('Terjadi kesalahan saat memanggil statistik publik:', err?.message || err);
        if (isMounted) {
          setStats({
            jumlah_sekolah: 0,
            jumlah_guru: 0,
            jumlah_siswa: 0,
            jumlah_pengguna: 0,
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchPublicStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(lang === 'ID' ? 'id-ID' : 'en-US').format(num);
  };

  const statItems = [
    {
      id: 'stat-sekolah',
      icon: <Check className="w-6 h-6 sm:w-7 sm:h-7 text-white stroke-[2.5]" />,
      value: stats?.jumlah_sekolah ?? 0,
      label: lang === 'ID' ? 'Sekolah Terdaftar' : 'Registered Schools',
    },
    {
      id: 'stat-guru',
      icon: <Users className="w-6 h-6 sm:w-7 sm:h-7 text-white stroke-[2.2]" />,
      value: stats?.jumlah_guru ?? 0,
      label: lang === 'ID' ? 'Guru' : 'Teachers',
    },
    {
      id: 'stat-siswa',
      icon: <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 text-white stroke-[2.2]" />,
      value: stats?.jumlah_siswa ?? 0,
      label: lang === 'ID' ? 'Siswa' : 'Students',
    },
    {
      id: 'stat-pengguna',
      icon: <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-white stroke-[2.2]" />,
      value: stats?.jumlah_pengguna ?? 0,
      label: lang === 'ID' ? 'Pengguna' : 'Users',
    },
  ];

  return (
    <div 
      id="spanduk-statistik-beranda"
      className="w-full bg-[#0066FF] rounded-2xl sm:rounded-3xl shadow-xl shadow-blue-500/20 p-5 sm:p-6 lg:p-7 text-white border border-blue-400/20"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-0 lg:divide-x lg:divide-white/20">
        {statItems.map((item, idx) => (
          <div 
            key={item.id}
            id={item.id}
            className={`flex items-center gap-3.5 sm:gap-4 lg:px-6 ${
              idx === 0 ? 'lg:pl-2' : ''
            } ${idx === statItems.length - 1 ? 'lg:pr-2' : ''}`}
          >
            {/* Circular Icon Container */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
              {item.icon}
            </div>

            {/* Value & Label */}
            <div className="flex flex-col min-w-0">
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
                {isLoading ? (
                  <span className="inline-block w-14 sm:w-16 h-7 sm:h-8 bg-white/25 rounded-md animate-pulse align-middle" />
                ) : (
                  <span>{formatNumber(item.value)}</span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-semibold text-white/95 mt-1 sm:mt-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                {item.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
