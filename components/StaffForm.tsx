import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Save, User, Briefcase, DollarSign, ArrowRight, ArrowLeft,
  ChevronDown, Contact, Loader2, AlertCircle, CheckCircle2, 
  ShieldCheck, MapPin, Mail, Phone, Banknote, Edit2, Clock, 
  Sparkles, FileText, Calendar, Tag, School, Search, Plus, X, Check,
  Building2, BadgeCheck, AlertTriangle, RefreshCw, Coins
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import { UserProfile, StaffRole, SchoolType } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { staffSchema } from '../utils/validation';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectPill, SelectOption } from './SelectPill';

interface StaffFormProps {
  user: UserProfile;
}

const COMMON_BANKS = [
  'SOGEBANK',
  'UNIBANK',
  'BUH',
  'BNC',
  'CAPITAL BANK',
  'BPH',
  'SOGEBEL',
  'MONCASH',
  'NATCASH'
];

const StaffForm: React.FC<StaffFormProps> = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { terminology, school, currentCampusId, campuses } = useSchool();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [initialCampusId, setInitialCampusId] = useState<string>('');

  // Custom states for searchable role dropdown
  const [roleSearch, setRoleSearch] = useState('');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [roleSuccessMsg, setRoleSuccessMsg] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (roleSuccessMsg) {
      const timer = setTimeout(() => setRoleSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [roleSuccessMsg]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'M',
    dob: '',
    phone: '',
    email: '',
    address: '',
    nif_cin: '',
    role: '',
    contractType: 'Permanent',
    payType: 'Fixe',
    amount: '',
    bankAccount: '',
    bankName: '',
    campus_id: user.campus_id || currentCampusId || ''
  });

  useEffect(() => {
    const initForm = async () => {
      setLoading(true);
      try {
        // 1. Charger les rôles dynamiques depuis la table staff_roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('staff_roles')
          .select('*')
          .or(user.school_id ? `school_id.eq.${user.school_id},school_id.is.null` : 'school_id.is.null')
          .order('label');
        
        if (rolesError) {
          console.warn("Notice loading dynamic roles:", rolesError.message);
        }

        const validRoles = (rolesData || []).filter(r => r.label && r.label.trim() !== '');

        if (validRoles.length > 0) {
          setRoles(validRoles);
          if (!isEdit) setFormData(prev => ({ ...prev, role: validRoles[0].label }));
        } else {
          // Fallback statique selon le type d'établissement
          let defaultRoles = [{ id: '1', label: 'Enseignant' }, { id: '2', label: 'Direction' }, { id: '3', label: 'Surveillant Général' }, { id: '4', label: 'Comptable' }];
          let defaultRoleValue = 'Enseignant';

          if (school?.school_type === SchoolType.UNIVERSITY) {
            defaultRoles = [
              { id: '1', label: 'Professeur' },
              { id: '2', label: 'Doyen / Rectorat' },
              { id: '3', label: 'Secrétaire Académique' },
              { id: '4', label: 'Économat / Comptabilité' }
            ];
            defaultRoleValue = 'Professeur';
          } else if (school?.school_type === SchoolType.PROFESSIONAL) {
            defaultRoles = [
              { id: '1', label: 'Formateur Technique' },
              { id: '2', label: 'Directeur de Centre' },
              { id: '3', label: 'Assistant Administratif' },
              { id: '4', label: 'Responsable Financier' }
            ];
            defaultRoleValue = 'Formateur Technique';
          }

          setRoles(defaultRoles as any);
          if (!isEdit) setFormData(prev => ({ ...prev, role: defaultRoleValue }));
        }

        // 2. Si édition, charger le collaborateur
        if (isEdit) {
          const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('id', id)
            .eq('school_id', user.school_id)
            .single();
          
          if (error) {
            console.error("Erreur lors du chargement du staff:", error);
            setApiError(`Impossible de charger le dossier : ${error.message}`);
            return;
          }

          if (data) {
            if (currentCampusId && data.campus_id && data.campus_id !== currentCampusId) {
              setApiError("Vous n'avez pas l'autorisation d'éditer ce profil appartenant à une autre annexe.");
              return;
            }
            setInitialCampusId(data.campus_id || '');
            setFormData({
              firstName: data.first_name || '',
              lastName: data.last_name || '',
              gender: data.gender || 'M',
              dob: data.dob || '',
              phone: data.phone || '',
              email: data.email || '',
              address: data.address || '',
              nif_cin: data.nif_cin || '',
              role: data.role || '',
              contractType: data.contract_type || 'Permanent',
              payType: data.pay_type || 'Fixe',
              amount: data.amount?.toString() || '',
              bankAccount: data.bank_account || '',
              bankName: data.bank_name || '',
              campus_id: data.campus_id || ''
            });
          } else {
            setApiError("Aucun collaborateur trouvé pour cet identifiant.");
          }
        }
      } catch (err: any) {
        setApiError(err.message);
      } finally {
        setLoading(false);
      }
    };
    initForm();
  }, [id, isEdit, user.school_id, user.campus_id, currentCampusId, school?.school_type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let processedValue = value;

    if (name === 'phone') {
      // Format 0000-0000 (8 digits)
      const digits = value.replace(/\D/g, '').slice(0, 8);
      if (digits.length <= 4) {
        processedValue = digits;
      } else {
        processedValue = `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
      }
    }

    setFormData(prev => {
      const newData = { ...prev, [name]: processedValue };
      
      // Ergonomie : synchroniser automatiquement le type de contrat et la rémunération
      if (name === 'contractType') {
        if (value === 'Permanent') {
          newData.payType = 'Fixe';
        } else if (value === 'Vacationnaire') {
          newData.payType = 'Horaire';
        }
      }
      
      return newData;
    });
  };

  const handleSelectRole = (roleLabel: string) => {
    setFormData(prev => ({ ...prev, role: roleLabel }));
    setRoleSearch('');
    setIsRoleDropdownOpen(false);
  };

  const handleCreateNewRole = async () => {
    if (!roleSearch.trim()) return;
    setIsCreatingRole(true);
    try {
      const newRoleLabel = roleSearch.trim();
      const { data, error } = await supabase
        .from('staff_roles')
        .insert([
          {
            school_id: user.school_id,
            label: newRoleLabel,
            description: `Créé à la volée depuis le formulaire de recrutement`
          }
        ])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setRoles(prev => [...prev, data].sort((a, b) => a.label.localeCompare(b.label)));
        setFormData(prev => ({ ...prev, role: data.label }));
        setRoleSuccessMsg(`Le poste "${data.label}" a été créé et sélectionné !`);
        setRoleSearch('');
        setIsRoleDropdownOpen(false);
      }
    } catch (err: any) {
      console.error("Erreur de création de poste:", err);
      setApiError("Impossible de créer le poste : " + err.message);
    } finally {
      setIsCreatingRole(false);
    }
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const detectedAge = useMemo(() => calculateAge(formData.dob), [formData.dob]);

  // Initiales dynamiques
  const initials = useMemo(() => {
    const f = formData.firstName.trim().charAt(0).toUpperCase();
    const l = formData.lastName.trim().charAt(0).toUpperCase();
    return `${f}${l}` || 'RH';
  }, [formData.firstName, formData.lastName]);

  // Détection multi-annexes réelle
  const hasMultipleCampuses = useMemo(() => {
    return Boolean(school?.has_multi_campus && campuses && campuses.length > 1);
  }, [school?.has_multi_campus, campuses]);

  // Campus sélectionné / actif
  const selectedCampusName = useMemo(() => {
    if (!hasMultipleCampuses) {
      return school?.name || 'Établissement Principal';
    }
    if (!formData.campus_id) return 'Siège Principal / Global';
    const found = campuses?.find(c => c.id === formData.campus_id);
    return found ? found.name : 'Annexe assignée';
  }, [formData.campus_id, campuses, hasMultipleCampuses, school?.name]);

  // Options mémorisées pour le campus d'affectation
  const campusSelectOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [
      { value: '', label: 'Administration Centrale (Toutes les Annexes)', badge: 'Global', icon: School }
    ];
    if (campuses && campuses.length > 0) {
      campuses.forEach(c => {
        opts.push({
          value: c.id,
          label: c.name,
          badge: 'Annexe',
          icon: Building2
        });
      });
    }
    return opts;
  }, [campuses]);

  // Options mémorisées pour le mode de rémunération
  const payTypeOptions: SelectOption[] = useMemo(() => [
    { value: 'Fixe', label: 'Salaire Fixe Mensuel', badge: 'Mensuel', description: 'Rémunération fixe versée chaque mois' },
    { value: 'Horaire', label: 'Taux Horaire / Prestation', badge: 'Horaire', description: 'Rémunération selon les heures prestées' },
  ], []);

  const handleNext = () => {
    if (step === 1) {
      if (!formData.lastName.trim() || !formData.firstName.trim() || !formData.phone.trim() || !formData.dob) {
        setApiError("Veuillez renseigner tous les champs obligatoires (*) : Nom, Prénom, Téléphone et Date de naissance.");
        return;
      }
      const age = calculateAge(formData.dob);
      if (age !== null && age < 16) {
        setApiError(`Âge non conforme : Le collaborateur doit être âgé d'au moins 16 ans (Âge détecté : ${age} ans).`);
        return;
      }
    }
    if (step === 2) {
      if (!formData.role.trim() || !formData.amount.toString().trim()) {
        setApiError("Veuillez sélectionner un poste de travail et spécifier le montant de rémunération.");
        return;
      }
      if (parseFloat(formData.amount) <= 0) {
        setApiError("Le montant de rémunération doit être strictement supérieur à zéro.");
        return;
      }
    }
    setApiError(null);
    setStep(prev => Math.min(3, prev + 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Strict safeguard: Only permit cloud submission when on step 3
    if (step < 3) {
      handleNext();
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    setApiError(null);

    const validationResult = staffSchema.safeParse(formData);
    if (!validationResult.success) {
      setApiError(validationResult.error.issues[0].message);
      setIsSubmitting(false);
      return;
    }

    const schoolId = user.school_id;
    if (!schoolId) {
      setApiError("Établissement non identifié. Veuillez vous reconnecter.");
      setIsSubmitting(false);
      return;
    }

    const finalCampusId = user.campus_id || formData.campus_id || currentCampusId || null;

    const formattedNames = formatStudentName(formData.lastName, formData.firstName);

    const payload = {
      school_id: schoolId,
      campus_id: finalCampusId,
      first_name: formattedNames.firstName,
      last_name: formattedNames.lastName,
      gender: formData.gender,
      dob: formData.dob || null,
      nif_cin: formData.nif_cin.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || null,
      address: formData.address.trim(),
      role: formData.role.trim(),
      contract_type: formData.contractType,
      pay_type: formData.payType,
      amount: parseFloat(formData.amount) || 0,
      bank_name: formData.bankName.trim(),
      bank_account: formData.bankAccount.trim(),
      status: 'Actif'
    };

    try {
      let insertedId = id;
      if (isEdit) {
        const { error } = await supabase
          .from('staff')
          .update(payload)
          .eq('id', id)
          .eq('school_id', user.school_id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('staff')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        if (data) insertedId = data.id;
      }
      
      const actionType: 'CREATE' | 'UPDATE' = isEdit ? 'UPDATE' : 'CREATE';
      let transferInfo = {};
      if (isEdit && initialCampusId !== (payload.campus_id || '')) {
        transferInfo = { 
          transferred: true, 
          from_campus: initialCampusId || 'Centrale', 
          to_campus: payload.campus_id || 'Centrale', 
          transfer_action: 'TRANSFER' 
        };
      }

      AuditLogger.log({
        school_id: schoolId,
        user_id: user.id,
        action: actionType,
        entity_type: 'staff',
        entity_id: insertedId,
        details: { 
          role: payload.role, 
          first_name: payload.first_name, 
          last_name: payload.last_name, 
          ...transferInfo 
        }
      });
      
      setShowSuccess(true);
    } catch (err: any) {
      setApiError(err.message || "Erreur de synchronisation Cloud. Veuillez vérifier votre connexion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 animate-in fade-in">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center shadow-inner">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800">Initialisation du dossier RH...</p>
          <p className="text-xs text-slate-400 mt-1">Chargement des référentiels de postes et annexes</p>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-[65vh] flex flex-col items-center justify-center max-w-xl mx-auto px-4 py-8 animate-in zoom-in duration-300">
        <div className="w-full bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-slate-100 text-center space-y-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-blue-50 rounded-full blur-2xl pointer-events-none" />
          
          <div className="w-20 h-20 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
            <CheckCircle2 size={40} className="stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
              <BadgeCheck size={14} /> Dossier Validé
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isEdit ? 'Dossier Mis à Jour avec Succès' : 'Recrutement Enregistré !'}
            </h2>
            <p className="text-slate-500 font-medium text-sm max-w-md mx-auto">
              Le profil contractuel de <strong className="text-slate-800">{formData.firstName} {formData.lastName}</strong> ({formData.role}) a été synchronisé et certifié dans le registre RH.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-left text-xs text-slate-600 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Affectation Annexe :</span>
              <span className="font-semibold text-slate-800">{selectedCampusName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Contrat & Régime :</span>
              <span className="font-semibold text-slate-800">{formData.contractType} ({formData.payType})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Rémunération :</span>
              <span className="font-bold text-blue-700 font-mono">{parseFloat(formData.amount || '0').toLocaleString()} HTG</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button 
              onClick={() => navigate('/personnel')} 
              className="flex-1 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              <Contact size={16} /> Consulter le Registre RH
            </button>
            {!isEdit && (
              <button 
                onClick={() => {
                  setShowSuccess(false);
                  setStep(1);
                  setFormData({
                    firstName: '',
                    lastName: '',
                    gender: 'M',
                    dob: '',
                    phone: '',
                    email: '',
                    address: '',
                    nif_cin: '',
                    role: roles[0]?.label || 'Enseignant',
                    contractType: 'Permanent',
                    payType: 'Fixe',
                    amount: '',
                    bankAccount: '',
                    bankName: '',
                    campus_id: user.campus_id || currentCampusId || ''
                  });
                }}
                className="px-6 py-3.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-semibold text-sm border border-blue-200 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Nouveau Recrutement
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const stepsList = [
    { id: 1, title: 'Identité', subtitle: 'Infos personnelles', icon: User },
    { id: 2, title: 'Contrat & Paie', subtitle: 'Poste & salaire', icon: Briefcase },
    { id: 3, title: 'Validation', subtitle: 'Synthèse finale', icon: ShieldCheck }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5 md:space-y-6 animate-in fade-in duration-300 pb-20">
      
      {/* Top Banner & Modern Institutional Header */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl md:rounded-3xl shadow-xs border border-slate-200/80 p-4 md:p-6 relative overflow-hidden">
        {/* Subtle Ambient Background Accents */}
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-indigo-50/40 via-blue-50/20 to-transparent pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Retour"
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
            
            <div className="flex items-center gap-3 md:gap-3.5">
              <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shadow-xs shrink-0 ${
                isEdit 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-blue-600 text-white shadow-blue-500/10'
              }`}>
                {isEdit ? <Edit2 size={20} /> : <User size={22} />}
              </div>
              
              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                    {school?.name || 'RH'}
                  </span>
                  {hasMultipleCampuses && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                      <School size={10} /> {selectedCampusName}
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    Étape {step}/3
                  </span>
                </div>
                <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight leading-tight">
                  {isEdit ? 'Modifier le Dossier RH' : 'Recrutement & Dossier RH'}
                </h1>
                <p className="text-slate-500 font-medium text-xs">
                  {isEdit 
                    ? `Mise à jour des clauses contractuelles • ID : ${id?.slice(0, 8)}` 
                    : 'Fiche d\'engagement et informations contractuelles'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Stepper horizontal compact & fluid */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80 self-stretch lg:self-auto justify-between sm:justify-end shadow-2xs">
            {stepsList.map((st) => {
              const isCurrent = step === st.id;
              const isDone = step > st.id;

              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    if (isDone) setStep(st.id);
                  }}
                  disabled={!isDone && !isCurrent}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    isCurrent 
                      ? 'bg-white text-blue-700 shadow-xs font-bold border border-blue-200' 
                      : isDone 
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer font-semibold' 
                        : 'text-slate-400 opacity-60 cursor-not-allowed font-medium'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black transition-all ${
                    isCurrent 
                      ? 'bg-blue-600 text-white' 
                      : isDone 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isDone ? <Check size={11} className="stroke-[3]" /> : st.id}
                  </div>
                  <span className="hidden sm:inline text-xs leading-none font-bold">{st.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic step progress line */}
        <div className="w-full bg-slate-100 h-1 rounded-full mt-4 overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500"
            initial={{ width: '33%' }}
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Error notification banner */}
      {apiError && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border border-rose-200 p-4 md:p-5 rounded-2xl flex items-start gap-3.5 text-rose-700 font-medium text-sm shadow-xs"
        >
          <AlertCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-800">Information requise ou non conforme</p>
            <p className="text-xs md:text-sm text-rose-600 mt-0.5">{apiError}</p>
          </div>
          <button 
            type="button" 
            onClick={() => setApiError(null)} 
            className="p-1 hover:bg-rose-100 rounded-lg text-rose-500"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      {/* Main Form Container */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-6 md:p-10">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: IDENTITÉ & COORDONNÉES */}
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-7"
              >
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <Contact size={20} />
                    </div>
                    <div>
                      <h2 className="text-base md:text-lg font-black text-slate-900">Identité & Coordonnées</h2>
                      <p className="text-xs text-slate-500 font-medium">Informations personnelles et administratives du collaborateur</p>
                    </div>
                  </div>
                  
                  {/* Dynamic Avatar Preview */}
                  <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-1.5 rounded-2xl border border-slate-200/70 self-start sm:self-auto">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {initials}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-800 leading-tight">
                        {formData.firstName || formData.lastName ? `${formData.firstName} ${formData.lastName}` : 'Nouveau Collaborateur'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">Badge RH</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                  
                  {/* Nom de famille */}
                  <div className="space-y-1.5">
                    <label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      Nom de Famille <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      id="lastName" 
                      required 
                      name="lastName" 
                      type="text" 
                      placeholder="Ex : MARCELIN" 
                      className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all shadow-2xs" 
                      value={formData.lastName} 
                      onChange={handleChange} 
                    />
                  </div>

                  {/* Prénoms */}
                  <div className="space-y-1.5">
                    <label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      Prénom(s) <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      id="firstName" 
                      required 
                      name="firstName" 
                      type="text" 
                      placeholder="Ex : Jean-Baptiste" 
                      className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all shadow-2xs" 
                      value={formData.firstName} 
                      onChange={handleChange} 
                    />
                  </div>

                  {/* Civilité / Sexe */}
                  <div className="space-y-1.5">
                    <label htmlFor="gender" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      Sexe / Civilité <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 'M', label: 'Masculin' },
                        { val: 'F', label: 'Féminin' },
                        { val: 'Autre', label: 'Autre' }
                      ].map(g => (
                        <button
                          key={g.val}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, gender: g.val }))}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                            formData.gender === g.val 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                              : 'bg-slate-50/80 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date de Naissance & Âge dynamique */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="dob" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" /> Date de Naissance <span className="text-rose-500">*</span>
                      </label>
                      {detectedAge !== null && (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          detectedAge >= 18 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          detectedAge >= 16 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {detectedAge} ans {detectedAge < 16 ? '(Non éligible)' : '• Éligible'}
                        </span>
                      )}
                    </div>
                    <input 
                      id="dob" 
                      required 
                      name="dob" 
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all shadow-2xs" 
                      value={formData.dob} 
                      onChange={handleChange} 
                    />
                  </div>

                  {/* NIF / CIN */}
                  <div className="space-y-1.5">
                    <label htmlFor="nif_cin" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Tag size={13} className="text-slate-400" /> NIF / CIN (Identifiant National)
                    </label>
                    <input 
                      id="nif_cin" 
                      name="nif_cin" 
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all shadow-2xs font-mono" 
                      value={formData.nif_cin} 
                      onChange={handleChange} 
                      placeholder="000-000-000-0" 
                    />
                  </div>

                  {/* Téléphone */}
                  <div className="space-y-1.5">
                    <label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Phone size={13} className="text-slate-400" /> Téléphone Principal <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      id="phone" 
                      required 
                      name="phone" 
                      type="tel" 
                      placeholder="3700-0000" 
                      className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all shadow-2xs font-mono" 
                      value={formData.phone} 
                      onChange={handleChange} 
                    />
                    <p className="text-[11px] text-slate-400 font-medium ml-1">Format standard : 8 chiffres (ex : 3701-2345)</p>
                  </div>

                  {/* Email Pro */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Mail size={13} className="text-slate-400" /> Email Professionnel
                    </label>
                    <input 
                      id="email" 
                      name="email" 
                      type="email" 
                      placeholder="nom.prenom@edunova.pro" 
                      className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all shadow-2xs" 
                      value={formData.email} 
                      onChange={handleChange} 
                    />
                  </div>

                  {/* Adresse */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label htmlFor="address" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <MapPin size={13} className="text-slate-400" /> Adresse de Résidence
                    </label>
                    <textarea 
                      id="address" 
                      name="address" 
                      rows={2} 
                      placeholder="Numéro, Rue, Commune, Département..."
                      className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all resize-none shadow-2xs" 
                      value={formData.address} 
                      onChange={handleChange} 
                    />
                  </div>
                </div>

                {/* Multi-Tenant / Affectation Annexe Section */}
                {school?.has_multi_campus && campuses && campuses.length > 1 && (
                  <div className="mt-6 pt-5 border-t border-slate-100 space-y-2.5 bg-indigo-50/30 p-4.5 rounded-2xl border border-indigo-100/70">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <School className="text-indigo-600" size={16} />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950">Affectation Campus & Annexe</h3>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                        Multi-Campus
                      </span>
                    </div>
                    <p className="text-xs text-indigo-900/70 font-medium">
                      Rattachement à une annexe spécifique ou accès global (Administration Centrale).
                    </p>
                    
                    <div className="w-full pt-1">
                      <SelectPill
                        options={campusSelectOptions}
                        value={formData.campus_id}
                        onChange={(val) => setFormData(prev => ({ ...prev, campus_id: val }))}
                        variant="field"
                        size="md"
                        colorScheme="indigo"
                        dropdownAlign="left"
                        disabled={!!user.campus_id}
                        icon={Building2}
                        className="w-full"
                      />
                    </div>
                    {user.campus_id && (
                      <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1 mt-1">
                        <AlertTriangle size={12} /> Affectation verrouillée sur votre campus actuel.
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: CONTRAT & RÉMUNÉRATION */}
            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-7"
              >
                {/* Section Header */}
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <Briefcase size={20} />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-black text-slate-900">Contrat & Rémunération</h2>
                    <p className="text-xs text-slate-500 font-medium">Poste de travail, type d'engagement et coordonnées bancaires</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-7">
                  
                  {/* Poste de Travail (Searchable Role Dropdown) */}
                  <div className="space-y-1.5 relative" ref={dropdownRef}>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={13} className="text-blue-500" /> Poste & Fonction <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-blue-600 lowercase font-medium">Recherche instantanée</span>
                    </label>
                    
                    <div className="relative">
                      <div 
                        onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                        className={`w-full px-4 py-3 min-h-[46px] bg-slate-50 hover:bg-white border ${
                          isRoleDropdownOpen ? 'border-blue-500 ring-4 ring-blue-50 bg-white' : 'border-slate-200'
                        } rounded-xl text-sm font-bold text-slate-800 flex items-center justify-between cursor-pointer transition-all select-none shadow-2xs`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Briefcase size={16} className="text-blue-600 shrink-0" />
                          {formData.role ? (
                            <span className="text-blue-900 font-extrabold">{formData.role}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">Sélectionner ou créer un poste...</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {formData.role && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData(prev => ({ ...prev, role: '' }));
                              }}
                              className="p-1 hover:bg-slate-200 rounded-full transition-all text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          )}
                          <ChevronDown className={`text-slate-400 transition-transform duration-200 ${isRoleDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} size={16} />
                        </div>
                      </div>

                      {/* Dropdown Container */}
                      <AnimatePresence>
                        {isRoleDropdownOpen && (
                          <motion.div 
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col"
                            style={{ maxHeight: '360px' }}
                          >
                            {/* Search bar inside dropdown */}
                            <div className="p-3 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
                              <Search className="text-slate-400 shrink-0" size={16} />
                              <input 
                                type="text"
                                placeholder="Rechercher un rôle ou saisir un nouveau..."
                                className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400 font-medium"
                                value={roleSearch}
                                onChange={(e) => setRoleSearch(e.target.value)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                              {roleSearch && (
                                <button 
                                  type="button" 
                                  onClick={(e) => { e.stopPropagation(); setRoleSearch(''); }} 
                                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>

                            {/* Frequently Used Roles Shortcuts */}
                            {roles.length > 0 && (
                              <div className="p-2.5 bg-slate-50/40 border-b border-slate-100 flex flex-wrap gap-1.5 items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Fréquents :</span>
                                {roles.slice(0, 4).map(r => (
                                  <button
                                    key={r.id}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleSelectRole(r.label); }}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                      formData.role === r.label 
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                                        : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600'
                                    }`}
                                  >
                                    {r.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Scrollable list */}
                            <div className="overflow-y-auto max-h-[200px] divide-y divide-slate-50">
                              {roles.filter(r => r.label.toLowerCase().includes(roleSearch.toLowerCase())).length > 0 ? (
                                roles.filter(r => r.label.toLowerCase().includes(roleSearch.toLowerCase())).map(r => (
                                  <div 
                                    key={r.id}
                                    onClick={(e) => { e.stopPropagation(); handleSelectRole(r.label); }}
                                    className={`px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-blue-50/50 transition-all ${
                                      formData.role === r.label ? 'bg-blue-50/80 font-bold text-blue-900' : 'text-slate-700'
                                    }`}
                                  >
                                    <span className="text-sm font-medium">{r.label}</span>
                                    {formData.role === r.label && <Check className="text-blue-600" size={16} />}
                                  </div>
                                ))
                              ) : (
                                <div className="p-4 text-center space-y-3">
                                  <p className="text-xs text-slate-400 font-medium">Aucun poste préexistant ne correspond.</p>
                                  {roleSearch.trim().length > 1 && (
                                    <button
                                      type="button"
                                      disabled={isCreatingRole}
                                      onClick={(e) => { e.stopPropagation(); handleCreateNewRole(); }}
                                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                      {isCreatingRole ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                      Créer le poste "{roleSearch.trim()}" à la volée
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {roleSuccessMsg && (
                        <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                          <CheckCircle2 size={12} /> {roleSuccessMsg}
                        </p>
                      )}

                      <input type="text" name="role" required className="sr-only" value={formData.role} readOnly />
                    </div>
                  </div>

                  {/* Type de Contrat (Visual Selector) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      Type d'Engagement <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div 
                        onClick={() => {
                          setFormData(prev => ({ ...prev, contractType: 'Permanent', payType: 'Fixe' }));
                        }}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                          formData.contractType === 'Permanent' 
                            ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-100 shadow-xs' 
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">Permanent</span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            formData.contractType === 'Permanent' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                          }`}>
                            {formData.contractType === 'Permanent' && <Check size={10} className="stroke-[3]" />}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Salaire fixe mensuel</p>
                      </div>

                      <div 
                        onClick={() => {
                          setFormData(prev => ({ ...prev, contractType: 'Vacationnaire', payType: 'Horaire' }));
                        }}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                          formData.contractType === 'Vacationnaire' 
                            ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-100 shadow-xs' 
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">Vacationnaire</span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            formData.contractType === 'Vacationnaire' ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300'
                          }`}>
                            {formData.contractType === 'Vacationnaire' && <Check size={10} className="stroke-[3]" />}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Taux par heure de cours</p>
                      </div>
                    </div>
                  </div>

                  {/* Mode de Rémunération (SelectPill) */}
                  <div className="space-y-1.5">
                    <label htmlFor="payType" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      Régime de Rémunération
                    </label>
                    <SelectPill
                      options={payTypeOptions}
                      value={formData.payType}
                      onChange={(val) => setFormData(prev => ({ ...prev, payType: val }))}
                      variant="field"
                      size="md"
                      colorScheme="blue"
                      dropdownAlign="left"
                      icon={Coins}
                      className="w-full"
                    />
                  </div>

                  {/* Montant (Amount) */}
                  <div className="space-y-1.5">
                    <label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                      <DollarSign size={13} /> {formData.contractType === 'Permanent' ? 'Salaire Mensuel Fixe (HTG)' : 'Taux Horaire de Base (HTG)'} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input 
                        id="amount" 
                        name="amount" 
                        type="number" 
                        step="0.01" 
                        required 
                        placeholder="0.00" 
                        className="w-full px-4 py-3 pl-12 bg-blue-50/40 border border-blue-200 rounded-xl text-xl font-black text-blue-950 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-50 shadow-2xs transition-all font-mono" 
                        value={formData.amount} 
                        onChange={handleChange} 
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-blue-600">
                        HTG
                      </span>
                    </div>
                  </div>

                  {/* Nom de la Banque & Suggestions rapides */}
                  <div className="space-y-1.5">
                    <label htmlFor="bankName" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Banknote size={13} className="text-slate-400" /> Domiciliation Bancaire
                    </label>
                    <input 
                      id="bankName" 
                      name="bankName" 
                      type="text" 
                      placeholder="Ex : SOGEBANK, UNIBANK, BUH..." 
                      className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all shadow-2xs" 
                      value={formData.bankName} 
                      onChange={handleChange} 
                    />
                    
                    {/* Quick bank pills */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {COMMON_BANKS.slice(0, 5).map(b => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, bankName: b }))}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                            formData.bankName === b 
                              ? 'bg-blue-600 border-blue-600 text-white' 
                              : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Numéro de Compte */}
                  <div className="space-y-1.5">
                    <label htmlFor="bankAccount" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Tag size={13} className="text-slate-400" /> Numéro de Compte / IBAN
                    </label>
                    <input 
                      id="bankAccount" 
                      name="bankAccount" 
                      type="text" 
                      placeholder="000-0000-0000-00" 
                      className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all shadow-2xs font-mono" 
                      value={formData.bankAccount} 
                      onChange={handleChange} 
                    />
                  </div>

                  {formData.contractType === 'Vacationnaire' && (
                    <div className="md:col-span-2 p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-900 flex items-center gap-2.5">
                      <Sparkles className="text-amber-600 shrink-0" size={16} />
                      <p className="font-medium">
                        <strong>Rémunération horaire :</strong> Ce taux servira de base lors de l'attribution des cours et créneaux d'enseignement.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: VISION GLOBALE, RÉCAPITULATIF & VALIDATION FINALE */}
            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-7"
              >
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <h2 className="text-base md:text-lg font-black text-slate-900">
                        Synthèse & Validation Finale
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">
                        Vérifiez l'ensemble des informations avant confirmation du dossier
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold self-start sm:self-auto flex items-center gap-1.5">
                    <Check size={13} className="stroke-[3]" /> Prêt pour certification
                  </span>
                </div>

                {/* Panoramic Grid of Summary Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
                  
                  {/* Badge & Civil Profile Card */}
                  <div className="lg:col-span-2 bg-slate-50/90 rounded-3xl p-5 md:p-7 border border-slate-200/80 space-y-5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[11px] font-extrabold uppercase">
                              {formData.role || 'Poste non défini'}
                            </span>
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                              Actif
                            </span>
                          </div>
                          <h3 className="text-xl font-black text-slate-900 tracking-tight mt-1">
                            {formData.lastName.toUpperCase()} {formData.firstName}
                          </h3>
                          <p className="text-xs text-slate-500 font-semibold">
                            {formData.gender === 'M' ? 'Monsieur' : formData.gender === 'F' ? 'Madame' : 'Collaborateur'} • {detectedAge ? `${detectedAge} ans` : ''} {formData.dob ? `(Né(e) le ${new Date(formData.dob).toLocaleDateString('fr-FR')})` : ''}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95 shrink-0 cursor-pointer"
                      >
                        <Edit2 size={12} /> Modifier
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4 border-t border-slate-200/70 text-xs">
                      <div className="bg-white p-3 rounded-xl border border-slate-200/60">
                        <span className="text-slate-400 font-medium block text-[11px]">Téléphone / Contact :</span>
                        <span className="font-bold text-slate-900 font-mono text-sm">{formData.phone || 'Non renseigné'}</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200/60">
                        <span className="text-slate-400 font-medium block text-[11px]">Email Professionnel :</span>
                        <span className="font-bold text-slate-900 text-sm truncate block">{formData.email || 'Non renseigné'}</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200/60">
                        <span className="text-slate-400 font-medium block text-[11px]">Identifiant Fiscal (NIF / CIN) :</span>
                        <span className="font-bold text-slate-900 font-mono text-sm">{formData.nif_cin || 'Non renseigné'}</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200/60">
                        <span className="text-slate-400 font-medium block text-[11px]">
                          {hasMultipleCampuses ? 'Annexe d\'Affectation :' : 'Établissement :'}
                        </span>
                        <span className="font-bold text-indigo-700 text-sm flex items-center gap-1">
                          <School size={13} /> {selectedCampusName}
                        </span>
                      </div>
                      {formData.address && (
                        <div className="sm:col-span-2 bg-white p-3 rounded-xl border border-slate-200/60">
                          <span className="text-slate-400 font-medium block text-[11px]">Adresse de Résidence :</span>
                          <span className="font-bold text-slate-800 text-xs">{formData.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial & Contract Summary Card */}
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 md:p-7 flex flex-col justify-between shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />
                    
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 px-2.5 py-0.5 rounded-full bg-white/10 inline-block">
                          Engagement
                        </span>
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="text-[11px] font-bold text-blue-200 hover:text-white underline underline-offset-2 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 size={11} /> Ajuster
                        </button>
                      </div>

                      <p className="text-xs text-slate-300 font-medium">Formule & Régime</p>
                      <p className="text-lg font-black text-white mt-0.5">
                        Contrat {formData.contractType}
                      </p>
                      <p className="text-xs text-blue-200 font-semibold">
                        Régime : {formData.payType === 'Fixe' ? 'Salaire Fixe Mensuel' : 'Taux Horaire Prestation'}
                      </p>

                      <div className="mt-5 pt-4 border-t border-white/10">
                        <p className="text-xs text-blue-200 font-medium">Rémunération de Référence</p>
                        <p className="text-2xl md:text-3xl font-black font-mono text-emerald-400 mt-0.5 tracking-tight">
                          {parseFloat(formData.amount || '0').toLocaleString()} <span className="text-sm text-slate-300 font-sans font-normal">HTG</span>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formData.contractType === 'Permanent' ? 'Salaire mensuel net garanti' : 'Montant par heure de cours effectuée'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/10 text-xs text-slate-300 space-y-1.5">
                      {formData.bankName ? (
                        <>
                          <p className="flex items-center gap-1.5">
                            <Banknote size={14} className="text-blue-400 shrink-0" />
                            <span>Banque : <strong className="text-white font-bold">{formData.bankName}</strong></span>
                          </p>
                          {formData.bankAccount ? (
                            <p className="font-mono text-[11px] text-slate-300 ml-5">
                              N° Compte : <strong className="text-white">{formData.bankAccount}</strong>
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 ml-5 italic">
                              Compte non spécifié
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300 flex items-center gap-2">
                          <Banknote size={14} className="text-blue-300 shrink-0" />
                          <span>Versement : <strong className="text-white">Paiement Direct (Chèque / Espèces)</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Traçabilité & Validation RH - Format Simplifié & Précis */}
                <div className="p-4 sm:p-4.5 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-white">
                        Certification & Traçabilité RH
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">
                        Création du matricule officiel, activation de la paie et horodatage sécurisé.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-300 shrink-0">
                    <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5 text-emerald-300 text-[11px]">
                      <Check size={12} className="text-emerald-400 stroke-[3]" /> Registre RH
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5 text-blue-300 text-[11px]">
                      <Check size={12} className="text-blue-400 stroke-[3]" /> Paie Active
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5 text-indigo-300 text-[11px]">
                      <Check size={12} className="text-indigo-400 stroke-[3]" /> Audit Sécurisé
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Bottom Navigation & Controls */}
        <div className="px-6 md:px-10 py-5 bg-slate-50/90 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-4">
          <button 
            type="button" 
            disabled={step === 1 || isSubmitting} 
            onClick={() => {
              setApiError(null);
              setStep(prev => Math.max(1, prev - 1));
            }} 
            className={`w-full sm:w-auto px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center gap-2 rounded-xl hover:bg-slate-200/60 active:scale-98 ${
              step === 1 ? 'opacity-0 pointer-events-none' : ''
            }`}
          >
            <ArrowLeft size={16} /> Précédent
          </button>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {step === 1 && (
              <button 
                type="button" 
                onClick={handleNext}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <span>Continuer : Contrat & Paie</span> <ArrowRight size={15} />
              </button>
            )}

            {step === 2 && (
              <button 
                type="button" 
                onClick={handleNext}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <span>Continuer : Synthèse & Validation</span> <ArrowRight size={15} />
              </button>
            )}

            {step === 3 && (
              <button 
                type="submit"
                disabled={isSubmitting} 
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>{isEdit ? 'Mettre à jour le dossier' : 'Valider le recrutement'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default StaffForm;
