import React from 'react';
import { Award, ShieldCheck, CheckCircle2, UserCheck, Calendar, Bookmark, Building, GraduationCap, MapPin, Phone, Mail } from 'lucide-react';
import { useSchool } from '../../contexts/SchoolContext';
import { ReportCardStudent, ReportCardOptions } from './types';
import { MaternelleReportCardItem } from './MaternelleReportCardItem';

export const getMention = (average: number, base: number = 10) => {
  const score = base === 10 ? average : (average / base) * 10;
  if (score >= 9) return "Excellence";
  if (score >= 8) return "Très Bien";
  if (score >= 7) return "Bien";
  if (score >= 6) return "Assez Bien";
  if (score >= 5) return "Passable";
  return "Insuffisant";
};

export const getDecision = (average: number, base: number = 10, termConfig?: { admittedText?: string; resitText?: string; failedText?: string; class?: string }) => {
  const score = base === 10 ? average : (average / base) * 10;
  if (score >= 5) return termConfig?.admittedText || `ADMIS(E) EN ${(termConfig?.class || "classe").toUpperCase()} SUPÉRIEURE`;
  if (score >= 4.5) return termConfig?.resitText || "DÉCISION DU CONSEIL / SOUS RÉSERVE";
  return termConfig?.failedText || "REDOUBLEMENT SUGGÉRÉ";
};

