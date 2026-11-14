import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  MessageCircle,
  School,
  BarChart3,
  ArrowUp,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Calculator,
  BookOpen,
  FileCheck2,
  Layers,
  WifiOff,
  RefreshCw,
  Award,
  UserCheck,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import Logo from './Logo';
import { toast } from 'sonner';
import {
  validateDemoField,
  validateDemoForm,
  DemoFormErrors,
  DemoFormField,
  DemoFormValues
} from '../utils/validation';
import { signDemoRequestOnClient } from '../utils/demoRequestCrypto';

interface PublicLandingPageProps {
  onOpenLogin: () => void;
  onPreloadLogin?: () => void;
  isOpeningLogin?: boolean;
}

interface PartnerSchoolItem {
  id: string;
  name: string;
  city: string;
  cycle: string;
  initials: string;
  accentColor: string;
  crestVariant: 'shield' | 'columns' | 'compass' | 'book' | 'hexagon' | 'arch';
}

const ACTIVE_ESTABLISHMENTS_TARGET = 48;

const PARTNER_SCHOOLS: PartnerSchoolItem[] = [
  {
    id: 'college-innovations',
    name: 'Collège des Innovations',
    city: 'Port-au-Prince',
    cycle: 'Fondamental & Secondaire',
    initials: 'CI',
    accentColor: '#1E40AF',
    crestVariant: 'shield'
  },
  {
    id: 'im-saint-michel',
    name: 'Inst. Mixte Saint-Michel',
    city: 'Pétion-Ville',
    cycle: 'Cycle Complet',
    initials: 'SM',
    accentColor: '#0F766E',
    crestVariant: 'columns'
  },
  {
    id: 'lycee-horizon',
    name: 'Lycée Tech. Horizon',
    city: 'Cap-Haïtien',
    cycle: 'Secondaire & Pro',
    initials: 'LH',
    accentColor: '#B45309',
    crestVariant: 'compass'
  },
  {
    id: 'academie-lumiere',
    name: 'Académie Bilingue Lumière',
    city: 'Delmas',
    cycle: 'Maternelle – Philo',
    initials: 'AL',
    accentColor: '#4338CA',
    crestVariant: 'book'
  },
  {
    id: 'institut-jean-price',
    name: 'Institut Jean-Price Mars',
    city: 'Les Cayes',
    cycle: 'Enseignement Supérieur',
    initials: 'JP',
    accentColor: '#0369A1',
    crestVariant: 'hexagon'
  },
  {
    id: 'ecole-esperance',
    name: 'École Moderne Espérance',
    city: 'Gonaïves',
    cycle: 'Primaire & Collège',
    initials: 'EE',
    accentColor: '#047857',
    crestVariant: 'arch'
  }
];

const PartnerSchoolEmblem: React.FC<{ school: PartnerSchoolItem }> = ({ school }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className="w-11 h-11 shrink-0"
      role="img"
      aria-label={`Emblème ${school.name}`}
    >
      <rect width="48" height="48" rx="12" fill="#0B132B" />
      {school.crestVariant === 'shield' && (
        <path
          d="M24 8L37 13V23.5C37 31.2 31.4 37.3 24 40C16.6 37.3 11 31.2 11 23.5V13L24 8Z"
          fill="none"
          stroke={school.accentColor}
          strokeWidth="2.2"
        />
      )}
      {school.crestVariant === 'columns' && (
        <g stroke={school.accentColor} strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 15H36" />
          <path d="M16 19V33M24 19V33M32 19V33" />
          <path d="M11 36H37" />
        </g>
      )}
      {school.crestVariant === 'compass' && (
        <g fill="none" stroke={school.accentColor} strokeWidth="2.2">
          <circle cx="24" cy="24" r="13" />
          <path d="M24 13L28.5 24L24 35L19.5 24L24 13Z" />
        </g>
      )}
      {school.crestVariant === 'book' && (
        <g fill="none" stroke={school.accentColor} strokeWidth="2.2" strokeLinejoin="round">
          <path d="M11 14C16 14 20.5 15.5 24 18C27.5 15.5 32 14 37 14V34C32 34 27.5 35.2 24 37.5C20.5 35.2 16 34 11 34V14Z" />
          <path d="M24 18V37.5" />
        </g>
      )}
      {school.crestVariant === 'hexagon' && (
        <polygon
          points="24,9 37,16.5 37,31.5 24,39 11,31.5 11,16.5"
          fill="none"
          stroke={school.accentColor}
          strokeWidth="2.2"
        />
      )}
      {school.crestVariant === 'arch' && (
        <g fill="none" stroke={school.accentColor} strokeWidth="2.2">
          <path d="M13 36V23C13 16.9 17.9 12 24 12C30.1 12 35 16.9 35 23V36" />
          <path d="M10 36H38" strokeLinecap="round" />
        </g>
      )}
      <text
        x="24"
        y="27"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="11"
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.5"
      >
        {school.initials}
      </text>
    </svg>
  );
};

