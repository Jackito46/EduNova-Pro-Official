import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { UserProfile, UserRole } from '../types';
import { Loader2, ShieldAlert, History, User, Calendar, Tag, FileText, X } from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    role: string;
    campus_id: string | null;
  } | null;
}

export const AuditLogsView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { terminology, campuses, currentCampusId, school } = useSchool();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastAuditError, setLastAuditError] = useState<string | null>(null);
  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>('ALL');

  const userBelongsToSiege = user.email === 'vilinfo2014@gmail.com' || (user.campus_id === null || user.campus_id === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490');
  const hasMultiCampusActive = Boolean(school?.has_multi_campus && campuses && campuses.length > 1);
  const canManageAllCampuses = hasMultiCampusActive && (!user.campus_id || userBelongsToSiege);

  const translateAction = (action: string) => {
    const map: Record<string, string> = {
      'LOGIN': 'Connexion',
      'LOGOUT': 'Déconnexion',
      'CREATE': 'Création',
      'UPDATE': 'Modification',
      'DELETE': 'Suppression',
      'PAYMENT_PROCESSED': 'Paiement',
      'FIRE_STAFF': 'Licenciement',
      'PASSWORD_RESET': 'Réinit. Mot de Passe',
      'RESET_PASSWORD': 'Réinit. Mot de Passe',
    };
    return map[action] || action;
  };

  const translateEntity = (entity: string) => {
    const map: Record<string, string> = {
      'auth': 'Authentification',
      'student': terminology?.student || 'Élève',
      'staff': 'Personnel',
      'class': terminology?.class || 'Classe',
      'payment': 'Paiement',
      'expense': 'Dépense',
      'subject': terminology?.subject || 'Matière',
      'class_subject': `${terminology?.subject || 'Matière'} par ${terminology?.class || 'Classe'}`,
      'grade': 'Note',
      'attendance': 'Présence',
      'user': 'Utilisateur',
      'school': 'École',
    };
    return map[entity] || entity;
  };

  const generateActionDescription = (log: AuditLog) => {
    const { action, entity_type, details } = log;
    let obj = details;
    if (typeof details === 'string') {
      try { obj = JSON.parse(details); } catch (e) {}
    }

    if (action === 'LOGIN') return "Connexion à la plateforme.";
    if (action === 'LOGOUT') return "Déconnexion de la plateforme.";
    if (action === 'PASSWORD_RESET' || action === 'RESET_PASSWORD') {
      const forcedText = obj?.forced_change || obj?.forceChange ? "Changement forcé requis." : "Changement non forcé.";
      return `Réinitialisation du mot de passe pour l'utilisateur ${obj?.target_user || ''}. ${forcedText}`;
    }
    
    if (action === 'CREATE') {
      if (entity_type === 'student') return `Inscription d'un(e) nouvel(le) ${terminology.student.toLowerCase()}.`;
      if (entity_type === 'class') return `Création de la ${terminology.class.toLowerCase()} ${obj?.name || ''} ${obj?.level || ''}.`;
      if (entity_type === 'staff') {
        if (obj?.type === 'payroll_period') return `Création de la période de paie (${obj?.period || ''}).`;
        if (obj?.type === 'payroll_slip') return `Génération de fiche de paie pour ${obj?.staff_name || ''} (${obj?.period || ''}).`;
        if (obj?.type === 'payroll_batch') return `Génération de ${obj?.count || 0} fiches de paie (${obj?.period || ''}).`;
        return `Embauche d'un membre du personnel (${obj?.first_name || ''} ${obj?.last_name || ''}).`;
      }
      if (entity_type === 'expense') return `Enregistrement d'une dépense de ${obj?.amount ?? ''} (${obj?.label || ''}).`;
      if (entity_type === 'payment') {
        if (obj?.type === 'supplies_payment') {
          return `Achat de fournitures de ${obj?.total_amount ?? ''} ${obj?.currency || ''} pour l'${terminology.student.toLowerCase()} ${obj?.student_name || ''}.`;
        }
        if (obj?.type === 'school_supplies_record') {
          return `Enregistrement d'un pack de fournitures de ${obj?.amount ?? ''} pour l'${terminology.student.toLowerCase()} ${obj?.student_name || ''}.`;
        }
        if (obj?.type === 'supply_payment') {
          return `Enregistrement d'un versement de fournitures de ${obj?.amount ?? ''} pour l'${terminology.student.toLowerCase()} ${obj?.student_name || ''}.`;
        }
        return `Enregistrement d'un paiement.`;
      }
      if (entity_type === 'user') return `Création d'un nouvel utilisateur (${obj?.full_name || obj?.email || ''} - ${obj?.role || ''}).`;
    }
    
    if (action === 'FIRE_STAFF') {
      const notice = obj?.notice_amount ? ` | Préavis: ${obj.notice_amount.toLocaleString()} HTG` : '';
      return `Licenciement de ${obj?.name || 'un employé'}. Motif: ${obj?.reason || 'Non spécifié'}${notice}.`;
    }
    
    if (action === 'FIRE_STAFF') {
      return `Licenciement de ${obj?.name || 'un employé'} (${obj?.role || ''}).`;
    }

    if (action === 'UPDATE') {
      if (entity_type === 'student') {
        if (obj?.type === 'reenrollment') return `Réinscription de l'${terminology.student.toLowerCase()} pour la ${terminology.academicYear.toLowerCase()}.`;
        return `Mise à jour du dossier de l'${terminology.student.toLowerCase()}.`;
      }
      if (entity_type === 'class') return `Modification de la ${terminology.class.toLowerCase()} ${obj?.name || ''}.`;
      if (entity_type === 'staff') {
        if (obj?.type === 'payroll_slip') return `Mise à jour de la fiche de paie de ${obj?.staff_name || ''} (${obj?.period || ''}).`;
        return `Mise à jour du dossier du personnel (${obj?.first_name || ''} ${obj?.last_name || ''}).`;
      }
      if (entity_type === 'expense') return `Modification d'une dépense de ${obj?.amount ?? ''} (${obj?.label || ''}).`;
      if (entity_type === 'user') return `Modification des accès d'un utilisateur.`;
      if (entity_type === 'settings') return `Mise à jour des paramètres de l'établissement.`;
    }
    
    if (action === 'DELETE') {
      if (entity_type === 'student') return `Suppression d'un dossier ${terminology.student.toLowerCase()}.`;
      if (entity_type === 'class') return `Suppression d'un(e) ${terminology.class.toLowerCase()}.`;
      if (entity_type === 'staff') return `Suppression d'un dossier personnel.`;
      if (entity_type === 'user') return `Suppression de l'utilisateur ${obj?.user_name || ''}.`;
    }
    
    if (action === 'PAYMENT_PROCESSED') {
      if (entity_type === 'staff') {
        return `Paiement de salaire de ${obj?.amount ?? ''} ${obj?.currency || ''} enregistré pour ${obj?.staff_name || ''} (Période: ${obj?.period || ''}).`;
      }
      return `Paiement de ${obj?.amount ?? ''} ${obj?.currency || ''} enregistré (${obj?.feeType || ''}).`;
    }

    return `${translateAction(action)} sur l'entité ${translateEntity(entity_type)}.`;
  };

  const formatDetails = (log: AuditLog) => {
    const { details } = log;
    const description = generateActionDescription(log);

    if (!details) return <span className="text-gray-700">{description}</span>;
    
    try {
      const obj = typeof details === 'string' ? JSON.parse(details) : details;
      
      if (log.action === 'FIRE_STAFF') {
        return (
          <div className="flex flex-col gap-2">
            <div className="font-medium text-red-700">{description}</div>
            <div className="bg-red-50 p-3 rounded-lg border border-red-100 space-y-1">
              <p className="text-sm text-red-800"><span className="font-semibold">Motif:</span> {obj.reason}</p>
              {obj.notice_amount > 0 && (
                <p className="text-sm text-red-800"><span className="font-semibold">Indemnité de préavis:</span> {obj.notice_amount.toLocaleString()} HTG</p>
              )}
            </div>
          </div>
        );
      }

      // Filter out technical noise
      const cleanObj = { ...obj };
      delete cleanObj.timestamp;
      delete cleanObj.url;
      delete cleanObj.userAgent;
      delete cleanObj.type; // Handled in description
      
      return (
        <div className="flex flex-col gap-2">
          <div className="font-bold text-slate-900 leading-tight break-words">{description}</div>
          
          {Object.keys(cleanObj).length > 0 && (
            <div className="flex flex-col gap-1 bg-gray-50 p-2 rounded border border-gray-100">
              {Object.entries(cleanObj).map(([key, value]) => {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                let formattedValue = String(value);
                if (typeof value === 'object' && value !== null) {
                   formattedValue = JSON.stringify(value);
                }
                
                return (
                  <div key={key} className="text-xs break-words">
                    <span className="font-semibold text-slate-500">{formattedKey}:</span>{' '}
                    <span className="text-slate-800 break-all">{formattedValue}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    } catch (e) {
      return (
        <div className="flex flex-col gap-2">
          <div className="font-medium text-gray-800">{description}</div>
          <span className="text-gray-500 text-xs">{String(details)}</span>
        </div>
      );
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Check for any insert errors
    try {
      const err = window.localStorage.getItem('last_audit_error');
      if (err) {
        setLastAuditError(err);
      }
    } catch (e) {}
  }, [user.school_id, user.is_super_admin, currentCampusId]);

  const fetchLogs = async () => {
    if (!user.school_id && !user.is_super_admin) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id(full_name, email, role, campus_id)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (user.school_id) {
        query = query.eq('school_id', user.school_id);
      }

      if (user.role === UserRole.SECRETARY) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'LOGIN': return 'bg-blue-100 text-blue-800';
      case 'LOGOUT': return 'bg-gray-100 text-gray-800';
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-yellow-100 text-yellow-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'PAYMENT_PROCESSED': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (currentCampusId) {
      if (log.profiles?.campus_id !== currentCampusId) return false;
    }
    // If not global admin, only show this user's campus logs
    if (!canManageAllCampuses) {
      return log.profiles?.campus_id === user.campus_id;
    }

    // If global admin, apply the campus filter dropdown
    if (selectedCampusFilter === 'ALL') return true;
    if (selectedCampusFilter === 'SIEGE') {
      return !log.profiles?.campus_id || log.profiles?.campus_id === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
    }
    return log.profiles?.campus_id === selectedCampusFilter;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="text-blue-600" />
            Journal d'Audit (Traçabilité)
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Historique des actions effectuées sur la plateforme pour votre établissement.
          </p>
        </div>
        
        {canManageAllCampuses && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtrer par Annexe :</span>
            <select
              value={selectedCampusFilter}
              onChange={(e) => setSelectedCampusFilter(e.target.value)}
              className="px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-bold shadow-sm outline-none focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="ALL">Toutes les annexes</option>
              <option value="SIEGE">Siège Social uniquement</option>
              {campuses
                .filter(c => !c.name.toLowerCase().includes('siège'))
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              }
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <ShieldAlert size={20} />
          {error}
        </div>
      )}

      {lastAuditError && (
        <div className="bg-orange-50 text-orange-800 p-4 rounded-xl border border-orange-200 relative animate-in fade-in duration-200">
          <button 
            onClick={() => {
              try {
                window.localStorage.removeItem('last_audit_error');
              } catch (e) {}
              setLastAuditError(null);
            }}
            className="absolute top-3 right-3 p-1 text-orange-400 hover:text-orange-700 hover:bg-orange-100 rounded-lg transition-all cursor-pointer"
            title="Effacer cette alerte d'historique"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 font-bold mb-2">
            <ShieldAlert size={18} className="text-orange-600" />
            Erreur lors du dernier enregistrement d'audit (Historisée) :
          </div>
          <pre className="text-xs bg-white p-3 rounded-lg border border-orange-100 overflow-auto font-mono text-slate-700">
            {lastAuditError}
          </pre>
          <p className="text-xs mt-2.5 text-orange-600 font-semibold">
            Cette erreur appartenait à un ancien format UUID de base de données. Le correctif a été appliqué avec succès avec une traçabilité unifiée. Vous pouvez effacer en toute sécurité cette ancienne alerte en cliquant sur le bouton de fermeture.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest">
                <th className="px-6 py-4 border-b border-slate-700 whitespace-nowrap">Date & Heure</th>
                <th className="px-6 py-4 border-b border-slate-700 whitespace-nowrap">Utilisateur</th>
                {hasMultiCampusActive && <th className="px-6 py-4 border-b border-slate-700 whitespace-nowrap">Annexe</th>}
                <th className="px-6 py-4 border-b border-slate-700 whitespace-nowrap">Action</th>
                <th className="px-6 py-4 border-b border-slate-700 whitespace-nowrap">Entité</th>
                <th className="px-6 py-4 border-b border-slate-700">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={hasMultiCampusActive ? 6 : 5} className="p-8 text-center text-gray-500">
                    Aucun journal d'audit trouvé pour ce filtre.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const logCampusId = log.profiles?.campus_id;
                  const isSiegeLog = !logCampusId || logCampusId === '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
                  const campusName = isSiegeLog 
                    ? "Siège Social" 
                    : (campuses.find(c => c.id === logCampusId)?.name || 'Inconnue');

                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="p-4 align-top text-sm text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" />
                          {new Date(log.created_at).toLocaleString('fr-FR')}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {log.profiles?.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {log.profiles?.full_name || 'Utilisateur inconnu'}
                            </div>
                            <div className="text-xs text-gray-500">{log.profiles?.role}</div>
                          </div>
                        </div>
                      </td>
                      {hasMultiCampusActive && (
                        <td className="p-4 align-top whitespace-nowrap">
                          {isSiegeLog ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[9px] font-black uppercase tracking-wider">
                              Siège Social
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-[9px] font-bold uppercase tracking-wider">
                              {campusName}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="p-4 align-top">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                          {translateAction(log.action)}
                        </span>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Tag size={14} className="text-gray-400 shrink-0" />
                          <span className="capitalize">{translateEntity(log.entity_type)}</span>
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="max-w-[220px] sm:max-w-[300px] md:max-w-[400px] lg:max-w-[500px] xl:max-w-[700px] whitespace-normal break-words">
                          {formatDetails(log)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
