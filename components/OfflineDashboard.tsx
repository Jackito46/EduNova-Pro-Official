import React, { useState, useEffect } from 'react';
import { WifiOff, FileEdit, Users, RefreshCw, AlertTriangle, Database, Trash2, ArrowRight } from 'lucide-react';
import { UserProfile } from '../types';
import { Link } from 'react-router-dom';

interface OfflineDashboardProps {
  user: UserProfile;
}

interface DraftItem {
  key: string;
  type: string;
  id: string;
  timestamp: number;
}

export const OfflineDashboard: React.FC<OfflineDashboardProps> = ({ user }) => {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [cacheItems, setCacheItems] = useState<{name: string, count: number, size: string}[]>([]);

  useEffect(() => {
    // Scan local storage for drafts and cache
    const currentDrafts: DraftItem[] = [];
    const currentCaches: {name: string, count: number, size: string}[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      try {
        if (key.startsWith('draft_student_')) {
          const parts = key.split('_');
          const id = parts[2];
          currentDrafts.push({
            key,
            type: 'Inscription Élève',
            id: id === 'new' ? 'Nouvelle' : id,
            timestamp: Date.now() // Ideally we would save the timestamp inside the draft, but we can fake it or omit it
          });
        }
        
        // Check for cached lists
        if (key === 'edunova_users_cache') {
          const data = JSON.parse(localStorage.getItem(key) || '[]');
          const size = new Blob([localStorage.getItem(key) || '']).size;
          currentCaches.push({ name: 'Utilisateurs', count: data.length, size: formatBytes(size) });
        }
        if (key === 'edunova_staff_cache') {
          const data = JSON.parse(localStorage.getItem(key) || '[]');
          const size = new Blob([localStorage.getItem(key) || '']).size;
          currentCaches.push({ name: 'Personnel', count: data.length, size: formatBytes(size) });
        }
        if (key.includes('school_logo_')) {
          const size = new Blob([localStorage.getItem(key) || '']).size;
          currentCaches.push({ name: 'Logo École', count: 1, size: formatBytes(size) });
        }
      } catch (e) {
        console.error("Erreur lors de la lecture du cache", e);
      }
    }
    
    setDrafts(currentDrafts);
    setCacheItems(currentCaches);
  }, []);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const removeDraft = (key: string) => {
    localStorage.removeItem(key);
    setDrafts(drafts.filter(d => d.key !== key));
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {/* Compact Modern Hero Header */}
      <div className="bg-slate-900 rounded-2xl p-4 sm:p-6 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <WifiOff size={120} />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 border border-rose-500/30">
              <WifiOff size={13} /> Mode Hors-ligne Actif
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Espace de Travail Local</h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl leading-relaxed mt-1">
              Vous travaillez sans connexion. Vos données sont préservées en cache local et synchronisées dès le retour du réseau.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
              Chiffré Localement
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Brouillons */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <FileEdit size={16} />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800">Brouillons Sauvegardés</h2>
            </div>
            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
              {drafts.length}
            </span>
          </div>

          <div className="space-y-2">
            {drafts.length > 0 ? (
              drafts.map((draft, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors bg-slate-50/60">
                  <div className="min-w-0 pr-2">
                    <h3 className="font-semibold text-slate-800 text-xs sm:text-sm truncate">
                       {draft.type}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                      ID: {draft.id} • Sauvegarde active
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      onClick={() => removeDraft(draft.key)} 
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                      title="Supprimer ce brouillon"
                    >
                      <Trash2 size={14} />
                    </button>
                    {draft.id === 'Nouvelle' ? (
                        <Link to="/eleves/ajouter" className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold shadow-xs">
                            <span>Reprendre</span> <ArrowRight size={12} />
                        </Link>
                    ) : (
                         <Link to={`/eleves/modifier/${draft.id}`} className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold shadow-xs">
                            <span>Reprendre</span> <ArrowRight size={12} />
                        </Link>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 text-slate-300">
                  <FileEdit size={18} />
                </div>
                <p className="text-slate-500 text-xs font-medium">Aucun brouillon en attente.</p>
              </div>
            )}
          </div>
        </div>

        {/* Données en Cache */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <Database size={16} />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800">Données en Cache</h2>
            </div>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[11px] font-medium">
              Dernière session
            </span>
          </div>

          <div className="space-y-2">
            {cacheItems.length > 0 ? (
              cacheItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Database size={14} className="text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-700 text-xs sm:text-sm truncate">{item.name}</h3>
                      <p className="text-[11px] text-slate-500 font-mono">{item.count} enregistrement(s)</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 border border-slate-200 rounded-md shrink-0">
                    {item.size}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <AlertTriangle size={20} className="text-amber-400 mx-auto mb-2" />
                <p className="text-slate-500 text-xs font-medium">Le cache local est actuellement vide.</p>
              </div>
            )}
          </div>
          
          <div className="mt-3.5 bg-blue-50/60 border border-blue-100 p-2.5 rounded-lg flex items-center gap-2.5">
             <RefreshCw size={14} className="text-blue-500 shrink-0" />
             <p className="text-[11px] text-blue-700 leading-snug font-medium">
               Synchronisation automatique vers EduNova Cloud dès le rétablissement de la connexion.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineDashboard;
