import React, { useState, useEffect } from 'react';
import { 
  Send, Users, Search, CheckCircle2, Clock, Loader2, X, Info, 
  History, Settings, MessageCircle, Sparkles, ExternalLink, 
  Copy, Phone, ShieldCheck, Check, Filter, BookOpen, AlertTriangle,
  QrCode, RefreshCw, Share2
} from 'lucide-react';
import { UserProfile } from '../types';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import CommunicationHistory from './CommunicationHistory';
import CommunicationSettings from './CommunicationSettings';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';

interface WhatsAppModuleProps {
  user: UserProfile;
}

interface WhatsAppTargetRecipient {
  id: string;
  name: string;
  phone: string;
  parent_name?: string;
  student_name?: string;
  class_name?: string;
  class_id?: string;
  status?: 'pending' | 'sent' | 'skipped';
}

const WhatsAppModule: React.FC<WhatsAppModuleProps> = ({ user }) => {
  const { terminology, currentCampusId, school } = useSchool();
  const studentTerm = terminology.student.toLowerCase();
  const studentsTerm = terminology.students.toLowerCase();

  const [activeTab, setActiveTab] = useState<'send' | 'history' | 'settings'>('send');
  const [recipientType, setRecipientType] = useState<'parents' | 'teachers' | 'students'>('parents');
  const [recipientScope, setRecipientScope] = useState<'all' | 'class' | 'individual'>('all');
  const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [message, setMessage] = useState('');
  const [dispatchMode, setDispatchMode] = useState<'direct_wame' | 'api'>('direct_wame');
  const [isSending, setIsSending] = useState(false);
  
  const [classes, setClasses] = useState<any[]>([]);
  const [individuals, setIndividuals] = useState<any[]>([]);
  const [selectedIndividuals, setSelectedIndividuals] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const [settings, setSettings] = useState<any>(null);
  const [sentStatuses, setSentStatuses] = useState<Record<string, boolean>>({});
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Quick message variable tags
  const variableTags = [
    { tag: '{nom_parent}', label: 'Nom du Parent' },
    { tag: '{nom_eleve}', label: `Nom ${terminology.student}` },
    { tag: '{classe}', label: terminology.class },
    { tag: '{ecole}', label: 'Établissement' },
    { tag: '{date}', label: 'Date du jour' }
  ];

  // Professional predefined WhatsApp templates
  const templates = [
    {
      id: 'scolarite',
      category: 'Finances',
      title: 'Rappel Écolage / Scolarité',
      icon: '💰',
      content: `Bonjour {nom_parent},\n\nSauf erreur de notre part, le paiement de la scolarité pour {nom_eleve} (Classe: {classe}) est actuellement en attente.\n\nMerci de vous présenter à l'économat de {ecole} pour régulariser la situation.\n\nCordialement,\nLa Direction`
    },
    {
      id: 'absence',
      category: 'Discipline',
      title: 'Alerte Absence Urgente',
      icon: '🚨',
      content: `Avis Important - {ecole}\n\nBonjour {nom_parent}, nous vous informons que l'élève {nom_eleve} ({classe}) est constaté(e) absent(e) ce jour ({date}).\n\nMerci de contacter la direction dans les plus brefs délais pour justifier cette absence.\n\nMerci de votre collaboration.`
    },
    {
      id: 'bulletin',
      category: 'Pédagogie',
      title: 'Publication des Notes / Bulletins',
      icon: '📜',
      content: `Chers parents,\n\nLes résultats et bulletins scolaires de {nom_eleve} ({classe}) sont désormais disponibles sur la plateforme de {ecole}.\n\nVous pouvez les consulter sur l'application ou vous rendre à l'établissement.\n\nDirection Pédagogique`
    },
    {
      id: 'reunion',
      category: 'Vie Scolaire',
      title: 'Convocation Réunion de Parents',
      icon: '🏫',
      content: `Bonjour {nom_parent},\n\nUne réunion d'information importante pour la classe de {classe} aura lieu ce vendredi à {ecole}.\n\nVotre présence est vivement souhaitée pour aborder le parcours académique de {nom_eleve}.\n\nMerci d'avance.`
    },
    {
      id: 'felicitations',
      category: 'Excellence',
      title: 'Félicitations Académiques',
      icon: '🎉',
      content: `Chers parents de {nom_eleve},\n\nC'est avec grande fierté que {ecole} vous félicite pour les excellents résultats et la conduite exemplaire de votre enfant en {classe}.\n\nContinuez ainsi !`
    }
  ];

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      let q = supabase.from('classes').select('id, name').eq('school_id', user.school_id).order('name');
      if (currentCampusId) q = q.eq('campus_id', currentCampusId);
      const { data } = await q;
      if (data) setClasses(data);
    };
    fetchClasses();
  }, [user.school_id, currentCampusId]);

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('communication_settings')
        .select('*')
        .eq('school_id', user.school_id)
        .single();
      if (data) setSettings(data);
    };
    fetchSettings();
  }, [user.school_id]);

  // Fetch recipients list
  useEffect(() => {
    const fetchIndividuals = async () => {
      setIsLoadingData(true);
      try {
        let result;
        if (recipientType === 'teachers') {
          let query = supabase.from('staff').select('id, first_name, last_name, email, phone, role, campus_id, school_campuses(name)').eq('school_id', user.school_id).in('status', ['Actif', 'Congé']);
          if (currentCampusId) query = query.eq('campus_id', currentCampusId);
          result = await query;
        } else {
          let sq = supabase.from('students').select('id, first_name, last_name, parent_name, parent_email, parent_phone, phone, class_id, classes(name, campus_id, school_campuses(name))').eq('school_id', user.school_id).eq('status', 'Actif');
          if (currentCampusId) sq = sq.eq('classes.campus_id', currentCampusId);
          result = await sq;
        }

        if (result.error) {
          console.error(`Erreur lors de la récupération des destinataires (${recipientType}):`, result.error);
        } else {
          const rawData = result.data || [];
          if (recipientType === 'parents') {
            const parentMap = new Map();
            rawData.forEach((student: any) => {
              const phone = student.parent_phone?.trim();
              if (!phone) return;
              const campusName = student.classes?.school_campuses?.name || '';
              if (!parentMap.has(phone)) {
                parentMap.set(phone, {
                  id: student.id,
                  parent_name: student.parent_name || `Parent de ${formatStudentName(student.last_name, student.first_name).fullName}`,
                  student_name: formatStudentName(student.last_name, student.first_name).fullName,
                  phone: phone,
                  class_name: student.classes?.name || 'N/A',
                  class_id: student.class_id,
                  campus_name: campusName,
                });
              }
            });
            const parentList = Array.from(parentMap.values());
            setIndividuals(parentList);
            setSelectedIndividuals(parentList.map(p => p.id));
          } else if (recipientType === 'students') {
            const studentList = rawData.map((s: any) => ({
              id: s.id,
              name: formatStudentName(s.last_name, s.first_name).fullName,
              student_name: formatStudentName(s.last_name, s.first_name).fullName,
              phone: s.phone || s.parent_phone || '',
              class_name: s.classes?.name || 'N/A',
              class_id: s.class_id,
            }));
            setIndividuals(studentList);
            setSelectedIndividuals(studentList.map(s => s.id));
          } else {
            const staffList = rawData.map((st: any) => ({
              id: st.id,
              name: formatStudentName(st.last_name, st.first_name).fullName,
              phone: st.phone || '',
              role: st.role
            }));
            setIndividuals(staffList);
            setSelectedIndividuals(staffList.map(st => st.id));
          }
        }
      } catch (err) {
        console.error("Erreur lors du chargement:", err);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchIndividuals();
  }, [user.school_id, currentCampusId, recipientType]);

  // Filtered individuals
  const filteredIndividuals = individuals.filter(ind => {
    const matchesSearch = 
      (ind.name && ind.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ind.parent_name && ind.parent_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ind.student_name && ind.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ind.phone && ind.phone.includes(searchQuery));

    const matchesClass = recipientScope !== 'class' || (selectedClass && ind.class_id === selectedClass);
    return matchesSearch && matchesClass;
  });

  const handleToggleSelectAll = () => {
    if (selectedIndividuals.length === filteredIndividuals.length) {
      setSelectedIndividuals([]);
    } else {
      setSelectedIndividuals(filteredIndividuals.map(i => i.id));
    }
  };

  const handleToggleIndividual = (id: string) => {
    setSelectedIndividuals(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const insertVariable = (tag: string) => {
    setMessage(prev => prev + ' ' + tag);
  };

  const formatPhoneNumber = (phoneRaw: string) => {
    let clean = (phoneRaw || '').replace(/\D/g, '');
    if (!clean) return '';
    if (clean.length === 8) {
      return `509${clean}`;
    }
    return clean;
  };

  const personalizeMessage = (rawText: string, recipientObj: any) => {
    const schoolName = school?.name || 'EduNova Pro';
    const today = new Date().toLocaleDateString('fr-FR');
    
    return rawText
      .replace(/\{nom_parent\}/g, recipientObj.parent_name || recipientObj.name || 'Parent')
      .replace(/\{nom_eleve\}/g, recipientObj.student_name || recipientObj.name || terminology.student)
      .replace(/\{classe\}/g, recipientObj.class_name || 'N/A')
      .replace(/\{ecole\}/g, schoolName)
      .replace(/\{date\}/g, today);
  };

  const generateWhatsAppLink = (recipientObj: any) => {
    const formattedPhone = formatPhoneNumber(recipientObj.phone);
    if (!formattedPhone) return '#';
    const personalizedText = personalizeMessage(message, recipientObj);
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(personalizedText)}`;
  };

  const activeRecipients = filteredIndividuals.filter(ind => selectedIndividuals.includes(ind.id));

  const handleLogWhatsAppBatch = async () => {
    if (!message) {
      toast.error("Veuillez saisir un message.");
      return;
    }
    if (activeRecipients.length === 0) {
      toast.error("Aucun destinataire sélectionné.");
      return;
    }

    setIsSending(true);
    try {
      const { data: logData, error: logError } = await supabase
        .from('communication_logs')
        .insert({
          school_id: user.school_id,
          campus_id: currentCampusId || null,
          sender_id: user.id,
          type: 'whatsapp',
          recipient_type: recipientScope === 'all' ? recipientType : recipientScope === 'class' ? 'class' : 'individual',
          recipient_count: activeRecipients.length,
          content: message,
          status: 'sent'
        })
        .select('id')
        .single();

      if (logError) throw logError;

      const recipientRecords = activeRecipients.map(ind => ({
        log_id: logData.id,
        recipient_id: ind.id,
        recipient_name: ind.parent_name || ind.name,
        recipient_contact: ind.phone,
        status: 'sent'
      }));

      if (recipientRecords.length > 0) {
        await supabase.from('communication_recipients').insert(recipientRecords);
      }

      toast.success(`Campagne WhatsApp enregistrée pour ${activeRecipients.length} destinataire(s) !`);
    } catch (err: any) {
      console.error("Erreur enregistrement WhatsApp:", err);
      toast.error("Erreur: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendViaApi = async () => {
    if (!message) {
      toast.error("Veuillez rédiger votre message WhatsApp.");
      return;
    }
    if (activeRecipients.length === 0) {
      toast.error("Veuillez choisir au moins un destinataire.");
      return;
    }

    setIsSending(true);
    try {
      const formattedRecipients = activeRecipients.map(ind => ({
        id: ind.id,
        name: ind.parent_name || ind.name,
        contact: formatPhoneNumber(ind.phone),
        personalizedMessage: personalizeMessage(message, ind)
      }));

      const res = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.school_id,
          recipients: formattedRecipients,
          content: message
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de l\'envoi API WhatsApp');

      await handleLogWhatsAppBatch();
      toast.success(`Messages WhatsApp envoyés avec succès à ${activeRecipients.length} destinataire(s) !`);
    } catch (err: any) {
      console.error("API WhatsApp Error:", err);
      toast.error("Erreur envoi API WhatsApp: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-400/30 text-emerald-300 shadow-inner">
              <MessageCircle size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Communication WhatsApp</h1>
                <span className="px-2.5 py-0.5 bg-emerald-500/30 text-emerald-200 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-400/30">
                  Direct & Cloud API
                </span>
              </div>
              <p className="text-emerald-100 text-sm mt-0.5">
                Diffusion instantanée vers WhatsApp Web / Mobile avec personnalisation dynamique des messages.
              </p>
            </div>
          </div>
        </div>

        {/* TAB BUTTONS & GUIDE */}
        <div className="flex flex-wrap items-center gap-2 bg-emerald-950/60 p-1.5 rounded-2xl border border-emerald-700/40 backdrop-blur-md self-start md:self-auto relative z-10">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-emerald-400/20 text-emerald-200 hover:bg-emerald-400/30 border border-emerald-400/30 transition-all"
            title="Guide de configuration du numéro WhatsApp"
          >
            <BookOpen size={15} className="text-emerald-300" />
            <span className="hidden sm:inline">Guide Config</span>
          </button>
          <button
            onClick={() => setActiveTab('send')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'send'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
            }`}
          >
            <Send size={15} />
            Lancement WhatsApp
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'history'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
            }`}
          >
            <History size={15} />
            Historique
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'settings'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                : 'text-emerald-200 hover:text-white hover:bg-emerald-800/50'
            }`}
          >
            <Settings size={15} />
            Paramètres
          </button>
        </div>
      </div>

      {/* TAB CONTENT: HISTORY & SETTINGS REUSE */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <CommunicationHistory user={user} />
        </div>
      )}

      {activeTab === 'settings' && (
        <CommunicationSettings user={user} />
      )}

      {/* TAB CONTENT: SEND MODULE */}
      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: TEMPLATES & COMPOSER (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* TEMPLATE PRESETS */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-600" />
                  Modèles de Messages Officiels
                </h3>
                <span className="text-xs text-slate-400 font-medium">{templates.length} modèles prêts</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => setMessage(tmpl.content)}
                    className="text-left p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-emerald-50/60 hover:border-emerald-200 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{tmpl.icon}</span>
                      <span className="font-bold text-xs text-slate-800 group-hover:text-emerald-800 truncate">{tmpl.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-normal">
                      {tmpl.content}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* MESSAGE EDITOR */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <label className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <MessageCircle size={18} className="text-emerald-600" />
                  Rédiger le Message WhatsApp
                </label>
                <span className="text-xs font-mono text-slate-400 font-bold">
                  {message.length} caractères
                </span>
              </div>

              {/* VARIABLE TAG INJECTORS */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Balises Dynamiques Personnalisées :
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {variableTags.map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => insertVariable(v.tag)}
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-mono text-xs rounded-lg border border-emerald-200 font-bold transition-all active:scale-95"
                    >
                      + {v.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* TEXTAREA */}
              <div className="relative">
                <textarea
                  rows={5}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Écrivez votre message ici... ex: Bonjour {nom_parent}, rappel de scolarité pour {nom_eleve}."
                  className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all resize-none leading-relaxed"
                />
              </div>

              {/* LIVE WHATSAPP CHAT PREVIEW SIMULATOR */}
              <div className="bg-[#efeae2] rounded-2xl p-4 border border-emerald-200/80 shadow-inner relative overflow-hidden space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-300/60">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                      {school?.name?.charAt(0) || 'E'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">{school?.name || 'EduNova Pro'}</p>
                      <p className="text-[9px] text-emerald-800 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Aperçu interactif du bulle WhatsApp
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-600 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
                    Aujourd'hui
                  </span>
                </div>

                <div className="bg-[#dcf8c6] text-slate-900 p-3.5 rounded-2xl rounded-tr-none shadow-sm max-w-[95%] ml-auto text-xs leading-relaxed font-sans whitespace-pre-wrap border border-emerald-200/50">
                  {message ? (
                    personalizeMessage(message, {
                      parent_name: 'M. Jean Dupont',
                      student_name: 'Pierre Dupont',
                      class_name: '9ème AF',
                      name: 'M. Jean Dupont'
                    })
                  ) : (
                    <span className="italic text-slate-500">Votre message apparaîtra ici avec la mise en forme dynamique...</span>
                  )}
                  <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 mt-1 font-mono">
                    <span>{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <CheckCircle2 size={12} className="text-emerald-700" />
                  </div>
                </div>
              </div>

              {/* DISPATCH MODE SELECTION */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Mode d'envoi WhatsApp :
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDispatchMode('direct_wame')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                      dispatchMode === 'direct_wame'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold'
                        : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    <ExternalLink size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black">Liens Directs wa.me (Gratuit)</p>
                      <p className="text-[11px] text-slate-500 font-normal">Génère un bouton personnalisé vers WhatsApp Web/App pour chaque parent.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispatchMode('api')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                      dispatchMode === 'api'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold'
                        : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    <Send size={18} className="text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black">API WhatsApp Automatisée</p>
                      <p className="text-[11px] text-slate-500 font-normal">Envoi direct en arrière-plan via API WhatsApp Cloud / Twilio.</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* ACTION BUTTON FOR API MODE */}
              {dispatchMode === 'api' && (
                <button
                  onClick={handleSendViaApi}
                  disabled={isSending || activeRecipients.length === 0}
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                >
                  {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  Diffuser via API WhatsApp ({activeRecipients.length} destinataires)
                </button>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: RECIPIENT SELECTION & WA LAUNCHER (5 cols) */}
          <div className="lg:col-span-5 space-y-6">

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Users size={18} className="text-emerald-600" />
                  Sélection des Destinataires
                </h3>
                <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                  {selectedIndividuals.length} / {filteredIndividuals.length}
                </span>
              </div>

              {/* RECIPIENT TYPE SELECTOR */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientType('parents')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs transition-all ${
                    recipientType === 'parents'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Parents
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientType('teachers')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs transition-all ${
                    recipientType === 'teachers'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Personnel
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientType('students')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs transition-all ${
                    recipientType === 'students'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {terminology.students}
                </button>
              </div>

              {/* SCOPE SELECTOR */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <select
                    value={recipientScope}
                    onChange={e => setRecipientScope(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold outline-none"
                  >
                    <option value="all">Tous les {recipientType === 'parents' ? 'parents' : recipientType === 'teachers' ? 'membres du staff' : terminology.students}</option>
                    <option value="class">Par classe spécifique</option>
                    <option value="individual">Sélection individuelle libre</option>
                  </select>
                </div>

                {recipientScope === 'class' && (
                  <select
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 text-emerald-900 text-xs font-bold outline-none"
                  >
                    <option value="">-- Choisir une classe --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}

                {/* SEARCH INPUT */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Chercher par nom, téléphone..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder:text-slate-400 outline-none"
                  />
                </div>
              </div>

              {/* SELECT ALL / DESELECT TOGGLE */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="font-bold text-emerald-700 hover:underline"
                >
                  {selectedIndividuals.length === filteredIndividuals.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
                <span className="text-slate-400 font-medium">{filteredIndividuals.length} trouvés</span>
              </div>

              {/* RECIPIENTS LIST SCROLLABLE */}
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                    <Loader2 size={18} className="animate-spin text-emerald-600" />
                    <span className="text-xs font-medium">Chargement des contacts...</span>
                  </div>
                ) : filteredIndividuals.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Aucun destinataire correspondant.
                  </div>
                ) : (
                  filteredIndividuals.map(ind => {
                    const isSelected = selectedIndividuals.includes(ind.id);
                    const formattedPhone = formatPhoneNumber(ind.phone);
                    return (
                      <div
                        key={ind.id}
                        onClick={() => handleToggleIndividual(ind.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-slate-50/50 border-slate-100 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-900 truncate">
                            {ind.parent_name || ind.name}
                          </p>
                          {ind.student_name && (
                            <p className="text-[10px] text-slate-500 truncate">
                              Élève : {ind.student_name} ({ind.class_name})
                            </p>
                          )}
                          <p className="text-[10px] font-mono text-emerald-700 flex items-center gap-1 mt-0.5">
                            <Phone size={10} />
                            +{formattedPhone || 'Pas de numéro'}
                          </p>
                        </div>

                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check size={12} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* LOG BATCH ACTION FOR DIRECT LAUNCH MODE */}
              {dispatchMode === 'direct_wame' && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <button
                    type="button"
                    onClick={handleLogWhatsAppBatch}
                    disabled={isSending || activeRecipients.length === 0}
                    className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={15} className="text-emerald-400" />
                    Enregistrer la campagne dans l'historique
                  </button>
                </div>
              )}
            </div>

            {/* DIRECT WA LAUNCHER QUEUE */}
            {dispatchMode === 'direct_wame' && activeRecipients.length > 0 && (
              <div className="bg-emerald-950 text-white p-6 rounded-3xl space-y-4 shadow-xl border border-emerald-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="text-emerald-400" size={20} />
                    <h4 className="font-bold text-sm">Lancement Direct WhatsApp</h4>
                  </div>
                  <span className="text-[10px] bg-emerald-800 px-2.5 py-0.5 rounded-full font-bold text-emerald-200">
                    {activeRecipients.length} liens prêts
                  </span>
                </div>

                <p className="text-xs text-emerald-200/80 leading-relaxed">
                  Cliquez sur <strong className="text-white">"Ouvrir WhatsApp"</strong> pour chaque destinataire. Le message personnalisé sera pré-rempli dans l'application WhatsApp.
                </p>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {activeRecipients.map((rec, idx) => {
                    const waUrl = generateWhatsAppLink(rec);
                    const isDone = sentStatuses[rec.id];
                    return (
                      <div
                        key={rec.id}
                        className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 transition-all ${
                          isDone 
                            ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300' 
                            : 'bg-emerald-900/80 border-emerald-700/80 text-white'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate">{rec.parent_name || rec.name}</p>
                          <p className="text-[10px] font-mono text-emerald-300 opacity-80">
                            +{formatPhoneNumber(rec.phone)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setSentStatuses(prev => ({ ...prev, [rec.id]: true }))}
                            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition-all ${
                              isDone
                                ? 'bg-emerald-800 text-emerald-200'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-white active:scale-95'
                            }`}
                          >
                            <ExternalLink size={12} />
                            {isDone ? 'Rouvrer' : 'Ouvrir WA'}
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* MODAL GUIDE DE CONFIGURATION DU NUMERO WHATSAPP */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* MODAL HEADER */}
            <div className="p-6 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-400/30 text-emerald-300">
                  <BookOpen size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Guide : Configurer votre Numéro WhatsApp</h3>
                  <p className="text-xs text-emerald-200">Instructions pas à pas pour connecter EduNova Pro à WhatsApp</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGuideModal(false)}
                className="p-2 hover:bg-white/10 rounded-full text-emerald-200 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 leading-relaxed custom-scrollbar">
              
              {/* OPTION 1: LIENS DIRECTS (WA.ME) */}
              <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-emerald-600 text-white font-black text-[10px] uppercase rounded-lg tracking-wider">
                    Méthode 1 : Liens Directs (100% Gratuit)
                  </span>
                  <span className="text-xs font-bold text-emerald-800">Recommandé pour démarrer</span>
                </div>
                <h4 className="font-bold text-slate-900 text-base">Utiliser WhatsApp Web / App sans API payante</h4>
                <p className="text-xs text-slate-600">
                  Cette méthode ne nécessite aucune clé API. Le système génère automatiquement un bouton pré-rempli pour chaque parent.
                </p>
                <ol className="list-decimal pl-5 space-y-2 text-xs font-medium text-slate-800">
                  <li>Inscrivez le numéro du parent/élève avec le code pays (ex: <strong>+509 37 00 0000</strong> pour Haïti).</li>
                  <li>Rédigez votre message avec les balises dynamiques (<code className="bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded font-mono font-bold">{'{nom_parent}'}</code>, <code className="bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded font-mono font-bold">{'{nom_eleve}'}</code>).</li>
                  <li>Cliquez sur <strong>"Ouvrir WA"</strong> : l'application WhatsApp s'ouvre directement avec le message prêt à être envoyé.</li>
                </ol>
              </div>

              {/* OPTION 2: META CLOUD API */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-teal-800 text-white font-black text-[10px] uppercase rounded-lg tracking-wider">
                    Méthode 2 : Meta WhatsApp Cloud API (Automatisé)
                  </span>
                  <span className="text-xs font-bold text-teal-800">Envoi en masse direct</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <div>
                      <p className="font-bold text-slate-900">Créer un Compte Meta for Developers</p>
                      <p className="text-slate-500">Connectez-vous sur <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline font-bold">developers.facebook.com</a> avec votre compte d'entreprise.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <div>
                      <p className="font-bold text-slate-900">Ajouter le produit "WhatsApp"</p>
                      <p className="text-slate-500">Dans le tableau de bord de votre application Meta, ajoutez le produit WhatsApp Business API.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <div>
                      <p className="font-bold text-slate-900">Associer le Numéro de Téléphone Officiel de l'Établissement</p>
                      <p className="text-slate-500">Ajoutez votre numéro fixe ou mobile professionnel (+509...). Un SMS/Appel de vérification vous sera envoyé par Meta.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-black flex items-center justify-center shrink-0 mt-0.5">4</span>
                    <div>
                      <p className="font-bold text-slate-900">Copier les 2 Identifiants Clés</p>
                      <p className="text-slate-500">
                        Récupérez l'<strong>ID de numéro de téléphone (Phone Number ID)</strong> et le <strong>Jeton d'accès système (Access Token)</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-black flex items-center justify-center shrink-0 mt-0.5">5</span>
                    <div>
                      <p className="font-bold text-slate-900">Enregistrer dans les Paramètres EduNova Pro</p>
                      <p className="text-slate-500">
                        Allez sur l'onglet <strong>Paramètres</strong> dans cette page, sélectionnez <em>"Meta WhatsApp Cloud API"</em> et collez vos 2 identifiants.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CODE PAYS NOTICE */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Format International des Numéros</p>
                  <p className="mt-0.5 text-amber-800">
                    Saisissez toujours les numéros avec le code pays. Pour Haïti, les numéros à 8 chiffres (ex: <code className="font-bold font-mono">37000000</code>) sont automatiquement convertis au format <code className="font-bold font-mono">+50937000000</code> par le système.
                  </p>
                </div>
              </div>

            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowGuideModal(false);
                  setActiveTab('settings');
                }}
                className="px-4 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs rounded-xl transition-all"
              >
                Aller aux Paramètres
              </button>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all"
              >
                J'ai compris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppModule;
