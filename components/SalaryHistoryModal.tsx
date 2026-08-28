
import React, { useState, useEffect } from 'react';
import { History, X, ArrowUpRight, ArrowDownRight, User, Calendar, FileText, Loader2 } from 'lucide-react';
import { StaffMember, StaffSalaryHistory, UserProfile } from '../types';
import { supabase } from '../supabase';
import { formatStudentName } from '../utils/formatters';

interface SalaryHistoryModalProps {
  staff: StaffMember;
  isOpen: boolean;
  onClose: () => void;
}

const SalaryHistoryModal: React.FC<SalaryHistoryModalProps> = ({ staff, isOpen, onClose }) => {
  const [history, setHistory] = useState<StaffSalaryHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, staff.id]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from('staff_salary_history')
        .select(`
          *,
          creator:profiles(full_name)
        `)
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false });

      if (error) {
        const { data: rawData, error: rawError } = await supabase
          .from('staff_salary_history')
          .select('*')
          .eq('staff_id', staff.id)
          .order('created_at', { ascending: false });

        if (rawError) throw rawError;
        data = rawData;
      }

      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching salary history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <History size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Historique Salarial</h3>
              <p className="text-xs text-gray-500">{formatStudentName(staff.last_name, staff.first_name).fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-sm text-gray-500 font-medium">Récupération des données...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <History size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium italic">Aucun historique d'ajustement pour ce collaborateur.</p>
            </div>
          ) : (
            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
              {history.map((record) => (
                <div key={record.id} className="relative flex items-start group">
                  <div className="absolute left-0 mt-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-indigo-100 shadow-sm z-10 group-hover:scale-110 transition-transform">
                    {record.new_amount > record.old_amount ? (
                      <ArrowUpRight size={18} className="text-emerald-500" />
                    ) : (
                      <ArrowDownRight size={18} className="text-rose-500" />
                    ) }
                  </div>
                  
                  <div className="ml-14 flex-1 bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-mono font-bold text-indigo-700">
                          {record.new_amount.toLocaleString()} HTG
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <span className="line-through">{record.old_amount.toLocaleString()}</span>
                          <span className="text-gray-300">→</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium">
                        <span className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
                          <Calendar size={12} /> {new Date(record.effective_date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                          <User size={12} /> {record.creator?.full_name || 'Inconnu'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex gap-3">
                      <FileText size={16} className="text-gray-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-600 italic">
                        {record.change_reason}
                      </p>
                    </div>

                    <div className="mt-3 text-[10px] text-gray-400 flex items-center justify-end font-mono">
                      MAJ: {new Date(record.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalaryHistoryModal;
