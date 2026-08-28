import React, { useState, useEffect } from 'react';
import { Send, Bell, UserCheck, ShieldAlert, Loader2, Smartphone, GraduationCap, Copy, Search, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile } from '../types';
import { subscribeToPush } from '../utils/pushHelper';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';

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
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Notifications Push</h2>
          <p className="text-slate-700 mt-2 font-medium text-sm tracking-tight">
            Envoyez des alertes instantanées sur les téléphones et navigateurs de vos utilisateurs
          </p>
        </div>
        <div className="p-4 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center shadow-sm">
          <Bell size={28} />
        </div>
      </div>

      {pushStatus !== 'granted' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-indigo-900 flex items-center gap-2">
              <Smartphone size={18} />
              Enregistrer cet appareil
            </h3>
            <p className="text-sm text-indigo-800/80 mt-1">
              Statut actuel: <strong className="uppercase">{pushStatus}</strong>
            </p>
            {pushStatus === 'denied' ? (
              <p className="text-xs text-red-600 font-medium mt-2 bg-red-50 p-2 rounded-lg border border-red-100 flex items-start gap-1">
                <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
                <span>Vous avez bloqué les notifications ou l'environnement ne les permet pas (ex: iframe Ai Studio). Ouvrez l'app dans un nouvel onglet, ou cliquez sur l'icône de cadenas près de l'URL ({window.location.host}) pour les autoriser.</span>
              </p>
            ) : (
              <p className="text-xs text-indigo-700 mt-1">
                Vous devez autoriser les notifications dans votre navigateur pour tester la réception.
              </p>
            )}
          </div>
          <button
            onClick={handleSelfSubscribe}
            disabled={testLoading}
            className="px-5 py-2.5 font-bold rounded-lg transition-colors shadow-sm flex flex-shrink-0 items-center gap-2 disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {testLoading && <Loader2 size={16} className="animate-spin" />}
            Autoriser et S'abonner
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <form onSubmit={handleSend} className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 block flex items-center justify-between">
                  <span>Modèles de messages rapides</span>
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {templates.map((t, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors flex items-center gap-1.5"
                    >
                      <Copy size={12} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 block mt-2">Cibles (Rôles)</label>
                <div className="flex flex-wrap gap-2">
                  {roles.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleToggleRole(r.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${
                        roleFilters.includes(r.id) 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <UserCheck size={16} />
                      {r.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1 italic">
                  Si aucun rôle n'est sélectionné, la notification sera envoyée à tout le monde.
                </p>
              </div>

              {((roleFilters.length === 0) || roleFilters.includes('STUDENT') || roleFilters.includes('PARENT')) && (
                <div className="pt-3 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <GraduationCap size={16} className="text-indigo-600" />
                    Filtrer par Classe (Optionnel)
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full md:w-1/2 px-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                  >
                    <option value="">Toutes les classes</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Titre de la notification</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Alerte de retard, Bulletin Disponible..."
                className="w-full px-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                required
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Ex: Les bulletins du trimestre sont maintenant disponibles sur le portail."
                rows={3}
                className="w-full px-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                required
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 block">Lien de redirection (Optionnel)</label>
              <p className="text-[11px] text-slate-500 mb-2 italic">Ce lien s'ouvrira automatiquement quand l'utilisateur cliquera sur la notification.</p>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LinkIcon className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Ex: /bulletins ou https://..."
                  className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-3 hover:bg-black transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Envoyer la notification
            </button>
          </div>
        </form>
      </div>


    </div>
  );
};

export default PushModule;
