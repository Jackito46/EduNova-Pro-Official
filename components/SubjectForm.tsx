
import React, { useState, useEffect } from 'react';
import { Save, BookOpen, Plus, Trash2, ArrowLeft, Layers, Hash, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { SchoolClass, UserProfile } from '../types';
import { AuditLogger } from '../utils/auditLogger';
import { formatActionWithTerminology } from '../utils/formatters';
import { getCollegeInnovationsDefaultCoefficient } from './ClassManagement';

import { useSchool } from '../contexts/SchoolContext';

interface ClassAssociation {
  classId: string;
  className: string;
  coefficient: number;
}

const SubjectForm: React.FC<{ user: UserProfile }> = ({ user }) => {
  const navigate = useNavigate();
  const { terminology } = useSchool();
  const [searchParams] = useSearchParams();
  const subjectIdParam = searchParams.get('id');
  const isEdit = !!subjectIdParam;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<SchoolClass[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: ''
  });

  const [academicTab, setAcademicTab] = useState<string>('Tous les cycles');
  const [cycleTab, setCycleTab] = useState<string>('Tous');

  const { school } = useSchool();

  useEffect(() => {
    if (school?.school_type === 'UNIVERSITY' && !['Universitaire', 'Professionnelle'].includes(academicTab)) {
      setAcademicTab('Universitaire');
    } else if (school?.school_type === 'PROFESSIONAL' && academicTab !== 'Professionnelle') {
      setAcademicTab('Professionnelle');
    } else if (school?.school_type === 'CLASSIC' && !['Tous les cycles', 'Maternelle', 'Fondamentale', 'Secondaire'].includes(academicTab)) {
      setAcademicTab('Tous les cycles');
    }
  }, [school?.school_type, academicTab]);

  useEffect(() => {
    setCycleTab('Tous');
  }, [academicTab]);

  const availableTabs = React.useMemo(() => {
    if (school?.school_type === 'UNIVERSITY') {
      return ['Universitaire', 'Professionnelle'];
    } else if (school?.school_type === 'PROFESSIONAL') {
      return ['Professionnelle'];
    } else {
      return ['Tous les cycles', 'Maternelle', 'Fondamentale', 'Secondaire'];
    }
  }, [school?.school_type]);

  const getGroupedClasses = React.useCallback((list: SchoolClass[], tab: string) => {
    if (tab === 'Universitaire') {
      return {
        'Cycle: Diplôme': list.filter(c => c.level === 'DIPLOME' || c.level === 'DIPLÔME'),
        'Cycle: Licence': list.filter(c => c.level === 'LICENCE'),
        'Cycle: Master': list.filter(c => c.level === 'MASTER'),
      };
    } else if (tab === 'Professionnelle') {
      return {
        'Cycle: Certificat': list.filter(c => c.level === 'CERTIFICAT'),
        'Cycle: Diplôme': list.filter(c => c.level === 'DIPLOME' || c.level === 'DIPLÔME'),
      };
    } else if (tab === 'Maternelle') {
       return {
         'Préscolaire (Maternelle)': list.filter(c => c.level === 'MATERNELLE'),
       };
    } else if (tab === 'Fondamentale') {
       return {
         'Fondamentale': list.filter(c => c.level === 'FONDAMENTALE'),
       };
    } else if (tab === 'Secondaire') {
       return {
         'Secondaire': list.filter(c => c.level === 'SECONDAIRE'),
       };
    } else if (tab === 'Tous les cycles') {
       return {
         'Maternelle': list.filter(c => c.level === 'MATERNELLE'),
         'Fondamentale': list.filter(c => c.level === 'FONDAMENTALE'),
         'Secondaire': list.filter(c => c.level === 'SECONDAIRE'),
         'Autres': list.filter(c => !['MATERNELLE', 'FONDAMENTALE', 'SECONDAIRE', 'LICENCE', 'MASTER', 'DOCTORAT', 'CERTIFICAT', 'DIPLOME'].includes(c.level))
       };
    }
    return {};
  }, []);

  // Helper to auto-generate a subject code
  const generateCode = (name: string) => {
    if (!name) return '';
    const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const words = cleanName.trim().split(/\s+/);
    
    if (words.length === 1) {
      return words[0].substring(0, 4).toUpperCase();
    } else {
      const stopWords = ['de', 'la', 'le', 'les', 'des', 'et', 'en', 'du', 'au', 'aux', 'd'];
      const initials = words
        .filter(w => !stopWords.includes(w.toLowerCase()) && w.length > 0)
        .map(w => w[0])
        .join('');
      
      if (initials.length < 2) {
         return cleanName.substring(0, 4).toUpperCase().replace(/\s/g, '');
      }
      return initials.substring(0, 4).toUpperCase();
    }
  };

  const [associations, setAssociations] = useState<ClassAssociation[]>([]);

  useEffect(() => {
    const initForm = async () => {
      setLoading(true);
      try {
        const mySchool = user.school_id;

        // 1. Charger les classes de l'école
        const { data: classesData } = await supabase
          .from('classes')
          .select('*')
          .eq('school_id', mySchool)
          .order('name');
        
        if (classesData) setAvailableClasses(classesData);

        // 2. Si édition, charger la matière et ses coefficients
        if (isEdit && subjectIdParam) {
          const { data: subData, error: subError } = await supabase
            .from('subjects')
            .select('*')
            .eq('id', subjectIdParam)
            .eq('school_id', mySchool)
            .single();
          
          if (subError) throw subError;

          if (subData) {
            setFormData({ 
              name: subData.name, 
              code: subData.code, 
              description: subData.description || '' 
            });
            
            const { data: assocData } = await supabase
              .from('class_subjects')
              .select('*, class:classes(name)')
              .eq('subject_id', subjectIdParam)
              .eq('school_id', mySchool);

            if (assocData) {
              setAssociations(assocData.map((a: any) => ({
                classId: a.class_id,
                className: a.class?.name || 'Classe Inconnue',
                coefficient: a.coefficient
              })));
            }
          }
        }
      } catch (err: any) {
        console.error(err);
        setApiError("Erreur lors de l'initialisation : " + err.message);
      } finally {
        setLoading(false);
      }
    };
    initForm();
  }, [subjectIdParam, isEdit, user.school_id]);

  const handleAddAssociation = (classId: string) => {
    const cls = availableClasses.find(c => c.id === classId);
    if (cls && !associations.find(a => a.classId === classId)) {
      const defaultCoef = getCollegeInnovationsDefaultCoefficient(
        cls.level || '',
        formData.code || generateCode(formData.name)
      );
      setAssociations([...associations, { classId: cls.id, className: cls.name, coefficient: defaultCoef }]);
    }
  };

  const handleRemoveAssociation = (classId: string) => {
    setAssociations(associations.filter(a => a.classId !== classId));
  };

  const handleCoefChange = (classId: string, coef: number) => {
    setAssociations(associations.map(a => 
      a.classId === classId ? { ...a, coefficient: coef } : a
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const computedCode = (formData.code || generateCode(formData.name) || 'MAT').toUpperCase();
    if (!formData.name) {
      setApiError("L'intitulé de la matière est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const mySchool = user.school_id;
      let currentSubjectId = subjectIdParam;

      // 1. Enregistrer ou mettre à jour la matière globale
      const subPayload = { 
        school_id: mySchool, 
        name: formData.name.trim(), 
        code: computedCode, 
        description: formData.description 
      };

      if (isEdit && currentSubjectId) {
        const { error: updateError } = await supabase.from('subjects').update(subPayload).eq('id', currentSubjectId).eq('school_id', mySchool);
        if (updateError) throw updateError;
      } else {
        const { data: newData, error: insertError } = await supabase.from('subjects').insert([subPayload]).select().single();
        if (insertError) throw insertError;
        if (newData) currentSubjectId = newData.id;
      }

      // 2. Synchroniser les coefficients (Purge et Insertion)
      if (currentSubjectId) {
        // Purge des anciennes relations
        const { error: purgeError } = await supabase.from('class_subjects').delete().eq('subject_id', currentSubjectId).eq('school_id', mySchool);
        if (purgeError) throw purgeError;
        
        // Insertion des nouvelles relations
        if (associations.length > 0) {
          const assocPayload = associations.map(a => ({
            class_id: a.classId,
            subject_id: currentSubjectId,
            coefficient: a.coefficient,
            school_id: user.school_id
          }));
          const { error: assocError } = await supabase.from('class_subjects').insert(assocPayload);
          if (assocError) throw assocError;
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: isEdit ? 'UPDATE' : 'CREATE',
        entity_type: 'class', // Using class as entity type for subjects as they are part of school life
        entity_id: currentSubjectId || undefined,
        details: { type: 'subject', name: formData.name, code: formData.code }
      });

      navigate('/classes');
    } catch (err: any) {
      setApiError(err.message || "Erreur lors de la sauvegarde Cloud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-sm font-medium text-gray-500">Ouverture du dossier {terminology.subject.toLowerCase()}...</p>
      </div>
    );
  }

  const handleSelectAllInCycle = (classesInGroup: SchoolClass[]) => {
    const newAssocs = [...associations];
    classesInGroup.forEach(c => {
      if (!newAssocs.some(a => a.classId === c.id)) {
        const defaultCoef = getCollegeInnovationsDefaultCoefficient(
          c.level || '',
          formData.code || generateCode(formData.name)
        );
        newAssocs.push({ classId: c.id, className: c.name, coefficient: defaultCoef });
      }
    });
    setAssociations(newAssocs);
  };

  const handleDeselectAllInCycle = (classesInGroup: SchoolClass[]) => {
    const idsToRemove = new Set(classesInGroup.map(c => c.id));
    setAssociations(associations.filter(a => !idsToRemove.has(a.classId)));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3 sm:space-y-3.5 animate-in fade-in duration-300 pb-10">
      {/* Compact Modern Header */}
      <div className="bg-white rounded-xl p-3 sm:p-4 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2.5">
          <button 
            type="button"
            onClick={() => navigate('/classes')} 
            className="p-1.5 sm:p-2 bg-slate-50 text-slate-600 rounded-lg sm:rounded-xl border border-slate-200/80 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-2xs group shrink-0 cursor-pointer"
            title={`Retour aux ${terminology.classes.toLowerCase()}`}
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-50/80 text-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-2xs border border-indigo-100/80 shrink-0">
              <BookOpen size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {isEdit ? `Modifier la ${terminology.subject}` : `Nouvelle ${terminology.subject}`}
                </h2>
                {formData.code && (
                  <span className="text-[10px] uppercase font-extrabold tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200/60 font-mono">
                    {formData.code}
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-[11px] sm:text-xs font-medium">
                {isEdit ? `Ajustement du cours et des coefficients d'évaluation` : `Ajout au catalogue académique et assignation aux ${terminology.classes.toLowerCase()}`}
              </p>
            </div>
          </div>
        </div>

        {associations.length > 0 && (
          <div className="self-start sm:self-auto px-2.5 py-1 bg-indigo-50/70 border border-indigo-200/60 rounded-lg text-xs font-semibold text-indigo-800 flex items-center gap-1.5 shrink-0">
            <Layers size={13} className="text-indigo-600" />
            <span>{associations.length} {associations.length > 1 ? terminology.classes.toLowerCase() : terminology.class.toLowerCase()} assignée(s)</span>
          </div>
        )}
      </div>

      {apiError && (
        <div className="bg-rose-50 border border-rose-200/80 p-3 rounded-xl flex items-start gap-2 text-rose-800 shadow-2xs animate-in fade-in">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
          <div className="space-y-0.5">
             <p className="text-[11px] font-bold uppercase tracking-wider text-rose-900">Avertissement</p>
             <p className="text-xs font-medium">{apiError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
        {/* Section 1: Informations Générales */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Informations Globales</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-normal">* Champ obligatoire</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
            <div className="space-y-1 sm:col-span-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Intitulé de la {terminology.subject.toLowerCase()} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none text-slate-400">
                  <BookOpen size={15} />
                </div>
                <input 
                  required 
                  type="text" 
                  placeholder="Ex: Mathématiques, Communication Française, Chimie..."
                  className="w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 transition-all shadow-2xs outline-none placeholder:text-slate-400" 
                  value={formData.name} 
                  onChange={(e) => {
                    const newName = e.target.value;
                    setFormData(prev => {
                      const newData = { ...prev, name: newName };
                      if (!isEdit && !isCodeManuallyEdited) {
                        newData.code = generateCode(newName);
                      }
                      return newData;
                    });
                  }} 
                />
              </div>
            </div>

            <div className="space-y-1 sm:col-span-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Code Matière Système <span className="text-rose-500">*</span>
                </label>
                {!isEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCodeManuallyEdited(false);
                      setFormData(prev => ({ ...prev, code: generateCode(prev.name) }));
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    Auto-générer
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none text-slate-400">
                  <Hash size={15} />
                </div>
                <input 
                  required
                  type="text"
                  placeholder="Ex: MATH, FRANC, CHIM"
                  className="w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold font-mono tracking-wider focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 transition-all shadow-2xs outline-none placeholder:text-slate-400 uppercase"
                  value={formData.code}
                  onChange={(e) => {
                    setIsCodeManuallyEdited(true);
                    setFormData({ ...formData, code: e.target.value.toUpperCase() });
                  }}
                />
              </div>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Description & Objectifs Pédagogiques</label>
              <textarea 
                rows={2}
                placeholder="Détails optionnels, objectifs d'apprentissage ou spécificités du cours..."
                className="w-full p-2.5 sm:p-3 bg-slate-50/60 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 transition-all shadow-2xs resize-none outline-none placeholder:text-slate-400" 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
              />
            </div>
          </div>
        </div>

        {/* Section 2: Assignations & Coefficients */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Assignation aux {terminology.classes} & Coefficients</h3>
            </div>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              {associations.length} sélectionnée(s)
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Cycle Selector Bar */}
            <div className="flex flex-wrap gap-1 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 text-xs font-semibold">
              {availableTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAcademicTab(tab)}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    academicTab === tab 
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Sub-cycles if applicable */}
            {['Universitaire', 'Professionnelle'].includes(academicTab) && (
              <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
                {['Tous', ...Object.keys(getGroupedClasses(availableClasses, academicTab) || {})].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setCycleTab(tab)}
                    className={`px-2 py-0.5 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap font-medium ${
                      cycleTab === tab 
                        ? 'bg-slate-800 text-white font-bold shadow-2xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.replace('Cycle: ', '')}
                  </button>
                ))}
              </div>
            )}

            {/* Classes Grid */}
            <div className="p-2.5 sm:p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 space-y-2.5">
              {Object.entries(getGroupedClasses(availableClasses, academicTab))
                .filter(([groupName]) => cycleTab === 'Tous' || cycleTab === groupName)
                .map(([groupName, groupClasses]) => {
                  if (groupClasses.length === 0) return null;
                  const allSelected = groupClasses.every(c => associations.some(a => a.classId === c.id));
                  return (
                    <div key={groupName} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{groupName}</h4>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => allSelected ? handleDeselectAllInCycle(groupClasses) : handleSelectAllInCycle(groupClasses)}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline transition-colors cursor-pointer"
                          >
                            {allSelected ? "Tout décocher" : "Tout cocher"}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 sm:gap-1.5">
                        {groupClasses.map(c => {
                          const isSelected = associations.some(a => a.classId === c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) handleRemoveAssociation(c.id);
                                else handleAddAssociation(c.id);
                              }}
                              className={`px-2 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer flex items-center gap-1 ${
                                isSelected 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs' 
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                              }`}
                            >
                              {isSelected && <CheckCircle2 size={12} className="shrink-0" />}
                              <span>{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

              {Object.entries(getGroupedClasses(availableClasses, academicTab))
                .filter(([groupName]) => cycleTab === 'Tous' || cycleTab === groupName)
                .every(([_, g]) => g.length === 0) && (
                  <div className="py-4 text-center text-slate-400 text-xs font-medium">
                    Aucune {terminology.class.toLowerCase()} trouvée pour ce filtre.
                  </div>
              )}
            </div>

            {/* Coefficients editor */}
            {associations.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Configuration des Coefficients ({associations.length}) :
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {associations.map((assoc) => (
                    <div 
                      key={assoc.classId} 
                      className="flex items-center justify-between p-2 bg-slate-50/80 rounded-xl border border-slate-200/80 hover:border-indigo-300 transition-all shadow-2xs gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-900 truncate block">{assoc.className}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Coefficient</span>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200">
                          {[100, 200, 300].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleCoefChange(assoc.classId, preset)}
                              className={`px-1.5 py-0.5 text-[9px] font-black rounded transition-all cursor-pointer ${
                                assoc.coefficient === preset 
                                  ? 'bg-indigo-600 text-white shadow-2xs' 
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        <input 
                          type="number" 
                          min="0.5" 
                          max="500"
                          step="0.5"
                          className="w-14 sm:w-16 px-1.5 py-1 rounded-lg text-center font-bold text-slate-900 bg-white border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 outline-none transition-all shadow-2xs text-xs" 
                          value={Number.isNaN(assoc.coefficient) ? '' : assoc.coefficient} 
                          onChange={(e) => {
                            const val = e.target.value;
                            handleCoefChange(assoc.classId, val === '' ? NaN : parseFloat(val));
                          }} 
                        />

                        <button 
                          type="button" 
                          onClick={() => handleRemoveAssociation(assoc.classId)} 
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Retirer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-4 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-medium">
                Aucune {terminology.class.toLowerCase()} sélectionnée. Cliquez sur les étiquettes ci-dessus pour assigner cette {terminology.subject.toLowerCase()}.
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions Bar */}
        <div className="flex items-center justify-between gap-2.5 pt-1">
          <button 
            type="button" 
            onClick={() => navigate('/classes')} 
            className="px-3.5 sm:px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs cursor-pointer"
          >
            Annuler
          </button>

          <button 
            disabled={isSubmitting} 
            type="submit" 
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs hover:bg-indigo-600 transition-all flex items-center gap-2 disabled:opacity-50 group/btn cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Save size={14} className="group-hover/btn:scale-110 transition-transform" />
            )}
            <span>{formatActionWithTerminology(isEdit ? 'UPDATE' : 'CREATE', terminology.subject)}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default SubjectForm;
