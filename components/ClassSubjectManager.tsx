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

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/classes')} className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Programme Académique</h2>
          <p className="text-gray-500 font-medium text-sm mt-1">{terminology.class} : <span className="text-blue-600">{schoolClass.name}</span> ({schoolClass.level})</p>
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl flex items-center gap-3 mb-6 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="font-medium text-sm">{notification.message}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 bg-gray-50 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{terminology.subjects} & Coefficients</h3>
              <p className="text-sm font-medium text-gray-500 mt-0.5">Définissez le poids de chaque {terminology.subject.toLowerCase()} pour le calcul des moyennes</p>
            </div>
          </div>
          
          <div className="flex-1 max-w-xs">
            <select 
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-gray-900 outline-none shadow-sm border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer bg-white"
              onChange={(e) => {
                handleAddSubject(e.target.value);
                e.target.value = "";
              }}
              defaultValue=""
            >
              <option value="" disabled>+ Ajouter un(e) {terminology.subject.toLowerCase()}...</option>
              {availableSubjectsToAdd.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-6">
          {associations.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center">
              <BookOpen size={40} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-semibold text-sm">Aucun(e) {terminology.subject.toLowerCase()} assigné(e) à {terminology.class.toLowerCase()}</p>
              <p className="text-gray-400 text-xs mt-1">Utilisez le menu déroulant ci-dessus pour ajouter des {terminology.subjects.toLowerCase()}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold uppercase tracking-wider">
                <div className="col-span-6 md:col-span-5">{terminology.subject}</div>
                <div className="col-span-3 md:col-span-3 text-center">Code</div>
                <div className="col-span-3 md:col-span-3 text-center">Coefficient</div>
                <div className="col-span-12 md:col-span-1 text-right hidden md:block">Action</div>
              </div>
              
              {associations.map((assoc) => (
                <div key={assoc.id} className="grid grid-cols-12 gap-4 items-center px-4 py-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors group">
                  <div className="col-span-12 md:col-span-5 flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-50 rounded-md flex items-center justify-center border border-gray-200 text-blue-600 font-bold text-xs">
                      {assoc.subject?.name.charAt(0)}
                    </div>
                    <span className="font-medium text-gray-900 text-sm">{assoc.subject?.name}</span>
                  </div>
                  
                  <div className="col-span-4 md:col-span-3 text-center">
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                      {assoc.subject?.code}
                    </span>
                  </div>
                  
                  <div className="col-span-6 md:col-span-3 flex items-center justify-center gap-1.5">
                    <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      {[100, 200, 300].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleCoefChange(assoc.id, preset)}
                          className={`px-1.5 py-0.5 text-[10px] font-black rounded transition-all cursor-pointer ${assoc.coefficient === preset ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
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
                      className="w-24 px-3 py-1.5 text-center font-bold text-blue-700 bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
                      value={assoc.coefficient}
                      onChange={(e) => handleCoefChange(assoc.id, parseFloat(e.target.value) || 1)}
                    />
                  </div>
                  
                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <button 
                      onClick={() => handleRemoveSubject(assoc.id)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                      title={formatActionWithTerminology('REMOVE', terminology.subject)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium text-sm shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Enregistrer les modifications
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassSubjectManager;
