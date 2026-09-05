import React, { useState, useEffect } from 'react';
import { Send, Bell, UserCheck, ShieldAlert, Loader2, Smartphone, GraduationCap, Copy, Search, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile } from '../types';
import { subscribeToPush } from '../utils/pushHelper';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { ClassSelectorPill } from './ClassSelectorPill';
import { CommunicationTabBar } from './CommunicationTabBar';

interface PushModuleProps {
  user: UserProfile;
}

const PushModule: React.FC<PushModuleProps> = ({ user }) => {
  const { terminology, currentCampusId } = useSchool();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [classId, setClassId] = useState<string>('');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('checking...');

  const templates = [
    { label: 'Retard de paiement', title: 'Rappel de Paiement', body: `N'oubliez pas que votre versement pour ce mois est attendu. Merci de régulariser votre situation.`, url: '/finance' },
    { label: 'Alerte Absence', title: 'Alerte Absence', body: `Ceci est une notification pour vous informer de l'absence de votre enfant en cours aujourd'hui.`, url: '/absences' },
    { label: 'Réunion Parents', title: 'Réunion', body: `Une réunion est prévue ce vendredi. Votre présence est vivement souhaitée.`, url: '/' },
    { label: 'Résultats Examen', title: 'Résultats Disponibles', body: `Les notes des derniers examens sont maintenant disponibles sur la plateforme.`, url: '/bulletins' }
  ];

  const applyTemplate = (t: { title: string, body: string, url?: string }) => {
    setTitle(t.title);
    setBody(t.body);
    if (t.url) setUrl(t.url);
  };

  useEffect(() => {
    if (!('Notification' in window)) {
      setPushStatus('unsupported');
    } else {
      setPushStatus(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const fetchClasses = async () => {
      let q = supabase.from('classes').select('id, name').eq('school_id', user.school_id).order('name');
      if (currentCampusId) q = q.eq('campus_id', currentCampusId);
      const { data } = await q;
      if (data) setClasses(data);
    };
    fetchClasses();
  }, [user.school_id, currentCampusId]);

  const roles = [
    { id: 'STUDENT', label: terminology.students || 'Étudiants/Élèves' },
    { id: 'PARENT', label: 'Parents' },
    { id: 'TEACHER', label: terminology.teachers || 'Enseignants' },
    { id: 'SECRETARY', label: 'Administration' }
  ];

  const handleToggleRole = (role: string) => {
    setRoleFilters(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role]
    );
  };

  const handleSelfSubscribe = async () => {
    try {
      setTestLoading(true);
      const permission = await Notification.requestPermission();
      setPushStatus(permission);
      
      if (permission === 'granted') {
        const result = await subscribeToPush(user.id, user.school_id || '', true);
        if (result.success) {
          toast.success('Appareil abonné avec succès !');
        } else {
          toast.error(`Erreur d'abonnement: ${result.error}`);
        }
      } else {
        toast.error('Permission refusée par le navigateur.');
      }
    } catch (e: any) {
      toast.error('Erreur: ' + e.message);
    } finally {
      setTestLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) {
      toast.error('Le titre et le message sont requis.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.school_id,
          campusId: currentCampusId || undefined,
          title,
          body,
          url,
          roleFilters,
          classId: classId || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      if (data.sent > 0) {
        toast.success(`${data.sent} notification(s) envoyée(s) avec succès !`);
        // Silently ignore failures if we have at least one success, 
        // to avoid worrying the user about old devices being cleaned up.
      } else if (data.failed > 0) {
        toast.warning(`Aucun appareil actif trouvé. Les anciens abonnements ont été nettoyés.`);
      } else {
        toast.info(`Aucun appareil abonné trouvé pour ces critères.`);
      }

      setTitle('');
      setBody('');
      setUrl('');
      setRoleFilters([]);
      setClassId('');
    } catch (error: any) {
      toast.error('Erreur lors de l\'envoi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-4 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 4 CHANNELS TAB BAR (RESPONSIVE) */}
      <CommunicationTabBar activeChannel="push" />

      {/* HEADER COMPACT */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <Bell size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Notifications Push</h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium">
              Envoyez des alertes instantanées sur les téléphones et navigateurs de vos utilisateurs.
            </p>
          </div>
        </div>
      </div>

      {pushStatus !== 'granted' && (
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-xs sm:text-sm text-indigo-900 flex items-center gap-1.5">
              <Smartphone size={16} className="text-indigo-600" />
              Enregistrer cet appareil
            </h3>
            <p className="text-xs text-indigo-800/80 mt-0.5">
              Statut actuel : <strong className="uppercase font-bold">{pushStatus}</strong>
            </p>
            {pushStatus === 'denied' ? (
              <p className="text-[11px] text-red-600 font-medium mt-1.5 bg-red-50 p-2 rounded-lg border border-red-100 flex items-start gap-1">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>Vous avez bloqué les notifications. Ouvrez l'application dans un nouvel onglet ou autorisez-les dans les réglages du navigateur.</span>
              </p>
            ) : (
              <p className="text-[11px] text-indigo-700 mt-0.5">
                Autorisez les notifications dans votre navigateur pour tester la réception en temps réel.
              </p>
            )}
          </div>
          <button
            onClick={handleSelfSubscribe}
            disabled={testLoading}
            className="h-9 px-3.5 text-xs font-bold rounded-xl transition-all shadow-xs flex shrink-0 items-center gap-1.5 disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
          >
            {testLoading && <Loader2 size={14} className="animate-spin" />}
            Autoriser et S'abonner
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <form onSubmit={handleSend} className="p-4 sm:p-5 space-y-4">
          <div className="space-y-3.5 p-3.5 sm:p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
            {/* Quick Templates */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">
                Modèles de messages rapides
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                {templates.map((t, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="h-7 px-2.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Copy size={12} className="text-indigo-500" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Roles */}
            <div className="pt-2 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">
                Cibles (Rôles)
              </label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {roles.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleToggleRole(r.id)}
                    className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      roleFilters.includes(r.id) 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <UserCheck size={14} />
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 italic">
                Si aucun rôle n'est sélectionné, la notification sera envoyée à l'ensemble des utilisateurs enregistrés.
              </p>
            </div>

            {/* Filter by class with ClassSelectorPill */}
            {((roleFilters.length === 0) || roleFilters.includes('STUDENT') || roleFilters.includes('PARENT')) && (
              <div className="pt-2.5 border-t border-slate-100 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap size={15} className="text-indigo-600" />
                  Filtrer par Classe (Optionnel)
                </label>
                <div className="w-full sm:w-1/2">
                  <ClassSelectorPill
                    classes={classes}
                    selectedClassId={classId}
                    onSelectClass={(id) => setClassId(id === 'all' ? '' : id)}
                    allowAll={true}
                    allLabel="Toutes les classes"
                    variant="field"
                    size="sm"
                    colorScheme="indigo"
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Titre de la notification
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Alerte de retard, Bulletin disponible..."
                className="w-full px-3 py-2 bg-slate-50/50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Ex: Les bulletins du trimestre sont maintenant disponibles sur le portail."
                rows={3}
                className="w-full px-3 py-2 bg-slate-50/50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Lien de redirection (Optionnel)
                </label>
                <span className="text-[10px] text-slate-400 italic">Ouvert au clic</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LinkIcon className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Ex: /bulletins ou https://..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50/50 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Envoyer la notification
            </button>
          </div>
        </form>
      </div>


    </div>
  );
};

export default PushModule;
