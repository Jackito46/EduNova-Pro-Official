import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Save, User, Briefcase, DollarSign, ArrowRight, ArrowLeft,
  ChevronDown, Contact, Loader2, AlertCircle, CheckCircle2, 
  ShieldCheck, MapPin, Mail, Phone, Banknote, Edit2, Clock, 
  Sparkles, FileText, Calendar, Tag, School, Search, Plus, X, Check,
  Building2, BadgeCheck, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import { UserProfile, StaffRole, SchoolType } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { staffSchema } from '../utils/validation';
import { motion, AnimatePresence } from 'framer-motion';
import { DatePickerPill } from './DatePickerPill';
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

  const genderOptions: SelectOption[] = useMemo(() => [
    { value: 'M', label: 'Masculin', badge: 'M' },
    { value: 'F', label: 'Féminin', badge: 'F' },
    { value: 'Autre', label: 'Autre' }
  ], []);

  const payTypeOptions: SelectOption[] = useMemo(() => [
    { value: 'Fixe', label: 'Salaire Fixe Mensuel', badge: 'Fixe' },
    { value: 'Horaire', label: 'Taux Horaire / Prestation', badge: 'Horaire' }
  ], []);

  const campusOptions: SelectOption[] = useMemo(() => [
    { value: '', label: 'Administration Centrale (Toutes les Annexes)', badge: 'Siège' },
    ...(campuses || []).map(c => ({
      value: c.id,
      label: c.name,
      badge: 'Annexe'
    }))
  ], [campuses]);

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
    { id: 1, title: 'Identité', subtitle: 'Profil civil', icon: User },
    { id: 2, title: 'Contrat', subtitle: 'Poste & Paie', icon: Briefcase },
    { id: 3, title: 'Validation', subtitle: 'Certification', icon: ShieldCheck }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-5 animate-in fade-in duration-300 pb-12">
      
      {/* Top Banner & Institutional Header Fluide & Moderne */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-3.5 sm:p-4 md:p-5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 relative z-10">
          
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Retour"
              className="p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200/80 shadow-2xs transition-all active:scale-95 shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
              isEdit ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
            }`}>
              {isEdit ? <Edit2 size={18} /> : <User size={20} />}
            </div>
            
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100/80 truncate max-w-[170px]">
                  {school?.name || 'Ressources Humaines'}
                </span>
                {hasMultipleCampuses && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center gap-1">
                    <Building2 size={10} /> {selectedCampusName}
                  </span>
                )}
              </div>
              <h1 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 tracking-tight leading-snug truncate">
                {isEdit ? 'Édition Dossier Collaborateur' : 'Recrutement RH'}
              </h1>
              <p className="text-slate-500 font-medium text-[11px] sm:text-xs truncate">
                {isEdit 
                  ? `Mise à jour des clauses administratives • ID #${id?.slice(0, 8)}` 
                  : 'Création du profil collaborateur, contrat & modalités de paie'
                }
              </p>
            </div>
          </div>

          {/* Stepper horizontal compact & responsive (Style Pillule) */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80 self-stretch md:self-auto justify-between sm:justify-end shrink-0">
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
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    isCurrent 
                      ? 'bg-white text-blue-700 shadow-xs font-bold border border-blue-200/80' 
                      : isDone 
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70 cursor-pointer font-semibold' 
                        : 'text-slate-400 opacity-60 cursor-not-allowed font-medium'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold transition-all ${
                    isCurrent 
                      ? 'bg-blue-600 text-white shadow-2xs' 
                      : isDone 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isDone ? <Check size={11} className="stroke-[3]" /> : st.id}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs leading-none font-bold whitespace-nowrap">{st.title}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic step progress line */}
        <div className="w-full bg-slate-100 h-1 rounded-full mt-3 overflow-hidden">
          <motion.div 
            className="h-full bg-blue-600"
            initial={{ width: '33%' }}
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>
      </div>

      {/* Error notification banner */}
      {apiError && (
        <motion.div 
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border border-rose-200 p-3 sm:p-3.5 rounded-xl flex items-start gap-2.5 text-rose-700 font-medium text-xs sm:text-sm shadow-2xs"
        >
          <AlertCircle size={17} className="shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-800">Information requise ou non conforme</p>
            <p className="text-xs text-rose-600 mt-0.5">{apiError}</p>
          </div>
          <button 
            type="button" 
            onClick={() => setApiError(null)} 
            className="p-1 hover:bg-rose-100 rounded-lg text-rose-500"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}

      {/* Main Form Container - Compact & Ergonomique */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        <div className="p-4 sm:p-5 md:p-6">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: IDENTITÉ & COORDONNÉES */}
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 sm:space-y-5"
              >
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Contact size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">1. Identité Civile & Coordonnées</h2>
                      <p className="text-[11px] text-slate-500">Renseignez les données administratives certifiées du collaborateur</p>
                    </div>
                  </div>
                  
                  {/* Dynamic Avatar Preview Compact */}
                  <div className="flex items-center gap-2.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/70 self-start sm:self-auto">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shadow-2xs">
                      {initials}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-800 leading-tight">
                        {formData.firstName || formData.lastName ? `${formData.firstName} ${formData.lastName}` : 'Nouveau Collaborateur'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">Aperçu badge RH</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                  
                  {/* Nom de famille */}
                  <div className="space-y-1">
                    <label htmlFor="lastName" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      Nom de Famille <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      id="lastName" 
                      required 
                      name="lastName" 
                      type="text" 
                      placeholder="Ex : MARCELIN" 
                      className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all shadow-2xs" 
                      value={formData.lastName} 
                      onChange={handleChange} 
                    />
                  </div>

                  {/* Prénoms */}
                  <div className="space-y-1">
                    <label htmlFor="firstName" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      Prénom(s) <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      id="firstName" 
                      required 
                      name="firstName" 
                      type="text" 
                      placeholder="Ex : Jean-Baptiste" 
                      className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all shadow-2xs" 
                      value={formData.firstName} 
                      onChange={handleChange} 
                    />
                  </div>

                  {/* Civilité / Sexe (SelectPill) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      Sexe / Civilité <span className="text-rose-500">*</span>
                    </label>
                    <SelectPill
                      value={formData.gender}
                      onChange={(val) => setFormData(prev => ({ ...prev, gender: val }))}
                      options={genderOptions}
                      variant="field"
                      size="sm"
                      colorScheme="blue"
                      className="w-full"
                    />
                  </div>

                  {/* Date de Naissance & Âge dynamique (DatePickerPill) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" /> Date de Naissance <span className="text-rose-500">*</span>
                      </label>
                      {detectedAge !== null && (
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                          detectedAge >= 18 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          detectedAge >= 16 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {detectedAge} ans {detectedAge < 16 ? '(Non éligible)' : '• Éligible'}
                        </span>
                      )}
                    </div>
                    <DatePickerPill
                      selectedDate={formData.dob}
                      onSelectDate={(date) => setFormData(prev => ({ ...prev, dob: date }))}
                      variant="field"
                      size="sm"
                      colorScheme="blue"
                      showShortcuts={false}
                      showQuickArrows={true}
                      placeholder="Sélectionner la date..."
                      className="w-full"
                    />
                  </div>

                  {/* NIF / CIN */}
                  <div className="space-y-1">
                    <label htmlFor="nif_cin" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Tag size={12} className="text-slate-400" /> NIF / CIN (Identifiant National)
                    </label>
                    <input 
                      id="nif_cin" 
                      name="nif_cin" 
                      type="text" 
                      className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all shadow-2xs font-mono" 
                      value={formData.nif_cin} 
                      onChange={handleChange} 
                      placeholder="000-000-000-0" 
                    />
                  </div>

                  {/* Téléphone */}
                  <div className="space-y-1">
                    <label htmlFor="phone" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Phone size={12} className="text-slate-400" /> Téléphone Principal <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      id="phone" 
                      required 
                      name="phone" 
                      type="tel" 
                      placeholder="3700-0000" 
                      className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all shadow-2xs font-mono" 
                      value={formData.phone} 
                      onChange={handleChange} 
                    />
                  </div>

                  {/* Email Pro */}
                  <div className="space-y-1 md:col-span-2">
                    <label htmlFor="email" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Mail size={12} className="text-slate-400" /> Email Professionnel
                    </label>
                    <input 
                      id="email" 
                      name="email" 
                      type="email" 
                      placeholder="nom.prenom@edunova.pro" 
                      className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all shadow-2xs" 
                      value={formData.email} 
                      onChange={handleChange} 
                    />
                  </div>

                  {/* Adresse */}
                  <div className="md:col-span-2 space-y-1">
                    <label htmlFor="address" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400" /> Adresse de Résidence
                    </label>
                    <textarea 
                      id="address" 
                      name="address" 
                      rows={2} 
                      placeholder="Numéro, Rue, Commune, Département..."
                      className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all resize-none shadow-2xs" 
                      value={formData.address} 
                      onChange={handleChange} 
                    />
                  </div>
                </div>

                {/* Multi-Tenant / Affectation Annexe Section (SelectPill) */}
                {school?.has_multi_campus && campuses && campuses.length > 1 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2 bg-indigo-50/30 p-3.5 rounded-xl border border-indigo-100/70">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="text-indigo-600" size={15} />
                        <h3 className="text-xs font-bold text-indigo-950">Affectation Multi-Campus / Annexe</h3>
                      </div>
                      {user.campus_id && (
                        <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          <AlertTriangle size={10} /> Verrouillé par votre rôle
                        </span>
                      )}
                    </div>
                    
                    <SelectPill
                      value={formData.campus_id}
                      onChange={(val) => setFormData(prev => ({ ...prev, campus_id: val }))}
                      options={campusOptions}
                      disabled={!!user.campus_id}
                      variant="field"
                      size="sm"
                      colorScheme="indigo"
                      icon={Building2}
                      className="w-full"
                    />
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: CONTRAT & RÉMUNÉRATION */}
            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 sm:space-y-5"
              >
                {/* Section Header */}
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Briefcase size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">2. Termes de l'Engagement & Rémunération</h2>
                    <p className="text-[11px] text-slate-500">Configurez le poste, le régime contractuel et les modalités bancaires</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                  
                  {/* Poste de Travail (Pillule Searchable Role Selector) */}
                  <div className="space-y-1 relative" ref={dropdownRef}>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Sparkles size={12} className="text-blue-500" /> Poste & Fonction <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-blue-600 font-semibold lowercase">Recherche instantanée</span>
                    </label>
                    
                    <div className="relative">
                      <div 
                        onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                        className={`w-full px-3 py-2 min-h-[38px] bg-slate-50 hover:bg-white border ${
                          isRoleDropdownOpen ? 'border-blue-500 ring-2 ring-blue-50 bg-white' : 'border-slate-200/90'
                        } rounded-xl text-xs sm:text-sm font-semibold text-slate-800 flex items-center justify-between cursor-pointer transition-all select-none shadow-2xs`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Briefcase size={15} className="text-blue-600 shrink-0" />
                          {formData.role ? (
                            <span className="text-blue-900 font-bold truncate">{formData.role}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">Sélectionner ou créer un poste...</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {formData.role && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData(prev => ({ ...prev, role: '' }));
                              }}
                              className="p-0.5 hover:bg-slate-200 rounded-full transition-all text-slate-400 hover:text-slate-600"
                            >
                              <X size={12} />
                            </button>
                          )}
                          <ChevronDown className={`text-slate-400 transition-transform duration-200 ${isRoleDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} size={15} />
                        </div>
                      </div>

                      {/* Dropdown Container */}
                      <AnimatePresence>
                        {isRoleDropdownOpen && (
                          <motion.div 
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden flex flex-col"
                            style={{ maxHeight: '300px' }}
                          >
                            {/* Search bar inside dropdown */}
                            <div className="p-2 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
                              <Search className="text-slate-400 shrink-0" size={14} />
                              <input 
                                type="text"
                                placeholder="Rechercher ou saisir..."
                                className="w-full bg-transparent border-none outline-none text-xs text-slate-800 placeholder-slate-400 font-medium"
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
                                  <X size={11} />
                                </button>
                              )}
                            </div>

                            {/* Frequently Used Roles Shortcuts */}
                            {roles.length > 0 && (
                              <div className="p-2 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-1 items-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">Fréquents :</span>
                                {roles.slice(0, 4).map(r => (
                                  <button
                                    key={r.id}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleSelectRole(r.label); }}
                                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-all ${
                                      formData.role === r.label 
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xs' 
                                        : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600'
                                    }`}
                                  >
                                    {r.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Scrollable list */}
                            <div className="overflow-y-auto max-h-[180px] divide-y divide-slate-50">
                              {roles.filter(r => r.label.toLowerCase().includes(roleSearch.toLowerCase())).length > 0 ? (
                                roles.filter(r => r.label.toLowerCase().includes(roleSearch.toLowerCase())).map(r => (
                                  <div 
                                    key={r.id}
                                    onClick={(e) => { e.stopPropagation(); handleSelectRole(r.label); }}
                                    className={`px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-blue-50/50 transition-all ${
                                      formData.role === r.label ? 'bg-blue-50/80 font-bold text-blue-900' : 'text-slate-700'
                                    }`}
                                  >
                                    <span className="text-xs font-medium">{r.label}</span>
                                    {formData.role === r.label && <Check className="text-blue-600" size={14} />}
                                  </div>
                                ))
                              ) : (
                                <div className="p-3 text-center space-y-2">
                                  <p className="text-[11px] text-slate-400 font-medium">Aucun poste préexistant ne correspond.</p>
                                  {roleSearch.trim().length > 1 && (
                                    <button
                                      type="button"
                                      disabled={isCreatingRole}
                                      onClick={(e) => { e.stopPropagation(); handleCreateNewRole(); }}
                                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
                                    >
                                      {isCreatingRole ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                      Créer le poste "{roleSearch.trim()}"
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {roleSuccessMsg && (
                        <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                          <CheckCircle2 size={11} /> {roleSuccessMsg}
                        </p>
                      )}

                      <input type="text" name="role" required className="sr-only" value={formData.role} readOnly />
                    </div>
                  </div>

                  {/* Type de Contrat (Pillule Visual Selector) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      Type de Contrat & Engagement <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div 
                        onClick={() => {
                          setFormData(prev => ({ ...prev, contractType: 'Permanent', payType: 'Fixe' }));
                        }}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          formData.contractType === 'Permanent' 
                            ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-100 shadow-2xs' 
                            : 'bg-slate-50/70 border-slate-200/90 hover:bg-slate-100/70'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">Permanent</p>
                          <p className="text-[10px] text-slate-400">Salaire fixe mensuel</p>
                        </div>
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          formData.contractType === 'Permanent' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                        }`}>
                          {formData.contractType === 'Permanent' && <Check size={9} className="stroke-[3]" />}
                        </span>
                      </div>

                      <div 
                        onClick={() => {
                          setFormData(prev => ({ ...prev, contractType: 'Vacationnaire', payType: 'Horaire' }));
                        }}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          formData.contractType === 'Vacationnaire' 
                            ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-100 shadow-2xs' 
                            : 'bg-slate-50/70 border-slate-200/90 hover:bg-slate-100/70'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">Vacationnaire</p>
                          <p className="text-[10px] text-slate-400">Taux par heure prestée</p>
                        </div>
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          formData.contractType === 'Vacationnaire' ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300'
                        }`}>
                          {formData.contractType === 'Vacationnaire' && <Check size={9} className="stroke-[3]" />}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mode de Rémunération (SelectPill) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      Régime de Rémunération
                    </label>
                    <SelectPill
                      value={formData.payType}
                      onChange={(val) => setFormData(prev => ({ ...prev, payType: val }))}
                      options={payTypeOptions}
                      variant="field"
                      size="sm"
                      colorScheme="blue"
                      className="w-full"
                    />
                  </div>

                  {/* Montant (Amount) */}
                  <div className="space-y-1">
                    <label htmlFor="amount" className="text-[11px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1">
                      <DollarSign size={12} /> {formData.contractType === 'Permanent' ? 'Salaire Mensuel Fixe (HTG)' : 'Taux Horaire de Base (HTG)'} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input 
                        id="amount" 
                        name="amount" 
                        type="number" 
                        step="0.01" 
                        required 
                        placeholder="0.00" 
                        className="w-full px-3 py-2 pl-11 bg-blue-50/30 border border-blue-200 rounded-xl text-sm font-bold text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-50 shadow-2xs transition-all font-mono" 
                        value={formData.amount} 
                        onChange={handleChange} 
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-blue-600">
                        HTG
                      </span>
                    </div>
                  </div>

                  {/* Nom de la Banque & Suggestions rapides */}
                  <div className="space-y-1">
                    <label htmlFor="bankName" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Banknote size={12} className="text-slate-400" /> Domiciliation Bancaire
                    </label>
                    <input 
                      id="bankName" 
                      name="bankName" 
                      type="text" 
                      placeholder="Ex : SOGEBANK, UNIBANK, BUH..." 
                      className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all shadow-2xs" 
                      value={formData.bankName} 
                      onChange={handleChange} 
                    />
                    
                    {/* Quick bank pills */}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {COMMON_BANKS.slice(0, 5).map(b => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, bankName: b }))}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border transition-all ${
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
                  <div className="space-y-1">
                    <label htmlFor="bankAccount" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Tag size={12} className="text-slate-400" /> Numéro de Compte / IBAN
                    </label>
                    <input 
                      id="bankAccount" 
                      name="bankAccount" 
                      type="text" 
                      placeholder="000-0000-0000-00" 
                      className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all shadow-2xs font-mono" 
                      value={formData.bankAccount} 
                      onChange={handleChange} 
                    />
                  </div>

                  {formData.contractType === 'Vacationnaire' && (
                    <div className="md:col-span-2 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                      <Sparkles className="text-amber-600 shrink-0 mt-0.5" size={14} />
                      <p>
                        <strong>Note Pédagogique :</strong> Le taux horaire de base défini servira de référence. L'assignation des cours et signatures d'heures pourra être affinée depuis le registre pédagogique.
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 sm:space-y-5"
              >
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                        3. Vision Globale du Dossier & Validation RH
                      </h2>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Examinez la synthèse intégrale du profil avant l'enregistrement définitif dans le cloud
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold self-start sm:self-auto flex items-center gap-1">
                    <Check size={11} className="stroke-[3]" /> Prêt pour certification
                  </span>
                </div>

                {/* Grid of Summary Cards Compact */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  
                  {/* Badge & Civil Profile Card */}
                  <div className="lg:col-span-2 bg-slate-50/90 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3.5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-base flex items-center justify-center shadow-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px] font-extrabold uppercase">
                              {formData.role || 'Poste non défini'}
                            </span>
                            <span className="px-2 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                              Actif
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5">
                            {formData.lastName.toUpperCase()} {formData.firstName}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-semibold">
                            {formData.gender === 'M' ? 'Monsieur' : formData.gender === 'F' ? 'Madame' : 'Collaborateur'} • {detectedAge ? `${detectedAge} ans` : ''} {formData.dob ? `(Né(e) le ${new Date(formData.dob).toLocaleDateString('fr-FR')})` : ''}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold shadow-2xs transition-all flex items-center gap-1 active:scale-95 shrink-0"
                      >
                        <Edit2 size={11} /> Modifier
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-slate-200/70 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                        <span className="text-slate-400 font-medium block text-[10px]">Téléphone Principal :</span>
                        <span className="font-bold text-slate-900 font-mono text-xs">{formData.phone || 'Non renseigné'}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                        <span className="text-slate-400 font-medium block text-[10px]">Email Professionnel :</span>
                        <span className="font-bold text-slate-900 text-xs truncate block">{formData.email || 'Non renseigné'}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                        <span className="text-slate-400 font-medium block text-[10px]">Identifiant Fiscal (NIF / CIN) :</span>
                        <span className="font-bold text-slate-900 font-mono text-xs">{formData.nif_cin || 'Non renseigné'}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                        <span className="text-slate-400 font-medium block text-[10px]">
                          {hasMultipleCampuses ? 'Annexe d\'Affectation :' : 'Établissement :'}
                        </span>
                        <span className="font-bold text-indigo-700 text-xs flex items-center gap-1">
                          <Building2 size={11} /> {selectedCampusName}
                        </span>
                      </div>
                      {formData.address && (
                        <div className="sm:col-span-2 bg-white p-2.5 rounded-lg border border-slate-200/60">
                          <span className="text-slate-400 font-medium block text-[10px]">Adresse de Résidence :</span>
                          <span className="font-bold text-slate-800 text-xs">{formData.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial & Contract Summary Card */}
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-md relative overflow-hidden">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-300 px-2 py-0.5 rounded-full bg-white/10 inline-block">
                          Contrat
                        </span>
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="text-[10px] font-bold text-blue-200 hover:text-white underline underline-offset-2 transition-colors flex items-center gap-1"
                        >
                          <Edit2 size={10} /> Ajuster
                        </button>
                      </div>

                      <p className="text-sm sm:text-base font-black text-white">
                        Contrat {formData.contractType}
                      </p>
                      <p className="text-[11px] text-blue-200 font-medium">
                        Régime : {formData.payType === 'Fixe' ? 'Salaire Fixe Mensuel' : 'Taux Horaire Prestation'}
                      </p>

                      <div className="mt-3.5 pt-3 border-t border-white/10">
                        <p className="text-[10px] text-blue-200 font-medium">Rémunération de Référence</p>
                        <p className="text-2xl font-black font-mono text-emerald-400 mt-0.5 tracking-tight">
                          {parseFloat(formData.amount || '0').toLocaleString()} <span className="text-xs text-slate-300 font-sans font-normal">HTG</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formData.contractType === 'Permanent' ? 'Salaire mensuel net' : 'Montant par heure prestée'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-white/10 text-[11px] text-slate-300 space-y-1">
                      {formData.bankName ? (
                        <>
                          <p className="flex items-center gap-1">
                            <Banknote size={12} className="text-blue-400 shrink-0" />
                            <span>Banque : <strong className="text-white font-bold">{formData.bankName}</strong></span>
                          </p>
                          {formData.bankAccount && (
                            <p className="font-mono text-[10px] text-slate-300 ml-4">
                              Compte : {formData.bankAccount}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="flex items-center gap-1 text-[10px]">
                          <Banknote size={12} className="text-blue-300 shrink-0" />
                          <span>Paiement Direct (Chèque / Espèces)</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Traçabilité & Validation RH Compact */}
                <div className="p-3 sm:p-3.5 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white tracking-tight">
                        Certification & Traçabilité RH
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Initialisation du matricule officiel, activation de la paie et journal d'audit.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-300 shrink-0">
                    <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1 text-emerald-300">
                      <Check size={11} className="text-emerald-400 stroke-[3]" /> Registre RH
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1 text-blue-300">
                      <Check size={11} className="text-blue-400 stroke-[3]" /> Paie
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1 text-indigo-300">
                      <Check size={11} className="text-indigo-400 stroke-[3]" /> Horodaté
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Bottom Navigation & Controls Compact & Fluide */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-3">
          <button 
            type="button" 
            disabled={step === 1 || isSubmitting} 
            onClick={() => {
              setApiError(null);
              setStep(prev => Math.max(1, prev - 1));
            }} 
            className={`w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5 rounded-xl hover:bg-slate-200/60 active:scale-98 ${
              step === 1 ? 'opacity-0 pointer-events-none' : ''
            }`}
          >
            <ArrowLeft size={14} /> Précédent
          </button>
          
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {step === 1 && (
              <button 
                type="button" 
                onClick={handleNext}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <span>Étape 2 : Contrat & Rémunération</span> <ArrowRight size={14} />
              </button>
            )}

            {step === 2 && (
              <button 
                type="button" 
                onClick={handleNext}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <span>Étape 3 : Récapitulatif & Validation</span> <ArrowRight size={14} />
              </button>
            )}

            {step === 3 && (
              <button 
                type="submit"
                disabled={isSubmitting} 
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-xs flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Synchronisation Cloud...</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>{isEdit ? 'Valider les Modifications' : 'Confirmer le Recrutement'}</span>
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
