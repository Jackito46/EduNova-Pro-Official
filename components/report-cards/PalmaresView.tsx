import React from 'react';
import { Trophy, Award, TrendingUp, Users, CheckCircle2, XCircle, FileSpreadsheet, Download } from 'lucide-react';
import { ReportCardStudent } from './types';
import { getMention, getDecision } from './ReportCardItem';
import { useSchool } from '../../contexts/SchoolContext';

interface PalmaresViewProps {
  students: ReportCardStudent[];
  classNameTitle: string;
  term: string;
  yearLabel: string;
  campusName?: string;
  onExportPalmares: () => void;
  availableExams?: string[];
}

export const PalmaresView: React.FC<PalmaresViewProps> = ({
  students,
  classNameTitle,
  term,
  yearLabel,
  campusName,
  onExportPalmares,
  availableExams = [],
}) => {
  const { terminology } = useSchool();
  const isLastExam = availableExams.length > 0 && term === availableExams[availableExams.length - 1];

  const totalStudents = students.length;
  const passingStudents = students.filter(s => s.average >= (s.base ? s.base / 2 : 5));
  const passRate = totalStudents > 0 ? ((passingStudents.length / totalStudents) * 100).toFixed(1) : '0';
  const overallAvg = totalStudents > 0 ? (students.reduce((acc, s) => acc + s.average, 0) / totalStudents).toFixed(2) : '0.00';
  const topStudent = students[0];

  return (
    <div className="w-full max-w-5xl bg-white p-6 sm:p-10 rounded-3xl shadow-xl border border-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-300">
              Palmarès Officiel & Honneurs
            </span>
            {campusName && (
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold border border-indigo-100">
                🏛️ {campusName}
              </span>
            )}
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Palmarès de {terminology.class || 'Classe'} — {classNameTitle}
          </h3>
          <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">
            Période : {term} • Année : {yearLabel}
          </p>
        </div>

        <button
          onClick={onExportPalmares}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all transform active:scale-95"
        >
          <FileSpreadsheet size={16} />
          <span>Exporter le Palmarès (PDF)</span>
        </button>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-8">
        <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Effectif Classé</p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{totalStudents} <span className="text-xs font-semibold text-slate-500">{terminology.students?.toLowerCase() || 'élèves'}</span></p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Taux de Réussite</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">{passRate}%</p>
        </div>
        <div className="bg-blue-50 border border-blue-200/80 p-4 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-800">Moyenne Générale</p>
          <p className="text-xl sm:text-2xl font-black text-blue-900 mt-1">{overallAvg} <span className="text-xs font-semibold text-blue-600">/ 10</span></p>
        </div>
        <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Major de Promotion</p>
          <p className="text-sm font-black text-amber-950 truncate mt-1">{topStudent ? topStudent.name : '—'}</p>
          <p className="text-[11px] font-bold text-amber-700">{topStudent ? `${topStudent.average.toFixed(2)} / 10` : ''}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
              <th className="px-4 py-3 text-center w-16">Rang</th>
              <th className="px-4 py-3">Nom & Prénom</th>
              <th className="px-4 py-3 text-center">Matricule</th>
              <th className="px-4 py-3 text-center">Moyenne</th>
              <th className="px-4 py-3">Mention</th>
              {isLastExam && <th className="px-4 py-3 text-center">Moy. Annuelle</th>}
              <th className="px-4 py-3 text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s, idx) => (
              <tr
                key={s.id}
                className={`hover:bg-indigo-50/40 transition-colors ${
                  idx === 0
                    ? 'bg-amber-50/50 font-bold'
                    : idx === 1
                    ? 'bg-slate-50/80'
                    : idx === 2
                    ? 'bg-orange-50/30'
                    : ''
                }`}
              >
                <td className="px-4 py-3 text-center font-black text-sm">
                  {idx === 0 ? '🥇 1er' : idx === 1 ? '🥈 2e' : idx === 2 ? '🥉 3e' : s.place}
                </td>
                <td className="px-4 py-3">
                  <p className="font-black text-slate-900 text-sm">{s.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{s.nisu}</p>
                </td>
                <td className="px-4 py-3 text-center text-slate-700 font-mono text-[11px]">
                  {s.nisu}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-900 rounded-lg font-black text-xs border border-indigo-100">
                    {s.average.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold text-slate-700">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${
                      s.average >= 8
                        ? 'bg-emerald-100 text-emerald-800'
                        : s.average >= 6
                        ? 'bg-blue-100 text-blue-800'
                        : s.average >= 5
                        ? 'bg-slate-100 text-slate-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {getMention(s.average, s.base || 10)}
                  </span>
                </td>
                {isLastExam && (
                  <td className="px-4 py-3 text-center font-black text-emerald-800">
                    {s.annualAverage?.toFixed(2) || '—'}
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  {s.average >= (s.base ? s.base / 2 : 5) ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                      <CheckCircle2 size={12} />
                      Admis
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-rose-200">
                      <XCircle size={12} />
                      Ajourné
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
