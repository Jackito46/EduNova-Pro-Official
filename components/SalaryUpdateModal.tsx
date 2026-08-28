
import React, { useState } from 'react';
import { X, DollarSign, Calendar, FileText, Loader2 } from 'lucide-react';
import { StaffMember, UserProfile } from '../types';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';

interface SalaryUpdateModalProps {
  staff: StaffMember;
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SalaryUpdateModal: React.FC<SalaryUpdateModalProps> = ({ staff, user, isOpen, onClose, onSuccess }) => {
  const { currentCampusId } = useSchool();
  const [newAmount, setNewAmount] = useState(staff.amount.toString());
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentCampusId && staff.campus_id && staff.campus_id !== currentCampusId) {
      toast.error("Action interdite : Cet employé appartient à un autre campus.");
      return;
    }
    
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Veuillez entrer un montant valide.");
      return;
    }

    if (!reason.trim()) {
      toast.error("Le motif est obligatoire pour la traçabilité.");
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
          change_reason: reason,
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
          reason,
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Mise à jour Salaire</h3>
              <p className="text-xs text-gray-500">{formatStudentName(staff.last_name, staff.first_name).fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Salaire Actuel</span>
              <span className="text-lg font-mono font-bold text-gray-900">{staff.amount.toLocaleString()} <span className="text-xs">HTG</span></span>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-500 uppercase block mb-1">Nouveau Salaire</span>
              <input 
                type="number"
                step="0.01"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-lg font-mono font-bold text-indigo-700 focus:ring-0 placeholder:text-indigo-200"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" /> Date d'effet
            </label>
            <input 
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileText size={16} className="text-gray-400" /> Motif de l'ajustement
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
              placeholder="Ex: Prime de performance, Promotion, Ajustement annuel..."
              required
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalaryUpdateModal;
