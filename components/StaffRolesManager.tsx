import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Trash2, Edit2, Save, X, Briefcase, RefreshCcw, AlertTriangle, Check, Search, ShieldCheck, Sparkles, Building2 } from 'lucide-react';
import Modal from './Modal';
import { UserProfile } from '../types';

interface StaffRole {
  id: string;
  label: string;
  school_id: string | null;
  description?: string;
}

const StaffRolesManager: React.FC<{ user: UserProfile; isOpen: boolean; onClose: () => void }> = ({ user, isOpen, onClose }) => {
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showStandardAlert, setShowStandardAlert] = useState(false);
  const [roleSearchFilter, setRoleSearchFilter] = useState('');

  const fetchRoles = async () => {
    setLoading(true);
    setError(null);
    try {
      let rolesQuery = supabase
        .from('staff_roles')
        .select('*');
      
      if (user.school_id) {
        rolesQuery = rolesQuery.or(`school_id.eq.${user.school_id},school_id.is.null`);
      } else {
        rolesQuery = rolesQuery.is('school_id', null);
      }
      
      const { data, error } = await rolesQuery.order('label');
        
      if (error) {
        console.warn('Notice fetching staff roles:', error.message);
        setRoles([]);
        return;
      }
      setRoles(data || []);
    } catch (err: any) {
      console.warn('Notice fetching staff roles:', err);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRoles();
      setRoleSearchFilter('');
      setEditingId(null);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, user.school_id]);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3500);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  const handleAdd = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;

    // Check if role with same label already exists
    if (roles.some(r => r.label.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Le poste "${trimmed}" existe déjà dans le catalogue.`);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('staff_roles')
        .insert([{ label: trimmed, school_id: user.school_id }])
        .select()
        .single();
        
      if (error) throw error;
      setRoles(prev => [...prev, data].sort((a, b) => a.label.localeCompare(b.label)));
      setNewLabel('');
      setSuccessMsg(`Poste "${trimmed}" ajouté avec succès !`);
    } catch (err: any) {
      console.error('Error adding role:', err);
      setError(err.message || 'Impossible d\'ajouter ce poste.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    const trimmed = editLabel.trim();
    if (!trimmed) return;
    setIsSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('staff_roles')
        .update({ label: trimmed })
        .eq('id', id)
        .eq('school_id', user.school_id);
        
      if (error) throw error;
      setRoles(prev => prev.map(r => r.id === id ? { ...r, label: trimmed } : r).sort((a, b) => a.label.localeCompare(b.label)));
      setEditingId(null);
      setSuccessMsg(`Poste mis à jour en "${trimmed}"`);
    } catch (err: any) {
      console.error('Error updating role:', err);
      setError("Impossible de modifier un poste standard ou erreur réseau.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, schoolId: string | null) => {
    if (!schoolId) {
      setError("Impossible de supprimer un poste standard.");
      return;
    }
    
    setIsSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('staff_roles')
        .delete()
        .eq('id', id)
        .eq('school_id', user.school_id);
        
      if (error) {
        if (error.code === '23503') {
          throw new Error("Ce poste est actuellement rattaché à un ou plusieurs collaborateurs RH et ne peut pas être supprimé.");
        }
        throw error;
      }
      setRoles(prev => prev.filter(r => r.id !== id));
      setDeleteConfirmId(null);
      setSuccessMsg("Poste supprimé du catalogue avec succès.");
    } catch (err: any) {
      console.error('Error deleting role:', err);
      setError(err.message || "Erreur lors de la suppression du poste.");
    } finally {
      setIsSaving(false);
    }
  };

  const injectStandardRoles = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const STANDARD_ROLES = [
        // Direction & Administration
        { label: 'Directeur Général', description: 'Direction générale de l\'établissement' },
        { label: 'Directeur des Études', description: 'Direction académique et pédagogique' },
        { label: 'Censeur', description: 'Discipline et organisation des études' },
        { label: 'Secrétaire Général(e)', description: 'Administration générale' },
        { label: 'Secrétaire Administratif', description: 'Secrétariat et accueil' },
        { label: 'Comptable', description: 'Gestion financière et comptabilité' },
        { label: 'Économe', description: 'Gestion matérielle et financière' },
        { label: 'Caissier / Caissière', description: 'Encaissement et décaissement' },
        // Enseignement & Encadrement
        { label: 'Enseignant Titulaire', description: 'Professeur permanent' },
        { label: 'Enseignant Vacataire', description: 'Professeur à temps partiel ou contractuel' },
        { label: 'Professeur Principal', description: 'Coordination pédagogique d\'une classe' },
        { label: 'Surveillant Général', description: 'Coordination de la surveillance et discipline' },
        { label: 'Surveillant(e)', description: 'Surveillance et encadrement des élèves' },
        { label: 'Bibliothécaire', description: 'Gestion de la bibliothèque et documentation' },
        { label: 'Responsable Informatique / IT', description: 'Gestion du parc informatique et réseau' },
        { label: 'Psychologue Scolaire', description: 'Accompagnement psychologique et orientation' },
        { label: 'Infirmier / Infirmière', description: 'Soins de santé et premiers secours' },
        // Support & Logistique
        { label: 'Agent d\'entretien', description: 'Nettoyage et entretien des locaux' },
        { label: 'Chauffeur', description: 'Transport scolaire et déplacements' },
        { label: 'Gardien / Agent de sécurité', description: 'Sécurité des locaux et contrôle d\'accès' },
        { label: 'Cuisinier / Cuisinière', description: 'Restauration scolaire' },
        { label: 'Responsable des Activités Parascolaires', description: 'Coordination des clubs et sports' },
        { label: 'Conseiller d\'Orientation', description: 'Accompagnement dans les choix d\'études' },
        // Enseignement Supérieur & Universitaire
        { label: 'Recteur / Président', description: 'Direction exécutive de l\'université' },
        { label: 'Vice-Recteur Académique', description: 'Assistance à la direction académique' },
        { label: 'Doyen de Faculté', description: 'Direction d\'une faculté' },
        { label: 'Secrétaire Académique', description: 'Gestion des inscriptions et relevés' },
        { label: 'Professeur Titulaire', description: 'Enseignant-chercheur magistral' },
        { label: 'Chargé de Cours', description: 'Dispense d\'enseignements spécifiques' },
        // Formation Professionnelle
        { label: 'Directeur de Centre', description: 'Direction du centre de formation' },
        { label: 'Formateur Technique', description: 'Formation pratique et théorique en atelier' },
        { label: 'Coordinateur de Stage', description: 'Partenariats entreprises et stages' }
      ];

      const existingLabels = roles.map(r => r.label.toLowerCase());
      const rolesToInsert = STANDARD_ROLES
        .filter(r => !existingLabels.includes(r.label.toLowerCase()))
        .map(r => ({ ...r, school_id: user.school_id }));

      if (rolesToInsert.length === 0) {
        setError("Tous les postes standards sont déjà présents dans votre catalogue.");
        return;
      }

      const { data, error } = await supabase
        .from('staff_roles')
        .insert(rolesToInsert)
        .select();

      if (error) throw error;
      
      if (data) {
        setRoles(prev => [...prev, ...data].sort((a, b) => a.label.localeCompare(b.label)));
        setSuccessMsg(`${data.length} postes standards importés avec succès !`);
      }
    } catch (err: any) {
      console.error('Error injecting roles:', err);
      setError(err.message || "Erreur lors de l'import des postes standards.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRolesList = roles.filter(r => 
    r.label.toLowerCase().includes(roleSearchFilter.toLowerCase())
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="" 
      hideDefaultActions
      hideIcon
      hideTitle
      hideCloseButton
      containerClassName="rounded-3xl max-w-2xl w-full mx-auto overflow-hidden border border-slate-200/90 shadow-2xl"
      contentClassName="p-0 overflow-hidden"
    >
      <div className="flex flex-col h-[82vh] max-h-[620px] bg-slate-50 font-sans select-none overflow-hidden">
        
        {/* Compact, Clean Header Banner with ONE close button */}
        <div className="px-5 sm:px-6 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center font-bold shadow-inner shrink-0">
              <Briefcase size={18} className="text-indigo-300" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold tracking-tight text-white">
                Catalogue des Postes RH
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/25 text-indigo-200 border border-indigo-400/30 text-[11px] font-bold">
                {roles.length} {roles.length > 1 ? 'postes' : 'poste'}
              </span>
            </div>
          </div>

          {/* Single Top Close Button */}
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-xl transition-all border border-white/10 active:scale-95 shrink-0"
            aria-label="Fermer"
            title="Fermer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Top Control Bar: Notifications, Add Form & Search (Fixed - No scroll) */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200/80 space-y-3 shrink-0">
          {/* Notifications */}
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-xs shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
              <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700 p-0.5">
                <X size={14} />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs shadow-xs font-bold animate-in fade-in">
              <Check size={15} className="shrink-0 text-emerald-600 stroke-[2.5]" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Add & Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Add Input */}
            <div className="sm:col-span-7 flex gap-1.5">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ex : Coordinateur Pédagogique..."
                className="flex-1 px-3.5 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                disabled={isSaving}
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={isSaving || !newLabel.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
              >
                {isSaving && newLabel.trim() ? (
                  <RefreshCcw size={14} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                <span>Ajouter</span>
              </button>
            </div>

            {/* Search Filter */}
            <div className="sm:col-span-5 relative">
              <input
                type="text"
                value={roleSearchFilter}
                onChange={(e) => setRoleSearchFilter(e.target.value)}
                placeholder="Filtrer un poste..."
                className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-3 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
              />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {roleSearchFilter && (
                <button 
                  type="button" 
                  onClick={() => setRoleSearchFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Roles Container List (THE ONLY SCROLLBAR) */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-5">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <RefreshCcw size={24} className="animate-spin mb-2 text-indigo-600" />
              <p className="text-xs font-bold text-slate-700">Chargement du catalogue...</p>
            </div>
          ) : filteredRolesList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-1.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Briefcase size={20} />
              </div>
              <p className="text-xs font-bold text-slate-800">Aucun poste trouvé</p>
              <p className="text-[11px] text-slate-400">
                {roleSearchFilter ? 'Aucun résultat pour ce filtre.' : 'Le catalogue est actuellement vide.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 shadow-xs overflow-hidden">
              {filteredRolesList.map(role => (
                <div key={role.id} className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-slate-50/90 transition-colors group">
                  {editingId === role.id ? (
                    <div className="flex-1 flex items-center gap-2 mr-2">
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white text-slate-900 border border-indigo-500 rounded-xl text-xs sm:text-sm font-bold outline-none ring-2 ring-indigo-500/20"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleUpdate(role.id);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => handleUpdate(role.id)} 
                        disabled={isSaving} 
                        className="p-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all active:scale-95" 
                        title="Sauvegarder"
                      >
                        <Save size={14} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => setEditingId(null)} 
                        disabled={isSaving} 
                        className="p-2 text-slate-500 hover:bg-slate-200 rounded-xl transition-all" 
                        title="Annuler"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                          role.school_id 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          <Briefcase size={13} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate leading-tight">
                            {role.label}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              role.school_id 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                                : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                            }`}>
                              {role.school_id ? 'Personnalisé' : 'Standard (Système)'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          type="button"
                          onClick={() => { setEditingId(role.id); setEditLabel(role.label); }}
                          disabled={!role.school_id}
                          className={`p-1.5 rounded-lg transition-all ${
                            role.school_id 
                              ? 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50' 
                              : 'text-slate-300 cursor-not-allowed'
                          }`}
                          title={role.school_id ? "Modifier le nom du poste" : "Poste standard protégé"}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            if (!role.school_id) {
                              setShowStandardAlert(true);
                            } else {
                              setDeleteConfirmId(role.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title={role.school_id ? "Supprimer ce poste" : "Poste standard protégé"}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer with Actions (Fixed - No scroll) */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white shrink-0">
          <button 
            type="button"
            onClick={injectStandardRoles}
            disabled={isSaving}
            className="w-full sm:w-auto px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
            title="Importer le référentiel des 30+ postes académiques et administratifs standards"
          >
            {isSaving ? <RefreshCcw size={13} className="animate-spin" /> : <Sparkles size={13} className="text-indigo-600" />}
            <span>Importer les postes standards (+30)</span>
          </button>
          
          <button 
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95 text-center"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* Deletion Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId, user.school_id)}
        title="Supprimer ce poste ?"
        message={`Êtes-vous sûr de vouloir supprimer le poste "${roles.find(r => r.id === deleteConfirmId)?.label}" du catalogue ?`}
        type="danger"
        confirmLabel="Supprimer définitivement"
        cancelLabel="Conserver"
        isLoading={isSaving}
        containerClassName="rounded-3xl"
      />

      {/* Standard Role Alert */}
      <Modal
        isOpen={showStandardAlert}
        onClose={() => setShowStandardAlert(false)}
        title="Poste Standard Protégé"
        message="Ce poste fait partie du référentiel standard EduNova. Il est protégé pour garantir l'intégrité des rapports ministériels et académiques. Vous pouvez en revanche créer ou modifier vos propres postes personnalisés."
        type="info"
        confirmLabel="Compris"
        onConfirm={() => setShowStandardAlert(false)}
        containerClassName="rounded-3xl"
      />
    </Modal>
  );
};

export default StaffRolesManager;
