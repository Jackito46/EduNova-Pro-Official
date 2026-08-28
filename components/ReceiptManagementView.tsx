import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { 
  Search, 
  Printer, 
  FileText, 
  ChevronDown, 
  X, 
  History, 
  User, 
  Layers,
  CheckCircle2,
  Calendar,
  Eye,
  AlertCircle,
  RefreshCcw,
  ShieldCheck,
  Receipt,
  SearchCheck,
  Clock
} from 'lucide-react';
import { UserProfile } from '../types';
import { formatStudentName } from '../utils/formatters';
import { DailyCashClosureModal } from './DailyCashClosureModal';
import { ModernRegistrySkeleton, FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import { PrintPreviewModal } from './PrintPreviewModal';

const DATE_FILTERS = ['Toutes les dates', "Aujourd'hui", 'Cette semaine', 'Ce mois'];

const ReceiptManagementView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { school, terminology, currentCampusId, campuses } = useSchool();
  const effectiveSchoolId = user?.school_id || school?.id;
  const [schoolDetails, setSchoolDetails] = useState<any>(null);
  const [cashierName, setCashierName] = useState<string>('');

  const activeCampusName = useMemo(() => {
    if (!campuses || campuses.length === 0) return "Siège Principal";
    if (campuses.length === 1) return campuses[0].name;
    if (!currentCampusId || currentCampusId === 'GLOBAL') return "Tous les campus (Vue globale)";
    const found = campuses.find(c => c.id === currentCampusId);
    return found ? `Annexe : ${found.name}` : "Tous les campus (Vue globale)";
  }, [currentCampusId, campuses]);

  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [dateFilter, setDateFilter] = useState("Aujourd'hui");
  const [activeView, setActiveView] = useState<'journal' | 'generator'>('journal');
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  
  // States du Générateur
  const [genYear, setGenYear] = useState('');
  const [genClass, setGenClass] = useState('');
  const [selectedGenStudent, setSelectedGenStudent] = useState<any | null>(null);

  const [printPreview, setPrintPreview] = useState<any | null>(null);

  useEffect(() => {
    const fetchContext = async () => {
      if (!effectiveSchoolId) return;
      try {
        setLoading(true);
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        if (profile) setCashierName(profile.full_name || '');

        const { data: schoolData } = await supabase.from('schools').select('name, address, phone, logo_url').eq('id', effectiveSchoolId).maybeSingle();
        
        const cachedLogo = localStorage.getItem(`school_logo_${effectiveSchoolId}`);
        const cachedName = localStorage.getItem(`school_name_${effectiveSchoolId}`);

        if (schoolData) {
          setSchoolDetails({
            ...schoolData,
            logo_url: schoolData.logo_url || cachedLogo
          });
          // Sync cache
          if (schoolData.logo_url) localStorage.setItem(`school_logo_${effectiveSchoolId}`, schoolData.logo_url);
          if (schoolData.name) localStorage.setItem(`school_name_${effectiveSchoolId}`, schoolData.name);
        } else if (cachedLogo || cachedName) {
          setSchoolDetails({
            name: cachedName || 'Institution Scolaire',
            logo_url: cachedLogo,
            address: '',
            phone: ''
          });
        }

        const { data: yearsData } = await supabase.from('academic_years').select('*').eq('school_id', effectiveSchoolId).order('label', { ascending: false });
        if (yearsData) {
          setAcademicYears(yearsData);
          const active = yearsData.find(y => y.status === 'ACTIVE') || yearsData[0];
          if (active) {
            setSelectedYear(active.id);
            setGenYear(active.id);
          }
        }

        let classesQuery = supabase.from('classes').select('*').eq('school_id', effectiveSchoolId).order('name');
        if (currentCampusId) classesQuery = classesQuery.eq('campus_id', currentCampusId);
        const { data: classesData } = await classesQuery;
        
        if (classesData) {
          setClasses(classesData);
          if (classesData.length > 0) setGenClass(classesData[0].id);
        }

        let studentsQuery = supabase.from('students').select('id, first_name, last_name, class_id').eq('school_id', effectiveSchoolId);
        if (currentCampusId) studentsQuery = studentsQuery.eq('campus_id', currentCampusId);
        const { data: studentsData } = await studentsQuery;
        if (studentsData) setStudents(studentsData);

        let paymentsQuery = supabase.from('payments').select('*, campaign:ad_hoc_campaigns(id, name)').eq('school_id', effectiveSchoolId).order('created_at', { ascending: false });
        if (currentCampusId) paymentsQuery = paymentsQuery.eq('campus_id', currentCampusId);
        const { data: paymentsData } = await paymentsQuery;
        if (paymentsData) setPayments(paymentsData);

      } catch (e) {
        console.error("Erreur chargement contexte", e);
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, [user, effectiveSchoolId, currentCampusId]);

  // Filtrage archives globales
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const student = students.find(s => s.id === p.student_id);
      const studentName = student ? formatStudentName(student.last_name, student.first_name).fullName : 'Inconnu';
      const className = student ? (classes.find(c => c.id === student.class_id)?.name || 'N/A') : 'N/A';

      const matchesYear = p.academic_year_id === selectedYear;
      const matchesClass = selectedClass === 'all' || student?.class_id === selectedClass;
      const matchesSearch = searchTerm.length > 0 
        ? (studentName.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
        
      let matchesDate = true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const paymentDate = new Date(p.created_at);
      paymentDate.setHours(0, 0, 0, 0);

      if (dateFilter === "Aujourd'hui") {
        matchesDate = paymentDate.getTime() === today.getTime();
      } else if (dateFilter === 'Cette semaine') {
        const firstDay = new Date(today);
        firstDay.setDate(today.getDate() - today.getDay());
        matchesDate = paymentDate >= firstDay;
      } else if (dateFilter === 'Ce mois') {
        matchesDate = paymentDate.getMonth() === today.getMonth() && paymentDate.getFullYear() === today.getFullYear();
      }

      return matchesYear && matchesClass && matchesSearch && matchesDate;
    }).map(p => {
      const student = students.find(s => s.id === p.student_id);
      return {
        ...p,
        studentName: student ? formatStudentName(student.last_name, student.first_name).fullName : 'Inconnu',
        classe: student ? (classes.find(c => c.id === student.class_id)?.name || 'N/A') : 'N/A',
        date: new Date(p.created_at).toLocaleDateString('fr-FR'),
        nature: p.campaign?.name 
          ? `Campagne: ${p.campaign.name}` 
          : p.ad_hoc_campaign_id 
          ? 'Frais de Campagne' 
          : (p.fee_type === 'SCOLARITE' || (!p.fee_type && (!p.nature || p.nature === 'SCOLARITE' || p.nature === 'Scolarité'))) 
          ? 'Scolarité' 
          : ((p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === "Frais d'inscription") 
            ? 'Inscription' 
            : (p.nature || p.type || p.fee_type || 'Frais Divers')),
        amount: p.amount_htg_equivalent || p.amount,
        original_amount: p.amount,
        currency: p.currency || 'HTG'
      };
    });
  }, [payments, selectedYear, selectedClass, searchTerm, dateFilter, students, classes]);

  // Étudiants disponibles pour la classe sélectionnée dans le générateur
  const availableStudentsForGen = useMemo(() => {
    return students.filter(s => s.class_id === genClass).map(s => {
      const formatted = formatStudentName(s.last_name, s.first_name);
      return {
        ...s,
        name: formatted.fullName
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, genClass]);

  // Historique des paiements de l'élève sélectionné dans le générateur
  const studentPaymentsHistory = useMemo(() => {
    if (!selectedGenStudent) return [];
    return payments.filter(p => p.student_id === selectedGenStudent.id && p.academic_year_id === genYear).map(p => ({
      ...p,
      studentName: selectedGenStudent.name,
      classe: classes.find(c => c.id === selectedGenStudent.class_id)?.name || 'N/A',
      date: new Date(p.created_at).toLocaleDateString('fr-FR'),
      nature: p.campaign?.name 
        ? `Campagne: ${p.campaign.name}` 
        : p.ad_hoc_campaign_id 
        ? 'Frais de Campagne' 
        : (p.fee_type === 'SCOLARITE' || (!p.fee_type && (!p.nature || p.nature === 'SCOLARITE' || p.nature === 'Scolarité'))) 
        ? 'Scolarité' 
        : ((p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === "Frais d'inscription") 
          ? 'Inscription' 
          : (p.nature || p.type || p.fee_type || 'Frais Divers')),
      amount: p.amount_htg_equivalent || p.amount,
      original_amount: p.amount,
      currency: p.currency || 'HTG'
    }));
  }, [payments, selectedGenStudent, genYear, classes]);

  const handleOpenPreview = (payment: any) => {
    setPrintPreview(payment);
  };

  const executePrint = () => {
    window.print();
  };

  return (
    <>
      <div className={`max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 ${printPreview ? 'print:hidden' : 'print:p-0'}`}>
        
        {/* NAVIGATION HAUTE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:hidden bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200/60">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-1">
            <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>Économat • Facturation</span>
            <span className="text-slate-300">•</span>
            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100 font-extrabold flex items-center gap-1">
              {activeCampusName}
            </span>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">Gestion des Reçus</h2>
          <p className="text-slate-500 font-medium text-sm">Archives, traçabilité et émissions certifiées des paiements.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 w-full lg:w-auto">
          <button 
            onClick={() => setActiveView('journal')}
            className={`flex-1 lg:flex-none px-6 md:px-8 py-3 rounded-xl text-xs font-bold tracking-tight transition-all flex items-center justify-center gap-2 ${activeView === 'journal' ? 'bg-white text-indigo-700 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <History size={16} />
            Registre Global
          </button>
          <button 
            onClick={() => { setActiveView('generator'); setSelectedGenStudent(null); }}
            className={`flex-1 lg:flex-none px-6 md:px-8 py-3 rounded-xl text-xs font-bold tracking-tight transition-all flex items-center justify-center gap-2 ${activeView === 'generator' ? 'bg-white text-indigo-700 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <Printer size={16} />
            Émettre Reçu
          </button>
          <button 
            onClick={() => setIsClosureModalOpen(true)}
            className="flex-1 lg:flex-none px-4 md:px-6 py-3 rounded-xl text-xs font-bold tracking-tight transition-all flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white shadow-md active:scale-95 border border-slate-700"
          >
            <ShieldCheck size={16} className="text-emerald-400" />
            Clôture de Caisse
          </button>
        </div>
      </div>

      {activeView === 'journal' ? (
        <>
          {/* FILTRES ARCHIVES GLOBALES */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:hidden items-end">
            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Session {terminology.academicYear.includes('Académique') ? 'Académique' : 'Scolaire'}</label>
              <div className="relative group">
                <select 
                  className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  {academicYears.map(y => <option key={y.id} value={y.id}>{y.label || y.name}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 pointer-events-none transition-colors" size={16} />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Filtre {terminology.option}</label>
              <div className="relative group">
                <select 
                  className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="all">Toutes les {terminology.classes.toLowerCase()}</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 pointer-events-none transition-colors" size={16} />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Période</label>
              <div className="relative group">
                <select 
                  className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  {DATE_FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 pointer-events-none transition-colors" size={16} />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Recherche Rapide</label>
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder={`${terminology.student}, ID ou Reçu...`}
                  className="w-full pl-12 pr-6 py-3.5 bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-xl text-sm font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* TABLEAU REGISTRE GLOBAL */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                  <History size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight">Registre Historique</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{filteredPayments.length} transactions enregistrées</p>
                </div>
              </div>
              <div className="flex items-center gap-4 print:hidden">
                <div className="bg-white/5 px-6 py-3 rounded-xl border border-white/10 text-right">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Collecte Totale</p>
                  <p className="text-xl font-bold text-emerald-400">
                    {filteredPayments
                      .filter(p => 
                        p.status !== 'ANNULE' && 
                        !p.payment_method?.includes('EN ATTENTE') && 
                        !p.payment_method?.includes('REJETÉ') &&
                        p.moncash_status !== 'PENDING'
                      )
                      .reduce((acc, c) => acc + c.amount, 0).toLocaleString()} <span className="text-xs font-medium">HTG</span>
                  </p>
                </div>
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs tracking-tight transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  <Printer size={16} />
                  Imprimer
                </button>
              </div>
            </div>
            <div className="overflow-x-auto print:overflow-visible custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                    <th className="px-8 py-5">Date</th>
                    <th className="px-8 py-5">{terminology.student} & {terminology.class}</th>
                    <th className="px-8 py-5">Référence</th>
                    <th className="px-8 py-5">Nature</th>
                    <th className="px-8 py-5 text-right">Montant</th>
                    <th className="px-8 py-5 text-center">Statut</th>
                    <th className="px-8 py-5 text-center print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8">
                        <FluidLoadingState message="Chargement des reçus..." subtext="Synchronisation en cours" />
                        <SkeletonTable rows={5} />
                      </td>
                    </tr>
                  ) : filteredPayments.map((p) => (
                    <tr key={p.id} className="group hover:bg-slate-50/80 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <Calendar size={14} className="text-slate-300 hidden md:block" />
                          <div>
                            <p className="font-bold text-slate-900 text-sm whitespace-nowrap">{p.date}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                            {p.studentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{p.studentName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{p.classe}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-mono text-[10px] border border-slate-200/50">RCP-{p.id?.substring(0,8)}</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/30">{p.nature}</span>
                      </td>
                      <td className="px-8 py-5 text-right font-bold text-slate-900">
                        <div className="flex flex-col items-end">
                          <span className="text-sm">{p.amount.toLocaleString()} G</span>
                          {p.currency !== 'HTG' && (
                            <span className="text-[9px] text-slate-400 font-medium italic">({p.original_amount.toLocaleString()} {p.currency})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${
                          p.payment_method?.includes('EN ATTENTE') 
                            ? 'bg-amber-100 text-amber-700' 
                            : p.status === 'ANNULE' 
                              ? 'bg-rose-100 text-rose-700' 
                              : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {p.payment_method?.includes('EN ATTENTE') ? 'En attente' : p.status === 'ANNULE' ? 'Annulé' : 'Validé'}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center print:hidden">
                        <button 
                          onClick={() => handleOpenPreview(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] uppercase tracking-tight shadow-sm transition-all active:scale-95 cursor-pointer"
                          title="Réimprimer ce reçu"
                        >
                          <Printer size={13} />
                          Réimprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {!loading && filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-500 font-bold text-xs italic">
                        Aucun reçu trouvé pour ces critères.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* ASSISTANT D'ÉMISSION ERGONOMIQUE */
        <div className="max-w-6xl mx-auto animate-in slide-in-from-bottom-8 duration-500 print:hidden space-y-8">
          
          {/* BARRE DE SÉLECTION */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 p-8 flex flex-col md:flex-row items-end gap-6">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                  <Calendar size={12} className="text-indigo-500" /> 1. Session
                </label>
                <div className="relative group">
                  <select 
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-not-allowed opacity-80"
                    value={genYear}
                    disabled
                  >
                    {academicYears.filter(y => y.status === 'ACTIVE').map(y => <option key={y.id} value={y.id}>{y.label || y.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 pointer-events-none transition-colors" size={16} />
                </div>
              </div>
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                  <Layers size={12} className="text-indigo-500" /> 2. {terminology.option}
                </label>
                <div className="relative group">
                  <select 
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-all appearance-none cursor-pointer"
                    value={genClass}
                    onChange={(e) => { setGenClass(e.target.value); setSelectedGenStudent(null); }}
                  >
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 pointer-events-none transition-colors" size={16} />
                </div>
              </div>
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                  <User size={12} className="text-indigo-500" /> 3. Choisir {terminology.student.toLowerCase()}
                </label>
                <div className="relative group">
                  <select 
                    className={`w-full px-5 py-3.5 border-2 rounded-xl text-sm font-semibold text-slate-900 outline-none appearance-none transition-all cursor-pointer ${selectedGenStudent ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-500 focus:bg-white'}`}
                    onChange={(e) => {
                      const student = availableStudentsForGen.find(s => s.id === e.target.value);
                      setSelectedGenStudent(student);
                    }}
                    value={selectedGenStudent?.id || ''}
                  >
                    <option value="">-- Sélectionner --</option>
                    {availableStudentsForGen.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.id.substring(0,8)})</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 pointer-events-none transition-colors" size={16} />
                </div>
              </div>
            </div>
            {selectedGenStudent && (
              <button 
                onClick={() => setSelectedGenStudent(null)}
                className="p-3.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-all active:scale-95 border border-rose-100"
                title="Effacer la sélection"
              >
                <RefreshCcw size={20} />
              </button>
            )}
          </div>

          {/* TABLEAU DES PAIEMENTS DE L'ÉLÈVE (ERGONOMIE MAXIMALE) */}
          {selectedGenStudent ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              
              {/* Profil rapide de l'élève */}
              <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 border-b-[6px] border-b-emerald-500">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center font-bold text-3xl border border-white/10 shadow-xl">
                    {selectedGenStudent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight leading-none">{selectedGenStudent.name}</h3>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                        <ShieldCheck size={12} className="text-emerald-400" />
                        ID: {selectedGenStudent.id.substring(0,8)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {classes.find(c => c.id === genClass)?.name}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 px-8 py-5 rounded-2xl border border-white/10 text-center md:text-right">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Encaissé</p>
                  <p className="text-3xl font-bold text-emerald-400 tracking-tight">
                    {studentPaymentsHistory
                      .filter(p => p.status !== 'ANNULE' && !p.payment_method?.includes('EN ATTENTE'))
                      .reduce((acc, c) => acc + c.amount, 0).toLocaleString()} <span className="text-sm font-medium">HTG</span>
                  </p>
                </div>
              </div>

              {/* TABLEAU DE LISTE PAIEMENT */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
                       <Clock size={20} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 tracking-tight">Historique des versements</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{studentPaymentsHistory.length} transaction(s) trouvée(s)</p>
                    </div>
                  </div>
                </div>

                {studentPaymentsHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                          <th className="px-8 py-5">Date</th>
                          <th className="px-8 py-5">Référence</th>
                          <th className="px-8 py-5">Nature</th>
                          <th className="px-8 py-5 text-right">Montant</th>
                          <th className="px-8 py-5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {studentPaymentsHistory.map((p) => (
                          <tr key={p.id} className="group hover:bg-slate-50/80 transition-colors">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <Calendar size={14} className="text-slate-300" />
                                <div>
                                  <p className="font-bold text-slate-900 text-sm">{p.date}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Enregistré</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-mono text-[10px] border border-slate-200/50">RCP-{p.id.substring(0,8)}</span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/30">{p.nature}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex flex-col items-end">
                                <p className="text-sm font-bold text-slate-900">{p.amount.toLocaleString()} G</p>
                                {p.currency !== 'HTG' && (
                                  <p className="text-[9px] text-slate-400 font-medium italic">({p.original_amount.toLocaleString()} {p.currency})</p>
                                )}
                              </div>
                            </td>
                            <td className="px-8 py-5 text-center">
                              <button 
                                onClick={() => handleOpenPreview(p)}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg text-[10px] uppercase tracking-tight shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-all active:scale-95"
                              >
                                <Printer size={14} />
                                Imprimer Reçu
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-20 text-center space-y-6">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                      <AlertCircle size={32} className="text-slate-300" />
                    </div>
                    <div>
                      <p className="text-slate-900 font-bold">Aucune transaction trouvée</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">Vérifiez la session ou assurez-vous que le paiement a été validé.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/50 p-20 rounded-[3rem] border-2 border-dashed border-slate-200 text-center space-y-6 max-w-4xl mx-auto">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                <SearchCheck size={40} className="text-indigo-400 animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="text-slate-900 font-bold text-xl tracking-tight">Prêt à l'émission</p>
                <p className="text-slate-500 font-medium text-sm max-w-md mx-auto leading-relaxed">
                  Veuillez sélectionner un(e) {terminology.student.toLowerCase()} dans la liste contextuelle de sa {terminology.class.toLowerCase()} pour visualiser et imprimer ses reçus officiels.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* MODAL APERÇU (SLIM) */}
      <PrintPreviewModal
        isOpen={!!printPreview}
        onClose={() => setPrintPreview(null)}
        title="Réimpression de Reçu"
        subtitle="Transaction certifiée • EduNova Pro"
        onPrint={executePrint}
      >
        {printPreview && (
              <div id="thermal-reprint-receipt" className="bg-white p-4 sm:p-6 w-[80mm] max-w-[80mm] mx-auto shadow-2xl rounded-xl border border-gray-200 text-black font-sans leading-tight flex flex-col print:shadow-none print:border-none print:m-0 print:p-2 print:w-[80mm]">
                {/* HEADER SCOLAIRE */}
                <div className="w-full text-center border-b-2 border-black pb-2 mb-3">
                  {schoolDetails?.logo_url ? (
                    <img src={schoolDetails.logo_url} alt="Logo" className="h-12 mx-auto mb-1 object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <img src="/logo.png" alt="Logo" className="h-12 mx-auto mb-1 object-contain grayscale" />
                  )}
                  <h1 className="text-[13px] font-black uppercase leading-tight">{schoolDetails?.name || 'INSTITUTION SCOLAIRE'}</h1>
                  {activeCampusName && activeCampusName !== 'Tous les campus (Vue globale)' && (
                    <p className="text-[10px] font-extrabold text-gray-800 uppercase tracking-wider">{activeCampusName}</p>
                  )}
                  <div className="text-[9px] font-bold opacity-90 italic mt-0.5 space-y-0.5">
                    {schoolDetails?.address && <p>{schoolDetails.address}</p>}
                    {schoolDetails?.phone && <p>Téls: {schoolDetails.phone}</p>}
                  </div>
                </div>

                {/* TITRE DU DOCUMENT */}
                <div className="w-full text-center mb-3 py-1.5 bg-gray-100 rounded border border-gray-200 print:bg-gray-100">
                  <h2 className="text-[12px] font-black tracking-widest uppercase">REÇU OFFICIEL (DUPLICATA)</h2>
                  <p className="text-[9px] font-bold opacity-80 mt-0.5">#RCP-{printPreview.id?.substring(0,8)}</p>
                  {printPreview.payment_method?.includes('EN ATTENTE') && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-[7px] font-black bg-gray-100 text-black border border-black uppercase tracking-widest rounded">
                      Paiement En Attente
                    </span>
                  )}
                </div>

                {/* GRID DETAILS (2 COLONNES COMPACTES) */}
                <div className="w-full grid grid-cols-2 gap-2 text-[9px] mb-3 border-b border-black pb-2">
                  <div className="space-y-1">
                    <div>
                      <p className="text-[7px] uppercase font-black text-gray-500">Date & Heure</p>
                      <p className="font-bold leading-none">{printPreview.date || new Date().toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <p className="text-[7px] uppercase font-black text-gray-500">Caissier</p>
                      <p className="font-bold leading-none">{cashierName || 'Comptabilité'}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-right border-l border-gray-200 pl-2">
                    <div>
                      <p className="text-[7px] uppercase font-black text-gray-500">Élève</p>
                      <p className="font-black text-[10px] leading-tight">{printPreview.studentName}</p>
                      <p className="text-[8px] font-bold text-gray-600 italic">{printPreview.classe || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* MOTIF & PAIEMENT */}
                <div className="w-full text-[9px] mb-3 space-y-1 border-b border-dashed border-gray-400 pb-2">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="font-bold uppercase text-gray-600">Motif:</span>
                    <span className="font-black text-[10px]">{printPreview.nature}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="font-bold uppercase text-gray-600">Mode:</span>
                    <span className="font-black text-[10px]">{printPreview.payment_method || 'Cash'}</span>
                  </div>
                </div>

                {/* NET PERÇU (BOX DE MISE EN VALEUR CLAIR MONOCHROME) */}
                <div className="w-full border-2 border-black rounded-lg p-2 mb-3 text-center bg-gray-50 text-black">
                  <p className="text-[8px] font-black uppercase tracking-wider text-gray-700">Montant Certifié Payé</p>
                  <p className="text-[16px] font-black tracking-tight leading-none mt-1 text-black">
                    {printPreview.amount?.toLocaleString()} <span className="text-[11px] font-bold">HTG</span>
                  </p>
                  {printPreview.currency && printPreview.currency !== 'HTG' && (
                    <p className="text-[9px] font-bold mt-1 pt-1 border-t border-black/20">
                      Équivalent Origine: {printPreview.original_amount?.toLocaleString()} {printPreview.currency}
                    </p>
                  )}
                </div>

                {/* SIGNATURE & MENTION LÉGALE */}
                <div className="w-full text-center space-y-3 mt-2">
                  <div className="w-3/4 mx-auto space-y-1 pt-2">
                    <div className="h-7 border-b border-black"></div>
                    <p className="text-[7px] font-black uppercase tracking-widest">Sign. Caissier: {cashierName || 'Direction'}</p>
                  </div>

                  <p className="text-[8px] font-bold italic pt-2 border-t border-black text-center">
                    Merci de votre confiance ! Duplicata officiel EduNova Pro.
                  </p>
                </div>

                {/* BUFFER MARGE DE COUPE (AUTO-CUTTER EPSON PRINTER) */}
                <div className="w-full pt-3 mt-2 border-t border-dashed border-gray-400 text-center">
                  <p className="text-[7px] font-black uppercase tracking-[0.25em] opacity-60 text-gray-500 print:text-black">- - - MARGE DE COUPE EPSON - - -</p>
                  <div className="h-6 print:h-12"></div>
                </div>
              </div>
        )}
      </PrintPreviewModal>

      {/* STYLES D'IMPRESSION OPTIMISÉS 80MM */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          .print\\:hidden { display: none !important; }
          #thermal-reprint-receipt { 
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            display: flex !important;
            flex-direction: column !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace, sans-serif !important;
            color: black !important;
            background: white !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          #thermal-reprint-receipt * { 
            visibility: visible !important; 
            color: black !important;
            border-color: black !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      <DailyCashClosureModal
        isOpen={isClosureModalOpen}
        onClose={() => setIsClosureModalOpen(false)}
        user={user}
      />
    </>
  );
};

export default ReceiptManagementView;
