import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  DollarSign, 
  ShieldCheck, 
  AlertTriangle, 
  Receipt, 
  CheckCircle2, 
  X, 
  Sparkles, 
  ArrowRightLeft, 
  Check, 
  Maximize2 
} from 'lucide-react';
import { toast } from 'sonner';

export interface StudentCurrencyDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId?: string;
  studentName?: string;
  studentClass?: string;
  academicYearLabel?: string;
  currentExchangeRate?: number;
  onApplyAlignment?: (mode: 'theoretical' | 'engagement') => void;
  currentMode?: 'theoretical' | 'engagement';
}

export const StudentCurrencyDiagnosticModal: React.FC<StudentCurrencyDiagnosticModalProps> = ({
  isOpen,
  onClose,
  studentId = 'c3b12a55-d5d1-460b-8a7d-c8eed32a727c',
  studentName = 'AUGUSTIN Djenny',
  studentClass = 'NS II',
  academicYearLabel = '2025-2026',
  currentExchangeRate = 148,
  onApplyAlignment,
  currentMode = 'theoretical'
}) => {
  const navigate = useNavigate();
  const [selectedAlignmentMode, setSelectedAlignmentMode] = useState<'theoretical' | 'engagement'>(currentMode);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  // Barème officiel en dollars
  const barèmeUSD = 200;
  const tauxActuel = currentExchangeRate > 0 ? currentExchangeRate : 148;

  // Calcul 1 : Total Dû Théorique
  const fraisDiversTheoriqueHTG = barèmeUSD * tauxActuel; // 200 * 148 = 29 600 HTG
  const inscriptionFixeHTG = 2500;
  const scolariteContratHTG = 65000;
  const campagneSpecialHTG = 2500;
  const totalDuTheoriqueGlobal = inscriptionFixeHTG + scolariteContratHTG + campagneSpecialHTG + fraisDiversTheoriqueHTG; // 99 600 HTG

  // Calcul 2 : Montant Réellement Enregistré dans l'Engagement
  const versement1USD = 80;
  const versement1Taux = 140;
  const versement1HTG = versement1USD * versement1Taux; // 11 200 HTG
  const versement2HTG = 17760;
  const engagementFraisDiversReelHTG = versement1HTG + versement2HTG; // 28 960 HTG
  const totalDuEngagementReelGlobal = inscriptionFixeHTG + scolariteContratHTG + campagneSpecialHTG + engagementFraisDiversReelHTG; // 98 960 HTG

  // Écart financier de diagnostic
  const ecartMotifHTG = fraisDiversTheoriqueHTG - engagementFraisDiversReelHTG; // +640 HTG

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copié dans le presse-papier");
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleApply = (mode: 'theoretical' | 'engagement') => {
    setSelectedAlignmentMode(mode);
    onApplyAlignment?.(mode);
    toast.success(
      mode === 'engagement' 
        ? "Bilan aligné sur l'Engagement Réel (Total Dû : 98 960 HTG)" 
        : "Bilan aligné sur le Barème Théorique (Total Dû : 99 600 HTG)"
    );
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
        
        {/* HEADER COMPACT */}
        <div className="px-3.5 py-3 sm:px-4 sm:py-3 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-3 border-b border-indigo-900/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Activity size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded border border-indigo-400/30">
                  Audit Multi-Devises
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-300">
                  {academicYearLabel}
                </span>
              </div>
              <h2 className="text-xs sm:text-sm font-black text-white truncate">
                Diagnostic : Barème USD (99 600 G) vs Engagement Réel (98 960 G)
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/economat/diagnostic?student_id=${studentId}`);
              }}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded-lg transition-all border border-white/15 flex items-center gap-1 cursor-pointer"
              title="Ouvrir la vue complète"
            >
              <Maximize2 size={12} />
              <span className="hidden sm:inline">Plein Écran</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopy(studentId, 'studentId')}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-[11px] font-mono rounded-lg transition-all border border-white/15 flex items-center gap-1 cursor-pointer"
              title="Copier ID"
            >
              {copiedKey === 'studentId' ? <Check size={11} className="text-emerald-400" /> : 'ID'}
              <span>{studentId.substring(0, 6)}...</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-rose-600/80 text-white flex items-center justify-center transition-all cursor-pointer"
              aria-label="Fermer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* CORPS COMPACT AVEC RYTHME VISUEL DENSE */}
        <div className="p-3 sm:p-4 overflow-y-auto custom-scrollbar space-y-3 flex-1 bg-slate-50/50">
          
          {/* BANDEAU SYNTHÈSE DE L'ÉCART CONSTATÉ */}
          <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
                <AlertTriangle size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs font-black text-amber-950">
                    Écart de Taux Amorti sur Frais Divers
                  </h3>
                  <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px] font-bold font-mono">
                    +{ecartMotifHTG.toLocaleString()} HTG (+2.21%)
                  </span>
                </div>
                <p className="text-[11px] text-amber-900/85 mt-0.5 leading-snug">
                  Dossier <strong>{studentName} ({studentClass})</strong> : L'obligation de <strong>$200 USD</strong> est 100% honorée. 
                  L'acompte de $80 USD scellé à 140 HTG (11 200 G) crée un écart de change de 640 G avec le taux actuel de {tauxActuel} G.
                </p>
              </div>
            </div>

            <div className="bg-white px-2.5 py-1.5 rounded-lg border border-amber-200 text-right shrink-0 self-stretch sm:self-center flex sm:flex-col justify-between items-center sm:items-end">
              <span className="text-[9px] uppercase font-bold text-amber-700">Écart Amorti</span>
              <span className="text-sm font-black font-mono text-amber-900 leading-none">+{ecartMotifHTG.toLocaleString()} G</span>
            </div>
          </div>

          {/* TABLEAU COMPARATIF 2 COLONNES COMPACTES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* COLONNE GAUCHE : BARÈME THÉORIQUE */}
            <div className={`rounded-xl p-3 border transition-all space-y-2.5 ${
              selectedAlignmentMode === 'theoretical'
                ? 'bg-blue-50/50 border-blue-400 ring-2 ring-blue-500/10'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  <DollarSign size={15} className="text-blue-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase">1. Barème Théorique (USD)</h3>
                </div>
                <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-mono text-[9px] font-bold">
                  1 USD = {tauxActuel} G
                </span>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                  <span className="text-slate-600">Barème Frais Divers :</span>
                  <span className="font-bold font-mono text-blue-700">${barèmeUSD}.00 USD</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                  <span className="text-slate-600">Contre-valeur @ {tauxActuel} G :</span>
                  <span className="font-black font-mono text-slate-900">{fraisDiversTheoriqueHTG.toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between items-center py-0.5 text-slate-500 text-[10px]">
                  <span>• Inscription + Scolarité + Campagnes :</span>
                  <span className="font-mono text-slate-700 font-medium">70 000 HTG</span>
                </div>
              </div>

              <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-blue-200 block">Total Dû Théorique</span>
                  <span className="text-lg font-black font-mono leading-none">{totalDuTheoriqueGlobal.toLocaleString()} G</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleApply('theoretical')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    selectedAlignmentMode === 'theoretical'
                      ? 'bg-white text-blue-700'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                >
                  {selectedAlignmentMode === 'theoretical' ? 'Actif' : 'Sélectionner'}
                </button>
              </div>
            </div>

            {/* COLONNE DROITE : ENGAGEMENT RÉEL */}
            <div className={`rounded-xl p-3 border transition-all space-y-2.5 ${
              selectedAlignmentMode === 'engagement'
                ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/10'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-emerald-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase">2. Engagement Réel Scellé</h3>
                </div>
                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono text-[9px] font-bold">
                  Reçus Scellés
                </span>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                  <span className="text-slate-600">Frais Divers Scellés :</span>
                  <span className="font-bold font-mono text-emerald-700">{engagementFraisDiversReelHTG.toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100 text-slate-600">
                  <span>• Acompte 80$ @ 140 G + Solde :</span>
                  <span className="font-mono text-slate-800 font-bold">11 200 G + 17 760 G</span>
                </div>
                <div className="flex justify-between items-center py-0.5 text-slate-500 text-[10px]">
                  <span>• Inscription + Scolarité + Campagnes :</span>
                  <span className="font-mono text-slate-700 font-medium">70 000 HTG</span>
                </div>
              </div>

              <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-emerald-200 block">Total Dû Engagement</span>
                  <span className="text-lg font-black font-mono leading-none">{totalDuEngagementReelGlobal.toLocaleString()} G</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleApply('engagement')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    selectedAlignmentMode === 'engagement'
                      ? 'bg-white text-emerald-800'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                >
                  {selectedAlignmentMode === 'engagement' ? 'Actif' : 'Sélectionner'}
                </button>
              </div>
            </div>

          </div>

          {/* AUDIT RAPIDE DES 3 VERSEMENTS SCELLÉS */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-[11px]">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Receipt size={13} className="text-indigo-600" />
                <span>Reçus de Paiement Officiels de l'Élève</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold font-mono">
                100% Soldé ($200.00 USD)
              </span>
            </div>
            <div className="divide-y divide-slate-100 font-sans">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-slate-600">11/10/2026 • <strong>#RCP-1ED06B5E</strong> (Solde Divers @ 148 G)</span>
                <span className="font-mono font-bold text-slate-900">17 760 HTG</span>
              </div>
              <div className="px-3 py-1.5 flex items-center justify-between bg-amber-50/30">
                <span className="text-slate-600">21/08/2026 • <strong>#RCP-2046B9E0</strong> (Acompte $80 USD @ 140 G)</span>
                <span className="font-mono font-bold text-amber-900">11 200 HTG (+$640 G écart amorti)</span>
              </div>
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-slate-600">27/07/2026 • <strong>#RCP-80221E37</strong> (Inscription Fixe)</span>
                <span className="font-mono font-bold text-slate-900">2 500 HTG</span>
              </div>
            </div>
          </div>

          {/* AVIS D'ARBITRAGE COMPTABLE */}
          <div className="bg-slate-900 text-white rounded-xl p-3 flex items-start gap-2.5 text-[11px]">
            <Sparkles size={16} className="text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-slate-300 leading-snug">
              <strong>Arbitrage officiel :</strong> Les $200 USD ont été intégralement versés. 
              Le reçu certifié <strong>#RCP-1ED06B5E</strong> éteint définitivement la dette pour cette rubrique. 
              L'écart de 640 HTG est un gain de change scolaire scellé.
            </p>
          </div>

        </div>

        {/* FOOTER ACTIONS COMPACT */}
        <div className="px-3 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 font-medium truncate">
            Mode : <strong className="text-slate-900">{selectedAlignmentMode === 'engagement' ? "Engagement Réel (98 960 G)" : "Barème Théorique (99 600 G)"}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={() => {
                handleApply(selectedAlignmentMode === 'engagement' ? 'theoretical' : 'engagement');
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRightLeft size={13} />
              <span>{selectedAlignmentMode === 'engagement' ? "Basculer Théorique" : "Basculer Engagement"}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StudentCurrencyDiagnosticModal;
