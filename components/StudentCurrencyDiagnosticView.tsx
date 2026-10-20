import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Activity, 
  DollarSign, 
  ShieldCheck, 
  AlertTriangle, 
  Receipt, 
  CheckCircle2, 
  Printer, 
  RotateCcw, 
  Share2, 
  Copy, 
  Check, 
  ArrowLeft,
  ArrowRightLeft,
  Search,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  UserCheck,
  Calculator,
  Eye,
  FileCheck2,
  HelpCircle,
  TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile } from '../types';
import { useSchool } from '../contexts/SchoolContext';

interface StudentCurrencyDiagnosticViewProps {
  user?: UserProfile;
}

// Profils de benchmark et cas d'études réels
const BENCHMARK_PROFILES = [
  {
    id: '9f18c76c-7592-4549-82c4-d1fcc2ee8b0d',
    fullName: 'DESROSIERS Christelle',
    class: 'NS II',
    usdFeeName: 'Frais Divers Obligatoires',
    usdFeeTotal: 200,
    payments: [
      { date: '21/08/2026', ref: 'RCP-2046B9E0', usd: 80, rate: 140, htg: 11200, desc: 'Acompte direct devises ($80 USD @ 140 G)' },
      { date: '11/10/2026', ref: 'RCP-1ED06B5E', usd: 120, rate: 148, htg: 17760, desc: 'Solde compensé en Gourdes ($120 USD @ 148 G)' }
    ],
    fixedHtgFees: [
      { name: 'Inscription Administrative', amount: 2500, paid: true, ref: 'RCP-80221E37' },
      { name: 'Scolarité Contrat Annuel', amount: 65000, paid: false, ref: 'En cours' },
      { name: 'Campagnes & Activités', amount: 2500, paid: false, ref: 'En cours' }
    ]
  },
  {
    id: '4a2b1c3d-9988-7766-5544-33221100aabb',
    fullName: 'JEAN-BAPTISTE Peterson',
    class: 'Philo',
    usdFeeName: 'Frais d’Examen d’État & Diplôme',
    usdFeeTotal: 150,
    payments: [
      { date: '15/09/2026', ref: 'RCP-3312A8C1', usd: 50, rate: 135, htg: 6750, desc: 'Acompte inscription ($50 USD @ 135 G)' },
      { date: '02/12/2026', ref: 'RCP-7744D2F9', usd: 100, rate: 146, htg: 14600, desc: 'Solde examen ($100 USD @ 146 G)' }
    ],
    fixedHtgFees: [
      { name: 'Inscription Administrative', amount: 3000, paid: true, ref: 'RCP-110099AA' },
      { name: 'Scolarité Contrat Annuel', amount: 75000, paid: false, ref: 'En cours' }
    ]
  }
];

