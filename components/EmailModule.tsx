import React, { useState, useEffect } from 'react';
import { Mail, Send, Users, Search, CheckCircle2, AlertCircle, Paperclip, Clock, Loader2, X, Info, History, Settings } from 'lucide-react';
import { UserProfile } from '../types';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import CommunicationHistory from './CommunicationHistory';
import CommunicationSettings from './CommunicationSettings';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';
import { SelectPill } from './SelectPill';
import { ClassSelectorPill } from './ClassSelectorPill';
import { CommunicationTabBar } from './CommunicationTabBar';

interface EmailModuleProps {
  user: UserProfile;
}

const EmailModule: React.FC<EmailModuleProps> = ({ user }) => {
  const { terminology, currentCampusId } = useSchool();
  const studentTerm = terminology.student.toLowerCase();
  const studentsTerm = terminology.students.toLowerCase();
  const [recipientType, setRecipientType] = useState('parents');
  const [recipientScope, setRecipientScope] = useState('all');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'send' | 'history' | 'settings'>('send');

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
      const { data, error } = await supabase
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
            // Group by parent_email to avoid duplicates for parents with multiple children
            const parentMap = new Map();
            rawData.forEach((student: any) => {
              if (!student.parent_email) return; // Skip if no email
              const email = student.parent_email.toLowerCase().trim();
              const campusName = student.classes?.school_campuses?.name || '';
              if (!parentMap.has(email)) {
                parentMap.set(email, {
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
                const parent = parentMap.get(email);
                parent.students.push(formatStudentName(student.last_name, student.first_name).fullName);
                if (!parent.class_ids.includes(student.class_id)) {
                  parent.class_ids.push(student.class_id);
                }
              }
            });
            data = Array.from(parentMap.values());
          } else if (recipientType === 'students') {
            // Only students with an email to contact
            data = rawData.filter((s: any) => s.parent_email).map((s: any) => ({
              ...s,
              campus_name: s.classes?.school_campuses?.name || ''
            }));
          } else if (recipientType === 'teachers') {
            // Only teachers with an email
            data = rawData.filter((t: any) => t.email).map((t: any) => ({
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

  const testTemplates = [
    {
      id: 1,
      title: 'Rappel de réunion',
      subject: `Réunion des parents d'${studentsTerm} - Trimestre 1`,
      content: 'Chers parents,\n\nNous vous rappelons que la réunion parents-professeurs pour le premier trimestre aura lieu ce vendredi à 15h00 dans l\'enceinte de l\'établissement.\n\nL\'ordre du jour portera sur :\n1. Présentation du programme pédagogique\n2. Organisation des activités parascolaires\n3. Questions diverses\n\nCordialement,\nLa Direction'
    },
    {
      id: 2,
      title: 'Bulletin de notes disponible',
      subject: 'Disponibilité des bulletins de notes - Contrôle 1',
      content: 'Chers parents,\n\nNous vous informons que les bulletins de notes du premier contrôle sont désormais disponibles. Vous pouvez les consulter et les télécharger via votre espace parent sur la plateforme EduNova.\n\nNous restons à votre disposition pour tout complément d\'information.\n\nCordialement,\nLe Secrétariat'
    },
    {
      id: 3,
      title: 'Convocation parent',
      subject: 'Convocation pour entretien pédagogique',
      content: 'Chers parents,\n\nLa direction de l\'établissement souhaiterait vous rencontrer pour discuter du suivi pédagogique de votre enfant.\n\nMerci de bien vouloir prendre rendez-vous avec le secrétariat dans les plus brefs délais.\n\nCordialement,\nLa Direction'
    },
    {
      id: 4,
      title: 'Sortie scolaire',
      subject: 'Autorisation de sortie scolaire - Visite du Musée',
      content: 'Chers parents,\n\nUne sortie pédagogique au Musée National est organisée le mardi prochain pour toutes les classes du cycle fondamental.\n\nLe départ est prévu à 8h30 et le retour à 14h00. Merci de prévoir un panier-repas pour votre enfant.\n\nCordialement,\nL\'équipe pédagogique'
    },
    {
      id: 5,
      title: 'Fermeture exceptionnelle',
      subject: 'Avis de fermeture exceptionnelle de l\'établissement',
      content: 'Chers parents, Chers professeurs,\n\nEn raison de travaux de maintenance urgents sur le réseau électrique, l\'établissement sera exceptionnellement fermé ce jeudi.\n\nLes cours reprendront normalement le vendredi matin.\n\nNous vous remercions de votre compréhension.\n\nLa Direction'
    }
  ];

  const handleTemplateSelect = (template: any) => {
    setSubject(template.subject);
    setMessage(template.content);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) {
      toast.error("Veuillez remplir l'objet et le message.");
      return;
    }
    if (selectedIndividuals.length === 0) {
      toast.error("Veuillez sélectionner au moins un destinataire.");
      return;
    }

    setIsSending(true);
    
    // Check if SMTP settings are configured
    const isSmtpConfigured = settings && settings.smtp_host && settings.smtp_pass;
    
    try {
      // 1. Create the communication log
      const { data: logData, error: logError } = await supabase
        .from('communication_logs')
        .insert({
          school_id: user.school_id,
          campus_id: currentCampusId || null,
          sender_id: user.id,
          type: 'email',
          recipient_type: recipientScope === 'all' ? recipientType : recipientScope === 'class' ? 'class' : 'individual',
          recipient_count: selectedIndividuals.length,
          subject: subject,
          content: message,
          status: isSmtpConfigured ? 'pending' : 'sent'
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
          recipient_contact: recipientType === 'teachers' ? ind.email : ind.parent_email,
          status: 'sent'
        }));

      if (recipientRecords.length > 0) {
        const { error: recError } = await supabase
          .from('communication_recipients')
          .insert(recipientRecords);
        if (recError) console.error("Error saving recipients:", recError);
      }

      // 3. Call the backend API for real sending if SMTP is configured
      if (isSmtpConfigured) {
        const recipientsToSend = filteredIndividuals
          .filter(ind => selectedIndividuals.includes(ind.id))
          .map(ind => ({
            email: recipientType === 'teachers' ? ind.email : ind.parent_email,
            name: recipientType === 'parents' ? ind.parent_name : formatStudentName(ind.last_name, ind.first_name).fullName
          }));

        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            schoolId: user.school_id,
            recipients: recipientsToSend,
            subject: subject,
            content: message
          })
        }).catch(err => {
          if (err.message === 'Failed to fetch') {
            throw new Error("Erreur réseau: Impossible de contacter le serveur (Failed to fetch). Vérifiez votre connexion internet ou vos bloqueurs de contenu.");
          }
          throw err;
        });

        const result = await response.json().catch(() => ({ error: 'Réponse serveur invalide' }));
        
        if (!response.ok) {
          throw new Error(result.error || `Erreur serveur (${response.status})`);
        }

        // Update log status to sent
        await supabase
          .from('communication_logs')
          .update({ status: 'sent' })
          .eq('id', logData.id);

        toast.success(`Email envoyé avec succès à ${selectedIndividuals.length} destinataire(s).`, {
          description: "Les messages ont été envoyés via votre serveur SMTP Google.",
          duration: 5000,
        });
      } else {
        toast.info(`Simulation d'envoi réussie (${selectedIndividuals.length} destinataires).`, {
          description: "Note: Les paramètres SMTP ne sont pas configurés. Le message a été enregistré dans l'historique mais pas réellement envoyé.",
          duration: 8000,
        });
      }

      setIsSending(false);
      setSendSuccess(true);
      setSubject('');
      setMessage('');
      
      setTimeout(() => {
        setSendSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error("Erreur lors de l'envoi de l'email: " + (error.message || "Erreur inconnue"));
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-4 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 4 CHANNELS TAB BAR (RESPONSIVE) */}
      <CommunicationTabBar activeChannel="email" />

      {/* HEADER COMPACT */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
            <Mail size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Communication Email</h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium">Envoyez des messages et convocations aux parents, professeurs et élèves.</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('send')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'send' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Send size={14} />
            Envoi
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <History size={14} />
            Historique
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'settings' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Settings size={14} />
            Paramètres
          </button>
        </div>
      </div>

      {activeTab === 'history' && <CommunicationHistory user={user} />}
      {activeTab === 'settings' && <CommunicationSettings user={user} />}

      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Form Section */}
          <div className="lg:col-span-2 space-y-3.5 sm:space-y-4">
            {(!settings || !settings.smtp_host || !settings.smtp_pass) && (
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex gap-3 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="text-amber-600 shrink-0" size={18} />
                <div>
                  <p className="text-xs font-bold text-amber-900">Configuration SMTP recommandée</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Vos identifiants Google SMTP ne sont pas encore configurés. 
                    <button onClick={() => setActiveTab('settings')} className="ml-1 underline font-bold hover:text-amber-900">Configurer dans Paramètres</button>
                  </p>
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-5">
            <form onSubmit={handleSend} className="space-y-4">
              
              {/* Recipient Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Destinataires</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecipientType('parents')}
                    className={`p-2.5 sm:p-3 rounded-xl border-2 text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 ${
                      recipientType === 'parents' 
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs ring-2 ring-blue-600/20' 
                        : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${recipientType === 'parents' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Users size={16} />
                    </div>
                    <span>Parents</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientType('teachers')}
                    className={`p-2.5 sm:p-3 rounded-xl border-2 text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 ${
                      recipientType === 'teachers' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs ring-2 ring-indigo-600/20' 
                        : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${recipientType === 'teachers' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Users size={16} />
                    </div>
                    <span>Professeurs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientType('students')}
                    className={`p-2.5 sm:p-3 rounded-xl border-2 text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 ${
                      recipientType === 'students' 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs ring-2 ring-emerald-600/20' 
                        : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${recipientType === 'students' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Users size={16} />
                    </div>
                    <span>Élèves</span>
                  </button>
                </div>
                
                {/* Scope Selection (PILL STYLE) */}
                <div className="mt-4 space-y-3.5 border-t border-slate-100 pt-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">Portée de l'envoi</label>
                    <SelectPill
                      options={[
                        { value: 'all', label: `Tous les ${recipientType === 'parents' ? 'parents' : recipientType === 'teachers' ? 'professeurs' : studentsTerm}` },
                        { value: 'class', label: 'Par classe spécifique' },
                        { value: 'individual', label: 'Sélection individuelle' }
                      ]}
                      value={recipientScope}
                      onChange={(val) => setRecipientScope(val as any)}
                      variant="field"
                      size="sm"
                      colorScheme="blue"
                      className="w-full"
                    />
                  </div>

                  <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {recipientScope === 'class' && (
                      <div className="mb-3.5 space-y-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">Sélectionner une classe</label>
                        <ClassSelectorPill
                          classes={classes}
                          selectedClassId={selectedClass}
                          onSelectClass={(id) => setSelectedClass(id === 'all' ? '' : id)}
                          allowAll={false}
                          emptyLabel="Choisir une classe..."
                          variant="field"
                          size="sm"
                          colorScheme="blue"
                          className="w-full"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700">
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
                    
                    <div className="flex flex-col sm:flex-row gap-2 mb-2.5">
                      {recipientScope === 'individual' && recipientType !== 'teachers' && (
                        <div className="w-full sm:w-1/2">
                          <ClassSelectorPill
                            classes={classes}
                            selectedClassId={selectedClassFilter}
                            onSelectClass={(id) => setSelectedClassFilter(id === 'all' ? '' : id)}
                            allowAll={true}
                            allLabel="Toutes les classes"
                            variant="field"
                            size="sm"
                            colorScheme="slate"
                            className="w-full"
                          />
                        </div>
                      )}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={`Rechercher un ${recipientType === 'parents' ? 'parent' : recipientType === 'teachers' ? 'professeur' : studentTerm}...`}
                          className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all text-xs font-medium"
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
                          <label key={ind.id} className={`flex items-center gap-3 p-3 hover:bg-indigo-50/60 cursor-pointer transition-colors ${selectedIndividuals.includes(ind.id) ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : ''}`}>
                            <div className="relative flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedIndividuals.includes(ind.id)}
                                onChange={() => toggleIndividual(ind.id)}
                                className="w-5 h-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-600 transition-all cursor-pointer"
                              />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-sm font-extrabold truncate ${selectedIndividuals.includes(ind.id) ? 'text-indigo-950' : 'text-slate-800'}`}>
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
                                    <span className="text-indigo-600 font-semibold">{ind.parent_email || 'Pas d\'email'}</span>
                                    <span className="truncate font-medium text-slate-500" title={ind.students?.join(', ')}>
                                      Élève(s): {ind.students?.join(', ')}
                                    </span>
                                  </>
                                )}
                                {recipientType === 'teachers' && (
                                  <span className="text-indigo-600 font-semibold">{ind.email || 'Pas d\'email'}</span>
                                )}
                                {recipientType === 'students' && (
                                  <>
                                    <span className="text-indigo-600 font-semibold">{ind.parent_email || 'Pas d\'email parent'}</span>
                                    <span>Tél: {ind.parent_phone || 'N/A'}</span>
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
                                <span className="text-blue-600">({recipientType === 'teachers' ? ind.email : ind.parent_email})</span>
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

              {/* Subject */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Objet de l'email</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={`Ex: Réunion des parents d'${studentsTerm}`}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-100 bg-slate-50/50 text-slate-900 placeholder:text-slate-500 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all font-medium"
                  required
                />
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  placeholder="Rédigez votre message ici..."
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-100 bg-slate-50/50 text-slate-900 placeholder:text-slate-500 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all resize-none font-medium"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Paperclip size={18} />
                  <span className="text-sm font-medium">Joindre un fichier</span>
                </button>

                <button
                  type="submit"
                  disabled={isSending || !subject || !message}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all ${
                    isSending || !subject || !message
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
                      Envoyer l'email
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
                <Mail size={18} />
              </div>
              Modèles préparés
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
                  <p className="text-xs font-medium text-slate-500 mt-1.5 line-clamp-1">{template.subject}</p>
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

export default EmailModule;
