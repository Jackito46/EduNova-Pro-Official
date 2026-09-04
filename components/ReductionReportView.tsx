import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  Search,
  Loader2,
  FileSpreadsheet,
  ShieldCheck,
  Filter,
  Printer,
  TrendingDown as ReductionIcon,
  Calculator,
  Building2,
  CheckCircle2,
  Sparkles,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../supabase';
import { UserProfile, SchoolClass } from '../types';
import jsPDF from 'jspdf';
import { useSecurity } from './SecurityGuard';
import { addSecurityWatermark } from '../utils/pdfWatermark';
import { appendSecuritySheet } from '../utils/excelWatermark';
import html2canvas from 'html2canvas';
import { formatStudentName } from '../utils/formatters';
import { fixOklchForCanvas } from '../utils/pdfFix';
import * as XLSX from 'xlsx';
import { useSchool } from '../contexts/SchoolContext';
import { SelectPill } from './SelectPill';
import { GraduationCap } from 'lucide-react';

const ReductionReportView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { terminology, currentCampusId, campuses, school } = useSchool();
  const { ipAddress } = useSecurity();
  const hasMultipleCampuses = Array.isArray(campuses) && campuses.length > 1;

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>(
    user?.campus_id || currentCampusId || 'ALL'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [activeYear, setActiveYear] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const getCampusName = (campusId?: string | null) => {
    if (!campusId) return 'Campus Principal';
    const found = campuses?.find(c => c.id === campusId);
    return found ? found.name : 'Campus Principal';
  };

  const fetchData = async () => {
    if (!user?.school_id) return;
    setLoading(true);
    try {
      // 1. Fetch active year
      const { data: years } = await supabase.from('academic_years').select('*').eq('school_id', user.school_id);
      const year = years?.find(y => y.is_active || y.status === 'ACTIVE') || years?.[0];
      setActiveYear(year);

      // 2. Fetch classes for filtering
      let classesQuery = supabase
        .from('classes')
        .select('*')
        .eq('school_id', user.school_id)
        .order('name');
        
      const activeCampus = user.campus_id || (selectedCampusFilter !== 'ALL' ? selectedCampusFilter : null);
      if (activeCampus) {
        classesQuery = classesQuery.eq('campus_id', activeCampus);
      }
      
      const { data: classesData } = await classesQuery;
      if (classesData) setClasses(classesData);

      // 3. Fetch students with discounts
      let studentsQuery = supabase
        .from('students')
        .select('*, class:classes(id, name, campus_id)')
        .eq('school_id', user.school_id)
        .gt('discount_amount', 0);
        
      if (activeCampus) {
        studentsQuery = studentsQuery.eq('campus_id', activeCampus);
      }
      
      const { data } = await studentsQuery.order('discount_amount', { ascending: false });
      setStudents(data || []);
    } catch (err) {
      console.error("Report error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.school_id, selectedCampusFilter, currentCampusId]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const name = formatStudentName(s.last_name, s.first_name).fullName.toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase()) ||
                            (s.discount_label || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            s.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = selectedClassId === 'ALL' || s.class_id === selectedClassId;
      const matchesCampus = selectedCampusFilter === 'ALL' || s.campus_id === selectedCampusFilter || s.class?.campus_id === selectedCampusFilter;
      return matchesSearch && matchesClass && matchesCampus;
    });
  }, [students, searchTerm, selectedClassId, selectedCampusFilter]);

  const totalReductions = useMemo(() => {
    return filteredStudents.reduce((sum, s) => sum + Number(s.discount_amount || 0), 0);
  }, [filteredStudents]);

  const avgReduction = useMemo(() => {
    return filteredStudents.length > 0 ? Math.round(totalReductions / filteredStudents.length) : 0;
  }, [totalReductions, filteredStudents.length]);

  const handleExportExcel = () => {
    if (filteredStudents.length === 0) return;
    const data = filteredStudents.map(s => {
      const row: any = {
        [terminology.student]: formatStudentName(s.last_name, s.first_name).fullName,
        [terminology.class]: s.class?.name || 'N/A',
      };
      if (hasMultipleCampuses) {
        row['Campus / Annexe'] = getCampusName(s.campus_id || s.class?.campus_id);
      }
      row['Motif de Réévaluation'] = s.discount_label || 'Ajustement';
      row['Montant HTG'] = s.discount_amount;
      row['Statut'] = 'Approuvé';
      row['Date Audit'] = new Date().toLocaleDateString('fr-FR');
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Réévaluations');
    appendSecuritySheet(wb, { user, ipAddress });
    XLSX.writeFile(wb, `Audit_Reevaluations_${school?.name || 'Etablissement'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = async () => {
    if (filteredStudents.length === 0 || !reportRef.current) return;
    
    try {
      setIsExporting(true);
      const element = reportRef.current;
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          fixOklchForCanvas(clonedDoc);
          const tableWrap = clonedDoc.querySelector('.overflow-x-auto');
          if (tableWrap) {
            (tableWrap as HTMLElement).style.overflow = 'visible';
            (tableWrap as HTMLElement).style.height = 'auto';
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      addSecurityWatermark(pdf, { user, ipAddress });
      pdf.save(`Audit_Reevaluations_${activeYear?.label || 'Session'}.pdf`);
    } catch (error) {
      console.error('Erreur export PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4">
        <div className="relative">
          <Loader2 size={40} className="animate-spin text-amber-500" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Calculator size={18} className="text-amber-500/50" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Génération de l'Audit...</p>
          <p className="text-[11px] text-slate-400 font-medium">Chargement des données multi-tenants et bourses</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-3 sm:px-4 md:px-0">
      <div ref={reportRef} className="bg-white rounded-3xl p-5 sm:p-8 md:p-10 shadow-xl border border-slate-200/80 overflow-hidden print:shadow-none print:border-none print:p-0">
        
        {/* HEADER BANNER - CONCISE, ELEGANT & ERGONOMIC */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
                    Audit des <span className="text-amber-500">Réévaluations</span>
                  </h1>
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-200">
                    Registre Officiel
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Allègements souverains, bourses et révisions d'écolage validés pour la période.
                </p>
              </div>
            </div>

            {/* Context Badges */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-100">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                {school?.name || 'Établissement'}
              </span>

              {hasMultipleCampuses && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {selectedCampusFilter === 'ALL' ? 'Tous les Campus / Annexes' : getCampusName(selectedCampusFilter)}
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 font-bold text-xs rounded-xl border border-amber-200">
                <Calculator className="w-3.5 h-3.5 text-amber-600" />
                Session {activeYear?.label || 'Active'}
              </span>
            </div>
          </div>
          
          {/* Right Summary KPI Card */}
          <div className="bg-slate-900 rounded-2xl p-5 text-right shadow-lg relative overflow-hidden min-w-[280px] w-full md:w-auto">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
            <div className="relative z-10 space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume des Allègements</p>
              <p className="text-3xl font-black text-white font-mono tracking-tight">
                 {totalReductions.toLocaleString()} <span className="text-sm font-bold font-sans text-amber-400">HTG</span>
              </p>
              <div className="pt-2 flex items-center justify-end gap-3 text-slate-300 font-bold text-[11px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 size={13} /> {filteredStudents.length} {filteredStudents.length > 1 ? 'dossiers' : 'dossier'}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 font-mono">Moy. {avgReduction.toLocaleString()} HTG</span>
              </div>
            </div>
          </div>
        </div>

        {/* TOOLBAR FILTERS (DESKTOP 14-INCH OPTIMIZED & ERGONOMIC) */}
        <div className="my-6 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto flex-1">
            {/* Search Bar */}
            <div className="relative w-full sm:w-64 lg:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Rechercher élève, matricule, motif..." 
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold text-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-all placeholder:text-slate-400 shadow-2xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Class Filter Dropdown - Style Pilule Harmonisé */}
            <div className="w-full sm:w-auto min-w-[200px]">
              <SelectPill
                value={selectedClassId}
                onChange={(val) => setSelectedClassId(val)}
                options={[
                  { value: 'ALL', label: `Toutes les ${terminology.classes.toLowerCase()}`, badge: classes.length.toString() },
                  ...classes.map(c => ({
                    value: c.id,
                    label: c.name,
                    badge: c.level || undefined
                  }))
                ]}
                icon={GraduationCap}
                variant="field"
                size="sm"
                colorScheme="amber"
                searchable={true}
                className="w-full"
              />
            </div>

            {/* Campus Filter Dropdown (ONLY if multi-campus or multi-tenant annexes) - Style Pilule Harmonisé */}
            {hasMultipleCampuses && !user.campus_id && (
              <div className="w-full sm:w-auto min-w-[200px]">
                <SelectPill
                  value={selectedCampusFilter}
                  onChange={(val) => setSelectedCampusFilter(val)}
                  options={[
                    { value: 'ALL', label: 'Tous les Campus / Annexes', badge: campuses.length.toString() },
                    ...campuses.map(c => ({ value: c.id, label: c.name }))
                  ]}
                  icon={Building2}
                  variant="field"
                  size="sm"
                  colorScheme="amber"
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* Action Export Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
            <button
              onClick={fetchData}
              className="p-2.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-2xs"
              title="Rafraîchir les données"
            >
              <RefreshCw size={15} />
            </button>

            <button 
              onClick={handleExportPDF}
              disabled={isExporting || filteredStudents.length === 0}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} className="text-amber-400" />}
              <span>Imprimer Rapport PDF</span>
            </button>

            <button 
              onClick={handleExportExcel}
              disabled={filteredStudents.length === 0}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50"
              title="Exporter au format Excel"
            >
              <FileSpreadsheet size={15} />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* AUDIT DATA TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-100 text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                  <th scope="col" className="px-5 py-3.5 text-slate-100 font-black">Identité de l'{terminology.student.toLowerCase()}</th>
                  <th scope="col" className="px-5 py-3.5 text-center text-slate-100 font-black">Niveau / {terminology.class}</th>
                  {hasMultipleCampuses && <th scope="col" className="px-5 py-3.5 text-slate-100 font-black">Campus / Annexe</th>}
                  <th scope="col" className="px-5 py-3.5 text-slate-100 font-black">Motif de Réévaluation</th>
                  <th scope="col" className="px-5 py-3.5 text-right text-slate-100 font-black">Allocation Accordée</th>
                  <th scope="col" className="px-5 py-3.5 text-center text-slate-100 font-black">Statut Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {filteredStudents.map((student) => {
                  const studentName = formatStudentName(student.last_name, student.first_name).fullName;
                  const initials = `${student.last_name?.[0] || ''}${student.first_name?.[0] || ''}`.toUpperCase();
                  return (
                    <tr key={student.id} className="hover:bg-amber-50/40 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 font-black flex items-center justify-center text-xs group-hover:bg-amber-500 group-hover:text-white transition-colors shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-amber-800 transition-colors">
                              {studentName}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400">ID: {student.id.substring(0,8).toUpperCase()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-200">
                          {student.class?.name || 'Classe N/A'}
                        </span>
                      </td>
                      {hasMultipleCampuses && (
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-100">
                            <Building2 className="w-3 h-3 text-indigo-500" />
                            {getCampusName(student.campus_id || student.class?.campus_id)}
                          </span>
                        </td>
                      )}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg text-xs font-bold border border-amber-200">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            {student.discount_label || 'Ajustement Exceptionnel'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="text-sm font-black text-slate-900 font-mono tracking-tight">
                          -{Number(student.discount_amount).toLocaleString()} <span className="text-xs font-bold text-amber-600">HTG</span>
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase rounded-full border border-emerald-200">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          Approuvé
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={hasMultipleCampuses ? 6 : 5} className="py-16 text-center">
                      <div className="max-w-xs mx-auto space-y-2">
                        <ShieldCheck size={36} className="mx-auto text-slate-300" />
                        <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Aucune réévaluation trouvée</p>
                        <p className="text-[11px] text-slate-400">Ajustez vos filtres de recherche ou de classe pour afficher les dossiers.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ReductionReportView;
