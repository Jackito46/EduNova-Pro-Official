import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Server, 
  Database, 
  Radio, 
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  ExternalLink,
  Wallet
} from 'lucide-react';
import { supabase } from '../supabase';
import { toast } from 'sonner';

interface StudentWalletDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    reference_number?: string;
    wallet_balance_htg?: number;
    school_id?: string;
  };
  schoolId?: string;
  onReconciled?: (newBalance: number) => void;
}

export const StudentWalletDiagnosticsModal: React.FC<StudentWalletDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  student,
  schoolId,
  onReconciled
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [diagnosticsData, setDiagnosticsData] = useState<any | null>(null);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'comparison' | 'db_logs' | 'webhooks'>('comparison');

  const fetchDiagnostics = async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data?.session;
      const token = session?.access_token;
      const res = await fetch(`/api/tranzak/diagnostics/${student.id}?schoolId=${encodeURIComponent(schoolId || student.school_id || '')}&studentName=${encodeURIComponent(`${student.first_name} ${student.last_name}`)}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDiagnosticsData(data);
      } else {
        toast.error(data.error || "Impossible de récupérer les logs de diagnostic Tranzak.");
      }
    } catch (e: any) {
      toast.error(`Erreur réseau diagnostic: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen, student.id]);

  const handleResolveDiscrepancy = async () => {
    setIsReconciling(true);
    try {
      const session = (await supabase.auth.getSession()).data?.session;
      const token = session?.access_token;
      const res = await fetch('/api/tranzak/sync-student-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          studentId: student.id,
          schoolId: schoolId || student.school_id,
          studentName: `${student.first_name} ${student.last_name}`
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const newBal = Number(data.new_balance) || 0;
        try {
          await supabase.from('students').update({ wallet_balance_htg: newBal }).eq('id', student.id);
        } catch (e) {}

        toast.success(`Synchronisation réussie ! Solde actualisé : ${newBal.toLocaleString()} HTG.`);
        if (onReconciled) onReconciled(newBal);
        await fetchDiagnostics();
      } else {
        toast.error(data.error || "Échec de la réconciliation automatique.");
      }
    } catch (err: any) {
      toast.error(`Erreur réconciliation: ${err.message}`);
    } finally {
      setIsReconciling(false);
    }
  };

  if (!isOpen) return null;

  const metrics = diagnosticsData?.metrics;
  const comparisons = diagnosticsData?.comparisons || [];
  const hasDiscrepancy = Boolean(metrics?.discrepancy_amount_htg > 0 || metrics?.missed_callbacks_count > 0);

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center">
              <Activity size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">Outil de Diagnostic Portefeuille & Tranzak</h3>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-300 font-mono font-bold px-2 py-0.5 rounded-full border border-indigo-400/30">
                  Temps Réel
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Élève : <strong className="text-white">{student.first_name} {student.last_name}</strong> • Matricule : <span className="font-mono text-indigo-300">{student.reference_number || student.id.slice(0, 8)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDiagnostics}
              disabled={loading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Rafraîchir les relevés de diagnostic"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Corps du modal */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
              <p className="text-sm font-bold text-slate-600">
                Interrogation des passerelles Tranzak, des tables Supabase et des callbacks...
              </p>
            </div>
          ) : (
            <>
              {/* Carte Récapitulatif Santé */}
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                hasDiscrepancy 
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900' 
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    hasDiscrepancy ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {hasDiscrepancy ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-black">
                      {hasDiscrepancy ? "Écart de Synchronisation Détecté" : "Concordance Parfaite Portefeuille ↔ Tranzak"}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      {diagnosticsData?.diagnostic_summary?.explanation}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResolveDiscrepancy}
                  disabled={isReconciling}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 disabled:opacity-50 shrink-0"
                >
                  <RefreshCw size={13} className={isReconciling ? 'animate-spin' : ''} />
                  <span>{isReconciling ? 'Synchronisation...' : 'Résoudre & Synchroniser'}</span>
                </button>
              </div>

              {/* 4 KPIs de Réconciliation */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-black uppercase">
                    <Wallet size={12} className="text-slate-600" />
                    <span>Solde Portefeuille UI</span>
                  </div>
                  <div className="text-lg font-black text-slate-900 font-mono mt-1">
                    {(metrics?.current_wallet_balance_htg || 0).toLocaleString()} <span className="text-xs text-slate-500">HTG</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Visible par le parent</span>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3">
                  <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] font-black uppercase">
                    <Server size={12} className="text-emerald-700" />
                    <span>Tranzak Live Validé</span>
                  </div>
                  <div className="text-lg font-black text-emerald-800 font-mono mt-1">
                    {(metrics?.total_tranzak_completed_htg || 0).toLocaleString()} <span className="text-xs text-emerald-600">HTG</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">Relevé officiel Tranzak</span>
                </div>

                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3">
                  <div className="flex items-center gap-1.5 text-blue-700 text-[10px] font-black uppercase">
                    <Database size={12} className="text-blue-700" />
                    <span>Table Supabase</span>
                  </div>
                  <div className="text-lg font-black text-blue-900 font-mono mt-1">
                    {metrics?.db_records_found || 0} <span className="text-xs font-bold text-blue-600">écritures</span>
                  </div>
                  <span className="text-[10px] text-blue-600 block mt-0.5 font-mono">
                    source: {metrics?.db_source_table || 'payments'}
                  </span>
                </div>

                <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3">
                  <div className="flex items-center gap-1.5 text-purple-700 text-[10px] font-black uppercase">
                    <Radio size={12} className="text-purple-700" />
                    <span>Callbacks Reçus</span>
                  </div>
                  <div className="text-lg font-black text-purple-900 font-mono mt-1">
                    {metrics?.callbacks_recorded || 0} <span className="text-xs font-bold text-purple-600">webhooks</span>
                  </div>
                  <span className="text-[10px] text-purple-600 block mt-0.5">
                    {metrics?.missed_callbacks_count > 0 ? `${metrics.missed_callbacks_count} manqué(s)` : 'Tous réceptionnés'}
                  </span>
                </div>
              </div>

              {/* Onglets d'inspection */}
              <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('comparison')}
                  className={`pb-2.5 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'comparison'
                      ? 'border-b-2 border-indigo-600 text-indigo-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Activity size={14} />
                  <span>Rapprochement Tranzak ↔ Supabase ({comparisons.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('db_logs')}
                  className={`pb-2.5 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'db_logs'
                      ? 'border-b-2 border-indigo-600 text-indigo-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Database size={14} />
                  <span>Écritures Supabase ({diagnosticsData?.raw_db_transactions?.length || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('webhooks')}
                  className={`pb-2.5 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'webhooks'
                      ? 'border-b-2 border-indigo-600 text-indigo-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Radio size={14} />
                  <span>Journal Webhook ({diagnosticsData?.raw_webhook_callbacks?.length || 0})</span>
                </button>
              </div>

              {/* CONTENU ONGLETS */}
              {activeTab === 'comparison' && (
                <div className="space-y-3">
                  {comparisons.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                      <p className="text-xs font-bold text-slate-500">
                        Aucune transaction Tranzak répertoriée pour cet élève dans les 30 derniers jours.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="p-3">Réf / Tx ID</th>
                            <th className="p-3">Montant</th>
                            <th className="p-3">Tranzak API</th>
                            <th className="p-3">Base Supabase</th>
                            <th className="p-3">Callback</th>
                            <th className="p-3">Diagnostic & Cause</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {comparisons.map((item: any, idx: number) => {
                            const isSuccess = item.tranzak_status === 'completed';
                            return (
                              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 font-bold text-slate-900">
                                  <div>{item.reference}</div>
                                  <span className="text-[10px] text-slate-400 block font-normal">
                                    Tx: {item.transaction_id}
                                  </span>
                                </td>
                                <td className="p-3 font-black text-slate-900 font-mono">
                                  {item.amount.toLocaleString()} <span className="text-[10px] text-slate-500">HTG</span>
                                  <span className="text-[9px] uppercase font-bold text-slate-500 block">
                                    {item.operator}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                                    isSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {item.tranzak_status}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {item.database_match ? (
                                    <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-100 text-blue-800">
                                      {item.database_match.status} ({item.database_match.source_table})
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-100 text-amber-800">
                                      Non répertorié
                                    </span>
                                  )}
                                </td>
                                <td className="p-3">
                                  {item.callback_received ? (
                                    <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                                      <CheckCircle2 size={12} />
                                      Reçu (OK)
                                    </span>
                                  ) : (
                                    <span className="text-amber-600 font-bold flex items-center gap-1 text-[11px]">
                                      <AlertTriangle size={12} />
                                      Non reçu
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 font-sans text-[11px] text-slate-600 leading-tight max-w-xs">
                                  {item.explanation}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'db_logs' && (
                <div className="space-y-2 font-mono text-xs">
                  <div className="text-[11px] font-sans font-bold text-slate-500 mb-2">
                    Logs extraits de la table <strong className="text-slate-800">{metrics?.db_source_table || 'transactions'}</strong> pour l'élève {student.id} :
                  </div>
                  {diagnosticsData?.raw_db_transactions?.length === 0 ? (
                    <p className="text-slate-500 text-xs italic">Aucune écriture trouvée en base pour cet élève.</p>
                  ) : (
                    <div className="space-y-2">
                      {diagnosticsData?.raw_db_transactions?.map((p: any) => (
                        <div key={p.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900">{p.reference_number || p.moncash_order_id || p.id}</span>
                            <span className="text-[10px] text-slate-500 block font-sans">
                              {p.payment_method || p.method} • {p.notes || 'Sans note'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-slate-900">{p.amount} HTG</span>
                            <span className="text-[10px] block font-bold text-emerald-700">{p.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'webhooks' && (
                <div className="space-y-2 font-mono text-xs">
                  <div className="text-[11px] font-sans font-bold text-slate-500 mb-2">
                    Historique des callbacks Tranzak interceptés par le serveur :
                  </div>
                  {diagnosticsData?.raw_webhook_callbacks?.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-sans">
                      <p className="font-bold">Aucun Webhook enregistré récemment.</p>
                      <p className="mt-1 text-slate-600">
                        Si un paiement a été validé sur Tranzak sans webhook, cela signifie que Tranzak n'a pas pu joindre l'URL callback ou que celle-ci n'est pas encore enregistrée dans le portail Tranzak. Le moteur de réconciliation automatique comble cette lacune en interrogeant directement l'API.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {diagnosticsData?.raw_webhook_callbacks?.map((log: any) => (
                        <div key={log.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900">{log.event_type} • {log.order_id}</span>
                            <span className="text-[10px] text-slate-500 block font-sans">
                              Date: {new Date(log.timestamp).toLocaleString('fr-FR')} • Signature: {log.signature_status}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-slate-900">{log.amount} {log.currency}</span>
                            <span className="text-[10px] block font-bold text-emerald-700">{log.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Guide explicatif */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-2.5 text-xs text-slate-600">
                <HelpCircle size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-800">
                    Pourquoi une transaction peut-elle être validée sur Tranzak mais absente de l'écran élève ?
                  </p>
                  <p className="text-[11.5px] leading-relaxed">
                    1. <strong>Interruption de la redirection :</strong> Si le payeur ferme la page Digicel MonCash après le débit sans attendre le retour automatique vers EduNova.<br />
                    2. <strong>Webhook non configuré sur Tranzak :</strong> Si l'URL <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">https://edunova-pro.tech/api/tranzak/webhook</code> n'est pas inscrite dans le dashboard Tranzak, Tranzak n'envoie pas de notification automatique.<br />
                    3. <strong>Solution garantie :</strong> Le bouton <em>"Résoudre & Synchroniser"</em> interroge directement l'API Tranzak, lit la transaction de 20 HTG (ou tout autre montant) et crédite instantanément la base Supabase.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pied de page */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-sans">
            Établissement : Collège des Innovations (EduNova PRO)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Fermer le diagnostic
          </button>
        </div>
      </div>
    </div>
  );
};
