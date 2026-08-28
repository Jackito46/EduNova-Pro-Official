
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/classes')} className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? `Modifier : ${terminology.subject}` : `Créer : ${terminology.subject}`}
          </h2>
          <p className="text-gray-500 font-medium text-sm mt-1">
            Catalogue Académique • {user.school_id}
          </p>
        </div>
      </div>

      {apiError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 text-rose-700 animate-in shake">
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
             <p className="text-sm font-medium">Une erreur est survenue :</p>
             <p className="text-sm opacity-90">{apiError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 space-y-10">
          
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
               <div className="flex items-center gap-2">
                 <BookOpen size={18} className="text-indigo-600" />
                 <h3 className="font-semibold text-gray-900 text-lg">Informations Globales</h3>
               </div>
               {formData.name && (
                 <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-lg">
                   Code Système : {formData.code || generateCode(formData.name) || 'AUTO'}
                 </span>
               )}
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-800 ml-1">
                  Intitulé {terminology.subject.toLowerCase()} <span className="text-rose-500">*</span>
                </label>
                <input 
                  required 
                  type="text" 
                  placeholder="Ex: Mathématiques, Communication Française..."
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-base font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-2xs" 
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

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-800 ml-1">Description / Objectifs Pédagogiques</label>
                <textarea 
                  rows={2}
                  placeholder="Détails optionnels, objectifs d'apprentissage ou spécificités..."
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-2xs resize-none" 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
               <Layers size={18} className="text-indigo-600" />
               <h3 className="font-semibold text-gray-900 text-lg">Assignations & Coefficients</h3>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-6">
               <div className="flex justify-between items-center bg-white p-2 border border-gray-200 rounded-lg shadow-sm">
                 <div className="flex gap-2 flex-1 overflow-x-auto custom-scrollbar pr-2">
                   {availableTabs.map((tab) => (
                     <button
                       key={tab}
                       type="button"
                       onClick={() => setAcademicTab(tab)}
                       className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                         academicTab === tab ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-50'
                       }`}
                     >
                       {tab}
                     </button>
                   ))}
                 </div>
                 <div className="pl-4 border-l border-gray-200 text-center min-w-[100px]">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sélectionnées</p>
                    <p className="text-xl font-bold text-indigo-600">{associations.length}</p>
                 </div>
               </div>

               {['Universitaire', 'Professionnelle'].includes(academicTab) && (
                 <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto custom-scrollbar">
                   {['Tous', ...Object.keys(getGroupedClasses(availableClasses, academicTab) || {})].map((tab) => (
                     <button
                       key={tab}
                       type="button"
                       onClick={() => setCycleTab(tab)}
                       className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                         cycleTab === tab ? 'bg-gray-800 text-white font-medium' : 'bg-white border text-gray-600 hover:bg-gray-100'
                       }`}
                     >
                       {tab.replace('Cycle: ', '')}
                     </button>
                   ))}
                 </div>
               )}

               <div className="space-y-6">
                 {Object.entries(getGroupedClasses(availableClasses, academicTab))
                   .filter(([groupName]) => cycleTab === 'Tous' || cycleTab === groupName)
                   .map(([groupName, groupClasses]) => {
                     if (groupClasses.length === 0) return null;
                     return (
                       <div key={groupName} className="space-y-3">
                         <h4 className="text-sm font-bold text-gray-700 border-b border-gray-200 pb-1">{groupName}</h4>
                         <div className="flex flex-wrap gap-2">
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
                                 className={`px-3 py-1.5 text-sm font-medium rounded border transition-colors ${
                                   isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400 hover:bg-indigo-50'
                                 }`}
                               >
                                 {isSelected && <CheckCircle2 size={14} className="inline mr-1.5 -mt-0.5" />}
                                 {c.name}
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
                     <div className="py-8 text-center text-gray-500 text-sm">
                       Aucun(e) {terminology.class.toLowerCase()} trouvé(e) pour ce filtre.
                     </div>
                 )}
               </div>
            </div>

            {associations.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {associations.map((assoc) => (
                  <div key={assoc.classId} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-all animate-in zoom-in group">
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{assoc.className}</span>
                      <p className="text-xs text-gray-500 mt-0.5">Coefficient de calcul</p>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                      <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                        {[100, 200, 300].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleCoefChange(assoc.classId, preset)}
                            className={`px-2 py-0.5 text-[10px] font-black rounded transition-all cursor-pointer ${assoc.coefficient === preset ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'}`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="0.5" 
                          max="500"
                          step="0.5"
                          className="w-24 px-3 py-1.5 rounded-lg text-center font-bold text-gray-900 bg-white border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm text-sm" 
                          value={Number.isNaN(assoc.coefficient) ? '' : assoc.coefficient} 
                          onChange={(e) => {
                            const val = e.target.value;
                            handleCoefChange(assoc.classId, val === '' ? NaN : parseFloat(val));
                          }} 
                        />
                        <button 
                          type="button" 
                          onClick={() => handleRemoveAssociation(assoc.classId)} 
                          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Retirer l'assignation"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {associations.length === 0 && (
              <div className="md:col-span-2 py-12 text-center border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm">
                Aucune assignation configurée. Sélectionnez un(e) {terminology.class.toLowerCase()} ci-dessus pour l'ajouter.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-6 gap-3 border-t border-gray-100">
            <button 
              type="button" 
              onClick={() => navigate('/classes')} 
              className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button 
              disabled={isSubmitting} 
              type="submit" 
              className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {formatActionWithTerminology(isEdit ? 'UPDATE' : 'CREATE', terminology.subject)}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SubjectForm;
