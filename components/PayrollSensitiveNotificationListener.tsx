import React, { useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { ShieldAlert, AlertTriangle, ArrowRight, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface PayrollSensitiveNotificationListenerProps {
  user: UserProfile;
}

export interface SensitivePayrollAlertItem {
  id: string;
  created_at: string;
  staff_name?: string;
  staff_id?: string;
  slip_id?: string;
  admin_name?: string;
  admin_role?: string;
  admin_id?: string;
  period_name?: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  summary: string;
  reasons: string[];
  diff?: {
    base_salary?: number;
    bonuses?: number;
    deductions?: number;
    net_salary?: number;
  };
}

/**
 * Joue un signal sonore discret et professionnel pour avertir d'une modification sensible
 */
const playSensitiveAlertSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Premier oscillateur : son doux
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    // Deuxième oscillateur harmonisé
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, now + 0.08); // A4
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.22); // E5
    gain2.gain.setValueAtTime(0.05, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.35);
  } catch (e) {
    // Audio non autorisé ou bloqué par le navigateur, ignorer silencieusement
  }
};

export const PayrollSensitiveNotificationListener: React.FC<PayrollSensitiveNotificationListenerProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const lastProcessedIdRef = useRef<string | null>(null);

  const canReceiveAlerts = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ACCOUNTANT'].includes(user.role);

  useEffect(() => {
    if (!canReceiveAlerts || !user.school_id) return;

    const channelName = `payroll_audit_sensitive_${user.school_id}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs'
        },
        (payload: any) => {
          const newRecord = payload.new;
          if (!newRecord) return;
          if (newRecord.school_id && newRecord.school_id !== user.school_id) return;
          if (lastProcessedIdRef.current === newRecord.id) return;
          lastProcessedIdRef.current = newRecord.id;

          const details = newRecord.details || {};
          const isPayrollType = 
            details.type === 'payroll_slip' || 
            newRecord.entity_type === 'payroll_slip' ||
            (newRecord.action && newRecord.action.startsWith('PAYROLL'));

          if (!isPayrollType) return;

          // RBAC : Pour un administrateur d'annexe (sans droits super-admin), ignorer les alertes d'autres annexes
          const isSuperUser = Boolean(user.is_super_admin || (user.role as any) === 'SUPER_ADMIN');
          if (user.campus_id && !isSuperUser) {
            const eventCampusId = details.campus_id || newRecord.campus_id;
            if (eventCampusId && eventCampusId !== user.campus_id) {
              return;
            }
          }

          // Déterminer la sensibilité
          const isSensitive = details.is_sensitive === true || newRecord.action === 'PAYROLL_SENSITIVE_UPDATE';
          if (!isSensitive) return;

          const severity: 'CRITICAL' | 'WARNING' | 'INFO' = details.severity || 'WARNING';
          const staffName = details.staff_name || 'Employé';
          const adminName = details.admin_name || newRecord.profiles?.full_name || 'Un administrateur';
          const adminRole = details.admin_role || newRecord.profiles?.role || 'Admin';
          const summary = details.summary || (details.sensitivity_reasons && details.sensitivity_reasons[0]) || 'Modification sensible sur la paie';
          const periodName = details.period_name || details.period || '';
          const slipId = details.slip_id || newRecord.entity_id;
          const staffId = details.staff_id;

          // Sauvegarder dans le cache local des alertes sensibles
          try {
            const rawStored = localStorage.getItem('edunova_recent_sensitive_payroll_alerts');
            const currentList: SensitivePayrollAlertItem[] = rawStored ? JSON.parse(rawStored) : [];
            const newAlertItem: SensitivePayrollAlertItem = {
              id: newRecord.id,
              created_at: newRecord.created_at || new Date().toISOString(),
              staff_name: staffName,
              staff_id: staffId,
              slip_id: slipId,
              admin_name: adminName,
              admin_role: adminRole,
              admin_id: newRecord.user_id,
              period_name: periodName,
              severity,
              summary,
              reasons: details.sensitivity_reasons || [summary],
              diff: details.diff
            };
            const updatedList = [newAlertItem, ...currentList.filter(a => a.id !== newRecord.id)].slice(0, 30);
            localStorage.setItem('edunova_recent_sensitive_payroll_alerts', JSON.stringify(updatedList));
          } catch (e) {
            // Ignorer erreur de stockage
          }

          // Émettre un événement personnalisé pour que le module Paie se rafraîchisse instantanément
          window.dispatchEvent(new CustomEvent('edunova-sensitive-payroll-alert', { 
            detail: { log: newRecord, details } 
          }));

          // Jouer le carillon d'alerte discret
          playSensitiveAlertSound();

          // Déclencher le toast Sonner interactif et riche
          const isCritical = severity === 'CRITICAL';
          const isAuthor = newRecord.user_id === user.id;

          toast.custom(
            (t) => (
              <div
                id={`sensitive-payroll-alert-${newRecord.id}`}
                className={`w-full max-w-md p-3.5 sm:p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all flex flex-col gap-2.5 ${
                  isCritical
                    ? 'bg-rose-950/95 text-rose-50 border-rose-600/80 shadow-rose-950/50'
                    : 'bg-amber-950/95 text-amber-50 border-amber-600/80 shadow-amber-950/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        isCritical ? 'bg-rose-600 text-white' : 'bg-amber-500 text-amber-950 font-bold'
                      }`}
                    >
                      {isCritical ? <ShieldAlert size={16} /> : <AlertTriangle size={16} />}
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-wider opacity-90 flex items-center gap-1.5">
                        <span>Alerte Paie Sensible</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/15 font-bold">
                          Temps Réel
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white truncate max-w-[240px]">
                        {staffName} {periodName ? `• ${periodName}` : ''}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toast.dismiss(t)}
                    className="text-white/60 hover:text-white text-xs p-1 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="text-[11px] leading-relaxed bg-black/25 p-2 rounded-xl border border-white/10 font-medium">
                  <p className="text-white/95 font-semibold">{summary}</p>
                  <p className="text-white/70 text-[10px] mt-1 flex items-center gap-1">
                    <User size={10} />
                    <span>
                      Effectuée par : <strong className="text-white">{isAuthor ? 'Vous-même' : adminName}</strong> ({adminRole})
                    </span>
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[10px] text-white/60">
                    {new Date(newRecord.created_at || Date.now()).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        toast.dismiss(t);
                        // Ouvrir l'audit directement ou naviguer vers la paie
                        if (location.pathname.includes('/rh/payroll') || location.pathname.includes('/rh/gestion-salaires')) {
                          window.dispatchEvent(
                            new CustomEvent('open-target-payroll-audit', {
                              detail: { slipId, staffId, staffName, periodName }
                            })
                          );
                        } else {
                          navigate('/rh/payroll');
                          setTimeout(() => {
                            window.dispatchEvent(
                              new CustomEvent('open-target-payroll-audit', {
                                detail: { slipId, staffId, staffName, periodName }
                              })
                            );
                          }, 300);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black inline-flex items-center gap-1 transition-transform active:scale-95 cursor-pointer ${
                        isCritical
                          ? 'bg-rose-500 hover:bg-rose-400 text-white'
                          : 'bg-amber-400 hover:bg-amber-300 text-amber-950'
                      }`}
                    >
                      <span>Examiner l'audit</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ),
            {
              duration: isCritical ? 9000 : 6500,
              id: `sensitive-toast-${newRecord.id}`
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, user.school_id, user.role, canReceiveAlerts, location.pathname, navigate]);

  return null;
};
