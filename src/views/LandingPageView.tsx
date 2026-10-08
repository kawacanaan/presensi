import React, { useState } from 'react';
import '../landing/landing.css';
import { Navbar } from '../landing/components/Navbar';
import { HeroSection } from '../landing/components/HeroSection';
import { FeaturesSection } from '../landing/components/FeaturesSection';
import { AdvantagesSection } from '../landing/components/AdvantagesSection';
import { PricingSection } from '../landing/components/PricingSection';
import { TestimonialSection } from '../landing/components/TestimonialSection';
import { BlogSection } from '../landing/components/BlogSection';
import { FaqSection } from '../landing/components/FaqSection';
import { ContactSection } from '../landing/components/ContactSection';
import { Footer } from '../landing/components/Footer';
import { RegisterModal } from '../landing/components/RegisterModal';
import { FreeStartModal } from '../landing/components/FreeStartModal';
import { TeacherRegisterModal } from '../landing/components/TeacherRegisterModal';
import { TermsAndLegalModal, LegalTabType } from '../landing/components/TermsAndLegalModal';
import { LandingKokaWidget } from '../landing/components/LandingKokaWidget';

interface LandingPageViewProps {
  onEnterSystem: () => void;
  onEnterDashboard?: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onEnterSystem, onEnterDashboard }) => {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isFreeStartOpen, setIsFreeStartOpen] = useState(false);
  const [isTeacherRegisterOpen, setIsTeacherRegisterOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<'free' | 'teacher' | 'school'>('school');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [allowSchoolCycleChange, setAllowSchoolCycleChange] = useState<boolean>(true);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTabType>('terms');
  const [lang, setLang] = useState<'ID' | 'EN'>('ID');

  const handleOpenRegister = (
    planId: 'free' | 'teacher' | 'school' = 'free',
    cycle: 'monthly' | 'yearly' = 'monthly',
    allowCycleSelection: boolean = false
  ) => {
    setSelectedBillingCycle(cycle);
    setAllowSchoolCycleChange(allowCycleSelection);

    if (planId === 'free') {
      setIsFreeStartOpen(true);
      return;
    }

    if (planId === 'teacher') {
      setIsTeacherRegisterOpen(true);
      return;
    }

    setSelectedPlanId(planId);
    setIsRegisterOpen(true);
  };

  // Membuka login sistem presensi sekolah dasar
  const handleOpenLogin = (prefill?: { username: string; password?: string }) => {
    if (prefill?.username) {
      try {
        sessionStorage.setItem('kwc_prefill_username', prefill.username);
        if (prefill.password) {
          sessionStorage.setItem('kwc_prefill_password', prefill.password);
        }
      } catch (_) {}
    }
    onEnterSystem();
  };

  const handleOpenLegal = (tab: LegalTabType) => {
    setLegalTab(tab);
    setIsLegalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-600 selection:text-white antialiased">
      <Navbar
        onOpenLogin={handleOpenLogin}
        onOpenRegister={() => handleOpenRegister('free')}
        onOpenRegisterSchool={() => handleOpenRegister('school', 'monthly', true)}
        lang={lang}
        setLang={setLang}
      />

      <main className="relative">
        <HeroSection
          onOpenRegister={() => handleOpenRegister('free')}
          onOpenRegisterSchool={() => handleOpenRegister('school', 'monthly', true)}
          onOpenLogin={handleOpenLogin}
          lang={lang}
        />
        <FeaturesSection 
          lang={lang} 
          onOpenRegister={() => handleOpenRegister('school', 'monthly', true)} 
        />
        <AdvantagesSection lang={lang} onOpenRegister={() => handleOpenRegister('school', 'monthly', true)} />
        <PricingSection onOpenRegister={handleOpenRegister} lang={lang} />
        <TestimonialSection lang={lang} />
        <BlogSection lang={lang} />
        <FaqSection lang={lang} onOpenRegister={() => handleOpenRegister('free')} />
        <ContactSection lang={lang} onOpenRegister={() => handleOpenRegister('school', 'monthly', true)} />
      </main>

      <Footer lang={lang} onOpenLegal={handleOpenLegal} />

      {/* Modal Mulai Gratis: Pemilihan Peran (tanpa Siswa), Tanpa Pilihan Ruang Kerja, Otomatis Ruang Kerja Personal */}
      <FreeStartModal
        isOpen={isFreeStartOpen}
        onClose={() => setIsFreeStartOpen(false)}
        onOpenLogin={handleOpenLogin}
        onEnterSystem={onEnterSystem}
        onEnterDashboard={onEnterDashboard}
        lang={lang}
      />

      {/* Modal Paket Guru Berbayar (Midtrans Gateway + Ruang Kerja Individu Pro) */}
      <TeacherRegisterModal
        isOpen={isTeacherRegisterOpen}
        onClose={() => setIsTeacherRegisterOpen(false)}
        onOpenLogin={handleOpenLogin}
        onEnterSystem={onEnterSystem}
        onEnterDashboard={onEnterDashboard}
        initialBillingCycle={selectedBillingCycle}
        lang={lang}
      />

      {/* Modal Pendaftaran Sekolah / Berbayar */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onOpenLogin={handleOpenLogin}
        initialPlanId={selectedPlanId}
        initialBillingCycle={selectedBillingCycle}
        allowCycleChange={allowSchoolCycleChange}
        lang={lang}
      />

      <TermsAndLegalModal
        isOpen={isLegalOpen}
        onClose={() => setIsLegalOpen(false)}
        initialTab={legalTab}
        lang={lang}
      />

      {/* Floating Koka Assistant untuk Pengunjung Landing Page */}
      <LandingKokaWidget
        onOpenLogin={handleOpenLogin}
        onOpenRegister={handleOpenRegister}
        lang={lang}
      />
    </div>
  );
};

