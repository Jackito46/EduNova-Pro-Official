import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, FileText, Lock, CheckCircle2, Zap, UserCheck, X, Shield, Info, ArrowRight } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { useNavigate } from 'react-router-dom';

interface AutonomousAdminWarningBannerProps {
  user: UserProfile;
}

export const AutonomousAdminWarningBanner: React.FC<AutonomousAdminWarningBannerProps> = ({ user }) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  // Ne s'applique pas aux Super Admins ni aux élèves / parents
  if (
    user.is_super_admin || 
    user.role === UserRole.SUPER_ADMIN || 
    (user.role as any) === 'SUPER_ADMIN' ||
    user.role === UserRole.STUDENT ||
    user.role === UserRole.PARENT
  ) {
    return null;
  }

  // Actif si le profil est explicitement marqué is_autonomous ou n'a pas de staff_id lié
  const isAutonomous = Boolean(user.is_autonomous || (!user.staff_id && user.role === UserRole.SCHOOL_ADMIN));

  if (!isAutonomous || isDismissed) {
    return null;
  }

  const isAdmin = user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR;

  return (
    <>
      <aside 
        aria-label="Avertissement Compte en Mode Autonome"
        className="mb-4 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300/80 rounded-2xl p-3 sm:p-4 shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 -mt-2 -mr-2 w-24 h-24 bg-amber-200/40 rounded-full blur-xl pointer-events-none" />
        
        <div className="flex items-start sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              {isAdmin ? <ShieldAlert size={20} /> : <Zap size={20} />}
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-bold text-amber-950">
                  {isAdmin ? 'Compte Administrateur en Mode Autonome (Sous Tutelle RH)' : 'Compte Utilisateur en Mode Autonome (Sans dossier RH)'}
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 border border-amber-300">
                  Non Certifié RH
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5 font-medium leading-relaxed line-clamp-2 sm:line-clamp-1">
                Ce profil a été provisionné sans dossier collaborateur RH officiel. Les opérations sensibles (gestion des administrateurs, paie/payroll, passerelles bancaires et purge de données) sont restreintes conformément aux règles de sécurité de l'établissement.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Info size={13} />
              <span className="hidden sm:inline">Détails & Restrictions</span>
              <span className="sm:hidden">Détails</span>
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-200/50 rounded-lg transition-colors cursor-pointer"
              title="Masquer temporairement cette alerte"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Modal explicatif des 4 piliers de sécurité RH */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-5 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center shrink-0">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Cadre de Sécurité & Mode Autonome
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Gouvernance, imputabilité légale et politique RH de l'établissement
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl">
                <p className="text-xs sm:text-sm text-amber-900 font-semibold leading-relaxed">
                  <strong>Pourquoi ces restrictions ?</strong> En droit scolaire et financier, un utilisateur non identifié formellement (absence de CIN/NIF et de contrat de travail RH) ne peut légalement engager les finances de l'école ni modifier des privilèges de haute sécurité.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
                    <Lock size={15} />
                    <span>1. Noyau d'Administration</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Interdiction de supprimer, suspendre, réinitialiser ou dégrader un autre Administrateur du système.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
                    <Lock size={15} />
                    <span>2. Paie & Avances Salariales</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Interdiction de valider les bulletins de paie (Payroll), de débourser les salaires ou d'accorder des avances sans certification RH.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
                    <Lock size={15} />
                    <span>3. Coordonnées Bancaires & MonCash</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Les clés API passerelles de paiement et numéros de comptes récepteurs de frais scolaires sont réservés aux titulaires.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                    <UserCheck size={15} />
                    <span>4. Procédure de Régularisation</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Un Administrateur titulaire peut lever toutes ces restrictions à tout moment en liant ce compte à une fiche RH validée.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Régularisation disponible dans Gestion des Utilisateurs</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    navigate('/settings/utilisateurs');
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Aller aux Utilisateurs</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
