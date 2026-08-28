import React from 'react';
import { UserProfile, SchoolClass } from '../types';
import { useStudent } from '../hooks/useStudent';
import { UserCircle, Mail, Phone, MapPin, GraduationCap, ShieldAlert } from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';

interface StudentProfileViewProps {
  user: UserProfile;
}

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({ user }) => {
  const { terminology } = useSchool();
  const { studentData, loading } = useStudent(user);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin text-blue-600 rounded-full border-2 border-slate-200 border-t-blue-600 w-8 h-8"></div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-slate-100 mt-8">
        <ShieldAlert className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <h2 className="text-xl font-bold text-slate-700">Dossier introuvable</h2>
        <p className="text-slate-500 mt-2">Impossible de trouver un dossier étudiant lié à votre compte.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
         <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
           <UserCircle size={28} />
         </div>
         <div>
           <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mon Dossier Personnel</h1>
           <p className="text-sm font-medium text-slate-500">
             Consultez vos informations personnelles et académiques.
           </p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col items-center text-center p-8">
            <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
               {studentData.photo_url ? (
                 <img src={studentData.photo_url} alt="Profile" className="w-full h-full object-cover rounded-full" />
               ) : (
                 <UserCircle size={48} />
               )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">
              {studentData.first_name} <br/>
              <span className="text-slate-700 uppercase tracking-widest text-sm">{studentData.last_name}</span>
            </h2>
            <p className="text-blue-600 mt-2 font-mono bg-blue-50 px-3 py-1 rounded-full text-xs font-bold tracking-wider">
              {studentData.code || 'SANS-MATRICULE'}
            </p>
        </div>

        <div className="md:col-span-2 space-y-6">
           <div className="border border-slate-200 bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Informations Académiques</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <span className="text-xs text-slate-500 font-semibold">{terminology.class}</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{studentData.class?.name || 'Non assigné'}</p>
                 </div>
                 <div>
                    <span className="text-xs text-slate-500 font-semibold">Statut</span>
                    <p className="text-sm font-bold mt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] ${studentData.status === 'Actif' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {studentData.status || 'Inconnu'}
                      </span>
                    </p>
                 </div>
                 <div>
                    <span className="text-xs text-slate-500 font-semibold">Sexe</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{studentData.gender || '--'}</p>
                 </div>
                 <div>
                    <span className="text-xs text-slate-500 font-semibold">Date de Naissance</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{studentData.dob ? new Date(studentData.dob).toLocaleDateString() : '--'}</p>
                 </div>
              </div>
           </div>

           <div className="border border-slate-200 bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Coordonnées (Contact)</h3>
              <div className="space-y-3">
                 <div className="flex items-center gap-3">
                    <Mail size={16} className="text-slate-400" />
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Email</span>
                      <p className="text-sm font-bold text-slate-900">{studentData.parent_email || user.email}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <Phone size={16} className="text-slate-400" />
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Téléphone Principal</span>
                      <p className="text-sm font-bold text-slate-900">{studentData.parent_phone || '--'}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-slate-400" />
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Adresse</span>
                      <p className="text-sm font-bold text-slate-900">{studentData.address || '--'}</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
