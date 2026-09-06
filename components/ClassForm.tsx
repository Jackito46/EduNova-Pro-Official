import React, { useState, useEffect } from 'react';
import { 
  Save, 
  GraduationCap, 
  MapPin, 
  UserCheck, 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  Building2, 
  BookOpen, 
  Sparkles, 
  School, 
  Check, 
  Compass, 
  Clock, 
  Calendar,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';
import { SchoolLevel, UserProfile, SchoolType } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { classSchema } from '../utils/validation';
import { getCollegeInnovationsDefaultCoefficient } from './ClassManagement';
import { SelectPill, SelectOption } from './SelectPill';

interface UniversityDiscipline {
  name: string;
  category: 'Technologies' | 'Gestion & Économie' | 'Santé & Sciences' | 'Droit & Humaines' | 'Ingénierie';
  duration: number;
  level: SchoolLevel;
}

interface ProfessionalDiscipline {
  name: string;
  category: 'Administration & Commerce' | 'Technique & Industrie' | 'Services & Métiers';
  duration: number;
  level: SchoolLevel;
}

const standardUniversityDisciplines: UniversityDiscipline[] = [
  // Technologies & Numérique
  { name: 'Sciences Informatiques', category: 'Technologies', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Génie Software / Génie Logiciel', category: 'Technologies', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Réseaux & Télécommunications', category: 'Technologies', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Intelligence Artificielle & Data Science', category: 'Technologies', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Cybersécurité & Cloud Computing', category: 'Technologies', duration: 4, level: SchoolLevel.LICENCE },
  // Gestion & Économie
  { name: 'Sciences Administratives & Gestion', category: 'Gestion & Économie', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Sciences Comptables & Audit', category: 'Gestion & Économie', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Gestion des Ressources Humaines', category: 'Gestion & Économie', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Marketing & Management Digital', category: 'Gestion & Économie', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Sciences Économiques & Finance', category: 'Gestion & Économie', duration: 4, level: SchoolLevel.LICENCE },
  // Droit & Humaines
  { name: 'Droit & Sciences Juridiques', category: 'Droit & Humaines', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Relations Internationales & Diplomatie', category: 'Droit & Humaines', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Sciences de l\'Éducation', category: 'Droit & Humaines', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Communication Sociale & Journalisme', category: 'Droit & Humaines', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Psychologie Clinique & Sociale', category: 'Droit & Humaines', duration: 4, level: SchoolLevel.LICENCE },
  // Santé & Sciences
  { name: 'Sciences Infirmières', category: 'Santé & Sciences', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Médecine Générale', category: 'Santé & Sciences', duration: 6, level: SchoolLevel.LICENCE },
  { name: 'Médecine Dentaire', category: 'Santé & Sciences', duration: 5, level: SchoolLevel.LICENCE },
  { name: 'Pharmacologie & Toxicologie', category: 'Santé & Sciences', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Technologie Médicale & Laboratoire', category: 'Santé & Sciences', duration: 4, level: SchoolLevel.LICENCE },
  { name: 'Sciences de la Nutrition & Diététique', category: 'Santé & Sciences', duration: 4, level: SchoolLevel.LICENCE },
  // Ingénierie & Construction
  { name: 'Génie Civil & Infrastructures', category: 'Ingénierie', duration: 5, level: SchoolLevel.LICENCE },
  { name: 'Génie Électromécanique', category: 'Ingénierie', duration: 5, level: SchoolLevel.LICENCE },
];

const standardProfessionalDisciplines: ProfessionalDiscipline[] = [
  // Administration & Commerce
  { name: 'Comptabilité Informatisée & Fiscalité', category: 'Administration & Commerce', duration: 2, level: SchoolLevel.DIPLOME },
  { name: 'Technique Douanière & Transit', category: 'Administration & Commerce', duration: 2, level: SchoolLevel.DIPLOME },
  { name: 'Secrétariat Médical & Gestion', category: 'Administration & Commerce', duration: 2, level: SchoolLevel.DIPLOME },
  { name: 'Marketing & Vente Professionnelle', category: 'Administration & Commerce', duration: 2, level: SchoolLevel.DIPLOME },
  { name: 'Informatique de Bureau & Administration', category: 'Administration & Commerce', duration: 1, level: SchoolLevel.CERTIFICAT },
  { name: 'Assistance Administrative & Bilingue', category: 'Administration & Commerce', duration: 1, level: SchoolLevel.CERTIFICAT },
  // Technique & Industrie
  { name: 'Maintenance Informatique & Réseaux', category: 'Technique & Industrie', duration: 2, level: SchoolLevel.DIPLOME },
  { name: 'Graphisme & Design Multimédia', category: 'Technique & Industrie', duration: 1, level: SchoolLevel.CERTIFICAT },
  { name: 'Développement Web & Applications', category: 'Technique & Industrie', duration: 2, level: SchoolLevel.DIPLOME },
  { name: 'Électricité du Bâtiment & Solaire', category: 'Technique & Industrie', duration: 1, level: SchoolLevel.CERTIFICAT },
  { name: 'Plomberie & Sanitaire Moderne', category: 'Technique & Industrie', duration: 1, level: SchoolLevel.CERTIFICAT },
  { name: 'Climatisation, Froid & Réfrigération', category: 'Technique & Industrie', duration: 2, level: SchoolLevel.DIPLOME },
  { name: 'Mécanique Automobile & Diagnostic', category: 'Technique & Industrie', duration: 2, level: SchoolLevel.DIPLOME },
  { name: 'Soudure & Fabrication Industrielle', category: 'Technique & Industrie', duration: 1, level: SchoolLevel.CERTIFICAT },
  // Services & Métiers
  { name: 'Cuisine, Restauration & Traiteur', category: 'Services & Métiers', duration: 2, level: SchoolLevel.DIPLOME },
  { name: 'Pâtisserie & Boulangerie Artisanale', category: 'Services & Métiers', duration: 1, level: SchoolLevel.CERTIFICAT },
  { name: 'Gestion Hôtelière & Touristique', category: 'Services & Métiers', duration: 2, level: SchoolLevel.DIPLOME },
  { name: 'Couture, Stylisme & Modélisme', category: 'Services & Métiers', duration: 2, level: SchoolLevel.DIPLOME },
  { name: 'Esthétique, Cosmétique & Maquillage', category: 'Services & Métiers', duration: 1, level: SchoolLevel.CERTIFICAT },
  { name: 'Coiffure Professionnelle & Visagisme', category: 'Services & Métiers', duration: 1, level: SchoolLevel.CERTIFICAT },
  { name: 'Secourisme, Hygiène & Soins d\'Urgence', category: 'Services & Métiers', duration: 1, level: SchoolLevel.CERTIFICAT },
];

const classicPresetsByCycle = {
  [SchoolLevel.MATERNELLE]: [
    { label: "Petite Section", full: "Petite Section", level: SchoolLevel.MATERNELLE },
    { label: "Moyenne Section", full: "Moyenne Section", level: SchoolLevel.MATERNELLE },
    { label: "Grande Section", full: "Grande Section", level: SchoolLevel.MATERNELLE },
    { label: "Jardin d'Enfants", full: "Jardin d'Enfants", level: SchoolLevel.MATERNELLE },
  ],
  [SchoolLevel.FONDAMENTALE]: [
    { label: "1ère AF", full: "1ère Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "2e AF", full: "2ème Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "3e AF", full: "3ème Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "4e AF", full: "4ème Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "5e AF", full: "5ème Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "6e AF", full: "6ème Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "7e AF", full: "7ème Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "8e AF", full: "8ème Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "9e AF", full: "9ème Année AF", level: SchoolLevel.FONDAMENTALE },
  ],
  [SchoolLevel.SECONDAIRE]: [
    { label: "NS1 (Seconde)", full: "Nouveau Secondaire I (NS1)", level: SchoolLevel.SECONDAIRE },
    { label: "NS2 (Première)", full: "Nouveau Secondaire II (NS2)", level: SchoolLevel.SECONDAIRE },
    { label: "NS3 (Rhéto)", full: "Nouveau Secondaire III (NS3)", level: SchoolLevel.SECONDAIRE },
    { label: "NS4 (Philo)", full: "Nouveau Secondaire IV (NS4)", level: SchoolLevel.SECONDAIRE },
  ]
};

const sectionLetters = ["A", "B", "C", "D", "1", "2"];

const ClassForm: React.FC<{ user: UserProfile }> = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const typeParam = searchParams.get('type');
  
  const { terminology, school, currentCampusId, campuses } = useSchool();
  const isEdit = !!id;

  const classLevelDefault = typeParam === 'Certificat' || typeParam === 'Professionnelle' ? SchoolLevel.CERTIFICAT :
                            typeParam === 'Universitaire' ? SchoolLevel.LICENCE :
                            typeParam === 'Maternelle' ? SchoolLevel.MATERNELLE :
                            typeParam === 'Secondaire' ? SchoolLevel.SECONDAIRE :
                            SchoolLevel.FONDAMENTALE;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isNameDuplicate, setIsNameDuplicate] = useState(false);

  // Détection automatique du type d'établissement configuré dans le système
  const schoolType = (school?.school_type as SchoolType) || SchoolType.CLASSIC;
  const isClassicSchool = schoolType === SchoolType.CLASSIC;
  const isUniversitySchool = schoolType === SchoolType.UNIVERSITY;
  const isProfessionalSchool = schoolType === SchoolType.PROFESSIONAL;

  const [activeCategory, setActiveCategory] = useState<SchoolType>(() => {
    if (isEdit) return SchoolType.CLASSIC;
    // Une école Classique n'a pas d'onglets Universitaire / Professionnelle
    if (schoolType === SchoolType.CLASSIC) {
      return SchoolType.CLASSIC;
    }
    // Une école Universitaire peut avoir Universitaire et Professionnelle
    if (schoolType === SchoolType.UNIVERSITY) {
      if (typeParam === 'Professionnelle' || typeParam === 'Certificat') {
        return SchoolType.PROFESSIONAL;
      }
      return SchoolType.UNIVERSITY;
    }
    // Une école Professionnelle
    if (schoolType === SchoolType.PROFESSIONAL) {
      if (typeParam === 'Universitaire') return SchoolType.UNIVERSITY;
      return SchoolType.PROFESSIONAL;
    }
    if (typeParam === 'Universitaire') return SchoolType.UNIVERSITY;
    if (typeParam === 'Professionnelle' || typeParam === 'Certificat') return SchoolType.PROFESSIONAL;
    if (['Maternelle', 'Fondamentale', 'Secondaire'].includes(typeParam || '')) return SchoolType.CLASSIC;
    return schoolType;
  });

  // Synchronisation automatique si le type d'école est chargé ultérieurement
  useEffect(() => {
    if (isEdit) return;
    if (isClassicSchool && activeCategory !== SchoolType.CLASSIC) {
      setActiveCategory(SchoolType.CLASSIC);
      setUseStandardSelector(false);
    } else if (isUniversitySchool && activeCategory === SchoolType.CLASSIC) {
      setActiveCategory(SchoolType.UNIVERSITY);
      setUseStandardSelector(true);
    } else if (isProfessionalSchool && activeCategory === SchoolType.CLASSIC) {
      setActiveCategory(SchoolType.PROFESSIONAL);
      setUseStandardSelector(true);
    }
  }, [schoolType, isClassicSchool, isUniversitySchool, isProfessionalSchool, isEdit]);

  // Liste des enseignants pour la sélection en pilule
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string; email?: string }>>([]);
  const [isManualTeacherMode, setIsManualTeacherMode] = useState(false);

  useEffect(() => {
    if (!user.school_id) return;
    const fetchTeachers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, role')
          .eq('school_id', user.school_id)
          .in('role', ['TEACHER', 'DIRECTOR', 'SCHOOL_ADMIN', 'SUPERVISOR']);

        if (!error && data && data.length > 0) {
          const list = data.map(p => ({
            id: p.id,
            name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Enseignant',
            email: p.email
          }));
          setTeachers(list);
        }
      } catch (err) {
        console.warn('Erreur chargement enseignants:', err);
      }
    };
    fetchTeachers();
  }, [user.school_id]);

  const [formData, setFormData] = useState({
    name: '',
    level: classLevelDefault,
    teacher: '',
    room: '',
    description: '',
    duration: '',
    examsCount: 4,
    periodFormat: 'CONTROLE',
    campus_id: user.campus_id || currentCampusId || '',
    division: ''
  });

  const [useStandardSelector, setUseStandardSelector] = useState(() => {
    return !isEdit && (activeCategory === SchoolType.UNIVERSITY || activeCategory === SchoolType.PROFESSIONAL);
  });
  const [selectedStandardDiscipline, setSelectedStandardDiscipline] = useState('');
  const [selectedStandardYear, setSelectedStandardYear] = useState('I');
  const [activeDomainFilter, setActiveDomainFilter] = useState<string>('Tous');

  // Helper pour dédoublement de section (ex: "A", "B")
  const [selectedSectionTag, setSelectedSectionTag] = useState<string>('');

  useEffect(() => {
    if (useStandardSelector) {
      if (activeCategory === SchoolType.UNIVERSITY) {
        setSelectedStandardDiscipline(standardUniversityDisciplines[0].name);
        setSelectedStandardYear('I');
      } else if (activeCategory === SchoolType.PROFESSIONAL) {
        setSelectedStandardDiscipline(standardProfessionalDisciplines[0].name);
        setSelectedStandardYear('I');
      }
    }
  }, [activeCategory, useStandardSelector]);

  useEffect(() => {
    if (useStandardSelector) {
      const disciplines = activeCategory === SchoolType.UNIVERSITY ? standardUniversityDisciplines : standardProfessionalDisciplines;
      const found = disciplines.find(d => d.name === selectedStandardDiscipline);
      if (found) {
        const generatedName = selectedSectionTag 
          ? `${found.name} ${selectedStandardYear} - ${selectedSectionTag}`
          : `${found.name} ${selectedStandardYear}`;

        setFormData(prev => ({
          ...prev,
          name: generatedName,
          duration: `${found.duration} ans`,
          level: found.level
        }));
      }
    }
  }, [selectedStandardDiscipline, selectedStandardYear, selectedSectionTag, useStandardSelector, activeCategory]);

  useEffect(() => {
    if (isEdit) {
      if (formData.division === 'Universitaire' || formData.division === 'UNIVERSITY') {
        setActiveCategory(SchoolType.UNIVERSITY);
      } else if (formData.division === 'Professionnelle' || formData.division === 'PROFESSIONAL') {
        setActiveCategory(SchoolType.PROFESSIONAL);
      } else {
        if (['LICENCE', 'MASTER'].includes(formData.level)) {
          setActiveCategory(SchoolType.UNIVERSITY);
        } else if (['CERTIFICAT', 'DIPLOME'].includes(formData.level)) {
          setActiveCategory(SchoolType.PROFESSIONAL);
        } else {
          setActiveCategory(SchoolType.CLASSIC);
        }
      }
    }
  }, [isEdit, formData.level, formData.division]);

  useEffect(() => {
    if (!isEdit) {
      if (activeCategory === SchoolType.UNIVERSITY && !['LICENCE', 'MASTER', 'DIPLOME'].includes(formData.level)) {
        setFormData(prev => ({ ...prev, level: SchoolLevel.LICENCE }));
      } else if (activeCategory === SchoolType.PROFESSIONAL && !['CERTIFICAT', 'DIPLOME'].includes(formData.level)) {
        setFormData(prev => ({ ...prev, level: SchoolLevel.CERTIFICAT }));
      } else if (activeCategory === SchoolType.CLASSIC && !['MATERNELLE', 'FONDAMENTALE', 'SECONDAIRE'].includes(formData.level)) {
        setFormData(prev => ({ ...prev, level: SchoolLevel.FONDAMENTALE }));
      }
    }
  }, [activeCategory, isEdit]);

  const formSchoolType = activeCategory;

  // Détection de doublons en temps réel
  useEffect(() => {
    const checkDuplicateName = async () => {
      if (!formData.name || !user.school_id) {
        setIsNameDuplicate(false);
        return;
      }
      
      let cleanName = formData.name.trim();

      if (formSchoolType === SchoolType.UNIVERSITY) {
        cleanName = cleanName.replace(/^(licence|dipl[ôo]me|master)\s*\d*\s*[-:]?\s*/i, '').trim() || cleanName;
      } else if (formSchoolType === SchoolType.PROFESSIONAL) {
        cleanName = cleanName.replace(/^(certificat|dipl[ôo]me)\s*\d*\s*[-:]?\s*/i, '').trim() || cleanName;
      }

      try {
        const { data: existing } = await supabase
          .from('classes')
          .select('id')
          .eq('school_id', user.school_id)
          .eq('level', formData.level)
          .ilike('name', cleanName);

        if (existing && existing.length > 0) {
          const duplicateIds = existing.map(e => e.id);
          if (!isEdit || !duplicateIds.includes(id as string)) {
            setIsNameDuplicate(true);
            return;
          }
        }
        setIsNameDuplicate(false);
      } catch (e) {
        // ignore
      }
    };

    const timer = setTimeout(checkDuplicateName, 400);
    return () => clearTimeout(timer);
  }, [formData.name, formData.level, user.school_id, isEdit, id, formSchoolType]);

  useEffect(() => {
    if (isEdit) {
      const loadClass = async () => {
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .eq('id', id)
          .eq('school_id', user.school_id)
          .single();
        
        if (error) {
          setApiError(error.message);
          return;
        }

        if (data) {
          let desc = data.description || '';
          let parsedDuration = '';
          let parsedExamsCount = 4;
          let parsedPeriodFormat = 'CONTROLE';
          let parsedDivision = '';
          
          if (desc.startsWith('{')) {
            try {
              const parsedDesc = JSON.parse(desc);
              desc = parsedDesc.notes || '';
              parsedDuration = parsedDesc.duration || '';
              parsedExamsCount = parsedDesc.examsCount || 4;
              parsedPeriodFormat = parsedDesc.periodFormat || 'CONTROLE';
              parsedDivision = parsedDesc.division || '';
            } catch(e) {
              // Not JSON
            }
          }

          setFormData({
            name: data.name || '',
            level: (data.level as SchoolLevel) || SchoolLevel.FONDAMENTALE,
            teacher: data.teacher_name || '',
            room: data.room || '',
            description: desc,
            duration: parsedDuration,
            examsCount: parsedExamsCount,
            periodFormat: parsedPeriodFormat,
            campus_id: data.campus_id || '',
            division: parsedDivision || ''
          });
        }
      };
      loadClass();
    }
  }, [id, isEdit, user.school_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setApiError(null);

    const validationResult = classSchema.safeParse(formData);
    if (!validationResult.success) {
      setApiError(validationResult.error.issues[0].message);
      setIsSubmitting(false);
      return;
    }

    const schoolId = user.school_id;
    if (!schoolId) {
      setApiError("Impossible d'identifier l'établissement connecté.");
      setIsSubmitting(false);
      return;
    }

    if (isNameDuplicate) {
      setApiError(`Cette ${terminology.class.toLowerCase()} existe déjà pour ce cycle/niveau.`);
      setIsSubmitting(false);
      return;
    }

    let cleanName = formData.name.trim();

    if (formSchoolType === SchoolType.UNIVERSITY) {
      cleanName = cleanName.replace(/^(licence|dipl[ôo]me|master)\s*\d*\s*[-:]?\s*/i, '').trim() || cleanName;
    } else if (formSchoolType === SchoolType.PROFESSIONAL) {
      cleanName = cleanName.replace(/^(certificat|dipl[ôo]me)\s*\d*\s*[-:]?\s*/i, '').trim() || cleanName;
    }

    try {
      const { data: existing } = await supabase
        .from('classes')
        .select('id')
        .eq('school_id', schoolId)
        .eq('level', formData.level)
        .ilike('name', cleanName);

      if (existing && existing.length > 0) {
        const duplicateIds = existing.map(e => e.id);
        if (!isEdit || !duplicateIds.includes(id as string)) {
          setApiError(`Cette ${terminology.class.toLowerCase()} existe déjà pour ce cycle/niveau.`);
          setIsSubmitting(false);
          return;
        }
      }
    } catch (e) {
      // ignorer et continuer
    }

    const payloadDescription = JSON.stringify({
      notes: formData.description,
      duration: formData.duration,
      examsCount: formData.examsCount,
      periodFormat: formData.periodFormat,
      division: formSchoolType === SchoolType.UNIVERSITY ? 'Universitaire' : formSchoolType === SchoolType.PROFESSIONAL ? 'Professionnelle' : undefined
    });

    const payload = {
      school_id: schoolId,
      campus_id: formData.campus_id || null,
      name: cleanName,
      level: formData.level,
      teacher_name: formData.teacher,
      room: formData.room,
      description: payloadDescription
    };

    try {
      let error;
      let insertedId = id;
      if (isEdit) {
        const { error: err } = await supabase.from('classes').update(payload).eq('id', id);
        error = err;
      } else {
        const { data, error: err } = await supabase.from('classes').insert([payload]).select().single();
        error = err;
        if (data) {
          insertedId = data.id;
          const { data: schoolSubs } = await supabase
            .from('subjects')
            .select('id, code')
            .eq('school_id', payload.school_id);

          if (schoolSubs && schoolSubs.length > 0) {
            const newAssocs = schoolSubs.map((sub) => ({
              class_id: data.id,
              subject_id: sub.id,
              coefficient: getCollegeInnovationsDefaultCoefficient(data.level, sub.code),
              school_id: payload.school_id,
            }));
            await supabase.from('class_subjects').upsert(newAssocs, { onConflict: 'class_id,subject_id' });
          }
        }
      }

      if (error) {
        if (error.message.includes('column') || error.code === 'PGRST204') {
          throw new Error("Erreur de synchronisation base de données. Veuillez vérifier le schéma de vos classes dans Supabase.");
        }
        throw error;
      }
      
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: isEdit ? 'UPDATE' : 'CREATE',
        entity_type: 'class',
        entity_id: insertedId,
        details: { name: payload.name, level: payload.level }
      });
      
      navigate('/classes');
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Raccourcis prédéfinis pour le cycle classique actif
  const currentClassicPresets = classicPresetsByCycle[formData.level as keyof typeof classicPresetsByCycle] || [];

  // Filtrage des filières universitaires par domaine
  const universityDomains = ['Tous', 'Technologies', 'Gestion & Économie', 'Santé & Sciences', 'Droit & Humaines', 'Ingénierie'];
  const filteredUniversityDisciplines = activeDomainFilter === 'Tous' 
    ? standardUniversityDisciplines 
    : standardUniversityDisciplines.filter(d => d.category === activeDomainFilter);

  return (
    <div className="max-w-4xl mx-auto space-y-3 sm:space-y-3.5 animate-in fade-in duration-300 pb-12">
      {/* En-tête Compact, Moderne & Contextuel */}
      <header className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/classes')} 
            className="p-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-200/80 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-2xs group shrink-0 cursor-pointer"
            title={`Retour aux ${terminology.classes.toLowerCase()}`}
            aria-label="Retour"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-2xs border shrink-0 ${
              formSchoolType === SchoolType.UNIVERSITY
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                : formSchoolType === SchoolType.PROFESSIONAL
                ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                : 'bg-blue-50 text-blue-600 border-blue-200/80'
            }`}>
              {formSchoolType === SchoolType.UNIVERSITY ? (
                <GraduationCap size={20} />
              ) : formSchoolType === SchoolType.PROFESSIONAL ? (
                <BookOpen size={20} />
              ) : (
                <School size={20} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {isEdit 
                    ? `Modifier la ${terminology.class}` 
                    : formSchoolType === SchoolType.UNIVERSITY 
                    ? `Créer une Nouvelle Promotion / Filière` 
                    : `Créer une Nouvelle ${terminology.class}`}
                </h1>
                <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-md border ${
                  formSchoolType === SchoolType.UNIVERSITY 
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                    : formSchoolType === SchoolType.PROFESSIONAL
                    ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                    : 'bg-blue-50 text-blue-700 border-blue-200/80'
                }`}>
                  {formSchoolType === SchoolType.UNIVERSITY 
                    ? 'Enseignement Supérieur' 
                    : formSchoolType === SchoolType.PROFESSIONAL 
                    ? 'Formation Pro & Métiers' 
                    : 'Enseignement Général'}
                </span>
              </div>
              <p className="text-slate-500 text-xs font-medium">
                {isEdit 
                  ? `Mise à jour des paramètres structurels et pédagogiques` 
                  : `Paramétrage rapide, attribution de salle et intégration dans la grille académique`}
              </p>
            </div>
          </div>
        </div>

        {/* Sélecteur de Mode Conditionnel & Automatique selon le type d'école */}
        {!isEdit && (
          <div>
            {isClassicSchool ? (
              /* École Classique : pas d'onglets superflus Universitaire/Pro */
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-200/80 text-xs font-bold self-start sm:self-auto shrink-0 shadow-2xs">
                <School size={14} className="text-blue-600" />
                <span>Programme Classique (Maternelle - Secondaire)</span>
              </div>
            ) : isUniversitySchool ? (
              /* École Universitaire : exactement les 2 onglets autorisés (Universitaire & Professionnelle) */
              <div className="flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs font-bold self-start sm:self-auto shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory(SchoolType.UNIVERSITY);
                    setUseStandardSelector(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === SchoolType.UNIVERSITY 
                      ? 'bg-white text-indigo-700 shadow-2xs font-extrabold border border-slate-200/60' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap size={14} />
                  <span>Universitaire</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory(SchoolType.PROFESSIONAL);
                    setUseStandardSelector(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === SchoolType.PROFESSIONAL 
                      ? 'bg-white text-amber-700 shadow-2xs font-extrabold border border-slate-200/60' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen size={14} />
                  <span>Professionnelle</span>
                </button>
              </div>
            ) : isProfessionalSchool ? (
              /* École Professionnelle : Professionnelle & Universitaire */
              <div className="flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs font-bold self-start sm:self-auto shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory(SchoolType.PROFESSIONAL);
                    setUseStandardSelector(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === SchoolType.PROFESSIONAL 
                      ? 'bg-white text-amber-700 shadow-2xs font-extrabold border border-slate-200/60' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen size={14} />
                  <span>Professionnelle</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory(SchoolType.UNIVERSITY);
                    setUseStandardSelector(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === SchoolType.UNIVERSITY 
                      ? 'bg-white text-indigo-700 shadow-2xs font-extrabold border border-slate-200/60' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap size={14} />
                  <span>Universitaire</span>
                </button>
              </div>
            ) : (
              /* Super Admin ou établissement multi-programmes */
              <div className="flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs font-bold self-start sm:self-auto shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory(SchoolType.CLASSIC);
                    setUseStandardSelector(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === SchoolType.CLASSIC 
                      ? 'bg-white text-blue-700 shadow-2xs font-extrabold border border-slate-200/60' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <School size={14} />
                  <span>Classique</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory(SchoolType.UNIVERSITY);
                    setUseStandardSelector(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === SchoolType.UNIVERSITY 
                      ? 'bg-white text-indigo-700 shadow-2xs font-extrabold border border-slate-200/60' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap size={14} />
                  <span>Universitaire</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory(SchoolType.PROFESSIONAL);
                    setUseStandardSelector(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === SchoolType.PROFESSIONAL 
                      ? 'bg-white text-amber-700 shadow-2xs font-extrabold border border-slate-200/60' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen size={14} />
                  <span>Professionnelle</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Barre de prévisualisation dynamique en direct */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0">
            <Sparkles size={14} className="text-amber-300" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-1">
              Aperçu en direct de la structure créée
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-extrabold text-white truncate">
                {formData.name.trim() || `[Nom de la ${terminology.class.toLowerCase()}]`}
              </span>
              <span className="text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded">
                {formData.level}
              </span>
              {formData.room && (
                <span className="text-[11px] text-slate-300 bg-white/10 px-2 py-0.5 rounded">
                  📍 {formData.room}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <Check size={12} />
            Prêt pour l'enregistrement
          </span>
        </div>
      </div>

      {apiError && (
        <div className="bg-rose-50 border border-rose-200/80 p-3 rounded-xl flex items-start gap-2.5 text-rose-800 shadow-2xs animate-in fade-in">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
          <div className="space-y-0.5 text-xs font-medium">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-900">Avertissement de validation</p>
            <p>{apiError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
        
        {/* ========================================================= */}
        {/* SECTION 1: Identité & Cycle (Spécifique Classique vs Uni) */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {formSchoolType === SchoolType.UNIVERSITY 
                  ? 'Filière, Faculté & Niveau Académique' 
                  : `Identité & Cycle de la ${terminology.class}`}
              </h2>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">* Champ obligatoire</span>
          </div>

          {/* 1.A : CAS ÉCOLE UNIVERSITAIRE */}
          {formSchoolType === SchoolType.UNIVERSITY && (
            <div className="space-y-3">
              {useStandardSelector ? (
                <div className="p-3 sm:p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3">
                  {/* Filtres par domaine universitaire */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                    <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0 mr-1">
                      Domaine :
                    </span>
                    {universityDomains.map(domain => (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => setActiveDomainFilter(domain)}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                          activeDomainFilter === domain
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {domain}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Filière Universitaire Référencée
                      </label>
                      <SelectPill 
                        value={selectedStandardDiscipline}
                        onChange={(val) => setSelectedStandardDiscipline(val)}
                        options={filteredUniversityDisciplines.map(d => ({
                          value: d.name,
                          label: d.name,
                          badge: d.category,
                          description: `Cursus de ${d.duration} ans (${d.level})`
                        }))}
                        variant="field"
                        size="sm"
                        colorScheme="indigo"
                        searchable={true}
                        portal={true}
                        placeholder="Sélectionner la filière universitaire..."
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Année d'Études / Promotion
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {['I', 'II', 'III', 'IV', 'V', 'VI'].slice(0, 
                          standardUniversityDisciplines.find(d => d.name === selectedStandardDiscipline)?.duration || 4
                        ).map(year => (
                          <button
                            key={year}
                            type="button"
                            onClick={() => setSelectedStandardYear(year)}
                            className={`flex-1 min-w-[50px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                              selectedStandardYear === year
                                ? 'bg-indigo-600 text-white shadow-2xs border border-indigo-600'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            Année {year}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bouton de bascule vers intitulé personnalisé */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Intitulé généré automatiquement selon les normes LMD
                    </span>
                    <button 
                      type="button"
                      onClick={() => {
                        setUseStandardSelector(false);
                        setFormData(prev => ({ ...prev, name: '' }));
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Compass size={13} />
                      <span>Saisir un intitulé libre / sur-mesure</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Intitulé Personnalisé de la Promotion / Cursus <span className="text-rose-500">*</span>
                    </label>
                    <button 
                      type="button"
                      onClick={() => setUseStandardSelector(true)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors cursor-pointer"
                    >
                      Revenir au catalogue universitaire
                    </button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <GraduationCap size={16} />
                    </div>
                    <input 
                      required 
                      type="text" 
                      className={`w-full pl-9 pr-3 py-2 bg-slate-50/60 text-slate-900 border ${
                        isNameDuplicate 
                          ? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500/20' 
                          : 'border-slate-200 focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10'
                      } rounded-xl text-xs sm:text-sm font-medium transition-all shadow-2xs placeholder:text-slate-400 outline-none`} 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})} 
                      placeholder="Ex: Master en Cybersécurité & Données I" 
                    />
                  </div>
                </div>
              )}

              {/* Sélection Degré Académique Universitaire */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Cycle / Degré Universitaire (LMD)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: SchoolLevel.LICENCE, label: 'Licence', desc: '1er Cycle (Bac+3/4)' },
                    { value: SchoolLevel.MASTER, label: 'Master', desc: '2ème Cycle (Bac+5)' },
                    { value: SchoolLevel.DIPLOME, label: 'Diplôme Universitaire', desc: 'Formation Universitaire' }
                  ].map(lvl => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setFormData({...formData, level: lvl.value})}
                      className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
                        formData.level === lvl.value
                          ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-2xs ring-1 ring-indigo-300'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-xs font-bold leading-tight">{lvl.label}</span>
                      <span className="block text-[10px] text-slate-500 font-medium mt-0.5">{lvl.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 1.B : CAS ÉCOLE PROFESSIONNELLE */}
          {formSchoolType === SchoolType.PROFESSIONAL && (
            <div className="space-y-3">
              {useStandardSelector ? (
                <div className="p-3 sm:p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Filière Professionnelle Référencée
                      </label>
                      <SelectPill 
                        value={selectedStandardDiscipline}
                        onChange={(val) => setSelectedStandardDiscipline(val)}
                        options={standardProfessionalDisciplines.map(d => ({
                          value: d.name,
                          label: d.name,
                          badge: d.category,
                          description: `Formation ${d.duration} an${d.duration > 1 ? 's' : ''} (${d.level})`
                        }))}
                        variant="field"
                        size="sm"
                        colorScheme="amber"
                        searchable={true}
                        portal={true}
                        placeholder="Sélectionner la filière professionnelle..."
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Niveau / Cohorte
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {['I', 'II'].map(year => (
                          <button
                            key={year}
                            type="button"
                            onClick={() => setSelectedStandardYear(year)}
                            className={`flex-1 min-w-[50px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                              selectedStandardYear === year
                                ? 'bg-amber-600 text-white shadow-2xs border border-amber-600'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            Année {year}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Intitulé généré : <strong>{formData.name}</strong>
                    </span>
                    <button 
                      type="button"
                      onClick={() => {
                        setUseStandardSelector(false);
                        setFormData(prev => ({ ...prev, name: '' }));
                      }}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Compass size={13} />
                      <span>Saisie libre</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Intitulé de la Spécialité <span className="text-rose-500">*</span>
                    </label>
                    <button 
                      type="button"
                      onClick={() => setUseStandardSelector(true)}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline transition-colors cursor-pointer"
                    >
                      Catalogue technique
                    </button>
                  </div>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-3 py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-600/10 transition-all outline-none" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    placeholder="Ex: Électromécanique Industrielle I" 
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { value: SchoolLevel.CERTIFICAT, label: 'Certificat Professionnel (1 an)' },
                  { value: SchoolLevel.DIPLOME, label: 'Diplôme Technique (2 ans)' }
                ].map(lvl => (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => setFormData({...formData, level: lvl.value})}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${
                      formData.level === lvl.value
                        ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs font-extrabold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1.C : CAS ÉCOLE CLASSIQUE (Maternelle, Fondamentale, Secondaire) */}
          {formSchoolType === SchoolType.CLASSIC && (
            <div className="space-y-3">
              {/* Sélecteur de Cycle Visuel */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Sélectionnez le Cycle d'Enseignement
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { 
                      value: SchoolLevel.MATERNELLE, 
                      title: "Maternelle", 
                      subtitle: "Cycle Préscolaire (TPS, PS, MS, GS)",
                      icon: "👶"
                    },
                    { 
                      value: SchoolLevel.FONDAMENTALE, 
                      title: "Fondamentale", 
                      subtitle: "1er, 2e & 3e Cycle (1ère à 9e AF)",
                      icon: "📚"
                    },
                    { 
                      value: SchoolLevel.SECONDAIRE, 
                      title: "Secondaire", 
                      subtitle: "Nouveau Secondaire (NS1 à NS4)",
                      icon: "🎓"
                    },
                  ].map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          level: c.value,
                          // Réinitialise le nom ou propose le 1er preset
                          name: classicPresetsByCycle[c.value]?.[0]?.full || prev.name
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2 cursor-pointer ${
                        formData.level === c.value
                          ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-2xs ring-1 ring-blue-300'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xl shrink-0 mt-0.5">{c.icon}</span>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold leading-tight">{c.title}</span>
                        <span className="block text-[10px] text-slate-500 font-medium leading-snug mt-0.5">{c.subtitle}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Raccourcis de niveaux rapides pour le cycle sélectionné */}
              <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/60 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Sparkles size={11} className="text-amber-500" />
                  Raccourcis rapides ({formData.level}) :
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {currentClassicPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const baseName = preset.full;
                        const finalName = selectedSectionTag ? `${baseName} - ${selectedSectionTag}` : baseName;
                        setFormData(prev => ({
                          ...prev,
                          name: finalName,
                          level: preset.level
                        }));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        formData.name.startsWith(preset.full)
                          ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Champ Intitulé + Dédoublement Section A/B */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Intitulé Complet de la {terminology.class} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <GraduationCap size={15} />
                    </div>
                    <input 
                      required 
                      type="text" 
                      className={`w-full pl-9 pr-3 py-2 bg-slate-50/60 text-slate-900 border ${
                        isNameDuplicate 
                          ? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500/20' 
                          : 'border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10'
                      } rounded-xl text-xs sm:text-sm font-medium transition-all shadow-2xs placeholder:text-slate-400 outline-none`} 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})} 
                      placeholder="Ex: 7ème Année AF, Nouveau Secondaire I (NS1)..." 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Section / Groupe
                  </label>
                  <div className="flex gap-1">
                    {sectionLetters.map(sec => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          const newTag = selectedSectionTag === sec ? '' : sec;
                          setSelectedSectionTag(newTag);
                          // Met à jour le nom s'il se termine déjà par un suffixe
                          let baseName = formData.name.replace(/\s*-\s*[A-Z0-9]+$/i, '').trim();
                          if (!baseName && formData.level) {
                            baseName = currentClassicPresets[0]?.full || 'Classe';
                          }
                          const finalName = newTag ? `${baseName} - ${newTag}` : baseName;
                          setFormData(prev => ({ ...prev, name: finalName }));
                        }}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                          selectedSectionTag === sec
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={`Section ${sec}`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {isNameDuplicate && (
            <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1.5 p-2 bg-amber-50/80 rounded-lg border border-amber-200/80 animate-in fade-in">
              <AlertCircle size={14} className="shrink-0 text-amber-600" />
              <span>Une {terminology.class.toLowerCase()} avec ce libellé existe déjà pour ce niveau dans votre établissement.</span>
            </p>
          )}
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: Attribution Pédagogique, Salle & Campus       */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {formSchoolType === SchoolType.UNIVERSITY 
                ? "Doyen, Amphithéâtre & Localisation" 
                : "Titulaire, Salle & Localisation"}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  {formSchoolType === SchoolType.UNIVERSITY 
                    ? "Doyen / Resp. Pédagogique" 
                    : "Professeur Titulaire"}
                </label>
                {teachers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsManualTeacherMode(!isManualTeacherMode)}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    {isManualTeacherMode ? "Annuaire" : "Saisie libre"}
                  </button>
                )}
              </div>
              
              {!isManualTeacherMode && teachers.length > 0 ? (
                <SelectPill
                  value={formData.teacher}
                  onChange={(val) => setFormData(prev => ({ ...prev, teacher: val }))}
                  options={[
                    { value: '', label: 'Non assigné (À définir)', badge: 'Optionnel' },
                    ...teachers.map(t => ({
                      value: t.name,
                      label: t.name,
                      badge: 'Enseignant',
                      description: t.email
                    })),
                    ...(formData.teacher && !teachers.some(t => t.name.toLowerCase() === formData.teacher.toLowerCase()) ? [{
                      value: formData.teacher,
                      label: formData.teacher,
                      badge: 'Personnalisé'
                    }] : [])
                  ]}
                  variant="field"
                  size="sm"
                  colorScheme="blue"
                  icon={UserCheck}
                  searchable={true}
                  portal={true}
                  placeholder={formSchoolType === SchoolType.UNIVERSITY ? "Choisir le doyen / responsable..." : "Choisir le titulaire..."}
                  className="w-full"
                />
              ) : (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserCheck size={15} />
                  </div>
                  <input 
                    type="text" 
                    className="w-full pl-9 pr-3 py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all shadow-2xs placeholder:text-slate-400 outline-none" 
                    value={formData.teacher} 
                    onChange={(e) => setFormData({...formData, teacher: e.target.value})} 
                    placeholder={formSchoolType === SchoolType.UNIVERSITY ? "Ex: Dr. Jean Dupont" : "Ex: Prof. Marie Claire"} 
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                {formSchoolType === SchoolType.UNIVERSITY 
                  ? "Amphithéâtre / Salle" 
                  : "Salle de Classe / Local"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building2 size={15} />
                </div>
                <input 
                  type="text" 
                  className="w-full pl-9 pr-3 py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all shadow-2xs placeholder:text-slate-400 outline-none" 
                  value={formData.room} 
                  onChange={(e) => setFormData({...formData, room: e.target.value})} 
                  placeholder={formSchoolType === SchoolType.UNIVERSITY ? "Ex: Amphi A, Bâtiment Sciences" : "Ex: Salle 102, Étage 1"} 
                />
              </div>
            </div>

            {campuses && campuses.length > 1 && !user.campus_id && (
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <MapPin size={13} className="text-blue-600" />
                  Campus / Annexe d'Attache
                </label>
                <SelectPill
                  value={formData.campus_id}
                  onChange={(val) => setFormData(prev => ({ ...prev, campus_id: val }))}
                  options={[
                    { value: '', label: 'Tous les campus (Central)', badge: 'Siège' },
                    ...campuses.map(c => ({
                      value: c.id,
                      label: c.name,
                      badge: 'Annexe'
                    }))
                  ]}
                  variant="field"
                  size="sm"
                  colorScheme="blue"
                  icon={MapPin}
                  portal={true}
                  placeholder="Sélectionner le campus d'attache..."
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 3: Paramètres du Cursus (Universitaire / Pro)    */}
        {/* ========================================================= */}
        {formSchoolType !== SchoolType.CLASSIC && (
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Paramètres Académiques du Cursus
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Clock size={12} className="text-slate-500" />
                  Durée Globale
                </label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 transition-all shadow-2xs outline-none" 
                  value={formData.duration} 
                  onChange={(e) => setFormData({...formData, duration: e.target.value})} 
                  placeholder="ex: 4 ans / 8 semestres" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={12} className="text-slate-500" />
                  Format d'Évaluation
                </label>
                <SelectPill 
                  value={formData.periodFormat} 
                  onChange={(val) => setFormData(prev => ({ ...prev, periodFormat: val }))}
                  options={[
                    { value: 'SEMESTRE_INTRA', label: 'Semestres (Intra / Final)', badge: 'LMD Standard', description: 'Examens intra-semestre et finaux' },
                    { value: 'SEMESTRE', label: 'Semestres (S1 / S2)', badge: 'Semestriel', description: 'Deux semestres académiques' },
                    { value: 'CONTROLE', label: 'Séquentiel (Nème Contrôle)', badge: 'Contrôles', description: 'Sessions d\'évaluations périodiques' },
                    { value: 'TRIMESTRE', label: 'Trimestres (T1 / T2 / T3)', badge: 'Trimestriel', description: 'Trois trimestres traditionnels' }
                  ]}
                  variant="field"
                  size="sm"
                  colorScheme={formSchoolType === SchoolType.UNIVERSITY ? 'indigo' : 'blue'}
                  icon={Calendar}
                  portal={true}
                  placeholder="Format d'évaluation..."
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Layers size={12} className="text-slate-500" />
                  Examens / Sessions par An
                </label>
                <input 
                  type="number" 
                  min={1} 
                  max={10} 
                  className="w-full px-3 py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 transition-all shadow-2xs outline-none" 
                  value={formData.examsCount} 
                  onChange={(e) => setFormData({...formData, examsCount: parseInt(e.target.value) || 4})} 
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 4: Directives Pédagogiques & Notes                */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Directives Pédagogiques & Remarques Administratives
            </h2>
          </div>

          <textarea 
            rows={2} 
            className="w-full p-2.5 sm:p-3 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all resize-none shadow-2xs placeholder:text-slate-400 outline-none" 
            value={formData.description} 
            onChange={(e) => setFormData({...formData, description: e.target.value})} 
            placeholder="Directives spécifiques pour cette promotion, objectifs pédagogiques ou consignes administratives..." 
          />
        </div>

        {/* ========================================================= */}
        {/* BARRE D'ACTIONS : Annuler & Valider                       */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button 
            type="button" 
            onClick={() => navigate('/classes')} 
            className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            Annuler
          </button>

          <button 
            disabled={isSubmitting || isNameDuplicate || !formData.name.trim()} 
            type="submit" 
            className="px-5 sm:px-6 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs hover:bg-blue-600 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group/btn cursor-pointer active:scale-95"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Save size={15} className="group-hover/btn:scale-110 transition-transform" />
            )}
            <span>
              {isEdit 
                ? `Enregistrer les Modifications` 
                : formSchoolType === SchoolType.UNIVERSITY 
                ? `Créer la Promotion / Filière` 
                : `Créer la ${terminology.class}`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClassForm;
