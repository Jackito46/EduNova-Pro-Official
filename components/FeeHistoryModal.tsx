import React, { useState, useEffect } from 'react';
import { X, History as HistoryIcon, Clock, User, ArrowRight, School, AlertTriangle, Layers, Sparkles } from 'lucide-react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';

interface FeeHistoryModalProps {
  user: UserProfile;
  planId: string;
  className: string;
  onClose: () => void;
}

const FeeHistoryModal: React.FC<FeeHistoryModalProps> = ({ user, planId, className, onClose }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        let { data, error } = await supabase
          .from('audit_logs')
          .select(`
            *,
            profiles:user_id(id, first_name, last_name, full_name, role)
          `)
          .eq('school_id', user.school_id)
          .eq('entity_type', 'fee_plan')
          .eq('entity_id', planId)
          .order('created_at', { ascending: false });

        if (error) {
          // Fallback: fetch logs without relation join
          const { data: rawLogs, error: rawError } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('school_id', user.school_id)
            .eq('entity_type', 'fee_plan')
            .eq('entity_id', planId)
            .order('created_at', { ascending: false });

          if (rawError) throw rawError;

          if (rawLogs && rawLogs.length > 0) {
            const userIds = Array.from(new Set(rawLogs.map(l => l.user_id).filter(Boolean)));
            if (userIds.length > 0) {
              const { data: profs } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, full_name, role')
                .in('id', userIds);

              const profMap = new Map(profs?.map(p => [p.id, p]));
              data = rawLogs.map(l => ({
                ...l,
                profiles: profMap.get(l.user_id) || null
              }));
            } else {
              data = rawLogs;
            }
          } else {
            data = [];
          }
        }

        setHistory(data || []);
      } catch (error) {
        console.error('Error fetching history:', error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    if (planId) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [planId, user.school_id]);

  const formatFee = (htg?: number | string, usd?: number | string) => {
    const hVal = typeof htg === 'string' ? parseFloat(htg) : (htg || 0);
    const uVal = typeof usd === 'string' ? parseFloat(usd) : (usd || 0);
    const parts = [];
    if (hVal > 0) parts.push(`${hVal.toLocaleString('fr-FR')} HTG`);
    if (uVal > 0) parts.push(`$${uVal.toLocaleString('en-US')} USD`);
    if (parts.length === 0) return '0 HTG';
    return parts.join(' + ');
  };

  const renderChangesOrSnapshot = (log: any) => {
    const details = log.details || {};
    const oldData = details.old_data;
    const newData = details.new_data || details;

    // 1. Propagation log
    if (details.propagation_type) {
      const typeLabels: Record<string, string> = {
        inscription: "Frais d'Inscription (Nouveaux)",
        reenrollment: "Frais de Réinscription (Anciens)",
        tuition: "Frais de Scolarité (Frais Académiques)",
        misc: "Frais Divers (Annexes/Obligatoires)"
      };
      const label = typeLabels[details.propagation_type] || details.propagation_type;
      const amtStr = `${(details.amount || 0).toLocaleString()} ${details.currency || 'HTG'}`;

      return (
        <div className="bg-blue-50/80 border border-blue-200/80 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
            <Sparkles size={14} className="text-blue-600 shrink-0" />
            <span>Propagation Globale Effectuée</span>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed font-medium">
            Le tarif <strong>{label}</strong> a été répercuté simultanément avec le montant <strong>{amtStr}</strong> sur l'ensemble des classes ({details.classes_count || 'toutes'}).
          </p>
        </div>
      );
    }

    // 2. If oldData exists and newData exists, compute complete diffs
    if (oldData && newData && typeof oldData === 'object' && typeof newData === 'object') {
      const diffs: React.ReactNode[] = [];

      // Check Inscription
      const oldIns = formatFee(oldData.inscription_fee, oldData.inscription_fee_usd);
      const newIns = formatFee(newData.inscription_fee, newData.inscription_fee_usd);
      if (oldIns !== newIns) {
        diffs.push(
          <div key="ins" className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
            <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
              📝 Frais d'Inscription (Nouveaux)
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-slate-500 line-through">{oldIns}</span>
              <ArrowRight size={14} className="text-blue-400 shrink-0" />
              <span className="font-extrabold text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200">{newIns}</span>
            </div>
          </div>
        );
      }

      // Check Reenrollment
      const oldReins = formatFee(oldData.reenrollment_fee, oldData.reenrollment_fee_usd);
      const newReins = formatFee(newData.reenrollment_fee, newData.reenrollment_fee_usd);
      if (oldReins !== newReins) {
        diffs.push(
          <div key="reins" className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider block mb-1">
              🔄 Frais de Réinscription (Anciens)
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-slate-500 line-through">{oldReins}</span>
              <ArrowRight size={14} className="text-indigo-400 shrink-0" />
              <span className="font-extrabold text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200">{newReins}</span>
            </div>
          </div>
        );
      }

      // Check Tuition
      const oldTui = formatFee(oldData.tuition_fee, oldData.tuition_fee_usd);
      const newTui = formatFee(newData.tuition_fee, newData.tuition_fee_usd);
      if (oldTui !== newTui) {
        diffs.push(
          <div key="tui" className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block mb-1">
              🎓 Scolarité (Frais Académiques)
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-slate-500 line-through">{oldTui}</span>
              <ArrowRight size={14} className="text-emerald-400 shrink-0" />
              <span className="font-extrabold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-200">{newTui}</span>
            </div>
          </div>
        );
      }

      // Check Misc
      const oldMisc = formatFee(oldData.misc_fee_htg, oldData.misc_fee_usd);
      const newMisc = formatFee(newData.misc_fee_htg, newData.misc_fee_usd);
      const oldMiscMand = oldData.is_misc_mandatory;
      const newMiscMand = newData.is_misc_mandatory;
      if (oldMisc !== newMisc || oldMiscMand !== newMiscMand) {
        diffs.push(
          <div key="misc" className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
            <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block mb-1">
              🏷️ Frais Divers / Annexes
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-slate-500 line-through">
                {oldMisc} {oldMiscMand !== undefined && `(${oldMiscMand ? 'Obligatoire' : 'Optionnel'})`}
              </span>
              <ArrowRight size={14} className="text-amber-400 shrink-0" />
              <span className="font-extrabold text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">
                {newMisc} {newMiscMand !== undefined && `(${newMiscMand ? 'Obligatoire' : 'Optionnel'})`}
              </span>
            </div>
          </div>
        );
      }

      // Check Payment Structure / Échéancier
      const oldPay = Array.isArray(oldData.payment_structure) ? oldData.payment_structure : [];
      const newPay = Array.isArray(newData.payment_structure) ? newData.payment_structure : [];
      if (JSON.stringify(oldPay) !== JSON.stringify(newPay)) {
        diffs.push(
          <div key="pay" className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 space-y-2">
            <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block">
              📅 Échéancier de Paiement Modifié ({newPay.length} tranche(s))
            </span>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {newPay.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-purple-100 font-medium">
                  <span className="text-slate-700 text-[11px] font-bold">{item.label || `Tranche ${idx + 1}`}</span>
                  <div className="flex items-center gap-2">
                    {item.due_date && <span className="text-[10px] text-slate-400">Échéance: {item.due_date}</span>}
                    <span className="font-extrabold text-purple-900">{(item.amount || 0).toLocaleString()} HTG</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      if (diffs.length > 0) {
        return <div className="space-y-2.5">{diffs}</div>;
      }
    }

    // 3. Fallback / Snapshot of current configuration (when no diff detected or old_data is missing or CREATE action)
    const target = newData || log.details || {};
    const insStr = formatFee(target.inscription_fee, target.inscription_fee_usd);
    const reinsStr = formatFee(target.reenrollment_fee, target.reenrollment_fee_usd);
    const tuiStr = formatFee(target.tuition_fee, target.tuition_fee_usd);
    const miscStr = formatFee(target.misc_fee_htg, target.misc_fee_usd);
    const payStruct = Array.isArray(target.payment_structure) ? target.payment_structure : [];

    return (
      <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
        <div className="font-extrabold text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
          <span>📋 Grille Tarifaire Enregistrée</span>
          {target.is_local_deviation && (
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[9px] font-black">Déviation Locale</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-slate-800">
          <div className="bg-white p-2 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block">Inscription (Nouveaux)</span>
            <span className="font-extrabold text-slate-900">{insStr}</span>
          </div>

          <div className="bg-white p-2 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block">Réinscription (Anciens)</span>
            <span className="font-extrabold text-slate-900">{reinsStr}</span>
          </div>

          <div className="bg-white p-2 rounded-lg border border-slate-100 col-span-2">
            <span className="text-[10px] text-slate-400 font-bold block">Scolarité (Frais Académiques)</span>
            <span className="font-extrabold text-emerald-700 text-sm">{tuiStr}</span>
          </div>

          {(miscStr !== '0 HTG') && (
            <div className="bg-white p-2 rounded-lg border border-slate-100 col-span-2">
              <span className="text-[10px] text-slate-400 font-bold block">Frais Divers</span>
              <span className="font-extrabold text-amber-800">{miscStr}</span>
              {target.is_misc_mandatory !== undefined && (
                <span className="ml-2 text-[10px] text-slate-500 font-semibold">({target.is_misc_mandatory ? 'Obligatoire' : 'Optionnel'})</span>
              )}
            </div>
          )}
        </div>

        {payStruct.length > 0 && (
          <div className="pt-1 border-t border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-500 block mb-1.5">Échéancier ({payStruct.length} versements) :</span>
            <div className="space-y-1">
              {payStruct.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-white px-2.5 py-1 rounded border border-slate-100 text-[11px]">
                  <span className="font-semibold text-slate-700">{p.label || `Tranche ${i+1}`}</span>
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    {p.due_date && <span className="text-[9px] text-slate-400 font-normal">{p.due_date}</span>}
                    <span>{(p.amount || 0).toLocaleString()} HTG</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-slate-900 text-white rounded-t-3xl border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-300 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
              <HistoryIcon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Historique Tarifaire Détaillé</h2>
              <p className="text-slate-300 text-xs flex items-center gap-1.5 mt-0.5 font-medium">
                <School size={14} className="text-emerald-400" /> Classe: <span className="font-bold text-white">{className}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70 space-y-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-medium text-sm animate-pulse">Chargement des entrées d'historique...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-400 mb-4 shadow-sm border border-slate-200">
                <HistoryIcon size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Aucun Historique Détecté</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                Aucun journal de modification n'a encore été enregistré pour cette grille tarifaire.
              </p>
            </div>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:left-5 before:h-full before:w-0.5 before:bg-slate-200/80">
              {history.map((log, index) => {
                const actor = log.profiles || log.actor;
                const actorName = actor 
                  ? (actor.full_name || `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || 'Utilisateur')
                  : 'Utilisateur';

                const details = log.details || {};
                const isDeviation = details.is_local_deviation || details.deviation_alert;
                const campusName = details.campus_name;

                return (
                  <div key={log.id || index} className="relative flex gap-4 items-start pl-1">
                    {/* Timeline Node Icon */}
                    <div className="w-9 h-9 rounded-full border-2 border-white bg-emerald-600 text-white shadow-md flex items-center justify-center shrink-0 z-10 mt-1">
                      <Clock size={16} />
                    </div>

                    {/* Timeline Card */}
                    <div className="flex-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                      {/* Top Meta info */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center font-black text-xs border border-slate-200">
                            {actorName.charAt(0).toUpperCase() || <User size={14} />}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 text-sm block leading-tight">
                              {actorName}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                log.action === 'CREATE' 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : log.action === 'DELETE' 
                                    ? 'bg-rose-100 text-rose-800' 
                                    : 'bg-blue-100 text-blue-800'
                              }`}>
                                {log.action === 'CREATE' ? 'Création' : log.action === 'DELETE' ? 'Suppression' : 'Mise à jour'}
                              </span>

                              {isDeviation && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertTriangle size={10} className="text-amber-600" /> Annexe
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] font-bold text-slate-600 block">
                            {new Date(log.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit', month: 'short', year: 'numeric'
                            })}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 block">
                            {new Date(log.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      {campusName && (
                        <div className="text-[10px] text-slate-500 font-semibold bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 flex items-center gap-1.5">
                          <Layers size={12} className="text-blue-500" /> Annexe concernée : <strong className="text-slate-800">{campusName}</strong>
                        </div>
                      )}

                      {/* Main Changed Details / Snapshot */}
                      {renderChangesOrSnapshot(log)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all active:scale-98 cursor-pointer shadow-md text-sm"
          >
            Fermer l'historique
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeeHistoryModal;

