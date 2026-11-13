import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  MessageCircle,
  Phone,
  MapPin,
  Building2,
  Users,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Send,
  Save,
  Trash2,
  Search,
  Sparkles,
  Server,
  Key,
  ShieldCheck,
  Loader2,
  Clock
} from 'lucide-react';
import { supabase } from '../supabase';
import { toast } from 'sonner';

type DemoStatus = 'NEW' | 'CONTACTED' | 'SCHEDULED' | 'ARCHIVED';

interface DemoRequestItem {
  id: string;
  referenceCode: string;
  createdAt: string;
  updatedAt: string;
  schoolName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  schoolType: string;
  studentBracket: string;
  preferredChannel: 'both' | 'whatsapp' | 'email';
  notes: string;
  status: DemoStatus;
  adminNotes?: string;
  delivery: {
    savedToInbox: boolean;
    emailSent: boolean;
    emailRecipientsCount: number;
    emailReason?: string;
    whatsappAutoSent: boolean;
    whatsappReason?: string;
  };
}

interface RoutingFormState {
  publicEmail: string;
  notificationEmail: string;
  whatsappNumber: string;
  secondaryPhoneDisplay: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFromName: string;
  smtpFromAddress: string;
  smtpSource?: string;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  whatsappAutoReady?: boolean;
}

interface SuperAdminDemoInboxProps {
  onNewCountChange?: (count: number) => void;
}

