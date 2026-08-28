import React from 'react';
import { Sparkles, Star, MapPin, Phone, Mail } from 'lucide-react';
import { useSchool } from '../../contexts/SchoolContext';
import { ReportCardStudent } from './types';

export const getMaternelleStarInfo = (score: number | null, maxScore: number = 100) => {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return {
      emoji: "⏳",
      stars: "⭐️⭐️⭐️",
      label: "Non Évalué",
      subtext: "En attente d'évaluation",
      color: "bg-slate-100 text-slate-700 border-slate-300",
    };
  }
  const max = maxScore > 0 ? maxScore : 100;
  const ratio = score / max;
  if (ratio >= 0.85) {
    return {
      emoji: "😍",
      stars: "⭐️⭐️⭐️⭐️",
      label: "Très Bien",
      subtext: "Acquis avec grande aisance",
      color: "bg-emerald-100 text-emerald-900 border-emerald-400",
    };
  }
  if (ratio >= 0.70) {
    return {
      emoji: "😊",
      stars: "⭐️⭐️⭐️",
      label: "Acquis",
      subtext: "Bien maîtrisé et consolidé",
      color: "bg-blue-100 text-blue-900 border-blue-400",
    };
  }
  if (ratio >= 0.50) {
    return {
      emoji: "😐",
      stars: "⭐️⭐️",
      label: "En Cours",
      subtext: "En développement progressif",
      color: "bg-amber-100 text-amber-900 border-amber-400",
    };
  }
  return {
    emoji: "😟",
    stars: "⭐️",
    label: "À Encourager",
    subtext: "Éveil & Premier Pas à stimuler",
    color: "bg-rose-100 text-rose-900 border-rose-400",
  };
};

