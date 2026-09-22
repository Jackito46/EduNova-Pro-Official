
import React, { useState, useMemo } from 'react';
import { X, DollarSign, Calendar, FileText, Loader2, TrendingUp, TrendingDown, Check, Sparkles, Building2 } from 'lucide-react';
import { StaffMember, UserProfile } from '../types';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { AuditLogger } from '../utils/auditLogger';
import { isAutonomousAccount } from '../utils/autonomousAdminGuard';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';
import { DatePickerPill } from './DatePickerPill';

interface SalaryUpdateModalProps {
  staff: StaffMember;
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COMMON_REASONS = [
  'Ajustement annuel',
  'Promotion / Échelon',
  'Revalorisation grille',
  'Prime de responsabilité',
  'Avenant contractuel'
];

const SalaryUpdateModal: React.FC<SalaryUpdateModalProps> = ({ staff, user, isOpen, onClose, onSuccess }) => {
  const { currentCampusId, terminology } = useSchool();
  const [newAmount, setNewAmount] = useState(staff.amount.toString());
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numericNewAmount = parseFloat(newAmount) || 0;
  const currentAmount = Number(staff.amount) || 0;
  const delta = numericNewAmount - currentAmount;
  const deltaPercent = currentAmount > 0 ? (delta / currentAmount) * 100 : 0;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isAutonomousAccount(user)) {
      toast.error("Action verrouillée : La modification des salaires contractuels requiert un compte Administrateur certifié RH.");
      return;
    }

    if (currentCampusId && staff.campus_id && staff.campus_id !== currentCampusId) {
      toast.error("Action interdite : Cet employé appartient à un autre campus.");
      return;
    }
    
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Veuillez entrer un montant valide supérieur à 0.");
      return;
    }

    if (!reason.trim()) {
      toast.error("Le motif est obligatoire pour garantir la traçabilité comptable.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Record in history
      const { error: historyError } = await supabase
        .from('staff_salary_history')
        .insert({
          school_id: user.school_id,
          staff_id: staff.id,
          old_amount: staff.amount,
          new_amount: amount,
          change_reason: reason.trim(),
          effective_date: effectiveDate,
          created_by: user.id
        });

      if (historyError) throw historyError;

      // 2. Update staff table
      const { error: staffError } = await supabase
        .from('staff')
        .update({ amount: amount })
        .eq('id', staff.id)
        .eq('school_id', user.school_id);

      if (staffError) throw staffError;

      // 3. Log to global audit
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'SALARY_UPDATE',
        entity_type: 'staff',
        entity_id: staff.id,
        details: {
          staff_name: formatStudentName(staff.last_name, staff.first_name).fullName,
          old_amount: staff.amount,
          new_amount: amount,
          reason: reason.trim(),
          effective_date: effectiveDate
        }
      });

      toast.success(`Salaire de ${staff.first_name} mis à jour avec succès.`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erreur lors de la mise à jour du salaire.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200/90 flex flex-col max-h-[92vh] transition-all">
        
        {/* Header compact & ergonomique */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/60 shadow-2xs">
              <DollarSign size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight truncate">
                Mise à jour Salaire
              </h3>
              <p className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">
                {formatStudentName(staff.last_name, staff.first_name).fullName}
                {staff.role && <span className="ml-1 text-slate-400">• {staff.role}</span>}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-200/60 rounded-xl transition-colors shrink-0"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps du formulaire compact & dense */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Cartes Comparatives Salaire Actuel vs Nouveau Salaire */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Actuel */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actuel</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-200/70 text-slate-700 rounded-md">
                  {staff.pay_type || 'Mensuel'}
                </span>
              </div>
              <div className="mt-1.5">
                <span className="text-base sm:text-lg font-mono font-black text-slate-800">
                  {currentAmount.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-500 ml-1">HTG</span>
              </div>
            </div>

            {/* Nouveau Salaire avec Input */}
            <div className={`p-3 rounded-xl border-2 transition-all flex flex-col justify-between ${
              delta !== 0 
                ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/10' 
                : 'bg-indigo-50/40 border-indigo-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                  Nouveau Salaire *
                </span>
                {delta !== 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                    delta > 0 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}>
                    {delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {delta > 0 ? `+${deltaPercent.toFixed(1)}%` : `${deltaPercent.toFixed(1)}%`}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline">
                <input 
                  type="number"
                  step="0.01"
                  min="1"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-base sm:text-lg font-mono font-black text-indigo-900 focus:ring-0 placeholder:text-indigo-300 outline-none"
                  placeholder="0.00"
                  autoFocus
                  required
                />
                <span className="text-xs font-black text-indigo-700 shrink-0 ml-1">HTG</span>
              </div>
            </div>
          </div>

          {/* Indicateur de variation explicite */}
          {delta !== 0 && (
            <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-between ${
              delta > 0 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <span>Différence nette d'ajustement :</span>
              <span className="font-mono font-bold">
                {delta > 0 ? `+${delta.toLocaleString()} HTG` : `${delta.toLocaleString()} HTG`}
              </span>
            </div>
          )}

          {/* Date d'effet (Harmonisée Style Pilule Feuille de Présence) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 tracking-tight flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-indigo-600" />
                Date d'effet de l'ajustement *
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                Application paie
              </span>
            </label>
            <DatePickerPill
              selectedDate={effectiveDate}
              onSelectDate={(newDate) => setEffectiveDate(newDate)}
              variant="field"
              size="sm"
              colorScheme="indigo"
              showShortcuts={true}
              showTodayBadge={true}
              className="w-full"
            />
          </div>

          {/* Motif de l'ajustement (Haute Lisibilité & Anti-Texte Gris) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="salary_reason" className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <FileText size={13} className="text-indigo-600" />
                Motif de l'ajustement <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10.5px] font-semibold text-slate-600">
                Obligatoire pour l'audit
              </span>
            </div>

            {/* Paliers / Suggestions rapides en style pilules interactives */}
            <div className="flex flex-wrap gap-1">
              {COMMON_REASONS.map((preset) => {
                const isSelected = reason === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-200'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            {/* Zone de texte haute lisibilité (Texte noir soutenu, fond doux, bordure nette) */}
            <textarea
              id="salary_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full bg-slate-50/90 hover:bg-white focus:bg-white text-slate-900 font-semibold border-2 border-slate-200 focus:border-indigo-600 rounded-xl px-3 py-2 text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400 transition-all resize-none shadow-2xs leading-relaxed"
              placeholder="Ex: Prime de performance annuelle, Promotion au grade supérieur, Revalorisation conventionnelle..."
              required
            />
          </div>

          {/* Boutons d'action compacts */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim() || numericNewAmount <= 0}
              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Confirmer la révision</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalaryUpdateModal;