export const ReportCardItem: React.FC<{
  student: ReportCardStudent;
  term: string;
  year: string;
  school: any;
  campusName?: string;
  isLast?: boolean;
  options?: Partial<ReportCardOptions>;
  availableExams?: string[];
}> = ({
  student,
  term,
  year,
  school,
  campusName,
  isLast,
  options = {},
  availableExams = [],
}) => {
  if (student.isMaternelle) {
    return (
      <MaternelleReportCardItem
        student={student}
        term={term}
        year={year}
        school={school}
        campusName={campusName}
        isLast={isLast}
      />
    );
  }

  const { terminology } = useSchool();

  const gradeCount = student.grades.length;
  const forcedDensity = options.density || 'auto';
  const isDense = forcedDensity === 'dense' || (forcedDensity === 'auto' && gradeCount > 8);
  const isSuperDense = forcedDensity === 'super-dense' || (forcedDensity === 'auto' && gradeCount > 13);

  const mention = getMention(student.average, student.base || 10);
  const isLastExam = availableExams.length > 0 && term === availableExams[availableExams.length - 1];
  const decision = isLastExam
    ? getDecision(student.annualAverage || student.average, student.base || 10, terminology)
    : null;
  const isHonorRoll = student.average >= (student.base ? student.base * 0.8 : 8);

  const schoolType = school?.school_type;
  const isUniversity = schoolType === 'UNIVERSITE' || schoolType === 'SUPERIEUR';

  const colorMode = options.colorMode || 'monochrome';
  const isColor = colorMode === 'color';

  return (
    <div
      className={`bg-white ${
        isSuperDense
          ? 'p-[0.5cm] sm:p-[0.65cm]'
          : isDense
          ? 'p-[0.7cm] sm:p-[0.85cm]'
          : 'p-[0.85cm] sm:p-[1cm]'
      } mb-8 border border-slate-200 print:border-none print:mb-0 print:p-[0.6cm] w-full max-w-[21cm] mx-auto min-h-[29.7cm] flex flex-col justify-between ${
        isLast ? '' : 'page-break-after-always'
      } font-sans report-card-printable ${isColor ? 'theme-color' : 'theme-monochrome'} text-slate-900 rounded-2xl shadow-xl relative transition-all`}
      style={{
        boxSizing: 'border-box'
      }}
    >
      {/* Top Section */}
      <div>
        {/* Modern Official Header */}
        <div className={`flex items-center justify-between ${isSuperDense ? 'pb-2 mb-2' : isDense ? 'pb-2.5 mb-2.5' : 'pb-3 mb-3'} border-b-2 border-slate-900`}>
          {/* Institution Crest & Identity */}
          <div className="flex items-center gap-4">
            <div className={`${isSuperDense ? 'w-13 h-13' : isDense ? 'w-15 h-15' : 'w-18 h-18'} flex items-center justify-center overflow-hidden flex-shrink-0 bg-white rounded-xl border border-slate-200 p-1 shadow-2xs`}>
              {school?.logo_url ? (
                <img
                  src={school.logo_url}
                  alt="Logo de l'école"
                  className="w-full h-full object-contain"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <img src="/logo.png" alt="Logo de l'école" className="w-full h-full object-contain" />
              )}
            </div>

            <div className="space-y-0.5">
              <h1 className={`${isSuperDense ? 'text-base' : isDense ? 'text-lg' : 'text-xl'} font-black text-slate-950 tracking-tight leading-tight uppercase font-serif`}>
                {school?.name || "Établissement Académique"}
              </h1>
              {school?.motto && (
                <p className="text-[10px] font-semibold text-slate-600 italic">
                  « {school.motto} »
                </p>
              )}
              {school?.address && (
                <p className="flex items-center gap-1.5 text-[9.5px] font-medium text-slate-700 font-sans pt-0.5">
                  <MapPin size={11} className="text-slate-400 shrink-0" />
                  <span>{school.address}</span>
                </p>
              )}
              {(school?.phone || school?.email) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9.5px] font-medium text-slate-600 font-sans">
                  {school?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={10} className="text-slate-400 shrink-0" />
                      <span>Tél : {school.phone}</span>
                    </span>
                  )}
                  {school?.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={10} className="text-slate-400 shrink-0" />
                      <span>{school.email}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Info: Campus & Accreditation */}
          <div className="text-right flex flex-col items-end shrink-0 pl-3">
            {campusName && (
              <span className="inline-flex items-center gap-1 font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/80 text-[9px] mb-1">
                <Building size={10} className="text-indigo-600" />
                Campus : {campusName}
              </span>
            )}
            {school?.license_number ? (
              <div className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[8px] font-bold border border-slate-200">
                N° Agrément : {school.license_number}
              </div>
            ) : (
              <div className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded font-sans text-[8px] font-bold border border-slate-200 uppercase tracking-wider">
                Document Officiel
              </div>
            )}
          </div>
        </div>

        {/* Title Bar with Clean, Ink-Saving Frame */}
        <div className={`${isSuperDense ? 'mb-2' : isDense ? 'mb-2.5' : 'mb-3'}`}>
          <div className="bg-slate-100/90 text-slate-900 border border-slate-300 px-3.5 py-1.5 rounded-lg flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <GraduationCap size={15} className="text-slate-700" />
              <span className={`${isSuperDense ? 'text-xs' : 'text-sm'} font-black uppercase tracking-[0.15em] font-serif text-slate-900`}>
                {terminology.reportCardTitle || (isUniversity ? 'Relevé de Notes & Crédits Académiques' : 'Bulletin de Notes & Évaluation')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-700 bg-white px-2.5 py-0.5 rounded border border-slate-200 shadow-2xs">
              <span className="font-black text-slate-900">{term}</span>
              <span>•</span>
              <span>{terminology.academicYear || 'Année'} : {year.replace(' (Active)', '')}</span>
            </div>
          </div>
        </div>

        {/* Student Identity Matrix - Executive ID Card Style */}
        <div
          className={`border border-slate-300 bg-slate-50/70 ${
            isSuperDense ? 'p-2 mb-2 rounded-lg' : isDense ? 'p-2.5 mb-2.5 rounded-xl' : 'p-3 mb-3.5 rounded-xl'
          } grid grid-cols-12 gap-2 text-xs font-sans shadow-2xs relative`}
        >
          {/* Student Full Name */}
          <div className="col-span-5 border-r border-slate-200 pr-2">
            <p className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">
              {terminology.student || "Élève"} / Nom & Prénom
            </p>
            <p className={`font-black ${isSuperDense ? 'text-xs' : 'text-sm'} text-slate-950 leading-normal py-0.5 overflow-visible break-words`}>
              {student.name}
            </p>
          </div>

          {/* Student Matricule / NISU */}
          <div className="col-span-3 border-r border-slate-200 pr-2">
            <p className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">
              Matricule (NISU)
            </p>
            <p className={`font-bold ${isSuperDense ? 'text-[11px]' : 'text-xs'} text-slate-800 font-mono leading-normal py-0.5 overflow-visible`}>
              {student.nisu || 'N/A'}
            </p>
          </div>

          {/* Student Class / Option */}
          <div className="col-span-2 border-r border-slate-200 pr-2">
            <p className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">
              {terminology.class || "Classe"}
            </p>
            <p className={`font-bold ${isSuperDense ? 'text-[11px]' : 'text-xs'} text-indigo-950 leading-normal py-0.5 overflow-visible break-words`}>
              {student.class}
            </p>
          </div>

          {/* Rank & Distinction in Student Bar */}
          <div className="col-span-2 flex flex-col justify-center items-end">
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
              Rang : <span className="text-slate-900 font-black">{student.place}</span>
            </p>
            {isHonorRoll && options.showHonorsBadge !== false && (
              <span className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[8px] font-black tracking-tight uppercase">
                <Award size={9} className="text-emerald-700" />
                Excellence
              </span>
            )}
          </div>
        </div>

        {/* Academic Performance Table */}
        <div className={`overflow-hidden border border-slate-400 rounded-lg shadow-2xs ${isSuperDense ? 'mb-2' : isDense ? 'mb-2.5' : 'mb-3.5'}`}>
          <table className="w-full border-collapse font-sans text-left">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-400 text-slate-900 text-[9px] sm:text-[9.5px] uppercase tracking-wider font-bold">
                <th className={`px-2.5 ${isSuperDense ? 'py-1' : isDense ? 'py-1.5' : 'py-2'} font-black text-slate-900`}>
                  {terminology.subjects || "Matières"}
                </th>
                {isLastExam &&
                  availableExams.slice(0, -1).map((ex) => (
                    <th
                      key={ex}
                      className="px-1 py-1 text-center font-bold text-[8px] text-slate-700 whitespace-nowrap border-l border-slate-300"
                    >
                      {ex.replace('Contrôle', 'C.').replace('Trimestre', 'T.').replace('Période', 'P.')}
                    </th>
                  ))}
                <th className={`px-2 ${isSuperDense ? 'py-1 w-20' : isDense ? 'py-1.5 w-24' : 'py-2 w-26'} text-center font-black border-l border-slate-300 bg-slate-200/60 text-slate-900`}>
                  Note {isLastExam ? <span className="block text-[7.5px] opacity-80 font-normal">({term.replace('Contrôle', 'C.')})</span> : ''}
                </th>
                <th className={`px-2 ${isSuperDense ? 'py-1 w-14' : isDense ? 'py-1.5 w-16' : 'py-2 w-18'} text-center font-bold border-l border-slate-300 text-slate-800`}>
                  {terminology.creditsOrCoef || "Coef."}
                </th>
                <th className={`px-2 ${isSuperDense ? 'py-1 w-20' : isDense ? 'py-1.5 w-22' : 'py-2 w-24'} text-center font-bold border-l border-slate-300 bg-slate-200/60 text-slate-900`}>
                  Total
                </th>
                {isLastExam && (
                  <th className={`px-2 ${isSuperDense ? 'py-1 w-18' : isDense ? 'py-1.5 w-20' : 'py-2 w-22'} text-center font-black border-l border-slate-300 bg-emerald-100 text-emerald-950`}>
                    Moy. Ann.
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[10px] text-slate-950">
              {(() => {
                // Compute column totals for each past term if isLastExam
                const termTotals: Record<string, number> = {};
                if (isLastExam) {
                  availableExams.slice(0, -1).forEach((ex) => {
                    let sum = 0;
                    student.grades.forEach((g) => {
                      if (g.termScores?.[ex] !== null && g.termScores?.[ex] !== undefined) {
                        sum += g.termScores[ex]!;
                      }
                    });
                    termTotals[ex] = sum;
                  });
                }

                // Sum of all 4 controls across all subjects
                const grandTotalAllControls = isLastExam
                  ? Object.values(termTotals).reduce((a, b) => a + b, 0) + student.total
                  : (student.isMaxPointsSystem ? student.total : student.grades.reduce((acc, g) => acc + (g.note !== null ? g.note * g.coef : 0), 0));

                return (
                  <>
                    {student.grades.map((grade, i) => {
                      const isFailing = grade.note !== null && (student.isMaxPointsSystem ? grade.note < grade.coef / 2 : grade.note < 5);
                      const isHigh = grade.note !== null && (student.isMaxPointsSystem ? grade.note >= grade.coef * 0.8 : grade.note >= 8);

                      // Calculate subject total across all available controls
                      const subjectAllScores = isLastExam
                        ? [
                            ...(availableExams.slice(0, -1).map((ex) => grade.termScores?.[ex])),
                            grade.note
                          ].filter((v): v is number => v !== null && v !== undefined)
                        : [grade.note].filter((v): v is number => v !== null && v !== undefined);

                      const subjectTotalSum = subjectAllScores.reduce((acc, s) => acc + s, 0);

                      const rowTotal = isLastExam
                        ? (student.isMaxPointsSystem ? subjectTotalSum.toFixed(2) : (grade.annualNote !== null && grade.annualNote !== undefined ? (grade.annualNote * grade.coef).toFixed(2) : '-'))
                        : (grade.note !== null ? (student.isMaxPointsSystem ? grade.note.toFixed(2) : (grade.note * grade.coef).toFixed(2)) : '-');

                      return (
                        <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/70 hover:bg-slate-100' : 'bg-white hover:bg-slate-50'}>
                          <td className={`px-2.5 ${isSuperDense ? 'py-0.5' : isDense ? 'py-1' : 'py-1.5'} font-bold text-slate-950 whitespace-normal break-words leading-snug`}>
                            {grade.name}
                          </td>

                          {isLastExam &&
                            availableExams.slice(0, -1).map((ex) => (
                              <td
                                key={ex}
                                className={`px-1 ${isSuperDense ? 'py-0.5' : 'py-1'} text-center text-[9.5px] font-semibold text-slate-900 border-l border-slate-200`}
                              >
                                {grade.termScores?.[ex] !== null && grade.termScores?.[ex] !== undefined
                                  ? grade.termScores[ex]!.toFixed(1)
                                  : '-'}
                              </td>
                            ))}

                          {/* Term Grade */}
                          <td className={`px-2 ${isSuperDense ? 'py-0.5' : isDense ? 'py-1' : 'py-1.5'} text-center font-black border-l border-slate-200 ${
                            isFailing ? 'text-rose-700 bg-rose-50/80 font-black' : isHigh ? 'text-slate-950 font-black' : 'text-slate-900 font-bold'
                          }`}>
                            {grade.note !== null ? grade.note.toFixed(2) : '-'}
                          </td>

                          {/* Coefficient / Max Points */}
                          <td className={`px-2 ${isSuperDense ? 'py-0.5' : isDense ? 'py-1' : 'py-1.5'} text-center text-slate-900 font-bold border-l border-slate-200`}>
                            {grade.coef.toFixed(1)}
                          </td>

                          {/* Total Points */}
                          <td className={`px-2 ${isSuperDense ? 'py-0.5' : isDense ? 'py-1' : 'py-1.5'} text-center font-mono text-[9.5px] font-black text-slate-950 border-l border-slate-200 bg-slate-50/80`}>
                            {rowTotal}
                          </td>

                          {/* Annual Average Note */}
                          {isLastExam && (
                            <td className={`px-2 ${isSuperDense ? 'py-0.5' : isDense ? 'py-1' : 'py-1.5'} text-center font-black border-l border-slate-200 bg-emerald-50 text-emerald-950`}>
                              {grade.annualNote !== null && grade.annualNote !== undefined
                                ? grade.annualNote.toFixed(2)
                                : '-'}
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {/* Total & Summary Row with Grand Totals (Light Ink-Friendly Clean Style) */}
                    <tr className="bg-slate-100 border-t-2 border-slate-500 text-slate-950 font-black text-[10px]">
                      <td className={`px-2.5 ${isSuperDense ? 'py-1' : isDense ? 'py-1.5' : 'py-2'} uppercase tracking-widest text-right font-black text-slate-900`}>
                        {terminology.totalRow || "TOTAL GÉNÉRAL"}
                      </td>
                      {isLastExam &&
                        availableExams.slice(0, -1).map((ex) => (
                          <td
                            key={ex}
                            className={`px-1 ${isSuperDense ? 'py-1' : isDense ? 'py-1.5' : 'py-2'} text-center font-black text-slate-900 border-l border-slate-300`}
                          >
                            {termTotals[ex] !== undefined ? termTotals[ex].toFixed(2) : '-'}
                          </td>
                        ))}
                      <td className={`px-2 ${isSuperDense ? 'py-1' : isDense ? 'py-1.5' : 'py-2'} text-center font-black text-slate-950 border-l border-slate-300 bg-slate-200/50`}>
                        {student.total.toFixed(2)}
                      </td>
                      <td className={`px-2 ${isSuperDense ? 'py-1' : isDense ? 'py-1.5' : 'py-2'} text-center font-black text-slate-900 border-l border-slate-300`}>
                        {student.totalCoef.toFixed(1)}
                      </td>
                      <td className={`px-2 ${isSuperDense ? 'py-1' : isDense ? 'py-1.5' : 'py-2'} text-center font-mono font-black text-slate-950 border-l border-slate-300 bg-slate-200/80`}>
                        {grandTotalAllControls.toFixed(2)}
                      </td>
                      {isLastExam && (
                        <td className="border-l border-slate-300 bg-emerald-100 text-emerald-950 text-center font-black">
                          {student.annualAverage ? student.annualAverage.toFixed(2) : '-'}
                        </td>
                      )}
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* Executive Synthesis & Certification Bento */}
        <div className={`grid grid-cols-12 gap-2.5 font-sans ${isSuperDense ? 'mb-2' : isDense ? 'mb-2.5' : 'mb-3'}`}>
          {/* Left Block: Core Results & Performance */}
          <div className={`col-span-7 border border-slate-300 rounded-xl bg-white p-3 shadow-2xs flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                  Bilan Académique
                </span>
                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Système : Base {student.base || 10} pts
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Period Average Box */}
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                    {terminology.periodAverage || "Moyenne Période"}
                  </p>
                  <p className={`${isSuperDense ? 'text-base' : 'text-lg sm:text-xl'} font-black text-slate-950 mt-0.5`}>
                    {student.average.toFixed(2)} <span className="text-xs text-slate-500 font-semibold">/ {student.base || 10}</span>
                  </p>
                </div>

                {/* Annual Average or Class Benchmark */}
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                    {isLastExam ? (terminology.annualAverage || 'Moyenne Annuelle') : (terminology.classAverage || `Moyenne ${terminology.class || 'Classe'}`)}
                  </p>
                  <p className={`${isSuperDense ? 'text-base' : 'text-lg sm:text-xl'} font-black text-indigo-950 mt-0.5`}>
                    {isLastExam ? (
                      <>
                        {student.annualAverage?.toFixed(2) || '0.00'} <span className="text-xs text-slate-500 font-semibold">/ {student.base || 10}</span>
                      </>
                    ) : (
                      <>
                        {student.classAverage?.toFixed(2) || '0.00'} <span className="text-xs text-slate-500 font-semibold">/ {student.base || 10}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Mention & Rank Footer */}
            <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Mention :</span>
                <span className={`font-black uppercase tracking-wider text-[11px] ${
                  student.average >= (student.base ? student.base * 0.7 : 7) ? 'text-emerald-700' : student.average >= (student.base ? student.base * 0.5 : 5) ? 'text-slate-800' : 'text-rose-600'
                }`}>
                  {mention}
                </span>
              </div>
              <div className="text-[10px] font-bold text-slate-600">
                Rang : <span className="font-black text-slate-900">{student.place}</span>
              </div>
            </div>
          </div>

          {/* Right Block: Decision & Direction Observations */}
          <div className="col-span-5 border border-slate-300 rounded-xl bg-white p-3 shadow-2xs flex flex-col justify-between">
            <div>
              <p className="text-[8.5px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <ShieldCheck size={12} className="text-emerald-600" />
                {isLastExam ? (terminology.decisionLabel || "Décision du Conseil d'Orientation") : `Observation & Avis (${terminology.director || 'Direction'})`}
              </p>

              {isLastExam ? (
                <div className="my-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                  <span className={`text-[11px] font-black uppercase tracking-tight leading-tight ${
                    decision?.includes('ADMIS') || decision?.includes('VALIDÉ') ? 'text-emerald-800' : 'text-amber-800'
                  }`}>
                    {decision}
                  </span>
                </div>
              ) : (
                <div className="my-2 p-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-[9.5px] text-slate-700 italic leading-relaxed min-h-[52px] flex items-center">
                  {student.average >= 8
                    ? "Excellent travail et assiduité remarquable. Félicitations du corps professoral."
                    : student.average >= 5
                    ? "Résultats satisfaisants. Poursuivre les efforts avec régularité."
                    : "Travail insuffisant. Des efforts supplémentaires sont vivement recommandés au prochain contrôle."}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 text-[8px] text-slate-400 font-medium uppercase tracking-wider flex items-center justify-between">
              <span>Évaluation Périodique</span>
              <span className="text-emerald-700 font-bold">Validée</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Official Signature & Administration Endorsement */}
      <div className={`mt-auto border-t-2 border-slate-900 ${isSuperDense ? 'pt-2' : isDense ? 'pt-2.5' : 'pt-3'}`}>
        {(() => {
          // Signatory configuration
          const signerTitle = school?.global_settings?.signature_title || terminology.directionSignature || (isUniversity ? "Le Doyen / Le Rectorat" : "La Direction Pédagogique");
          const directorPrincipalName = school?.director_name || school?.global_settings?.signatory_name || "Le Directeur Principal";

          return (
            <div className="flex justify-end font-sans px-1 pb-1">
              {/* Official Direction / Principal Signature Block */}
              <div className="text-center relative min-w-[220px] sm:min-w-[260px] max-w-[290px]">
                {school?.stamp_url && options.showStamp !== false && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-20 h-20 flex items-center justify-center pointer-events-none z-0">
                    <img
                      src={school.stamp_url}
                      alt="Sceau Officiel"
                      className="w-full h-full object-contain opacity-80 rotate-2"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                
                {/* Authority Title */}
                <p className="text-[9.5px] font-black text-slate-800 uppercase tracking-widest mb-10 relative z-10">
                  {signerTitle}
                </p>
                
                {/* Official Signature Line */}
                <div className="w-full border-b-2 border-slate-900 mb-1.5 relative z-10"></div>
                
                {/* Principal Director Name */}
                <p className="text-[10.5px] font-black text-slate-950 uppercase tracking-wider relative z-10 leading-tight">
                  {directorPrincipalName}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Security Microtext Watermark Footer - 100% Institution Adapted */}
        <div className="text-center mt-2.5 pt-1.5 border-t border-slate-100">
          <p className="text-[7.5px] font-bold text-slate-400 tracking-[0.2em] uppercase">
            {terminology.reportCardDocName || "Document Académique Officiel"} • {school?.name || "Administration de l'Établissement"}
          </p>
        </div>
      </div>
    </div>
  );
};

