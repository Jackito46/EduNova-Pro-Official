import React from 'react';
import { UserProfile } from '../types';
import { useStudent } from '../hooks/useStudent';
import { UserCircle, Mail, Phone, MapPin, GraduationCap, ShieldAlert, ArrowRight } from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';
import { Link } from 'react-router-dom';
import { formatStudentName } from '../utils/formatters';

interface StudentProfileViewProps {
  user: UserProfile;
}

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({ user }) => {
  const { terminology } = useSchool();
  const { studentData, loading } = useStudent(user);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="animate-spin text-indigo-600 rounded-full border-2 border-slate-200 border-t-indigo-600 w-7 h-7"></div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="p-6 text-center bg-white rounded-2xl shadow-2xs border border-slate-200 mt-4 max-w-lg mx-auto">
        <ShieldAlert className="mx-auto h-10 w-10 text-slate-400 mb-2" />
        <h2 className="text-base font-bold text-slate-800">Dossier introuvable</h2>
        <p className="text-xs text-slate-500 mt-1">Impossible de trouver un dossier étudiant lié à votre compte.</p>
      </div>
    );
  }

  const { fullName, firstName, lastName } = formatStudentName(studentData.last_name, studentData.first_name);

  return (
    <div className="max-w-4xl mx-auto space-y-3 sm:space-y-3.5 animate-in fade-in duration-200">
      {/* Header Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shrink-0">
            <UserCircle size={18} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Mon Dossier Étudiant</h1>
            <p className="text-[11px] font-medium text-slate-400">
              Informations d'identification, scolarité et contact
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${
            studentData.status === 'Actif' 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${studentData.status === 'Actif' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>Statut : {studentData.status || 'Actif'}</span>
          </span>
        </div>
      </div>

      {/* Grid Principal Compact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-3.5 items-stretch">
        {/* Identité / Carte Élève */}
        <div className="md:col-span-1 border border-slate-200/90 bg-white rounded-2xl shadow-2xs p-3.5 sm:p-4 flex flex-col items-center text-center justify-between">
          <div className="flex flex-col items-center w-full">
            <div className="relative mb-2">
              <div className="w-16 h-16 sm:w-18 sm:h-18 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100 overflow-hidden shadow-2xs">
                {studentData.photo_url ? (
                  <img src={studentData.photo_url} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl sm:text-2xl font-black text-indigo-600">
                    {firstName?.[0] || ''}{lastName?.[0] || 'E'}
                  </span>
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
            </div>

            <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
              {fullName}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {studentData.class?.name || terminology.class}
            </p>

            <div className="mt-2 inline-flex items-center gap-1 font-mono bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md text-[10.5px] font-bold">
              <span>Matricule:</span>
              <span className="text-indigo-700">{studentData.code || studentData.reference_number || 'SANS-MATRICULE'}</span>
            </div>
          </div>

          <div className="w-full pt-2.5 mt-2.5 border-t border-slate-100 flex flex-col gap-1 text-left text-xs">
            <Link
              to="/mon-economat"
              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100/80 text-amber-900 font-bold text-[11px] flex items-center justify-between transition-colors"
            >
              <span>Mon Économat</span>
              <ArrowRight size={12} className="text-amber-700" />
            </Link>
            <Link
              to="/mes-notes"
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 font-bold text-[11px] flex items-center justify-between transition-colors"
            >
              <span>Relevé de Notes</span>
              <ArrowRight size={12} className="text-emerald-700" />
            </Link>
          </div>
        </div>

        {/* Détails Formulaires Compacts */}
        <div className="md:col-span-2 space-y-2.5 sm:space-y-3 flex flex-col justify-between">
          {/* Informations Académiques */}
          <div className="border border-slate-200/90 bg-white rounded-2xl shadow-2xs p-3 sm:p-3.5">
            <h3 className="text-[10.5px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 pb-1 border-b border-slate-100">
              <GraduationCap size={12} className="text-indigo-600" />
              <span>Informations Académiques</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                <span className="text-[9.5px] text-slate-400 font-semibold block">{terminology.class}</span>
                <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">{studentData.class?.name || 'Non assigné'}</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                <span className="text-[9.5px] text-slate-400 font-semibold block">Statut Actuel</span>
                <p className="text-xs font-bold text-emerald-700 mt-0.5">{studentData.status || 'Actif'}</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                <span className="text-[9.5px] text-slate-400 font-semibold block">Genre / Sexe</span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{studentData.gender || '--'}</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                <span className="text-[9.5px] text-slate-400 font-semibold block">Date de Naissance</span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">
                  {studentData.dob ? new Date(studentData.dob).toLocaleDateString('fr-FR') : '--'}
                </p>
              </div>
            </div>
          </div>

          {/* Coordonnées (Contact) */}
          <div className="border border-slate-200/90 bg-white rounded-2xl shadow-2xs p-3 sm:p-3.5">
            <h3 className="text-[10.5px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 pb-1 border-b border-slate-100">
              <Phone size={12} className="text-indigo-600" />
              <span>Coordonnées &amp; Communication</span>
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 p-1.5 px-2 rounded-xl bg-slate-50/70 border border-slate-100">
                <Mail size={13} className="text-indigo-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] text-slate-400 font-semibold uppercase">Email</span>
                  <p className="text-[11px] sm:text-xs font-bold text-slate-900 truncate">{studentData.parent_email || user.email || '--'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-1.5 px-2 rounded-xl bg-slate-50/70 border border-slate-100">
                <Phone size={13} className="text-indigo-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] text-slate-400 font-semibold uppercase">Téléphone Parent / Tuteur</span>
                  <p className="text-[11px] sm:text-xs font-bold text-slate-900 font-mono truncate">{studentData.parent_phone || '--'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-1.5 px-2 rounded-xl bg-slate-50/70 border border-slate-100">
                <MapPin size={13} className="text-indigo-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] text-slate-400 font-semibold uppercase">Adresse Résidentielle</span>
                  <p className="text-[11px] sm:text-xs font-bold text-slate-900 truncate">{studentData.address || 'Non spécifiée'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
