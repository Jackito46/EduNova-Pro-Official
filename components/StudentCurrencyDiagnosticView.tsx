import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  DollarSign, 
  ShieldCheck, 
  AlertTriangle, 
  Receipt, 
  CheckCircle2, 
  Printer, 
  Copy, 
  Check, 
  ArrowLeft,
  ArrowRightLeft,
  Search,
  Sparkles,
  Calculator,
  Eye,
  FileCheck2,
  Calendar,
  X,
  Building2,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { supabase } from '../supabase';

interface StudentCurrencyDiagnosticViewProps {
  user?: UserProfile;
}

interface DiagnosticReceiptItem {
  date: string;
  ref: string;
  nature: string;
  rubrique: string;
  originalAmount: number;
  originalCurrency: string;
  rateApplied: number | null;
  scelleHTG: number;
  theoriqueHTG: number;
  ecartHTG: number;
  isToday?: boolean;
  status: 'VALIDE' | 'EN_COURS';
}

interface BenchmarkProfile {
  id: string;
  fullName: string;
  studentCode: string;
  class: string;
  usdFeeName: string;
  usdFeeTotal: number;
  paymentScenario: 'FULL_TODAY' | 'PARTIAL' | 'EXAM';
  description: string;
  receipts: DiagnosticReceiptItem[];
  fixedFees: {
    name: string;
    amount: number;
    paid: boolean;
    ref?: string;
    date?: string;
    isToday?: boolean;
  }[];
}

// Profils de référence révisés avec le scénario "Tout payé aujourd'hui"
const BENCHMARK_PROFILES: BenchmarkProfile[] = [
  {
    id: 'c3b12a55-d5d1-460b-8a7d-c8eed32a727c',
    fullName: 'AUGUSTIN Djenny',
    studentCode: 'AUG-2026-C3B1',
    class: 'NS II',
    usdFeeName: 'Frais Divers Obligatoires',
    usdFeeTotal: 200,
    paymentScenario: 'FULL_TODAY',
    description: 'Tout payé aujourd\'hui (100% Soldé • Quitus Validé)',
    receipts: [
      {
        date: '21/08/2026',
        ref: 'RCP-80221E37',
        nature: 'Inscription Administrative',
        rubrique: 'Inscription',
        originalAmount: 2500,
        originalCurrency: 'HTG',
        rateApplied: null,
        scelleHTG: 2500,
        theoriqueHTG: 2500,
        ecartHTG: 0,
        status: 'VALIDE'
      },
      {
        date: '21/08/2026',
        ref: 'RCP-2046B9E0',
        nature: 'Acompte Frais Divers ($80 USD)',
        rubrique: 'Frais Divers',
        originalAmount: 80,
        originalCurrency: 'USD',
        rateApplied: 140,
        scelleHTG: 11200,
        theoriqueHTG: 11840,
        ecartHTG: 640,
        status: 'VALIDE'
      },
      {
        date: '18/10/2026',
        ref: 'RCP-1ED06B5E',
        nature: 'Solde Frais Divers ($120 USD)',
        rubrique: 'Frais Divers',
        originalAmount: 120,
        originalCurrency: 'USD',
        rateApplied: 148,
        scelleHTG: 17760,
        theoriqueHTG: 17760,
        ecartHTG: 0,
        isToday: true,
        status: 'VALIDE'
      },
      {
        date: '18/10/2026',
        ref: 'RCP-5C899E10',
        nature: 'Scolarité Contrat Annuel (Intégrale)',
        rubrique: 'Scolarité',
        originalAmount: 65000,
        originalCurrency: 'HTG',
        rateApplied: null,
        scelleHTG: 65000,
        theoriqueHTG: 65000,
        ecartHTG: 0,
        isToday: true,
        status: 'VALIDE'
      },
      {
        date: '18/10/2026',
        ref: 'RCP-7D120B44',
        nature: 'Campagnes & Activités Parascolaires',
        rubrique: 'Campagnes',
        originalAmount: 2500,
        originalCurrency: 'HTG',
        rateApplied: null,
        scelleHTG: 2500,
        theoriqueHTG: 2500,
        ecartHTG: 0,
        isToday: true,
        status: 'VALIDE'
      }
    ],
    fixedFees: [
      { name: 'Inscription Administrative', amount: 2500, paid: true, ref: 'RCP-80221E37', date: '21/08/2026' },
      { name: 'Scolarité Contrat Annuel', amount: 65000, paid: true, ref: 'RCP-5C899E10', date: '18/10/2026', isToday: true },
      { name: 'Campagnes & Activités', amount: 2500, paid: true, ref: 'RCP-7D120B44', date: '18/10/2026', isToday: true }
    ]
  },
  {
    id: 'c3b12a55-d5d1-460b-8a7d-c8eed32a727c-partial',
    fullName: 'AUGUSTIN Djenny',
    studentCode: 'AUG-2026-C3B1',
    class: 'NS II',
    usdFeeName: 'Frais Divers Obligatoires',
    usdFeeTotal: 200,
    paymentScenario: 'PARTIAL',
    description: 'Paiement partiel (Scolarité 65 000 G en attente)',
    receipts: [
      {
        date: '21/08/2026',
        ref: 'RCP-80221E37',
        nature: 'Inscription Administrative',
        rubrique: 'Inscription',
        originalAmount: 2500,
        originalCurrency: 'HTG',
        rateApplied: null,
        scelleHTG: 2500,
        theoriqueHTG: 2500,
        ecartHTG: 0,
        status: 'VALIDE'
      },
      {
        date: '21/08/2026',
        ref: 'RCP-2046B9E0',
        nature: 'Acompte Frais Divers ($80 USD)',
        rubrique: 'Frais Divers',
        originalAmount: 80,
        originalCurrency: 'USD',
        rateApplied: 140,
        scelleHTG: 11200,
        theoriqueHTG: 11840,
        ecartHTG: 640,
        status: 'VALIDE'
      },
      {
        date: '18/10/2026',
        ref: 'RCP-1ED06B5E',
        nature: 'Solde Frais Divers ($120 USD)',
        rubrique: 'Frais Divers',
        originalAmount: 120,
        originalCurrency: 'USD',
        rateApplied: 148,
        scelleHTG: 17760,
        theoriqueHTG: 17760,
        ecartHTG: 0,
        isToday: true,
        status: 'VALIDE'
      },
      {
        date: '18/10/2026',
        ref: 'RCP-7D120B44',
        nature: 'Campagnes & Activités Parascolaires',
        rubrique: 'Campagnes',
        originalAmount: 2500,
        originalCurrency: 'HTG',
        rateApplied: null,
        scelleHTG: 2500,
        theoriqueHTG: 2500,
        ecartHTG: 0,
        isToday: true,
        status: 'VALIDE'
      }
    ],
    fixedFees: [
      { name: 'Inscription Administrative', amount: 2500, paid: true, ref: 'RCP-80221E37', date: '21/08/2026' },
      { name: 'Scolarité Contrat Annuel', amount: 65000, paid: false, ref: 'En attente' },
      { name: 'Campagnes & Activités', amount: 2500, paid: true, ref: 'RCP-7D120B44', date: '18/10/2026', isToday: true }
    ]
  },
  {
    id: '4a2b1c3d-9988-7766-5544-33221100aabb',
    fullName: 'JEAN-BAPTISTE Peterson',
    studentCode: 'JBP-2026-4A2B',
    class: 'Philo',
    usdFeeName: 'Frais d\'Examen d\'État & Diplôme',
    usdFeeTotal: 150,
    paymentScenario: 'EXAM',
    description: 'Dossier Peterson (Philo - Frais d\'Examen État)',
    receipts: [
      {
        date: '15/09/2026',
        ref: 'RCP-110099AA',
        nature: 'Inscription Administrative',
        rubrique: 'Inscription',
        originalAmount: 3000,
        originalCurrency: 'HTG',
        rateApplied: null,
        scelleHTG: 3000,
        theoriqueHTG: 3000,
        ecartHTG: 0,
        status: 'VALIDE'
      },
      {
        date: '15/09/2026',
        ref: 'RCP-3312A8C1',
        nature: 'Acompte Frais Examen ($50 USD)',
        rubrique: 'Frais Examen',
        originalAmount: 50,
        originalCurrency: 'USD',
        rateApplied: 135,
        scelleHTG: 6750,
        theoriqueHTG: 7400,
        ecartHTG: 650,
        status: 'VALIDE'
      },
      {
        date: '18/10/2026',
        ref: 'RCP-7744D2F9',
        nature: 'Solde Examen ($100 USD)',
        rubrique: 'Frais Examen',
        originalAmount: 100,
        originalCurrency: 'USD',
        rateApplied: 148,
        scelleHTG: 14800,
        theoriqueHTG: 14800,
        ecartHTG: 0,
        isToday: true,
        status: 'VALIDE'
      }
    ],
    fixedFees: [
      { name: 'Inscription Administrative', amount: 3000, paid: true, ref: 'RCP-110099AA', date: '15/09/2026' },
      { name: 'Scolarité Contrat Annuel', amount: 75000, paid: false, ref: 'En attente' }
    ]
  }
];

