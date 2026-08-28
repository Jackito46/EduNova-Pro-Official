import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, MessageSquare, MessageCircle,
  Send, Mail, Phone, AlertTriangle,
  ChevronRight, Download, RefreshCw,
  Clock, DollarSign, ArrowRight, ExternalLink
} from 'lucide-react';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { formatStudentName } from '../utils/formatters';

interface Debtor {
  id: string;
  first_name: string;
  last_name: string;
  parent_phone: string;
  parent_email: string;
  class_name: string;
  total_due: number;
  paid: number;
  balance: number;
}

const DebtorsListView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { terminology, currentCampusId, school } = useSchool();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [classes, setClasses] = useState<any[]>([]);
  
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showBulkReminderModal, setShowBulkReminderModal] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  const [reminderType, setReminderType] = useState<'sms' | 'email' | 'whatsapp'>('whatsapp');
  const [reminderMessage, setReminderMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch active academic year
      const { data: activeYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', user.school_id)
        .or('is_active.eq.true,status.eq.ACTIVE')
        .maybeSingle();

      if (!activeYear) {
        setLoading(false);
        return;
      }

      // 2. Fetch all students and their classes
      let studentsQuery = supabase
        .from('students')
        .select('*, class:classes!inner(id, name, campus_id)')
        .eq('school_id', user.school_id);
        
      if (currentCampusId) {
        studentsQuery = studentsQuery.eq('class.campus_id', currentCampusId);
      }
      
      const { data: students } = await studentsQuery;

      // 3. Fetch all payments for the active year
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('academic_year_id', activeYear.id)
        .neq('status', 'ANNULE');

      // 4. Fetch fee plans
      const { data: plans } = await supabase
        .from('fee_plans')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('academic_year_id', activeYear.id);

      // 5. Fetch enrollments (for discounts/additions)
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('academic_year_id', activeYear.id);

      // 5.5 Fetch all previous enrollments to identify re-enrolled students
      const { data: allPrevEnrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('school_id', user.school_id)
        .neq('academic_year_id', activeYear.id);
      
      const reenrollSet = new Set(allPrevEnrollments?.map(e => e.student_id) || []);

      if (students && plans) {
        const plansMap = new Map(plans.map(p => [p.class_id, p]));
        const enrollmentsMap = new Map(enrollments?.map(e => [e.student_id, e]));
        
        const debtorsList: Debtor[] = [];
        
        students.forEach(s => {
          const plan = plansMap.get(s.class_id);
          if (!plan) return;

          const enrollment = enrollmentsMap.get(s.id);
          const isReenroll = reenrollSet.has(s.id);
          
          const baseTuition = Number(plan.tuition_fee || 0);
          const baseInscription = isReenroll ? Number(plan.reenrollment_fee || 0) : Number(plan.inscription_fee || 0);
          const baseMisc = plan.is_misc_mandatory ? Number(plan.misc_fee_htg || 0) : 0;
          
          const discount = Number(s.discount_amount || 0) + Number(enrollment?.tuition_discount || 0);
          const addition = Number(enrollment?.tuition_addition || 0);
          const originalDue = baseTuition + baseInscription + baseMisc + addition;
          
          const studentPayments = payments?.filter(p => p.student_id === s.id) || [];
          const paid = studentPayments.reduce((acc, p) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0);
          
          const totalDue = Math.max(paid, originalDue - discount);
          const balance = Math.max(0, totalDue - paid);
          
          if (balance > 0) {
            debtorsList.push({
              id: s.id,
              first_name: s.first_name,
              last_name: s.last_name,
              parent_phone: s.parent_phone,
              parent_email: s.parent_email,
              class_name: s.class?.name || 'N/A',
              total_due: totalDue,
              paid: paid,
              balance: balance
            });
          }
        });

        setDebtors(debtorsList);
        
        // Extract unique classes
        const uniqueClasses = Array.from(new Set(debtorsList.map(d => d.class_name)));
        setClasses(uniqueClasses);
      }
    } catch (err: any) {
      toast.error("Erreur lors du chargement des débiteurs: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredDebtors = debtors.filter(d => {
    const matchesSearch = formatStudentName(d.last_name, d.first_name).fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'ALL' || d.class_name === selectedClass;
    return matchesSearch && matchesClass;
  });

  const handleSendReminder = async () => {
    if (!selectedDebtor) return;
    setIsSending(true);
    try {
      // Log the communication
      const { data: logData, error: logError } = await supabase
        .from('communication_logs')
        .insert({
          school_id: user.school_id,
          sender_id: user.id,
          type: reminderType,
          recipient_type: 'individual',
          recipient_count: 1,
          content: reminderMessage,
          status: 'sent'
        })
        .select('id')
        .single();

      if (logError) throw logError;

      await supabase.from('communication_recipients').insert({
        log_id: logData.id,
        recipient_id: selectedDebtor.id,
        recipient_name: formatStudentName(selectedDebtor.last_name, selectedDebtor.first_name).fullName,
        recipient_contact: reminderType === 'email' ? selectedDebtor.parent_email : selectedDebtor.parent_phone,
        status: 'sent'
      });

      if (reminderType === 'whatsapp' && selectedDebtor.parent_phone) {
        let cleanPhone = selectedDebtor.parent_phone.replace(/\D/g, '');
        if (cleanPhone.length === 8) cleanPhone = '509' + cleanPhone;
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(reminderMessage)}`;
        window.open(waUrl, '_blank');
      }

      toast.success(`Relance ${reminderType.toUpperCase()} envoyée/générée pour ${formatStudentName(selectedDebtor.last_name, selectedDebtor.first_name).firstName}`);
      setShowReminderModal(false);
    } catch (err: any) {
      toast.error("Erreur d'envoi: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendBulkReminders = async () => {
    if (filteredDebtors.length === 0) return;
    setIsSending(true);
    try {
      const { data: logData, error: logError } = await supabase
        .from('communication_logs')
        .insert({
          school_id: user.school_id,
          sender_id: user.id,
          type: reminderType,
          recipient_type: 'group',
          recipient_count: filteredDebtors.length,
          content: reminderMessage,
          status: 'sent'
        })
        .select('id')
        .single();

      if (logError) throw logError;

      const recipients = filteredDebtors.map(d => ({
        log_id: logData.id,
        recipient_id: d.id,
        recipient_name: formatStudentName(d.last_name, d.first_name).fullName,
        recipient_contact: reminderType === 'sms' ? d.parent_phone : d.parent_email,
        status: 'sent'
      }));

      await supabase.from('communication_recipients').insert(recipients);

      toast.success(`${filteredDebtors.length} relances envoyées avec succès`);
      setShowBulkReminderModal(false);
    } catch (err: any) {
      toast.error("Erreur d'envoi groupé: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-600/20">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Liste des Débiteurs</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Recouvrement & Relances Automatisées</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={fetchData}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => {
              setReminderMessage(`EduNova: Rappel de paiement. Vous avez un solde en attente. Merci de régulariser au plus vite.`);
              setShowBulkReminderModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 font-bold text-xs"
          >
            <Send size={16} /> Relance Groupée
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder={`Rechercher un ${terminology.student.toLowerCase()}...`}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select 
            className="bg-slate-50 border-none rounded-xl text-xs font-bold py-2.5 px-4 focus:ring-2 focus:ring-rose-500"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="ALL">Toutes les Classes</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Debtors Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{terminology.student}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Classe</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Dû Total</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Déjà Payé</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Solde</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-slate-300 mx-auto" />
                    <p className="text-slate-400 text-xs font-bold mt-4">Calcul des balances en cours...</p>
                  </td>
                </tr>
              ) : filteredDebtors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Users className="w-8 h-8 text-slate-200 mx-auto" />
                    <p className="text-slate-400 text-xs font-bold mt-4">Aucun débiteur trouvé</p>
                  </td>
                </tr>
              ) : (
                filteredDebtors.map((debtor) => (
                  <tr key={debtor.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-black text-slate-600">
                          {debtor.last_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{formatStudentName(debtor.last_name, debtor.first_name).fullName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {debtor.parent_phone && <span className="text-[9px] text-slate-400 flex items-center gap-1"><Phone size={10} /> {debtor.parent_phone}</span>}
                            {debtor.parent_email && <span className="text-[9px] text-slate-400 flex items-center gap-1"><Mail size={10} /> {debtor.parent_email}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase">
                        {debtor.class_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-xs font-bold text-slate-600 font-mono">{debtor.total_due.toLocaleString()} G</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-xs font-bold text-emerald-600 font-mono">{debtor.paid.toLocaleString()} G</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-black text-rose-600 font-mono">{debtor.balance.toLocaleString()} G</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {debtor.parent_phone && (
                          <a
                            href={`https://wa.me/${debtor.parent_phone.replace(/\D/g, '').length === 8 ? '509' + debtor.parent_phone.replace(/\D/g, '') : debtor.parent_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour, rappel de paiement pour ${formatStudentName(debtor.last_name, debtor.first_name).firstName}. Solde dû: ${debtor.balance.toLocaleString()} HTG. Merci de contacter la direction de ${school?.name || 'l\'établissement'}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Lancer WhatsApp Direct"
                          >
                            <MessageCircle size={16} />
                          </a>
                        )}
                        <button 
                          onClick={() => {
                            setSelectedDebtor(debtor);
                            setReminderMessage(`EduNova: Rappel de paiement pour ${formatStudentName(debtor.last_name, debtor.first_name).firstName}. Solde dû: ${debtor.balance.toLocaleString()} HTG. Merci de régulariser au plus vite.`);
                            setShowReminderModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Envoyer une relance (Modal)"
                        >
                          <MessageSquare size={16} />
                        </button>
                        <button 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Voir dossier"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reminder Modal */}
      {showReminderModal && selectedDebtor && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                  <MessageSquare size={20} />
                </div>
                <h3 className="font-bold text-gray-900">Relance de Paiement</h3>
              </div>
              <button onClick={() => setShowReminderModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <RefreshCw size={20} className="rotate-45" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                <button 
                  onClick={() => setReminderType('whatsapp')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${reminderType === 'whatsapp' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-emerald-700'}`}
                >
                  <MessageCircle size={14} /> WhatsApp
                </button>
                <button 
                  onClick={() => setReminderType('sms')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${reminderType === 'sms' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-600 hover:text-amber-700'}`}
                >
                  <MessageSquare size={14} /> SMS
                </button>
                <button 
                  onClick={() => setReminderType('email')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${reminderType === 'email' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-blue-700'}`}
                >
                  <Mail size={14} /> Email
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Message de relance</label>
                <textarea 
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none min-h-[120px] resize-none"
                />
                <p className="text-[10px] text-gray-500 font-medium">
                  Destinataire ({reminderType.toUpperCase()}) : <strong className="text-slate-800">{reminderType === 'email' ? selectedDebtor.parent_email || 'Non renseigné' : selectedDebtor.parent_phone || 'Non renseigné'}</strong>
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowReminderModal(false)}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button 
                  disabled={isSending || (reminderType === 'email' ? !selectedDebtor.parent_email : !selectedDebtor.parent_phone)}
                  onClick={handleSendReminder}
                  className={`flex-1 py-3 font-bold text-xs rounded-xl text-white shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    reminderType === 'whatsapp' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'
                  }`}
                >
                  {isSending ? <RefreshCw size={16} className="animate-spin" /> : reminderType === 'whatsapp' ? <ExternalLink size={16} /> : <Send size={16} />}
                  {reminderType === 'whatsapp' ? 'Ouvrir WhatsApp' : 'Envoyer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Reminder Modal */}
      {showBulkReminderModal && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                  <Send size={20} />
                </div>
                <h3 className="font-bold text-gray-900">Relance Groupée ({filteredDebtors.length})</h3>
              </div>
              <button onClick={() => setShowBulkReminderModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <RefreshCw size={20} className="rotate-45" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 mb-4">
                <p className="text-xs text-rose-800 font-medium">
                  Vous allez envoyer un message à <strong>{filteredDebtors.length}</strong> parents de / d' {terminology.student.toLowerCase()}s ayant des arriérés.
                </p>
              </div>

              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                  onClick={() => setReminderType('sms')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${reminderType === 'sms' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500'}`}
                >
                  SMS
                </button>
                <button 
                  onClick={() => setReminderType('email')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${reminderType === 'email' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500'}`}
                >
                  Email
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Message commun</label>
                <textarea 
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 outline-none min-h-[120px] resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowBulkReminderModal(false)}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button 
                  disabled={isSending || filteredDebtors.length === 0}
                  onClick={handleSendBulkReminders}
                  className="flex-1 py-3 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  Envoyer à tous
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtorsListView;
