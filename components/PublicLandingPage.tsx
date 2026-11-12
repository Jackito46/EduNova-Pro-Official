import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Zap,
  Smartphone,
  Wallet,
  GraduationCap,
  Users,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Lock,
  Phone,
  Mail,
  MapPin,
  Building2,
  Send,
  Menu,
  X,
  Star,
  ChevronRight,
  MessageCircle,
  School,
  BarChart3,
  FileText,
  ArrowUp,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Calculator,
  Clock,
  Sparkles
} from 'lucide-react';
import Logo from './Logo';
import { toast } from 'sonner';

interface PublicLandingPageProps {
  onOpenLogin: () => void;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ onOpenLogin }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<'finance' | 'academic' | 'payroll'>('finance');
  const [previewTab, setPreviewTab] = useState<'receipt' | 'report' | 'offline'>('receipt');

  // Simulateur d'Économies
  const [studentCount, setStudentCount] = useState<number>(350);
  const [avgTuition, setAvgTuition] = useState<number>(25000); // HTG
  const [unpaidRate, setUnpaidRate] = useState<number>(20); // 20%

  // Formulaire Démo Optimisé
  const [contactName, setContactName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Port-au-Prince');
  const [schoolType, setSchoolType] = useState('Fondamentale & Secondaire');
  const [studentBracket, setStudentBracket] = useState('250-500');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  // Détection du scroll pour adapter le style et le bouton retour en haut
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculs d'économies mesurés et respectueux
  const totalBudget = studentCount * avgTuition;
  const currentUnpaidAmount = Math.round(totalBudget * (unpaidRate / 100));
  const estimatedRecoveredAmount = Math.round(currentUnpaidAmount * 0.45);
  const hoursSavedPerMonth = Math.round(studentCount * 0.25);

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName || !contactName || !phone) {
      toast.error('Veuillez renseigner le nom de l’école, votre nom et votre numéro WhatsApp / Téléphone.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setDemoSubmitted(true);
      toast.success('Demande enregistrée avec succès ! Notre équipe vous contactera sous 24h.');
    }, 500);
  };

  // Navigation fluide avec synchronisation immédiate des onglets
  const handleNavigate = (targetId: string, tab?: 'finance' | 'academic' | 'payroll') => {
    setMobileMenuOpen(false);
    if (tab) {
      setActiveTab(tab);
    }

    setTimeout(() => {
      const element = document.getElementById(targetId);
      if (element) {
        const headerOffset = 90;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }, 40);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-indigo-600 selection:text-white flex flex-col justify-between relative">
      
      {/* =========================================================================
          1. HEADER FIXE INTERNATIONAL AVEC BANDEAU SUPÉRIEUR D'INFORMATIONS
             (ADRESSE, TÉLÉPHONES WHATSAPP, EMAIL & SLOGAN EN OR AMBRÉ)
          ========================================================================= */}
      <header className={`fixed top-0 inset-x-0 z-50 bg-[#0B132B]/95 backdrop-blur-md text-slate-100 border-b border-slate-800/90 transition-all duration-300 ${scrolled ? 'shadow-xl shadow-black/25' : 'shadow-md'}`}>
        
        {/* BANDEAU SUPÉRIEUR D'INFORMATIONS OFFICIELLES (HAUT DE GAMME & TOTALEMENT RESPONSIVE) */}
        <div className="bg-[#060B18] text-slate-300 border-b border-slate-800/80 py-1.5 px-3 sm:px-6 lg:px-8 text-[11px]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            
            {/* Informations de contact avec icônes dorées ambrées */}
            <div className="flex items-center gap-3 sm:gap-5 flex-wrap overflow-hidden">
              {/* Adresse officielle */}
              <div className="flex items-center gap-1.5 text-slate-300">
                <MapPin size={12} className="text-amber-400 shrink-0" />
                <span className="font-medium truncate sm:whitespace-normal">
                  5, Christ-Roi, rue Acacia, prolongée, Port-au-Prince, Haïti
                </span>
              </div>

              {/* Téléphones / WhatsApp */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Phone size={12} className="text-amber-400 shrink-0" />
                <a 
                  href="https://wa.me/50936045639" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-bold text-white hover:text-amber-300 transition-colors font-mono"
                  title="WhatsApp direct"
                >
                  +509 3604-5639
                </a>
                <span className="text-slate-500">/</span>
                <a 
                  href="tel:+50933508416" 
                  className="font-bold text-white hover:text-amber-300 transition-colors font-mono"
                  title="Appel secrétariat"
                >
                  3350-8416
                </a>
              </div>

              {/* Email */}
              <div className="hidden xl:flex items-center gap-1.5 text-slate-300 shrink-0">
                <Mail size={12} className="text-amber-400 shrink-0" />
                <a href="mailto:contact@edunova-pro.tech" className="hover:text-amber-300 transition-colors">
                  contact@edunova-pro.tech
                </a>
              </div>
            </div>

            {/* Slogan officiel en italique doré ambré */}
            <div className="text-amber-300 font-semibold italic hidden lg:block select-none text-[11px] tracking-wide shrink-0">
              « L'Excellence Académique à votre Portée »
            </div>

          </div>
        </div>

        {/* BARRE PRINCIPALE DE NAVIGATION */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3 lg:gap-4">
          
          {/* ZONE 1 : Logo & Marque avec Slogan Élégant */}
          <div 
            className="flex items-center gap-3 cursor-pointer select-none group shrink-0" 
            onClick={scrollToTop}
          >
            <Logo size="sm" className="w-8 h-8 sm:w-9 sm:h-9 transition-transform group-hover:scale-105 shrink-0" />
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight text-white leading-none">
                  EduNova<span className="text-amber-400">Pro</span>
                </span>
                <span className="hidden md:inline-block text-[9.5px] font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60 uppercase tracking-wider">
                  Haïti
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-medium text-amber-300 italic tracking-wide select-none leading-tight mt-0.5 whitespace-nowrap">
                « L'Excellence Académique à votre Portée »
              </span>
            </div>
          </div>

          {/* ZONE 2 : Navigation Épurée aux Termes Explicites */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-xs font-semibold text-slate-300">
            <button 
              onClick={() => handleNavigate('specialites')} 
              className="px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-slate-800/80 transition-colors whitespace-nowrap cursor-pointer"
            >
              Nos Spécialités
            </button>
            
            <button 
              onClick={() => handleNavigate('modules', 'finance')} 
              className="px-2.5 py-1.5 rounded-lg hover:text-emerald-400 hover:bg-slate-800/80 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
            >
              <span>Économat & Caisses</span>
              <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                MonCash
              </span>
            </button>

            <button 
              onClick={() => handleNavigate('modules', 'academic')} 
              className="px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-slate-800/80 transition-colors whitespace-nowrap cursor-pointer"
            >
              Bulletins Scolaires
            </button>

            <button 
              onClick={() => handleNavigate('modules', 'payroll')} 
              className="px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-slate-800/80 transition-colors whitespace-nowrap cursor-pointer"
            >
              Salaires & RH
            </button>

            <button 
              onClick={() => handleNavigate('roi')} 
              className="px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-slate-800/80 transition-colors whitespace-nowrap cursor-pointer"
            >
              Simulateur d'Économies
            </button>

            <button 
              onClick={() => handleNavigate('testimonials')} 
              className="px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-slate-800/80 transition-colors whitespace-nowrap cursor-pointer"
            >
              Témoignages
            </button>
          </nav>

          {/* ZONE 3 : Action Connexion Épurée */}
          <div className="hidden sm:flex items-center shrink-0">
            <button
              onClick={onOpenLogin}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-100 hover:text-white bg-slate-800/90 hover:bg-slate-700/90 active:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-700 hover:border-amber-400/50 shadow-xs"
            >
              <Lock size={13} className="text-amber-400" />
              <span>Connexion</span>
            </button>
          </div>

          {/* Boutons Mobile Dédiés (< 640px) */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={onOpenLogin}
              className="px-2.5 py-1 text-xs font-bold text-slate-200 bg-slate-800 rounded-md border border-slate-700 cursor-pointer"
            >
              Connexion
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md cursor-pointer transition-colors"
              aria-label="Ouvrir le menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

        </div>

        {/* TIROIR MOBILE AVEC COORDONNÉES EXACTES */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden bg-[#0A0F1D] border-b border-slate-800 px-4 py-3 space-y-2.5 text-xs text-slate-300 shadow-xl"
            >
              {/* En-tête mobile avec logo et slogan élégant */}
              <div className="pb-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Logo size="sm" className="w-6 h-6 shrink-0" />
                  <span className="font-bold text-white text-xs">EduNova<span className="text-amber-400">Pro</span></span>
                </div>
                <span className="text-amber-300 italic text-[10.5px] font-medium truncate max-w-[210px]">
                  « L'Excellence Académique à votre Portée »
                </span>
              </div>

              <div className="pb-2.5 border-b border-slate-800">
                <button
                  onClick={onOpenLogin}
                  className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white rounded-lg font-bold text-center flex items-center justify-center gap-2 border border-slate-700 cursor-pointer shadow-xs transition-colors"
                >
                  <Lock size={14} className="text-amber-400" />
                  <span>Connexion à l'Espace Établissement</span>
                </button>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => handleNavigate('specialites')}
                  className="w-full text-left py-2 px-2 text-slate-200 hover:bg-slate-800/60 rounded-md font-semibold flex items-center justify-between cursor-pointer"
                >
                  <span>Nos Spécialités d'Excellence</span>
                  <ChevronRight size={14} className="text-slate-500" />
                </button>

                <button
                  onClick={() => handleNavigate('modules', 'finance')}
                  className="w-full text-left py-2 px-2 text-slate-200 hover:bg-slate-800/60 rounded-md font-semibold flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Wallet size={14} className="text-emerald-400" />
                    <span>Économat & Caisses (MonCash / NatCash)</span>
                  </span>
                  <ChevronRight size={14} className="text-slate-500" />
                </button>

                <button
                  onClick={() => handleNavigate('modules', 'academic')}
                  className="w-full text-left py-2 px-2 text-slate-200 hover:bg-slate-800/60 rounded-md font-semibold flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-indigo-400" />
                    <span>Bulletins Scolaires & Palmarès</span>
                  </span>
                  <ChevronRight size={14} className="text-slate-500" />
                </button>

                <button
                  onClick={() => handleNavigate('modules', 'payroll')}
                  className="w-full text-left py-2 px-2 text-slate-200 hover:bg-slate-800/60 rounded-md font-semibold flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Users size={14} className="text-amber-400" />
                    <span>Salaires & RH du Personnel</span>
                  </span>
                  <ChevronRight size={14} className="text-slate-500" />
                </button>

                <button
                  onClick={() => handleNavigate('roi')}
                  className="w-full text-left py-2 px-2 text-slate-200 hover:bg-slate-800/60 rounded-md font-semibold flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-emerald-400" />
                    <span>Simulateur d'Économies Annuelles</span>
                  </span>
                  <ChevronRight size={14} className="text-slate-500" />
                </button>

                <button
                  onClick={() => handleNavigate('testimonials')}
                  className="w-full text-left py-2 px-2 text-slate-200 hover:bg-slate-800/60 rounded-md font-semibold flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Star size={14} className="text-amber-400" />
                    <span>Témoignages des Établissements</span>
                  </span>
                  <ChevronRight size={14} className="text-slate-500" />
                </button>
              </div>

              {/* Coordonnées & Assistance Directe */}
              <div className="pt-2.5 border-t border-slate-800 space-y-2 text-[11px]">
                <div className="text-slate-400 flex items-center gap-1.5">
                  <MapPin size={12} className="text-amber-400 shrink-0" />
                  <span>5, Christ-Roi, rue Acacia, prolongée, Haïti</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="https://wa.me/50936045639"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-2.5 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-bold flex items-center justify-center gap-1 text-xs shadow-xs"
                  >
                    <MessageCircle size={13} />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href="tel:+50933508416"
                    className="py-2 px-2.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 font-bold flex items-center justify-center gap-1 text-xs"
                  >
                    <Phone size={13} className="text-amber-400" />
                    <span>3350-8416</span>
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* =========================================================================
          2. CORPS DE PAGE TOTALEMENT REPENSÉ : ULTRA-MODERNE, ERGONOMIQUE & ATTIRANT
             (HERO VISUEL MAGNETIQUE AVEC APERÇU D'INTERFACE EN DIRECT)
          ========================================================================= */}
      <main className="pt-20 sm:pt-24 flex-grow">

        {/* HERO SECTION DE CLASSE INTERNATIONALE */}
        <section className="relative pt-6 pb-12 sm:pt-10 sm:pb-16 overflow-hidden bg-gradient-to-b from-white via-slate-50/70 to-slate-100/50 border-b border-slate-200/80">
          
          {/* Lueur d'ambiance raffinée */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[280px] bg-gradient-to-tr from-indigo-100/40 via-sky-100/30 to-amber-100/20 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
            
            {/* 1. Accroche Principale Équilibrée */}
            <div className="text-center max-w-3xl mx-auto space-y-4">
              
              {/* Grand Titre Spécialiste EduNova Pro */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
                EduNova <span className="text-indigo-600">Pro</span>
                <span className="block text-lg sm:text-2xl lg:text-3xl xl:text-4xl font-extrabold text-amber-500 mt-2.5 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                  Spécialiste de la Gestion Scolaire, Universitaire et Financière
                </span>
              </h1>

              {/* Formulation Fluide et Respectueuse */}
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
                Le logiciel de référence conçu pour les réalités d'Haïti : encaissements directs <strong className="text-slate-900 font-semibold">MonCash & NatCash</strong>, éditions instantanées des bulletins et continuité absolue <strong className="text-emerald-700 font-semibold">Garantie Hors-Ligne</strong> face aux coupures de courant et d'Internet.
              </p>

              {/* Boutons d'Action Ergonomiques et Lumineux */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleNavigate('demo')}
                  className="w-full sm:w-auto px-7 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-bold text-sm transition-all shadow-md hover:shadow-indigo-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Planifier une Démo Gratuite</span>
                  <ArrowRight size={15} />
                </button>

                <a
                  href="https://wa.me/50936045639?text=Bonjour%20EduNova%20Pro%2C%20je%20souhaite%20des%20renseignements%20pour%20notre%20%C3%A9tablissement."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <MessageCircle size={16} />
                  <span>WhatsApp Direct (+509 3604-5639)</span>
                </a>
              </div>

              {/* Triade de Réassurance Compacte & Propre */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Double Monnaie HTG & USD</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Paiements MonCash & NatCash</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Fonctionnement Garanti Hors-Ligne</span>
                </div>
              </div>

            </div>

            {/* 2. VITRINE INTERACTIVE DU SYSTÈME (SUPERBE CARTE SHOWCASE MODERNE) */}
            <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
              
              {/* Barre de Fenêtre Élégante */}
              <div className="px-4 py-2.5 bg-slate-900 text-slate-300 flex items-center justify-between text-xs border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-[11px] text-slate-400">Aperçu Réel du Système · EduNova Pro v2026</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Mode Hors-Ligne Prêt</span>
                  </span>
                </div>
              </div>

              {/* Onglets Interactifs du Showcase */}
              <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto text-xs font-semibold">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewTab('receipt')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      previewTab === 'receipt'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Wallet size={13} className="text-emerald-600" />
                    <span>Reçu MonCash Officiel</span>
                  </button>

                  <button
                    onClick={() => setPreviewTab('report')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      previewTab === 'report'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <GraduationCap size={13} className="text-indigo-600" />
                    <span>Bulletin Trimestriel</span>
                  </button>

                  <button
                    onClick={() => setPreviewTab('offline')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      previewTab === 'offline'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Zap size={13} className="text-amber-600" />
                    <span>Mode Hors-Ligne</span>
                  </button>
                </div>

                <span className="text-[11px] font-medium text-slate-500 hidden sm:inline flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Gestion Bidevise HTG & USD</span>
                </span>
              </div>

              {/* Vue Dynamique selon l'onglet choisi */}
              <div className="p-4 sm:p-6 bg-white">
                {previewTab === 'receipt' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="md:col-span-2 space-y-2">
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        <span>Encaissement Confirmé en 3 secondes</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        Paiements MonCash & NatCash Reçus en Direct
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Les parents règlent depuis leur téléphone. Le solde de l'élève se met à jour immédiatement, et un reçu officiel numéroté est archivé sans risque de manipulation de billets.
                      </p>
                      <div className="flex items-center gap-4 text-xs font-semibold text-slate-700 pt-1">
                        <span>✓ Clôture PDF certifiée</span>
                        <span>✓ Zéro écart de caisse</span>
                        <span>✓ Double devise HTG/USD</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                        <span className="font-bold text-slate-800">Reçu Officiel #4912</span>
                        <span className="font-mono text-emerald-700 font-bold">+25 000 HTG</span>
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-1">
                        <div>Élève : <strong>Woodley A.</strong> (Terminale C)</div>
                        <div>Motif : Scolarité 2ème Tranche</div>
                        <div>Moyen : <strong>MonCash Direct</strong></div>
                      </div>
                      <div className="pt-1 border-t border-slate-200 text-[10px] text-emerald-700 font-mono font-bold flex items-center justify-between">
                        <span>Statut : Encaissé & Signé</span>
                        <span>100% Traçable</span>
                      </div>
                    </div>
                  </div>
                )}

                {previewTab === 'report' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="md:col-span-2 space-y-2">
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        <GraduationCap size={12} className="text-indigo-600" />
                        <span>Calcul Automatisé Conforme</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        Bulletins Périodiques & Palmarès en 1 Clic
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Saisie simple des notes : calcul instantané des coefficients, moyennes trimestrielles, rangs de promotion et génération en PDF haute résolution de toute la classe.
                      </p>
                      <div className="flex items-center gap-4 text-xs font-semibold text-slate-700 pt-1">
                        <span>✓ Maternelle, Fondamentale & Secondaire</span>
                        <span>✓ Gestion Universitaire par crédits</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                        <span className="font-bold text-slate-800">Bulletin 1ère Période</span>
                        <span className="font-mono text-indigo-700 font-bold">8.92 / 10</span>
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-1">
                        <div>Mathématiques (Coef 4) : <strong>88 / 100</strong></div>
                        <div>Français & Lettres (Coef 4) : <strong>90 / 100</strong></div>
                        <div>Rang de promotion : <strong className="text-emerald-700">1er sur 42 élèves</strong></div>
                      </div>
                      <div className="pt-1 border-t border-slate-200 text-[10px] text-indigo-700 font-mono font-bold flex items-center justify-between">
                        <span>Mention : Très Bien</span>
                        <span>PDF Prêt</span>
                      </div>
                    </div>
                  </div>
                )}

                {previewTab === 'offline' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="md:col-span-2 space-y-2">
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <Zap size={12} className="text-amber-600" />
                        <span>Technologie Résiliente Hors-Ligne</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        Continuité Absolue : Zéro Coupure face aux Pannes
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Même en cas de coupure de courant ou d'Internet, votre personnel administratif continue d'enregistrer les notes et d'émettre des reçus. La synchronisation s'exécute automatiquement dès le rétablissement de la connexion.
                      </p>
                      <div className="flex items-center gap-4 text-xs font-semibold text-slate-700 pt-1">
                        <span>✓ Données locales chiffrées</span>
                        <span>✓ Sauvegardes automatisées</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2 text-xs">
                      <div className="flex items-center gap-2 font-bold text-amber-900 border-b border-amber-200 pb-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Mode Hors-Ligne Opérationnel</span>
                      </div>
                      <p className="text-[11px] text-amber-900/80 leading-relaxed">
                        Saisie des notes et tenue de la caisse maintenues à 100% sans connexion active.
                      </p>
                      <div className="pt-1 border-t border-amber-200 text-[10px] text-amber-900 font-mono font-bold flex items-center justify-between">
                        <span>Résilience Totale</span>
                        <span>Sécurisé</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </section>

        {/* 3. LES SPÉCIALITÉS D'EXCELLENCE SANS TERMES ANXIOGÈNES */}
        <section id="specialites" className="scroll-mt-24 py-10 sm:py-14 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            
            <div className="text-center max-w-3xl mx-auto space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/60 inline-block">
                Domaines d'Excellence
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-amber-500 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                Nos Spécialités d'Excellence
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Des solutions technologiques adaptées aux impératifs des écoles et universités en Haïti.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              
              {/* Spécialité 1 : Économat */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/90 hover:border-emerald-500/60 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                    <Wallet size={16} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Économat Bidevise & Encaissements</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Gestion des frais en Gourdes et Dollars au taux fixé par l'établissement. Paiements en direct MonCash et NatCash avec reçus officiels instantanés.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  <span>Reçus numériques certifiés</span>
                </div>
              </div>

              {/* Spécialité 2 : Gestion Académique */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/90 hover:border-indigo-500/60 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                    <GraduationCap size={16} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Bulletins Périodiques & Palmarès</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Édition en 1 clic des bulletins scolaires trimestriels, calcul automatique des coefficients pondérés et gestion universitaire par crédits.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[11px] font-semibold text-indigo-700 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  <span>Calcul automatique des rangs</span>
                </div>
              </div>

              {/* Spécialité 3 : Continuité Hors-Ligne */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/90 hover:border-amber-500/60 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                    <Zap size={16} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Continuité Absolue Hors-Ligne</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Continuité de service : saisie des notes, suivi administratif et encaissements restent actifs même en l'absence de réseau Internet.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  <span>Synchronisation automatique au retour du réseau</span>
                </div>
              </div>

              {/* Spécialité 4 : Paie & RH */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/90 hover:border-sky-500/60 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
                    <Users size={16} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Gestion Salariale & RH</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Calcul transparent des rémunérations mensuelles, suivi des vacataires à l'heure, acomptes consentis et fiches de décharge.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[11px] font-semibold text-sky-700 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  <span>Fiches de paie PDF prêtes à imprimer</span>
                </div>
              </div>

              {/* Spécialité 5 : Tableaux de Bord */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/90 hover:border-violet-500/60 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center">
                    <BarChart3 size={16} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Tableaux de Bord Stratégiques</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Visibilité globale sur la scolarité, suivi des échéanciers et bilans exportables pour le conseil de direction.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[11px] font-semibold text-violet-700 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  <span>Rapports financiers consolidés</span>
                </div>
              </div>

              {/* Carte Audit & Accompagnement */}
              <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-indigo-50/80 to-slate-50 border border-indigo-200/80 hover:border-indigo-400 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black flex items-center justify-center text-xs">
                    PRO
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Accompagnement & Migration</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Reprise soignée de vos fichiers Excel ou registres papier et formation de votre équipe administrative sur site.
                  </p>
                </div>
                <button
                  onClick={() => handleNavigate('demo')}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Demander un Accompagnement</span>
                  <ArrowRight size={13} />
                </button>
              </div>

            </div>

          </div>
        </section>

        {/* 4. MODULES DE GESTION DE L'ÉTABLISSEMENT */}
        <section id="modules" className="scroll-mt-24 py-10 sm:py-14 bg-slate-100/60 border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
            
            <div className="text-center max-w-3xl mx-auto space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/60 inline-block">
                Solutions Métier
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-amber-500 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                Modules de Gestion de l'Établissement
              </h2>
            </div>

            {/* 3 Onglets Épurés & Interactifs */}
            <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1 px-1 custom-scrollbar">
              <button
                onClick={() => setActiveTab('finance')}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'finance'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <Wallet size={14} /> Économat & Caisses
              </button>
              <button
                onClick={() => setActiveTab('academic')}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'academic'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <GraduationCap size={14} /> Bulletins Scolaires
              </button>
              <button
                onClick={() => setActiveTab('payroll')}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'payroll'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <Users size={14} /> Salaires & RH
              </button>
            </div>

            {/* Contenu de l'onglet actif avec vocabulaire apaisé */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
              {activeTab === 'finance' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-center">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                      Économat & Caisses
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                      Gestion Financière Transparente et Sécurisée
                    </h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Chaque versement génère un reçu numérique officiel. Le compte de l'élève est actualisé en temps réel au guichet ou lors des paiements en ligne MonCash / NatCash.
                    </p>
                    <div className="space-y-1.5 text-xs text-slate-700 pt-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>Clôture quotidienne de caisse avec export PDF certifié</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>Portefeuille élève protégé pour une traçabilité irréprochable</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>Conversion automatique HTG/USD selon le taux de l'institution</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-b border-slate-200 pb-1.5">
                      <span>Derniers Règlements Enregistrés</span>
                      <span className="text-emerald-700 font-mono text-[11px]">MonCash / NatCash</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-900">MonCash Direct · Reçu #4812</div>
                        <div className="text-slate-400 text-[10px]">Élève : Woodley A. (Terminale)</div>
                      </div>
                      <div className="font-bold text-emerald-700 font-mono">+15 000 HTG</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-900">NatCash Direct · Reçu #4813</div>
                        <div className="text-slate-400 text-[10px]">Élève : Samantha D. (9ème AF)</div>
                      </div>
                      <div className="font-bold text-emerald-700 font-mono">+8 500 HTG</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'academic' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-center">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 uppercase">
                      Pédagogie & Bulletins
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                      Bulletins Périodiques et Relevés Prêts à Imprimer
                    </h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Saisie unique des notes : calcul instantané des coefficients, moyennes trimestrielles, rangs et palmarès complet de promotion.
                    </p>
                    <div className="space-y-1.5 text-xs text-slate-700 pt-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-indigo-600 shrink-0" />
                        <span>Fondamentale, Secondaire, Universités et Facultés</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-indigo-600 shrink-0" />
                        <span>Impression de toute la classe en 1 clic en PDF haute résolution</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="font-bold text-slate-800 pb-1.5 border-b border-slate-200 flex justify-between">
                      <span>Exemple Bulletin 1ère Période</span>
                      <span className="text-indigo-700 font-mono">Moyenne : 8.75 / 10</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between p-1.5 bg-white rounded border border-slate-200">
                        <span>Mathématiques (Coef 4)</span>
                        <span className="font-mono font-bold">86 / 100</span>
                      </div>
                      <div className="flex justify-between p-1.5 bg-white rounded border border-slate-200">
                        <span>Français & Littérature (Coef 4)</span>
                        <span className="font-mono font-bold">88 / 100</span>
                      </div>
                      <div className="flex justify-between p-1.5 bg-emerald-50 rounded border border-emerald-200 text-emerald-800 font-bold">
                        <span>Rang de Promotion</span>
                        <span>1er sur 38 élèves</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'payroll' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-center">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                      Salaires & RH
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                      Gestion Salariale Claire et Sereine
                    </h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Calcul automatique des salaires mensuels, des heures réelles des vacataires et des retenues d'avances consenties.
                    </p>
                    <div className="space-y-1.5 text-xs text-slate-700 pt-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-amber-600 shrink-0" />
                        <span>Fiches de paie et décharges imprimables en PDF</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-amber-600 shrink-0" />
                        <span>Suivi rigoureux des avances sur salaire et des acomptes</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="font-bold text-slate-800 pb-1 border-b border-slate-200 flex justify-between">
                      <span>Fiche Enseignant</span>
                      <span className="text-amber-700 font-mono text-[11px]">Vacataire 48h</span>
                    </div>
                    <div className="flex justify-between p-1 bg-white rounded border border-slate-200">
                      <span>Rémunération brute</span>
                      <span className="font-mono font-bold">36 000 HTG</span>
                    </div>
                    <div className="flex justify-between p-1 bg-white rounded border border-slate-200 text-rose-600">
                      <span>Avance déduite</span>
                      <span className="font-mono font-bold">-5 000 HTG</span>
                    </div>
                    <div className="flex justify-between p-1 bg-emerald-50 rounded border border-emerald-200 text-emerald-800 font-bold">
                      <span>Net à Payer</span>
                      <span className="font-mono">31 000 HTG</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* 5. SIMULATEUR D'ÉCONOMIES ANNUELLES */}
        <section id="roi" className="scroll-mt-24 py-10 sm:py-14 bg-white border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
            
            <div className="text-center max-w-3xl mx-auto space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 inline-flex items-center gap-1">
                <Calculator size={13} />
                <span>Calculateur Prévisionnel</span>
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-amber-500 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                Simulateur d'Économies Annuelles
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm">
                Estimez le gain financier et le temps administratif récupérés pour votre établissement.
              </p>
            </div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
              
              {/* Sliders Directeurs */}
              <div className="space-y-3.5">
                
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">Effectif de l'Établissement</span>
                    <span className="font-mono font-bold text-indigo-700 text-xs sm:text-sm">{studentCount} élèves</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="2000"
                    step="25"
                    value={studentCount}
                    onChange={(e) => setStudentCount(Number(e.target.value))}
                    className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>50</span>
                    <span>1 000</span>
                    <span>2 000+</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">Scolarité Annuelle Moyenne</span>
                    <span className="font-mono font-bold text-emerald-700 text-xs sm:text-sm">{avgTuition.toLocaleString()} HTG</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="100000"
                    step="2500"
                    value={avgTuition}
                    onChange={(e) => setAvgTuition(Number(e.target.value))}
                    className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>5 000 HTG</span>
                    <span>50 000 HTG</span>
                    <span>100 000 HTG</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">Taux Moyen de Retard de Paiement</span>
                    <span className="font-mono font-bold text-rose-700 text-xs sm:text-sm">{unpaidRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={unpaidRate}
                    onChange={(e) => setUnpaidRate(Number(e.target.value))}
                    className="w-full accent-rose-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>5% (Faible)</span>
                    <span>25% (Moyen)</span>
                    <span>50% (Élevé)</span>
                  </div>
                </div>

              </div>

              {/* Résultats & Bénéfice Rapide */}
              <div className="bg-white p-3.5 sm:p-4 rounded-lg border border-slate-200 flex flex-col justify-between space-y-3">
                
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Impact Financier Projeté</span>
                  
                  <div className="space-y-0.5">
                    <span className="text-xs text-slate-600 font-medium">Volume d'échéances à régulariser :</span>
                    <div className="text-base font-bold text-slate-800 font-mono">
                      ~{currentUnpaidAmount.toLocaleString()} HTG
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-0.5">
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                      <TrendingUp size={13} /> Recouvrement Optimisé avec EduNova Pro :
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                      +{estimatedRecoveredAmount.toLocaleString()} <span className="text-xs font-normal text-slate-500">HTG</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Grâce aux facilités de règlement MonCash / NatCash et aux relances automatiques par SMS et WhatsApp.
                    </p>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
                    <span>Temps administratif économisé :</span>
                    <span className="font-mono font-bold text-indigo-700">+{hoursSavedPerMonth}h / mois</span>
                  </div>
                </div>

                <button
                  onClick={() => handleNavigate('demo')}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Optimiser la Trésorerie de mon École</span>
                  <ArrowRight size={13} />
                </button>

              </div>

            </div>

          </div>
        </section>

        {/* 6. TÉMOIGNAGES */}
        <section id="testimonials" className="scroll-mt-24 py-10 sm:py-14 bg-slate-50 border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
            
            <div className="text-center max-w-3xl mx-auto space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/60 inline-block">
                Retours d'Expérience
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-amber-500 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                La Confiance des Directeurs & Économes
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm">
                Retours d'expérience concrets des directions d'écoles privées et instituts partenaires en Haïti.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
              
              {/* Carte 1 */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-emerald-500/50 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3.5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70">
                      Règlements MonCash
                    </span>
                    <div className="flex text-amber-400 gap-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed italic">
                    « Les rentrées scolaires se déroulent désormais avec calme. Plus de 70% des parents règlent la scolarité par MonCash avec confirmation immédiate. »
                  </p>
                  <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-700 bg-emerald-50/70 px-2 py-0.5 rounded">
                    <span>✓ +85% de recouvrement ponctuel</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-800 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    DP
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate">Direction Pédagogique</div>
                    <div className="text-[10.5px] text-slate-500 truncate">Institution Privée · Port-au-Prince</div>
                  </div>
                </div>
              </div>

              {/* Carte 2 */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-indigo-500/50 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3.5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/70">
                      Économat Bidevise
                    </span>
                    <div className="flex text-amber-400 gap-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed italic">
                    « La double monnaie HTG/USD et les clôtures de caisse quotidiennes apportent une clarté absolue. Zéro écart et transparence totale pour notre conseil. »
                  </p>
                  <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded">
                    <span>✓ Clôtures certifiées chaque soir</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    EP
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate">Économe Principal</div>
                    <div className="text-[10.5px] text-slate-500 truncate">Collège Newton · Pétion-Ville</div>
                  </div>
                </div>
              </div>

              {/* Carte 3 */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-amber-500/50 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3.5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
                      Mode Hors-Ligne
                    </span>
                    <div className="flex text-amber-400 gap-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed italic">
                    « Le mode hors-ligne nous assure une tranquillité remarquable. Même lors des coupures de courant, la saisie et les calculs des bulletins continuent sans interruption. »
                  </p>
                  <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-amber-700 bg-amber-50/70 px-2 py-0.5 rounded">
                    <span>✓ Zéro interruption de saisie</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    SG
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate">Secrétariat Général</div>
                    <div className="text-[10.5px] text-slate-500 truncate">Institut Supérieur · Cap-Haïtien</div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* 7. FORMULAIRE DE DÉMO ERGONOMIQUE */}
        <section id="demo" className="scroll-mt-24 py-10 sm:py-14 bg-white border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto bg-slate-50 p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
              
              <div className="text-center space-y-1 mb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/60 inline-block">
                  Démonstration Personnalisée
                </span>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-amber-500 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                  Planifiez votre Démo EduNova Pro
                </h2>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Découvrez la plateforme adaptée aux caractéristiques de votre établissement.
                </p>
              </div>

              {demoSubmitted ? (
                <div className="text-center py-6 space-y-3 bg-white rounded-lg border border-emerald-200 p-5">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={22} />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-slate-900">Demande Enregistrée !</h3>
                    <p className="text-slate-600 text-xs max-w-sm mx-auto">
                      Merci pour votre confiance. Notre équipe vous contacte sous 24h ouvrées pour organiser la présentation.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <a
                      href={`https://wa.me/50936045639?text=${encodeURIComponent(`Bonjour EduNova Pro ! J'ai soumis une demande de démo pour l'établissement ${schoolName}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Smartphone size={13} />
                      <span>Échanger Directement sur WhatsApp</span>
                    </a>
                    <button
                      onClick={() => setDemoSubmitted(false)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
                    >
                      Nouvelle demande
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="space-y-3">
                  
                  {/* Grille Ergonomique 2 colonnes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    
                    {/* Établissement */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <Building2 size={12} className="text-indigo-600" />
                        <span>Nom de l'Établissement *</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Collège Sainte-Thérèse"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 transition-colors"
                      />
                    </div>

                    {/* Responsable */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <Users size={12} className="text-indigo-600" />
                        <span>Votre Nom & Rôle *</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: M. Jean (Directeur)"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 transition-colors"
                      />
                    </div>

                    {/* Téléphone / WhatsApp */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <Phone size={12} className="text-emerald-600" />
                        <span>WhatsApp / Téléphone *</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+509 3604-5639"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 transition-colors"
                      />
                    </div>

                    {/* Ville */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <MapPin size={12} className="text-indigo-600" />
                        <span>Ville / Commune</span>
                      </label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 transition-colors cursor-pointer"
                      >
                        <option value="Port-au-Prince">Port-au-Prince</option>
                        <option value="Pétion-Ville">Pétion-Ville</option>
                        <option value="Delmas">Delmas</option>
                        <option value="Carrefour">Carrefour</option>
                        <option value="Cap-Haïtien">Cap-Haïtien</option>
                        <option value="Gonaïves">Gonaïves</option>
                        <option value="Saint-Marc">Saint-Marc</option>
                        <option value="Les Cayes">Les Cayes</option>
                        <option value="Jacmel">Jacmel</option>
                        <option value="Mirebalais">Mirebalais</option>
                        <option value="Autre">Autre Ville / Province</option>
                      </select>
                    </div>

                    {/* Type d'établissement */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <GraduationCap size={12} className="text-indigo-600" />
                        <span>Type d'Établissement</span>
                      </label>
                      <select
                        value={schoolType}
                        onChange={(e) => setSchoolType(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 transition-colors cursor-pointer"
                      >
                        <option value="Fondamentale & Secondaire">Fondamentale & Secondaire (Classique)</option>
                        <option value="Maternelle & Primaire">Maternelle & Primaire</option>
                        <option value="Université & Faculté">Université & Faculté (Supérieur)</option>
                        <option value="Institut Professionnel">Institut Professionnel & Technique</option>
                        <option value="Réseau d'Écoles">Réseau d'Écoles / Congrégation</option>
                      </select>
                    </div>

                    {/* Effectif estimé */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <School size={12} className="text-indigo-600" />
                        <span>Effectif Estimé</span>
                      </label>
                      <select
                        value={studentBracket}
                        onChange={(e) => setStudentBracket(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-600 transition-colors cursor-pointer"
                      >
                        <option value="Moins de 150">Moins de 150 élèves</option>
                        <option value="150-350">150 à 350 élèves</option>
                        <option value="350-700">350 à 700 élèves</option>
                        <option value="700-1500">700 à 1 500 élèves</option>
                        <option value="Plus de 1500">Plus de 1 500 élèves</option>
                      </select>
                    </div>

                  </div>

                  {/* Bouton de Soumission */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>Envoi de votre demande...</span>
                      ) : (
                        <>
                          <span>Envoyer ma Demande de Démonstration</span>
                          <Send size={13} />
                        </>
                      )}
                    </button>
                  </div>

                  {/* WhatsApp Direct */}
                  <div className="pt-2 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 text-[11px]">Vous préférez un échange direct ?</span>
                    <a
                      href="https://wa.me/50936045639?text=Bonjour%20EduNova%20Pro%2C%20je%20souhaite%20des%20renseignements%20pour%20notre%20%C3%A9tablissement."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <MessageCircle size={13} />
                      <span>Échanger directement sur WhatsApp (+509 3604-5639)</span>
                    </a>
                  </div>

                </form>
              )}

            </div>
          </div>
        </section>

      </main>

      {/* =========================================================================
          3. FOOTER HAUT DE GAMME PURIFIÉ & ALLÉGÉ
             COORDONNÉES OFFICIELLES & BAS DE PAGE CENTRÉ
          ========================================================================= */}
      <footer className="bg-[#070D1E] text-slate-300 border-t border-slate-800/80 pt-10 pb-8 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          {/* Grille Principale 4 Colonnes Propres */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            
            {/* Colonne 1 : Logo, Identité & Réseaux Sociaux */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center shadow-inner">
                  <Logo size="sm" className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-base font-black tracking-tight text-white leading-tight">
                    EDUNOVA <span className="text-amber-400">PRO</span>
                  </div>
                  <div className="text-[11px] text-amber-300/90 font-medium italic">
                    « L'Excellence Académique à votre Portée »
                  </div>
                </div>
              </div>

              <p className="text-slate-400 text-xs leading-relaxed">
                Système de gestion académique, financière et administrative conçu pour les réalités d'Haïti : encaissements directs MonCash & NatCash, bulletins périodiques et fonctionnement garanti hors-ligne.
              </p>

              {/* Rangée de Liens Réseaux Sociaux & Badge d'Agrément */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <Facebook size={14} />
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <Instagram size={14} />
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <Linkedin size={14} />
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <Youtube size={14} />
                </a>
                <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded-md font-medium">
                  Système Agréé Haïti
                </span>
              </div>
            </div>

            {/* Colonne 2 : Solutions Académiques & Économat */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                SOLUTIONS MÉTIER
              </h4>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li>
                  <button 
                    onClick={() => handleNavigate('modules', 'finance')} 
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Économat Bidevise (HTG & USD)</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate('modules', 'finance')} 
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Paiements Directs MonCash & NatCash</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate('modules', 'academic')} 
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Bulletins Scolaires & Palmarès</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate('modules', 'academic')} 
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Gestion des Notes & Coefficients</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate('modules', 'payroll')} 
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Salaires & RH Enseignants</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate('specialites')} 
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Continuité Totale Hors-Ligne</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Colonne 3 : Accompagnement & Services */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                SERVICES & DÉMONSTRATION
              </h4>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li>
                  <button 
                    onClick={() => handleNavigate('demo')} 
                    className="text-amber-300 font-semibold hover:text-white transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Planifier une démonstration en ligne</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate('roi')} 
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Simulateur d'économies annuelles</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate('specialites')} 
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Reprise & Migration des données Excel</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate('specialites')} 
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Formation des équipes administratives</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate('testimonials')} 
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Témoignages des directions d'écoles</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate('specialites')} 
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left flex items-center gap-1.5"
                  >
                    <span className="text-amber-400">→</span>
                    <span>Sécurité & Portefeuille élève</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Colonne 4 : Secrétariat & Contact avec coordonnées exactes */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                SECRÉTARIAT & CONTACT
              </h4>

              <div className="space-y-3 text-slate-300 text-xs">
                
                {/* Adresse exacte demandée */}
                <div className="flex items-start gap-2.5">
                  <MapPin size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white">5, Christ-Roi, rue Acacia, prolongée</div>
                    <div className="text-[11px] text-slate-400">Port-au-Prince, Haïti · Siège opérationnel</div>
                  </div>
                </div>

                {/* Téléphones exacts demandés */}
                <div className="flex items-start gap-2.5">
                  <Phone size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <a 
                      href="https://wa.me/50936045639" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="font-bold text-white hover:text-amber-300 transition-colors tracking-wide font-mono block"
                    >
                      +509 3604-5639
                    </a>
                    <a 
                      href="tel:+50933508416" 
                      className="font-bold text-white hover:text-amber-300 transition-colors tracking-wide font-mono block"
                    >
                      +509 3350-8416
                    </a>
                    <div className="text-[10px] text-slate-400">Secrétariat & accueil WhatsApp</div>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-2.5">
                  <Mail size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white">contact@edunova-pro.tech</div>
                    <div className="text-[10px] text-slate-400">Dossiers et demandes de démo</div>
                  </div>
                </div>

                {/* Bouton formulaire & démo */}
                <div className="pt-1">
                  <button
                    onClick={() => handleNavigate('demo')}
                    className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-white rounded-lg border border-slate-700/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <span>Formulaire de contact & démo →</span>
                  </button>
                </div>

              </div>
            </div>

          </div>

          {/* LIGNE INFÉRIEURE CENTRÉE ET ÉPURÉE */}
          <div className="pt-8 border-t border-slate-800/80 text-center space-y-3">
            <div className="text-xs text-slate-400">
              © 2026 EduNova Pro. Tous droits réservés · République d'Haïti.
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400 font-medium">
              <button 
                onClick={() => handleNavigate('specialites')} 
                className="hover:text-white transition-colors cursor-pointer"
              >
                Mentions Légales
              </button>
              <span className="text-slate-700" aria-hidden="true">·</span>
              <button 
                onClick={() => handleNavigate('demo')} 
                className="hover:text-white transition-colors cursor-pointer"
              >
                Confidentialité des Données
              </button>
              <span className="text-slate-700" aria-hidden="true">·</span>
              <button 
                onClick={onOpenLogin} 
                className="text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Lock size={12} />
                <span>Portail Établissement</span>
              </button>
            </div>
          </div>

        </div>
      </footer>

      {/* =========================================================================
          4. BOUTONS FLOTTANTS COMPACTS & FLUIDES (EN BAS À DROITE)
             - BOUTON RETOUR EN HAUT (ROUGE/CORAIL)
             - BOUTON WHATSAPP FLOTTANT (AVEC LE NUMÉRO +509 3604-5639)
          ========================================================================= */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-center gap-3">
        
        {/* Bouton Retour en Haut */}
        <AnimatePresence>
          {scrolled && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onClick={scrollToTop}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-lg flex items-center justify-center transition-all cursor-pointer hover:scale-105"
              aria-label="Retour en haut de la page"
              title="Retour en haut"
            >
              <ArrowUp size={18} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Bouton WhatsApp Flottant avec le numéro officiel +509 3604-5639 */}
        <a
          href="https://wa.me/50936045639?text=Bonjour%20EduNova%20Pro%2C%20je%20souhaite%20des%20informations%20pour%20notre%20%C3%A9tablissement."
          target="_blank"
          rel="noopener noreferrer"
          className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-xl flex items-center justify-center transition-all cursor-pointer hover:scale-105"
          aria-label="Discuter sur WhatsApp"
          title="Assistance WhatsApp directe (+509 3604-5639)"
        >
          <MessageCircle size={26} />
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#070D1E] shadow-sm animate-pulse">
            1
          </span>
        </a>

      </div>

    </div>
  );
};

export default PublicLandingPage;
