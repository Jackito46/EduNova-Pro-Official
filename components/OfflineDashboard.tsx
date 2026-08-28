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
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <WifiOff size={180} />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-rose-500/20 text-rose-300 px-3 py-1 rounded-full text-sm font-semibold mb-4 border border-rose-500/30">
            <WifiOff size={16} /> Mode Hors-ligne Actif
          </div>
          <h1 className="text-3xl font-bold mb-3">Espace de Travail Local</h1>
          <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
            Vous n'êtes actuellement pas connecté à Internet. EduNova est conçu pour fonctionner même sans connexion. 
            Vous pouvez consulter vos données en cache et reprendre vos brouillons là où vous les avez laissés.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brouillons */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <FileEdit size={20} />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Brouillons Sauvegardés</h2>
            </div>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
              {drafts.length}
            </span>
          </div>

          <div className="space-y-3">
            {drafts.length > 0 ? (
              drafts.map((draft, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-300 transition-colors bg-slate-50/50">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                       {draft.type}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      ID: {draft.id} • Sauvegarde locale activée
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeDraft(draft.key)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                    {draft.id === 'Nouvelle' ? (
                        <Link to="/eleves/ajouter" className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-medium">
                            Reprendre <ArrowRight size={14} />
                        </Link>
                    ) : (
                         <Link to={`/eleves/modifier/${draft.id}`} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-medium">
                            Reprendre <ArrowRight size={14} />
                        </Link>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-300">
                  <FileEdit size={24} />
                </div>
                <p className="text-slate-500 text-sm">Aucun brouillon en attente.</p>
              </div>
            )}
          </div>
        </div>

        {/* Données en Cache */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Database size={20} />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Données en Cache</h2>
            </div>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
              Dernière session
            </span>
          </div>

          <div className="space-y-3">
            {cacheItems.length > 0 ? (
              cacheItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <Database size={16} className="text-slate-400" />
                    <div>
                      <h3 className="font-semibold text-slate-700 text-sm">{item.name}</h3>
                      <p className="text-xs text-slate-500">{item.count} enregistrement(s)</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-white px-2 py-1 border border-slate-200 rounded-md">
                    {item.size}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <AlertTriangle size={24} className="text-amber-400 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Le cache local est actuellement vide.</p>
              </div>
            )}
          </div>
          
          <div className="mt-6 bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
             <RefreshCw size={18} className="text-blue-500 shrink-0 mt-0.5" />
             <p className="text-xs text-blue-700/80 leading-relaxed font-medium">
               Dès que vous retrouverez une connexion Internet, les données se synchroniseront automatiquement avec EduNova Cloud.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineDashboard;
