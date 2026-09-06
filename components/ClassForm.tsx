
import React, { useState, useEffect } from 'react';
import { Save, GraduationCap, MapPin, Layers, UserCheck, ArrowLeft, Plus, Loader2, AlertCircle, Building2, BookOpen, Sparkles, FileText, CheckCircle2, ChevronRight, HelpCircle, School } from 'lucide-react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';
import { SchoolLevel, UserProfile, SchoolType } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { classSchema } from '../utils/validation';
import { getCollegeInnovationsDefaultCoefficient } from './ClassManagement';

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

  const [activeCategory, setActiveCategory] = useState<SchoolType>(() => {
    if (isEdit) {
      const level = typeParam as any; // Not reliable, use classLevelDefault as proxy or wait for load?
      return SchoolType.CLASSIC; // Temporary, will be updated by load
    }
    if (typeParam === 'Universitaire') return SchoolType.UNIVERSITY;
    if (typeParam === 'Professionnelle') return SchoolType.PROFESSIONAL;
    if (['Maternelle', 'Fondamentale', 'Secondaire'].includes(typeParam || '')) return SchoolType.CLASSIC;
    return school?.school_type || SchoolType.CLASSIC;
  });

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

  const standardUniversityDisciplines = [
    { name: 'Sciences Informatiques', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Génie Software / Génie Logiciel', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Réseaux & Télécommunications', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Intelligence Artificielle & Data', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Cybersécurité & Cloud Computing', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Sciences Administratives', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Sciences Comptables & Audit', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Gestion des Ressources Humaines', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Marketing & Management Digital', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Sciences Économiques & Finance', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Droit & Sciences Juridiques', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Relations Internationales', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Sciences Infirmières', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Médecine Générale', duration: 6, level: SchoolLevel.LICENCE },
    { name: 'Médecine Dentaire', duration: 5, level: SchoolLevel.LICENCE },
    { name: 'Pharmacologie & Toxicologie', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Technologie Médicale & Laboratoire', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Sciences de la Nutrition', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Science de l\'Éducation', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Génie Civil & Infrastructures', duration: 5, level: SchoolLevel.LICENCE },
    { name: 'Génie Électromécanique', duration: 5, level: SchoolLevel.LICENCE },
    { name: 'Communication Sociale & Journalisme', duration: 4, level: SchoolLevel.LICENCE },
    { name: 'Psychologie Clinique & Sociale', duration: 4, level: SchoolLevel.LICENCE },
  ];

  const standardProfessionalDisciplines = [
    { name: 'Comptabilité Informatisée & Fiscalité', duration: 2, level: SchoolLevel.DIPLOME },
    { name: 'Technique Douanière & Transit', duration: 2, level: SchoolLevel.DIPLOME },
    { name: 'Secrétariat Médical & Gestion', duration: 2, level: SchoolLevel.DIPLOME },
    { name: 'Marketing & Vente Professionnelle', duration: 2, level: SchoolLevel.DIPLOME },
    { name: 'Informatique de Bureau & Administration', duration: 1, level: SchoolLevel.CERTIFICAT },
    { name: 'Assistance Administrative & Bilingue', duration: 1, level: SchoolLevel.CERTIFICAT },
    { name: 'Maintenance Informatique & Réseaux', duration: 2, level: SchoolLevel.DIPLOME },
    { name: 'Graphisme & Design Multimédia', duration: 1, level: SchoolLevel.CERTIFICAT },
    { name: 'Développement Web & Applications', duration: 2, level: SchoolLevel.DIPLOME },
    { name: 'Électricité du Bâtiment & Solaire', duration: 1, level: SchoolLevel.CERTIFICAT },
    { name: 'Plomberie & Sanitaire Moderne', duration: 1, level: SchoolLevel.CERTIFICAT },
    { name: 'Climatisation, Froid & Réfrigération', duration: 2, level: SchoolLevel.DIPLOME },
    { name: 'Mécanique Automobile & Diagnostic', duration: 2, level: SchoolLevel.DIPLOME },
    { name: 'Soudure & Fabrication Industrielle', duration: 1, level: SchoolLevel.CERTIFICAT },
    { name: 'Cuisine, Restauration & Traiteur', duration: 2, level: SchoolLevel.DIPLOME },
    { name: 'Pâtisserie & Boulangerie Artisanale', duration: 1, level: SchoolLevel.CERTIFICAT },
    { name: 'Gestion Hôtelière & Touristique', duration: 2, level: SchoolLevel.DIPLOME },
    { name: 'Couture, Stylisme & Modélisme', duration: 2, level: SchoolLevel.DIPLOME },
    { name: 'Esthétique, Cosmétique & Maquillage', duration: 1, level: SchoolLevel.CERTIFICAT },
    { name: 'Coiffure Professionnelle & Visagisme', duration: 1, level: SchoolLevel.CERTIFICAT },
    { name: 'Secourisme, Hygiène & Soins d\'Urgence', duration: 1, level: SchoolLevel.CERTIFICAT },
  ];

  const [useStandardSelector, setUseStandardSelector] = useState(() => {
    return !isEdit && (activeCategory === SchoolType.UNIVERSITY || activeCategory === SchoolType.PROFESSIONAL);
  });
  const [selectedStandardDiscipline, setSelectedStandardDiscipline] = useState('');
  const [selectedStandardYear, setSelectedStandardYear] = useState('I');

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
        setFormData(prev => ({
          ...prev,
          name: `${found.name} ${selectedStandardYear}`,
          duration: `${found.duration} ans`,
          level: found.level
        }));
      }
    }
  }, [selectedStandardDiscipline, selectedStandardYear, useStandardSelector, activeCategory]);

  useEffect(() => {
    if (isEdit) {
      if (formData.division === 'Universitaire' || formData.division === 'UNIVERSITY') {
        setActiveCategory(SchoolType.UNIVERSITY);
      } else if (formData.division === 'Professionnelle' || formData.division === 'PROFESSIONAL') {
        setActiveCategory(SchoolType.PROFESSIONAL);
      } else {
        if (['LICENCE', 'DIPLOME'].includes(formData.level)) {
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
      if (activeCategory === SchoolType.UNIVERSITY && !['LICENCE', 'DIPLOME'].includes(formData.level)) {
        setFormData(prev => ({ ...prev, level: SchoolLevel.LICENCE }));
      } else if (activeCategory === SchoolType.PROFESSIONAL && !['CERTIFICAT', 'DIPLOME'].includes(formData.level)) {
        setFormData(prev => ({ ...prev, level: SchoolLevel.CERTIFICAT }));
      } else if (activeCategory === SchoolType.CLASSIC && !['MATERNELLE', 'FONDAMENTALE', 'SECONDAIRE'].includes(formData.level)) {
        setFormData(prev => ({ ...prev, level: SchoolLevel.FONDAMENTALE }));
      }
    }
  }, [activeCategory, isEdit]);

  const formSchoolType = activeCategory;

  useEffect(() => {
    const checkDuplicateName = async () => {
      if (!formData.name || !user.school_id) {
        setIsNameDuplicate(false);
        return;
      }
      
      let cleanName = formData.name.trim();

      if (formSchoolType === SchoolType.UNIVERSITY) {
        cleanName = cleanName.replace(/^(licence|dipl[ôo]me)\s*\d*\s*[-:]?\s*/i, '').trim() || cleanName;
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

    const timer = setTimeout(checkDuplicateName, 500);
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
  }, [id, isEdit]);

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
      setApiError("Impossible de déterminer l'établissement.");
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
      cleanName = cleanName.replace(/^(licence|dipl[ôo]me)\s*\d*\s*[-:]?\s*/i, '').trim() || cleanName;
    } else if (formSchoolType === SchoolType.PROFESSIONAL) {
      cleanName = cleanName.replace(/^(certificat|dipl[ôo]me)\s*\d*\s*[-:]?\s*/i, '').trim() || cleanName;
    }

    // Vérifier l'existence pour éviter la redondance
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

    // Construction du payload avec les noms de colonnes exacts de la DB
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
          // Auto-bind existing school subjects with standard coefficients for this class
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
        // Gestion spécifique de l'erreur de cache Supabase
        if (error.message.includes('column') || error.code === 'PGRST204') {
          throw new Error("Erreur de synchronisation base de données. Veuillez exécuter le script fix_classes_schema.sql dans votre éditeur Supabase.");
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

  const classicPresets = [
    { label: "1ère AF", full: "1ère Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "2e AF", full: "2ème Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "3e AF", full: "3ème Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "7e AF", full: "7ème Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "9e AF", full: "9ème Année AF", level: SchoolLevel.FONDAMENTALE },
    { label: "NS1 (Seconde)", full: "Nouveau Secondaire I (NS1)", level: SchoolLevel.SECONDAIRE },
    { label: "NS2 (Première)", full: "Nouveau Secondaire II (NS2)", level: SchoolLevel.SECONDAIRE },
    { label: "NS4 (Philo)", full: "Nouveau Secondaire IV (NS4)", level: SchoolLevel.SECONDAIRE },
    { label: "Petite Section", full: "Petite Section", level: SchoolLevel.MATERNELLE },
    { label: "Grande Section", full: "Grande Section", level: SchoolLevel.MATERNELLE },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-5 animate-in fade-in duration-300 pb-12">
      {/* Compact Modern Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/classes')} 
            className="p-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-200/80 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-2xs group shrink-0 cursor-pointer"
            title={`Retour aux ${terminology.classes.toLowerCase()}`}
          >
            <ArrowLeft size={17} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50/80 text-blue-600 rounded-xl flex items-center justify-center shadow-2xs border border-blue-100/80 shrink-0">
              <School size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  {isEdit ? `Modifier la ${terminology.class}` : `Nouvelle ${terminology.class}`}
                </h2>
                {!isEdit && (
                  <span className="text-[10px] uppercase font-extrabold tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200/60">
                    {activeCategory === SchoolType.UNIVERSITY ? 'Universitaire' : activeCategory === SchoolType.PROFESSIONAL ? 'Professionnelle' : 'Général'}
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs font-medium">
                {isEdit ? `Configuration et paramètres pédagogiques de la structure` : `Paramétrage de la ${terminology.class.toLowerCase()} pour votre établissement`}
              </p>
            </div>
          </div>
        </div>

        {/* Category Selector Tabs if creating */}
        {!isEdit && (
          <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/70 text-xs font-semibold self-start sm:self-auto shrink-0">
            {(!school || school.school_type === 'CLASSIC') && (
              <button
                type="button"
                onClick={() => setActiveCategory(SchoolType.CLASSIC)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeCategory === SchoolType.CLASSIC 
                    ? 'bg-white text-blue-700 shadow-2xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Général
              </button>
            )}
            {(!school || school.school_type === 'UNIVERSITY' || school.school_type === 'PROFESSIONAL') && (
              <>
                {(!school || school.school_type === 'UNIVERSITY') && (
                  <button
                    type="button"
                    onClick={() => setActiveCategory(SchoolType.UNIVERSITY)}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeCategory === SchoolType.UNIVERSITY 
                        ? 'bg-white text-blue-700 shadow-2xs font-bold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Universitaire
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveCategory(SchoolType.PROFESSIONAL)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeCategory === SchoolType.PROFESSIONAL 
                      ? 'bg-white text-blue-700 shadow-2xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Professionnelle
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {apiError && (
        <div className="bg-rose-50 border border-rose-200/80 p-3.5 rounded-xl flex items-start gap-2.5 text-rose-800 shadow-2xs animate-in fade-in">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
          <div className="space-y-0.5">
             <p className="text-xs font-bold uppercase tracking-wider text-rose-900">Avertissement de validation</p>
             <p className="text-xs font-medium">{apiError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
        {/* Section 1: Information principale & Cycle */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Identité & Cycle Académique</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">* Obligatoire</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Disciplines Standard for Uni/Pro */}
            {formSchoolType !== SchoolType.CLASSIC && useStandardSelector ? (
              <div className="md:col-span-2 p-3.5 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 rounded-xl border border-blue-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-blue-950 uppercase tracking-wide">Filière / Discipline Standard</label>
                    <select 
                      value={selectedStandardDiscipline}
                      onChange={(e) => setSelectedStandardDiscipline(e.target.value)}
                      className="w-full px-3 py-2 bg-white text-slate-900 border border-blue-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-2xs cursor-pointer"
                    >
                      {(formSchoolType === SchoolType.UNIVERSITY ? standardUniversityDisciplines : standardProfessionalDisciplines).map(d => (
                        <option key={d.name} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-blue-950 uppercase tracking-wide">Niveau / Promotion</label>
                    <div className="flex flex-wrap gap-1">
                      {['I', 'II', 'III', 'IV', 'V', 'VI'].slice(0, 
                        (formSchoolType === SchoolType.UNIVERSITY ? standardUniversityDisciplines : standardProfessionalDisciplines)
                          .find(d => d.name === selectedStandardDiscipline)?.duration || 4
                      ).map(year => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => setSelectedStandardYear(year)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            selectedStandardYear === year
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Année {year}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-between items-center pt-2 border-t border-blue-100/80 gap-2">
                  <span className="text-[11px] font-extrabold text-blue-900 bg-blue-100/70 px-2.5 py-0.5 rounded-md">
                    Format généré : <strong>{formData.name}</strong> ({formData.duration})
                  </span>
                  <button 
                    type="button"
                    onClick={() => {
                      setUseStandardSelector(false);
                      setFormData(prev => ({ ...prev, name: '' }));
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Saisir un intitulé personnalisé</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 md:col-span-1">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Intitulé de la {terminology.class.toLowerCase()} <span className="text-rose-500">*</span>
                  </label>
                  {formSchoolType !== SchoolType.CLASSIC && (
                    <button 
                      type="button"
                      onClick={() => setUseStandardSelector(true)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                    >
                      Catalogue standard
                    </button>
                  )}
                </div>

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
                    placeholder={formSchoolType !== SchoolType.CLASSIC ? "Ex: Génie Logiciel I" : "Ex: 1ère Année AF, NS1"} 
                  />
                </div>

                {isNameDuplicate && (
                  <p className="text-[11px] text-amber-700 font-medium ml-1 flex items-center gap-1">
                    <AlertCircle size={13} /> Cette {terminology.class.toLowerCase()} existe déjà dans ce cycle.
                  </p>
                )}

                {/* Quick Presets for Classic Schools */}
                {formSchoolType === SchoolType.CLASSIC && !isEdit && (
                  <div className="pt-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1">
                      <Sparkles size={11} className="text-amber-500" />
                      Raccourcis prédéfinis :
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {classicPresets.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              name: preset.full,
                              level: preset.level
                            }));
                          }}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                            formData.name === preset.full
                              ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-2xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cycle / Niveau Selector */}
            <div className="space-y-1.5 md:col-span-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Cycle & Degré Académique</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {formSchoolType === SchoolType.UNIVERSITY ? (
                  [
                    { value: SchoolLevel.DIPLOME, label: 'Diplôme' },
                    { value: SchoolLevel.LICENCE, label: 'Licence' }
                  ].map(lvl => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setFormData({...formData, level: lvl.value})}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                        formData.level === lvl.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50/70 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))
                ) : formSchoolType === SchoolType.PROFESSIONAL ? (
                  [
                    { value: SchoolLevel.CERTIFICAT, label: 'Certificat' },
                    { value: SchoolLevel.DIPLOME, label: 'Diplôme' }
                  ].map(lvl => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setFormData({...formData, level: lvl.value})}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                        formData.level === lvl.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50/70 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))
                ) : (
                  [
                    { value: SchoolLevel.MATERNELLE, label: 'Maternelle', icon: '👶' },
                    { value: SchoolLevel.FONDAMENTALE, label: 'Fondamentale', icon: '📚' },
                    { value: SchoolLevel.SECONDAIRE, label: 'Secondaire', icon: '🎓' }
                  ].map(lvl => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setFormData({...formData, level: lvl.value})}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all border text-center flex items-center justify-center gap-1 cursor-pointer ${
                        formData.level === lvl.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50/70 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{lvl.icon}</span>
                      <span>{lvl.label}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Attribution, Salle & Campus */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-3.5">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Attribution, Salle & Localisation</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {formSchoolType === SchoolType.UNIVERSITY ? "Responsable de Promotion" : "Titulaire / Responsable"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserCheck size={15} />
                </div>
                <input 
                  type="text" 
                  className="w-full pl-9 pr-3 py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all shadow-2xs placeholder:text-slate-400 outline-none" 
                  value={formData.teacher} 
                  onChange={(e) => setFormData({...formData, teacher: e.target.value})} 
                  placeholder="Ex: Prof. Marie Jean" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Local / Salle de Classe</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building2 size={15} />
                </div>
                <input 
                  type="text" 
                  className="w-full pl-9 pr-3 py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all shadow-2xs placeholder:text-slate-400 outline-none" 
                  value={formData.room} 
                  onChange={(e) => setFormData({...formData, room: e.target.value})} 
                  placeholder="Ex: Bâtiment A, Salle 203" 
                />
              </div>
            </div>

            {campuses && campuses.length > 1 && !user.campus_id && (
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <MapPin size={13} className="text-blue-600" />
                  Campus / Annexe d'Attache
                </label>
                <select
                  value={formData.campus_id}
                  onChange={(e) => setFormData({...formData, campus_id: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all outline-none cursor-pointer shadow-2xs"
                >
                  <option value="" className="text-slate-500">🌍 Réseau complet (Tous les campus)</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>📍 {c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Extra options for University/Pro */}
        {formSchoolType !== SchoolType.CLASSIC && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-3.5">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Paramètres Pédagogiques du Cursus</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Durée Globale</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all shadow-2xs outline-none" 
                  value={formData.duration} 
                  onChange={(e) => setFormData({...formData, duration: e.target.value})} 
                  placeholder="ex: 4 ans / 8 semestres" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Format d'Évaluation</label>
                <select 
                  className="w-full px-3 py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all outline-none cursor-pointer shadow-2xs" 
                  value={formData.periodFormat} 
                  onChange={(e) => setFormData({...formData, periodFormat: e.target.value})}
                >
                  <option value="CONTROLE">Séquentiel (Nème Contrôle)</option>
                  <option value="SEMESTRE_INTRA">Semestres (Intra / Final)</option>
                  <option value="SEMESTRE">Semestres (S1 / S2)</option>
                  <option value="TRIMESTRE">Trimestres (T1 / T2 / T3)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Nb. d'Examens / An</label>
                <input 
                  type="number" 
                  min={1} 
                  max={10} 
                  className="w-full px-3 py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all shadow-2xs outline-none" 
                  value={formData.examsCount} 
                  onChange={(e) => setFormData({...formData, examsCount: parseInt(e.target.value) || 4})} 
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Notes & Consignes */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Consignes & Notes Administratives</h3>
          </div>

          <div className="relative">
            <textarea 
              rows={2} 
              className="w-full p-3 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all resize-none shadow-2xs placeholder:text-slate-400 outline-none" 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})} 
              placeholder="Inscrivez d'éventuelles directives administratives ou pédagogiques pour cette classe..." 
            />
          </div>
        </div>

        {/* Submit Actions Bar */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button 
            type="button" 
            onClick={() => navigate('/classes')} 
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs cursor-pointer"
          >
            Annuler
          </button>

          <button 
            disabled={isSubmitting || isNameDuplicate} 
            type="submit" 
            className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs hover:bg-blue-600 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group/btn cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Save size={15} className="group-hover/btn:scale-110 transition-transform" />
            )}
            <span>{isEdit ? `Enregistrer les modifications` : `Créer la ${terminology.class.toLowerCase()}`}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClassForm;
