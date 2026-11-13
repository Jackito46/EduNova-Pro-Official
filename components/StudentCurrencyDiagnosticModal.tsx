import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  X,
  ArrowRightLeft,
  Check,
  Maximize2,
  Coins
} from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '../contexts/SchoolContext';
import { computeFeeCategoryBalance } from '../utils/financeCalculations';
import { isPaymentCompleted, isWalletDeposit } from '../src/utils/payment';

export interface StudentCurrencyDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  studentClass?: string;
  academicYearLabel?: string;
  currentExchangeRate?: number;
  plannedHTG?: number;
  plannedUSD?: number;
  totalDiscountHTG?: number;
  payments?: any[];
  onApplyAlignment?: (mode: 'theoretical' | 'engagement') => void;
  currentMode?: 'theoretical' | 'engagement';
}

export const StudentCurrencyDiagnosticModal: React.FC<StudentCurrencyDiagnosticModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName,
  studentClass = 'Classe active',
  academicYearLabel = 'Session active',
  currentExchangeRate = 135,
  plannedHTG = 0,
  plannedUSD = 0,
  totalDiscountHTG = 0,
  payments = [],
  onApplyAlignment,
  currentMode = 'engagement'
}) => {
  const navigate = useNavigate();
  const { school } = useSchool();
  const [selectedAlignmentMode, setSelectedAlignmentMode] = useState<'theoretical' | 'engagement'>(
    currentMode
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isMultiCurrencyEnabled = Boolean(school?.global_settings?.multi_currency_enabled);
  const primaryCurrency = school?.global_settings?.primary_currency || 'HTG';
  const secondaryCurrency = school?.global_settings?.secondary_currency || 'USD';
  const effectiveRate = currentExchangeRate > 0 ? currentExchangeRate : Number(school?.exchange_rate || 135);

  const validPayments = useMemo(
    () => (payments || []).filter((p) => isPaymentCompleted(p) && !isWalletDeposit(p)),
    [payments]
  );

  const breakdown = useMemo(() => {
    const effectivePlannedUSD = isMultiCurrencyEnabled ? plannedUSD : 0;
    return computeFeeCategoryBalance(
      plannedHTG,
      effectivePlannedUSD,
      validPayments,
      effectiveRate,
      totalDiscountHTG
    );
  }, [plannedHTG, plannedUSD, isMultiCurrencyEnabled, validPayments, effectiveRate, totalDiscountHTG]);

  if (!isOpen) return null;

  const grossTheoretical = Math.round(
    plannedHTG + (isMultiCurrencyEnabled ? plannedUSD * effectiveRate : 0)
  );
  const netTheoretical = Math.max(0, grossTheoretical - Math.round(totalDiscountHTG));
  const sealedEngagement = Math.round(breakdown.effectiveDueHTG);
  const variance = isMultiCurrencyEnabled
    ? netTheoretical - sealedEngagement
    : grossTheoretical - sealedEngagement;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copié dans le presse-papier');
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleApply = (mode: 'theoretical' | 'engagement') => {
    setSelectedAlignmentMode(mode);
    onApplyAlignment?.(mode);
    toast.success(
      mode === 'engagement'
        ? `Aligné sur l'Engagement Scellé (${sealedEngagement.toLocaleString('fr-FR')} ${primaryCurrency})`
        : `Aligné sur le Barème Théorique (${netTheoretical.toLocaleString('fr-FR')} ${primaryCurrency})`
    );
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="px-3.5 py-3 sm:px-4 sm:py-3 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-3 border-b border-indigo-900/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Activity size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-400/30">
                  {isMultiCurrencyEnabled
                    ? `Audit ${primaryCurrency} ↔ ${secondaryCurrency}`
                    : `Audit Mono-Devise (${primaryCurrency})`}
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-300">
                  {academicYearLabel}
                </span>
              </div>
              <h2 className="text-xs sm:text-sm font-black text-white truncate">
                Diagnostic Barème & Devises — {studentName} ({studentClass})
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
              title="Ouvrir la vue complète de l'établissement"
            >
              <Maximize2 size={12} />
              <span className="hidden sm:inline">Vue École</span>
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

        {/* BODY */}
        <div className="p-3 sm:p-4 overflow-y-auto custom-scrollbar space-y-3 flex-1 bg-slate-50/50">
          {/* BANDEAU SYNTHÈSE */}
          <div
            className={`border rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${
              Math.abs(variance) > 0
                ? 'bg-amber-50/70 border-amber-300'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                  Math.abs(variance) > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {Math.abs(variance) > 0 ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black text-slate-900">
                  {Math.abs(variance) > 0
                    ? isMultiCurrencyEnabled
                      ? 'Écart de Change / Amortissement Constaté'
                      : 'Ajustement Barème vs Engagement Net'
                    : 'Alignement Parfait Barème & Engagement Scellé'}
                </h3>
                <p className="text-[11px] text-slate-700 mt-0.5 leading-snug">
                  Dossier <strong>{studentName}</strong> :{' '}
                  {isMultiCurrencyEnabled
                    ? `Total théorique de ${netTheoretical.toLocaleString('fr-FR')} ${primaryCurrency} (au taux ${effectiveRate} G) face à un engagement scellé de ${sealedEngagement.toLocaleString('fr-FR')} ${primaryCurrency}.`
                    : `Barème officiel de ${grossTheoretical.toLocaleString('fr-FR')} ${primaryCurrency} face à un engagement net scellé de ${sealedEngagement.toLocaleString('fr-FR')} ${primaryCurrency}.`}
                </p>
              </div>
            </div>

            <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-right shrink-0">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Écart</span>
              <span className="text-sm font-black font-mono tabular-nums text-slate-900">
                {variance > 0 ? `+${variance.toLocaleString('fr-FR')}` : variance.toLocaleString('fr-FR')} {primaryCurrency}
              </span>
            </div>
          </div>

          {/* 2 COLONNES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl p-3 border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  {isMultiCurrencyEnabled ? (
                    <DollarSign size={15} className="text-blue-600" />
                  ) : (
                    <Coins size={15} className="text-blue-600" />
                  )}
                  <h3 className="text-xs font-black text-slate-900 uppercase">
                    {isMultiCurrencyEnabled ? '1. Barème Théorique' : '1. Barème Officiel'}
                  </h3>
                </div>
                {isMultiCurrencyEnabled && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[9px] font-bold">
                    1 {secondaryCurrency} = {effectiveRate} {primaryCurrency}
                  </span>
                )}
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                  <span className="text-slate-600">Planifié en {primaryCurrency} :</span>
                  <span className="font-bold font-mono tabular-nums text-slate-900">
                    {plannedHTG.toLocaleString('fr-FR')} {primaryCurrency}
                  </span>
                </div>
                {isMultiCurrencyEnabled && plannedUSD > 0 && (
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                    <span className="text-slate-600">Planifié en {secondaryCurrency} :</span>
                    <span className="font-bold font-mono tabular-nums text-blue-700">
                      ${plannedUSD.toLocaleString('fr-FR')} {secondaryCurrency}
                    </span>
                  </div>
                )}
                {totalDiscountHTG > 0 && (
                  <div className="flex justify-between items-center py-0.5 text-indigo-700">
                    <span>Bourse / Réduction :</span>
                    <span className="font-mono font-bold tabular-nums">
                      -{Math.round(totalDiscountHTG).toLocaleString('fr-FR')} {primaryCurrency}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-2.5 bg-slate-900 text-white rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-300 block">
                    {isMultiCurrencyEnabled ? 'Total Dû Théorique Net' : 'Barème Officiel Brut'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums leading-none">
                    {(isMultiCurrencyEnabled ? netTheoretical : grossTheoretical).toLocaleString('fr-FR')}{' '}
                    {primaryCurrency}
                  </span>
                </div>
                {onApplyAlignment && (
                  <button
                    type="button"
                    onClick={() => handleApply('theoretical')}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white cursor-pointer"
                  >
                    {selectedAlignmentMode === 'theoretical' ? 'Actif' : 'Sélectionner'}
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl p-3 border border-emerald-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-emerald-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase">
                    2. Engagement Réel Scellé
                  </h3>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[9px] font-bold">
                  {validPayments.length} reçu(s)
                </span>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                  <span className="text-slate-600">Total encaissé certifié :</span>
                  <span className="font-bold font-mono tabular-nums text-emerald-700">
                    {Math.round(breakdown.paidHTGEquiv).toLocaleString('fr-FR')} {primaryCurrency}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                  <span className="text-slate-600">Solde restant dû :</span>
                  <span className="font-mono font-bold tabular-nums text-slate-800">
                    {breakdown.isPaid
                      ? 'Soldé'
                      : `${Math.round(breakdown.remainingHTGEquiv).toLocaleString('fr-FR')} ${primaryCurrency}`}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-700 text-white rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-emerald-100 block">
                    Engagement Réel Scellé
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums leading-none">
                    {sealedEngagement.toLocaleString('fr-FR')} {primaryCurrency}
                  </span>
                </div>
                {onApplyAlignment && (
                  <button
                    type="button"
                    onClick={() => handleApply('engagement')}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white cursor-pointer"
                  >
                    {selectedAlignmentMode === 'engagement' ? 'Actif' : 'Sélectionner'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* REÇUS RÉELS DE L'ÉLÈVE */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-[11px]">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Receipt size={13} className="text-indigo-600" />
                <span>Reçus de Paiement Officiels</span>
              </div>
              <span className="text-[10px] font-bold font-mono text-slate-600">
                {validPayments.length} transaction(s)
              </span>
            </div>
            {validPayments.length === 0 ? (
              <div className="p-4 text-center text-slate-500">
                Aucun reçu validé enregistré pour cet élève sur la session.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto custom-scrollbar">
                {validPayments.map((p: any) => {
                  const ref = p.receipt_number || p.reference_number || p.transaction_reference || p.id?.slice(0, 8);
                  const dt = p.payment_date || p.created_at;
                  const amtEq = Math.round(
                    Number(p.amount_htg_equivalent || 0) ||
                      (p.currency === 'USD'
                        ? Number(p.amount || 0) * Number(p.exchange_rate_applied || effectiveRate)
                        : Number(p.amount || 0))
                  );
                  return (
                    <div key={p.id} className="px-3 py-1.5 flex items-center justify-between gap-2">
                      <span className="text-slate-600 truncate">
                        {dt ? new Date(dt).toLocaleDateString('fr-FR') : '—'} •{' '}
                        <strong className="font-mono text-slate-900">#{ref}</strong> ({p.fee_type || p.nature || 'Frais'})
                      </span>
                      <span className="font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                        {isMultiCurrencyEnabled && p.currency === 'USD'
                          ? `$${Number(p.amount || 0).toLocaleString('fr-FR')} ${secondaryCurrency} (${amtEq.toLocaleString('fr-FR')} ${primaryCurrency})`
                          : `${amtEq.toLocaleString('fr-FR')} ${primaryCurrency}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-3 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(`/economat/diagnostic?student_id=${studentId}`);
            }}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRightLeft size={13} />
            <span>Ouvrir le Registre École</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentCurrencyDiagnosticModal;
