import React, { useState } from 'react';
import { ShieldAlert, Send, X, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { PendingActionType, UserProfile } from '../types';
import { PendingActionsService } from '../services/pendingActionsService';
import { toast } from 'sonner';

interface DoubleRegardSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  user: UserProfile;
  actionType: PendingActionType;
  title: string;
  description: string;
  targetEntityType: string;
  targetEntityId?: string | null;
  payload: Record<string, any>;
  campusId?: string | null;
}

export const DoubleRegardSubmitModal: React.FC<DoubleRegardSubmitModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  user,
  actionType,
  title,
  description,
  targetEntityType,
  targetEntityId,
  payload,
  campusId
}) => {
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.school_id) {
      toast.error("Établissement manquant.");
      return;
    }

    setIsSubmitting(true);
    try {
      const fullDescription = justification.trim() 
        ? `${description}\n\nJustification du demandeur : ${justification.trim()}`
        : description;

      const res = await PendingActionsService.createPendingAction({
        school_id: user.school_id,
        campus_id: campusId !== undefined ? campusId : (user.campus_id || null),
        action_type: actionType,
        action_title: title,
        description: fullDescription,
        target_entity_type: targetEntityType,
        target_entity_id: targetEntityId || null,
        payload,
        requester: user
      });

      if (res.success) {
        toast.success("Demande transmise avec succès au Double Regard !", { duration: 5000 });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Erreur lors de la soumission au Double Regard.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur inattendue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* En-tête */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 p-5 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Double Regard Requis
              </h3>
              <p className="text-xs text-amber-100 font-medium">
                Principe des 4-Yeux • Validation par un Titulaire RH
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-bold">Opération sensible sous contrôle de quorum</p>
              <p className="text-amber-800 leading-relaxed">
                Votre profil opère sans dossier RH certifié ou l'action touche à des données critiques. Cette opération ne s'exécutera pas immédiatement : elle sera consignée dans la file du <strong>Double Regard</strong> et devra être validée par un <strong>Administrateur certifié RH</strong>.
              </p>
            </div>
          </div>

          <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Action demandée</div>
            <div className="text-sm font-black text-slate-800">{title}</div>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{description}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Justification / Note pour l'administrateur validateur (Optionnel)
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Expliquez la raison de cette modification ou joignez des précisions utiles..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              <Send size={14} />
              {isSubmitting ? "Transmission en cours..." : "Soumettre au Double Regard"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
