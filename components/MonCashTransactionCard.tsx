import React, { useState } from 'react';
import { 
  Smartphone, 
  ShieldCheck, 
  Clock, 
  Copy, 
  Check, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Hash,
  Calendar,
  Server
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { checkMonCashPaymentStatus } from '../src/utils/payment';

export interface MonCashTransactionInfo {
  orderId: string;
  transactionId?: string;
  paymentId?: string;
  initiatedAt: string | Date;
  serverStatus: 'VALIDE' | 'EN_ATTENTE' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'FAILED' | 'REJETE' | string;
  serverStatusRaw?: string;
  serverValidatedAt?: string | Date;
  amount?: number;
  currency?: string;
  payerPhone?: string;
  studentName?: string;
  studentClass?: string;
  feeTypeLabel?: string;
  verificationMethod?: string;
  schoolId?: string;
}

interface MonCashTransactionCardProps {
  data: MonCashTransactionInfo;
  onStatusUpdated?: (updatedStatus: string, updatedRecord?: any) => void;
  className?: string;
  isCompact?: boolean;
}

export const MonCashTransactionCard: React.FC<MonCashTransactionCardProps> = ({
  data,
  onStatusUpdated,
  className = '',
  isCompact = false
}) => {
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [copiedTxId, setCopiedTxId] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>(data.serverStatus);
  const [lastServerCheck, setLastServerCheck] = useState<string | null>(null);

  // Normalisation de la date d'initiative
  const formatExactDate = (dateVal: string | Date): string => {
    try {
      const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      if (isNaN(d.getTime())) return String(dateVal);
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(d);
    } catch {
      return String(dateVal);
    }
  };

  const copyToClipboard = async (text: string, isOrder: boolean) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      if (isOrder) {
        setCopiedOrderId(true);
        setTimeout(() => setCopiedOrderId(false), 2000);
      } else {
        setCopiedTxId(true);
        setTimeout(() => setCopiedTxId(false), 2000);
      }
      toast.success('Identifiant copié dans le presse-papier');
    } catch {
      toast.error("Impossible de copier l'identifiant");
    }
  };

  // Re-vérification en direct du statut côté serveur (Supabase / Webhook)
  const refreshServerStatus = async () => {
    setIsRefreshing(true);
    try {
      const res = await checkMonCashPaymentStatus({
        paymentId: data.paymentId,
        orderId: data.orderId,
        transactionReference: data.transactionId,
        supabaseClient: supabase,
        schoolId: data.schoolId
      });

      const nowStr = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      setLastServerCheck(nowStr);

      if (res.isConfirmed) {
        setCurrentStatus('VALIDE');
        toast.success("Validation côté serveur confirmée (Statut : VALIDE)");
        if (onStatusUpdated) {
          onStatusUpdated('VALIDE', res.paymentRecord);
        }
      } else if (res.isFailed) {
        setCurrentStatus('FAILED');
        toast.error("Transaction rejetée côté serveur");
        if (onStatusUpdated) {
          onStatusUpdated('FAILED', res.paymentRecord);
        }
      } else {
        setCurrentStatus(res.status || 'EN_ATTENTE');
        toast.info("Statut côté serveur : En attente de règlement");
        if (onStatusUpdated) {
          onStatusUpdated(res.status || 'EN_ATTENTE', res.paymentRecord);
        }
      }
    } catch (err: any) {
      console.warn("Erreur rafraîchissement statut serveur:", err);
      toast.error("Erreur lors de la vérification du serveur");
    } finally {
      setIsRefreshing(false);
    }
  };

  const isServerValid = ['VALIDE', 'CONFIRMED', 'COMPLETED', 'SUCCESSFUL'].includes(currentStatus.toUpperCase());
  const isServerFailed = ['FAILED', 'ANNULE', 'REJETE', 'ECHEC', 'EXPIRED'].includes(currentStatus.toUpperCase());

  return (
    <div 
      id="moncash-summary-card"
      className={`bg-white rounded-2xl border ${
        isServerValid 
          ? 'border-emerald-200/90 shadow-sm' 
          : isServerFailed 
          ? 'border-rose-200 shadow-sm' 
          : 'border-amber-200/90 shadow-sm'
      } overflow-hidden transition-all ${className}`}
    >
      {/* Header MonCash avec signature visuelle institutionnelle */}
      <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-700 px-4 sm:px-5 py-3 text-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
            <Smartphone size={17} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-sm tracking-tight text-white">MonCash</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/30">
                Paiement Mobile
              </span>
            </div>
            <p className="text-[10.5px] text-white/85 truncate font-medium">
              Récapitulatif officiel de l'opération
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={refreshServerStatus}
          disabled={isRefreshing}
          title="Vérifier le statut en temps réel côté serveur"
          className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-[11px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 border border-white/20 disabled:opacity-50"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Vérifier serveur</span>
        </button>
      </div>

      {/* Contenu principal de la carte */}
      <div className="p-4 sm:p-5 space-y-3.5 text-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* 1. ID UNIQUE DE LA TRANSACTION MONCASH */}
          <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              <div className="flex items-center gap-1.5">
                <Hash size={13} className="text-red-600" />
                <span>ID Transaction MonCash</span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-red-50 text-red-700 rounded border border-red-100">
                Order ID
              </span>
            </div>

            <div className="my-1">
              <div className="flex items-center justify-between gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="font-mono text-xs sm:text-sm font-black text-slate-900 truncate" title={data.orderId}>
                  {data.orderId}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(data.orderId, true)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors shrink-0 cursor-pointer"
                  title="Copier l'identifiant"
                >
                  {copiedOrderId ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>

              {data.transactionId && data.transactionId !== data.orderId && (
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 px-1">
                  <span className="truncate">Réf Digicel : <strong className="font-mono text-slate-700">{data.transactionId}</strong></span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(data.transactionId!, false)}
                    className="text-slate-400 hover:text-slate-700 p-0.5 ml-1"
                    title="Copier la référence Digicel"
                  >
                    {copiedTxId ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                  </button>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span>Identifiant unique sécurisé Digicel</span>
            </div>
          </div>

          {/* 2. DATE EXACTE DE L'INITIATIVE */}
          <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              <Clock size={13} className="text-amber-600" />
              <span>Date de l'Initiative</span>
            </div>

            <div className="my-1">
              <p className="text-xs sm:text-sm font-bold text-slate-900 font-mono flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <span>{formatExactDate(data.initiatedAt)}</span>
              </p>
              <p className="text-[10.5px] text-slate-500 mt-1">
                Horodatage précis à la seconde près
              </p>
            </div>

            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span>Enregistré à l'initiation de l'ordre</span>
            </div>
          </div>

          {/* 3. STATUT DE VALIDATION CÔTÉ SERVEUR */}
          <div className={`rounded-xl p-3 border flex flex-col justify-between ${
            isServerValid
              ? 'bg-emerald-50/80 border-emerald-200'
              : isServerFailed
              ? 'bg-rose-50/80 border-rose-200'
              : 'bg-amber-50/80 border-amber-200'
          }`}>
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold uppercase tracking-wider mb-1">
              <div className="flex items-center gap-1.5">
                <Server size={13} className={isServerValid ? 'text-emerald-700' : isServerFailed ? 'text-rose-700' : 'text-amber-700'} />
                <span className={isServerValid ? 'text-emerald-800' : isServerFailed ? 'text-rose-800' : 'text-amber-800'}>
                  Statut Serveur
                </span>
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.2 bg-white/70 rounded border text-slate-700">
                Backend
              </span>
            </div>

            <div className="my-1">
              <div className="flex items-center gap-2">
                {isServerValid ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 size={13} />
                  </div>
                ) : isServerFailed ? (
                  <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <AlertCircle size={13} />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <RefreshCw size={11} className="animate-spin" />
                  </div>
                )}

                <div>
                  <span className={`text-xs sm:text-sm font-black tracking-wide ${
                    isServerValid 
                      ? 'text-emerald-900' 
                      : isServerFailed 
                      ? 'text-rose-900' 
                      : 'text-amber-900'
                  }`}>
                    {isServerValid ? 'VALIDÉ CÔTÉ SERVEUR' : isServerFailed ? 'REJETÉ / ÉCHEC SERVEUR' : 'EN ATTENTE SERVEUR'}
                  </span>
                  <div className="text-[10px] text-slate-500">
                    Code base : <strong className="font-mono">{data.serverStatusRaw || currentStatus}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[10px] mt-1 flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck size={11} className={isServerValid ? 'text-emerald-600' : 'text-slate-400'} />
                <span>{isServerValid ? 'Certifié en base' : 'Synchronisation active'}</span>
              </span>
              {lastServerCheck && (
                <span className="text-[9px] font-mono text-slate-400">Vérifié à {lastServerCheck}</span>
              )}
            </div>
          </div>

        </div>

        {/* Détails complémentaires de la transaction (Montant, Élève, Payeur) */}
        {!isCompact && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-4 flex-wrap">
              {typeof data.amount === 'number' && (
                <div>
                  <span className="text-slate-400 text-[11px]">Montant perçu : </span>
                  <strong className="font-mono text-slate-900 font-bold">
                    {data.amount.toLocaleString()} {data.currency || 'HTG'}
                  </strong>
                </div>
              )}
              {data.studentName && (
                <div>
                  <span className="text-slate-400 text-[11px]">Bénéficiaire : </span>
                  <strong className="text-slate-800 font-semibold">{data.studentName}</strong>
                  {data.studentClass && <span className="text-slate-500 text-[11px]"> ({data.studentClass})</span>}
                </div>
              )}
              {data.payerPhone && (
                <div>
                  <span className="text-slate-400 text-[11px]">N° Mobile Payeur : </span>
                  <strong className="font-mono text-slate-800 font-semibold">{data.payerPhone}</strong>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[10.5px] text-slate-600 bg-indigo-50/80 px-2 py-1 rounded-md border border-indigo-100">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                <span>
                  {isServerValid 
                    ? '📲 Notification Push transmise aux parents' 
                    : '🔔 Push auto parents actif dès validation'}
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-[10.5px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Passerelle MonCash Digicel</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