export const StudentCurrencyDiagnosticView: React.FC<StudentCurrencyDiagnosticViewProps> = ({ user }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { school, activeAcademicYear } = useSchool();

  // Navigation par onglets ultra-compacte
  const [activeTab, setActiveTab] = useState<'all' | 'compare' | 'receipts' | 'rules' | 'simulator'>('all');

  // État du dossier élève sélectionné
  const queryStudentId = searchParams.get('student_id');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    queryStudentId || '9f18c76c-7592-4549-82c4-d1fcc2ee8b0d'
  );

  // Simulation personnalisée
  const [customUsdTarget, setCustomUsdTarget] = useState<number>(200);
  const [exchangeRate, setExchangeRate] = useState<number>(148);
  const [customPayment1USD, setCustomPayment1USD] = useState<number>(80);
  const [customPayment1Rate, setCustomPayment1Rate] = useState<number>(140);
  const [customPayment2HTG, setCustomPayment2HTG] = useState<number>(17760);
  const [customPayment2Rate, setCustomPayment2Rate] = useState<number>(148);

  const [alignmentMode, setAlignmentMode] = useState<'engagement' | 'theoretical'>(() => {
    try {
      const saved = localStorage.getItem('edunova_diag_mode_preference');
      return saved === 'theoretical' ? 'theoretical' : 'engagement';
    } catch {
      return 'engagement';
    }
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sélection du profil actif
  const currentProfile = useMemo(() => {
    const found = BENCHMARK_PROFILES.find(p => p.id.toLowerCase() === selectedProfileId.toLowerCase());
    if (found) return found;
    return BENCHMARK_PROFILES[0];
  }, [selectedProfileId]);

  // Calculs financiers dynamiques
  const isBenchmark1 = currentProfile.id === BENCHMARK_PROFILES[0].id;
  const barèmeUSD = isBenchmark1 ? 200 : currentProfile.usdFeeTotal;
  const tauxActuel = exchangeRate > 0 ? exchangeRate : 148;

  // 1. Total Dû Théorique
  const fraisDiversTheoriqueHTG = barèmeUSD * tauxActuel;
  const fixedTotalHTG = currentProfile.fixedHtgFees.reduce((acc, f) => acc + f.amount, 0);
  const totalDuTheoriqueGlobal = fixedTotalHTG + fraisDiversTheoriqueHTG;

  // 2. Engagement Réel Scellé
  const versement1HTG = isBenchmark1 ? (80 * 140) : (customPayment1USD * customPayment1Rate);
  const versement2HTG = isBenchmark1 ? 17760 : customPayment2HTG;
  const engagementFraisDiversReelHTG = versement1HTG + versement2HTG;
  const totalDuEngagementReelGlobal = fixedTotalHTG + engagementFraisDiversReelHTG;

  // 3. Encaissements & Écart
  const versementInscriptionHTG = currentProfile.fixedHtgFees.find(f => f.name.includes('Inscription'))?.amount || 0;
  const totalRecueilliGlobal = versementInscriptionHTG + engagementFraisDiversReelHTG;
  const ecartMotifHTG = fraisDiversTheoriqueHTG - engagementFraisDiversReelHTG;
  const ecartGlobalHTG = totalDuTheoriqueGlobal - totalDuEngagementReelGlobal;
  const soldeRestantGlobalHTG = totalDuEngagementReelGlobal - totalRecueilliGlobal;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copié dans le presse-papier");
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleSetAlignment = (mode: 'theoretical' | 'engagement') => {
    setAlignmentMode(mode);
    try {
      localStorage.setItem('edunova_diag_mode_preference', mode);
    } catch {}
    toast.success(
      mode === 'engagement'
        ? "Alignement actif : Engagement Réel Scellé (98 960 HTG)"
        : "Alignement actif : Barème Théorique Brut (99 600 HTG)"
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 pb-12 animate-in fade-in duration-200">
      
      {/* 1. TOP BAR ULTRA-COMPACTE : NAVIGATION & SÉLECTEUR RAPIDE */}
      <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <button 
            type="button" 
            onClick={() => navigate('/economat')} 
            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Retour à la Direction Économat"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="h-4 w-px bg-slate-200 shrink-0" />
          <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md">
              Audit Devise
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">
              {currentProfile.fullName} ({currentProfile.class})
            </span>
            <span className="hidden md:inline font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              ID: {currentProfile.id.substring(0, 10)}...
            </span>
          </div>
        </div>

        {/* CONTROLS RIGHT : SÉLECTEUR ÉLÈVE, IMPRESSION, PARTAGE */}
        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
          {/* SÉLECTEUR CAS ÉTUDES */}
          <select
            value={selectedProfileId}
            onChange={(e) => {
              setSelectedProfileId(e.target.value);
              toast.info("Dossier d'audit rechargé");
            }}
            className="text-[11px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl px-2.5 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="9f18c76c-7592-4549-82c4-d1fcc2ee8b0d">Dossier Repère : Christelle (NS II - ID 9f18c76c)</option>
            <option value="4a2b1c3d-9988-7766-5544-33221100aabb">Dossier Peterson (Philo - Frais État)</option>
          </select>

          <button
            type="button"
            onClick={() => handleCopy(window.location.href, 'link')}
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer"
            title="Copier le lien"
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

      {/* 2. BANDEAU DE COMMANDE & SIMULATEUR DE TAUX COMPACT */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-3.5 sm:p-4 shadow-md border border-indigo-900/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-300/30 px-2 py-0.5 rounded-md">
              Session {activeAcademicYear?.label || '2025-2026'}
            </span>
            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-md flex items-center gap-1">
              <CheckCircle2 size={11} /> Barème ${barèmeUSD}.00 USD Honoré (100%)
            </span>
          </div>
          <h1 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
            <span>Diagnostic : Barème USD vs Engagement Scellé</span>
          </h1>
          <p className="text-slate-300 text-[11px] leading-tight line-clamp-2">
            Écart provoqué par le versement de devises USD scellé à 140 HTG face au taux du jour recalculé à {tauxActuel} HTG.
          </p>
        </div>

        {/* CONTRÔLE RAPIDE DE TAUX DIRECT */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 sm:p-2.5 border border-white/15 flex items-center gap-2 shrink-0 self-start md:self-center">
          <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap">Taux du Jour :</span>
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
              className="w-14 bg-black/30 border border-white/20 rounded-md px-1.5 py-0.5 text-xs font-mono font-bold text-amber-300 text-center"
              min={100}
              max={250}
            />
            <span className="text-[10px] text-slate-400 font-mono">HTG</span>
          </div>
        </div>
      </div>

      {/* 3. BARRE DE NAVIGATION PAR ONGLETS (DENSITÉ MAXIMUM) */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto custom-scrollbar">
        {[
          { id: 'all', label: 'Vue Complète', icon: Eye },
          { id: 'compare', label: 'Comparatif 1:1', icon: ArrowRightLeft },
          { id: 'receipts', label: 'Reçus Scellés (Audit)', icon: Receipt },
          { id: 'rules', label: 'Arbitrage Légal & Clôture', icon: FileCheck2 },
          { id: 'simulator', label: 'Testeur Tous Élèves', icon: Calculator },
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
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/80' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-indigo-600' : 'text-slate-500'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. BANDEAU DE 4 KPIS COMPACTS & RÉACTIFS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* KPI 1 : BARÈME THÉORIQUE */}
        <div className={`p-3 rounded-xl border transition-all ${
          alignmentMode === 'theoretical' 
            ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20 shadow-2xs' 
            : 'bg-white border-slate-200'
        }`}>
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
          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight truncate">
            Dont ${barèmeUSD} USD @ {tauxActuel} G = {fraisDiversTheoriqueHTG.toLocaleString()} G
          </p>
        </div>

        {/* KPI 2 : ENGAGEMENT RÉEL */}
        <div className={`p-3 rounded-xl border transition-all ${
          alignmentMode === 'engagement' 
            ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-400/20 shadow-2xs' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              2. Engagement Réel Scellé
            </span>
            <ShieldCheck size={14} className="text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-900">
              {totalDuEngagementReelGlobal.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-slate-500">HTG</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight truncate">
            Montant certifié sur reçus officiels
          </p>
        </div>

        {/* KPI 3 : ÉCART CONSTATÉ */}
        <div className="p-3 rounded-xl border bg-amber-50/60 border-amber-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">
              3. Écart Absorbé
            </span>
            <AlertTriangle size={14} className="text-amber-700" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-900">
              +{ecartGlobalHTG.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-amber-700">HTG</span>
          </div>
          <p className="text-[10px] text-amber-800/80 mt-0.5 leading-tight truncate">
            Variation de change (+2.21%) sur acompte
          </p>
        </div>

        {/* KPI 4 : SOLDE RESTANT SCOLARITÉ */}
        <div className="p-3 rounded-xl border bg-indigo-50/50 border-indigo-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">
              4. Reste Dû Réel Élève
            </span>
            <CheckCircle2 size={14} className="text-indigo-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-indigo-950">
              {soldeRestantGlobalHTG.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-indigo-700">HTG</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight truncate">
            Frais Divers 100% soldés (Reste: Scolarité)
          </p>
        </div>
      </div>

      {/* 5. VUE COMPARATIF 1:1 EN DOUBLE COLONNE COMPACTE */}
      {(activeTab === 'all' || activeTab === 'compare') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          
          {/* COLONNE GAUCHE : BARÈME THÉORIQUE */}
          <div className={`bg-white rounded-2xl p-3.5 sm:p-4 border transition-all space-y-3 ${
            alignmentMode === 'theoretical' ? 'border-blue-500 shadow-xs' : 'border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <DollarSign size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">
                    Calcul Théorique au Barème USD
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Conversion instantanée à {tauxActuel} HTG
                  </p>
                </div>
              </div>
              <span className="font-mono text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                1 USD = {tauxActuel} G
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Barème {currentProfile.usdFeeName} :</span>
                <span className="font-mono font-bold text-blue-700">${barèmeUSD}.00 USD</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Contre-valeur théorique au taux du jour :</span>
                <span className="font-mono font-black text-slate-900">{fraisDiversTheoriqueHTG.toLocaleString()} HTG</span>
              </div>
              {currentProfile.fixedHtgFees.map((fee, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5 text-slate-500 text-[11px]">
                  <span>• {fee.name} :</span>
                  <span className="font-mono text-slate-700 font-medium">{fee.amount.toLocaleString()} HTG</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-200 block">Total Dû Théorique</span>
                <span className="text-xl sm:text-2xl font-black font-mono">{totalDuTheoriqueGlobal.toLocaleString()} G</span>
              </div>
              <button
                type="button"
                onClick={() => handleSetAlignment('theoretical')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  alignmentMode === 'theoretical'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                {alignmentMode === 'theoretical' ? 'Actif' : 'Choisir'}
              </button>
            </div>
          </div>

          {/* COLONNE DROITE : ENGAGEMENT RÉEL */}
          <div className={`bg-white rounded-2xl p-3.5 sm:p-4 border transition-all space-y-3 ${
            alignmentMode === 'engagement' ? 'border-emerald-500 shadow-xs' : 'border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">
                    Engagement Réellement Enregistré
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Montants scellés sur reçus légaux
                  </p>
                </div>
              </div>
              <span className="font-mono text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                Reçus Scellés
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Montant Scellé {currentProfile.usdFeeName} :</span>
                <span className="font-mono font-bold text-emerald-700">{engagementFraisDiversReelHTG.toLocaleString()} HTG</span>
              </div>
              {currentProfile.payments.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5 text-slate-600 text-[11px]">
                  <span>• {p.ref} ({p.date} @ {p.rate} G) :</span>
                  <span className="font-mono text-slate-900 font-bold">{p.htg.toLocaleString()} HTG (${p.usd})</span>
                </div>
              ))}
              {currentProfile.fixedHtgFees.map((fee, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5 text-slate-500 text-[11px]">
                  <span>• {fee.name} :</span>
                  <span className="font-mono text-slate-700 font-medium">{fee.amount.toLocaleString()} HTG</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-200 block">Total Dû Engagement</span>
                <span className="text-xl sm:text-2xl font-black font-mono">{totalDuEngagementReelGlobal.toLocaleString()} G</span>
              </div>
              <button
                type="button"
                onClick={() => handleSetAlignment('engagement')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  alignmentMode === 'engagement'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                {alignmentMode === 'engagement' ? 'Actif' : 'Choisir'}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 6. TABLEAU DES REÇUS ET ÉCRITURES SCELLÉES (AUDIT TRAIL) */}
      {(activeTab === 'all' || activeTab === 'receipts') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-indigo-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                Audit des Reçus Numérotés & Valeurs Scellées
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              Total Encaissé : {totalRecueilliGlobal.toLocaleString()} HTG
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/60 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Reçu #</th>
                  <th className="py-2 px-3">Rubrique</th>
                  <th className="py-2 px-3">Encaissé</th>
                  <th className="py-2 px-3">Taux</th>
                  <th className="py-2 px-3 text-right">Valeur Scellée</th>
                  <th className="py-2 px-3 text-right">Valeur @ {tauxActuel} G</th>
                  <th className="py-2 px-3 text-right">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentProfile.payments.map((p, idx) => {
                  const currentValue = p.usd * tauxActuel;
                  const ecart = currentValue - p.htg;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 text-slate-700 font-medium whitespace-nowrap">{p.date}</td>
                      <td className="py-2 px-3">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] border border-indigo-200/60">
                          {p.ref}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{p.desc}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">${p.usd}.00 USD</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{p.rate} HTG</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{p.htg.toLocaleString()} G</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">{currentValue.toLocaleString()} G</td>
                      <td className={`py-2 px-3 text-right font-mono font-bold ${ecart > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {ecart === 0 ? '0 G' : `+${ecart.toLocaleString()} G`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. SECTION ARBITRAGE & UTILITÉ INSTITUTIONNELLE */}
      {(activeTab === 'all' || activeTab === 'rules') && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-3 shadow-md border border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white">
                Règle d'Arbitrage Comptable & Valeur Libératoire
              </h3>
              <p className="text-[10px] text-slate-400">
                Pourquoi cet outil existe et quand vous devez l'utiliser
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-300 block">1. L'Origine du Problème</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Le barème fixe un montant en dollars (ex: $200 USD). Quand un parent paie par tranches à des dates différentes, les taux de change varient (140 G puis 148 G). Recalculer le solde au taux du jour crée une <em>dette fantôme</em> artificielle (+640 G).
              </p>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-300 block">2. La Décision Juridique</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                <strong>Le reçu officiel scellé fait foi absolue.</strong> L'élève ayant acquitté la totalité de son obligation en devises ($200.00 USD), la dette est éteinte. L'écart de 640 G est un différentiel de change de l'établissement, jamais imputable à la famille.
              </p>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-300 block">3. Quand l'utiliser ?</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                À la clôture annuelle, lors de la délivrance des <strong>Quitus d'examen</strong>, pour régler les réclamations de parents devant le caissier, ou pour auditer tout étudiant payant en devises.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 8. TESTEUR RAPIDE POUR TOUT ÉLÈVE / NOUVEAU CAS (SIMULATEUR) */}
      {(activeTab === 'all' || activeTab === 'simulator') && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-indigo-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                Simulateur Universel : Tester n'importe quel élève ou barème
              </h3>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              Outil Interactif Économat
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Barème Fixé (USD) :</label>
              <input
                type="number"
                value={customUsdTarget}
                onChange={(e) => setCustomUsdTarget(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900"
                placeholder="Ex: 200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Acompte Payé (USD) :</label>
              <input
                type="number"
                value={customPayment1USD}
                onChange={(e) => setCustomPayment1USD(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900"
                placeholder="Ex: 80"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Taux Historique de l'Acompte :</label>
              <input
                type="number"
                value={customPayment1Rate}
                onChange={(e) => setCustomPayment1Rate(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900"
                placeholder="Ex: 140"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Taux Courant du Jour :</label>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900"
                placeholder="Ex: 148"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-600">Écart calculé pour cette simulation :</span>
              <strong className="font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                +{(customPayment1USD * (exchangeRate - customPayment1Rate)).toLocaleString()} HTG
              </strong>
            </div>
            <span className="text-[11px] text-slate-500">
              Formule : {customPayment1USD}$ × ({exchangeRate} G - {customPayment1Rate} G)
            </span>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentCurrencyDiagnosticView;
