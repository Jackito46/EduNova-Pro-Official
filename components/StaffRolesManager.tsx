import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Briefcase, 
  RefreshCcw, 
  AlertTriangle, 
  Check, 
  Search, 
  ShieldCheck, 
  Sparkles, 
  Building2, 
  Lock,
  CheckCircle2,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from './Modal';
import { UserProfile } from '../types';

interface StaffRole {
  id: string;
  label: string;
  school_id: string | null;
  description?: string;
}

type FilterScope = 'all' | 'standard' | 'custom';

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
  const [activeScope, setActiveScope] = useState<FilterScope>('all');
  
  const inputRef = useRef<HTMLInputElement>(null);

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
      setActiveScope('all');
      setEditingId(null);
      setError(null);
      setSuccessMsg(null);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, user.school_id]);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 2800);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = roles.length;
    const standardCount = roles.filter(r => !r.school_id).length;
    const customCount = roles.filter(r => !!r.school_id).length;
    return { total, standardCount, customCount };
  }, [roles]);

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
      setSuccessMsg(`Poste "${trimmed}" ajouté avec succès au catalogue !`);
    } catch (err: any) {
      console.error('Error adding role:', err);
      setError(err.message || "Impossible d'ajouter ce poste.");
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
      setSuccessMsg(`Intitulé mis à jour : "${trimmed}"`);
    } catch (err: any) {
      console.error('Error updating role:', err);
      setError("Impossible de modifier un poste standard du socle ou erreur réseau.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, schoolId: string | null) => {
    if (!schoolId) {
      setError("Les postes du socle standard sont protégés.");
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
          throw new Error("Ce poste est actuellement attribué à un ou plusieurs collaborateurs RH de l'établissement.");
        }
        throw error;
      }
      setRoles(prev => prev.filter(r => r.id !== id));
      setDeleteConfirmId(null);
      setSuccessMsg("Poste retiré du catalogue avec succès.");
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
        setError("Tous les postes du socle standard sont déjà présents dans votre catalogue.");
        return;
      }

      const { data, error } = await supabase
        .from('staff_roles')
        .insert(rolesToInsert)
        .select();

      if (error) throw error;
      
      if (data) {
        setRoles(prev => [...prev, ...data].sort((a, b) => a.label.localeCompare(b.label)));
        setSuccessMsg(`${data.length} postes du socle standard importés avec succès !`);
      }
    } catch (err: any) {
      console.error('Error injecting roles:', err);
      setError(err.message || "Erreur lors de l'import des postes standards.");
    } finally {
      setIsSaving(false);
    }
  };

  // Filter by both search term and scope tab
  const filteredRolesList = useMemo(() => {
    return roles.filter(r => {
      const matchesSearch = r.label.toLowerCase().includes(roleSearchFilter.toLowerCase());
      if (!matchesSearch) return false;

      if (activeScope === 'standard') return !r.school_id;
      if (activeScope === 'custom') return !!r.school_id;
      return true;
    });
  }, [roles, roleSearchFilter, activeScope]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="" 
      hideDefaultActions
      hideIcon
      hideTitle
      hideCloseButton
      containerClassName="rounded-2xl max-w-3xl w-full mx-auto overflow-hidden border border-slate-200/90 shadow-2xl p-0"
      contentClassName="p-0 overflow-hidden"
    >
      <div className="flex flex-col h-[88vh] max-h-[680px] bg-slate-50 font-sans select-none overflow-hidden">
        
        {/* Modern Compact Header */}
        <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center font-bold shadow-inner shrink-0">
              <Briefcase size={15} className="text-indigo-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white leading-none truncate">
                  Catalogue des Postes RH
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/25 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold shrink-0">
                  {stats.total} {stats.total > 1 ? 'postes' : 'poste'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                Référentiel Métiers RH
              </p>
            </div>
          </div>

          {/* Header Stats Pills & Close */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-slate-300">
              <span className="px-2 py-0.5 bg-slate-800/80 rounded-md border border-slate-700/60 flex items-center gap-1">
                <ShieldCheck size={11} className="text-indigo-400" />
                <span>{stats.standardCount} standard</span>
              </span>
              <span className="px-2 py-0.5 bg-slate-800/80 rounded-md border border-slate-700/60 flex items-center gap-1">
                <Building2 size={11} className="text-emerald-400" />
                <span>{stats.customCount} école</span>
              </span>
            </div>

            <button 
              type="button"
              onClick={onClose} 
              className="p-1.5 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-lg transition-all border border-white/10 active:scale-95 shrink-0 cursor-pointer"
              aria-label="Fermer"
              title="Fermer (Échap)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Compact Integrated Command Bar (Reduced vertical margins, high density) */}
        <div className="px-3 sm:px-4 py-2 bg-white border-b border-slate-200/80 space-y-1.5 shrink-0">
          
          {/* Row 1: Scope Filters + Fast Search (Responsive layout) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5">
            {/* Scope segmented tabs */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/70 text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveScope('all')}
                className={`px-2 py-1 rounded-md transition-all text-[11px] font-bold cursor-pointer ${
                  activeScope === 'all'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setActiveScope('standard')}
                className={`px-2 py-1 rounded-md transition-all text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                  activeScope === 'standard'
                    ? 'bg-white text-indigo-950 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-indigo-900'
                }`}
              >
                <ShieldCheck size={11} className={activeScope === 'standard' ? 'text-indigo-600' : 'text-slate-400'} />
                <span>Socle Standard ({stats.standardCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveScope('custom')}
                className={`px-2 py-1 rounded-md transition-all text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                  activeScope === 'custom'
                    ? 'bg-white text-indigo-950 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-indigo-900'
                }`}
              >
                <Building2 size={11} className={activeScope === 'custom' ? 'text-emerald-600' : 'text-slate-400'} />
                <span>Spécifiques École ({stats.customCount})</span>
              </button>
            </div>

            {/* Fast search field */}
            <div className="relative flex-1 sm:max-w-xs">
              <input
                type="text"
                value={roleSearchFilter}
                onChange={(e) => setRoleSearchFilter(e.target.value)}
                placeholder="Filtrer les intitulés..."
                className="w-full h-8 pl-7 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
              />
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              {roleSearchFilter && (
                <button 
                  type="button" 
                  onClick={() => setRoleSearchFilter('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                  title="Effacer le filtre"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Ergonomic Quick-Add Form with Compact Rhythm */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ajouter un nouveau poste RH à l'établissement... (Ex: Responsable Vie Scolaire)"
                className="w-full h-8 px-2.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                disabled={isSaving}
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isSaving || !newLabel.trim()}
              className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-all shadow-xs disabled:opacity-40 flex items-center justify-center gap-1 active:scale-95 shrink-0 cursor-pointer"
              title="Ajouter au catalogue établissement (Entrée)"
            >
              {isSaving && newLabel.trim() ? (
                <RefreshCcw size={12} className="animate-spin" />
              ) : (
                <Plus size={13} className="stroke-[2.5]" />
              )}
              <span>Ajouter</span>
            </button>
          </div>

          {/* Compact Inline Feedback (Zero layout displacement) */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg flex items-center justify-between gap-2 text-[11px]"
              >
                <div className="flex items-center gap-1 font-semibold min-w-0">
                  <AlertTriangle size={12} className="shrink-0 text-rose-600" />
                  <span className="truncate">{error}</span>
                </div>
                <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700 p-0.5 shrink-0 cursor-pointer">
                  <X size={11} />
                </button>
              </motion.div>
            )}

            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg flex items-center gap-1 text-[11px] font-bold"
              >
                <CheckCircle2 size={12} className="shrink-0 text-emerald-600" />
                <span className="truncate">{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* High-Density Roles Table/List (Ultra-ergonomic, compact vertical rhythm) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2.5 sm:px-4 py-2">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <RefreshCcw size={20} className="animate-spin mb-1.5 text-indigo-600" />
              <p className="text-xs font-bold text-slate-700">Synchronisation du catalogue des postes...</p>
            </div>
          ) : filteredRolesList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-1.5">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                <Briefcase size={16} />
              </div>
              <p className="text-xs font-bold text-slate-800">Aucun poste ne correspond</p>
              <p className="text-[11px] text-slate-400 max-w-xs">
                {roleSearchFilter 
                  ? `Aucun intitulé ne correspond à "${roleSearchFilter}".` 
                  : activeScope !== 'all' 
                    ? 'Aucun poste dans ce filtre de périmètre.' 
                    : 'Le catalogue est vide pour le moment.'}
              </p>
              {(roleSearchFilter || activeScope !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setRoleSearchFilter('');
                    setActiveScope('all');
                  }}
                  className="mt-1 px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors cursor-pointer"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-xl divide-y divide-slate-100 shadow-xs overflow-hidden">
              {filteredRolesList.map((role) => {
                const isCustom = !!role.school_id;
                const isEditing = editingId === role.id;

                return (
                  <div 
                    key={role.id} 
                    className={`px-3 py-1.5 sm:py-2 flex items-center justify-between transition-colors group ${
                      isEditing ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {isEditing ? (
                      /* Inline Editing View - Tight, fast */
                      <div className="flex-1 flex items-center gap-1.5 py-0.5">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="flex-1 h-7 px-2 bg-white text-slate-900 border border-indigo-500 rounded-md text-xs font-bold outline-none ring-1 ring-indigo-500/20"
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
                          className="h-7 px-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-md text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer" 
                          title="Enregistrer (Entrée)"
                        >
                          <Check size={12} className="stroke-[2.5]" />
                          <span className="hidden sm:inline">Valider</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEditingId(null)} 
                          disabled={isSaving} 
                          className="h-7 px-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200/80 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer" 
                          title="Annuler (Échap)"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      /* Compact Row View - Single Line with Category Badge */
                      <>
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-2">
                          {/* Mini icon */}
                          <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center shrink-0 ${
                            isCustom 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                              : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                          }`}>
                            <Briefcase size={11} />
                          </div>

                          {/* Role Title & Inline Badge */}
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                            <span className="text-xs font-bold text-slate-900 truncate leading-snug group-hover:text-indigo-950 transition-colors">
                              {role.label}
                            </span>
                            
                            {/* Inline Badges respecting Terminology */}
                            {isCustom ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded shrink-0">
                                <Building2 size={9} className="text-emerald-600" />
                                <span>Poste Personnalisé</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded shrink-0">
                                <ShieldCheck size={9} className="text-indigo-600" />
                                <span>Socle Standard</span>
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Compact Action Buttons */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          {isCustom ? (
                            <>
                              <button 
                                type="button"
                                onClick={() => { setEditingId(role.id); setEditLabel(role.label); }}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors active:scale-90 cursor-pointer"
                                title="Modifier l'intitulé du poste"
                                aria-label="Modifier"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => setDeleteConfirmId(role.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors active:scale-90 cursor-pointer"
                                title="Supprimer ce poste personnalisé"
                                aria-label="Supprimer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          ) : (
                            /* Protected standard role badge with informational tooltip */
                            <button
                              type="button"
                              onClick={() => setShowStandardAlert(true)}
                              className="p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              title="Poste standard protégé du socle académique"
                              aria-label="Protégé"
                            >
                              <Lock size={11} />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer with Actions: Compact, fluid & responsive */}
        <div className="px-3 sm:px-5 py-2 bg-white border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-1.5 shrink-0">
          
          {/* Left Action: Standard roles import */}
          <button 
            type="button"
            onClick={injectStandardRoles}
            disabled={isSaving}
            className="w-full sm:w-auto px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Importer ou compléter le référentiel des postes académiques et administratifs standards"
          >
            {isSaving ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} className="text-indigo-600" />}
            <span>Importer le socle standard (+30)</span>
          </button>
          
          {/* Right Action: Close */}
          <div className="w-full sm:w-auto flex items-center justify-end gap-2">
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline-block pr-1">
              {filteredRolesList.length} sur {stats.total} poste{stats.total > 1 ? 's' : ''}
            </span>
            <button 
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-all active:scale-95 text-center cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Deletion Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId, user.school_id)}
        title="Supprimer ce poste ?"
        message={`Êtes-vous sûr de vouloir supprimer le poste "${roles.find(r => r.id === deleteConfirmId)?.label}" du catalogue de votre établissement ?`}
        type="danger"
        confirmLabel="Supprimer définitivement"
        cancelLabel="Conserver"
        isLoading={isSaving}
        containerClassName="rounded-2xl max-w-md"
      />

      {/* Standard Role Alert */}
      <Modal
        isOpen={showStandardAlert}
        onClose={() => setShowStandardAlert(false)}
        title="Poste Standard Protégé"
        message="Ce poste fait partie du socle académique standard. Il est protégé pour garantir la cohérence des rapports administratifs, financiers et académiques. Vous pouvez créer ou personnaliser vos propres postes d'établissement à l'aide du formulaire supérieur."
        type="info"
        confirmLabel="Compris"
        onConfirm={() => setShowStandardAlert(false)}
        containerClassName="rounded-2xl max-w-md"
      />
    </Modal>
  );
};

export default StaffRolesManager;
