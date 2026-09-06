import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { SchoolClass, Subject, ClassSubject, UserProfile } from '../types';
import { Search, MapPin, Upload, BookOpen, Clock, Tag, ArrowLeft, Save, Plus, Trash2, Layers, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuditLogger } from '../utils/auditLogger';
import { formatActionWithTerminology } from '../utils/formatters';
import { getCollegeInnovationsDefaultCoefficient } from './ClassManagement';
import { useSchool } from '../contexts/SchoolContext';

const ClassSubjectManager: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { terminology } = useSchool();
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schoolClass, setSchoolClass] = useState<SchoolClass | null>(null);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [associations, setAssociations] = useState<ClassSubject[]>([]);
  
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch class
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('*')
          .eq('id', id)
          .eq('school_id', user.school_id)
          .single();
          
        if (classError) throw classError;
        setSchoolClass(classData);

        // 2. Fetch all subjects
        let subQuery = supabase.from('subjects').select('*');
        if (user.school_id) {
          subQuery = subQuery.or(`school_id.eq.${user.school_id},school_id.is.null`);
        }
        const { data: subjectsData, error: subjectsError } = await subQuery.order('name');
          
        if (subjectsError) throw subjectsError;
        setAllSubjects(subjectsData || []);

        // 3. Fetch existing associations
        const { data: assocData, error: assocError } = await supabase
          .from('class_subjects')
          .select('*, subject:subjects(*)')
          .eq('class_id', id);
          
        if (assocError) throw assocError;

        const resolvedAssoc = (assocData || []).map(a => {
          const subjFromJoin = Array.isArray(a.subject) ? a.subject[0] : a.subject;
          const fallbackSubj = subjFromJoin || subjectsData?.find((s: any) => s.id === a.subject_id);
          return {
            ...a,
            subject: fallbackSubj || { id: a.subject_id, name: 'Matière', code: '' }
          };
        });

        setAssociations(resolvedAssoc);

      } catch (err: any) {
        console.error("Error fetching data:", err);
        setNotification({ type: 'error', message: "Erreur lors du chargement des données." });
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, user.school_id]);

  const handleAddSubject = (subjectId: string) => {
    if (!subjectId) return;
    
    // Check if already added
    if (associations.some(a => a.subject_id === subjectId)) return;
    
    const subject = allSubjects.find(s => s.id === subjectId);
    if (!subject) return;

    const defaultCoef = getCollegeInnovationsDefaultCoefficient(schoolClass?.level || '', subject.code);

    const newAssoc: ClassSubject = {
      id: `temp-${Date.now()}`,
      class_id: id!,
      subject_id: subjectId,
      coefficient: defaultCoef,
      subject: subject
    };

    setAssociations([...associations, newAssoc]);
  };

  const handleRemoveSubject = (assocId: string) => {
    setAssociations(associations.filter(a => a.id !== assocId));
  };

  const handleCoefChange = (assocId: string, coef: number) => {
    setAssociations(associations.map(a => 
      a.id === assocId ? { ...a, coefficient: coef } : a
    ));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setNotification(null);
    try {
      // 1. Get current associations from DB to know what to delete
      const { data: currentAssoc } = await supabase
        .from('class_subjects')
        .select('id')
        .eq('class_id', id);
        
      const currentIds = currentAssoc?.map(a => a.id) || [];
      const newIds = associations.filter(a => !a.id.startsWith('temp-')).map(a => a.id);
      
      const idsToDelete = currentIds.filter(id => !newIds.includes(id));
      
      // 2. Delete removed associations
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('class_subjects')
          .delete()
          .in('id', idsToDelete)
          .eq('school_id', user.school_id);
        if (deleteError) throw deleteError;
      }

      // 3. Upsert remaining/new associations
      const upsertPayload = associations.map(a => ({
        ...(a.id.startsWith('temp-') ? {} : { id: a.id }),
        class_id: a.class_id,
        subject_id: a.subject_id,
        coefficient: a.coefficient,
        school_id: user.school_id
      }));

      if (upsertPayload.length > 0) {
        const { error: upsertError } = await supabase
          .from('class_subjects')
          .upsert(upsertPayload, { onConflict: 'class_id,subject_id' });
        if (upsertError) throw upsertError;
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'class',
        entity_id: id,
        details: { message: 'Updated class subjects and coefficients' }
      });

      setNotification({ type: 'success', message: 'Matières et coefficients mis à jour avec succès !' });
      
      // Refresh associations to get real IDs for temp ones
      const { data: refreshedAssoc } = await supabase
        .from('class_subjects')
        .select('*, subject:subjects(*)')
        .eq('class_id', id);
      if (refreshedAssoc) setAssociations(refreshedAssoc);

    } catch (err: any) {
      console.error("Save error:", err);
      setNotification({ type: 'error', message: err.message || "Erreur lors de l'enregistrement." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (!schoolClass) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800">{terminology.class} introuvable</h2>
        <button onClick={() => navigate('/classes')} className="mt-4 text-blue-600 hover:underline">
          Retour aux {terminology.classes.toLowerCase()}
        </button>
      </div>
    );
  }

  const availableSubjectsToAdd = allSubjects.filter(s => !associations.some(a => a.subject_id === s.id));

  const totalCoefficient = associations.reduce((sum, a) => sum + (Number(a.coefficient) || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5 animate-in fade-in duration-300 pb-12">
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
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Programme Académique
                </h2>
                <span className="text-[11px] font-extrabold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                  {schoolClass.name}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {schoolClass.level}
                </span>
              </div>
              <p className="text-slate-500 text-xs font-medium">
                Pondération et barèmes des {terminology.subjects.toLowerCase()} pour le calcul des moyennes
              </p>
            </div>
          </div>
        </div>

        {associations.length > 0 && (
          <div className="self-start sm:self-auto flex items-center gap-2">
            <div className="px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-600 flex items-center gap-2">
              <span>Matières : <strong className="text-slate-900">{associations.length}</strong></span>
              <span className="text-slate-300">•</span>
              <span>Total Coef : <strong className="text-blue-700">{totalCoefficient}</strong></span>
            </div>
          </div>
        )}
      </div>

      {notification && (
        <div className={`p-3.5 rounded-xl flex items-center gap-2.5 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80' : 'bg-rose-50 text-rose-800 border border-rose-200/80'} shadow-2xs animate-in fade-in`}>
          {notification.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" /> : <AlertCircle size={18} className="shrink-0 text-rose-600" />}
          <p className="font-medium text-xs sm:text-sm">{notification.message}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden space-y-0">
        {/* Card Header Toolbar */}
        <div className="p-3.5 sm:p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {terminology.subjects} & Coefficients Associés
            </h3>
          </div>
          
          <div className="w-full sm:w-72">
            <select 
              className="w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-900 outline-none shadow-2xs border border-slate-200/90 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition-all cursor-pointer bg-white"
              onChange={(e) => {
                handleAddSubject(e.target.value);
                e.target.value = "";
              }}
              defaultValue=""
            >
              <option value="" disabled>+ Assigner une {terminology.subject.toLowerCase()}...</option>
              {availableSubjectsToAdd.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Card Content Table / Cards */}
        <div className="p-3.5 sm:p-4">
          {associations.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center">
              <BookOpen size={32} className="text-slate-300 mb-2" />
              <p className="text-slate-600 font-bold text-xs sm:text-sm">Aucune {terminology.subject.toLowerCase()} assignée à cette {terminology.class.toLowerCase()}</p>
              <p className="text-slate-400 text-xs mt-0.5">Utilisez le menu déroulant ci-dessus pour ajouter des {terminology.subjects.toLowerCase()}.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header row on desktop */}
              <div className="hidden sm:grid grid-cols-12 gap-3 px-3 py-2 bg-slate-100/70 text-slate-600 rounded-xl text-[11px] font-bold uppercase tracking-wider">
                <div className="col-span-5">{terminology.subject}</div>
                <div className="col-span-2 text-center">Code</div>
                <div className="col-span-4 text-center">Coefficient Pondéré</div>
                <div className="col-span-1 text-right">Action</div>
              </div>
              
              {associations.map((assoc) => (
                <div 
                  key={assoc.id} 
                  className="flex flex-col sm:grid sm:grid-cols-12 gap-2.5 sm:gap-3 sm:items-center p-3 sm:px-3 sm:py-2.5 bg-white rounded-xl border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/30 transition-all shadow-2xs group"
                >
                  <div className="sm:col-span-5 flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100 text-blue-700 font-bold text-xs shrink-0">
                      {assoc.subject?.name?.charAt(0) || 'M'}
                    </div>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">{assoc.subject?.name}</span>
                  </div>
                  
                  <div className="sm:col-span-2 flex sm:justify-center items-center">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold rounded-md text-[11px] border border-slate-200">
                      {assoc.subject?.code}
                    </span>
                  </div>
                  
                  <div className="sm:col-span-4 flex items-center justify-between sm:justify-center gap-2">
                    <span className="text-xs text-slate-500 font-medium sm:hidden">Coefficient :</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        {[100, 200, 300].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleCoefChange(assoc.id, preset)}
                            className={`px-1.5 py-0.5 text-[9px] font-black rounded transition-all cursor-pointer ${
                              assoc.coefficient === preset ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
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
                        className="w-16 sm:w-20 px-2 py-1 text-center font-bold text-blue-700 bg-white border border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all shadow-2xs text-xs"
                        value={assoc.coefficient}
                        onChange={(e) => handleCoefChange(assoc.id, parseFloat(e.target.value) || 1)}
                      />
                    </div>

                    <button 
                      onClick={() => handleRemoveSubject(assoc.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer sm:hidden"
                      title={formatActionWithTerminology('REMOVE', terminology.subject)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  
                  <div className="hidden sm:flex col-span-1 justify-end">
                    <button 
                      onClick={() => handleRemoveSubject(assoc.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title={formatActionWithTerminology('REMOVE', terminology.subject)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Card Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50/70 border-t border-slate-200/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/classes')}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs cursor-pointer"
          >
            Retour aux {terminology.classes.toLowerCase()}
          </button>

          <button 
            onClick={handleSave}
            disabled={isSubmitting}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-xs hover:bg-blue-600 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>Enregistrer les coefficients</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassSubjectManager;
