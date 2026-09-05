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
import { SelectPill, SelectOption } from './SelectPill';
import { ClassSelectorPill } from './ClassSelectorPill';
import { CommunicationTabBar } from './CommunicationTabBar';

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

  const [activeTab, setActiveTab] = useState<'send' | 'templates' | 'history' | 'settings'>('send');
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [templateSearchQuery, setTemplateSearchQuery] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Categories for official templates
  const templateCategories = [
    { id: 'all', label: 'Tous les modèles' },
    { id: 'Finances', label: 'Finances & Scolarité' },
    { id: 'Discipline', label: 'Discipline & Présence' },
    { id: 'Pédagogie', label: 'Pédagogie & Notes' },
    { id: 'Vie Scolaire', label: 'Vie Scolaire' },
    { id: 'Excellence', label: 'Félicitations' }
  ];

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
      title: 'Rappel Scolarité / Écolage',
      icon: '💰',
      content: `Bonjour {nom_parent},\n\nSauf erreur de notre part, le paiement de la scolarité pour {nom_eleve} (Classe: {classe}) est actuellement en attente.\n\nMerci de vous présenter à l'économat de {ecole} pour régulariser la situation.\n\nCordialement,\nLa Direction`
    },
    {
      id: 'frais_examen',
      category: 'Finances',
      title: 'Frais d\'Examens & Inscription',
      icon: '📑',
      content: `Bonjour {nom_parent},\n\nNous vous rappelons que l'échéance pour le règlement des frais d'examens de {nom_eleve} ({classe}) approche.\n\nMerci de finaliser ce versement auprès de l'économat de {ecole}.\n\nDirection Administrative`
    },
    {
      id: 'absence',
      category: 'Discipline',
      title: 'Alerte Absence du Jour',
      icon: '🚨',
      content: `Avis Important - {ecole}\n\nBonjour {nom_parent}, nous vous informons que l'élève {nom_eleve} ({classe}) a été constaté(e) absent(e) ce jour ({date}).\n\nMerci de contacter la direction dans les plus brefs délais pour justifier cette absence.\n\nMerci de votre collaboration.`
    },
    {
      id: 'retard',
      category: 'Discipline',
      title: 'Avis de Retard Répété',
      icon: '⏱️',
      content: `Bonjour {nom_parent},\n\nNous constatons des retards répétés pour {nom_eleve} ({classe}).\n\nLa ponctualité étant essentielle à la réussite scolaire, nous sollicitons votre concours pour veiller à l'heure d'arrivée à {ecole}.\n\nLa Direction Pédagogique`
    },
    {
      id: 'bulletin',
      category: 'Pédagogie',
      title: 'Publication des Bulletins & Résultats',
      icon: '📜',
      content: `Chers parents,\n\nLes résultats et bulletins scolaires de {nom_eleve} ({classe}) sont désormais disponibles sur la plateforme de {ecole}.\n\nVous pouvez les consulter sur votre espace en ligne ou vous rendre à l'établissement.\n\nDirection Pédagogique`
    },
    {
      id: 'reunion',
      category: 'Vie Scolaire',
      title: 'Convocation Réunion de Parents',
      icon: '🏫',
      content: `Bonjour {nom_parent},\n\nUne réunion d'information importante pour la classe de {classe} aura lieu ce vendredi à {ecole}.\n\nVotre présence est vivement souhaitée pour aborder le parcours académique de {nom_eleve}.\n\nMerci d'avance.`
    },
    {
      id: 'fermeture',
      category: 'Vie Scolaire',
      title: 'Avis Congé / Fermeture Exceptionnelle',
      icon: '📢',
      content: `Chers parents d'élèves,\n\nNous vous informons que {ecole} sera fermée le ({date}) conformément au calendrier officiel. Les cours reprendront normalement le jour ouvré suivant.\n\nLa Direction`
    },
    {
      id: 'felicitations',
      category: 'Excellence',
      title: 'Tableau d\'Honneur & Félicitations',
      icon: '🎉',
      content: `Chers parents de {nom_eleve},\n\nC'est avec une grande fierté que {ecole} vous félicite pour les excellents résultats et la conduite exemplaire de votre enfant en {classe}.\n\nContinuez ainsi !`
    }
  ];

  const filteredTemplates = templates.filter(t => {
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    const matchesSearch = !templateSearchQuery.trim() || 
      t.title.toLowerCase().includes(templateSearchQuery.toLowerCase()) || 
      t.content.toLowerCase().includes(templateSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleUseTemplate = (tmpl: typeof templates[0]) => {
    setMessage(tmpl.content);
    setSelectedTemplateId(tmpl.id);
    setActiveTab('send');
    toast.success(`Modèle "${tmpl.title}" inséré dans le composeur.`);
  };

  const handleCopyTemplate = (tmpl: typeof templates[0]) => {
    navigator.clipboard.writeText(tmpl.content);
    setCopiedTemplateId(tmpl.id);
    toast.success(`Modèle "${tmpl.title}" copié dans le presse-papier.`);
    setTimeout(() => setCopiedTemplateId(null), 2000);
  };

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
    <div className="max-w-7xl mx-auto space-y-3.5 sm:space-y-4 pb-10 animate-in fade-in duration-300">
      {/* 4 CHANNELS TAB BAR (RESPONSIVE) */}
      <CommunicationTabBar activeChannel="whatsapp" />

      {/* HEADER SECTION (STANDARDIZED WITH SMS, EMAIL & PUSH) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
            <MessageCircle size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Communication WhatsApp</h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium">
              Diffusion ciblée et notifications officielles aux familles et au personnel.
            </p>
          </div>
        </div>

        {/* TAB BUTTONS (STANDARDIZED SIZES & STYLING) */}
        <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200 self-start md:self-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('send')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'send'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Send size={14} />
            Envoi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'templates'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Sparkles size={14} />
            Modèles Officiels
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <History size={14} />
            Historique
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'settings'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Settings size={14} />
            Paramètres
          </button>
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all text-slate-600 hover:bg-slate-200/60"
            title="Guide WhatsApp"
          >
            <BookOpen size={14} />
            Guide
          </button>
        </div>
      </div>

      {/* DEDICATED TAB: MODÈLES DE MESSAGES OFFICIELS */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-5">
          {/* HEADER & SEARCH */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Sparkles size={18} />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Modèles de Messages Officiels
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Modèles institutionnels prêts à l'emploi avec balises de fusion pour les alertes et avis officiels.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={templateSearchQuery}
                onChange={e => setTemplateSearchQuery(e.target.value)}
                placeholder="Rechercher un modèle..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none font-medium text-slate-800"
              />
            </div>
          </div>

          {/* CATEGORY FILTER PILLS */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {templateCategories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`h-8 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
            <span className="text-xs text-slate-400 font-medium ml-auto">
              {filteredTemplates.length} sur {templates.length} modèles
            </span>
          </div>

          {/* TEMPLATES GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map(tmpl => {
              const isCopied = copiedTemplateId === tmpl.id;
              const isSelected = selectedTemplateId === tmpl.id;

              const badgeColor = 
                tmpl.category === 'Finances' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                tmpl.category === 'Discipline' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                tmpl.category === 'Pédagogie' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                tmpl.category === 'Vie Scolaire' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                'bg-rose-50 text-rose-800 border-rose-200';

              return (
                <div
                  key={tmpl.id}
                  className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all flex flex-col justify-between space-y-3.5 ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 hover:border-emerald-300 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl p-2 bg-slate-50 rounded-xl border border-slate-100 shrink-0">
                          {tmpl.icon}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{tmpl.title}</h3>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeColor}`}>
                            {tmpl.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* CONTENT PREVIEW */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {tmpl.content}
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleCopyTemplate(tmpl)}
                      className="h-9 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-all"
                    >
                      {isCopied ? (
                        <>
                          <Check size={13} className="text-emerald-600" />
                          <span>Copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copier</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUseTemplate(tmpl)}
                      className="h-9 px-4 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <Send size={13} />
                      <span>Utiliser ce modèle</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DYNAMIC VARIABLES REFERENCE GUIDE */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                Champs dynamiques de personnalisation
              </h4>
            </div>
            <p className="text-xs text-emerald-900/80 leading-relaxed">
              Ces balises sont automatiquement remplacées par les données réelles du destinataire lors de la génération.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              {variableTags.map(v => (
                <div key={v.tag} className="bg-white p-2.5 rounded-xl border border-emerald-200 text-center shadow-2xs">
                  <span className="font-mono text-xs font-bold text-emerald-800">{v.tag}</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">{v.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: HISTORY & SETTINGS REUSE */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
          <CommunicationHistory user={user} />
        </div>
      )}

      {activeTab === 'settings' && (
        <CommunicationSettings user={user} />
      )}

      {/* TAB CONTENT: SEND MODULE */}
      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
          
          {/* LEFT COLUMN: COMPOSER & PREVIEW (7 cols) */}
          <div className="lg:col-span-7 space-y-3.5 sm:space-y-4">

            {/* MESSAGE EDITOR */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MessageCircle size={16} className="text-emerald-600" />
                  Rédiger le Message
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('templates')}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 transition-all"
                  >
                    <Sparkles size={13} />
                    <span>Modèles officiels ({templates.length})</span>
                  </button>
                  <span className="text-slate-300">|</span>
                  <span className="text-xs font-mono text-slate-400 font-bold">
                    {message.length} caractères
                  </span>
                </div>
              </div>

              {/* QUICK TEMPLATE SELECTION BAR */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                  Modèle rapide :
                </span>
                <select
                  value={selectedTemplateId || ''}
                  onChange={e => {
                    const tmpl = templates.find(t => t.id === e.target.value);
                    if (tmpl) {
                      setMessage(tmpl.content);
                      setSelectedTemplateId(tmpl.id);
                    } else {
                      setSelectedTemplateId(null);
                    }
                  }}
                  className="flex-1 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">Sélectionner un modèle officiel...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.title} ({t.category})</option>
                  ))}
                </select>
              </div>

              {/* VARIABLE TAG INJECTORS */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Champs dynamiques :
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
              <div>
                <textarea
                  rows={4}
                  value={message}
                  onChange={e => {
                    setMessage(e.target.value);
                    setSelectedTemplateId(null);
                  }}
                  placeholder="Écrivez votre message ici... Utilisez les balises dynamiques pour personnaliser l'envoi."
                  className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all resize-none leading-relaxed"
                />
              </div>

              {/* LIVE WHATSAPP CHAT PREVIEW SIMULATOR */}
              <div className="bg-[#efeae2] rounded-xl p-3.5 border border-emerald-200/80 shadow-inner relative overflow-hidden space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-300/60">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[11px] shadow-sm">
                      {school?.name?.charAt(0) || 'E'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">{school?.name || 'EduNova Pro'}</p>
                      <p className="text-[9px] text-emerald-800 font-bold">
                        Aperçu du message
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-600 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
                    Aujourd'hui
                  </span>
                </div>

                <div className="bg-[#dcf8c6] text-slate-900 p-3 rounded-xl rounded-tr-none shadow-sm max-w-[95%] ml-auto text-xs leading-relaxed font-sans whitespace-pre-wrap border border-emerald-200/50">
                  {message ? (
                    personalizeMessage(message, {
                      parent_name: 'M. Jean Dupont',
                      student_name: 'Pierre Dupont',
                      class_name: '9ème AF',
                      name: 'M. Jean Dupont'
                    })
                  ) : (
                    <span className="italic text-slate-400">Votre message apparaîtra ici avec la mise en forme dynamique...</span>
                  )}
                  <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 mt-1 font-mono">
                    <span>{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <CheckCircle2 size={12} className="text-emerald-700" />
                  </div>
                </div>
              </div>

              {/* DISPATCH MODE SELECTION (STANDARDIZED LABELS) */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Mode de diffusion :</span>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setDispatchMode('direct_wame')}
                    className={`h-10 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      dispatchMode === 'direct_wame'
                        ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ExternalLink size={14} className="text-emerald-600" />
                    WhatsApp Web / App
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchMode('api')}
                    className={`h-10 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      dispatchMode === 'api'
                        ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Send size={14} className="text-emerald-600" />
                    Envoi Automatique (API)
                  </button>
                </div>
              </div>

              {/* ACTION BUTTON FOR API MODE */}
              {dispatchMode === 'api' && (
                <button
                  type="button"
                  onClick={handleSendViaApi}
                  disabled={isSending || activeRecipients.length === 0}
                  className="w-full h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Envoyer via API ({activeRecipients.length} destinataire{activeRecipients.length > 1 ? 's' : ''})
                </button>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: RECIPIENT SELECTION & WA LAUNCHER (5 cols) */}
          <div className="lg:col-span-5 space-y-3.5 sm:space-y-4">

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-emerald-600" />
                  Sélection des Destinataires
                </h3>
                <span className="text-xs font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                  {selectedIndividuals.length} / {filteredIndividuals.length}
                </span>
              </div>

              {/* RECIPIENT TYPE SELECTOR */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientType('parents')}
                  className={`h-9 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${
                    recipientType === 'parents'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Parents
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientType('teachers')}
                  className={`h-9 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${
                    recipientType === 'teachers'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Personnel
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientType('students')}
                  className={`h-9 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${
                    recipientType === 'students'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {terminology.students}
                </button>
              </div>

              {/* SCOPE SELECTOR (PILL STYLE) */}
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Portée de l'envoi
                  </label>
                  <SelectPill
                    options={[
                      { value: 'all', label: `Tous les ${recipientType === 'parents' ? 'parents' : recipientType === 'teachers' ? 'membres du staff' : terminology.students}` },
                      { value: 'class', label: 'Par classe spécifique' },
                      { value: 'individual', label: 'Sélection individuelle libre' }
                    ]}
                    value={recipientScope}
                    onChange={(val) => setRecipientScope(val as any)}
                    variant="field"
                    size="sm"
                    colorScheme="emerald"
                    className="w-full"
                  />
                </div>

                {recipientScope === 'class' && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Classe sélectionnée
                    </label>
                    <ClassSelectorPill
                      classes={classes}
                      selectedClassId={selectedClass}
                      onSelectClass={(id) => setSelectedClass(id === 'all' ? '' : id)}
                      allowAll={false}
                      emptyLabel="Choisir une classe..."
                      variant="field"
                      size="sm"
                      colorScheme="emerald"
                      className="w-full"
                    />
                  </div>
                )}

                {/* SEARCH INPUT */}
                <div className="relative pt-0.5">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Chercher par nom, téléphone..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
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

              {/* LOG BATCH ACTION FOR WEB/APP MODE */}
              {dispatchMode === 'direct_wame' && (
                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleLogWhatsAppBatch}
                    disabled={isSending || activeRecipients.length === 0}
                    className="w-full h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <ShieldCheck size={15} className="text-emerald-400" />
                    Enregistrer la campagne dans l'historique
                  </button>
                </div>
              )}
            </div>

            {/* DIRECT WA LAUNCHER QUEUE (STANDARDIZED CLEAN WHITE CARD) */}
            {dispatchMode === 'direct_wame' && activeRecipients.length > 0 && (
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="text-emerald-600" size={16} />
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900">File d'envoi WhatsApp</h4>
                  </div>
                  <span className="text-xs bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold text-emerald-800">
                    {activeRecipients.filter(r => sentStatuses[r.id]).length} / {activeRecipients.length} traités
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {activeRecipients.map((rec) => {
                    const waUrl = generateWhatsAppLink(rec);
                    const isDone = sentStatuses[rec.id];
                    return (
                      <div
                        key={rec.id}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 transition-all ${
                          isDone 
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950' 
                            : 'bg-slate-50/70 border-slate-200/80 text-slate-900'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate">{rec.parent_name || rec.name}</p>
                          <p className="text-[10px] font-mono text-emerald-700 flex items-center gap-1 mt-0.5">
                            <Phone size={10} />
                            +{formatPhoneNumber(rec.phone)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setSentStatuses(prev => ({ ...prev, [rec.id]: true }))}
                            className={`h-8 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                              isDone
                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            }`}
                          >
                            {isDone ? (
                              <>
                                <Check size={13} className="text-emerald-700" />
                                <span>Envoyé</span>
                              </>
                            ) : (
                              <>
                                <ExternalLink size={13} />
                                <span>Ouvrir</span>
                              </>
                            )}
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