const STATUS_BADGES: Record<DemoStatus, { label: string; className: string }> = {
  NEW: { label: 'Nouveau', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  CONTACTED: { label: 'Contacté', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  SCHEDULED: { label: 'Démo Planifiée', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ARCHIVED: { label: 'Clôturé', className: 'bg-slate-100 text-slate-600 border-slate-200' }
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatWaPhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 8) return `509${digits}`;
  return digits;
}

export const SuperAdminDemoInbox: React.FC<SuperAdminDemoInboxProps> = ({ onNewCountChange }) => {
  const [subTab, setSubTab] = useState<'inbox' | 'routing'>('inbox');
  const [loading, setLoading] = useState(true);
  const [savingRouting, setSavingRouting] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [requests, setRequests] = useState<DemoRequestItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | DemoStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [routing, setRouting] = useState<RoutingFormState>({
    publicEmail: 'contact@edunova-pro.tech',
    notificationEmail: '',
    whatsappNumber: '+509 3604-5639',
    secondaryPhoneDisplay: '3350-8416',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFromName: 'EduNova Pro · Secrétariat Démos',
    smtpFromAddress: '',
    whatsappPhoneNumberId: '',
    whatsappAccessToken: ''
  });

  const fetchDemoState = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/demo-requests', { headers });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Erreur serveur (${response.status})`);
      }

      const list: DemoRequestItem[] = Array.isArray(data.requests) ? data.requests : [];
      setRequests(list);
      onNewCountChange?.(list.filter((r) => r.status === 'NEW').length);

      if (data.routing) {
        setRouting({
          publicEmail: data.routing.publicEmail || 'contact@edunova-pro.tech',
          notificationEmail: data.routing.notificationEmail || '',
          whatsappNumber: data.routing.whatsappNumber || '+509 3604-5639',
          secondaryPhoneDisplay: data.routing.secondaryPhoneDisplay || '3350-8416',
          smtpHost: data.routing.smtpHost || '',
          smtpPort: Number(data.routing.smtpPort) || 587,
          smtpUser: data.routing.smtpUser || '',
          smtpPass: data.routing.smtpPassMasked || '',
          smtpFromName: data.routing.smtpFromName || 'EduNova Pro · Secrétariat Démos',
          smtpFromAddress: data.routing.smtpFromAddress || '',
          smtpSource: data.routing.smtpSource,
          whatsappPhoneNumberId: data.routing.whatsappPhoneNumberId || '',
          whatsappAccessToken: data.routing.whatsappAccessTokenMasked || '',
          whatsappAutoReady: !!data.routing.whatsappAutoReady
        });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de charger les demandes de démo.');
    } finally {
      setLoading(false);
    }
  }, [onNewCountChange]);

  useEffect(() => {
    fetchDemoState();
  }, [fetchDemoState]);

  const handleStatusChange = async (id: string, status: DemoStatus) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/admin/demo-requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Échec de mise à jour');
      }
      setRequests((prev) => {
        const next = prev.map((r) => (r.id === id ? data.request : r));
        onNewCountChange?.(next.filter((r) => r.status === 'NEW').length);
        return next;
      });
      toast.success('Statut mis à jour.');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur mise à jour du statut');
    }
  };

  const handleDeleteRequest = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/admin/demo-requests/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Suppression impossible');
      }
      setRequests((prev) => {
        const next = prev.filter((r) => r.id !== id);
        onNewCountChange?.(next.filter((r) => r.status === 'NEW').length);
        return next;
      });
      toast.success('Demande supprimée.');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la suppression');
    }
  };

  const handleSaveRouting = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRouting(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/demo-routing', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(routing)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de la sauvegarde');
      }
      if (data.routing) {
        setRouting((prev) => ({
          ...prev,
          publicEmail: data.routing.publicEmail || prev.publicEmail,
          notificationEmail: data.routing.notificationEmail || prev.notificationEmail,
          whatsappNumber: data.routing.whatsappNumber || prev.whatsappNumber,
          smtpPass: data.routing.smtpPassMasked || '',
          smtpSource: data.routing.smtpSource,
          whatsappAccessToken: data.routing.whatsappAccessTokenMasked || '',
          whatsappAutoReady: !!data.routing.whatsappAutoReady
        }));
      }
      toast.success('Routage Email, WhatsApp & SMTP enregistré avec chiffrement !');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur sauvegarde configuration');
    } finally {
      setSavingRouting(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/demo-routing/test-email', {
        method: 'POST',
        headers
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Échec du test SMTP');
      }
      toast.success(`Email test expédié avec succès vers : ${data.sentTo.join(', ')}`);
    } catch (err: any) {
      toast.error(err?.message || 'Échec du test SMTP');
    } finally {
      setTestingEmail(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.schoolName.toLowerCase().includes(q) ||
      r.contactName.toLowerCase().includes(q) ||
      r.phone.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.referenceCode.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const newCount = requests.filter((r) => r.status === 'NEW').length;
  const scheduledCount = requests.filter((r) => r.status === 'SCHEDULED').length;
  const emailSentCount = requests.filter((r) => r.delivery?.emailSent).length;

  return (
    <div className="space-y-6">
      {/* Header + Sub-tabs */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
              <Send size={13} />
              <span>Accueil Commercial &amp; Réception Publique</span>
            </div>
            <h2 className="text-xl font-black text-slate-950 tracking-tight">
              Demandes de Démonstration &amp; Routage Email / WhatsApp
            </h2>
            <p className="text-xs text-slate-500">
              Destination active des notifications : <strong className="text-slate-800">{routing.notificationEmail || routing.publicEmail}</strong> · WhatsApp : <strong className="text-slate-800">{routing.whatsappNumber}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSubTab('inbox')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                subTab === 'inbox'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Mail size={14} />
              <span>Boîte de Réception ({requests.length})</span>
              {newCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-black">
                  {newCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSubTab('routing')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                subTab === 'routing'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Server size={14} />
              <span>Configurer Email / WhatsApp &amp; SMTP</span>
            </button>

            <button
              type="button"
              onClick={fetchDemoState}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
              title="Actualiser"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Résumé indicateurs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Total Demandes</div>
            <div className="text-xl font-black text-slate-950 font-mono tabular-nums mt-0.5">{requests.length}</div>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200/80">
            <div className="text-[11px] font-bold text-indigo-700 uppercase">À Traiter (Nouvelles)</div>
            <div className="text-xl font-black text-indigo-950 font-mono tabular-nums mt-0.5">{newCount}</div>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
            <div className="text-[11px] font-bold text-emerald-700 uppercase">Démos Planifiées</div>
            <div className="text-xl font-black text-emerald-950 font-mono tabular-nums mt-0.5">{scheduledCount}</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Passerelle SMTP</div>
            <div className="text-xs font-bold mt-1 flex items-center gap-1.5">
              {routing.smtpSource && routing.smtpSource !== 'none' ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={14} /> Active ({emailSentCount} envoyés)
                </span>
              ) : (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertCircle size={14} /> À configurer
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {subTab === 'inbox' ? (
        <div className="space-y-4">
          {/* Barre de filtre */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher école, contact, téléphone, référence..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['ALL', 'NEW', 'CONTACTED', 'SCHEDULED', 'ARCHIVED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap border transition-colors ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {st === 'ALL' ? 'Toutes' : STATUS_BADGES[st].label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="animate-spin text-indigo-600" />
              <p className="text-xs font-semibold text-slate-500">Chargement des demandes...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <Mail size={30} className="mx-auto text-slate-300" />
              <h3 className="text-sm font-bold text-slate-900">Aucune demande de démonstration</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Toutes les demandes soumises depuis la page publique « Planifiez votre Démo EduNova Pro » apparaissent ici automatiquement, même si le serveur SMTP est hors ligne.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredRequests.map((item) => {
                const badge = STATUS_BADGES[item.status] || STATUS_BADGES.NEW;
                const replyWaUrl = `https://wa.me/${formatWaPhone(item.phone)}?text=${encodeURIComponent(
                  `Bonjour ${item.contactName},\nNous faisons suite à votre demande de démonstration EduNova Pro (${item.referenceCode}) pour l'établissement ${item.schoolName}. Quand êtes-vous disponible pour une présentation ?`
                )}`;
                const replyMailUrl = item.email
                  ? `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(
                      `Re: Démonstration EduNova Pro - ${item.schoolName} (${item.referenceCode})`
                    )}`
                  : '';

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {item.referenceCode}
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(item.createdAt).toLocaleString('fr-FR')}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
                          <Building2 size={16} className="text-indigo-600 shrink-0" />
                          <span>{item.schoolName}</span>
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.id, e.target.value as DemoStatus)}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer outline-none focus:border-indigo-600"
                        >
                          <option value="NEW">Nouveau</option>
                          <option value="CONTACTED">Contacté</option>
                          <option value="SCHEDULED">Démo Planifiée</option>
                          <option value="ARCHIVED">Clôturé</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(item.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Supprimer cette demande"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-slate-50 rounded-xl p-3.5 border border-slate-200/70">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Responsable</div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                          <Users size={13} className="text-indigo-600 shrink-0" />
                          <span>{item.contactName}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Téléphone / WhatsApp</div>
                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                          <Phone size={13} className="text-emerald-600 shrink-0" />
                          <span>{item.phone}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Email</div>
                        <div className="font-medium text-slate-800 truncate mt-0.5">
                          {item.email || <span className="text-slate-400 italic">Non renseigné</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Profil École</div>
                        <div className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                          <MapPin size={12} className="text-slate-500 shrink-0" />
                          <span>{item.city} · {item.studentBracket}</span>
                        </div>
                      </div>
                    </div>

                    {item.notes && (
                      <div className="text-xs text-slate-700 bg-indigo-50/40 border border-indigo-100 rounded-xl p-3 whitespace-pre-wrap">
                        <strong className="text-indigo-950">Message : </strong>
                        {item.notes}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            item.delivery?.emailSent
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {item.delivery?.emailSent ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {item.delivery?.emailSent
                            ? 'Alerte email transmise'
                            : item.delivery?.emailReason || 'Email non configuré'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Type : <strong className="text-slate-700">{item.schoolType}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={replyWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
                        >
                          <MessageCircle size={14} />
                          <span>Répondre sur WhatsApp</span>
                        </a>
                        {replyMailUrl && (
                          <a
                            href={replyMailUrl}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
                          >
                            <Mail size={14} />
                            <span>Répondre par Email</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSaveRouting} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne 1 : Destinataires de Réception */}
            <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-950">Canaux de Réception des Demandes</h3>
                  <p className="text-[11px] text-slate-500">Définit où arrivent les emails et messages WhatsApp</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Email(s) de Réception des Notifications *
                </label>
                <input
                  type="text"
                  value={routing.notificationEmail}
                  onChange={(e) => setRouting((prev) => ({ ...prev, notificationEmail: e.target.value }))}
                  placeholder="Ex: infostarstech2010@gmail.com, contact@edunova-pro.tech"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                />
                <p className="text-[11px] text-slate-500">
                  Chaque demande du formulaire envoie une alerte complète à cette adresse (vous pouvez en séparer plusieurs par une virgule).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Email Public Affiché sur la Page d&apos;Accueil
                </label>
                <input
                  type="email"
                  value={routing.publicEmail}
                  onChange={(e) => setRouting((prev) => ({ ...prev, publicEmail: e.target.value }))}
                  placeholder="contact@edunova-pro.tech"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Numéro WhatsApp Officiel
                  </label>
                  <input
                    type="text"
                    value={routing.whatsappNumber}
                    onChange={(e) => setRouting((prev) => ({ ...prev, whatsappNumber: e.target.value }))}
                    placeholder="+509 3604-5639"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Ligne Secrétariat Secondaire
                  </label>
                  <input
                    type="text"
                    value={routing.secondaryPhoneDisplay}
                    onChange={(e) => setRouting((prev) => ({ ...prev, secondaryPhoneDisplay: e.target.value }))}
                    placeholder="3350-8416"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MessageCircle size={14} className="text-emerald-600" />
                    <span>API WhatsApp Cloud (Meta — Envoi auto)</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    routing.whatsappAutoReady
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {routing.whatsappAutoReady ? 'Actif' : 'Optionnel'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Phone Number ID</label>
                    <input
                      type="text"
                      value={routing.whatsappPhoneNumberId}
                      onChange={(e) => setRouting((prev) => ({ ...prev, whatsappPhoneNumberId: e.target.value }))}
                      placeholder="Ex: 109876543210987"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Access Token Meta</label>
                    <input
                      type="password"
                      value={routing.whatsappAccessToken}
                      onChange={(e) => setRouting((prev) => ({ ...prev, whatsappAccessToken: e.target.value }))}
                      placeholder="EAAG..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Colonne 2 : Serveur SMTP Plateforme (Envoi automatique d'emails) */}
            <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Server size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-950">Passerelle SMTP Plateforme (Gmail / Domaine)</h3>
                    <p className="text-[11px] text-slate-500">Permet l&apos;envoi automatique des emails depuis la page publique</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRouting((prev) => ({
                      ...prev,
                      smtpHost: 'smtp.gmail.com',
                      smtpPort: 587
                    }))
                  }
                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Sparkles size={12} /> Gmail
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-800">Hôte SMTP</label>
                  <input
                    type="text"
                    value={routing.smtpHost}
                    onChange={(e) => setRouting((prev) => ({ ...prev, smtpHost: e.target.value }))}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">Port</label>
                  <input
                    type="number"
                    value={routing.smtpPort}
                    onChange={(e) => setRouting((prev) => ({ ...prev, smtpPort: Number(e.target.value) || 587 }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">Utilisateur SMTP (Email)</label>
                  <input
                    type="text"
                    value={routing.smtpUser}
                    onChange={(e) => setRouting((prev) => ({ ...prev, smtpUser: e.target.value }))}
                    placeholder="infostarstech2010@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Key size={12} className="text-amber-600" />
                    <span>Mot de passe d&apos;application</span>
                  </label>
                  <input
                    type="password"
                    value={routing.smtpPass}
                    onChange={(e) => setRouting((prev) => ({ ...prev, smtpPass: e.target.value }))}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">Nom d&apos;expéditeur</label>
                  <input
                    type="text"
                    value={routing.smtpFromName}
                    onChange={(e) => setRouting((prev) => ({ ...prev, smtpFromName: e.target.value }))}
                    placeholder="EduNova Pro · Démos"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">Email d&apos;expédition</label>
                  <input
                    type="email"
                    value={routing.smtpFromAddress}
                    onChange={(e) => setRouting((prev) => ({ ...prev, smtpFromAddress: e.target.value }))}
                    placeholder="infostarstech2010@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
                <ShieldCheck size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Les identifiants SMTP sont chiffrés en AES-256-GCM sur le serveur et ne sont jamais exposés à la page publique.
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testingEmail}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {testingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>Tester l&apos;envoi vers Email de Réception</span>
            </button>

            <button
              type="submit"
              disabled={savingRouting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {savingRouting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Enregistrer le Routage &amp; SMTP</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default SuperAdminDemoInbox;
