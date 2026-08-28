import React, { useState, useEffect } from 'react';
import { History, Mail, MessageSquare, MessageCircle, User, Calendar, Search, Filter, Loader2, Eye, ChevronRight, Users, Building2 } from 'lucide-react';
import { UserProfile, CommunicationLog } from '../types';
import { supabase } from '../supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSchool } from '../contexts/SchoolContext';

interface CommunicationHistoryProps {
  user: UserProfile;
}

const CommunicationHistory: React.FC<CommunicationHistoryProps> = ({ user }) => {
  const { currentCampusId } = useSchool();
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'email' | 'sms' | 'whatsapp'>('all');
  const [selectedLog, setSelectedLog] = useState<CommunicationLog | null>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('communication_settings')
        .select('email_from_name')
        .eq('school_id', user.school_id)
        .single();
      if (data) setSettings(data);
    };
    fetchSettings();
  }, [user.school_id]);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('communication_logs')
          .select('id, school_id, campus_id, sender_id, type, recipient_type, recipient_count, subject, content, status, created_at, sender:profiles(full_name), school_campuses(name)')
          .eq('school_id', user.school_id)
          .order('created_at', { ascending: false });

        if (currentCampusId) {
          query = query.eq('campus_id', currentCampusId);
        }
        
        const { data, error } = await query;
        
        if (data) {
          // Supabase join sometimes returns an array for 1:1 relations depending on schema hints
          const formattedLogs = (data as any[]).map(log => ({
            ...log,
            sender: Array.isArray(log.sender) ? log.sender[0] : log.sender,
            campus_name: log.school_campuses?.name || null
          }));
          setLogs(formattedLogs);
        }
      } catch (err) {
        console.error("Error fetching logs:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, [user.school_id, currentCampusId]);

  const fetchRecipients = async (logId: string) => {
    setIsLoadingRecipients(true);
    try {
      const { data, error } = await supabase
        .from('communication_recipients')
        .select('*')
        .eq('log_id', logId);
      
      if (data) setRecipients(data);
    } catch (err) {
      console.error("Error fetching recipients:", err);
    } finally {
      setIsLoadingRecipients(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = (log.subject?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.content.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || log.type === filterType;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium text-sm">Chargement de l'historique...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Rechercher dans l'historique..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition-all text-sm"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="text-slate-500" size={18} />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="flex-1 md:flex-none px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition-all text-sm font-medium"
          >
            <option value="all">Tous les types</option>
            <option value="email">Emails uniquement</option>
            <option value="sms">SMS uniquement</option>
            <option value="whatsapp">WhatsApp uniquement</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logs List */}
        <div className="lg:col-span-2 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto">
                <History size={32} />
              </div>
              <p className="text-slate-500 font-medium">Aucun message trouvé dans l'historique.</p>
            </div>
          ) : (
            filteredLogs.map(log => (
              <button
                key={log.id}
                onClick={() => {
                  setSelectedLog(log);
                  fetchRecipients(log.id);
                }}
                className={`w-full text-left p-5 rounded-2xl border transition-all flex items-center gap-4 group ${
                  selectedLog?.id === log.id 
                    ? 'bg-blue-50 border-blue-200 shadow-md shadow-blue-600/5' 
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  log.type === 'email' ? 'bg-blue-100 text-blue-600' : log.type === 'whatsapp' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  {log.type === 'email' ? <Mail size={20} /> : log.type === 'whatsapp' ? <MessageCircle size={20} /> : <MessageSquare size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {log.type === 'email' ? 'Email' : log.type === 'whatsapp' ? 'WhatsApp' : 'SMS'} • {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                      </span>
                      {(log as any).campus_name && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-md border border-indigo-100">
                          📍 {(log as any).campus_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                      <Users size={12} />
                      {log.recipient_count}
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-900 truncate">
                    {log.type === 'email' ? log.subject : log.content.substring(0, 50) + '...'}
                  </h4>
                  <p className="text-sm text-slate-500 truncate">
                    Par: {settings?.email_from_name || log.sender?.full_name || 'Système'}
                  </p>
                </div>
                <ChevronRight size={20} className={`transition-transform ${selectedLog?.id === log.id ? 'translate-x-1 text-blue-600' : 'text-slate-300'}`} />
              </button>
            ))
          )}
        </div>

        {/* Log Details */}
        <div className="lg:col-span-1">
          {selectedLog ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden sticky top-24 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-4">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    selectedLog.type === 'email' ? 'bg-blue-100 text-blue-700' : selectedLog.type === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedLog.type}
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    ID: {selectedLog.id.substring(0, 8)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  {selectedLog.type === 'email' ? selectedLog.subject : selectedLog.type === 'whatsapp' ? 'Message WhatsApp' : 'Message SMS'}
                </h3>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <User size={16} className="text-slate-500" />
                    <span className="text-slate-600">Expéditeur:</span>
                    <span className="font-bold text-slate-900">{settings?.email_from_name || selectedLog.sender?.full_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-slate-500" />
                    <span className="text-slate-600">Date:</span>
                    <span className="font-bold text-slate-900">
                      {format(new Date(selectedLog.created_at), 'PPPPp', { locale: fr })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Users size={16} className="text-slate-500" />
                    <span className="text-slate-600">Destinataires:</span>
                    <span className="font-bold text-slate-900">{selectedLog.recipient_count} ({selectedLog.recipient_type})</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-black text-slate-500 uppercase tracking-widest">Contenu</h5>
                  <div className="p-4 bg-slate-50 rounded-2xl text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-100 max-h-60 overflow-y-auto custom-scrollbar">
                    {selectedLog.content}
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="text-xs font-black text-slate-500 uppercase tracking-widest">Liste des destinataires</h5>
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                    {isLoadingRecipients ? (
                      <div className="flex justify-center py-4">
                        <Loader2 size={20} className="animate-spin text-slate-300" />
                      </div>
                    ) : recipients.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Aucun détail disponible.</p>
                    ) : (
                      recipients.map(rec => (
                        <div key={rec.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{rec.recipient_name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{rec.recipient_contact}</p>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${rec.status === 'sent' ? 'bg-green-500' : 'bg-rose-500'}`} />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center space-y-4 sticky top-24">
              <div className="w-12 h-12 bg-white text-slate-300 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Eye size={24} />
              </div>
              <p className="text-slate-500 text-sm font-medium">Sélectionnez un message pour voir les détails.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunicationHistory;
