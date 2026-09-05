import React, { useState, useEffect } from 'react';
import { 
  FileCheck2, CheckCircle2, Clock, XCircle, AlertTriangle, 
  ShieldCheck, Check, Save, Sparkles, RefreshCw, MessageSquare
} from 'lucide-react';
import Modal from './Modal';
import { DocumentStatus, UserProfile, UserRole } from '../types';
import { 
  getDocumentDefinitionsForSchoolType, 
  normalizeStudentDocuments,
  calculateDocumentsCompleteness,
  DocumentDefinition 
} from '../utils/documentRequirements';
import { supabase } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';
import { toast } from 'sonner';

import { useSchool } from '../contexts/SchoolContext';

interface StudentDocumentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  schoolType?: string | null;
  currentUser: UserProfile;
  onSuccess: (updatedDocs: any, updatedStatus?: string) => void;
}

export const StudentDocumentStatusModal: React.FC<StudentDocumentStatusModalProps> = ({
  isOpen,
  onClose,
  student,
  schoolType,
  currentUser,
  onSuccess
}) => {
  const { school, terminology } = useSchool();
  const [definitions, setDefinitions] = useState<DocumentDefinition[]>([]);
  const [docStates, setDocStates] = useState<Record<string, {
    status: DocumentStatus;
    notes: string;
  }>>({});
  const [syncStudentStatus, setSyncStudentStatus] = useState(true);
  const [targetStudentStatus, setTargetStudentStatus] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !student) return;

    const defs = getDocumentDefinitionsForSchoolType(schoolType || school?.school_type, school?.global_settings);
    setDefinitions(defs);

    const normalized = normalizeStudentDocuments(student.submitted_documents, schoolType || school?.school_type, school?.global_settings);
    const initialStates: Record<string, { status: DocumentStatus; notes: string }> = {};

    defs.forEach(def => {
      initialStates[def.id] = {
        status: normalized[def.id]?.status || 'EN_ATTENTE',
        notes: normalized[def.id]?.notes || ''
      };
    });

    setDocStates(initialStates);
    setTargetStudentStatus(student.status || 'Actif');
  }, [isOpen, student, schoolType, school?.school_type, school?.global_settings]);

  const handleStatusChange = (docId: string, newStatus: DocumentStatus) => {
    setDocStates(prev => {
      const next = {
        ...prev,
        [docId]: {
          ...prev[docId],
          status: newStatus
        }
      };

      // Automatically suggest target student status based on doc completeness
      const completeness = calculateDocumentsCompleteness(next, schoolType || school?.school_type, school?.global_settings);
      if (completeness.hasRejection) {
        setTargetStudentStatus('Inactif');
      } else if (completeness.isComplete) {
        setTargetStudentStatus('Actif');
      } else {
        setTargetStudentStatus('Actif');
      }

      return next;
    });
  };

  const handleNotesChange = (docId: string, notes: string) => {
    setDocStates(prev => ({
      ...prev,
      [docId]: {
        ...prev[docId],
        notes
      }
    }));
  };

  const handleSetAll = (status: DocumentStatus) => {
    setDocStates(prev => {
      const next: Record<string, { status: DocumentStatus; notes: string }> = {};
      definitions.forEach(def => {
        next[def.id] = {
          status,
          notes: prev[def.id]?.notes || ''
        };
      });
      if (status === 'VALIDE') {
        setTargetStudentStatus('Actif');
      } else if (status === 'REJETE') {
        setTargetStudentStatus('Inactif');
      } else {
        setTargetStudentStatus('Actif');
      }
      return next;
    });
  };

  const completeness = calculateDocumentsCompleteness(docStates, schoolType || school?.school_type, school?.global_settings);

  const handleSave = async () => {
    if (!student) return;
    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const updatedSubmittedDocs: Record<string, any> = {};

      definitions.forEach(def => {
        const state = docStates[def.id] || { status: 'EN_ATTENTE', notes: '' };
        updatedSubmittedDocs[def.id] = {
          name: def.name,
          status: state.status,
          notes: state.notes.trim(),
          updated_at: now,
          updated_by: currentUser.full_name || currentUser.email
        };
      });

      const updatePayload: Record<string, any> = {
        submitted_documents: updatedSubmittedDocs
      };

      let finalStudentStatus = student.status;
      let targetEnrollmentStatus: string | null = null;
      if (syncStudentStatus && targetStudentStatus && targetStudentStatus !== student.status) {
        updatePayload.status = targetStudentStatus;
        targetEnrollmentStatus = targetStudentStatus === 'Actif' ? 'ACTIVE' : targetStudentStatus === 'Rejeté' ? 'REJECTED' : 'PENDING_VALIDATION';
        finalStudentStatus = targetStudentStatus;
      }

      // Update student table
      const { error: studentError } = await supabase
        .from('students')
        .update(updatePayload)
        .eq('id', student.id)
        .eq('school_id', currentUser.school_id);

      if (studentError) throw studentError;

      // Synchronize enrollments if status changed
      if (syncStudentStatus && targetEnrollmentStatus) {
        await supabase
          .from('enrollments')
          .update({ status: targetEnrollmentStatus })
          .eq('student_id', student.id);
      }

      // Log to Audit trail
      AuditLogger.log({
        school_id: currentUser.school_id,
        user_id: currentUser.id,
        action: 'UPDATE',
        entity_type: 'student',
        entity_id: student.id,
        details: {
          type: 'update_documents_status',
          documents: updatedSubmittedDocs,
          completeness,
          new_student_status: finalStudentStatus
        }
      });

      toast.success("Pièces justificatives mises à jour avec succès !");
      onSuccess(updatedSubmittedDocs, finalStudentStatus);
      onClose();
    } catch (err: any) {
      console.error("Erreur lors de la mise à jour des pièces :", err);
      toast.error("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-xs shrink-0">
              <FileCheck2 size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                Gestion des Pièces Justificatives
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {terminology.student} : <span className="font-bold text-slate-800">{student?.first_name} {student?.last_name}</span> • Matricule : <span className="font-mono">{student?.id?.substring(0, 8)}</span>
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
          >
            <XCircle size={22} />
          </button>
        </div>

        {/* Action Bar / Batch Controls */}
        <div className="px-5 sm:px-6 py-3 bg-indigo-50/40 border-b border-indigo-100/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Actions groupées :</span>
            <button
              type="button"
              onClick={() => handleSetAll('VALIDE')}
              className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 size={13} /> Tout Valider
            </button>
            <button
              type="button"
              onClick={() => handleSetAll('EN_ATTENTE')}
              className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Clock size={13} /> Tout en Attente
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${
              completeness.isComplete ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              completeness.hasRejection ? 'bg-rose-50 text-rose-700 border-rose-200' :
              'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {completeness.isComplete ? <CheckCircle2 size={14} className="text-emerald-600" /> :
               completeness.hasRejection ? <XCircle size={14} className="text-rose-600" /> :
               <Clock size={14} className="text-amber-600" />}
              {completeness.validatedCount}/{completeness.total} Validée(s)
              {completeness.rejectedCount > 0 && ` • ${completeness.rejectedCount} Rejetée(s)`}
              {completeness.pendingCount > 0 && ` • ${completeness.pendingCount} En attente`}
            </span>
          </div>
        </div>

        {/* Content / Documents List */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <div className="space-y-4">
            {definitions.map((def) => {
              const current = docStates[def.id] || { status: 'EN_ATTENTE', notes: '' };
              const isValide = current.status === 'VALIDE';
              const isRejete = current.status === 'REJETE';
              const isAttente = current.status === 'EN_ATTENTE';

              return (
                <div 
                  key={def.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 space-y-3 ${
                    isValide ? 'bg-emerald-50/40 border-emerald-200/80 shadow-xs' :
                    isRejete ? 'bg-rose-50/40 border-rose-200/80 shadow-xs' :
                    'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900">{def.name}</span>
                        {def.required && (
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            Exigé
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        {def.description}
                      </p>
                    </div>

                    {/* Segmented Status Selector */}
                    <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(def.id, 'VALIDE')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isValide 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        <CheckCircle2 size={14} className={isValide ? 'text-white' : 'text-emerald-500'} />
                        <span>Validé</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(def.id, 'EN_ATTENTE')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isAttente 
                            ? 'bg-amber-500 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                        }`}
                      >
                        <Clock size={14} className={isAttente ? 'text-white' : 'text-amber-500'} />
                        <span>En attente</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(def.id, 'REJETE')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isRejete 
                            ? 'bg-rose-600 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        <XCircle size={14} className={isRejete ? 'text-white' : 'text-rose-500'} />
                        <span>Rejeté</span>
                      </button>
                    </div>
                  </div>

                  {/* Notes / Observation field for rejected or pending */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                    <MessageSquare size={14} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={current.notes}
                      onChange={(e) => handleNotesChange(def.id, e.target.value)}
                      placeholder={
                        isRejete 
                          ? "Préciser la raison du rejet (ex: document expiré, photo non conforme...)" 
                          : isAttente 
                          ? "Observation facultative (ex: copie promise pour le 20/09...)" 
                          : "Note facultative sur cette pièce..."
                      }
                      className={`w-full px-3 py-1.5 text-xs rounded-xl border outline-none transition-all ${
                        isRejete 
                          ? 'bg-rose-50/50 border-rose-200 text-rose-900 placeholder:text-rose-400 focus:border-rose-400 focus:bg-white' 
                          : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Student Status Sync Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={syncStudentStatus}
                  onChange={(e) => setSyncStudentStatus(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  Synchroniser le statut du dossier de l'élève
                </span>
              </label>

              {syncStudentStatus && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Nouveau statut :</span>
                  <select
                    value={targetStudentStatus}
                    onChange={(e) => setTargetStudentStatus(e.target.value)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="Actif">Actif (Dossier validé)</option>
                    <option value="PENDING_VALIDATION">En attente de validation</option>
                    <option value="Rejeté">Rejeté</option>
                    <option value="Inactif">Inactif</option>
                  </select>
                </div>
              )}
            </div>

            {syncStudentStatus && targetStudentStatus === 'Actif' && !completeness.isComplete && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>Attention : Vous activez l'{terminology.student?.toLowerCase() || 'élève'} alors que certaines pièces justificatives sont encore en attente ou incomplètes.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Enregistrer les pièces</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentDocumentStatusModal;
