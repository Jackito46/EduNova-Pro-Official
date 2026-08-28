import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Users, Search, CheckCircle2, Clock, Loader2, X, Info, History, Settings } from 'lucide-react';
import { UserProfile } from '../types';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import CommunicationHistory from './CommunicationHistory';
import CommunicationSettings from './CommunicationSettings';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';

interface SmsModuleProps {
  user: UserProfile;
}

const SmsModule: React.FC<SmsModuleProps> = ({ user }) => {
  const { terminology, currentCampusId } = useSchool();
  const studentTerm = terminology.student.toLowerCase();
  const studentsTerm = terminology.students.toLowerCase();
  const [recipientType, setRecipientType] = useState('parents');
  const [recipientScope, setRecipientScope] = useState('all');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'send' | 'history' | 'settings'>('send');
  const [settings, setSettings] = useState<any>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  const [classes, setClasses] = useState<any[]>([]);
  const [individuals, setIndividuals] = useState<any[]>([]);
  const [selectedIndividuals, setSelectedIndividuals] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      let q = supabase.from('classes').select('id, name').eq('school_id', user.school_id).order('name');
      if (currentCampusId) q = q.eq('campus_id', currentCampusId);
      const { data } = await q;
      if (data) setClasses(data);
    };
    fetchClasses();
  }, [user.school_id, currentCampusId]);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoadingSettings(true);
      const { data } = await supabase
        .from('communication_settings')
        .select('*')
        .eq('school_id', user.school_id)
        .single();
      
      if (data) setSettings(data);
      setIsLoadingSettings(false);
    };
    fetchSettings();
  }, [user.school_id]);

  useEffect(() => {
    const fetchIndividuals = async () => {
      setIsLoadingData(true);
      
      let data: any[] = [];
      try {
        let result;
        if (recipientType === 'teachers') {
          let query = supabase.from('staff').select('id, first_name, last_name, email, phone, role, campus_id, school_campuses(name)').eq('school_id', user.school_id).in('status', ['Actif', 'Congé']);
          if (currentCampusId) query = query.eq('campus_id', currentCampusId);
          result = await query;
        } else {
          let sq = supabase.from('students').select('id, first_name, last_name, parent_name, parent_email, parent_phone, class_id, classes(name, campus_id, school_campuses(name))').eq('school_id', user.school_id).eq('status', 'Actif');
          if (currentCampusId) sq = sq.eq('classes.campus_id', currentCampusId);
          result = await sq;
        }
        
        if (result.error) {
          console.error(`Erreur lors de la récupération des ${recipientType}:`, result.error);
        } else {
          const rawData = result.data || [];
          
          if (recipientType === 'parents') {
            // Group by parent_phone to avoid duplicates for parents with multiple children
            const parentMap = new Map();
            rawData.forEach((student: any) => {
              if (!student.parent_phone) return; // Skip if no phone
              const phone = student.parent_phone.trim();
              const campusName = student.classes?.school_campuses?.name || '';
              if (!parentMap.has(phone)) {
                parentMap.set(phone, {
                  id: student.id, // Use first student's ID as reference
                  parent_name: student.parent_name || `Parents de ${formatStudentName(student.last_name, student.first_name).fullName}`,
                  parent_email: student.parent_email,
                  parent_phone: student.parent_phone,
                  class_id: student.class_id, // Primary class
                  campus_name: campusName,
                  students: [formatStudentName(student.last_name, student.first_name).fullName],
                  class_ids: [student.class_id]
                });
              } else {
                const parent = parentMap.get(phone);
                parent.students.push(formatStudentName(student.last_name, student.first_name).fullName);
                if (!parent.class_ids.includes(student.class_id)) {
                  parent.class_ids.push(student.class_id);
                }
              }
            });
            data = Array.from(parentMap.values());
          } else if (recipientType === 'students') {
            // Only students with a phone to contact
            data = rawData.filter((s: any) => s.parent_phone).map((s: any) => ({
              ...s,
              campus_name: s.classes?.school_campuses?.name || ''
            }));
          } else if (recipientType === 'teachers') {
            // Only teachers with a phone
            data = rawData.filter((t: any) => t.phone).map((t: any) => ({
              ...t,
              campus_name: t.school_campuses?.name || ''
            }));
          }
        }
      } catch (err) {
        console.error("Erreur inattendue:", err);
      }
      
      setIndividuals(data);
      
      // Handle initial selection based on scope
      if (recipientScope === 'all') {
        setSelectedIndividuals(data.map((ind: any) => ind.id));
      } else if (recipientScope === 'class' && selectedClass) {
        setSelectedIndividuals(data.filter((ind: any) => ind.class_id === selectedClass).map((ind: any) => ind.id));
      } else if (recipientScope === 'individual') {
        // Keep current selection or reset if type changed
        setSelectedIndividuals([]);
      }
      
      setIsLoadingData(false);
    };
    fetchIndividuals();
  }, [recipientType, user.school_id, recipientScope, selectedClass, currentCampusId]);

  const filteredIndividuals = individuals.filter(ind => {
    // Class filter (from the dropdown in individual mode OR from the scope selection)
    const activeClassFilter = recipientScope === 'class' ? selectedClass : selectedClassFilter;
    
    if (recipientType !== 'teachers' && activeClassFilter && activeClassFilter !== 'all') {
      if (recipientType === 'parents' && ind.class_ids) {
        if (!ind.class_ids.includes(activeClassFilter)) return false;
      } else if (ind.class_id !== activeClassFilter) {
        return false;
      }
    }

    if (!searchQuery) return true;
    const searchStr = searchQuery.toLowerCase().trim();
    const fullName = recipientType === 'teachers' || recipientType === 'students' 
      ? formatStudentName(ind.last_name, ind.first_name).fullName.toLowerCase()
      : (ind.parent_name || '').toLowerCase();
    
    if (recipientType === 'parents') {
      const parentName = (ind.parent_name || '').toLowerCase();
      return parentName.includes(searchStr) || fullName.includes(searchStr);
    }
    return fullName.includes(searchStr);
  });

  const toggleIndividual = (id: string) => {
    setSelectedIndividuals(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredIndividuals.map(ind => ind.id);
    setSelectedIndividuals(prev => {
      const newSelection = [...prev];
      filteredIds.forEach(id => {
        if (!newSelection.includes(id)) newSelection.push(id);
      });
      return newSelection;
    });
  };

  const deselectAllFiltered = () => {
    const filteredIds = filteredIndividuals.map(ind => ind.id);
    setSelectedIndividuals(prev => prev.filter(id => !filteredIds.includes(id)));
  };

  // Maximum characters for a single SMS
  const MAX_CHARS = 160;

  const testTemplates = [
    {
      id: 1,
      title: 'Avis d\'absence',
      content: 'EduNova: Votre enfant est absent ce matin. Merci de contacter la direction au plus vite.'
    },
    {
      id: 2,
      title: 'Rappel de paiement',
      content: 'EduNova: Rappel - Le paiement de la scolarité est attendu avant le 5 du mois. Merci de votre régularité.'
    },
    {
      id: 3,
      title: 'Alerte météo',
      content: 'EduNova: École fermée demain suite aux intempéries. Reprise des cours prévue après-demain.'
    },
    {
      id: 4,
      title: 'Réunion Urgente',
      content: 'EduNova: Réunion exceptionnelle ce soir à 17h pour tous les parents de la classe de 9ème AF.'
    },
    {
      id: 5,
      title: 'Félicitations',
      content: 'EduNova: Félicitations ! Votre enfant a obtenu une mention d\'excellence ce trimestre. Continuez ainsi !'
    }
  ];

  const handleTemplateSelect = (template: any) => {
    setMessage(template.content);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message) {
      toast.error("Veuillez rédiger un message.");
      return;
    }
    if (selectedIndividuals.length === 0) {
      toast.error("Veuillez sélectionner au moins un destinataire.");
      return;
    }

    setIsSending(true);
    
    // Check if SMS settings are configured
    const isSmsConfigured = settings && settings.sms_provider !== 'none' && settings.sms_api_key;
    
    try {
      // 1. Create the communication log
      const { data: logData, error: logError } = await supabase
        .from('communication_logs')
        .insert({
          school_id: user.school_id,
          campus_id: currentCampusId || null,
          sender_id: user.id,
          type: 'sms',
          recipient_type: recipientScope === 'all' ? recipientType : recipientScope === 'class' ? 'class' : 'individual',
          recipient_count: selectedIndividuals.length,
          content: message,
          status: 'sent'
        })
        .select('id')
        .single();

      if (logError) throw logError;

      // 2. Create recipient records
      const recipientRecords = filteredIndividuals
        .filter(ind => selectedIndividuals.includes(ind.id))
        .map(ind => ({
          log_id: logData.id,
          recipient_id: ind.id,
          recipient_name: recipientType === 'parents' ? ind.parent_name : formatStudentName(ind.last_name, ind.first_name).fullName,
          recipient_contact: recipientType === 'teachers' ? ind.phone : ind.parent_phone,
          status: 'sent'
        }));

      if (recipientRecords.length > 0) {
        const { error: recError } = await supabase
          .from('communication_recipients')
          .insert(recipientRecords);
        if (recError) console.error("Error saving recipients:", recError);
      }

      // 3. Call the backend API for actual sending
      if (isSmsConfigured) {
        const response = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId: user.school_id,
            recipients: filteredIndividuals
              .filter(ind => selectedIndividuals.includes(ind.id))
              .map(ind => ({
                id: ind.id,
                contact: recipientType === 'teachers' ? ind.phone : ind.parent_phone
              })),
            content: message
          })
        }).catch(err => {
          if (err.message === 'Failed to fetch') {
            throw new Error("Erreur réseau: Impossible de contacter le serveur (Failed to fetch). Vérifiez votre connexion internet ou vos bloqueurs de contenu.");
          }
          throw err;
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
          throw new Error(errorData.error || `Erreur serveur (${response.status})`);
        }
      }

      setIsSending(false);
      setSendSuccess(true);
      
      if (isSmsConfigured) {
        toast.success(`SMS envoyé avec succès à ${selectedIndividuals.length} destinataire(s).`, {
          description: `Les messages ont été envoyés via ${settings.sms_provider.toUpperCase()}.`,
          duration: 5000,
        });
      } else {
        toast.info(`Simulation d'envoi réussie (${selectedIndividuals.length} destinataires).`, {
          description: "Note: Les paramètres SMS ne sont pas configurés. Le message a été enregistré dans l'historique mais pas réellement envoyé.",
          duration: 8000,
        });
      }

      setMessage('');
      
      setTimeout(() => {
        setSendSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error("Error sending SMS:", error);
      toast.error("Erreur lors de l'envoi du SMS: " + (error.message || "Erreur inconnue"));
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-amber-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-amber-600/20 rotate-3 hover:rotate-0 transition-transform duration-500">
            <MessageSquare size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Communication SMS</h1>
            <p className="text-slate-500 font-medium">Envoyez des messages courts et urgents aux parents et professeurs.</p>
          </div>
        </div>

        <div className="flex items-center bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('send')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'send' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Send size={18} />
            Envoi
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'history' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <History size={18} />
            Historique
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'settings' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Settings size={18} />
            Paramètres
          </button>
        </div>
      </div>

      {activeTab === 'history' && <CommunicationHistory user={user} />}
      {activeTab === 'settings' && <CommunicationSettings user={user} />}

      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {(!settings || settings.sms_provider === 'none' || !settings.sms_api_key) && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3 animate-in fade-in slide-in-from-top-2">
                <Info className="text-amber-600 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-bold text-amber-900">Configuration SMS manquante</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Vos paramètres SMS ne sont pas encore configurés. Les envois seront simulés. 
                    <button onClick={() => setActiveTab('settings')} className="ml-1 underline font-bold hover:text-amber-900">Configurer maintenant</button>
                  </p>
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <form onSubmit={handleSend} className="space-y-6">
              
              {/* Recipient Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Destinataires</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setRecipientType('parents')}
                    className={`p-4 rounded-2xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-3 ${
                      recipientType === 'parents' 
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-600/20' 
                        : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${recipientType === 'parents' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Users size={20} />
                    </div>
                    Parents
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientType('teachers')}
                    className={`p-4 rounded-2xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-3 ${
                      recipientType === 'teachers' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md ring-2 ring-indigo-600/20' 
                        : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${recipientType === 'teachers' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Users size={20} />
                    </div>
                    Professeurs
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientType('students')}
                    className={`p-4 rounded-2xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-3 ${
                      recipientType === 'students' 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-md ring-2 ring-emerald-600/20' 
                        : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${recipientType === 'students' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Users size={20} />
                    </div>
                    Élèves
                  </button>
                </div>
                
                {/* Scope Selection */}
                <div className="mt-6 space-y-5 border-t border-slate-100 pt-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Portée de l'envoi</label>
                    <select
                      value={recipientScope}
                      onChange={(e) => setRecipientScope(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-100 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all font-medium"
                    >
                      <option value="all">Tous les {recipientType === 'parents' ? 'parents' : recipientType === 'teachers' ? 'professeurs' : studentsTerm}</option>
                      <option value="class">Par classe</option>
                      <option value="individual">Sélection individuelle</option>
                    </select>
                  </div>

                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    {recipientScope === 'class' && (
                      <div className="mb-5">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Sélectionner une classe</label>
                        <select
                          value={selectedClass}
                          onChange={(e) => setSelectedClass(e.target.value)}
                          className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-100 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all font-medium"
                        >
                          <option value="">Choisir une classe...</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-bold text-slate-700">
                        {recipientScope === 'all' ? `Liste des ${recipientType === 'parents' ? 'parents' : recipientType === 'teachers' ? 'professeurs' : studentsTerm}` : 
                         recipientScope === 'class' ? 'Vérifier les destinataires de la classe' : 'Sélectionner les destinataires'}
                      </label>
                      <div className="flex gap-2">
                        <button 
                          type="button" 
                          onClick={selectAllFiltered}
                          className="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-wider"
                        >
                          Tout sélectionner
                        </button>
                        <span className="text-slate-300">|</span>
                        <button 
                          type="button" 
                          onClick={deselectAllFiltered}
                          className="text-[10px] font-bold text-slate-500 hover:underline uppercase tracking-wider"
                        >
                          Tout désélectionner
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mb-3">
                      {recipientScope === 'individual' && recipientType !== 'teachers' && (
                        <div className="flex-1">
                          <select
                            value={selectedClassFilter}
                            onChange={(e) => setSelectedClassFilter(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-sm font-medium"
                          >
                            <option value="">Toutes les classes</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className={`relative ${(recipientScope === 'individual' || recipientScope === 'all') && recipientType !== 'teachers' ? 'flex-[2]' : 'w-full'}`}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={`Rechercher un ${recipientType === 'parents' ? 'parent' : recipientType === 'teachers' ? 'professeur' : studentTerm}...`}
                          className="w-full pl-11 pr-10 py-3 rounded-xl border-2 border-slate-100 bg-slate-50/50 text-slate-900 placeholder:text-slate-500 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-sm font-medium"
                        />
                        {searchQuery && (
                          <button 
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 custom-scrollbar shadow-inner">
                      {isLoadingData ? (
                        <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3">
                          <Loader2 size={24} className="animate-spin text-blue-600" />
                          <span>Chargement de la liste...</span>
                        </div>
                      ) : individuals.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                          <Users size={24} className="text-slate-300" />
                          <span>Aucun {recipientType === 'parents' ? 'parent' : recipientType === 'teachers' ? 'professeur' : studentTerm} trouvé.</span>
                        </div>
                      ) : filteredIndividuals.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                          <Search size={24} className="text-slate-300" />
                          <span>Aucun résultat pour "{searchQuery}"</span>
                        </div>
                      ) : (
                        filteredIndividuals.map(ind => (
                          <label key={ind.id} className={`flex items-center gap-3 p-3 hover:bg-amber-50/60 cursor-pointer transition-colors ${selectedIndividuals.includes(ind.id) ? 'bg-amber-50/80 border-l-4 border-amber-600' : ''}`}>
                            <div className="relative flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedIndividuals.includes(ind.id)}
                                onChange={() => toggleIndividual(ind.id)}
                                className="w-5 h-5 text-amber-600 rounded-lg border-slate-300 focus:ring-amber-600 transition-all cursor-pointer"
                              />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-sm font-extrabold truncate ${selectedIndividuals.includes(ind.id) ? 'text-amber-950' : 'text-slate-800'}`}>
                                  {recipientType === 'parents' 
                                    ? ind.parent_name
                                    : formatStudentName(ind.last_name, ind.first_name).fullName
                                  }
                                </span>
                                {ind.campus_name && (
                                  <span className="shrink-0 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black rounded-md border border-slate-200/60">
                                    📍 {ind.campus_name}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 truncate flex flex-col gap-0.5 mt-0.5">
                                {recipientType === 'parents' && (
                                  <>
                                    <span className="text-amber-700 font-semibold">{ind.parent_phone || 'Pas de téléphone'}</span>
                                    <span className="truncate font-medium text-slate-500" title={ind.students?.join(', ')}>
                                      Élève(s): {ind.students?.join(', ')}
                                    </span>
                                  </>
                                )}
                                {recipientType === 'teachers' && (
                                  <span className="text-amber-700 font-semibold">{ind.phone || 'Pas de téléphone'}</span>
                                )}
                                {recipientType === 'students' && (
                                  <>
                                    <span className="text-amber-700 font-semibold">{ind.parent_phone || 'Pas de téléphone parent'}</span>
                                    <span>Élève: {formatStudentName(ind.last_name, ind.first_name).fullName}</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between px-1">
                      <div className="text-xs font-medium text-slate-500">
                        <span className="text-blue-600 font-bold">{selectedIndividuals.length}</span> sélectionné(s) sur {individuals.length}
                      </div>
                    </div>

                    {selectedIndividuals.length > 0 && (
                      <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                          <Info size={14} className="text-blue-600" />
                          Aperçu des destinataires
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {individuals
                            .filter(ind => selectedIndividuals.includes(ind.id))
                            .slice(0, 5)
                            .map(ind => (
                              <div key={ind.id} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-medium text-slate-600 flex items-center gap-1">
                                <span>{recipientType === 'parents' ? ind.parent_name : formatStudentName(ind.last_name, ind.first_name).fullName}</span>
                                <span className="text-blue-600">({recipientType === 'teachers' ? ind.phone : ind.parent_phone})</span>
                              </div>
                            ))}
                          {selectedIndividuals.length > 5 && (
                            <div className="px-2 py-1 bg-slate-200 rounded-lg text-[10px] font-bold text-slate-600">
                              + {selectedIndividuals.length - 5} autres
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-slate-700">Message SMS</label>
                  <span className={`text-xs font-bold ${message.length > MAX_CHARS ? 'text-rose-600' : 'text-slate-500'}`}>
                    {message.length} / {MAX_CHARS}
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Rédigez votre SMS ici..."
                  className={`w-full px-4 py-3.5 rounded-xl border-2 bg-slate-50/50 text-slate-900 placeholder:text-slate-500 focus:bg-white focus:ring-4 outline-none transition-all resize-none font-medium ${
                    message.length > MAX_CHARS 
                      ? 'border-rose-200 focus:border-rose-600 focus:ring-rose-600/10' 
                      : 'border-slate-100 focus:border-blue-600 focus:ring-blue-600/10'
                  }`}
                  required
                />
                {message.length > MAX_CHARS && (
                  <p className="text-xs text-rose-600 mt-2 font-medium">
                    Attention : Votre message dépasse la limite d'un seul SMS. Il sera facturé comme plusieurs messages.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSending || !message}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all ${
                    isSending || !message
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-600/20'
                  }`}
                >
                  {isSending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Envoi en cours...
                    </>
                  ) : sendSuccess ? (
                    <>
                      <CheckCircle2 size={20} />
                      Envoyé avec succès
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Envoyer le SMS
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Templates & History */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-4 flex items-center gap-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <MessageSquare size={18} />
              </div>
              Modèles SMS
            </h2>
            <div className="space-y-3">
              {testTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className="w-full text-left p-4 rounded-2xl border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
                >
                  <h3 className="font-bold text-slate-800 group-hover:text-blue-700">{template.title}</h3>
                  <p className="text-xs font-medium text-slate-500 mt-1.5 line-clamp-2">{template.content}</p>
                </button>
              ))}
            </div>
          </div>


        </div>
      </div>
    )}
  </div>
);
};

export default SmsModule;
