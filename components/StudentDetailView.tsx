import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  User, Mail, Phone, MapPin, Calendar, Hash, 
  ShieldCheck, ArrowLeft, ArrowRight, X, Loader2,
  FileText, CreditCard, GraduationCap, AlertCircle,
  History, Ban, CheckCircle2, ChevronLeft, ChevronRight,
  Printer, Download, Trash2, Edit2, Info, RefreshCw, Rocket, Copy, MessageCircle,
  FileCheck2, Clock, XCircle
} from 'lucide-react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabase';
import { createClient } from '@supabase/supabase-js';

const secondarySupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'student-access-creation-key',
  }
});
import { UserProfile, UserRole, DocumentStatus } from '../types';
import { formatStudentName } from '../utils/formatters';
import { toast } from 'sonner';
import Modal from './Modal';
import { AuditLogger } from '../utils/auditLogger';
import { RetryableError } from './RetryableError';
import { getStudentAgeStatus } from '../utils/academicPath';
import { useSchool } from '../contexts/SchoolContext';
import StudentDocumentStatusModal from './StudentDocumentStatusModal';
import { 
  getDocumentDefinitionsForSchoolType, 
  normalizeStudentDocuments,
  calculateDocumentsCompleteness 
} from '../utils/documentRequirements';

const StudentDetailView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { terminology, school } = useSchool();
  
  const [student, setStudent] = useState<any | null>(null);
  const [studentDebt, setStudentDebt] = useState<number>(0);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [disciplinaryRecords, setDisciplinaryRecords] = useState<any[]>([]);
  const [adHocCampaigns, setAdHocCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Navigation states
  const [allStudentIds, setAllStudentIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  // Action states
  const [isClosingDossier, setIsClosingDossier] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  // Documents status modal state
  const [showDocsModal, setShowDocsModal] = useState(false);
  
  // Access generation states
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [isGeneratingAccess, setIsGeneratingAccess] = useState(false);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [accessError, setAccessError] = useState<string | null>(null);

  const fetchStudentData = useCallback(async (studentId: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Student Basic Info
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*, class:classes(*)')
        .eq('id', studentId)
        .eq('school_id', user.school_id)
        .single();
      
      if (studentError) throw studentError;
      setStudent(studentData);

      // 1.5 Fetch Global Debt
      try {
        const { data: debt } = await supabase.rpc('get_student_global_debt', { p_student_id: studentId });
        setStudentDebt(Number(debt || 0));
      } catch (e) {
        console.warn("Debt fetch failed", e);
      }
      const { data: enrollData } = await supabase
        .from('enrollments')
        .select('*, academic_year:academic_years(*), class:classes(*)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      setEnrollments(enrollData || []);

      // 3. Fetch Payments
      const { data: payData } = await supabase
        .from('payments')
        .select('*, academic_year:academic_years(*), campaign:ad_hoc_campaigns(id, name)')
        .eq('student_id', studentId)
        .eq('school_id', user.school_id)
        .order('created_at', { ascending: false });
        
      // 3.5 Fetch Supply Payments (if any)
      const { data: supplyData } = await supabase
        .from('school_supplies')
        .select('*, item:supply_catalog(name)')
        .eq('student_id', studentId)
        .eq('school_id', user.school_id)
        .gt('paid_amount', 0);

      const normalizedPayments = [
        ...(payData || []).map((p: any) => {
          let tLabel = p.nature || p.type || p.fee_type || 'Frais Divers';
          if (p.campaign?.name) {
            tLabel = `Campagne: ${p.campaign.name}`;
          } else if (p.ad_hoc_campaign_id) {
            tLabel = 'Frais de Campagne';
          } else if (p.fee_type === 'SCOLARITE' || (!p.fee_type && (!p.nature || p.nature === 'SCOLARITE' || p.nature === 'Scolarité'))) {
            tLabel = 'Frais Académiques';
          } else if (p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === "Frais d'inscription") {
            tLabel = 'Inscription';
          }
          return {
            id: p.id,
            date: p.date || p.created_at,
            label: tLabel,
            amount: p.amount_htg_equivalent || p.amount
          };
        }),
        ...(supplyData || []).map((s: any) => ({
          id: s.id,
          date: s.sale_date || s.created_at,
          label: `Achat Fourniture: ${s.item?.name || s.description || 'Article'}`,
          amount: s.amount_htg_equivalent || s.paid_amount
        }))
      ];
      
      normalizedPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setPayments(normalizedPayments);

      // 4. Fetch Disciplinary Records
      const { data: discData } = await supabase
        .from('disciplinary_records')
        .select('*')
        .eq('student_id', studentId)
        .order('incident_date', { ascending: false });
      setDisciplinaryRecords(discData || []);

      // 5. Fetch Ad-Hoc Campaigns
      try {
        const { data: campaignData } = await supabase
          .from('student_ad_hoc_fees')
          .select(`
            id,
            custom_amount,
            adjustment_reason,
            campaign:ad_hoc_campaigns!campaign_id(id, name, amount, currency, status, due_date, type, academic_year:academic_year_id(label))
          `)
          .eq('student_id', studentId);
        if (campaignData) {
          setAdHocCampaigns(campaignData.map((fee: any) => {
            if (!fee.campaign) return null;
            return {
              ...fee.campaign,
              custom_amount: fee.custom_amount,
              adjustment_reason: fee.adjustment_reason,
              fee_id: fee.id
            };
          }).filter(Boolean));
        }
      } catch (err) {
        console.warn("Failed to fetch ad hoc campaigns linking", err);
      }

    } catch (err: any) {
      console.error("Error fetching student details:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNavigationList = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', user.school_id)
        .order('last_name');
      
      if (data) {
        const ids = data.map(s => s.id);
        setAllStudentIds(ids);
        if (id) {
          setCurrentIndex(ids.indexOf(id));
        }
      }
    } catch (err) {
      console.error("Error fetching navigation list:", err);
    }
  }, [user.school_id, id]);

  useEffect(() => {
    if (id) {
      fetchStudentData(id);
    }
    fetchNavigationList();
  }, [id, fetchStudentData, fetchNavigationList]);

  // Real-time synchronization for student details and balances in administrative profile view
  useEffect(() => {
    if (!id || !user?.school_id) return;

    const channelName = `admin_student_detail_${id}`;
    const detailSub = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'payments', 
        filter: `student_id=eq.${id}` 
      }, () => {
        fetchStudentData(id);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'student_ad_hoc_fees', 
        filter: `student_id=eq.${id}` 
      }, () => {
        fetchStudentData(id);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'enrollments',
        filter: `student_id=eq.${id}`
      }, () => {
        fetchStudentData(id);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'students',
        filter: `id=eq.${id}`
      }, () => {
        fetchStudentData(id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(detailSub);
    };
  }, [id, user?.school_id, fetchStudentData]);

  const handleNext = () => {
    if (currentIndex < allStudentIds.length - 1) {
      const nextId = allStudentIds[currentIndex + 1];
      navigate(`/eleves/detail/${nextId}`);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevId = allStudentIds[currentIndex - 1];
      navigate(`/eleves/detail/${prevId}`);
    }
  };

  const handleCloseDossier = async () => {
    if (!student) return;
    setIsClosingDossier(true);
    try {
      const { error: updateError } = await supabase
        .from('students')
        .update({ 
          status: 'Inactif',
          notes: (student.notes || '') + `\n[Dossier Clos le ${new Date().toLocaleDateString()} par ${user.full_name}. Raison: ${closeReason}]`
        })
        .eq('id', student.id);
      
      if (updateError) throw updateError;

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'student',
        entity_id: student.id,
        details: { type: 'close_dossier', reason: closeReason }
      });

      toast.success("Dossier clos avec succès.");
      setStudent({ ...student, status: 'Inactif' });
      setShowCloseModal(false);
    } catch (err: any) {
      toast.error("Erreur lors de la fermeture du dossier : " + err.message);
    } finally {
      setIsClosingDossier(false);
    }
  };

  const handleGenerateAccess = async () => {
    if (!student || !accessEmail || !accessPassword) {
      setAccessError("L'email et le mot de passe sont requis.");
      return;
    }

    setIsGeneratingAccess(true);
    setAccessError(null);

    try {
      const { data, error } = await secondarySupabase.auth.signUp({
        email: accessEmail,
        password: accessPassword,
        options: {
          data: {
            full_name: formatStudentName(student.last_name, student.first_name).fullName,
            role: UserRole.STUDENT,
            school_id: user.school_id,
          }
        }
      });

      if (error) throw error;
      
      const newUserId = data.user?.id;
      if (!newUserId || (data.user?.identities && data.user.identities.length === 0)) {
        throw new Error("Cet email est déjà utilisé par un autre compte.");
      }

      // Link student_id and force password reset
      await supabase
        .from('profiles')
        .update({ force_password_change: true })
        .eq('id', newUserId)
        .eq('school_id', user.school_id);
        
      // Ensure student object holds the latest email
      await supabase.from('students').update({ parent_email: accessEmail }).eq('id', student.id).eq('school_id', user.school_id);

      toast.success("Compte étudiant créé avec succès.");
      
      // Update local state if needed
      setStudent({...student, parent_email: accessEmail});
      
      setShowAccessModal(false);
    } catch (err: any) {
      setAccessError(err.message || "Erreur lors de la création du compte.");
    } finally {
      setIsGeneratingAccess(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-gray-500 font-medium animate-pulse">Chargement du dossier {terminology.student.toLowerCase()}...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <RetryableError 
          message={error || "Dossier introuvable"} 
          onRetry={() => id && fetchStudentData(id)} 
        />
        <button 
          onClick={() => navigate('/eleves')} 
          className="mt-6 text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
        >
          Retour au Registre
        </button>
      </div>
    );
  }

  const fullName = formatStudentName(student.last_name, student.first_name).fullName;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24 px-4 sm:px-6 lg:px-8">
      {/* Header & Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        {/* Row 1: Identity & Nav-Pagination */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto">
            <button 
              onClick={() => navigate('/eleves')} 
              className="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all flex items-center gap-2 shrink-0" 
              title="Retour au Registre"
            >
              <ArrowLeft size={22} />
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest text-gray-500">Retour</span>
            </button>
            <div className={`w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-2xl flex items-center justify-center font-bold text-base sm:text-xl shadow-xs ${student.gender === 'Masculin' ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}`}>
              {student.last_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate leading-tight">{fullName}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0 ${
                  student.status === 'Actif' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                  student.status === 'Reliquat' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {student.status}
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap text-slate-500 text-xs font-semibold">
                  <span className="text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-wider">ID {terminology.student} :</span>
                  <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5 max-w-full overflow-hidden">
                    <span className="font-mono text-slate-800 font-bold select-all truncate text-[10px] sm:text-xs tracking-tight" title={student.id}>
                      {student.id}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => {
                        navigator.clipboard.writeText(student.id);
                        toast.success("ID copié !");
                      }}
                      className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors cursor-pointer shrink-0"
                      title="Copier l'ID"
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                  <span className="text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-wider">{terminology.class} :</span>
                  <span className="text-indigo-600 font-black uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs">
                    {student.class?.name || 'Sans Classe'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Record Navigation (1/53) */}
          <div className="flex items-center justify-between w-full md:w-auto bg-slate-100/70 p-1 rounded-xl border border-slate-200 shrink-0 self-stretch md:self-auto">
            <button 
              disabled={currentIndex <= 0} 
              onClick={handlePrev}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg disabled:opacity-30 transition-all cursor-pointer"
              title="Précédent"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-4 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-600 whitespace-nowrap font-mono">
              {currentIndex + 1} / {allStudentIds.length}
            </span>
            <button 
              disabled={currentIndex >= allStudentIds.length - 1} 
              onClick={handleNext}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg disabled:opacity-30 transition-all cursor-pointer"
              title="Suivant"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Operational Action Bar */}
        <div className="bg-slate-50/80 py-2.5 px-3 sm:px-6 border-t border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 w-full">
          {/* Action indicator tag */}
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold shrink-0">
            <ShieldCheck size={15} className="text-indigo-600 shrink-0" />
            <span>Actions sur le dossier {terminology.student.toLowerCase()}</span>
          </div>

          {/* Action Buttons with responsive wrapping and proper sizing */}
          <div className="flex items-center gap-2 w-full xl:w-auto flex-wrap justify-start xl:justify-end">
            <button 
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all flex items-center gap-1.5 h-8 sm:h-9 cursor-pointer shadow-xs font-bold text-[11px] sm:text-xs active:scale-[0.98] shrink-0" 
              title="Imprimer le dossier"
            >
              <Printer size={14} className="text-slate-500 shrink-0" />
              <span>Imprimer</span>
            </button>
            {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR || user.role === UserRole.SECRETARY) && (
              <>
                <button 
                  type="button"
                  onClick={() => setShowDocsModal(true)}
                  className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 rounded-xl transition-all flex items-center gap-1.5 h-8 sm:h-9 cursor-pointer shadow-xs font-bold text-[11px] sm:text-xs active:scale-[0.98] shrink-0" 
                  title="Changer le statut des pièces justificatives"
                >
                  <FileCheck2 size={14} className="text-indigo-600 shrink-0" />
                  <span>Statut Pièces</span>
                </button>
                <button 
                  type="button"
                  onClick={() => navigate(`/eleves/reinscrire/${student.id}`)}
                  className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 rounded-xl transition-all flex items-center gap-1.5 h-8 sm:h-9 cursor-pointer shadow-xs font-bold text-[11px] sm:text-xs active:scale-[0.98] shrink-0" 
                  title="Réinscrire (Promotion)"
                >
                  <RefreshCw size={14} className="text-emerald-600 shrink-0" />
                  <span>Réinscrire</span>
                </button>
                <button 
                  type="button"
                  onClick={() => navigate(`/eleves/modifier/${student.id}`)}
                  className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 rounded-xl transition-all flex items-center gap-1.5 h-8 sm:h-9 cursor-pointer shadow-xs font-bold text-[11px] sm:text-xs active:scale-[0.98] shrink-0" 
                  title="Modifier les informations"
                >
                  <Edit2 size={14} className="text-amber-600 shrink-0" />
                  <span>Modifier</span>
                </button>
              </>
            )}
            {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR) && (
              <button 
                type="button"
                onClick={() => {
                  setAccessEmail(student.email || student.parent_email || "");
                  setAccessPassword(Math.random().toString(36).slice(-8) + "A1!");
                  setAccessError(null);
                  setShowAccessModal(true);
                }}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 rounded-xl transition-all flex items-center gap-1.5 h-8 sm:h-9 cursor-pointer shadow-xs font-bold text-[11px] sm:text-xs active:scale-[0.98] shrink-0" 
                title="Générer un accès en ligne"
              >
                <User size={14} className="text-indigo-600 shrink-0" />
                <span>Accès Web</span>
              </button>
            )}
            {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR) && student.status !== 'Inactif' && (
              <button 
                type="button"
                onClick={() => setShowCloseModal(true)}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 rounded-xl transition-all flex items-center gap-1.5 h-8 sm:h-9 cursor-pointer shadow-xs font-bold text-[11px] sm:text-xs active:scale-[0.98] shrink-0"
                title="Clore ou désactiver le dossier"
              >
                <Ban size={14} className="text-rose-600 shrink-0" />
                <span>Fermer Dossier</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Info Panels */}
        <div className="lg:col-span-8 space-y-6">
          {/* Identity & Contact */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
              <User className="text-blue-600" size={20} />
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Identité & Coordonnées</h3>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Calendar size={18} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date de Naissance</p>
                    <p className="text-sm font-bold text-gray-900">{student.dob ? new Date(student.dob).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Non renseignée'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><MapPin size={18} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lieu de Naissance</p>
                    <p className="text-sm font-bold text-gray-900">{student.pob || 'Non renseigné'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Hash size={18} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">NIF / Matricule</p>
                    <p className="text-sm font-bold text-gray-900">{student.nif || 'Non renseigné'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><MapPin size={18} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Adresse Domicile</p>
                    <p className="text-sm font-bold text-gray-900">{student.address || 'Non renseignée'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><ShieldCheck size={18} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Âge Estimé & Statut</p>
                    <div className="flex items-center gap-2">
                       <p className="text-sm font-bold text-gray-900">
                         {(() => {
                           if (!student.dob) return 'N/A';
                           const birthDate = new Date(student.dob);
                           const refDate = new Date(new Date().getFullYear(), 8, 1);
                           let age = refDate.getFullYear() - birthDate.getFullYear();
                           const m = refDate.getMonth() - birthDate.getMonth();
                           if (m < 0 || (m === 0 && refDate.getDate() < birthDate.getDate())) age--;
                           
                           const status = student.class ? getStudentAgeStatus(age, student.class.name, student.class.level) : 'NORMAL';
                           
                           return (
                             <span className="flex items-center gap-2">
                               {age} ans
                               {status === 'LATE' && (
                                 <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-tight">Retardataire</span>
                               )}
                               {status === 'CRITICAL' && (
                                 <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-black uppercase tracking-tight">Hors Plage</span>
                               )}
                             </span>
                           );
                         })()}
                       </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><ShieldCheck size={18} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sexe</p>
                    <p className="text-sm font-bold text-gray-900">{student.gender}</p>
                  </div>
                </div>

                {student.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Phone size={18} /></div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Téléphone Personnel</p>
                      <p className="text-sm font-bold text-gray-900">{student.phone}</p>
                    </div>
                  </div>
                )}
                
                {student.email && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Mail size={18} /></div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email Personnel</p>
                      <p className="text-sm font-bold text-gray-900">{student.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parent Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
              <ShieldCheck className="text-indigo-600" size={20} />
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                {['LICENCE', 'MASTER', 'DOCTORAT', 'CERTIFICAT', 'DIPLOME'].includes(student.class?.level || '') 
                  ? "Personne de Référence / Contact d'Urgence" 
                  : "Responsable Légal"}
              </h3>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><User size={18} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {['LICENCE', 'MASTER', 'DOCTORAT', 'CERTIFICAT', 'DIPLOME'].includes(student.class?.level || '') 
                        ? "Nom de la personne" 
                        : "Nom du Parent / Tuteur"}
                    </p>
                    <p className="text-sm font-bold text-gray-900">{student.parent_name || 'Non renseigné'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Info size={18} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {['LICENCE', 'MASTER', 'DOCTORAT', 'CERTIFICAT', 'DIPLOME'].includes(student.class?.level || '') 
                        ? `Lien avec l'${terminology.student.toLowerCase()}` 
                        : "Lien de Parenté"}
                    </p>
                    <p className="text-sm font-bold text-gray-900">{student.parent_relation || 'Non renseigné'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0"><Phone size={18} /></div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Téléphone</p>
                      <p className="text-sm font-bold text-gray-900">{student.parent_phone || 'Non renseigné'}</p>
                    </div>
                  </div>
                  {student.parent_phone && (
                    <a
                      href={`https://wa.me/${student.parent_phone.replace(/\D/g, '').length === 8 ? '509' + student.parent_phone.replace(/\D/g, '') : student.parent_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour ${student.parent_name || 'Parent'},\nConcernant l'élève ${formatStudentName(student.last_name, student.first_name).fullName} (Classe: ${student.class?.name || ''}) à ${school?.name || 'EduNova Pro'}...`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow transition-all shrink-0 active:scale-95"
                      title="Envoyer un message WhatsApp direct"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3 p-2.5">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><Mail size={18} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email</p>
                    <p className="text-sm font-bold text-gray-900">{student.parent_email || 'Non renseigné'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Pièces Justificatives & Dossier d'Admission */}
          {(() => {
            const defs = getDocumentDefinitionsForSchoolType(school?.school_type, school?.global_settings);
            const normalizedDocs = normalizeStudentDocuments(student.submitted_documents, school?.school_type, school?.global_settings);
            const completeness = calculateDocumentsCompleteness(normalizedDocs, school?.school_type, school?.global_settings);

            return (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                      <FileCheck2 size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                        Pièces Justificatives & Dossier d'{terminology.enrollment || 'Admission'}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Contrôle réglementaire ({school?.school_type === 'UNIVERSITY' ? 'Universitaire' : school?.school_type === 'PROFESSIONAL' ? 'Professionnel' : 'Scolaire Général'})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border ${
                      completeness.isComplete ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      completeness.hasRejection ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {completeness.isComplete ? <CheckCircle2 size={14} className="text-emerald-600" /> :
                       completeness.hasRejection ? <XCircle size={14} className="text-rose-600" /> :
                       <Clock size={14} className="text-amber-600" />}
                      {completeness.validatedCount}/{completeness.total} Validée(s)
                      {completeness.rejectedCount > 0 && ` • ${completeness.rejectedCount} Rejetée(s)`}
                    </span>

                    {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR || user.role === UserRole.SECRETARY) && (
                      <button
                        type="button"
                        onClick={() => setShowDocsModal(true)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs hover:shadow transition-all cursor-pointer shrink-0 active:scale-95"
                        title="Mettre à jour le statut des pièces"
                      >
                        <Edit2 size={13} />
                        <span>Mettre à jour</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {defs.map((def) => {
                    const doc = normalizedDocs[def.id] || { name: def.name, status: 'EN_ATTENTE' as DocumentStatus, notes: '', updated_at: undefined, updated_by: undefined };
                    const isValide = doc.status === 'VALIDE';
                    const isRejete = doc.status === 'REJETE';
                    const isAttente = doc.status === 'EN_ATTENTE';

                    return (
                      <div
                        key={def.id}
                        onClick={() => {
                          if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR || user.role === UserRole.SECRETARY) {
                            setShowDocsModal(true);
                          }
                        }}
                        className={`p-3.5 rounded-xl border transition-all duration-200 space-y-2 cursor-pointer hover:shadow-xs ${
                          isValide ? 'bg-emerald-50/30 border-emerald-200/80 hover:bg-emerald-50/60' :
                          isRejete ? 'bg-rose-50/30 border-rose-200/80 hover:bg-rose-50/60' :
                          'bg-slate-50/60 border-slate-200/80 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="text-xs font-black text-slate-900 leading-snug">{def.name}</div>
                            <div className="text-[11px] text-slate-500 font-medium leading-relaxed">{def.description}</div>
                          </div>
                          
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black shrink-0 border ${
                            isValide ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            isRejete ? 'bg-rose-100 text-rose-800 border-rose-300' :
                            'bg-amber-100 text-amber-800 border-amber-300'
                          }`}>
                            {isValide ? <CheckCircle2 size={12} className="text-emerald-700" /> :
                             isRejete ? <XCircle size={12} className="text-rose-700" /> :
                             <Clock size={12} className="text-amber-700" />}
                            {isValide ? 'Validé' : isRejete ? 'Rejeté' : 'En attente'}
                          </span>
                        </div>

                        {doc.notes && (
                          <div className={`p-2 rounded-lg text-[11px] font-medium border ${
                            isRejete ? 'bg-rose-100/70 border-rose-200 text-rose-900' : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}>
                            <span className="font-bold">Observation : </span>{doc.notes}
                          </div>
                        )}

                        {doc.updated_at && (
                          <div className="text-[10px] text-slate-400 font-medium text-right pt-0.5">
                            Mis à jour le {new Date(doc.updated_at).toLocaleDateString('fr-FR')} {doc.updated_by ? `par ${doc.updated_by}` : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Academic History */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
              <GraduationCap className="text-amber-600" size={20} />
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Parcours Académique</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="px-6 py-3">Session</th>
                    <th className="px-6 py-3">Classe</th>
                    <th className="px-6 py-3">Niveau</th>
                    <th className="px-6 py-3">Statut Financier</th>
                    <th className="px-6 py-3">Date d'Inscription</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {enrollments.map((env) => (
                    <tr key={env.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${env.academic_year?.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {env.academic_year?.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{env.class?.name}</td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-500">{env.class?.level}</td>
                      <td className="px-6 py-4">
                        {(env.tuition_discount > 0 || env.tuition_addition > 0) ? (
                          <div className="flex flex-col gap-1">
                            {env.tuition_discount > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full whitespace-nowrap w-fit">
                                Réduction: -{env.tuition_discount.toLocaleString()} G
                              </span>
                            )}
                            {env.tuition_addition > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full whitespace-nowrap w-fit">
                                Majoration: +{env.tuition_addition.toLocaleString()} G
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Standard</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">{new Date(env.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {enrollments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-xs italic">Aucun historique d'inscription trouvé</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Ad-Hoc Campaigns */}
          {adHocCampaigns.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-indigo-100/50 flex items-center gap-3">
                <Rocket className="text-indigo-600" size={20} />
                <h3 className="font-bold text-indigo-900 text-sm uppercase tracking-wider">Campagnes & Événements</h3>
              </div>
              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {adHocCampaigns.map((camp, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-4 border border-indigo-100 shadow-sm flex flex-col gap-2 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-100 to-transparent -mr-8 -mt-8 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                    <div className="flex items-start justify-between gap-2 z-10">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm truncate">{camp.name}</h4>
                        <p className="text-[10px] font-bold text-indigo-400 capitalize">{camp.type?.toLowerCase() || 'autre'} • {camp.academic_year?.label}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        camp.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        camp.status === 'PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        {camp.status === 'PROGRESS' ? 'En Cours' : camp.status === 'COMPLETED' ? 'Clôturée' : 'Brouillon'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-col gap-1 z-10">
                      {camp.due_date && (
                        <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                          <Calendar size={12} className="text-indigo-400" />
                          <span>Échéance: {new Date(camp.due_date).toLocaleDateString()}</span>
                        </p>
                      )}
                    </div>

                    {(() => {
                      const campPayments = payments.filter((p: any) => p.ad_hoc_campaign_id === camp.id && p.status !== 'ANNULE');
                      const totalPaidForCamp = campPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                      const requiredCampAmount = camp.custom_amount !== null && camp.custom_amount !== undefined ? Number(camp.custom_amount) : Number(camp.amount);
                      const campBalance = Math.max(requiredCampAmount - totalPaidForCamp, 0);
                      
                      return (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-col gap-2 z-10 text-xs">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                            <span className="text-slate-400 text-[9px] uppercase tracking-wider">Frais requis :</span>
                            {camp.custom_amount !== null && camp.custom_amount !== undefined ? (
                              <div className="flex flex-col items-end">
                                <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1" title={`Ajusté (Original: ${camp.amount.toLocaleString()} ${camp.currency})`}>
                                  ✏️ {Number(camp.custom_amount).toLocaleString()} {camp.currency}
                                </span>
                                {camp.adjustment_reason && (
                                  <span className="text-[9px] text-slate-500 italic max-w-[150px] truncate" title={camp.adjustment_reason}>
                                    "{camp.adjustment_reason}"
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="font-extrabold text-slate-700">{camp.amount.toLocaleString()} {camp.currency}</span>
                            )}
                          </div>

                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                            <span className="text-slate-400 text-[9px] uppercase tracking-wider">Total payé :</span>
                            <span className="font-extrabold text-emerald-600">{totalPaidForCamp.toLocaleString()} {camp.currency}</span>
                          </div>

                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                            <span className="text-slate-400 text-[9px] uppercase tracking-wider">Reste à payer :</span>
                            <span className={`font-black px-1.5 py-0.5 rounded ${campBalance === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {campBalance.toLocaleString()} {camp.currency}
                            </span>
                          </div>

                          {campPayments.length > 0 && (
                            <div className="mt-2 bg-slate-50/70 rounded-lg p-2 border border-slate-100 flex flex-col gap-1.5">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                                📋 Reçus / Paiements :
                              </p>
                              <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto">
                                {campPayments.map((p: any, pIdx: number) => (
                                  <div key={p.id || pIdx} className="flex justify-between items-center text-[9px] font-medium text-slate-600 border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                                    <div className="flex flex-col">
                                      <span className="font-extrabold text-slate-800">
                                        {p.receipt_number || `Reçu #${p.id.slice(0, 8)}`}
                                      </span>
                                      <span className="text-[8px] text-slate-400">
                                        {new Date(p.payment_date).toLocaleDateString()} via {p.payment_method}
                                      </span>
                                    </div>
                                    <span className="font-black text-slate-800">
                                      {Number(p.amount).toLocaleString()} {p.currency}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Financial & Disciplinary */}
        <div className="lg:col-span-4 space-y-6">
          {/* Financial Summary */}
          <div className="bg-slate-900 rounded-2xl shadow-xl p-5 sm:p-6 text-white space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="text-blue-400" size={20} />
                <h3 className="font-bold text-sm uppercase tracking-wider">État Financier</h3>
              </div>
              <Link to={`/economat/releves?studentId=${student.id}`} className="text-[10px] font-black text-blue-400 uppercase hover:text-blue-300 transition-colors">Détails</Link>
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance Actuelle</p>
              <h4 className={`text-3xl font-black tracking-tighter ${studentDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {studentDebt > 0 ? `${studentDebt.toLocaleString()} G (DUE)` : 'En Règle'}
              </h4>
            </div>

            {/* Wallet / Portefeuille credits */}
            <div className="pt-5 border-t border-white/10 space-y-2">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                👛 Portefeuille {terminology.student} (Crédits)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10 text-center">
                  <p className="text-[9px] text-gray-400 uppercase font-bold">Solde HTG</p>
                  <p className="text-sm font-black text-emerald-400">{(student.wallet_balance_htg || 0).toLocaleString()} G</p>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10 text-center">
                  <p className="text-[9px] text-gray-400 uppercase font-bold">Solde USD</p>
                  <p className="text-sm font-black text-indigo-400">{(student.wallet_balance_usd || 0).toLocaleString()} $</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 space-y-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Historique des Versements</p>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {payments.map(p => {
                  const displayDate = p.date ? new Date(p.date).toLocaleDateString('fr-FR') : 'Date inconnue';
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                      <div>
                        <p className="text-xs font-bold whitespace-nowrap text-white">{p.label}</p>
                        <p className="text-[10px] text-gray-400">{displayDate}</p>
                      </div>
                      <p className="text-sm font-black text-emerald-400">+{p.amount.toLocaleString()} G</p>
                    </div>
                  );
                })}
                {payments.length === 0 && <p className="text-xs text-gray-500 italic text-center py-4">Aucun versement enregistré</p>}
              </div>
            </div>
          </div>

          {/* Disciplinary Records */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
              <History className="text-rose-600" size={20} />
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Discipline</h3>
            </div>
            <div className="p-6 space-y-4">
              {disciplinaryRecords.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <CheckCircle2 className="mx-auto text-emerald-500" size={32} />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Conduite Exemplaire</p>
                  <p className="text-[10px] text-gray-500">Aucun incident répertorié au dossier.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {disciplinaryRecords.map(rec => (
                    <div key={rec.id} className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{rec.type}</span>
                        <span className="text-[10px] font-bold text-gray-400">{new Date(rec.incident_date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs font-bold text-rose-900">{rec.description}</p>
                      {rec.sanction && (
                        <div className="pt-2 border-t border-rose-200/50">
                          <p className="text-[10px] font-black text-rose-800 uppercase tracking-widest">Sanction : {rec.sanction}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes & Observations */}
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-700">
              <FileText size={18} />
              <h3 className="font-bold text-sm uppercase tracking-wider">Observations</h3>
            </div>
            <p className="text-xs font-medium text-amber-800 leading-relaxed italic">
              {student.notes || `Aucune observation particulière n'a été consignée pour cet ${terminology.student.toLowerCase()}.`}
            </p>
          </div>
        </div>
      </div>

      {/* Close Dossier Modal */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onConfirm={handleCloseDossier}
        isLoading={isClosingDossier}
        type="danger"
        title="Fermeture de Dossier"
        confirmLabel="Confirmer la Fermeture"
        cancelLabel="Annuler"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-3">
            <AlertCircle className="text-rose-600 shrink-0" size={20} />
            <p className="text-sm text-rose-800 font-medium leading-relaxed">
              Vous êtes sur le point de clore le dossier de <strong>{fullName}</strong>. 
              L'{terminology.student.toLowerCase()} passera au statut <strong>Inactif</strong> et ne figurera plus dans les listes de classe actives.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Motif de la fermeture</label>
            <textarea 
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-500 focus:ring-0 transition-all min-h-[100px]"
              placeholder="Ex: Transfert, Abandon, Fin de cursus..."
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Generate Access Modal */}
      <Modal
        isOpen={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        onConfirm={handleGenerateAccess}
        isLoading={isGeneratingAccess}
        title="Générer un Accès Web"
        type="info"
        confirmLabel="Générer l'accès"
        cancelLabel="Annuler"
      >
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 flex items-start gap-3">
             <User className="text-indigo-600 shrink-0" size={20} />
             <p className="text-sm font-medium text-indigo-800 leading-relaxed">
               Vous allez créer un compte pour permettre à <strong>{fullName}</strong> (ou ses parents) de se connecter à la plateforme.
             </p>
          </div>

          {accessError && (
             <div className="p-4 bg-rose-50 text-rose-700 text-sm font-bold rounded-xl border border-rose-200">
               {accessError}
             </div>
          )}

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">E-mail de connexion</label>
              <input
                required
                type="email"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                placeholder="Ex: etudiant@gmail.com"
                value={accessEmail}
                onChange={(e) => setAccessEmail(e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1.5 px-1 font-medium">Cet adresse email sera utilisée comme identifiant de connexion.</p>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Mot de passe temporaire</label>
              <input
                required
                type="text"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 font-mono outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm tracking-widest"
                value={accessPassword}
                onChange={(e) => setAccessPassword(e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1.5 px-1 font-medium italic">Un changement de mot de passe sera exigé à la première connexion.</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Document Status Update Modal */}
      {student && (
        <StudentDocumentStatusModal
          isOpen={showDocsModal}
          onClose={() => setShowDocsModal(false)}
          student={student}
          schoolType={school?.school_type}
          currentUser={user}
          onSuccess={(updatedDocs, updatedStatus) => {
            setStudent((prev: any) => ({
              ...prev,
              submitted_documents: updatedDocs,
              ...(updatedStatus ? { status: updatedStatus } : {})
            }));
            if (id) {
              fetchStudentData(id);
            }
          }}
        />
      )}
    </div>
  );
};

export default StudentDetailView;