export const SocialProofSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [displayedCount, setDisplayedCount] = useState<number>(ACTIVE_ESTABLISHMENTS_TARGET);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof window === 'undefined') return;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      setDisplayedCount(ACTIVE_ESTABLISHMENTS_TARGET);
      return;
    }

    let rafId: number | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || hasAnimatedRef.current) return;
        hasAnimatedRef.current = true;
        observer.disconnect();

        const startVal = 12;
        const duration = 650;
        const startTime = performance.now();

        const step = (now: number) => {
          const progress = Math.min(1, (now - startTime) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplayedCount(Math.round(startVal + (ACTIVE_ESTABLISHMENTS_TARGET - startVal) * eased));
          if (progress < 1) {
            rafId = requestAnimationFrame(step);
          }
        };

        rafId = requestAnimationFrame(step);
      },
      { threshold: 0.25 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="social-proof-heading"
      className="py-12 sm:py-16 bg-white border-t border-slate-200/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Réseau d&apos;Établissements Partenaires
            </div>
            <h2
              id="social-proof-heading"
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight [text-wrap:balance]"
            >
              Ils structurent leur économat et leur scolarité avec EduNova Pro
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Port-au-Prince <span aria-hidden="true">·</span> Pétion-Ville <span aria-hidden="true">·</span> Cap-Haïtien <span aria-hidden="true">·</span> Les Cayes <span aria-hidden="true">·</span> Gonaïves
            </p>
          </div>

          <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-6 py-4 flex items-center gap-5">
            <div className="text-3xl sm:text-4xl font-extrabold text-[#0B132B] tabular-nums tracking-tight">
              {displayedCount}
            </div>
            <div className="h-9 w-px bg-slate-200" aria-hidden="true" />
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-slate-900">Établissements actifs</div>
              <div className="text-xs text-slate-500 tabular-nums">
                18 400+ élèves gérés <span aria-hidden="true">·</span> Données de démonstration
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PARTNER_SCHOOLS.map((school) => (
            <div
              key={school.id}
              className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
            >
              <PartnerSchoolEmblem school={school} />
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{school.name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {school.city} <span aria-hidden="true">·</span> {school.cycle}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({
  onOpenLogin,
  onPreloadLogin,
  isOpeningLogin = false
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openNavGroup, setOpenNavGroup] = useState<'academic' | 'finance' | 'admin' | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<'finance' | 'academic' | 'payroll' | 'parents'>('finance');
  const [previewTab, setPreviewTab] = useState<'receipt' | 'report' | 'offline'>('receipt');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [bursarImgFailed, setBursarImgFailed] = useState(false);
  const [classroomImgFailed, setClassroomImgFailed] = useState(false);

  // Simulateur d'Économies
  const [studentCount, setStudentCount] = useState<number>(350);
  const [avgTuition, setAvgTuition] = useState<number>(25000); // HTG
  const [unpaidRate, setUnpaidRate] = useState<number>(20); // 20%

  // Configuration publique des canaux de réception (Email & WhatsApp)
  const [contactConfig, setContactConfig] = useState({
    displayEmail: 'contact@edunova-pro.tech',
    whatsappNumber: '50936045639',
    whatsappDisplay: '+509 3604-5639',
    secondaryPhoneDisplay: '3350-8416',
    smtpReady: false,
    whatsappAutoReady: false
  });

  // Formulaire Démo Optimisé
  const [contactName, setContactName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Port-au-Prince');
  const [schoolType, setSchoolType] = useState('Fondamentale & Secondaire');
  const [studentBracket, setStudentBracket] = useState('150-350');
  const [preferredChannel, setPreferredChannel] = useState<'both' | 'whatsapp' | 'email'>('both');
  const [notes, setNotes] = useState('');
  const [honeypotWebsite, setHoneypotWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<DemoFormErrors>({});
  const [touchedFields, setTouchedFields] = useState<Partial<Record<DemoFormField, boolean>>>({});
  const [copiedDemoMessage, setCopiedDemoMessage] = useState(false);
  const demoCardRef = useRef<HTMLDivElement | null>(null);
  const schoolInputRef = useRef<HTMLInputElement | null>(null);
  const contactInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const notesInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    referenceCode: string;
    schoolName: string;
    contactName: string;
    phone: string;
    email: string;
    city: string;
    schoolType: string;
    studentBracket: string;
    displayEmail: string;
    whatsappDisplay: string;
    whatsappUrl: string;
    mailtoUrl: string;
    formattedMessage: string;
    delivery: {
      savedToInbox: boolean;
      emailSent: boolean;
      emailReason?: string;
      whatsappAutoSent: boolean;
      whatsappReason?: string;
    };
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/public/contact-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.success && data?.config) {
          setContactConfig((prev) => ({ ...prev, ...data.config }));
        }
      })
      .catch(() => {
        // Fallback silencieux sur les coordonnées institutionnelles par défaut
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenNavGroup(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenNavGroup(null);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!onPreloadLogin) return;
    const conn = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
    if (conn?.saveData || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') {
      return;
    }
    const timer = window.setTimeout(() => {
      onPreloadLogin();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [onPreloadLogin]);

  const totalBudget = studentCount * avgTuition;
  const currentUnpaidAmount = Math.round(totalBudget * (unpaidRate / 100));
  const estimatedRecoveredAmount = Math.round(currentUnpaidAmount * 0.45);
  const hoursSavedPerMonth = Math.round(studentCount * 0.25);

  const getDemoFormValues = (overrides?: Partial<DemoFormValues>): DemoFormValues => ({
    schoolName,
    contactName,
    phone,
    email,
    preferredChannel,
    notes,
    ...overrides
  });

  const handleDemoFieldBlur = (field: DemoFormField, overrides?: Partial<DemoFormValues>) => {
    const nextValues = getDemoFormValues(overrides);
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    const err = validateDemoField(field, nextValues);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) {
        next[field] = err;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const handleDemoFieldChange = (field: DemoFormField, value: string) => {
    const nextValues = getDemoFormValues({ [field]: value } as Partial<DemoFormValues>);
    if (touchedFields[field] || fieldErrors[field]) {
      const err = validateDemoField(field, nextValues);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (err) {
          next[field] = err;
        } else {
          delete next[field];
        }
        return next;
      });
    }
    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const currentValues = getDemoFormValues();
    const validationErrors = validateDemoForm(currentValues);
    setTouchedFields({
      schoolName: true,
      contactName: true,
      phone: true,
      email: true,
      notes: true
    });
    setFieldErrors(validationErrors);

    const errorOrder: DemoFormField[] = ['schoolName', 'contactName', 'phone', 'email', 'notes'];
    const firstInvalidField = errorOrder.find((key) => Boolean(validationErrors[key]));

    if (firstInvalidField) {
      const firstErrorMsg = validationErrors[firstInvalidField] || 'Veuillez vérifier les informations saisies.';
      setSubmitError(firstErrorMsg);
      toast.error(firstErrorMsg);

      const refMap: Partial<Record<DemoFormField, React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>>> = {
        schoolName: schoolInputRef,
        contactName: contactInputRef,
        phone: phoneInputRef,
        email: emailInputRef,
        notes: notesInputRef
      };
      refMap[firstInvalidField]?.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const signedHeaders = await signDemoRequestOnClient({
        schoolName: schoolName.trim(),
        phone: phone.trim(),
        email: email.trim()
      });

      const response = await fetch('/api/demo-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Demo-Signature': signedHeaders.signature,
          'X-Demo-Timestamp': signedHeaders.timestamp,
          'X-Demo-Nonce': signedHeaders.nonce
        },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          contactName: contactName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          city,
          schoolType,
          studentBracket,
          preferredChannel,
          notes: notes.trim(),
          website: honeypotWebsite
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        if (data?.fieldErrors && typeof data.fieldErrors === 'object') {
          setFieldErrors((prev) => ({ ...prev, ...data.fieldErrors }));
        }
        throw new Error(data?.error || `Erreur serveur (${response.status})`);
      }

      setSubmissionResult({
        referenceCode: data.referenceCode,
        schoolName: schoolName.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        city,
        schoolType,
        studentBracket,
        displayEmail: data.displayEmail || contactConfig.displayEmail,
        whatsappDisplay: data.whatsappDisplay || contactConfig.whatsappDisplay,
        whatsappUrl: data.whatsappUrl,
        mailtoUrl: data.mailtoUrl,
        formattedMessage: data.formattedMessage,
        delivery: data.delivery || {
          savedToInbox: true,
          emailSent: false,
          whatsappAutoSent: false
        }
      });
      setDemoSubmitted(true);
      setSubmitError(null);

      window.setTimeout(() => {
        demoCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);

      if (data.delivery?.emailSent) {
        toast.success(`Demande confirmée (${data.referenceCode}) ! Notification transmise à notre équipe.`);
      } else {
        toast.success(`Demande confirmée (${data.referenceCode}) ! Notre équipe vous recontacte sous 24h.`);
      }
    } catch (err: any) {
      const msg = err?.message || 'Impossible d’enregistrer la demande pour le moment. Contactez-nous sur WhatsApp.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyDemoSummary = async () => {
    if (!submissionResult?.formattedMessage) return;
    try {
      await navigator.clipboard.writeText(submissionResult.formattedMessage);
      setCopiedDemoMessage(true);
      toast.success('Message complet copié dans le presse-papiers !');
      window.setTimeout(() => setCopiedDemoMessage(false), 2500);
    } catch {
      toast.error('Copie automatique refusée par le navigateur.');
    }
  };

  const handleNavigate = (
    targetId: string,
    tab?: 'finance' | 'academic' | 'payroll' | 'parents'
  ) => {
    setMobileMenuOpen(false);
    setOpenNavGroup(null);
    if (tab) {
      setActiveTab(tab);
    }

    setTimeout(() => {
      const element = document.getElementById(targetId);
      if (element) {
        const headerOffset = 92;
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
    <div
      className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-indigo-600 selection:text-white flex flex-col justify-between relative"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}
    >
      {/* =========================================================================
          1. EN-TÊTE INSTITUTIONNEL & BARRE DE NAVIGATION ÉPURÉE (3 ZONES)
         ========================================================================= */}
      <header
        className={`fixed top-0 inset-x-0 z-50 bg-[#0B132B]/95 backdrop-blur-md text-slate-100 border-b border-slate-800/90 transition-shadow duration-200 ${
          scrolled ? 'shadow-xl shadow-black/25' : 'shadow-sm'
        }`}
      >
        {/* Bandeau Supérieur d'Informations (masqué sur mobile pour respecter la hauteur max) */}
        <div className="hidden md:block bg-[#060B18] text-slate-300 border-b border-slate-800/80 py-1.5 px-6 lg:px-8 text-[11px]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5 text-slate-300">
                <MapPin size={12} className="text-amber-400 shrink-0" />
                <span className="font-medium whitespace-nowrap">
                  5, Christ-Roi, rue Acacia, prolongée, Port-au-Prince, Haïti
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Phone size={12} className="text-amber-400 shrink-0" />
                <a
                  href={`https://wa.me/${contactConfig.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white hover:text-amber-300 transition-colors font-mono tabular-nums"
                >
                  {contactConfig.whatsappDisplay}
                </a>
                <span className="text-slate-600">/</span>
                <a
                  href="tel:+50933508416"
                  className="font-semibold text-white hover:text-amber-300 transition-colors font-mono tabular-nums"
                >
                  {contactConfig.secondaryPhoneDisplay}
                </a>
              </div>

              <div className="hidden xl:flex items-center gap-1.5 text-slate-300 shrink-0">
                <Mail size={12} className="text-amber-400 shrink-0" />
                <a href={`mailto:${contactConfig.displayEmail}`} className="hover:text-amber-300 transition-colors">
                  {contactConfig.displayEmail}
                </a>
              </div>
            </div>

            <div className="text-amber-300 font-semibold italic select-none text-[11px] tracking-wide shrink-0">
              « L&apos;Excellence Académique à votre Portée »
            </div>
          </div>
        </div>

        {/* Barre Principale de Navigation — Contrat Strict 3 Zones */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-8">
          {/* ZONE 1 : Marque seule sur une ligne (sans badges ni sous-titres parasites) */}
          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0 text-left"
          >
            <Logo size="sm" className="w-8 h-8 transition-transform duration-200 group-hover:scale-105 shrink-0" />
            <span className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0">
              EduNova <span className="text-amber-400">Pro</span>
            </span>
          </button>

          {/* ZONE 2 : Navigation Regroupée par Domaines (Académique, Économat, Administration) */}
          <nav
            ref={navRef}
            aria-label="Navigation principale par domaines"
            className="hidden lg:flex items-center gap-5 xl:gap-7 text-[13px] font-medium text-slate-300"
          >
            {/* Domaine 1 : Académique */}
            <div
              className="relative"
              onMouseEnter={() => setOpenNavGroup('academic')}
              onMouseLeave={() => setOpenNavGroup(null)}
            >
              <button
                type="button"
                aria-expanded={openNavGroup === 'academic'}
                aria-haspopup="true"
                onClick={() => setOpenNavGroup(openNavGroup === 'academic' ? null : 'academic')}
                className={`py-1.5 flex items-center gap-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  openNavGroup === 'academic'
                    ? 'text-white border-indigo-400'
                    : 'text-slate-300 hover:text-white border-transparent hover:border-indigo-400'
                }`}
              >
                <span>Académique</span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-150 ${
                    openNavGroup === 'academic' ? 'rotate-180 text-indigo-400' : 'text-slate-400'
                  }`}
                />
              </button>

              {openNavGroup === 'academic' && (
                <div className="absolute left-0 top-full pt-2 w-72 z-50">
                  <div className="bg-[#0B132B] border border-slate-700/80 rounded-xl shadow-2xl p-2 space-y-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Pôle Académique &amp; Pédagogie
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('modules', 'academic')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <GraduationCap size={15} className="text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Bulletins &amp; Palmarès</div>
                        <div className="text-[11px] text-slate-400">Notes, moyennes, rangs &amp; relevés LMD</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate('specialites')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <BookOpen size={15} className="text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Cycles Scolaires &amp; Universitaires</div>
                        <div className="text-[11px] text-slate-400">De la maternelle aux facultés (MENFP &amp; LMD)</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate('modules', 'parents')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <UserCheck size={15} className="text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Portail Parents &amp; Étudiants</div>
                        <div className="text-[11px] text-slate-400">Suivi des résultats, absences &amp; échéances</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Domaine 2 : Économat */}
            <div
              className="relative"
              onMouseEnter={() => setOpenNavGroup('finance')}
              onMouseLeave={() => setOpenNavGroup(null)}
            >
              <button
                type="button"
                aria-expanded={openNavGroup === 'finance'}
                aria-haspopup="true"
                onClick={() => setOpenNavGroup(openNavGroup === 'finance' ? null : 'finance')}
                className={`py-1.5 flex items-center gap-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  openNavGroup === 'finance'
                    ? 'text-white border-emerald-400'
                    : 'text-slate-300 hover:text-white border-transparent hover:border-emerald-400'
                }`}
              >
                <span>Économat</span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-150 ${
                    openNavGroup === 'finance' ? 'rotate-180 text-emerald-400' : 'text-slate-400'
                  }`}
                />
              </button>

              {openNavGroup === 'finance' && (
                <div className="absolute left-0 top-full pt-2 w-72 z-50">
                  <div className="bg-[#0B132B] border border-slate-700/80 rounded-xl shadow-2xl p-2 space-y-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      Pôle Économat &amp; Trésorerie
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('modules', 'finance')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <Wallet size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Caisses Bidevises (HTG &amp; USD)</div>
                        <div className="text-[11px] text-slate-400">Scolarité, soldes individuels &amp; clôtures PDF</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate('modules', 'finance')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <Smartphone size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Encaissements Mobiles &amp; Guichet</div>
                        <div className="text-[11px] text-slate-400">Règlements numériques directs &amp; reçus certifiés</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate('roi')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <Calculator size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Simulateur de Recouvrement</div>
                        <div className="text-[11px] text-slate-400">Estimez vos économies et créances récupérées</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Domaine 3 : Administration */}
            <div
              className="relative"
              onMouseEnter={() => setOpenNavGroup('admin')}
              onMouseLeave={() => setOpenNavGroup(null)}
            >
              <button
                type="button"
                aria-expanded={openNavGroup === 'admin'}
                aria-haspopup="true"
                onClick={() => setOpenNavGroup(openNavGroup === 'admin' ? null : 'admin')}
                className={`py-1.5 flex items-center gap-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  openNavGroup === 'admin'
                    ? 'text-white border-amber-400'
                    : 'text-slate-300 hover:text-white border-transparent hover:border-amber-400'
                }`}
              >
                <span>Administration</span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-150 ${
                    openNavGroup === 'admin' ? 'rotate-180 text-amber-400' : 'text-slate-400'
                  }`}
                />
              </button>

              {openNavGroup === 'admin' && (
                <div className="absolute left-0 top-full pt-2 w-72 z-50">
                  <div className="bg-[#0B132B] border border-slate-700/80 rounded-xl shadow-2xl p-2 space-y-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Direction, RH &amp; Déploiement
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('modules', 'payroll')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <Users size={15} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Salaires, Vacataires &amp; RH</div>
                        <div className="text-[11px] text-slate-400">Heures de cours, avances &amp; fiches de paie</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate('specialites')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <WifiOff size={15} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Continuité Hors-Ligne &amp; Sécurité</div>
                        <div className="text-[11px] text-slate-400">Tolérance aux coupures &amp; isolation des données</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate('demo')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <Building2 size={15} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Migration Excel &amp; Démo</div>
                        <div className="text-[11px] text-slate-400">Mise en service accompagnée en 48h</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleNavigate('roi')}
              className="py-1.5 text-slate-300 hover:text-white border-b-2 border-transparent hover:border-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Simulateur
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('testimonials')}
              className="py-1.5 text-slate-300 hover:text-white border-b-2 border-transparent hover:border-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Témoignages
            </button>
          </nav>

          {/* ZONE 3 : 1 Action Principale */}
          <div className="hidden sm:flex items-center shrink-0">
            <button
              type="button"
              onClick={onOpenLogin}
              onMouseEnter={onPreloadLogin}
              onFocus={onPreloadLogin}
              onTouchStart={onPreloadLogin}
              disabled={isOpeningLogin}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] disabled:opacity-80 rounded-lg transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 shadow-xs"
            >
              <Lock size={13} className="text-slate-900 shrink-0" />
              <span>{isOpeningLogin ? 'Ouverture...' : 'Connexion'}</span>
            </button>
          </div>

          {/* Contrôles Mobile (< 640px) */}
          <div className="flex sm:hidden items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenLogin}
              onMouseEnter={onPreloadLogin}
              onFocus={onPreloadLogin}
              onTouchStart={onPreloadLogin}
              disabled={isOpeningLogin}
              className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 disabled:opacity-80 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isOpeningLogin ? 'Ouverture...' : 'Connexion'}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              aria-label="Ouvrir le menu de navigation"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Tiroir de Navigation Mobile */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden bg-[#0A0F1D] border-b border-slate-800 px-4 py-4 space-y-4 text-xs text-slate-300 shadow-xl overflow-y-auto max-h-[calc(100vh-4rem)] edunova-fade-in"
          >
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLogin();
                }}
                onMouseEnter={onPreloadLogin}
                onFocus={onPreloadLogin}
                onTouchStart={onPreloadLogin}
                disabled={isOpeningLogin}
                className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-80 text-slate-950 rounded-lg font-bold text-center flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Lock size={14} />
                <span>{isOpeningLogin ? 'Ouverture de la connexion...' : 'Accéder à l’Espace Établissement'}</span>
              </button>

              <div className="space-y-3 pt-1">
                {/* Domaine 1 : Académique */}
                <div className="space-y-1">
                  <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    Académique
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigate('modules', 'academic')}
                    className="w-full text-left py-2 px-2.5 text-slate-200 hover:bg-slate-800/70 rounded-lg font-semibold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <GraduationCap size={14} className="text-indigo-400" />
                      <span>Bulletins, Notes &amp; Palmarès</span>
                    </span>
                    <ChevronRight size={14} className="text-slate-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigate('modules', 'parents')}
                    className="w-full text-left py-2 px-2.5 text-slate-200 hover:bg-slate-800/70 rounded-lg font-semibold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <UserCheck size={14} className="text-indigo-400" />
                      <span>Portail Parents &amp; Étudiants</span>
                    </span>
                    <ChevronRight size={14} className="text-slate-500" />
                  </button>
                </div>

                {/* Domaine 2 : Économat */}
                <div className="space-y-1 pt-1 border-t border-slate-800/70">
                  <div className="px-2.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Économat
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigate('modules', 'finance')}
                    className="w-full text-left py-2 px-2.5 text-slate-200 hover:bg-slate-800/70 rounded-lg font-semibold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Wallet size={14} className="text-emerald-400" />
                      <span>Caisses Bidevises &amp; Encaissements Mobiles</span>
                    </span>
                    <ChevronRight size={14} className="text-slate-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigate('roi')}
                    className="w-full text-left py-2 px-2.5 text-slate-200 hover:bg-slate-800/70 rounded-lg font-semibold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-emerald-400" />
                      <span>Simulateur d&apos;Économies Annuelles</span>
                    </span>
                    <ChevronRight size={14} className="text-slate-500" />
                  </button>
                </div>

                {/* Domaine 3 : Administration */}
                <div className="space-y-1 pt-1 border-t border-slate-800/70">
                  <div className="px-2.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Administration
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigate('modules', 'payroll')}
                    className="w-full text-left py-2 px-2.5 text-slate-200 hover:bg-slate-800/70 rounded-lg font-semibold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Users size={14} className="text-amber-400" />
                      <span>Salaires, Vacataires &amp; RH</span>
                    </span>
                    <ChevronRight size={14} className="text-slate-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigate('specialites')}
                    className="w-full text-left py-2 px-2.5 text-slate-200 hover:bg-slate-800/70 rounded-lg font-semibold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <WifiOff size={14} className="text-amber-400" />
                      <span>Spécialités &amp; Continuité Hors-Ligne</span>
                    </span>
                    <ChevronRight size={14} className="text-slate-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigate('testimonials')}
                    className="w-full text-left py-2 px-2.5 text-slate-200 hover:bg-slate-800/70 rounded-lg font-semibold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Star size={14} className="text-amber-400" />
                      <span>Témoignages des Établissements</span>
                    </span>
                    <ChevronRight size={14} className="text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-2 text-[11px]">
                <div className="text-slate-400 flex items-center gap-1.5">
                  <MapPin size={12} className="text-amber-400 shrink-0" />
                  <span>5, Christ-Roi, rue Acacia, prolongée, Port-au-Prince, Haïti</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="https://wa.me/50936045639"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3 rounded-lg bg-emerald-950/90 text-emerald-300 border border-emerald-800/60 font-bold flex items-center justify-center gap-1.5 text-xs"
                  >
                    <MessageCircle size={13} />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href="tel:+50933508416"
                    className="py-2 px-3 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 font-bold flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Phone size={13} className="text-amber-400" />
                    <span>3350-8416</span>
                  </a>
                </div>
              </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          2. CORPS PRINCIPAL — ARCHITECTURE ÉDITORIALE & VITRINE INTERACTIVE
         ========================================================================= */}
      <main className="pt-16 md:pt-24 flex-grow">
        {/* HERO SECTION — SANS COUPURE DE TITRE + PHOTOGRAPHIE INSTITUTIONNELLE */}
        <section className="relative pt-8 pb-12 sm:pt-12 sm:pb-16 bg-gradient-to-b from-white via-slate-50 to-slate-100/70 border-b border-slate-200/80 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 lg:space-y-12">
            {/* Grille Principale 12 Colonnes : Proposition & Photographie */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              {/* Colonne Texte (7 cols) */}
              <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-indigo-700">
                  <span>République d&apos;Haïti</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="text-slate-600">Écoles, Collèges &amp; Universités</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="text-amber-700 italic">« L&apos;Excellence Académique à votre Portée »</span>
                </div>

                <div className="space-y-2.5">
                  <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-slate-950 tracking-tight leading-[1.08] [text-wrap:balance]">
                    EduNova <span className="text-indigo-600">Pro</span>
                  </h1>

                  {/* Intitulé complet de la spécialité — Jamais tronqué sur aucun écran */}
                  <p className="text-xl sm:text-2xl lg:text-[1.75rem] font-extrabold text-amber-600 tracking-tight leading-snug [text-wrap:balance]">
                    Spécialiste de la Gestion Scolaire, Universitaire et Financière
                  </p>
                </div>

                <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                  Pilotez sereinement votre établissement grâce à une plateforme conçue pour les réalités du terrain haïtien : encaissements directs <strong className="text-slate-900 font-semibold">MonCash &amp; NatCash</strong>, comptabilité bidevise <strong className="text-slate-900 font-semibold">HTG / USD</strong>, édition instantanée des bulletins et <strong className="text-emerald-700 font-semibold">continuité garantie hors-ligne</strong> face aux coupures de courant et d&apos;Internet.
                </p>

                {/* Hiérarchie CTA claire : 1 Action Dominante + 1 Action Secondaire Sobre */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleNavigate('demo')}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-600/15 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <span>Planifier une Démo Gratuite</span>
                    <ArrowRight size={16} />
                  </button>

                  <a
                    href={`https://wa.me/${contactConfig.whatsappNumber}?text=${encodeURIComponent('Bonjour EduNova Pro, je souhaite planifier une démonstration pour notre établissement.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <MessageCircle size={16} className="text-emerald-600 shrink-0" />
                    <span>WhatsApp Direct ({contactConfig.whatsappDisplay})</span>
                  </a>
                </div>

                {/* Métadonnées de confiance sans capsules */}
                <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-slate-600">
                  <span>Double Monnaie HTG &amp; USD</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span>Reçus Certifiés MonCash &amp; NatCash</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span>Synchronisation Hors-Ligne Automatique</span>
                </div>
              </div>

              {/* Colonne Visuelle (5 cols) — Photographie Éditoriale Authentique */}
              <div className="lg:col-span-5">
                <div className="relative h-64 sm:h-80 lg:h-full min-h-[280px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-md bg-slate-900">
                  {!heroImgFailed ? (
                    <picture className="block w-full h-full">
                      <source
                        type="image/avif"
                        srcSet="/optimized/hero-leadership-480.avif 480w, /optimized/hero-leadership-960.avif 960w, /optimized/hero-leadership-1280.avif 1280w"
                        sizes="(max-width: 1024px) 100vw, 42vw"
                      />
                      <source
                        type="image/webp"
                        srcSet="/optimized/hero-leadership-480.webp 480w, /optimized/hero-leadership-960.webp 960w, /optimized/hero-leadership-1280.webp 1280w"
                        sizes="(max-width: 1024px) 100vw, 42vw"
                      />
                      <img
                        src="/optimized/hero-leadership-960.jpg"
                        srcSet="/optimized/hero-leadership-480.jpg 480w, /optimized/hero-leadership-960.jpg 960w, /optimized/hero-leadership-1280.jpg 1280w"
                        sizes="(max-width: 1024px) 100vw, 42vw"
                        alt="Direction et économat d'un établissement scolaire haïtien pilotant EduNova Pro"
                        width={960}
                        height={640}
                        referrerPolicy="no-referrer"
                        loading="eager"
                        decoding="sync"
                        fetchPriority="high"
                        onError={() => setHeroImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    </picture>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center text-slate-300">
                      <Building2 size={36} className="text-amber-400 mb-3" />
                      <span className="text-sm font-bold text-white">Pilotage Intégré Direction &amp; Économat</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-5 text-white space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                      Direction &amp; Économat Synchronisés
                    </div>
                    <p className="text-sm font-bold leading-snug text-white">
                      Contrôle complet des inscriptions, encaissements et résultats académiques sur un tableau unifié.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Vitrine Interactive du Produit (Aperçu Métier Réel) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-3 bg-slate-900 text-slate-200 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5 text-xs font-bold">
                  <ShieldCheck size={16} className="text-amber-400 shrink-0" />
                  <span>Aperçu Opérationnel de la Plateforme</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  Architecture Multi-Établissements · Données Chiffrées
                </span>
              </div>

              {/* Onglets de Démonstration */}
              <div className="bg-slate-50 px-4 sm:px-6 py-2.5 border-b border-slate-200 flex items-center justify-between gap-4 overflow-x-auto">
                <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('receipt')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      previewTab === 'receipt'
                        ? 'bg-white text-slate-950 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Wallet size={13} className="text-emerald-600" />
                    <span>Encaissement Mobile &amp; Reçu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewTab('report')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      previewTab === 'report'
                        ? 'bg-white text-slate-950 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <GraduationCap size={13} className="text-indigo-600" />
                    <span>Bulletin &amp; Palmarès</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewTab('offline')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      previewTab === 'offline'
                        ? 'bg-white text-slate-950 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <WifiOff size={13} className="text-amber-600" />
                    <span>Continuité Hors-Ligne</span>
                  </button>
                </div>

                <span className="text-[11px] font-medium text-slate-500 hidden md:inline whitespace-nowrap">
                  Comptabilité Bidevise HTG &amp; USD
                </span>
              </div>

              {/* Panneau Dynamique */}
              <div className="p-5 sm:p-7 bg-white">
                {previewTab === 'receipt' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-7 space-y-2.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                        Encaissement Direct · Confirmation Automatique
                      </div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                        Paiements MonCash &amp; NatCash Reçus Sans Manipulation d&apos;Espèces
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Les parents règlent la scolarité directement depuis leur téléphone. Chaque paiement crédite instantanément le dossier individuel de l&apos;élève, génère un reçu officiel numéroté et alimente le journal de caisse sans aucune saisie manuelle.
                      </p>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          Clôture PDF certifiée
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          Séparation stricte Dossier Élève / Trésorerie
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          Double devise HTG &amp; USD
                        </span>
                      </div>
                    </div>

                    <div className="lg:col-span-5 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="font-bold text-slate-900">Reçu Officiel #TRZ-4912</span>
                        <span className="font-mono tabular-nums text-emerald-700 font-bold text-sm">+25 000 HTG</span>
                      </div>
                      <div className="space-y-1.5 text-slate-600">
                        <div className="flex justify-between">
                          <span>Élève</span>
                          <strong className="text-slate-900">Widlène A. · 7ème AF</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Rubrique</span>
                          <strong className="text-slate-900">Scolarité 2ème Tranche</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Canal</span>
                          <strong className="text-slate-900">MonCash Direct</strong>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200 text-[11px] text-emerald-700 font-mono font-bold flex items-center justify-between">
                        <span>Statut : Validé &amp; Scellé</span>
                        <span>Solde mis à jour</span>
                      </div>
                    </div>
                  </div>
                )}

                {previewTab === 'report' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-7 space-y-2.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                        Évaluation &amp; Délibération · Édition PDF Haute Résolution
                      </div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                        Bulletins Trimestriels, Relevés &amp; Palmarès en 1 Clic
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Les professeurs saisissent les notes par matière. EduNova Pro applique automatiquement vos coefficients, calcule les moyennes pondérées, classe les élèves par rang de promotion et édite les bulletins de toute la classe prêts pour l&apos;impression.
                      </p>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-indigo-600" />
                          Maternelle, Fondamentale &amp; Secondaire
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-indigo-600" />
                          Gestion Universitaire par crédits (LMD)
                        </span>
                      </div>
                    </div>

                    <div className="lg:col-span-5 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="font-bold text-slate-900">Bulletin 1ère Période</span>
                        <span className="font-mono tabular-nums text-indigo-700 font-bold text-sm">8.92 / 10</span>
                      </div>
                      <div className="space-y-1.5 text-slate-600">
                        <div className="flex justify-between">
                          <span>Mathématiques (Coef 4)</span>
                          <strong className="font-mono tabular-nums text-slate-900">88 / 100</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Français &amp; Littérature (Coef 4)</span>
                          <strong className="font-mono tabular-nums text-slate-900">90 / 100</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Rang de promotion</span>
                          <strong className="text-emerald-700">1er sur 42 élèves</strong>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200 text-[11px] text-indigo-700 font-mono font-bold flex items-center justify-between">
                        <span>Mention : Très Bien</span>
                        <span>Impression lot PDF prête</span>
                      </div>
                    </div>
                  </div>
                )}

                {previewTab === 'offline' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-7 space-y-2.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
                        Architecture Résiliente · Zones à Faible Connectivité
                      </div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                        Travail Garanti Sans Interruption Même en Coupure Réseau
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Conçue pour les zones reculées et les réalités électriques d&apos;Haïti : l&apos;application charge en mode léger, enregistre les notes et les reçus de caisse localement de façon chiffrée, puis synchronise automatiquement chaque opération dès le retour du signal.
                      </p>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-amber-600" />
                          Base locale sécurisée
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-amber-600" />
                          Aucune perte de saisie
                        </span>
                      </div>
                    </div>

                    <div className="lg:col-span-5 p-4 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                        <span className="font-bold text-amber-950 flex items-center gap-1.5">
                          <RefreshCw size={13} className="text-amber-700" />
                          File de Synchronisation Locale
                        </span>
                        <span className="font-mono text-[11px] font-bold text-emerald-700">Prêt</span>
                      </div>
                      <div className="space-y-1.5 text-amber-950/85">
                        <div className="flex justify-between">
                          <span>Notes saisies hors-ligne</span>
                          <strong className="font-mono tabular-nums">Conservation locale 100%</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Reçus de guichet émis</span>
                          <strong className="font-mono tabular-nums">Numérotation séquentielle</strong>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-amber-200 text-[11px] text-amber-900 font-mono font-bold flex items-center justify-between">
                        <span>Reprise réseau automatique</span>
                        <span>Zero-Data-Loss</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* BANDEAU DES 4 PILIERS ARCHITECTURAUX */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:divide-x lg:divide-slate-200">
              <div className="space-y-1 lg:pr-4">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">01. Bidevise Natif</div>
                <div className="text-sm font-extrabold text-slate-900">Comptabilité HTG &amp; USD</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Taux de change configuré par l&apos;établissement avec conversion transparente sur chaque facture.
                </p>
              </div>
              <div className="space-y-1 lg:px-6">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">02. Paiements Mobiles</div>
                <div className="text-sm font-extrabold text-slate-900">MonCash &amp; NatCash Directs</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Chaque école reçoit ses fonds sur son propre compte marchand avec rapprochement automatique.
                </p>
              </div>
              <div className="space-y-1 lg:px-6">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-700">03. Résilience Terrain</div>
                <div className="text-sm font-extrabold text-slate-900">Fonctionnement Hors-Ligne</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Poursuite des encaissements et de la saisie académique malgré les pannes d&apos;Internet.
                </p>
              </div>
              <div className="space-y-1 lg:pl-6">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">04. Multi-Niveaux</div>
                <div className="text-sm font-extrabold text-slate-900">Classique &amp; Universitaire</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Adapté de la maternelle au secondaire ainsi qu&apos;aux instituts supérieurs et facultés (LMD).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. NOS SPÉCIALITÉS D'EXCELLENCE — ARCHITECTURE ASYMÉTRIQUE BENTO */}
        <section id="specialites" className="scroll-mt-24 py-12 sm:py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-3xl space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                Architecture Métier &amp; Savoir-Faire
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight [text-wrap:balance]">
                Nos Spécialités d&apos;Excellence
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Chaque module a été pensé avec des directeurs, économes et secrétaires généraux en Haïti pour éliminer les erreurs de caisse, accélérer les délibérations et offrir une visibilité financière irréprochable.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Carte Vedette 1 : Économat Bidevise & Encaissements (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs grid grid-cols-1 md:grid-cols-12">
                <div className="md:col-span-7 p-6 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                      <Wallet size={14} />
                      <span>Économat &amp; Trésorerie</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                      Économat Bidevise &amp; Encaissements Sécurisés
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Contrôlez chaque gourde et chaque dollar. Le dossier individuel de l&apos;élève affiche exclusivement son contrat personnel et son reste à payer réel, tandis que la Direction dispose d&apos;une vue consolidée et des clôtures PDF quotidiennes.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-emerald-800">
                    <span>✓ Reçus infalsifiables</span>
                    <span>✓ Portefeuille élève dédié</span>
                    <span>✓ Campagnes &amp; Assurance</span>
                  </div>
                </div>
                <div className="md:col-span-5 relative min-h-[220px] bg-slate-100">
                  {!bursarImgFailed ? (
                    <picture className="block w-full h-full">
                      <source
                        type="image/avif"
                        srcSet="/optimized/bursar-mobile-480.avif 480w, /optimized/bursar-mobile-960.avif 960w"
                        sizes="(max-width: 768px) 100vw, 32vw"
                      />
                      <source
                        type="image/webp"
                        srcSet="/optimized/bursar-mobile-480.webp 480w, /optimized/bursar-mobile-960.webp 960w"
                        sizes="(max-width: 768px) 100vw, 32vw"
                      />
                      <img
                        src="/optimized/bursar-mobile-960.jpg"
                        srcSet="/optimized/bursar-mobile-480.jpg 480w, /optimized/bursar-mobile-960.jpg 960w"
                        sizes="(max-width: 768px) 100vw, 32vw"
                        alt="Confirmation de paiement scolaire mobile et reçu imprimé au guichet"
                        width={640}
                        height={427}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        onError={() => setBursarImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    </picture>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-50 text-emerald-700 p-6">
                      <Wallet size={36} />
                    </div>
                  )}
                </div>
              </div>

              {/* Carte Contraste Sombre : Résilience Hors-Ligne (5 cols) */}
              <div className="lg:col-span-5 bg-[#0B132B] text-slate-100 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between space-y-5 shadow-sm">
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Zap size={14} />
                    <span>Continuité Sans Faille</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-white leading-snug">
                    Conçu pour les Réalités Électriques et Réseau d&apos;Haïti
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Même en zone reculée à faible bande passante ou lors d&apos;une coupure Internet, votre guichet continue d&apos;encaisser et vos professeurs poursuivent la saisie des notes. Dès le retour de la connexion, le système réconcilie les données automatiquement.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs text-slate-300 font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                    <span>Chargement ultra-léger adapté aux réseaux mobiles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                    <span>Isolation multi-tenant stricte par établissement</span>
                  </div>
                </div>
              </div>

              {/* Carte 3 : Salaires, Vacataires & Pilotage (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between space-y-4 shadow-2xs">
                <div className="space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                    <Users size={14} />
                    <span>Ressources Humaines &amp; Direction</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                    Paie des Enseignants, Vacataires &amp; Tableaux de Bord
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Suivez les heures effectuées par vos professeurs vacataires, déduisez automatiquement les avances sur salaire consenties et imprimez les fiches de paie et décharges officielles en quelques secondes.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <BarChart3 size={14} className="text-indigo-600" />
                    Rapports consolidés pour la Direction
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNavigate('modules', 'payroll')}
                    className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer flex items-center gap-1"
                  >
                    <span>Explorer</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>

              {/* Carte Vedette 4 : Pédagogie, Bulletins & Université (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs grid grid-cols-1 md:grid-cols-12">
                <div className="md:col-span-5 relative min-h-[220px] bg-slate-100 order-2 md:order-1">
                  {!classroomImgFailed ? (
                    <picture className="block w-full h-full">
                      <source
                        type="image/avif"
                        srcSet="/optimized/classroom-excellence-480.avif 480w, /optimized/classroom-excellence-960.avif 960w"
                        sizes="(max-width: 768px) 100vw, 32vw"
                      />
                      <source
                        type="image/webp"
                        srcSet="/optimized/classroom-excellence-480.webp 480w, /optimized/classroom-excellence-960.webp 960w"
                        sizes="(max-width: 768px) 100vw, 32vw"
                      />
                      <img
                        src="/optimized/classroom-excellence-960.jpg"
                        srcSet="/optimized/classroom-excellence-480.jpg 480w, /optimized/classroom-excellence-960.jpg 960w"
                        sizes="(max-width: 768px) 100vw, 32vw"
                        alt="Élèves et enseignante en classe travaillant sur les programmes académiques"
                        width={640}
                        height={427}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        onError={() => setClassroomImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    </picture>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-700 p-6">
                      <GraduationCap size={36} />
                    </div>
                  )}
                </div>
                <div className="md:col-span-7 p-6 flex flex-col justify-between space-y-4 order-1 md:order-2">
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                      <GraduationCap size={14} />
                      <span>Pédagogie &amp; Enseignement Supérieur</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                      Bulletins Périodiques, Palmarès &amp; Crédits Universitaires
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Automatisez le calcul des moyennes, mentions et rangs de promotion. Gérez aussi bien les classes du MENFP (Maternelle au NS IV) que les facultés et instituts techniques avec reprise complète de vos fichiers Excel existants.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-indigo-700">✓ Migration Excel &amp; Formation incluses</span>
                    <button
                      type="button"
                      onClick={() => handleNavigate('demo')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
                    >
                      <span>Planifier une mise en place</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. MODULES MÉTIER INTERACTIFS (4 ONGLETS COMPLETS) */}
        <section id="modules" className="scroll-mt-24 py-12 sm:py-16 bg-white border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="text-center max-w-3xl mx-auto space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                Suite Modulaire Complète
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight [text-wrap:balance]">
                Modules de Gestion de l&apos;Établissement
              </h2>
              <p className="text-sm text-slate-600">
                Explorez chaque espace métier dédié à vos équipes administratives, pédagogiques et aux familles.
              </p>
            </div>

            {/* Sélecteur d'Onglets Segmenté Propre */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto max-w-full">
                <button
                  type="button"
                  onClick={() => setActiveTab('finance')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'finance'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <Wallet size={14} />
                  <span>Économat · Caisses</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('academic')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'academic'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <GraduationCap size={14} />
                  <span>Académique · Bulletins</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('payroll')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'payroll'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <Users size={14} />
                  <span>Administration · RH &amp; Paie</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('parents')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'parents'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <UserCheck size={14} />
                  <span>Portail Parents &amp; Élèves</span>
                </button>
              </div>
            </div>

            {/* Contenu du Module Actif */}
            <div className="bg-slate-50 rounded-2xl p-5 sm:p-8 border border-slate-200">
              {activeTab === 'finance' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Économat &amp; Caisses
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-950">
                      Gestion Financière Transparente, Bidevise et Auditée
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Chaque encaissement génère un reçu thermique ou A4 numéroté. Le solde de l&apos;élève est actualisé en direct au guichet ou via les paiements mobiles MonCash / NatCash, avec isolation stricte de la trésorerie de chaque école.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-700 pt-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        <span>Clôture quotidienne de caisse avec export PDF certifié</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        <span>Portefeuille élève protégé pour cantine et fournitures</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        <span>Conversion automatique HTG / USD selon le taux de l&apos;institution</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 space-y-2.5">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-b border-slate-100 pb-2">
                      <span>Derniers Règlements Certifiés</span>
                      <span className="text-emerald-700 font-mono">HTG &amp; USD</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-900">MonCash Direct · Reçu #4812</div>
                        <div className="text-slate-500 text-[11px]">Woodley A. · Terminale</div>
                      </div>
                      <div className="font-bold text-emerald-700 font-mono tabular-nums">+15 000 HTG</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-900">NatCash Direct · Reçu #4813</div>
                        <div className="text-slate-500 text-[11px]">Samantha D. · 9ème AF</div>
                      </div>
                      <div className="font-bold text-emerald-700 font-mono tabular-nums">+8 500 HTG</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'academic' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                      Pédagogie &amp; Bulletins
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-950">
                      Bulletins Périodiques, Relevés &amp; Dossiers Scolaires Complets
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Saisie unique des notes par matière : calcul instantané des coefficients, moyennes trimestrielles, rangs de classe et palmarès complets, avec suivi des pièces justificatives d&apos;admission et présences.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-700 pt-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />
                        <span>Fondamentale, Secondaire, Universités et Facultés (LMD)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />
                        <span>Impression groupée de toute la classe en PDF haute résolution</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />
                        <span>Contrôle réglementaire des dossiers et pièces d&apos;admission</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 space-y-2.5 text-xs">
                    <div className="font-bold text-slate-900 pb-2 border-b border-slate-100 flex justify-between">
                      <span>Bulletin 1ère Période · Exemple</span>
                      <span className="text-indigo-700 font-mono tabular-nums">Moyenne : 8.75 / 10</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                        <span className="font-medium text-slate-700">Mathématiques (Coef 4)</span>
                        <span className="font-mono tabular-nums font-bold text-slate-900">86 / 100</span>
                      </div>
                      <div className="flex justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                        <span className="font-medium text-slate-700">Français &amp; Littérature (Coef 4)</span>
                        <span className="font-mono tabular-nums font-bold text-slate-900">88 / 100</span>
                      </div>
                      <div className="flex justify-between p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 font-bold">
                        <span>Rang de Promotion</span>
                        <span>1er sur 38 élèves</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'payroll' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      Salaires &amp; RH
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-950">
                      Gestion Salariale Claire pour Titulaires et Vacataires
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Calcul automatique des salaires mensuels, pointage des heures réelles effectuées par les professeurs vacataires et retenue transparente des avances sur salaire accordées.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-700 pt-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-amber-600 shrink-0" />
                        <span>Fiches de paie et décharges imprimables en PDF</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-amber-600 shrink-0" />
                        <span>Suivi rigoureux des avances sur salaire et acomptes</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-amber-600 shrink-0" />
                        <span>Historique complet des versements par membre du personnel</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
                    <div className="font-bold text-slate-900 pb-2 border-b border-slate-100 flex justify-between">
                      <span>Fiche Enseignant</span>
                      <span className="text-amber-700 font-mono tabular-nums">Vacataire · 48h</span>
                    </div>
                    <div className="flex justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                      <span className="font-medium text-slate-700">Rémunération brute</span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">36 000 HTG</span>
                    </div>
                    <div className="flex justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-rose-700">
                      <span className="font-medium">Avance déduite</span>
                      <span className="font-mono tabular-nums font-bold">-5 000 HTG</span>
                    </div>
                    <div className="flex justify-between p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 font-bold">
                      <span>Net à Payer</span>
                      <span className="font-mono tabular-nums">31 000 HTG</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'parents' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Relation Familles &amp; Élèves
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-950">
                      Portail Parents &amp; Étudiants Accessible sur Smartphone
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Offrez aux parents et étudiants un accès sécurisé pour consulter l&apos;évolution des notes, vérifier leur relevé financier personnel exact et régler les frais scolaires à distance sans file d&apos;attente.
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-700 pt-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />
                        <span>Consultation des bulletins, présences et emplois du temps</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />
                        <span>Règlement sécurisé en ligne avec reçu téléchargeable</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />
                        <span>Notifications directes WhatsApp, SMS ou alertes intégrées</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 space-y-2.5 text-xs">
                    <div className="font-bold text-slate-900 pb-2 border-b border-slate-100 flex justify-between">
                      <span>Vue Famille · Dossier Individuel</span>
                      <span className="text-indigo-700 font-semibold">Synchronisé</span>
                    </div>
                    <div className="flex justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                      <span className="font-medium text-slate-700">Total scolarité annuelle</span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">61 500 HTG</span>
                    </div>
                    <div className="flex justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                      <span className="font-medium text-slate-700">Déjà versé par la famille</span>
                      <span className="font-mono tabular-nums font-bold text-emerald-700">59 000 HTG</span>
                    </div>
                    <div className="flex justify-between p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-950 font-bold">
                      <span>Reste à solder</span>
                      <span className="font-mono tabular-nums">2 500 HTG</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 5. SIMULATEUR D'ÉCONOMIES ANNUELLES */}
        <section id="roi" className="scroll-mt-24 py-12 sm:py-16 bg-slate-50 border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center max-w-3xl mx-auto space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center justify-center gap-1.5">
                <Calculator size={14} />
                <span>Calculateur Prévisionnel</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight [text-wrap:balance]">
                Simulateur d&apos;Économies Annuelles
              </h2>
              <p className="text-slate-600 text-sm">
                Estimez l&apos;amélioration du recouvrement et le temps administratif récupéré chaque mois pour votre établissement.
              </p>
            </div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-2xs">
              {/* Sliders */}
              <div className="space-y-5 flex flex-col justify-center">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">Effectif de l&apos;Établissement</span>
                    <span className="font-mono tabular-nums font-bold text-indigo-700 text-sm">{studentCount} élèves</span>
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
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                    <span>50</span>
                    <span>1 000</span>
                    <span>2 000+</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">Scolarité Annuelle Moyenne</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-700 text-sm">
                      {avgTuition.toLocaleString()} HTG
                    </span>
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
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                    <span>5 000 HTG</span>
                    <span>50 000 HTG</span>
                    <span>100 000 HTG</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">Taux Moyen de Retard de Paiement</span>
                    <span className="font-mono tabular-nums font-bold text-rose-700 text-sm">{unpaidRate}%</span>
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
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                    <span>5% (Faible)</span>
                    <span>25% (Moyen)</span>
                    <span>50% (Élevé)</span>
                  </div>
                </div>
              </div>

              {/* Résultats */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Impact Financier Projeté
                  </div>

                  <div>
                    <span className="text-xs text-slate-600 font-medium">Volume d&apos;échéances à régulariser :</span>
                    <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                      ~{currentUnpaidAmount.toLocaleString()} HTG
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 space-y-1">
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                      <TrendingUp size={14} /> Recouvrement Optimisé avec EduNova Pro :
                    </span>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono tabular-nums">
                      +{estimatedRecoveredAmount.toLocaleString()}{' '}
                      <span className="text-xs font-semibold text-slate-500">HTG</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Grâce aux paiements mobiles simplifiés et aux relances automatisées par WhatsApp et SMS.
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700">
                    <span>Temps administratif économisé :</span>
                    <span className="font-mono tabular-nums font-bold text-indigo-700">
                      +{hoursSavedPerMonth}h / mois
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleNavigate('demo')}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Optimiser la Trésorerie de mon École</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 6. TÉMOIGNAGES DES DIRECTEURS & ÉCONOMES */}
        <section id="testimonials" className="scroll-mt-24 py-12 sm:py-16 bg-white border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center max-w-3xl mx-auto space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                Retours Terrain
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight [text-wrap:balance]">
                La Confiance des Directeurs &amp; Économes
              </h2>
              <p className="text-slate-600 text-sm">
                Témoignages d&apos;établissements scolaires et instituts supérieurs accompagnés en Haïti.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <article className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-700">Encaissements Mobiles</span>
                    <div className="flex text-amber-500 gap-0.5" aria-label="Note 5 sur 5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={13} fill="currentColor" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    « Les rentrées scolaires se déroulent désormais dans le calme. Plus de 70% des parents règlent la scolarité par MonCash avec confirmation immédiate et reçu numéroté. »
                  </p>
                  <div className="text-xs font-bold text-emerald-700">
                    Résultat : +85% de recouvrement ponctuel
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-200 text-xs">
                  <div className="font-bold text-slate-950">Direction Pédagogique</div>
                  <div className="text-slate-500">Institution Privée · Port-au-Prince</div>
                </div>
              </article>

              <article className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-700">Économat Bidevise</span>
                    <div className="flex text-amber-500 gap-0.5" aria-label="Note 5 sur 5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={13} fill="currentColor" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    « La double monnaie HTG/USD et les clôtures de caisse quotidiennes apportent une clarté absolue. Zéro écart et transparence totale pour notre conseil d&apos;administration. »
                  </p>
                  <div className="text-xs font-bold text-indigo-700">
                    Résultat : Clôtures certifiées chaque soir
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-200 text-xs">
                  <div className="font-bold text-slate-950">Économe Principal</div>
                  <div className="text-slate-500">Collège Newton · Pétion-Ville</div>
                </div>
              </article>

              <article className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-700">Continuité Hors-Ligne</span>
                    <div className="flex text-amber-500 gap-0.5" aria-label="Note 5 sur 5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={13} fill="currentColor" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    « Le mode hors-ligne nous assure une sérénité remarquable. Même lors des coupures de courant, la saisie des notes et l&apos;édition des bulletins se poursuivent sans interruption. »
                  </p>
                  <div className="text-xs font-bold text-amber-700">
                    Résultat : Zéro arrêt de service administratif
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-200 text-xs">
                  <div className="font-bold text-slate-950">Secrétariat Général</div>
                  <div className="text-slate-500">Institut Supérieur · Cap-Haïtien</div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* 7. MISE EN SERVICE CLÉ EN MAIN & FORMULAIRE DE DÉMO */}
        <section id="demo" className="scroll-mt-24 py-12 sm:py-16 bg-slate-50 border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              {/* Colonne Engagements d'Accompagnement */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-6 bg-[#0B132B] text-slate-100 rounded-xl p-6">
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Déploiement Clé en Main
                  </div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight [text-wrap:balance]">
                    Planifiez votre Démo EduNova Pro
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Notre équipe configure la plateforme aux couleurs, classes et barèmes HTG/USD de votre établissement avant votre mise en production.
                  </p>

                  <ul className="space-y-3 pt-2 text-xs text-slate-200">
                    <li className="flex items-start gap-2.5">
                      <FileCheck2 size={16} className="text-amber-400 shrink-0 mt-0.5" />
                      <span>Reprise et importation soignée de vos listes d&apos;élèves et anciens soldes Excel</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Layers size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>Activation des passerelles de paiement propres à votre établissement</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <BookOpen size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                      <span>Formation pratique du directeur, de l&apos;économe et du secrétariat</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3 text-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Canaux Officiels de Réception
                  </div>
                  <div className="space-y-2">
                    <a
                      href={`https://wa.me/${contactConfig.whatsappNumber}?text=${encodeURIComponent('Bonjour EduNova Pro, je souhaite planifier une démonstration pour notre établissement.')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-colors group"
                    >
                      <span className="flex items-center gap-2 text-slate-300">
                        <MessageCircle size={14} className="text-emerald-400 shrink-0" />
                        <span>WhatsApp Direct</span>
                      </span>
                      <span className="font-mono font-bold text-white group-hover:text-emerald-300">
                        {contactConfig.whatsappDisplay}
                      </span>
                    </a>

                    <a
                      href={`mailto:${contactConfig.displayEmail}?subject=${encodeURIComponent('Demande de Démonstration EduNova Pro')}`}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-amber-400/50 transition-colors group gap-2"
                    >
                      <span className="flex items-center gap-2 text-slate-300 shrink-0">
                        <Mail size={14} className="text-amber-400 shrink-0" />
                        <span>Email Officiel</span>
                      </span>
                      <span className="font-mono font-bold text-white group-hover:text-amber-300 truncate">
                        {contactConfig.displayEmail}
                      </span>
                    </a>

                    <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-slate-400">
                      <span>Ligne Secrétariat Port-au-Prince</span>
                      <span className="font-mono text-slate-200 font-semibold">+509 {contactConfig.secondaryPhoneDisplay}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Colonne Formulaire */}
              <div ref={demoCardRef} className="lg:col-span-7 flex flex-col justify-center">
                {demoSubmitted && submissionResult ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="py-6 sm:py-7 px-5 sm:px-6 space-y-5 bg-emerald-50/70 rounded-xl border-2 border-emerald-300 shadow-xs"
                  >
                    <div className="text-center space-y-2.5">
                      <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm">
                        <CheckCircle2 size={26} />
                      </div>
                      <div className="inline-block px-3 py-1 rounded-full bg-white border border-emerald-200 text-[11px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
                        Demande Confirmée · Réf. {submissionResult.referenceCode}
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-950">
                        Merci {submissionResult.contactName} ! Votre demande de démo est confirmée.
                      </h3>
                      <p className="text-slate-700 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
                        Votre demande pour <strong className="text-slate-950">{submissionResult.schoolName}</strong> ({submissionResult.city}) a bien été enregistrée par l&apos;équipe EduNova Pro. Un conseiller vous contactera sous <strong className="text-emerald-800">24h ouvrées</strong> au <strong className="font-mono text-slate-950">{submissionResult.phone}</strong>{submissionResult.email ? ` ou à l'adresse ${submissionResult.email}` : ''}.
                      </p>
                    </div>

                    {/* Détail transparent des canaux de réception */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-semibold text-slate-800">
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          <span>Secrétariat EduNova Pro (Dossier enregistré)</span>
                        </span>
                        <span className="font-bold text-emerald-700">Confirmé</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-2 font-semibold text-slate-800">
                          <CheckCircle2
                            size={14}
                            className={submissionResult.delivery.emailSent ? 'text-emerald-600 shrink-0' : 'text-indigo-600 shrink-0'}
                          />
                          <span>Notification Email ({submissionResult.displayEmail})</span>
                        </span>
                        <span className={`font-bold ${submissionResult.delivery.emailSent ? 'text-emerald-700' : 'text-indigo-700'}`}>
                          {submissionResult.delivery.emailSent ? 'Email transmis' : 'Prêt pour envoi direct'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-2 font-semibold text-slate-800">
                          <MessageCircle size={14} className="text-emerald-600 shrink-0" />
                          <span>WhatsApp Direction ({submissionResult.whatsappDisplay})</span>
                        </span>
                        <span className="font-bold text-emerald-700">
                          {submissionResult.delivery.whatsappAutoSent ? 'Message envoyé' : 'Lien direct pré-rempli'}
                        </span>
                      </div>
                    </div>

                    {/* Actions directes pré-remplies avec TOUTES les infos */}
                    <div className="space-y-2">
                      <p className="text-[11px] text-center font-medium text-slate-500">
                        Souhaitez-vous démarrer la conversation immédiatement avec notre équipe ?
                      </p>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
                        <a
                          href={submissionResult.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs"
                        >
                          <MessageCircle size={15} />
                          <span>Confirmer aussi sur WhatsApp</span>
                        </a>

                        <a
                          href={submissionResult.mailtoUrl}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs"
                        >
                          <Mail size={15} />
                          <span>Écrire par Email ({submissionResult.displayEmail})</span>
                        </a>

                        <button
                          type="button"
                          onClick={handleCopyDemoSummary}
                          className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {copiedDemoMessage ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          <span>{copiedDemoMessage ? 'Copié' : 'Copier'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDemoSubmitted(false);
                          setSubmissionResult(null);
                          setSubmitError(null);
                          setFieldErrors({});
                          setTouchedFields({});
                          setSchoolName('');
                          setContactName('');
                          setPhone('');
                          setEmail('');
                          setNotes('');
                        }}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-950 underline cursor-pointer"
                      >
                        Soumettre une autre demande de démonstration
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleDemoSubmit} noValidate className="space-y-4">
                    {submitError && (
                      <div
                        role="alert"
                        className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2"
                      >
                        <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                        <span>{submitError}</span>
                      </div>
                    )}
                    {/* Honeypot anti-spam invisible */}
                    <input
                      type="text"
                      name="website"
                      value={honeypotWebsite}
                      onChange={(e) => setHoneypotWebsite(e.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      className="hidden"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label htmlFor="demo-school-name" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Building2 size={13} className="text-indigo-600" />
                          <span>Nom de l&apos;Établissement *</span>
                        </label>
                        <input
                          ref={schoolInputRef}
                          id="demo-school-name"
                          type="text"
                          required
                          minLength={3}
                          maxLength={160}
                          placeholder="Ex: Collège Sainte-Thérèse"
                          value={schoolName}
                          aria-invalid={Boolean(fieldErrors.schoolName)}
                          aria-describedby={fieldErrors.schoolName ? 'demo-school-name-error' : undefined}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSchoolName(val);
                            handleDemoFieldChange('schoolName', val);
                          }}
                          onBlur={() => handleDemoFieldBlur('schoolName')}
                          className={`w-full px-3.5 py-2.5 bg-white border rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 transition-colors ${
                            fieldErrors.schoolName
                              ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                              : 'border-slate-300 focus:ring-indigo-500/30 focus:border-indigo-600'
                          }`}
                        />
                        {fieldErrors.schoolName && (
                          <p id="demo-school-name-error" className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 pt-0.5">
                            <AlertCircle size={12} className="shrink-0" />
                            <span>{fieldErrors.schoolName}</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="demo-contact-name" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Users size={13} className="text-indigo-600" />
                          <span>Votre Nom &amp; Fonction *</span>
                        </label>
                        <input
                          ref={contactInputRef}
                          id="demo-contact-name"
                          type="text"
                          required
                          minLength={2}
                          maxLength={120}
                          placeholder="Ex: M. Jean (Directeur)"
                          value={contactName}
                          aria-invalid={Boolean(fieldErrors.contactName)}
                          aria-describedby={fieldErrors.contactName ? 'demo-contact-name-error' : undefined}
                          onChange={(e) => {
                            const val = e.target.value;
                            setContactName(val);
                            handleDemoFieldChange('contactName', val);
                          }}
                          onBlur={() => handleDemoFieldBlur('contactName')}
                          className={`w-full px-3.5 py-2.5 bg-white border rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 transition-colors ${
                            fieldErrors.contactName
                              ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                              : 'border-slate-300 focus:ring-indigo-500/30 focus:border-indigo-600'
                          }`}
                        />
                        {fieldErrors.contactName && (
                          <p id="demo-contact-name-error" className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 pt-0.5">
                            <AlertCircle size={12} className="shrink-0" />
                            <span>{fieldErrors.contactName}</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="demo-phone" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Phone size={13} className="text-emerald-600" />
                          <span>WhatsApp / Téléphone *</span>
                        </label>
                        <input
                          ref={phoneInputRef}
                          id="demo-phone"
                          type="tel"
                          inputMode="tel"
                          required
                          maxLength={50}
                          placeholder="+509 3604-5639"
                          value={phone}
                          aria-invalid={Boolean(fieldErrors.phone)}
                          aria-describedby={fieldErrors.phone ? 'demo-phone-error' : undefined}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPhone(val);
                            handleDemoFieldChange('phone', val);
                          }}
                          onBlur={() => handleDemoFieldBlur('phone')}
                          className={`w-full px-3.5 py-2.5 bg-white border rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 transition-colors ${
                            fieldErrors.phone
                              ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                              : 'border-slate-300 focus:ring-indigo-500/30 focus:border-indigo-600'
                          }`}
                        />
                        {fieldErrors.phone && (
                          <p id="demo-phone-error" className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 pt-0.5">
                            <AlertCircle size={12} className="shrink-0" />
                            <span>{fieldErrors.phone}</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="demo-email" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Mail size={13} className="text-indigo-600" />
                          <span>
                            Votre Email {preferredChannel === 'email' ? '*' : '(pour réponse écrite)'}
                          </span>
                        </label>
                        <input
                          ref={emailInputRef}
                          id="demo-email"
                          type="email"
                          inputMode="email"
                          required={preferredChannel === 'email'}
                          maxLength={160}
                          placeholder="direction@ecole.edu.ht"
                          value={email}
                          aria-invalid={Boolean(fieldErrors.email)}
                          aria-describedby={fieldErrors.email ? 'demo-email-error' : undefined}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmail(val);
                            handleDemoFieldChange('email', val);
                          }}
                          onBlur={() => handleDemoFieldBlur('email')}
                          className={`w-full px-3.5 py-2.5 bg-white border rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 transition-colors ${
                            fieldErrors.email
                              ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                              : 'border-slate-300 focus:ring-indigo-500/30 focus:border-indigo-600'
                          }`}
                        />
                        {fieldErrors.email && (
                          <p id="demo-email-error" className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 pt-0.5">
                            <AlertCircle size={12} className="shrink-0" />
                            <span>{fieldErrors.email}</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <MapPin size={13} className="text-indigo-600" />
                          <span>Ville / Commune</span>
                        </label>
                        <select
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-colors cursor-pointer"
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

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <GraduationCap size={13} className="text-indigo-600" />
                          <span>Type d&apos;Établissement</span>
                        </label>
                        <select
                          value={schoolType}
                          onChange={(e) => setSchoolType(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-colors cursor-pointer"
                        >
                          <option value="Fondamentale & Secondaire">Fondamentale &amp; Secondaire (Classique)</option>
                          <option value="Maternelle & Primaire">Maternelle &amp; Primaire</option>
                          <option value="Université & Faculté">Université &amp; Faculté (Supérieur)</option>
                          <option value="Institut Professionnel">Institut Professionnel &amp; Technique</option>
                          <option value="Réseau d'Écoles">Réseau d&apos;Écoles / Congrégation</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <School size={13} className="text-indigo-600" />
                          <span>Effectif Estimé</span>
                        </label>
                        <select
                          value={studentBracket}
                          onChange={(e) => setStudentBracket(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-colors cursor-pointer"
                        >
                          <option value="Moins de 150">Moins de 150 élèves</option>
                          <option value="150-350">150 à 350 élèves</option>
                          <option value="350-700">350 à 700 élèves</option>
                          <option value="700-1500">700 à 1 500 élèves</option>
                          <option value="Plus de 1500">Plus de 1 500 élèves</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="demo-preferred-channel" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <MessageCircle size={13} className="text-emerald-600" />
                          <span>Canal de Suivi Préféré</span>
                        </label>
                        <select
                          id="demo-preferred-channel"
                          value={preferredChannel}
                          onChange={(e) => {
                            const nextChannel = e.target.value as 'both' | 'whatsapp' | 'email';
                            setPreferredChannel(nextChannel);
                            if (touchedFields.email || fieldErrors.email || nextChannel === 'email') {
                              const emailErr = validateDemoField(
                                'email',
                                getDemoFormValues({ preferredChannel: nextChannel })
                              );
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                if (emailErr && (touchedFields.email || nextChannel !== 'email' ? Boolean(emailErr) : false)) {
                                  next.email = emailErr;
                                } else if (!emailErr) {
                                  delete next.email;
                                }
                                return next;
                              });
                            }
                          }}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-colors cursor-pointer"
                        >
                          <option value="both">Email &amp; WhatsApp (Recommandé)</option>
                          <option value="whatsapp">WhatsApp Direct ({contactConfig.whatsappDisplay})</option>
                          <option value="email">Email ({contactConfig.displayEmail})</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label htmlFor="demo-notes" className="text-xs font-bold text-slate-700">
                          Message ou besoins particuliers (optionnel)
                        </label>
                        {notes.length > 600 && (
                          <span className={`text-[11px] font-mono ${notes.trim().length > 800 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            {notes.trim().length}/800
                          </span>
                        )}
                      </div>
                      <textarea
                        ref={notesInputRef}
                        id="demo-notes"
                        rows={2}
                        maxLength={850}
                        placeholder="Ex: Reprise de 450 élèves sur Excel, activation des paiements MonCash/NatCash, multi-campus..."
                        value={notes}
                        aria-invalid={Boolean(fieldErrors.notes)}
                        aria-describedby={fieldErrors.notes ? 'demo-notes-error' : undefined}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNotes(val);
                          handleDemoFieldChange('notes', val);
                        }}
                        onBlur={() => handleDemoFieldBlur('notes')}
                        className={`w-full px-3.5 py-2 bg-white border rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 transition-colors resize-none ${
                          fieldErrors.notes
                            ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                            : 'border-slate-300 focus:ring-indigo-500/30 focus:border-indigo-600'
                        }`}
                      />
                      {fieldErrors.notes && (
                        <p id="demo-notes-error" className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 pt-0.5">
                          <AlertCircle size={12} className="shrink-0" />
                          <span>{fieldErrors.notes}</span>
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      {isSubmitting ? (
                        <span>Transmission de votre demande...</span>
                      ) : (
                        <>
                          <span>Envoyer ma Demande de Démonstration</span>
                          <Send size={14} />
                        </>
                      )}
                    </button>

                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500">
                        Réception sur <strong className="text-slate-700">{contactConfig.displayEmail}</strong> ou WhatsApp :
                      </span>
                      <a
                        href={`https://wa.me/${contactConfig.whatsappNumber}?text=${encodeURIComponent('Bonjour EduNova Pro, je souhaite des renseignements pour notre établissement.')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle size={14} />
                        <span>Écrire sur WhatsApp ({contactConfig.whatsappDisplay})</span>
                      </a>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 8. PREUVE SOCIALE & ÉTABLISSEMENTS PARTENAIRES */}
        <SocialProofSection />
      </main>

      {/* =========================================================================
          3. PIED DE PAGE INSTITUTIONNEL ÉPURÉ
         ========================================================================= */}
      <footer className="bg-[#070D1E] text-slate-300 border-t border-slate-800/80 pt-12 pb-8 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {/* Colonne 1 : Identité */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center">
                  <Logo size="sm" className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-base font-extrabold tracking-tight text-white leading-tight">
                    EduNova <span className="text-amber-400">Pro</span>
                  </div>
                  <div className="text-[11px] text-amber-300/90 font-medium italic">
                    « L&apos;Excellence Académique à votre Portée »
                  </div>
                </div>
              </div>

              <p className="text-slate-400 text-xs leading-relaxed">
                Plateforme de gestion scolaire, universitaire et financière conçue pour les réalités d&apos;Haïti : encaissements directs MonCash &amp; NatCash, bulletins périodiques et continuité hors-ligne.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <Facebook size={14} />
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <Instagram size={14} />
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <Linkedin size={14} />
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <Youtube size={14} />
                </a>
              </div>
            </div>

            {/* Colonne 2 : Domaines & Solutions Métier */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Domaines &amp; Modules
              </h4>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('modules', 'academic')}
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left"
                  >
                    Académique · Bulletins &amp; Palmarès
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('modules', 'parents')}
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left"
                  >
                    Académique · Portail Parents &amp; Étudiants
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('modules', 'finance')}
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left"
                  >
                    Économat · Caisses Bidevises (HTG &amp; USD)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('modules', 'finance')}
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left"
                  >
                    Économat · Encaissements Mobiles &amp; Guichet
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('modules', 'payroll')}
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left"
                  >
                    Administration · Salaires &amp; RH Enseignants
                  </button>
                </li>
              </ul>
            </div>

            {/* Colonne 3 : Services & Accompagnement */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Services &amp; Déploiement
              </h4>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('demo')}
                    className="text-amber-300 font-semibold hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Planifier une démonstration en ligne
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('roi')}
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left"
                  >
                    Simulateur d&apos;économies annuelles
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('specialites')}
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left"
                  >
                    Reprise &amp; Migration Excel
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('testimonials')}
                    className="hover:text-amber-300 transition-colors cursor-pointer text-left"
                  >
                    Témoignages d&apos;établissements
                  </button>
                </li>
              </ul>
            </div>

            {/* Colonne 4 : Secrétariat & Contact */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Secrétariat &amp; Contact
              </h4>
              <div className="space-y-3 text-slate-300 text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white">5, Christ-Roi, rue Acacia, prolongée</div>
                    <div className="text-[11px] text-slate-400">Port-au-Prince, Haïti</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Phone size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="font-mono tabular-nums space-y-0.5">
                    <a
                      href={`https://wa.me/${contactConfig.whatsappNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-white hover:text-amber-300 transition-colors block"
                    >
                      {contactConfig.whatsappDisplay}
                    </a>
                    <a
                      href="tel:+50933508416"
                      className="font-bold text-white hover:text-amber-300 transition-colors block"
                    >
                      +509 {contactConfig.secondaryPhoneDisplay}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Mail size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <a href={`mailto:${contactConfig.displayEmail}`} className="font-semibold text-white hover:text-amber-300">
                    {contactConfig.displayEmail}
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>© 2026 EduNova Pro · Tous droits réservés · République d&apos;Haïti</div>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => handleNavigate('specialites')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Mentions Légales
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('demo')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Confidentialité
              </button>
              <button
                type="button"
                onClick={onOpenLogin}
                onMouseEnter={onPreloadLogin}
                onFocus={onPreloadLogin}
                onTouchStart={onPreloadLogin}
                disabled={isOpeningLogin}
                className="text-amber-400 hover:text-amber-300 disabled:opacity-80 font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Lock size={12} />
                <span>{isOpeningLogin ? 'Ouverture...' : 'Portail Établissement'}</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Boutons Flottants Sobres (WhatsApp & Retour en Haut) */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-center gap-2.5">
        {scrolled && (
          <button
            type="button"
            onClick={scrollToTop}
            className="w-10 h-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 shadow-lg flex items-center justify-center transition-transform cursor-pointer hover:scale-105 edunova-fade-in"
            aria-label="Retour en haut de la page"
            title="Retour en haut"
          >
            <ArrowUp size={17} />
          </button>
        )}

        <a
          href={`https://wa.me/${contactConfig.whatsappNumber}?text=${encodeURIComponent('Bonjour EduNova Pro, je souhaite des informations pour notre établissement.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg flex items-center justify-center transition-transform cursor-pointer hover:scale-105"
          aria-label="Discuter sur WhatsApp"
          title={`Assistance WhatsApp directe (${contactConfig.whatsappDisplay})`}
        >
          <MessageCircle size={24} />
        </a>
      </div>
    </div>
  );
};

export default PublicLandingPage;