export const StudentCurrencyDiagnosticView: React.FC<StudentCurrencyDiagnosticViewProps> = ({ user }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { school, activeAcademicYear } = useSchool();

  const [activeTab, setActiveTab] = useState<'all' | 'compare' | 'receipts' | 'rules' | 'simulator'>('all');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    searchParams.get('student_id') || BENCHMARK_PROFILES[0].id
  );

  const [exchangeRate, setExchangeRate] = useState<number>(148);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQuitusModal, setShowQuitusModal] = useState<boolean>(false);

  // Recherche dynamique d'élèves réels
  const [dbSearchTerm, setDbSearchTerm] = useState<string>('');
  const [dbStudents, setDbStudents] = useState<any[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState<boolean>(false);

  // Simulateur rapide
  const [simUsdTarget, setSimUsdTarget] = useState<number>(200);
  const [simPayment1USD, setSimPayment1USD] = useState<number>(80);
  const [simPayment1Rate, setSimPayment1Rate] = useState<number>(140);

  // Recherche dans la base
  useEffect(() => {
    if (!dbSearchTerm.trim() || dbSearchTerm.trim().length < 2) {
      setDbStudents([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingDb(true);
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, first_name, last_name, class:classes(name)')
          .or(`first_name.ilike.%${dbSearchTerm}%,last_name.ilike.%${dbSearchTerm}%`)
          .limit(5);

        if (!error && data) {
          setDbStudents(data);
        }
      } catch (err) {
        console.warn("Recherche élève:", err);
      } finally {
        setIsSearchingDb(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [dbSearchTerm]);

  // Profil actif
  const currentProfile = useMemo(() => {
    if (selectedProfileId) {
      const found = BENCHMARK_PROFILES.find(p => 
        p.id.toLowerCase() === selectedProfileId.toLowerCase() ||
        p.id.toLowerCase().startsWith(selectedProfileId.toLowerCase()) ||
        selectedProfileId.toLowerCase().startsWith(p.id.toLowerCase())
      );
      if (found) return found;
    }
    return BENCHMARK_PROFILES[0];
  }, [selectedProfileId]);

  const tauxActuel = exchangeRate > 0 ? exchangeRate : 148;
  const isFullyPaid = currentProfile.paymentScenario === 'FULL_TODAY';

  // Calculs scellés réels
  const receipts = currentProfile.receipts;

  const hasPaidCampaign = currentProfile.fixedFees.some(f => (f.name.toLowerCase().includes('campagne') || f.name.toLowerCase().includes('activité')) && f.paid) ||
    receipts.some(r => r.rubrique === 'Campagnes' || r.nature.toLowerCase().includes('campagne'));

  // Calculs financiers
  const totalTheoriqueFraisUSD = currentProfile.usdFeeTotal * tauxActuel;
  const totalFixeHTG = currentProfile.fixedFees.reduce((acc, f) => acc + f.amount, 0);
  const totalDuTheoriqueGlobal = totalFixeHTG + totalTheoriqueFraisUSD;

  const totalScelleReelGlobal = receipts.reduce((acc, r) => acc + r.scelleHTG, 0);
  const totalTheoriqueReconduit = receipts.reduce((acc, r) => acc + r.theoriqueHTG, 0);
  const totalEcartChangeAbsorbe = totalTheoriqueReconduit - totalScelleReelGlobal;

  // Total exigible selon engagement contractuel
  const totalEngagementReelDu = totalFixeHTG + receipts
    .filter(r => r.rubrique === currentProfile.usdFeeName || r.originalCurrency === 'USD')
    .reduce((acc, r) => acc + r.scelleHTG, 0);

  // Solde restant réel de l'élève
  const soldeRestantReelEleve = Math.max(0, totalEngagementReelDu - totalScelleReelGlobal);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copié dans le presse-papier");
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const institutionName = school?.name || (school as any)?.school_name || 'Collège des Innovations';

  return (
    <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 pb-12 animate-in fade-in duration-200">
      
      {/* 1. TOP BAR : NAVIGATION, SÉLECTEUR & ACTIONS */}
      <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <button 
            type="button" 
            onClick={() => navigate('/economat')} 
            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Retour à l'Économat"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="h-4 w-px bg-slate-200 shrink-0" />
          <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
              Audit Devise & Quitus
            </span>
            <span className="text-xs font-bold text-slate-900 truncate">
              {currentProfile.fullName} ({currentProfile.class})
            </span>
            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {currentProfile.studentCode}
            </span>
            {isFullyPaid ? (
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 size={11} className="text-emerald-700" />
                Tout Payé Aujourd'hui (Soldé 100%)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider border border-amber-300">
                Paiement Partiel
              </span>
            )}
            {hasPaidCampaign && (
              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[10px] font-black uppercase tracking-wider border border-purple-300 flex items-center gap-1">
                <Sparkles size={11} className="text-purple-700" />
                Campagne Réglée (RCP-7D120B44)
              </span>
            )}
          </div>
        </div>

        {/* SELECTEUR CAS ÉTUDE + ACTIONS */}
        <div className="flex items-center gap-1.5 self-end lg:self-center shrink-0 flex-wrap">
          <select
            value={selectedProfileId}
            onChange={(e) => {
              setSelectedProfileId(e.target.value);
              toast.info("Dossier actualisé");
            }}
            className="text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl px-2.5 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {BENCHMARK_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} ({p.class}) — {p.description}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowQuitusModal(true)}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Délivrer et imprimer le Quitus Officiel"
          >
            <FileText size={13} />
            <span>Quitus Officiel</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy(window.location.href, 'link')}
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer"
            title="Copier le lien d'audit"
          >
            {copiedKey === 'link' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Imprimer</span>
          </button>
        </div>
      </div>

      {/* 2. BANDEAU COMPACT : TAUX DU JOUR & STATUT DIRECT */}
      <div className="bg-slate-950 text-white rounded-2xl p-3.5 sm:p-4 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-300/30 px-2 py-0.5 rounded-md">
              Session {activeAcademicYear?.label || '2025-2026'}
            </span>
            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-md flex items-center gap-1">
              <CheckCircle2 size={11} /> Barème ${currentProfile.usdFeeTotal}.00 USD Honoré (100%)
            </span>
            {hasPaidCampaign && (
              <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Sparkles size={11} className="text-purple-300" />
                Frais Campagnes Détectés (2 500 HTG Soldés)
              </span>
            )}
            {isFullyPaid && (
              <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-md">
                Scolarité Soldée le 18/10/2026
              </span>
            )}
          </div>
          <h1 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
            <span>Diagnostic : Barème USD vs Engagement Scellé</span>
          </h1>
          <p className="text-xs text-slate-300">
            {isFullyPaid 
              ? "Élève intégralement en règle : totalité des rubriques réglée à date."
              : "Suivi des encaissements échelonnés et arbitrage sur le taux de change."}
          </p>
        </div>

        {/* CONTROLE DU TAUX DIRECT */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 sm:p-2.5 border border-white/15 flex items-center gap-2 shrink-0 self-start md:self-center">
          <span className="text-[11px] font-bold text-slate-300">Taux du Jour :</span>
          <div className="flex items-center gap-1">
            {[140, 145, 148].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setExchangeRate(t)}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  exchangeRate === t 
                    ? 'bg-amber-400 text-slate-950 shadow-2xs' 
                    : 'bg-white/5 hover:bg-white/15 text-slate-300'
                }`}
              >
                {t} G
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 pl-1 border-l border-white/15">
            <input 
              type="number" 
              value={exchangeRate} 
              onChange={(e) => setExchangeRate(Number(e.target.value) || 148)}
              className="w-14 bg-black/40 border border-white/20 rounded-md px-1.5 py-0.5 text-xs font-mono font-bold text-amber-300 text-center"
              min={100}
              max={250}
            />
            <span className="text-[10px] text-slate-400 font-mono">HTG</span>
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION PAR ONGLETS */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'Vue Complète', icon: Eye },
          { id: 'compare', label: 'Comparatif 1:1', icon: ArrowRightLeft },
          { id: 'receipts', label: `Reçus Scellés (${receipts.length})`, icon: Receipt },
          { id: 'rules', label: 'Arbitrage Légal & Quitus', icon: FileCheck2 },
          { id: 'simulator', label: 'Simulateur de Change', icon: Calculator },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive 
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-indigo-600' : 'text-slate-500'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. KPIS SCELLÉS RÉVISÉS POUR L'ÉLÈVE */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        
        {/* KPI 1 : THÉORIQUE BARÈME */}
        <div className="p-3 rounded-xl border bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              1. Théorique (Barème USD)
            </span>
            <DollarSign size={14} className="text-blue-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-blue-900">
              {totalDuTheoriqueGlobal.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-slate-500">HTG</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            Dont ${currentProfile.usdFeeTotal} USD @ {tauxActuel} G = {totalTheoriqueFraisUSD.toLocaleString()} G
          </p>
        </div>

        {/* KPI 2 : ENGAGEMENT RÉEL */}
        <div className="p-3 rounded-xl border bg-emerald-50/60 border-emerald-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
              2. Engagement Réel Scellé
            </span>
            <ShieldCheck size={14} className="text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-950">
              {totalEngagementReelDu.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-emerald-700">HTG</span>
          </div>
          <p className="text-[10px] text-emerald-800 mt-0.5 truncate font-medium">
            Certifié sur {receipts.length} reçus officiels
          </p>
        </div>

        {/* KPI 3 : ÉCART ABSORBÉ */}
        <div className="p-3 rounded-xl border bg-amber-50/70 border-amber-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">
              3. Écart Absorbé École
            </span>
            <AlertTriangle size={14} className="text-amber-700" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-900">
              +{totalEcartChangeAbsorbe.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-amber-700">HTG</span>
          </div>
          <p className="text-[10px] text-amber-800 mt-0.5 truncate font-semibold">
            Pris en charge par l'école (0 G dû par l'élève)
          </p>
        </div>

        {/* KPI 4 : RESTE DÛ RÉEL ÉLÈVE */}
        <div className={`p-3 rounded-xl border shadow-2xs transition-all ${
          soldeRestantReelEleve === 0 
            ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20' 
            : 'bg-rose-50 border-rose-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              soldeRestantReelEleve === 0 ? 'text-emerald-800' : 'text-rose-800'
            }`}>
              4. Reste Dû Réel Élève
            </span>
            {soldeRestantReelEleve === 0 ? (
              <CheckCircle2 size={16} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={16} className="text-rose-600" />
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl sm:text-2xl font-black font-mono ${
              soldeRestantReelEleve === 0 ? 'text-emerald-950' : 'text-rose-950'
            }`}>
              {soldeRestantReelEleve.toLocaleString()}
            </span>
            <span className={`text-[11px] font-bold ${
              soldeRestantReelEleve === 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>HTG</span>
          </div>
          <p className={`text-[10px] mt-0.5 font-bold truncate ${
            soldeRestantReelEleve === 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {soldeRestantReelEleve === 0 
              ? 'Dossier 100% Soldé • Quitus Validé' 
              : 'Solde scolarité en cours'}
          </p>
        </div>
      </div>

      {/* 5. VUE COMPARATIF 1:1 DIRECTE (SANS PARAGRAPHES VERBEUX) */}
      {(activeTab === 'all' || activeTab === 'compare') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          
          {/* BARÈME THÉORIQUE */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <DollarSign size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">
                    Calcul Théorique (Barème Taux du Jour)
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">1 USD = {tauxActuel} HTG</span>
                </div>
              </div>
              <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                ${currentProfile.usdFeeTotal}.00 USD
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Contre-valeur {currentProfile.usdFeeName} :</span>
                <span className="font-mono font-bold text-blue-900">{totalTheoriqueFraisUSD.toLocaleString()} HTG</span>
              </div>
              {currentProfile.fixedFees.map((fee, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5 text-slate-600 text-[11px]">
                  <span>• {fee.name} :</span>
                  <span className="font-mono text-slate-900 font-medium">{fee.amount.toLocaleString()} HTG</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-gradient-to-br from-blue-700 to-indigo-800 text-white rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-200 block">Total Dû Théorique</span>
                <span className="text-xl sm:text-2xl font-black font-mono">{totalDuTheoriqueGlobal.toLocaleString()} G</span>
              </div>
              <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">
                Indexé au Jour
              </span>
            </div>
          </div>

          {/* ENGAGEMENT RÉELLEMENT SCELLÉ */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-emerald-300 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">
                    Engagement Réellement Enregistré
                  </h3>
                  <span className="text-[10px] text-emerald-700 font-semibold">{receipts.length} Reçus Légaux Scellés</span>
                </div>
              </div>
              <span className="font-mono text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                Légalement Libératoire
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Montant Scellé {currentProfile.usdFeeName} :</span>
                <span className="font-mono font-bold text-emerald-800">
                  {receipts.filter(r => r.rubrique === 'Frais Divers' || r.rubrique === 'Frais Examen').reduce((acc, r) => acc + r.scelleHTG, 0).toLocaleString()} HTG
                </span>
              </div>
              {currentProfile.fixedFees.map((fee, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5 text-slate-600 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span>• {fee.name} :</span>
                    {fee.isToday && (
                      <span className="px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[9px] font-black uppercase">
                        Aujourd'hui
                      </span>
                    )}
                  </span>
                  <span className={`font-mono font-bold ${fee.paid ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {fee.amount.toLocaleString()} HTG {fee.paid ? '(Réglé)' : '(En attente)'}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-200 block">Total Dû Engagement</span>
                <span className="text-xl sm:text-2xl font-black font-mono">{totalEngagementReelDu.toLocaleString()} G</span>
              </div>
              <span className="text-xs font-black bg-white text-emerald-900 px-2.5 py-1 rounded-lg shadow-2xs">
                Actif & Faisant Foi
              </span>
            </div>
          </div>

        </div>
      )}

      {/* 6. TABLEAU COMPLET DES REÇUS SCELLÉS (TOUTES RUBRIQUES ENCAISSÉES) */}
      {(activeTab === 'all' || activeTab === 'receipts') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-indigo-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                Audit des Reçus Numérotés & Valeurs Scellées
              </h3>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                {receipts.length} transactions
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
                Total Encaissé : {totalScelleReelGlobal.toLocaleString()} HTG
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Reçu #</th>
                  <th className="py-2 px-3">Rubrique</th>
                  <th className="py-2 px-3">Montant Encaissé</th>
                  <th className="py-2 px-3">Taux Scellé</th>
                  <th className="py-2 px-3 text-right">Valeur Scellée</th>
                  <th className="py-2 px-3 text-right">Valeur @ {tauxActuel} G</th>
                  <th className="py-2 px-3 text-right">Écart</th>
                  <th className="py-2 px-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((r, idx) => (
                  <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${r.isToday ? 'bg-emerald-50/30' : ''}`}>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">{r.date}</span>
                        {r.isToday && (
                          <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[9px] font-black uppercase">
                            Aujourd'hui
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-200">
                        {r.ref}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 block">{r.nature}</span>
                      <span className="text-[10px] text-slate-400">{r.rubrique}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                      {r.originalCurrency === 'USD' 
                        ? `$${r.originalAmount}.00 USD` 
                        : `${r.originalAmount.toLocaleString()} HTG`}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {r.rateApplied ? `${r.rateApplied} HTG` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                      {r.scelleHTG.toLocaleString()} G
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {r.theoriqueHTG.toLocaleString()} G
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                      r.ecartHTG > 0 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {r.ecartHTG > 0 ? `+${r.ecartHTG.toLocaleString()} G` : '0 G'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Acquitté
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900 text-xs">
                  <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px] text-slate-500">
                    Total Certifié Encaissé :
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800 text-sm">
                    {totalScelleReelGlobal.toLocaleString()} HTG
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {totalTheoriqueReconduit.toLocaleString()} HTG
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                    +{totalEcartChangeAbsorbe.toLocaleString()} HTG
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-[10px] font-black text-emerald-700 uppercase">
                      {isFullyPaid ? '100% Soldé' : 'Solde Actif'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 7. DÉCISION D'ARBITRAGE & QUITUS (DIRECTE, CLAIRE, SANS VERBIAGE) */}
      {(activeTab === 'all' || activeTab === 'rules') && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-md border border-slate-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <FileCheck2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  Décision d'Arbitrage Comptable & Valeur Libératoire
                </h3>
                <p className="text-xs text-slate-400">
                  Application de la force libératoire des reçus officiels scellés
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQuitusModal(true)}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 size={14} />
                <span>Générer le Quitus Officiel</span>
              </button>
            </div>
          </div>

          {/* 3 Cartes Décisionnelles directes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                1. Reçu Scellé Fait Foi
              </span>
              <p className="text-slate-300 text-xs font-medium">
                L'obligation de <strong>${currentProfile.usdFeeTotal}.00 USD</strong> est acquittée à 100%. Les montants scellés sur les reçus éteignent la dette.
              </p>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                2. Écart de Change (+{totalEcartChangeAbsorbe} G)
              </span>
              <p className="text-slate-300 text-xs font-medium">
                Différentiel absorbé par l'établissement au compte de variation de devises. Aucune réclamation imputable à la famille.
              </p>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-400 block tracking-wider">
                3. Statut Quitus
              </span>
              <p className="text-slate-300 text-xs font-medium">
                {isFullyPaid 
                  ? "Dossier 100% soldé : Quitus d'examen et bulletin annuel immédiatement délivrables."
                  : `Solde scolarité en cours : ${soldeRestantReelEleve.toLocaleString()} HTG.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 8. SIMULATEUR RAPIDE DE CHANGE */}
      {(activeTab === 'all' || activeTab === 'simulator') && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-indigo-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                Simulateur de Change Rapide
              </h3>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              Outil Économat
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Barème Fixé (USD) :</label>
              <input
                type="number"
                value={simUsdTarget}
                onChange={(e) => setSimUsdTarget(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Acompte Devises (USD) :</label>
              <input
                type="number"
                value={simPayment1USD}
                onChange={(e) => setSimPayment1USD(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Taux Historique Acompte :</label>
              <input
                type="number"
                value={simPayment1Rate}
                onChange={(e) => setSimPayment1Rate(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-700 font-medium">Écart de change sur acompte :</span>
            <span className="font-mono font-black text-amber-800 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-300">
              +{(simPayment1USD * (tauxActuel - simPayment1Rate)).toLocaleString()} HTG absorbé
            </span>
          </div>
        </div>
      )}

      {/* MODAL DU QUITUS FINANCIER OFFICIEL */}
      {showQuitusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Quitus Financier Officiel & Décharge de Clôture
                  </h3>
                  <p className="text-xs text-slate-500">{institutionName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuitusModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* DOCUMENT OFFICIEL D'ATTESTATION */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 space-y-3 text-xs text-slate-800">
              <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                <div>
                  <p className="font-bold text-sm text-slate-900 uppercase tracking-tight">{institutionName}</p>
                  <p className="text-[11px] text-slate-500">Direction de l'Économat & Comptabilité</p>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <p className="font-bold">QUITUS #{Date.now().toString().substring(5)}</p>
                  <p className="text-slate-500">{new Date().toLocaleDateString('fr-FR')}</p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                <p>Élève : <strong className="text-slate-900">{currentProfile.fullName}</strong></p>
                <p>Classe : <strong className="text-slate-900">{currentProfile.class}</strong> • Code : <strong className="font-mono text-slate-900">{currentProfile.studentCode}</strong></p>
                <p>Session Académique : <strong className="text-slate-900">{activeAcademicYear?.label || '2025-2026'}</strong></p>
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-slate-900 text-xs">Récapitulatif des règlements scellés :</p>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden bg-white text-[11px]">
                  {receipts.map((r, i) => (
                    <div key={i} className="p-2 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-900">{r.ref}</span>
                        <span className="text-slate-500 ml-2">({r.date}) — {r.nature}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">{r.scelleHTG.toLocaleString()} HTG</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-300 flex items-center justify-between text-emerald-900">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider block">Total Encaissé</span>
                  <span className="text-base font-black font-mono">{totalScelleReelGlobal.toLocaleString()} HTG</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-black tracking-wider block">Solde Restant Dû</span>
                  <span className="text-base font-black font-mono">
                    {soldeRestantReelEleve === 0 ? '0 HTG (SOLDÉ)' : `${soldeRestantReelEleve.toLocaleString()} HTG`}
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-600 leading-normal border-t border-slate-200">
                <p>
                  Attestation délivrée pour servir et valoir ce que de droit, certifiant que l'élève est en règle avec l'économat de l'établissement pour la session en cours.
                </p>
              </div>

              <div className="pt-4 flex justify-between items-center text-[10px] text-slate-400">
                <span>Cachet de l'Économat</span>
                <span>Signature de la Direction</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowQuitusModal(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer size={14} />
                <span>Imprimer le Quitus</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentCurrencyDiagnosticView;
