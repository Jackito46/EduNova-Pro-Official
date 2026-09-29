import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Send, X, Loader2, CheckCircle2, FileText, Info } from 'lucide-react';
import { UserProfile, PendingActionType } from '../types';
import { supabase } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';

interface DoubleRegardSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  title: string;
  actionType: PendingActionType | string;
  description: string;
  targetEntityType: string;
  targetEntityId?: string | null;
  payload: Record<string, any>;
  campusId?: string | null;
  onSuccess: () => void;
}

export const DoubleRegardSubmitModal: React.FC<DoubleRegardSubmitModalProps> = ({
  isOpen,
  onClose,
  user,
  title,
  actionType,
  description,
  targetEntityType,
  targetEntityId,
  payload,
  campusId,
  onSuccess
}) => {
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setJustification('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) {
      setError("Veuillez renseigner une note de justification ou un motif explicatif pour l'administrateur valideur.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const enrichedPayload = {
        ...payload,
        justification: justification.trim(),
        submitted_at: new Date().toISOString()
      };

      const { data, error: insertError } = await supabase
        .from('pending_actions')
        .insert([
          {
            school_id: user.school_id,
            campus_id: campusId || user.campus_id || null,
            action_type: actionType,
            action_title: title,
            description: description,
            target_entity_type: targetEntityType,
            target_entity_id: targetEntityId || null,
            payload: enrichedPayload,
            status: 'PENDING',
            requester_id: user.id,
            requester_name: user.full_name,
            requester_email: user.email,
            requester_role: user.role,
            is_autonomous_requester: true
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      // Log the event for compliance and security audit trail
      await AuditLogger.log({
        school_id: user.school_id || '',
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'pending_action',
        entity_id: data?.id,
        details: {
          action_type: actionType,
          action_title: title,
          target_entity_type: targetEntityType,
          target_entity_id: targetEntityId,
          justification: justification.trim(),
          is_autonomous: true
        }
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erreur lors de la soumission au Double Regard :", err);
      setError(err.message || "Une erreur est survenue lors de la soumission au Double Regard.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-5 sm:p-7 space-y-5 border border-slate-100 relative overflow-hidden"
        >
          {/* Accent decoration */}
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-amber-100 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-start justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-amber-500/10 text-amber-700 border border-amber-200 rounded-2xl flex items-center justify-center shrink-0">
                <ShieldAlert size={24} />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                  Procédure Double Regard
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 leading-snug">
                  {title}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Information box */}
          <div className="p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-2xl text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <span>Compte Opérateur en Mode Autonome</span>
            </div>
            <p className="text-amber-900/90 leading-relaxed font-medium">
              Conformément à la politique de conformité financière et RH de l'établissement, cette action critique ne peut être appliquée directement. Elle nécessite la validation d'un Administrateur certifié RH via le flux <strong>Double Regard</strong>.
            </p>
          </div>

          {/* Description of action */}
          {description && (
            <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <FileText size={14} className="text-slate-500" />
                <span>Détail de l'opération</span>
              </div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                {description}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Note de justification / Motif de la demande <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
                required
                placeholder="Précisez pourquoi cette action est demandée (ex: Erreur de saisie constatée lors de l'émargement, régularisation mensuelle...)"
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-hidden resize-none transition-all placeholder:text-slate-400 font-medium"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Cette note sera transmise aux administrateurs pour examen et approbation.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || !justification.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Transmission...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Soumettre au Double Regard</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DoubleRegardSubmitModal;