export const MaternelleReportCardItem: React.FC<{
  student: ReportCardStudent;
  term: string;
  year: string;
  school: any;
  campusName?: string;
  isLast?: boolean;
}> = ({ student, term, year, school, campusName, isLast }) => {
  const { terminology } = useSchool();

  return (
    <div
      className={`bg-white p-[1cm] mb-12 border border-amber-200 print:border-none print:mb-0 w-full max-w-[21cm] mx-auto min-h-[29.7cm] flex flex-col ${
        isLast ? '' : 'page-break-after-always'
      } font-sans report-card-printable text-slate-900 rounded-3xl shadow-2xl relative`}
    >
      {/* Decorative Header */}
      <div className="flex items-center justify-between border-b-2 border-amber-400 pb-3 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 flex items-center justify-center overflow-hidden flex-shrink-0 bg-white rounded-2xl border border-amber-200 p-1">
            {school?.logo_url ? (
              <img
                src={school.logo_url}
                alt="Logo"
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
              />
            ) : (
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            )}
          </div>
          <div className="space-y-0.5">
            <h1 className="text-xl font-black text-amber-950 tracking-tight">
              {school?.name || "Établissement Maternelle"}
            </h1>
            <p className="text-xs font-bold text-amber-700 italic">
              "Éveil, Épanouissement & Apprentissage du Tout-Petit"
            </p>
            {school?.address && (
              <p className="flex items-center gap-1.5 text-[10px] font-medium text-slate-700 pt-0.5">
                <MapPin size={11} className="text-amber-600 shrink-0" />
                <span>{school.address}</span>
              </p>
            )}
            {(school?.phone || school?.email || campusName) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-medium text-slate-600">
                {campusName && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold text-[9.5px] border border-amber-300">
                    Campus : {campusName}
                  </span>
                )}
                {school?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={10} className="text-amber-700 shrink-0" />
                    <span>Tél : {school.phone}</span>
                  </span>
                )}
                {school?.email && (
                  <span className="flex items-center gap-1">
                    <Mail size={10} className="text-amber-700 shrink-0" />
                    <span>{school.email}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="text-right text-[10px] font-black uppercase text-amber-900 tracking-wider space-y-0.5">
          <p>République d'Haïti</p>
          <p>Section Petite Enfance & Maternelle</p>
          <div className="mt-1 px-3 py-1 bg-amber-100 text-amber-900 rounded-full font-black text-center border border-amber-300 shadow-2xs">
            Période : {term}
          </div>
        </div>
      </div>

      {/* Main Title Badge */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-3 px-8 py-2 bg-gradient-to-r from-amber-100 via-orange-100 to-amber-100 border-2 border-amber-400 rounded-2xl shadow-2xs">
          <Sparkles className="w-5 h-5 text-amber-600" />
          <h2 className="text-base sm:text-lg font-black text-amber-950 uppercase tracking-widest">
            Bilan d'Évaluation de Maternelle & Éveil
          </h2>
          <Sparkles className="w-5 h-5 text-amber-600" />
        </div>
        <p className="text-xs font-bold text-slate-500 mt-1">
          {terminology.academicYear || 'Année Scolaire'} : {year.replace(' (Active)', '')}
        </p>
      </div>

      {/* Student Identity Card */}
      <div className="grid grid-cols-12 gap-3 bg-amber-50/70 border-2 border-amber-200 p-3.5 rounded-2xl mb-4">
        <div className="col-span-6 border-r border-amber-200 pr-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-amber-800">
            Nom & Prénom de l'Enfant ({terminology.student || 'Élève'})
          </p>
          <p className="text-base font-black text-amber-950">{student.name}</p>
        </div>
        <div className="col-span-3 border-r border-amber-200 px-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-amber-800">
            {terminology.class || 'Classe'}
          </p>
          <p className="text-sm font-black text-slate-900">{student.class}</p>
        </div>
        <div className="col-span-3 pl-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-amber-800">Matricule</p>
          <p className="text-xs font-bold text-slate-700 font-mono">{student.nisu}</p>
        </div>
      </div>

      {/* Legend Card */}
      <div className="bg-white border border-amber-300 rounded-2xl p-3 mb-4 shadow-2xs">
        <p className="text-[10px] font-black uppercase text-amber-900 tracking-wider mb-1.5 flex items-center gap-1.5">
          <span>🌟</span> Guide des Mentions (Smileys & Étoiles) :
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
            <span>😍</span>
            <span className="font-bold">⭐️⭐️⭐️⭐️</span>
            <span className="font-black text-emerald-900">Très Bien</span>
          </div>
          <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200">
            <span>😊</span>
            <span className="font-bold">⭐️⭐️⭐️</span>
            <span className="font-black text-blue-900">Acquis</span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
            <span>😐</span>
            <span className="font-bold">⭐️⭐️</span>
            <span className="font-black text-amber-900">En Cours</span>
          </div>
          <div className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
            <span>😟</span>
            <span className="font-bold">⭐️</span>
            <span className="font-black text-rose-900">À Encourager</span>
          </div>
        </div>
      </div>

      {/* Competency Table */}
      <table className="w-full border-collapse border-2 border-amber-300 rounded-2xl overflow-hidden mb-4 shadow-2xs text-xs">
        <thead>
          <tr className="bg-amber-100/90 text-amber-950 font-black uppercase tracking-wider text-[10px]">
            <th className="border border-amber-300 px-4 py-2 text-left">
              Domaines d'Apprentissage & Activités
            </th>
            <th className="border border-amber-300 px-4 py-2 text-center w-56">
              Mention, Smileys & Étoiles
            </th>
            <th className="border border-amber-300 px-4 py-2 text-left">
              Observation Pédagogique
            </th>
          </tr>
        </thead>
        <tbody>
          {student.grades.map((grade, idx) => {
            const starInfo = getMaternelleStarInfo(grade.note, grade.coef || 100);
            return (
              <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                <td className="border border-amber-200 px-4 py-2 font-bold text-slate-900">
                  {grade.name}
                </td>
                <td className="border border-amber-200 px-3 py-2 text-center">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black shadow-2xs ${starInfo.color}`}
                  >
                    <span className="text-sm">{starInfo.emoji}</span>
                    <span>{starInfo.stars}</span>
                    <span>{starInfo.label}</span>
                  </div>
                </td>
                <td className="border border-amber-200 px-4 py-2 text-[11px] font-medium text-slate-600 italic">
                  {starInfo.subtext} — Bon développement des compétences.
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Global Appreciation Box */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 mb-4 shadow-2xs">
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-900 mb-1">
          Appréciation Globale de l'Équipe Éducative
        </p>
        <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
          ✨{" "}
          {student.average >= 8
            ? "Enfant très dynamique, sociable, curieux(se) et pleinement épanoui(e). Excellents progrès dans l'ensemble des ateliers sensoriels et moteurs !"
            : student.average >= 5
            ? "Bon travail et participation positive. L'enfant s'investit avec enthousiasme dans les activités de groupe."
            : "L'enfant poursuit son rythme d'apprentissage. Encouragements chaleureux de l'équipe pour la période suivante !"}
        </p>
      </div>

      {/* Signatures Footer */}
      <div className="mt-auto pt-4 border-t-2 border-amber-300 grid grid-cols-3 gap-4 text-center text-xs">
        <div>
          <p className="text-[10px] font-black uppercase text-amber-900 tracking-wider mb-8">
            L'Éducateur(trice)
          </p>
          <div className="border-b border-dashed border-slate-300 w-32 mx-auto"></div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-amber-900 tracking-wider mb-8">
            Les Parents
          </p>
          <div className="border-b border-dashed border-slate-300 w-32 mx-auto"></div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-amber-900 tracking-wider mb-8">
            {school?.global_settings?.signature_title || terminology.directionSignature || "La Direction"}
          </p>
          <div className="border-b border-dashed border-slate-300 w-32 mx-auto mb-1"></div>
          {school?.director_name && (
            <p className="text-[9px] font-black uppercase text-slate-800 tracking-wide">
              {school.director_name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
