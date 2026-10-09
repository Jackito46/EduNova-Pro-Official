import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  BookOpen, Plus, Search, Filter, Calendar, Clock, CheckCircle2, 
  AlertCircle, Eye, FileText, Paperclip, ChevronRight, Check, X, 
  Trash2, Edit3, Sparkles, User, Users, Shield, ArrowUpDown, 
  Download, ExternalLink, Bold, Italic, List, ListOrdered, Link, 
  AlertTriangle, CheckSquare, Square, RefreshCw, BarChart2, MessageSquare, 
  Share2, ChevronDown, Award, Send, Mail, Phone, Bell, PieChart as PieChartIcon,
  TrendingUp, CheckCircle, Info, Cloud, HardDrive, Save, Play, FolderArchive, Server,
  Copy, Database, Terminal, FileCode, Upload, FileUp, FileSpreadsheet, Image as ImageIcon,
  Lightbulb, Strikethrough, Heading1, Heading2, Heading3, Table, Highlighter, Underline,
  ZoomIn, ZoomOut, RotateCw, Maximize2, Columns
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend 
} from 'recharts';
import { UserProfile, UserRole, SchoolClass, Subject } from '../types';
import { 
  HomeworkAssignment, 
  HomeworkAssignmentWithDetails, 
  HomeworkAttachment, 
  HomeworkStudentRead,
  HomeworkSubmissionType 
} from '../types';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HOMEWORK_MODULE_SQL } from '../src/utils/homeworkSqlScript';
import { ClassSelectorPill } from './ClassSelectorPill';
import { SubjectSelectorPill } from './SubjectSelectorPill';
import { SelectPill } from './SelectPill';

// Helper to categorize attachment type
const getFileCategory = (name: string, type?: string): 'pdf' | 'doc' | 'image' | 'sheet' | 'link' => {
  const n = (name || '').toLowerCase();
  const t = (type || '').toLowerCase();
  if (n.endsWith('.pdf') || t.includes('pdf')) return 'pdf';
  if (n.endsWith('.doc') || n.endsWith('.docx') || n.endsWith('.odt') || t.includes('word') || t.includes('document')) return 'doc';
  if (n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.webp') || t.includes('image')) return 'image';
  if (n.endsWith('.xls') || n.endsWith('.xlsx') || t.includes('sheet') || t.includes('excel')) return 'sheet';
  return 'link';
};

// Helper to format file size
const formatFileSize = (bytes?: number): string => {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// Quick Templates for pedagogical homework creation
const HOMEWORK_TEMPLATES = [
  {
    id: 'MANUEL',
    label: 'Exercices du manuel',
    icon: '📖',
    content: `**Manuel scolaire :** Page [__], Exercices n° [__] et [__]

**Consignes de travail :**
- Réaliser les exercices sur le cahier d'exercices.
- Détailler chaque étape de calcul ou de raisonnement.
- Souligner les résultats finaux.

**Objectif :** Consolidation des notions vues en séance.`
  },
  {
    id: 'DEVOIR_MAISON',
    label: 'Devoir Maison (DM)',
    icon: '📝',
    content: `**Sujet du Devoir Maison :** [Intitulé du sujet]

**Directives :**
1. Prendre le temps de bien lire l'intégralité du sujet.
2. Rédiger les réponses sous forme de phrases complètes et soignées.
3. Soigner la présentation et la propreté de la copie.

**Critères d'évaluation :**
- Rigueur de la démarche (10 pts)
- Qualité de rédaction & orthographe (5 pts)
- Soin et présentation (5 pts)`
  },
  {
    id: 'REVISION',
    label: 'Révisions de contrôle',
    icon: '🎯',
    content: `**Évaluation sommative prévue le :** [Date du contrôle]

**Notions prioritaires à réviser :**
- Définitions clés et vocabulaire spécifique
- Formules et propriétés fondamentales du chapitre
- Refaire impérativement les exercices traités en classe

**Conseil :** Établir une fiche synthétique mémo.`
  },
  {
    id: 'RECHERCHE',
    label: 'Recherche documentaire',
    icon: '🔍',
    content: `**Thème de travail :** [Thème ou question de recherche]

**Consignes :**
- Consulter au moins 2 sources fiables (encyclopédie, ouvrages, revues).
- Rédiger une synthèse d'une page maximum.
- Préparer 2 ou 3 questions ouvertes pour le débat en classe.`
  }
];

// Quick Math & Scientific Symbols
const QUICK_MATH_SYMBOLS = ['²', '³', '√', 'π', '±', '≠', '≤', '≥', '→', '°', '×', '÷', 'Δ', 'α', 'β', '∑', '∫', '∞', '∈', '½', '¼', '¾', '≈'];

// Component to render formatted homework content in Markdown with rich styling
const FormattedHomeworkContent: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  if (!content) return null;
  return (
    <div className={`text-xs text-slate-800 leading-relaxed font-normal ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h3 className="text-sm font-black text-slate-900 mt-2.5 mb-1.5 flex items-center gap-1.5 border-b border-slate-200/80 pb-1">
              <span className="w-1.5 h-3.5 bg-indigo-600 rounded-full inline-block shrink-0"></span>
              <span>{children}</span>
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="text-xs font-bold text-slate-900 mt-2 mb-1 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-indigo-500 rounded-full inline-block shrink-0"></span>
              <span>{children}</span>
            </h4>
          ),
          h3: ({ children }) => (
            <h5 className="text-[11.5px] font-bold text-indigo-950 mt-1.5 mb-0.5">
              {children}
            </h5>
          ),
          p: ({ children }) => <p className="mb-2 leading-relaxed text-slate-700">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-slate-950">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-800">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1 text-slate-700">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-slate-700">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          hr: () => <hr className="my-2.5 border-slate-200" />,
          blockquote: ({ children }) => {
            const rawText = React.Children.toArray(children)
              .map(c => (typeof c === 'string' ? c : (c as any)?.props?.children || ''))
              .flat()
              .join(' ');
            
            const isTip = rawText.includes('💡') || rawText.includes('CONSEIL');
            const isGoal = rawText.includes('🎯') || rawText.includes('OBJECTIF');
            const isInstruction = rawText.includes('📌') || rawText.includes('CONSIGNE');
            const isGrade = rawText.includes('🏆') || rawText.includes('BARÈME');
            const isWarning = rawText.includes('⚠️') || rawText.includes('ATTENTION');

            let styleClass = 'bg-amber-50/80 border-amber-300/80 text-amber-950';
            if (isTip) styleClass = 'bg-indigo-50/80 border-indigo-200 text-indigo-950';
            else if (isGoal) styleClass = 'bg-purple-50/80 border-purple-200 text-purple-950';
            else if (isInstruction) styleClass = 'bg-emerald-50/80 border-emerald-300 text-emerald-950';
            else if (isGrade) styleClass = 'bg-rose-50/80 border-rose-300 text-rose-950';
            else if (isWarning) styleClass = 'bg-amber-50/80 border-amber-300 text-amber-950';

            return (
              <div className={`my-2 p-2.5 border rounded-xl text-xs font-medium shadow-2xs ${styleClass}`}>
                {children}
              </div>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-2.5 rounded-xl border border-slate-200 shadow-2xs">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-50 font-bold text-slate-800">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-slate-50/60 transition-colors">{children}</tr>,
          th: ({ children }) => <th className="px-3 py-1.5 text-left text-[11px] font-bold text-slate-800">{children}</th>,
          td: ({ children }) => <td className="px-3 py-1.5 text-[11px] text-slate-700">{children}</td>,
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 bg-slate-100 text-indigo-700 rounded text-[11px] font-mono font-medium border border-slate-200">
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 underline font-semibold inline-flex items-center gap-0.5">
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

interface HomeworkManagerProps {
  user: UserProfile;
  defaultTab?: 'teacher' | 'student';
}

interface TargetStudentRecipient {
  id: string;
  name: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  isRead: boolean;
  hoursSinceAssigned: number;
}

export const HomeworkManager: React.FC<HomeworkManagerProps> = ({ user, defaultTab }) => {
  const { terminology, currentCampusId, school } = useSchool();
  const studentTerm = terminology.student.toLowerCase();
  const studentsTerm = terminology.students.toLowerCase();

  const isTeacher = user.role === UserRole.TEACHER;
  const isStudent = user.role === UserRole.STUDENT;
  const isParent = user.role === UserRole.PARENT;
  const isAdminOrDirector = [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY].includes(user.role);
  
  // Can create/edit homework and access analytics & reminders
  const canManageHomework = isTeacher || isAdminOrDirector;

  // Initial tab resolution
  const initialViewMode = defaultTab || (isStudent || isParent ? 'student' : 'teacher');
  const [activeTab, setActiveTab] = useState<'assignments' | 'studentView' | 'analytics'>(
    initialViewMode === 'student' ? 'studentView' : 'assignments'
  );

  // Data states
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<HomeworkAssignmentWithDetails[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classSubjects, setClassSubjects] = useState<Array<{ id?: string; class_id: string; subject_id: string }>>([]);
  const [teacherStaffId, setTeacherStaffId] = useState<string | null>(null);
  const [teacherAssignments, setTeacherAssignments] = useState<Array<{ class_id?: string; class_name?: string; subject_id?: string; subject_name?: string }>>([]);
  const [teacherScope, setTeacherScope] = useState<'ALL_CLASSES_HOMEWORK' | 'MINE_ONLY'>('ALL_CLASSES_HOMEWORK');
  const [studentReads, setStudentReads] = useState<Record<string, HomeworkStudentRead>>({});
  const [allClassStudents, setAllClassStudents] = useState<any[]>([]);
  const [allReadsData, setAllReadsData] = useState<HomeworkStudentRead[]>([]);
  const [dbTableMissing, setDbTableMissing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL'); // ALL, PENDING, DUE_SOON, COMPLETED
  
  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<HomeworkAssignment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeDetailAssignment, setActiveDetailAssignment] = useState<HomeworkAssignmentWithDetails | null>(null);
  const [classTrackingList, setClassTrackingList] = useState<any[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);

  // Reminder Modal state
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderAssignment, setReminderAssignment] = useState<HomeworkAssignmentWithDetails | null>(null);
  const [reminderChannel, setReminderChannel] = useState<'SMS' | 'EMAIL' | 'BOTH'>('SMS');
  const [reminderPeriod, setReminderPeriod] = useState<'ALL_UNREAD' | '24H' | '48H' | 'EVE_OF_DUE'>('ALL_UNREAD');
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderRecipients, setReminderRecipients] = useState<TargetStudentRecipient[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // SQL Migration Helper state
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [checkingDb, setCheckingDb] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Schedule Archive state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [archiveSettings, setArchiveSettings] = useState<{
    isEnabled: boolean;
    frequency: 'MONTHLY' | 'TRIMESTER' | 'WEEKLY';
    destination: 'SUPABASE_STORAGE' | 'LOCAL_AND_EMAIL' | 'EXTERNAL_CLOUD';
    bucketName: string;
    notificationEmail: string;
    includePdf: boolean;
    includeCsv: boolean;
    includeStats: boolean;
    lastArchivedAt?: string | null;
  }>(() => {
    try {
      const stored = localStorage.getItem('edunova_homework_archive_schedule');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {
      isEnabled: true,
      frequency: 'MONTHLY',
      destination: 'SUPABASE_STORAGE',
      bucketName: 'academic_archives',
      notificationEmail: user.email || '',
      includePdf: true,
      includeCsv: true,
      includeStats: true,
      lastArchivedAt: null
    };
  });
  const [savingArchiveSettings, setSavingArchiveSettings] = useState(false);
  const [executingArchiveNow, setExecutingArchiveNow] = useState(false);
  const [archiveHistory, setArchiveHistory] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('edunova_homework_archive_history');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [
      {
        id: 'arch_preceding_1',
        monthName: 'Mois Précédent',
        dateCreated: new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString(),
        totalAssignments: 22,
        totalReads: 415,
        fileSizeKb: 540,
        status: 'SUCCESS'
      }
    ];
  });

  // Prochaine date d'archivage automatique en fin de mois
  const nextMonthEnd = useMemo(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const diffTime = lastDay.getTime() - now.getTime();
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    return {
      dateFormatted: lastDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      timeFormatted: '23h59',
      daysRemaining: diffDays
    };
  }, []);

  // Form fields & content modes
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formDueDate, setFormDueDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [formDueTime, setFormDueTime] = useState('08:00');
  const [formDuration, setFormDuration] = useState(30);
  const [formSubmissionType, setFormSubmissionType] = useState<HomeworkSubmissionType>('IN_CLASS');
  const [formIsGraded, setFormIsGraded] = useState(false);
  const [formMaxScore, setFormMaxScore] = useState<number>(20);
  const [formAttachments, setFormAttachments] = useState<HomeworkAttachment[]>([]);
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [submittingForm, setSubmittingForm] = useState(false);

  // Modern Form Ergonomics & Content Modes
  const [formContentMode, setFormContentMode] = useState<'TYPE' | 'ATTACH_DOC' | 'BOTH'>('TYPE');
  const [editorViewMode, setEditorViewMode] = useState<'WRITE' | 'SPLIT' | 'PREVIEW'>('WRITE');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showMathSymbols, setShowMathSymbols] = useState(false);
  const [showFormattingMenu, setShowFormattingMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // High-Fidelity Document Preview Modal (Images & PDFs)
  const [previewAttachment, setPreviewAttachment] = useState<HomeworkAttachment | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [previewRotation, setPreviewRotation] = useState<number>(0);
  const [activeInlinePreviewIdx, setActiveInlinePreviewIdx] = useState<number | null>(null);

  // Load Classes, Subjects, and Students metadata
  const fetchMetadata = useCallback(async () => {
    try {
      let classQuery = supabase.from('classes').select('*');
      if (user.school_id) classQuery = classQuery.eq('school_id', user.school_id);
      if (currentCampusId) classQuery = classQuery.eq('campus_id', currentCampusId);

      let subjectQuery = supabase.from('subjects').select('*');
      if (user.school_id) subjectQuery = subjectQuery.eq('school_id', user.school_id);

      let studentQuery = supabase
        .from('students')
        .select('id, first_name, last_name, class_id, parent_name, parent_phone, parent_email, status')
        .eq('school_id', user.school_id)
        .eq('status', 'Actif');

      let csQuery = supabase.from('class_subjects').select('id, class_id, subject_id, school_id');
      if (user.school_id) csQuery = csQuery.or(`school_id.eq.${user.school_id},school_id.is.null`);

      const [classRes, subjectRes, studentRes, csRes] = await Promise.all([
        classQuery, 
        subjectQuery, 
        studentQuery,
        csQuery
      ]);

      if (classRes.data) setClasses(classRes.data);
      if (subjectRes.data) setSubjects(subjectRes.data);
      if (studentRes.data) setAllClassStudents(studentRes.data);
      if (csRes.data) setClassSubjects(csRes.data);

      // If user is a teacher, fetch their staff record and assigned classes & subjects
      if (isTeacher) {
        let staffQuery = supabase.from('staff').select('id, email, first_name, last_name');
        if (user.email) {
          staffQuery = staffQuery.or(`email.eq.${user.email},id.eq.${user.id}`);
        } else {
          staffQuery = staffQuery.eq('id', user.id);
        }
        const { data: staffData } = await staffQuery.maybeSingle();

        if (staffData) {
          setTeacherStaffId(staffData.id);
          const { data: assignData } = await supabase
            .from('staff_assignments')
            .select('class_id, class_name, subject_id, subject_name')
            .eq('staff_id', staffData.id);
          if (assignData) {
            setTeacherAssignments(assignData);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching homework metadata:', err);
    }
  }, [user.school_id, user.id, user.email, currentCampusId, isTeacher]);

  // Exact classes assigned to the teacher
  const teacherAssignedClasses = useMemo(() => {
    if (!isTeacher || isAdminOrDirector) return classes;
    if (!teacherAssignments || teacherAssignments.length === 0) return classes;

    const assignedClassNames = new Set(teacherAssignments.map(a => a.class_name).filter(Boolean));
    const assignedClassIds = new Set(teacherAssignments.map(a => a.class_id).filter(Boolean));

    const filtered = classes.filter(c => assignedClassIds.has(c.id) || assignedClassNames.has(c.name));
    return filtered.length > 0 ? filtered : classes;
  }, [isTeacher, isAdminOrDirector, classes, teacherAssignments]);

  const teacherAssignedClassIds = useMemo(() => {
    return teacherAssignedClasses.map(c => c.id);
  }, [teacherAssignedClasses]);

  // Load Homework Assignments & Global Reads Data
  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('homework_assignments')
        .select(`
          *,
          classes:class_id (name),
          subjects:subject_id (name, code),
          profiles:teacher_id (full_name, email)
        `)
        .order('due_date', { ascending: false });

      if (user.school_id) query = query.eq('school_id', user.school_id);
      if (currentCampusId) query = query.eq('campus_id', currentCampusId);
      
      // If teacher without admin rights:
      // Show assignments for their exact assigned classes (so they see all homework their students have and avoid overload)
      if (isTeacher && !isAdminOrDirector) {
        if (teacherAssignedClassIds.length > 0) {
          query = query.in('class_id', teacherAssignedClassIds);
        } else {
          query = query.eq('teacher_id', user.id);
        }
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setDbTableMissing(true);
          try {
            const cached = localStorage.getItem(`edunova_homework_cache_${user.school_id || 'default'}`);
            if (cached) {
              setAssignments(JSON.parse(cached));
            } else {
              setAssignments([]);
            }
          } catch (e) {
            setAssignments([]);
          }
        } else {
          console.warn('Notice loading homework_assignments:', error);
          setAssignments([]);
        }
      } else if (data) {
        setDbTableMissing(false);
        const mapped: HomeworkAssignmentWithDetails[] = data.map((item: any) => ({
          ...item,
          class_name: item.classes?.name || 'Classe non assignée',
          subject_name: item.subjects?.name || 'Matière générale',
          subject_code: item.subjects?.code || '',
          teacher_name: item.profiles?.full_name || item.profiles?.email || 'Enseignant'
        }));
        setAssignments(mapped);
        try {
          localStorage.setItem(`edunova_homework_cache_${user.school_id || 'default'}`, JSON.stringify(mapped));
        } catch (e) {}
      }

      // Fetch all reads for analytics if authorized
      if (canManageHomework && user.school_id) {
        const { data: readsData } = await supabase
          .from('homework_student_reads')
          .select('*')
          .eq('school_id', user.school_id);
        if (readsData) {
          setAllReadsData(readsData);
        }
      }
    } catch (err) {
      console.error('Catch fetching homework:', err);
    } finally {
      setLoading(false);
    }
  }, [user.school_id, user.id, isTeacher, isAdminOrDirector, currentCampusId, canManageHomework, teacherAssignedClassIds]);

  // Load student tracking status for current user (if student or parent)
  const fetchStudentReadStatus = useCallback(async () => {
    if (!isStudent && !isParent) return;
    try {
      const studentId = user.id;
      const { data, error } = await supabase
        .from('homework_student_reads')
        .select('*')
        .eq('student_id', studentId);

      if (!error && data) {
        const mapping: Record<string, HomeworkStudentRead> = {};
        data.forEach((r: HomeworkStudentRead) => {
          mapping[r.assignment_id] = r;
        });
        setStudentReads(mapping);
      }
    } catch (e) {
      console.warn('Student read query notice:', e);
    }
  }, [user.id, isStudent, isParent]);

  useEffect(() => {
    fetchMetadata();
    fetchStudentReadStatus();
  }, [fetchMetadata, fetchStudentReadStatus]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Mark homework as read
  const recordHomeworkRead = async (assignmentId: string, manualAcknowledge = false) => {
    const studentId = user.id;
    const readerRole = isParent ? 'PARENT' : 'STUDENT';

    try {
      // 1. Try Supabase RPC if exists
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('mark_homework_read', {
        p_assignment_id: assignmentId,
        p_student_id: studentId,
        p_reader_role: readerRole
      });

      if (!rpcErr && rpcRes?.success) {
        setStudentReads(prev => ({
          ...prev,
          [assignmentId]: {
            ...(prev[assignmentId] || {}),
            id: prev[assignmentId]?.id || 'local-' + Date.now(),
            assignment_id: assignmentId,
            student_id: studentId,
            school_id: user.school_id || '',
            is_read: true,
            first_read_at: rpcRes.first_read_at || new Date().toISOString(),
            last_read_at: rpcRes.last_read_at || new Date().toISOString(),
            read_count: rpcRes.read_count || (prev[assignmentId]?.read_count || 0) + 1,
            read_by_role: readerRole,
            work_status: prev[assignmentId]?.work_status || 'TODO',
            parent_acknowledged: manualAcknowledge ? true : prev[assignmentId]?.parent_acknowledged,
            parent_acknowledged_at: manualAcknowledge ? new Date().toISOString() : prev[assignmentId]?.parent_acknowledged_at,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }));
        if (manualAcknowledge) {
          toast.success("Consultation & accusé de lecture enregistrés avec succès !");
        }
        return;
      }

      // 2. Fallback direct upsert in homework_student_reads
      const payload: any = {
        assignment_id: assignmentId,
        student_id: studentId,
        school_id: user.school_id || '',
        is_read: true,
        last_read_at: new Date().toISOString(),
        read_by_role: readerRole
      };
      if (manualAcknowledge && isParent) {
        payload.parent_acknowledged = true;
        payload.parent_acknowledged_at = new Date().toISOString();
      }

      const { data: upsertData, error: upsertErr } = await supabase
        .from('homework_student_reads')
        .upsert(payload, { onConflict: 'assignment_id,student_id' })
        .select()
        .single();

      if (!upsertErr && upsertData) {
        setStudentReads(prev => ({
          ...prev,
          [assignmentId]: upsertData as HomeworkStudentRead
        }));
        if (manualAcknowledge) {
          toast.success("Accusé de lecture enregistré dans le système !");
        }
      }
    } catch (err) {
      console.warn("Could not register read receipt:", err);
    }
  };

  // Toggle completion status for student
  const toggleStudentWorkDone = async (assignmentId: string, currentStatus: string) => {
    const studentId = user.id;
    const newStatus = currentStatus === 'COMPLETED' ? 'TODO' : 'COMPLETED';

    try {
      const { data, error } = await supabase
        .from('homework_student_reads')
        .upsert({
          assignment_id: assignmentId,
          student_id: studentId,
          school_id: user.school_id || '',
          work_status: newStatus,
          work_completed_at: newStatus === 'COMPLETED' ? new Date().toISOString() : null,
          is_read: true,
          last_read_at: new Date().toISOString()
        }, { onConflict: 'assignment_id,student_id' })
        .select()
        .single();

      if (!error && data) {
        setStudentReads(prev => ({
          ...prev,
          [assignmentId]: data as HomeworkStudentRead
        }));
        toast.success(newStatus === 'COMPLETED' ? "Devoir marqué comme terminé !" : "Devoir remis en attente.");
      }
    } catch (e) {
      console.warn("Failed toggling completion:", e);
    }
  };

  // Open detail view and record read
  const handleOpenDetail = (assignment: HomeworkAssignmentWithDetails) => {
    setActiveDetailAssignment(assignment);
    setIsDetailModalOpen(true);
    
    // Automatically record read if student or parent
    if (isStudent || isParent) {
      recordHomeworkRead(assignment.id, false);
    } else {
      // Load tracking stats for teacher
      loadClassTracking(assignment.id);
    }
  };

  // Load student tracking list for teachers
  const loadClassTracking = async (assignmentId: string) => {
    setLoadingTracking(true);
    try {
      const { data, error } = await supabase
        .from('homework_student_reads')
        .select(`
          *,
          students:student_id (first_name, last_name, code)
        `)
        .eq('assignment_id', assignmentId);

      if (!error && data) {
        setClassTrackingList(data);
      } else {
        setClassTrackingList([]);
      }
    } catch (e) {
      console.warn('Error loading class tracking:', e);
      setClassTrackingList([]);
    } finally {
      setLoadingTracking(false);
    }
  };

  // Open Automated Reminder Modal
  const handleOpenReminderModal = async (assignment: HomeworkAssignmentWithDetails) => {
    setReminderAssignment(assignment);
    setIsReminderModalOpen(true);
    setLoadingRecipients(true);

    // Default template message
    const formattedDate = new Date(assignment.due_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    setReminderMessage(
      `[${school?.name || 'EduNova Pro'}] Rappel Devoir : Votre enfant a un devoir de ${assignment.subject_name} ("${assignment.title}") à rendre pour le ${formattedDate}. Veuillez consulter son cahier de devoirs sur la plateforme.`
    );

    try {
      // 1. Fetch all students in this class
      const classStudents = allClassStudents.filter(s => s.class_id === assignment.class_id);

      // 2. Fetch existing reads for this assignment
      const { data: reads } = await supabase
        .from('homework_student_reads')
        .select('student_id, is_read, first_read_at')
        .eq('assignment_id', assignment.id);

      const readMap = new Map<string, any>();
      (reads || []).forEach(r => {
        if (r.is_read) readMap.set(r.student_id, r);
      });

      // 3. Compute hours since assignment creation
      const createdTime = new Date(assignment.created_at).getTime();
      const hoursSince = Math.max(0, (Date.now() - createdTime) / (1000 * 60 * 60));

      // 4. Map into target recipients
      const list: TargetStudentRecipient[] = classStudents.map(st => {
        const hasRead = readMap.has(st.id);
        return {
          id: st.id,
          name: `${st.last_name || ''} ${st.first_name || ''}`.trim(),
          parentName: st.parent_name || 'Parent d’élève',
          parentPhone: st.parent_phone || '',
          parentEmail: st.parent_email || '',
          isRead: hasRead,
          hoursSinceAssigned: hoursSince
        };
      });

      // Filter based on initial period: only unread
      const unreadList = list.filter(item => !item.isRead);
      setReminderRecipients(unreadList);
      setSelectedRecipientIds(unreadList.map(item => item.id));
    } catch (err) {
      console.error('Error preparing reminder recipients:', err);
    } finally {
      setLoadingRecipients(false);
    }
  };

  // Filter recipients based on selected period
  const filteredRecipients = useMemo(() => {
    if (!reminderAssignment) return reminderRecipients;

    const assignedDate = new Date(reminderAssignment.assigned_date).getTime();
    const now = Date.now();
    const hoursElapsed = (now - assignedDate) / (1000 * 60 * 60);

    return reminderRecipients.filter(item => {
      if (item.isRead) return false;
      if (reminderPeriod === 'ALL_UNREAD') return true;
      if (reminderPeriod === '24H') return hoursElapsed >= 24;
      if (reminderPeriod === '48H') return hoursElapsed >= 48;
      if (reminderPeriod === 'EVE_OF_DUE') {
        const dueDate = new Date(reminderAssignment.due_date).getTime();
        const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
        return hoursUntilDue <= 36;
      }
      return true;
    });
  }, [reminderRecipients, reminderPeriod, reminderAssignment]);

  // Dispatch Automated Reminders via SMS / Email API
  const handleSendReminders = async () => {
    if (selectedRecipientIds.length === 0) {
      toast.error("Veuillez sélectionner au moins un élève destinataire.");
      return;
    }
    if (!reminderMessage.trim()) {
      toast.error("Veuillez saisir le contenu du message de rappel.");
      return;
    }

    const targeted = reminderRecipients.filter(r => selectedRecipientIds.includes(r.id));
    setSendingReminders(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      let smsSuccessCount = 0;
      let emailSuccessCount = 0;

      // 1. Send SMS if selected
      if (reminderChannel === 'SMS' || reminderChannel === 'BOTH') {
        const smsRecipients = targeted
          .filter(t => t.parentPhone && t.parentPhone.trim().length >= 6)
          .map(t => ({ id: t.id, contact: t.parentPhone.trim() }));

        if (smsRecipients.length > 0) {
          const smsRes = await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token || ''}`
            },
            body: JSON.stringify({
              schoolId: user.school_id,
              recipients: smsRecipients,
              content: reminderMessage.trim()
            })
          });

          if (smsRes.ok) {
            smsSuccessCount = smsRecipients.length;
          } else {
            const err = await smsRes.json().catch(() => ({}));
            console.warn('SMS reminder warning:', err);
          }
        }
      }

      // 2. Send Email if selected
      if (reminderChannel === 'EMAIL' || reminderChannel === 'BOTH') {
        const emailRecipients = targeted
          .filter(t => t.parentEmail && t.parentEmail.includes('@'))
          .map(t => ({ email: t.parentEmail.trim(), name: t.parentName }));

        if (emailRecipients.length > 0) {
          const emailRes = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token || ''}`
            },
            body: JSON.stringify({
              schoolId: user.school_id,
              recipients: emailRecipients,
              subject: `Rappel Devoir : ${reminderAssignment?.title || 'Devoir en attente'}`,
              content: reminderMessage.trim()
            })
          });

          if (emailRes.ok) {
            emailSuccessCount = emailRecipients.length;
          } else {
            const err = await emailRes.json().catch(() => ({}));
            console.warn('Email reminder warning:', err);
          }
        }
      }

      toast.success("Rappels automatisés expédiés avec succès !", {
        description: `${targeted.length} élèves/parents notifiés (${smsSuccessCount} SMS, ${emailSuccessCount} Emails).`,
        duration: 5000
      });

      setIsReminderModalOpen(false);
    } catch (err: any) {
      console.error('Error dispatching reminders:', err);
      toast.error("Erreur lors de l'expédition des rappels : " + (err.message || 'Échec'));
    } finally {
      setSendingReminders(false);
    }
  };

  // Exportation CSV des devoirs pour archivage externe
  const exportToCSV = () => {
    const listToExport = filteredAssignments;
    if (listToExport.length === 0) {
      toast.error("Aucun devoir à exporter avec les filtres actuels.");
      return;
    }

    const currentClassName = selectedClassId === 'ALL' 
      ? 'Toutes_Classes' 
      : (classes.find(c => c.id === selectedClassId)?.name || 'Classe').replace(/\s+/g, '_');

    const headers = [
      "ID Devoir",
      "Classe",
      "Matière",
      "Titre",
      "Consignes & Énoncé",
      "Date Prescription",
      "Date Limite",
      "Heure Limite",
      "Durée Estimée (min)",
      "Modalité Contrôle",
      "Devoir Noté",
      "Barème Max",
      "Enseignant",
      "Nb Pièces Jointes",
      "Statut"
    ];

    const rows = listToExport.map(a => {
      const cleanDesc = (a.description || '').replace(/\r?\n/g, ' ').replace(/"/g, '""');
      const submissionLabel = 
        a.submission_type === 'IN_CLASS' ? 'Sur cahier en classe' :
        a.submission_type === 'ONLINE_FILE' ? 'Remise fichier en ligne' :
        a.submission_type === 'ONLINE_TEXT' ? 'Réponse rédigée en ligne' : 'Lecture / Leçon';

      return [
        a.id.substring(0, 8),
        `"${a.class_name || ''}"`,
        `"${a.subject_name || ''}"`,
        `"${(a.title || '').replace(/"/g, '""')}"`,
        `"${cleanDesc}"`,
        a.assigned_date,
        a.due_date,
        a.due_time || '08:00',
        a.estimated_duration_minutes || 30,
        `"${submissionLabel}"`,
        a.is_graded ? 'Oui' : 'Non',
        a.is_graded ? (a.max_score || 20) : '-',
        `"${a.teacher_name || ''}"`,
        a.attachments?.length || 0,
        a.status
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Cahier_Devoirs_${currentClassName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
    toast.success(`Export CSV généré avec succès (${listToExport.length} devoir(s) exporté(s)) !`);
  };

  // Exportation PDF du registre officiel des devoirs
  const exportToPDF = () => {
    const listToExport = filteredAssignments;
    if (listToExport.length === 0) {
      toast.error("Aucun devoir à exporter avec les filtres actuels.");
      return;
    }

    const currentClassName = selectedClassId === 'ALL' 
      ? 'Toutes les classes' 
      : (classes.find(c => c.id === selectedClassId)?.name || 'Classe');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // En-tête officiel
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(school?.name || "EduNova Pro - Établissement Scolaire", 14, 15);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Registre Officiel des Devoirs & Cahier de Textes • Archivage Académique`, 14, 22);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Classe ciblée : ${currentClassName} | Généré le : ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} par ${user.full_name || user.email}`, 14, 28);

    // Tableau des devoirs
    const tableBody = listToExport.map(a => {
      const submissionLabel = 
        a.submission_type === 'IN_CLASS' ? 'Sur cahier' :
        a.submission_type === 'ONLINE_FILE' ? 'En ligne (fichier)' :
        a.submission_type === 'ONLINE_TEXT' ? 'En ligne (texte)' : 'Leçon';
      
      const gradeLabel = a.is_graded ? `Noté /${a.max_score || 20}` : 'Non noté';

      return [
        new Date(a.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        a.class_name || '-',
        a.subject_name || '-',
        a.title,
        a.description.length > 80 ? a.description.substring(0, 80) + '...' : a.description,
        a.teacher_name || '-',
        `${submissionLabel}\n(${gradeLabel})`
      ];
    });

    autoTable(doc, {
      startY: 33,
      head: [['Échéance', 'Classe', 'Matière', 'Titre de l\'exercice', 'Consignes officielles', 'Enseignant', 'Modalité']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [15, 23, 42],
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 24 },
        2: { cellWidth: 28 },
        3: { cellWidth: 46, fontStyle: 'bold' },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 32 },
        6: { cellWidth: 30 }
      },
      didDrawPage: () => {
        const pageCount = typeof (doc as any).internal?.getNumberOfPages === 'function' 
          ? (doc as any).internal.getNumberOfPages() 
          : 1;
        const str = `Page ${pageCount} • EduNova Pro - Système Intégré de Gestion Scolaire`;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(str, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      }
    });

    const fileSafeClass = currentClassName.replace(/\s+/g, '_');
    doc.save(`Registre_Devoirs_${fileSafeClass}_${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
    toast.success(`Archive PDF générée avec succès (${listToExport.length} devoir(s) exporté(s)) !`);
  };

  // Enregistrement des paramètres d'archivage automatique
  const handleSaveArchiveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingArchiveSettings(true);
    try {
      localStorage.setItem('edunova_homework_archive_schedule', JSON.stringify(archiveSettings));
      
      try {
        await supabase.from('global_settings').upsert({
          key: `homework_archive_schedule_${user.school_id || 'default'}`,
          value: JSON.stringify(archiveSettings)
        });
      } catch (err) {}

      toast.success("Planification d'archivage automatique enregistrée !", {
        description: archiveSettings.isEnabled 
          ? "L'archivage s'exécutera automatiquement chaque fin de mois vers le cloud." 
          : "L'archivage automatique a été désactivé.",
        duration: 5000
      });
      setIsScheduleModalOpen(false);
    } catch (err: any) {
      toast.error("Erreur lors de la sauvegarde : " + err.message);
    } finally {
      setSavingArchiveSettings(false);
    }
  };

  // Déclenchement manuel immédiat de l'archivage mensuel
  const handleExecuteArchiveNow = async () => {
    setExecutingArchiveNow(true);
    try {
      const now = new Date();
      const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const yearMonth = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;

      // 1. Structure complète des données de l'archive
      const archivePayload = {
        meta: {
          archiveType: 'HOMEWORK_MONTHLY_ARCHIVE',
          generatedAt: now.toISOString(),
          schoolId: user.school_id,
          schoolName: school?.name || 'EduNova Pro',
          campusId: currentCampusId || null,
          generatedBy: {
            id: user.id,
            name: user.full_name || user.email,
            role: user.role
          },
          period: monthLabel,
          destination: archiveSettings.destination
        },
        summary: {
          totalAssignments: assignments.length,
          totalReadsRecorded: allReadsData.length,
          classesCount: classes.length,
          subjectsCount: subjects.length,
          classAnalytics: classAnalyticsData,
          subjectAnalytics: subjectAnalyticsData
        },
        assignments: assignments.map(a => ({
          ...a,
          reads: allReadsData.filter(r => r.assignment_id === a.id)
        }))
      };

      const jsonString = JSON.stringify(archivePayload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const sizeKb = Math.round(blob.size / 1024) || 85;

      // 2. Téléversement optionnel dans Supabase Storage
      let cloudUrl: string | undefined;
      try {
        const filePath = `homework_archives/${user.school_id || 'school'}/${yearMonth}_archive.json`;
        const { error: uploadError } = await supabase.storage
          .from(archiveSettings.bucketName || 'academic_archives')
          .upload(filePath, blob, { upsert: true });

        if (!uploadError) {
          const { data: pubData } = supabase.storage
            .from(archiveSettings.bucketName || 'academic_archives')
            .getPublicUrl(filePath);
          cloudUrl = pubData?.publicUrl;
        }
      } catch (storageErr) {
        console.warn('Notice upload storage cloud:', storageErr);
      }

      // 3. Mise à jour de l'historique d'archivage
      const newEntry = {
        id: `arch_${Date.now()}`,
        monthName: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        dateCreated: now.toISOString(),
        totalAssignments: assignments.length,
        totalReads: allReadsData.length,
        fileSizeKb: sizeKb,
        status: 'SUCCESS',
        cloudUrl
      };

      const updatedHistory = [newEntry, ...archiveHistory];
      setArchiveHistory(updatedHistory);
      localStorage.setItem('edunova_homework_archive_history', JSON.stringify(updatedHistory));

      // 4. Actualiser la date de dernière exécution
      const updatedSettings = {
        ...archiveSettings,
        lastArchivedAt: now.toISOString()
      };
      setArchiveSettings(updatedSettings);
      localStorage.setItem('edunova_homework_archive_schedule', JSON.stringify(updatedSettings));

      // 5. Téléchargement automatique de l'archive pour l'enseignant
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = `Archive_Devoirs_${yearMonth}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      toast.success(`Archive du mois (${monthLabel}) générée avec succès !`, {
        description: `Export complet de ${assignments.length} devoirs sauvegardé (${sizeKb} KB).`,
        duration: 5000
      });
    } catch (err: any) {
      console.error('Erreur archivage immédiat:', err);
      toast.error("Échec de la génération de l'archive : " + (err.message || 'Erreur'));
    } finally {
      setExecutingArchiveNow(false);
    }
  };

  // =========================================================================
  // ASSISTANCE & INITIALISATION SUPABASE SQL
  // =========================================================================
  const handleCopySql = () => {
    navigator.clipboard.writeText(HOMEWORK_MODULE_SQL);
    setCopiedSql(true);
    toast.success("Script SQL copié dans le presse-papiers !", {
      description: "Collez-le dans l'éditeur SQL de Supabase (SQL Editor) puis cliquez sur Run.",
      duration: 5000
    });
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([HOMEWORK_MODULE_SQL], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'centralized_homework_module.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Fichier centralized_homework_module.sql téléchargé !");
  };

  const handleCheckDbConnection = async () => {
    setCheckingDb(true);
    try {
      await fetchAssignments();
      const { error } = await supabase.from('homework_assignments').select('id').limit(1);
      if (!error) {
        setDbTableMissing(false);
        toast.success("Connexion réussie ! Table homework_assignments active.", {
          description: "La persistance cloud Supabase est opérationnelle.",
          duration: 5000
        });
      } else {
        toast.warning("Table non encore détectée dans Supabase", {
          description: "Vérifiez que vous avez bien exécuté le script dans l'onglet SQL Editor de Supabase.",
          duration: 6000
        });
      }
    } catch (err: any) {
      toast.error("Vérification échouée : " + err.message);
    } finally {
      setCheckingDb(false);
    }
  };

  // Save / Update Homework Assignment
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formClassId || !formSubjectId || !formDueDate) {
      toast.error("Veuillez remplir le titre, la classe, la matière et la date limite.");
      return;
    }

    setSubmittingForm(true);
    try {
      const payload: any = {
        school_id: user.school_id,
        campus_id: currentCampusId || null,
        class_id: formClassId,
        subject_id: formSubjectId,
        teacher_id: editingAssignment ? editingAssignment.teacher_id : user.id,
        title: formTitle.trim(),
        description: formDescription.trim(),
        attachments: formAttachments,
        due_date: formDueDate,
        due_time: formDueTime,
        estimated_duration_minutes: formDuration,
        submission_type: formSubmissionType,
        is_graded: formIsGraded,
        max_score: formIsGraded ? formMaxScore : null,
        status: 'PUBLISHED'
      };

      if (editingAssignment) {
        const { error } = await supabase
          .from('homework_assignments')
          .update(payload)
          .eq('id', editingAssignment.id);

        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            setDbTableMissing(true);
            const updated = assignments.map(a => a.id === editingAssignment.id ? { ...a, ...payload } : a);
            setAssignments(updated);
            try {
              localStorage.setItem(`edunova_homework_cache_${user.school_id || 'default'}`, JSON.stringify(updated));
            } catch (e) {}
            toast.warning("Modifié localement (Table Supabase en attente d'initialisation).");
          } else {
            throw error;
          }
        } else {
          toast.success("Devoir mis à jour avec succès !");
        }
      } else {
        const { error } = await supabase
          .from('homework_assignments')
          .insert([payload]);

        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            setDbTableMissing(true);
            const targetClass = classes.find(c => c.id === formClassId);
            const targetSubject = subjects.find(s => s.id === formSubjectId);
            const fallbackItem: HomeworkAssignmentWithDetails = {
              id: 'local_' + Date.now(),
              ...payload,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              class_name: targetClass?.name || 'Classe sélectionnée',
              subject_name: targetSubject?.name || 'Matière',
              subject_code: targetSubject?.code || '',
              teacher_name: user.full_name || user.email || 'Enseignant'
            };
            const updated = [fallbackItem, ...assignments];
            setAssignments(updated);
            try {
              localStorage.setItem(`edunova_homework_cache_${user.school_id || 'default'}`, JSON.stringify(updated));
            } catch (e) {}
            toast.warning("Devoir enregistré localement !", {
              description: "Exécutez le script SQL dans Supabase pour synchroniser le cloud."
            });
          } else {
            throw error;
          }
        } else {
          toast.success("Devoir publié dans le cahier de textes !");
        }
      }

      setIsModalOpen(false);
      resetForm();
      fetchAssignments();
    } catch (err: any) {
      console.error("Save homework error:", err);
      toast.error("Erreur lors de la sauvegarde du devoir : " + (err.message || 'Échec'));
    } finally {
      setSubmittingForm(false);
    }
  };

  // Delete Homework Assignment
  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce devoir ? Cette action est irréversible.")) {
      return;
    }
    try {
      const { error } = await supabase
        .from('homework_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Devoir supprimé avec succès.");
      setAssignments(prev => prev.filter(a => a.id !== id));
      if (activeDetailAssignment?.id === id) {
        setIsDetailModalOpen(false);
      }
    } catch (err: any) {
      toast.error("Impossible de supprimer le devoir : " + err.message);
    }
  };

  // Available filter subjects: automatically adapts based on selectedClassId
  const availableFilterSubjects = useMemo(() => {
    if (selectedClassId === 'ALL') {
      if (isTeacher && !isAdminOrDirector && teacherAssignments.length > 0) {
        const teacherSubIds = new Set(teacherAssignments.map(a => a.subject_id).filter(Boolean));
        const teacherSubNames = new Set(teacherAssignments.map(a => a.subject_name).filter(Boolean));
        const teacherSubs = subjects.filter(s => teacherSubIds.has(s.id) || teacherSubNames.has(s.name));
        if (teacherSubs.length > 0) return teacherSubs;
      }
      return subjects;
    }

    // Specific class selected: find subjects linked in class_subjects or staff_assignments
    const selectedClass = classes.find(c => c.id === selectedClassId);
    const classSubIds = new Set(
      classSubjects
        .filter(cs => cs.class_id === selectedClassId)
        .map(cs => cs.subject_id)
    );

    teacherAssignments
      .filter(a => a.class_id === selectedClassId || (selectedClass && a.class_name === selectedClass.name))
      .forEach(a => {
        if (a.subject_id) classSubIds.add(a.subject_id);
      });

    let filtered = subjects.filter(s => classSubIds.has(s.id));

    // When teacher filters "Mes devoirs uniquement", only show subjects they teach in that class
    if (isTeacher && !isAdminOrDirector && teacherScope === 'MINE_ONLY') {
      const teacherSubsInClass = teacherAssignments
        .filter(a => a.class_id === selectedClassId || (selectedClass && a.class_name === selectedClass.name))
        .map(a => a.subject_id)
        .filter(Boolean);
      if (teacherSubsInClass.length > 0) {
        const teacherSubSet = new Set(teacherSubsInClass);
        const mine = filtered.filter(s => teacherSubSet.has(s.id));
        if (mine.length > 0) filtered = mine;
      }
    }

    return filtered.length > 0 ? filtered : (isTeacher ? subjects.filter(s => teacherAssignments.some(ta => ta.subject_id === s.id)) : subjects);
  }, [selectedClassId, subjects, classSubjects, teacherAssignments, isTeacher, isAdminOrDirector, classes, teacherScope]);

  // Auto-reset subject filter if current subject is not available for the selected class
  useEffect(() => {
    if (selectedClassId !== 'ALL' && selectedSubjectId !== 'ALL') {
      const exists = availableFilterSubjects.some(s => s.id === selectedSubjectId);
      if (!exists) {
        setSelectedSubjectId('ALL');
      }
    }
  }, [selectedClassId, availableFilterSubjects, selectedSubjectId]);

  // Available form subjects: strictly adapted to the exact class selected in the creation form
  const availableFormSubjects = useMemo(() => {
    if (!formClassId) return [];

    const selectedClass = classes.find(c => c.id === formClassId);
    const classSubIds = new Set(
      classSubjects
        .filter(cs => cs.class_id === formClassId)
        .map(cs => cs.subject_id)
    );

    teacherAssignments
      .filter(a => a.class_id === formClassId || (selectedClass && a.class_name === selectedClass.name))
      .forEach(a => {
        if (a.subject_id) classSubIds.add(a.subject_id);
      });

    let filtered = subjects.filter(s => classSubIds.has(s.id));

    // If teacher without admin rights, strictly restrict to subjects this teacher teaches in that class
    if (isTeacher && !isAdminOrDirector && teacherAssignments.length > 0) {
      const teacherSubsInClass = teacherAssignments
        .filter(a => a.class_id === formClassId || (selectedClass && a.class_name === selectedClass.name))
        .map(a => a.subject_id)
        .filter(Boolean);
      const teacherSubNamesInClass = teacherAssignments
        .filter(a => a.class_id === formClassId || (selectedClass && a.class_name === selectedClass.name))
        .map(a => a.subject_name)
        .filter(Boolean);

      if (teacherSubsInClass.length > 0 || teacherSubNamesInClass.length > 0) {
        const teacherSubSet = new Set(teacherSubsInClass);
        const teacherNameSet = new Set(teacherSubNamesInClass);
        const strictSubs = (filtered.length > 0 ? filtered : subjects).filter(s =>
          teacherSubSet.has(s.id) || teacherNameSet.has(s.name)
        );
        if (strictSubs.length > 0) {
          return strictSubs;
        }
      }
    }

    if (filtered.length > 0) {
      return filtered;
    }

    // Fallback only if no class_subjects configured yet in the school
    if (isTeacher && !isAdminOrDirector && teacherAssignments.length > 0) {
      const teacherOwnSubs = subjects.filter(s =>
        teacherAssignments.some(ta => ta.subject_id === s.id || ta.subject_name === s.name)
      );
      if (teacherOwnSubs.length > 0) return teacherOwnSubs;
    }

    return isAdminOrDirector ? subjects : [];
  }, [formClassId, classSubjects, subjects, teacherAssignments, classes, isTeacher, isAdminOrDirector]);

  // Dynamic automatic synchronization: when target class changes, ensure selected subject is strictly valid
  useEffect(() => {
    if (!formClassId) {
      setFormSubjectId('');
      return;
    }
    if (availableFormSubjects.length > 0) {
      const isCurrentValid = availableFormSubjects.some(s => s.id === formSubjectId);
      if (!isCurrentValid) {
        setFormSubjectId(availableFormSubjects[0].id);
      }
    } else {
      setFormSubjectId('');
    }
  }, [formClassId, availableFormSubjects, formSubjectId]);

  // Handle class selection in the modal with dynamic subject adaptation
  const handleSelectFormClass = (classId: string) => {
    setFormClassId(classId);
  };

  const resetForm = () => {
    setEditingAssignment(null);
    setFormTitle('');
    setFormDescription('');
    setFormContentMode('TYPE');
    setEditorViewMode('WRITE');
    setPreviewAttachment(null);
    setActiveInlinePreviewIdx(null);
    setShowFormattingMenu(false);
    setIsDraggingFile(false);
    setShowMathSymbols(false);

    const targetClasses = isTeacher && !isAdminOrDirector && teacherAssignedClasses.length > 0 
      ? teacherAssignedClasses 
      : classes;

    // Use current filter class if valid, otherwise first available class
    let initialClassId = '';
    if (selectedClassId !== 'ALL' && targetClasses.some(c => c.id === selectedClassId)) {
      initialClassId = selectedClassId;
    } else {
      initialClassId = targetClasses[0]?.id || '';
    }

    setFormClassId(initialClassId);
    setFormDuration(30);
    setFormSubmissionType('IN_CLASS');
    setFormIsGraded(false);
    setFormMaxScore(20);
    setFormAttachments([]);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
  };

  const handleEditClick = (assignment: HomeworkAssignmentWithDetails) => {
    setEditingAssignment(assignment);
    setFormTitle(assignment.title);
    setFormDescription(assignment.description);
    setFormClassId(assignment.class_id);
    setFormSubjectId(assignment.subject_id);
    setFormDueDate(assignment.due_date);
    setFormDueTime(assignment.due_time || '08:00');
    setFormDuration(assignment.estimated_duration_minutes || 30);
    setFormSubmissionType(assignment.submission_type);
    setFormIsGraded(Boolean(assignment.is_graded));
    setFormMaxScore(assignment.max_score || 20);
    setFormAttachments(assignment.attachments || []);
    setFormContentMode(assignment.attachments && assignment.attachments.length > 0 ? 'BOTH' : 'TYPE');
    setEditorViewMode('WRITE');
    setPreviewAttachment(null);
    setActiveInlinePreviewIdx(null);
    setShowFormattingMenu(false);
    setShowMathSymbols(false);
    setIsModalOpen(true);
  };

  const addAttachment = () => {
    if (!newAttachmentName.trim() || !newAttachmentUrl.trim()) {
      toast.error("Veuillez indiquer le nom et le lien de la ressource.");
      return;
    }
    setFormAttachments(prev => [
      ...prev,
      { name: newAttachmentName.trim(), url: newAttachmentUrl.trim(), type: 'LINK' }
    ]);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    toast.success("Lien ajouté aux pièces jointes !");
  };

  const removeAttachment = (index: number) => {
    setFormAttachments(prev => prev.filter((_, i) => i !== index));
    toast.info("Document retiré.");
  };

  // Upload handler for typed files (PDF, Word docx/doc, scan/image, excel, etc.)
  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadingFile(true);

    try {
      const fileList = Array.from(files);
      let addedCount = 0;

      for (const file of fileList) {
        if (file.size > 15 * 1024 * 1024) {
          toast.error(`Le fichier "${file.name}" dépasse la limite de 15 Mo.`);
          continue;
        }

        const fileCategory = getFileCategory(file.name, file.type);
        
        // Read file as Data URL to guarantee 100% reliable persistence and offline preview
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier"));
          reader.readAsDataURL(file);
        });

        const newAtt: HomeworkAttachment = {
          name: file.name,
          url: dataUrl,
          type: fileCategory.toUpperCase(),
          size: file.size
        };

        setFormAttachments(prev => [...prev, newAtt]);
        addedCount++;

        // Auto-fill title if currently empty
        setFormTitle(prev => {
          if (!prev.trim()) {
            const cleanName = file.name
              .replace(/\.[^/.]+$/, '')
              .replace(/[_-]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            return `Devoir - ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
          }
          return prev;
        });

        // Auto-fill description if currently empty
        setFormDescription(prev => {
          if (!prev.trim()) {
            return `Consultez le document joint **${file.name}** pour réaliser les exercices et consignes demandés.`;
          }
          return prev;
        });
      }

      if (addedCount > 0) {
        toast.success(`${addedCount} document${addedCount > 1 ? 's' : ''} joint${addedCount > 1 ? 's' : ''} avec succès !`);
      }
    } catch (err: any) {
      toast.error("Échec du téléversement : " + err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const applyTemplate = (templateContent: string) => {
    if (editorViewMode === 'PREVIEW') setEditorViewMode('WRITE');
    if (formDescription.trim()) {
      setFormDescription(prev => `${prev}\n\n---\n\n${templateContent}`);
      toast.info("Modèle ajouté à vos consignes existantes.");
    } else {
      setFormDescription(templateContent);
      toast.success("Modèle de devoir appliqué avec succès !");
    }
  };

  const insertMathSymbol = (symbol: string) => {
    if (editorViewMode === 'PREVIEW') setEditorViewMode('WRITE');
    const textarea = document.getElementById('homework-description-textarea') as HTMLTextAreaElement;
    if (!textarea) {
      setFormDescription(prev => prev + symbol);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = formDescription.substring(0, start) + symbol + formDescription.substring(end);
    setFormDescription(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + symbol.length, start + symbol.length);
    }, 50);
  };

  const insertRichTag = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    if (editorViewMode === 'PREVIEW') setEditorViewMode('WRITE');
    const textarea = document.getElementById('homework-description-textarea') as HTMLTextAreaElement;
    if (!textarea) {
      setFormDescription(prev => prev + prefix + defaultPlaceholder + suffix);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formDescription.substring(start, end);
    const textToInsert = selectedText || defaultPlaceholder;
    const replacement = `${prefix}${textToInsert}${suffix}`;
    const newText = formDescription.substring(0, start) + replacement + formDescription.substring(end);
    setFormDescription(newText);
    setTimeout(() => {
      textarea.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + textToInsert.length;
      textarea.setSelectionRange(cursorStart, cursorEnd);
    }, 50);
  };

  const insertHeading = (level: 1 | 2 | 3) => {
    const hashes = '#'.repeat(level);
    insertRichTag(`\n${hashes} `, '\n', `Titre de section niveau ${level}`);
  };

  const insertCallout = (type: 'consigne' | 'attention' | 'conseil' | 'objectif' | 'bareme') => {
    const calloutMap: Record<string, { prefix: string; text: string }> = {
      consigne: { prefix: '\n> 📌 **CONSIGNE :** ', text: 'Énoncer précisément les étapes et le travail attendu.' },
      attention: { prefix: '\n> ⚠️ **ATTENTION :** ', text: 'Prendre garde à bien justifier vos réponses et respecter les consignes.' },
      conseil: { prefix: '\n> 💡 **CONSEIL :** ', text: 'Faire d\'abord un brouillon et relire attentivement avant de recopier.' },
      objectif: { prefix: '\n> 🎯 **OBJECTIF PÉDAGOGIQUE :** ', text: 'Maîtriser les propriétés fondamentales et les définitions.' },
      bareme: { prefix: '\n> 🏆 **BARÈME DÉTAILLÉ :** \n> - Exercice 1 : 6 pts\n> - Exercice 2 : 8 pts\n> - Rédaction & Soin : 2 pts\n', text: '' }
    };
    const c = calloutMap[type];
    insertRichTag(c.prefix, '\n', c.text);
  };

  const insertChecklist = () => {
    insertRichTag('\n- [ ] Étape 1 : ', '\n- [ ] Étape 2 : \n- [ ] Étape 3 : \n', 'Lire la consigne et préparer les outils');
  };

  const insertTable = () => {
    const tableTemplate = `\n\n| Exercice / Question | Consigne principale | Barème |\n| :--- | :--- | :---: |\n| Question 1 | Calculer et simplifier l'expression | 4 pts |\n| Question 2 | Justifier la propriété utilisée | 4 pts |\n| Présentation | Clarté et propreté de la copie | 2 pts |\n\n`;
    insertRichTag(tableTemplate, '');
  };

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const matchesSearch = 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.class_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesClass = selectedClassId === 'ALL' || a.class_id === selectedClassId;
      const matchesSubject = selectedSubjectId === 'ALL' || a.subject_id === selectedSubjectId;

      if (!matchesSearch || !matchesClass || !matchesSubject) return false;

      // Teacher filter: scope (all class homework vs only homework given by this teacher)
      if (isTeacher && !isAdminOrDirector && teacherScope === 'MINE_ONLY') {
        if (a.teacher_id !== user.id) return false;
      }

      // Status filter
      if (selectedStatusFilter === 'ALL') return true;
      const today = new Date().toISOString().split('T')[0];
      const readState = studentReads[a.id];

      if (selectedStatusFilter === 'COMPLETED') {
        return readState?.work_status === 'COMPLETED';
      }
      if (selectedStatusFilter === 'PENDING') {
        return readState?.work_status !== 'COMPLETED';
      }
      if (selectedStatusFilter === 'DUE_TODAY') {
        return a.due_date === today;
      }
      if (selectedStatusFilter === 'LATE') {
        return a.due_date < today && readState?.work_status !== 'COMPLETED';
      }

      return true;
    });
  }, [assignments, searchQuery, selectedClassId, selectedSubjectId, selectedStatusFilter, studentReads, isTeacher, isAdminOrDirector, teacherScope, user.id]);

  // Calculations for quick dashboard stats
  const statsOverview = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const total = assignments.length;
    const dueToday = assignments.filter(a => a.due_date === today).length;
    const upcoming = assignments.filter(a => a.due_date > today).length;
    const completedCount = Object.values(studentReads).filter(r => r.work_status === 'COMPLETED').length;

    return { total, dueToday, upcoming, completedCount };
  }, [assignments, studentReads]);

  // =========================================================================
  // RECHARTS ANALYTICS COMPUTATIONS : PAR CLASSE ET PAR MATIÈRE
  // =========================================================================

  // Analytics by Class
  const classAnalyticsData = useMemo(() => {
    if (classes.length === 0 || assignments.length === 0) return [];

    return classes.map(c => {
      const classAssignments = assignments.filter(a => a.class_id === c.id);
      const studentCountInClass = allClassStudents.filter(s => s.class_id === c.id).length || 1;
      
      if (classAssignments.length === 0) {
        return {
          name: c.name,
          readRate: 0,
          completedRate: 0,
          assignmentsCount: 0,
          studentsCount: studentCountInClass
        };
      }

      // Calculate total reads for assignments of this class
      let totalExpectedReads = classAssignments.length * studentCountInClass;
      let totalActualReads = 0;
      let totalCompleted = 0;

      classAssignments.forEach(a => {
        const readsForAssignment = allReadsData.filter(r => r.assignment_id === a.id);
        totalActualReads += readsForAssignment.filter(r => r.is_read).length;
        totalCompleted += readsForAssignment.filter(r => r.work_status === 'COMPLETED').length;
      });

      const readRate = Math.min(100, Math.round((totalActualReads / totalExpectedReads) * 100));
      const completedRate = Math.min(100, Math.round((totalCompleted / totalExpectedReads) * 100));

      return {
        name: c.name,
        readRate: isNaN(readRate) ? 0 : readRate,
        completedRate: isNaN(completedRate) ? 0 : completedRate,
        assignmentsCount: classAssignments.length,
        studentsCount: studentCountInClass
      };
    }).filter(c => c.assignmentsCount > 0);
  }, [classes, assignments, allClassStudents, allReadsData]);

  // Analytics by Subject
  const subjectAnalyticsData = useMemo(() => {
    if (subjects.length === 0 || assignments.length === 0) return [];

    return subjects.map(s => {
      const subjectAssignments = assignments.filter(a => a.subject_id === s.id);
      if (subjectAssignments.length === 0) return null;

      let totalExpectedReads = 0;
      let totalActualReads = 0;
      let totalCompleted = 0;

      subjectAssignments.forEach(a => {
        const studentCountInClass = allClassStudents.filter(st => st.class_id === a.class_id).length || 1;
        totalExpectedReads += studentCountInClass;
        const readsForAssignment = allReadsData.filter(r => r.assignment_id === a.id);
        totalActualReads += readsForAssignment.filter(r => r.is_read).length;
        totalCompleted += readsForAssignment.filter(r => r.work_status === 'COMPLETED').length;
      });

      const readRate = totalExpectedReads > 0 ? Math.min(100, Math.round((totalActualReads / totalExpectedReads) * 100)) : 0;
      const completedRate = totalExpectedReads > 0 ? Math.min(100, Math.round((totalCompleted / totalExpectedReads) * 100)) : 0;

      return {
        name: s.code || s.name,
        fullName: s.name,
        readRate,
        completedRate,
        assignmentsCount: subjectAssignments.length
      };
    }).filter(Boolean) as any[];
  }, [subjects, assignments, allClassStudents, allReadsData]);

  // Global Pie Chart distribution of student engagement
  const engagementPieData = useMemo(() => {
    let completed = 0;
    let readPending = 0;
    let unread = 0;

    assignments.forEach(a => {
      const classStudents = allClassStudents.filter(s => s.class_id === a.class_id);
      const readsForA = allReadsData.filter(r => r.assignment_id === a.id);
      const readMap = new Map<string, HomeworkStudentRead>();
      readsForA.forEach(r => readMap.set(r.student_id, r));

      classStudents.forEach(st => {
        const r = readMap.get(st.id);
        if (!r || !r.is_read) {
          unread += 1;
        } else if (r.work_status === 'COMPLETED') {
          completed += 1;
        } else {
          readPending += 1;
        }
      });
    });

    const total = completed + readPending + unread;
    if (total === 0) {
      return [
        { name: 'Non consultés', value: 1, color: '#f87171' },
        { name: 'Lus en cours', value: 0, color: '#38bdf8' },
        { name: 'Complétés', value: 0, color: '#34d399' }
      ];
    }

    return [
      { name: 'Complétés & Faits', value: completed, color: '#10b981' },
      { name: 'Lus mais en attente', value: readPending, color: '#6366f1' },
      { name: 'Non encore consultés', value: unread, color: '#f43f5e' }
    ];
  }, [assignments, allClassStudents, allReadsData]);

  // Total unread count for reminder trigger
  const globalUnreadCount = useMemo(() => {
    let count = 0;
    assignments.forEach(a => {
      const classStudents = allClassStudents.filter(s => s.class_id === a.class_id);
      const readsForA = allReadsData.filter(r => r.assignment_id === a.id && r.is_read);
      const unreadInClass = Math.max(0, classStudents.length - readsForA.length);
      count += unreadInClass;
    });
    return count;
  }, [assignments, allClassStudents, allReadsData]);

  return (
    <div className="max-w-7xl mx-auto p-2.5 sm:p-4 lg:p-5 space-y-3.5 animate-in fade-in duration-200 font-sans">
      
      {/* Banner if SQL table has not yet been executed */}
      {dbTableMissing && (
        <div className="p-3 sm:p-3.5 bg-amber-500/10 border border-amber-400/40 rounded-2xl shadow-2xs space-y-2.5 text-amber-950 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Database size={16} />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-amber-950 flex items-center gap-2">
                  <span>Configuration Supabase requise</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-200/80 text-amber-900">
                    v2.0
                  </span>
                </h3>
                <p className="text-[11px] text-amber-900/90 font-medium">
                  Exécutez le script SQL ci-dessous dans votre projet Supabase pour activer la synchronisation.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={checkingDb}
              onClick={handleCheckDbConnection}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 self-end sm:self-auto"
            >
              <RefreshCw className={checkingDb ? "animate-spin" : ""} size={12} />
              <span>{checkingDb ? "Vérification..." : "Vérifier la connexion"}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopySql}
              className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-slate-800 border border-amber-300/80 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              {copiedSql ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} className="text-amber-600" />}
              <span>{copiedSql ? "Copié !" : "Copier le Script SQL"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSql}
              className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-slate-800 border border-amber-300/80 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <Download size={13} className="text-indigo-600" />
              <span>Télécharger .sql</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSqlModalOpen(true)}
              className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 font-bold border border-amber-400/40 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileCode size={13} className="text-amber-700" />
              <span>Voir le Code</span>
            </button>
          </div>
        </div>
      )}

      {/* Modern, Compact Header & Quick Actions */}
      <div className="bg-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Module Identity */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
            <BookOpen size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight whitespace-nowrap">
              Gestion Centralisée des Devoirs
            </h1>
            <p className="text-[11px] text-slate-500 font-medium whitespace-nowrap truncate">
              Cahier de textes & suivi des exercices
            </p>
          </div>
        </div>

        {/* Center / Right: View Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {/* Switch tab for teachers / directors */}
          {canManageHomework && (
            <div className="bg-slate-100 p-0.5 rounded-xl flex text-xs font-bold border border-slate-200/70 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('assignments')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'assignments' 
                    ? 'bg-white text-indigo-700 shadow-2xs font-black' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vue Enseignants
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('studentView')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'studentView' 
                    ? 'bg-white text-indigo-700 shadow-2xs font-black' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vue Élèves & Parents
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'analytics' 
                    ? 'bg-white text-indigo-700 shadow-2xs font-black' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart2 size={13} />
                <span>Analytique</span>
              </button>
            </div>
          )}

          {canManageHomework && (
            <div className="flex items-center gap-1.5 ml-auto md:ml-0 shrink-0">
              {/* Bouton Planifier l'archivage */}
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(true)}
                className="py-1.5 px-2.5 bg-indigo-50/90 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                title="Planifier l'archivage automatique vers le cloud en fin de mois"
              >
                <FolderArchive size={13} className="text-indigo-600" />
                <span className="hidden sm:inline">Planifier</span>
                {archiveSettings.isEnabled && (
                  <span className="flex h-2 w-2 relative" title="Archivage automatique actif chaque fin de mois">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </button>

              {/* Menu Exporter */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="py-1.5 px-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                  title="Exporter et archiver les devoirs"
                >
                  <Download size={13} className="text-indigo-600" />
                  <span>Exporter</span>
                  <ChevronDown size={12} className="text-slate-400" />
                </button>

                {showExportMenu && (
                  <div 
                    className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 animate-in fade-in slide-in-from-top-1 duration-150"
                    onMouseLeave={() => setShowExportMenu(false)}
                  >
                    <button
                      type="button"
                      onClick={exportToCSV}
                      className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Download size={12} className="text-emerald-600" />
                      <span>Exporter en CSV (Excel)</span>
                    </button>
                    <button
                      type="button"
                      onClick={exportToPDF}
                      className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-t border-slate-100"
                    >
                      <FileText size={12} className="text-rose-600" />
                      <span>Exporter en PDF officiel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        setIsScheduleModalOpen(true);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-bold text-indigo-700 hover:bg-indigo-50/80 flex items-center gap-2 cursor-pointer border-t border-slate-100"
                    >
                      <FolderArchive size={12} className="text-indigo-600" />
                      <span>Planifier vers le cloud...</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Bouton Primaire Nouveau Devoir */}
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsModalOpen(true);
                }}
                className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                <Plus size={14} />
                <span>Nouveau Devoir</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          TAB 1 & 2 : ASSIGNMENTS & STUDENT VIEW
          ========================================================================= */}
      {activeTab !== 'analytics' && (
        <>
          {/* Compact KPI Metric Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Devoirs</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight mt-0.5">{statsOverview.total}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <BookOpen size={16} />
              </div>
            </div>

            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Aujourd'hui</p>
                <p className="text-xl sm:text-2xl font-black text-amber-600 leading-tight mt-0.5">{statsOverview.dueToday}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={16} />
              </div>
            </div>

            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">À Venir</p>
                <p className="text-xl sm:text-2xl font-black text-sky-600 leading-tight mt-0.5">{statsOverview.upcoming}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Calendar size={16} />
              </div>
            </div>

            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  {isStudent || isParent ? "Faits" : "Complétés"}
                </p>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 leading-tight mt-0.5">
                  {statsOverview.completedCount}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} />
              </div>
            </div>
          </div>

          {/* Espace Professeur Strict & Suivi de la charge globale des devoirs */}
          {isTeacher && !isAdminOrDirector && (
            <div className="px-3.5 py-2 bg-gradient-to-r from-indigo-50/90 via-white to-indigo-50/50 border border-indigo-100 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-bold text-slate-700">Mes classes enseignées :</span>
                <div className="flex flex-wrap items-center gap-1">
                  {teacherAssignedClasses.length > 0 ? (
                    teacherAssignedClasses.map(c => (
                      <span key={c.id} className="text-[10.5px] font-black px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-800 border border-indigo-200">
                        {c.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-amber-700 italic font-medium">Toutes les classes de l'établissement</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-slate-500 text-[11px] hidden sm:inline">Périmètre devoirs :</span>
                <div className="bg-slate-100 p-0.5 rounded-lg flex border border-slate-200/80 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setTeacherScope('ALL_CLASSES_HOMEWORK')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      teacherScope === 'ALL_CLASSES_HOMEWORK'
                        ? 'bg-white text-indigo-700 shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Voir toute la charge de travail des élèves de vos classes (tous enseignants)"
                  >
                    Tous les devoirs de mes classes
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherScope('MINE_ONLY')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      teacherScope === 'MINE_ONLY'
                        ? 'bg-white text-indigo-700 shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Filtrer uniquement les devoirs que vous avez vous-même créés"
                  >
                    Mes devoirs créés
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Compact Filter Toolbar */}
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row gap-2 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Rechercher par titre, matière, consigne..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:outline-indigo-500 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <ClassSelectorPill
                classes={isTeacher && !isAdminOrDirector && teacherAssignedClasses.length > 0 ? teacherAssignedClasses : classes}
                selectedClassId={selectedClassId}
                onSelectClass={(id) => setSelectedClassId(id)}
                allowAll={true}
                allLabel={isTeacher && !isAdminOrDirector ? "Toutes mes classes" : "Toutes les classes"}
                variant="pill"
                size="sm"
                colorScheme="indigo"
                title="Filtrer par classe"
              />

              <SubjectSelectorPill
                subjects={availableFilterSubjects}
                selectedSubjectId={selectedSubjectId}
                onSelectSubject={(id) => setSelectedSubjectId(id)}
                allowAll={true}
                allLabel={selectedClassId === 'ALL' ? "Toutes les matières" : "Matières de la classe"}
                labelPrefix=""
                variant="pill"
                size="sm"
                colorScheme="indigo"
                title="Filtrer par matière"
              />

              <SelectPill
                options={[
                  { value: 'ALL', label: 'Tous les statuts' },
                  { value: 'PENDING', label: 'À faire', color: 'amber' },
                  { value: 'DUE_TODAY', label: "Pour aujourd'hui", color: 'blue' },
                  { value: 'LATE', label: 'En retard', color: 'rose' },
                  { value: 'COMPLETED', label: 'Terminés', color: 'emerald' },
                ]}
                value={selectedStatusFilter}
                onChange={(val) => setSelectedStatusFilter(val)}
                variant="pill"
                size="sm"
                colorScheme="indigo"
                icon={Filter}
                placeholder="Statut"
              />

              <button
                type="button"
                onClick={fetchAssignments}
                title="Rafraîchir"
                className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-full transition-all cursor-pointer shadow-2xs hover:shadow-xs"
              >
                <RefreshCw size={13} />
              </button>

              {canManageHomework && (
                <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5">
                  <button
                    type="button"
                    onClick={exportToCSV}
                    title="Exporter au format CSV"
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Download size={11} className="text-emerald-600" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportToPDF}
                    title="Exporter en PDF officiel"
                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <FileText size={11} className="text-rose-600" />
                    <span>PDF</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main List of Assignments */}
          {loading ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 space-y-2">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Chargement des devoirs...</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <BookOpen size={22} />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-sm font-bold text-slate-900">Aucun devoir trouvé</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {searchQuery || selectedClassId !== 'ALL' || selectedSubjectId !== 'ALL'
                    ? "Aucun devoir ne correspond à vos filtres."
                    : canManageHomework
                    ? "Aucun devoir prescrit pour le moment. Cliquez sur 'Nouveau Devoir' pour commencer."
                    : "Aucun devoir assigné pour le moment."}
                </p>
              </div>
              {canManageHomework && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(true);
                  }}
                  className="py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus size={14} /> Nouveau Devoir
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAssignments.map((assignment) => {
                const readState = studentReads[assignment.id];
                const isCompleted = readState?.work_status === 'COMPLETED';
                const isRead = Boolean(readState?.is_read);
                const today = new Date().toISOString().split('T')[0];
                const isPastDue = assignment.due_date < today;
                const isDueToday = assignment.due_date === today;

                return (
                  <div
                    key={assignment.id}
                    className={`bg-white rounded-2xl border transition-all hover:shadow-xs flex flex-col justify-between overflow-hidden relative ${
                      isCompleted 
                        ? 'border-emerald-200 bg-emerald-50/15' 
                        : isPastDue 
                        ? 'border-rose-200' 
                        : isDueToday 
                        ? 'border-amber-300 ring-1 ring-amber-300/40' 
                        : 'border-slate-200/80'
                    }`}
                  >
                    {/* Card Content */}
                    <div className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {assignment.class_name}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {assignment.subject_name}
                          </span>
                          {/* Teacher Ownership Badge */}
                          {canManageHomework && (
                            assignment.teacher_id === user.id ? (
                              <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Mon devoir
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200" title={`Donné par ${assignment.teacher_name}`}>
                                Par : {assignment.teacher_name?.split(' ')[0] || 'Collègue'}
                              </span>
                            )
                          )}
                          {assignment.is_graded && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                              <Award size={10} /> /{assignment.max_score || 20}
                            </span>
                          )}
                        </div>

                        {/* Due Date Indicator */}
                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            isPastDue 
                              ? 'bg-rose-100 text-rose-800' 
                              : isDueToday 
                              ? 'bg-amber-100 text-amber-800 font-bold animate-pulse' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            <Calendar size={11} />
                            {new Date(assignment.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      </div>

                      {/* Title & Preview */}
                      <div className="space-y-1 cursor-pointer" onClick={() => handleOpenDetail(assignment)}>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 leading-snug hover:text-indigo-600 transition-colors">
                          {assignment.title}
                        </h3>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {assignment.description}
                        </p>
                      </div>

                      {/* Attachments preview */}
                      {assignment.attachments && assignment.attachments.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 pt-0.5 flex-wrap">
                          <Paperclip size={11} className="text-indigo-500 shrink-0" />
                          <span>{assignment.attachments.length} doc{assignment.attachments.length > 1 ? 's' : ''}</span>
                          {assignment.attachments.some(a => getFileCategory(a.name, a.type) === 'pdf') && (
                            <span className="px-1 py-0.2 bg-rose-50 text-rose-700 font-bold text-[9px] rounded border border-rose-200">
                              PDF
                            </span>
                          )}
                          {assignment.attachments.some(a => getFileCategory(a.name, a.type) === 'doc') && (
                            <span className="px-1 py-0.2 bg-blue-50 text-blue-700 font-bold text-[9px] rounded border border-blue-200">
                              Word
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="px-3 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-1.5 text-xs">
                      {isStudent || isParent ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleStudentWorkDone(assignment.id, readState?.work_status || 'TODO')}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                              isCompleted
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {isCompleted ? <CheckCircle2 size={12} /> : <Square size={12} />}
                            <span>{isCompleted ? 'Fait' : 'À faire'}</span>
                          </button>

                          {isRead && (
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5" title={`Consulté ${readState?.read_count || 1} fois`}>
                              <Eye size={11} className="text-indigo-500" />
                              <span>Vu</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        canManageHomework && (isAdminOrDirector || assignment.teacher_id === user.id) && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenReminderModal(assignment)}
                              title="Rappeler les élèves non-lecteurs par SMS / Email"
                              className="text-[10.5px] font-bold px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Bell size={11} className="text-amber-600" />
                              <span>Rappel</span>
                            </button>
                          </div>
                        )
                      )}

                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(assignment)}
                          className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10.5px] font-bold text-indigo-600 hover:text-indigo-700 transition-all flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Détails</span>
                          <ChevronRight size={11} />
                        </button>

                        {canManageHomework && (isAdminOrDirector || assignment.teacher_id === user.id) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditClick(assignment)}
                              title="Modifier"
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-md transition-colors cursor-pointer"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              title="Supprimer"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          TAB 3 : RECHARTS ANALYTICS DASHBOARD (TAUX DE CONSULTATION PAR CLASSE & MATIÈRE)
          ========================================================================= */}
      {activeTab === 'analytics' && canManageHomework && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          
          {/* Top Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Taux Moyen de Lecture</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                  {classAnalyticsData.length > 0 
                    ? Math.round(classAnalyticsData.reduce((acc, c) => acc + c.readRate, 0) / classAnalyticsData.length)
                    : 0}%
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Eye size={16} />
              </div>
            </div>

            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Taux d'Achèvement</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">
                  {classAnalyticsData.length > 0 
                    ? Math.round(classAnalyticsData.reduce((acc, c) => acc + c.completedRate, 0) / classAnalyticsData.length)
                    : 0}%
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle size={16} />
              </div>
            </div>

            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Élèves Non-Lecteurs</p>
                <p className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5">{globalUnreadCount}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Bell size={16} />
              </div>
            </div>
          </div>

          {/* Charts Row 1 : Taux de Consultation par Classe & Répartition Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            
            {/* Bar Chart 1 : Par Classe */}
            <div className="lg:col-span-2 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <BarChart2 className="text-indigo-600" size={15} />
                  <span>Taux de Consultation par Classe (%)</span>
                </h3>
              </div>

              {classAnalyticsData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Aucune donnée disponible.
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classAnalyticsData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} unit="%" axisLine={{ stroke: '#cbd5e1' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                        formatter={(val: any) => [`${val}%`, '']}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                      <Bar dataKey="readRate" name="Lecture (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completedRate" name="Achèvement (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Pie Chart : Répartition Globale */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <PieChartIcon className="text-emerald-600" size={15} />
                <span>État Global des Lectures</span>
              </h3>

              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={engagementPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {engagementPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2 : Taux de Consultation par Matière */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="text-purple-600" size={15} />
              <span>Assiduité de Consultation par Matière (%)</span>
            </h3>

            {subjectAnalyticsData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Aucune matière disponible.
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectAnalyticsData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} unit="%" axisLine={{ stroke: '#cbd5e1' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                      formatter={(val: any, name: any, item: any) => [`${val}%`, item.payload.fullName || 'Matière']}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                    <Bar dataKey="readRate" name="Ouverture (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completedRate" name="Achèvement (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Compact Cloud Archiving Banner in Analytics */}
          <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl border border-indigo-500/30 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0">
                <FolderArchive size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-bold text-white">Archivage Automatique Cloud</h4>
                  {archiveSettings.isEnabled ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Actif fin de mois
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-400">
                      Inactif
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-indigo-200/80">
                  Sauvegarde automatique des devoirs et bilans Recharts ({archiveSettings.bucketName}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(true)}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <FolderArchive size={12} />
                <span>Planifier</span>
              </button>
              <button
                type="button"
                disabled={executingArchiveNow}
                onClick={handleExecuteArchiveNow}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border border-white/20 cursor-pointer disabled:opacity-50"
                title="Générer l'archive immédiatement"
              >
                {executingArchiveNow ? <RefreshCw className="animate-spin" size={12} /> : <Download size={12} />}
                <span>Archiver maintenant</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          MODAL : CREATE OR EDIT HOMEWORK ASSIGNMENT (MODERNE, SOUPLE & DYNAMIQUE)
          ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className={`bg-white rounded-2xl ${editorViewMode === 'SPLIT' ? 'max-w-5xl' : 'max-w-xl sm:max-w-2xl lg:max-w-3xl'} w-full border border-slate-200 shadow-2xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-all`}>
            {/* Modal Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  {editingAssignment ? <Edit3 size={15} /> : <BookOpen size={15} />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 truncate">
                    {editingAssignment ? 'Modifier le Devoir' : 'Nouveau Devoir'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {formClassId ? (classes.find(c => c.id === formClassId)?.name || 'Classe sélectionnée') : 'Sélection de la classe'}
                    {formSubjectId ? ` • ${subjects.find(s => s.id === formSubjectId)?.name || ''}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                title="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="p-4 sm:p-5 space-y-3.5 max-h-[82vh] overflow-y-auto custom-scrollbar">
              
              {/* Row 1 : Classe & Matière (Adaptée strictement à la classe) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-200/90">
                {/* Classe cible */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800">Classe cible *</label>
                    {isTeacher && !isAdminOrDirector && (
                      <span className="text-[9.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded">
                        Mes Classes Uniquement
                      </span>
                    )}
                  </div>
                  <ClassSelectorPill
                    classes={isTeacher && !isAdminOrDirector && teacherAssignedClasses.length > 0 ? teacherAssignedClasses : classes}
                    selectedClassId={formClassId}
                    onSelectClass={handleSelectFormClass}
                    allowAll={false}
                    emptyLabel={isTeacher && !isAdminOrDirector && teacherAssignedClasses.length === 0 ? "Aucune classe assignée..." : "Sélectionner une classe..."}
                    variant="field"
                    size="sm"
                    colorScheme="indigo"
                    className="w-full"
                  />
                </div>

                {/* Matière strictement filtrée selon la classe */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800">Matière *</label>
                    {formClassId && (
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded ${
                        availableFormSubjects.length > 0 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70' 
                          : 'bg-rose-50 text-rose-800 border border-rose-200/70'
                      }`}>
                        {availableFormSubjects.length} matière{availableFormSubjects.length > 1 ? 's' : ''} en {classes.find(c => c.id === formClassId)?.name || 'cette classe'}
                      </span>
                    )}
                  </div>
                  <SubjectSelectorPill
                    subjects={availableFormSubjects}
                    selectedSubjectId={formSubjectId}
                    onSelectSubject={(id) => setFormSubjectId(id)}
                    allowAll={false}
                    emptyLabel={!formClassId ? "Sélectionnez d'abord une classe..." : availableFormSubjects.length === 0 ? "Aucune matière pour cette classe" : "Sélectionner une matière..."}
                    labelPrefix=""
                    variant="field"
                    size="sm"
                    colorScheme="indigo"
                    className="w-full"
                    disabled={!formClassId || availableFormSubjects.length === 0}
                  />
                  {formClassId && availableFormSubjects.length === 0 && (
                    <p className="text-[10px] text-amber-700 font-medium pt-0.5">
                      ⚠️ Aucune matière n'est configurée pour cette classe. Contactez l'administration si besoin.
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2 : Titre du devoir avec suggestions rapides */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-800">Titre du devoir *</label>
                  <span className="text-[10px] text-slate-400 font-medium">Court et explicite</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ex: Exercices 3 et 4 page 45 - Calcul littéral et fractions"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-indigo-500 transition-all placeholder:text-slate-400"
                />
                
                {/* Suggestions rapides de titres */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-400 font-bold">Suggestions :</span>
                  {[
                    "Exercices du manuel",
                    "Devoir Maison n°",
                    "Préparation Contrôle",
                    "Fiche d'exercices",
                    "Lecture & Questions"
                  ].map((sugg, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => setFormTitle(prev => prev ? `${prev} - ${sugg}` : sugg)}
                      className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                    >
                      + {sugg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 3 : Zone Pédagogique Centrale (Éditeur Enrichi Moderne & Prévisualisation Documents) */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                
                {/* Segmented Switcher : Mode de contenu */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Contenu & Document du devoir</span>
                    {formAttachments.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded text-[9.5px] font-extrabold">
                        {formAttachments.length} doc{formAttachments.length > 1 ? 's' : ''} joint{formAttachments.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                  
                  <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setFormContentMode('TYPE')}
                      className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        formContentMode === 'TYPE'
                          ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText size={12} />
                      <span>Rédiger en ligne</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormContentMode('ATTACH_DOC')}
                      className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        formContentMode === 'ATTACH_DOC'
                          ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Paperclip size={12} />
                      <span>Document prêt (PDF / Word)</span>
                      {formAttachments.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-bold">
                          {formAttachments.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormContentMode('BOTH')}
                      className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        formContentMode === 'BOTH'
                          ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Les deux</span>
                    </button>
                  </div>
                </div>

                {/* SOUS-PANNEAU 1 : ÉDITEUR DE TEXTE ENRICHI MODERNE (TOOLBAR COMPLÈTE, TEMPLATES & SPLIT VIEW) */}
                {(formContentMode === 'TYPE' || formContentMode === 'BOTH') && (
                  <div className="space-y-1.5 animate-in fade-in duration-150">
                    
                    {/* Header Éditeur : Modèles rapides & Sélecteur de vue (Rédiger / Scindé / Aperçu Élève) */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-0.5">
                      {/* Modèles types rapides */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={11} className="text-amber-500" />
                          <span>Gabarits pros :</span>
                        </span>
                        {HOMEWORK_TEMPLATES.map((tmpl) => (
                          <button
                            key={tmpl.id}
                            type="button"
                            onClick={() => applyTemplate(tmpl.content)}
                            className="px-2 py-0.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/70 rounded-md text-[10.5px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                            title="Insérer ce modèle complet"
                          >
                            <span>{tmpl.icon}</span>
                            <span>{tmpl.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Sélecteur de mode d'affichage de l'éditeur */}
                      <div className="bg-slate-200/70 p-0.5 rounded-lg flex items-center text-[10.5px] font-bold border border-slate-300/60 ml-auto">
                        <button
                          type="button"
                          onClick={() => setEditorViewMode('WRITE')}
                          className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                            editorViewMode === 'WRITE'
                              ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Mode Rédaction seule"
                        >
                          <Edit3 size={11} />
                          <span>Rédiger</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorViewMode('SPLIT')}
                          className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                            editorViewMode === 'SPLIT'
                              ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Mode Scindé : saisie à gauche, rendu en direct à droite"
                        >
                          <Columns size={11} />
                          <span>Scindé (Direct)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorViewMode('PREVIEW')}
                          className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                            editorViewMode === 'PREVIEW'
                              ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Mode Aperçu Élève plein écran"
                        >
                          <Eye size={11} />
                          <span>Aperçu Élève</span>
                        </button>
                      </div>
                    </div>

                    {/* Toolbar Professionnelle de Mise en Forme Enrichie */}
                    <div className="p-1 bg-slate-100 border border-slate-200 rounded-t-xl text-slate-700 flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-0.5 flex-wrap">
                        {/* Titres */}
                        <button
                          type="button"
                          onClick={() => insertHeading(1)}
                          title="Titre H1 (# Titre)"
                          className="px-1.5 py-0.5 hover:bg-white rounded text-xs font-black text-slate-800 transition-colors cursor-pointer flex items-center gap-0.5"
                        >
                          <Heading1 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertHeading(2)}
                          title="Sous-titre H2 (## Titre)"
                          className="px-1.5 py-0.5 hover:bg-white rounded text-xs font-black text-slate-800 transition-colors cursor-pointer flex items-center gap-0.5"
                        >
                          <Heading2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertHeading(3)}
                          title="Section H3 (### Titre)"
                          className="px-1.5 py-0.5 hover:bg-white rounded text-xs font-black text-slate-800 transition-colors cursor-pointer flex items-center gap-0.5"
                        >
                          <Heading3 size={13} />
                        </button>

                        <div className="w-[1px] h-3.5 bg-slate-300 mx-0.5" />

                        {/* Styles en ligne */}
                        <button
                          type="button"
                          onClick={() => insertRichTag('**', '**', 'texte en gras')}
                          title="Gras (**texte**)"
                          className="p-1 hover:bg-white rounded text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Bold size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertRichTag('*', '*', 'texte en italique')}
                          title="Italique (*texte*)"
                          className="p-1 hover:bg-white rounded text-xs transition-colors cursor-pointer"
                        >
                          <Italic size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertRichTag('<u>', '</u>', 'texte souligné')}
                          title="Souligné"
                          className="p-1 hover:bg-white rounded text-xs transition-colors cursor-pointer"
                        >
                          <Underline size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertRichTag('<mark>', '</mark>', 'texte surligné')}
                          title="Surligné (Marqueur)"
                          className="p-1 hover:bg-white rounded text-xs text-amber-700 transition-colors cursor-pointer"
                        >
                          <Highlighter size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertRichTag('~~', '~~', 'texte barré')}
                          title="Barré"
                          className="p-1 hover:bg-white rounded text-xs transition-colors cursor-pointer"
                        >
                          <Strikethrough size={13} />
                        </button>

                        <div className="w-[1px] h-3.5 bg-slate-300 mx-0.5" />

                        {/* Listes & Tableaux */}
                        <button
                          type="button"
                          onClick={() => insertRichTag('\n- ', '', 'élément de liste')}
                          title="Liste à puces"
                          className="p-1 hover:bg-white rounded text-xs transition-colors cursor-pointer"
                        >
                          <List size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertRichTag('\n1. ', '', 'étape 1')}
                          title="Liste numérotée"
                          className="p-1 hover:bg-white rounded text-xs transition-colors cursor-pointer"
                        >
                          <ListOrdered size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={insertChecklist}
                          title="Liste de tâches / Checklist"
                          className="p-1 hover:bg-white rounded text-xs text-indigo-700 transition-colors cursor-pointer"
                        >
                          <CheckSquare size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={insertTable}
                          title="Insérer un tableau de notation / barème"
                          className="p-1 hover:bg-white rounded text-xs text-indigo-700 transition-colors cursor-pointer flex items-center gap-0.5"
                        >
                          <Table size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertRichTag('\n---\n', '')}
                          title="Ligne de séparation"
                          className="px-1.5 py-0.5 hover:bg-white rounded text-[10.5px] font-mono text-slate-600 transition-colors cursor-pointer"
                        >
                          ―
                        </button>

                        <div className="w-[1px] h-3.5 bg-slate-300 mx-0.5" />

                        {/* Encadrés pédagogiques ("Callouts") */}
                        <button
                          type="button"
                          onClick={() => insertCallout('consigne')}
                          title="Insérer un encadré Consigne"
                          className="px-1.5 py-0.5 hover:bg-white rounded text-[10px] font-bold text-emerald-800 transition-colors cursor-pointer flex items-center gap-0.5 border border-emerald-200/60 bg-emerald-50/50"
                        >
                          📌 Consigne
                        </button>
                        <button
                          type="button"
                          onClick={() => insertCallout('conseil')}
                          title="Insérer un conseil méthodologique"
                          className="px-1.5 py-0.5 hover:bg-white rounded text-[10px] font-bold text-indigo-800 transition-colors cursor-pointer flex items-center gap-0.5 border border-indigo-200/60 bg-indigo-50/50"
                        >
                          💡 Conseil
                        </button>
                        <button
                          type="button"
                          onClick={() => insertCallout('attention')}
                          title="Insérer un avertissement important"
                          className="px-1.5 py-0.5 hover:bg-white rounded text-[10px] font-bold text-amber-800 transition-colors cursor-pointer flex items-center gap-0.5 border border-amber-200/60 bg-amber-50/50"
                        >
                          ⚠️ Attention
                        </button>
                        <button
                          type="button"
                          onClick={() => insertCallout('bareme')}
                          title="Insérer une grille de barème"
                          className="px-1.5 py-0.5 hover:bg-white rounded text-[10px] font-bold text-rose-800 transition-colors cursor-pointer flex items-center gap-0.5 border border-rose-200/60 bg-rose-50/50"
                        >
                          🏆 Barème
                        </button>

                        <div className="w-[1px] h-3.5 bg-slate-300 mx-0.5" />

                        {/* Menu symboles mathématiques */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowMathSymbols(!showMathSymbols)}
                            className="px-1.5 py-0.5 hover:bg-white rounded text-[10.5px] font-bold text-slate-700 transition-colors cursor-pointer flex items-center gap-0.5 border border-slate-200 bg-white"
                            title="Symboles mathématiques et scientifiques"
                          >
                            <span>📐 Math</span>
                            <ChevronDown size={10} />
                          </button>
                          {showMathSymbols && (
                            <div className="absolute left-0 mt-1 p-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 flex gap-1 flex-wrap w-52 animate-in fade-in zoom-in-95 duration-100">
                              <p className="w-full text-[9.5px] font-bold text-slate-400 px-1 pb-0.5 border-b border-slate-100">
                                Symboles scientifiques rapides :
                              </p>
                              {QUICK_MATH_SYMBOLS.map((sym, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => {
                                    insertMathSymbol(sym);
                                    setShowMathSymbols(false);
                                  }}
                                  className="w-7 h-7 hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 rounded-lg font-bold text-xs flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-indigo-200"
                                >
                                  {sym}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Zone de Contenu : Saisie seule / Scindé (Split) / Aperçu Élève */}
                    {editorViewMode === 'SPLIT' ? (
                      /* Mode Scindé : Écriture à gauche, Rendu élève synchrone à droite */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-100/60 p-2 rounded-b-xl border border-t-0 border-slate-200">
                        <div className="flex flex-col space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                            <span>Saisie & Balises Markdown</span>
                            <span className="font-mono text-[9px] text-indigo-600 bg-indigo-50 px-1 rounded">Édition active</span>
                          </span>
                          <textarea
                            id="homework-description-textarea"
                            required={formAttachments.length === 0}
                            rows={7}
                            placeholder="Rédigez les consignes, questions, pages à lire ou critères de notation..."
                            value={formDescription}
                            onChange={e => setFormDescription(e.target.value)}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-indigo-500 transition-all leading-relaxed placeholder:text-slate-400 h-52 resize-y"
                          />
                        </div>

                        <div className="flex flex-col space-y-1">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center justify-between">
                            <span>Rendu Élève en temps réel</span>
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">Synchrone</span>
                          </span>
                          <div className="w-full p-3 bg-white border border-slate-200 rounded-xl h-52 overflow-y-auto custom-scrollbar shadow-2xs">
                            {formDescription.trim() ? (
                              <FormattedHomeworkContent content={formDescription} />
                            ) : (
                              <p className="text-xs text-slate-400 italic">Le rendu mis en forme s'affichera ici instantanément au fur et à mesure de votre saisie.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : editorViewMode === 'PREVIEW' ? (
                      /* Mode Aperçu Élève Plein Format */
                      <div className="w-full p-3.5 bg-white border border-t-0 border-slate-200 rounded-b-xl min-h-[140px] max-h-72 overflow-y-auto custom-scrollbar">
                        <div className="pb-1.5 mb-2.5 border-b border-slate-100 flex items-center justify-between text-[10.5px]">
                          <span className="font-bold text-indigo-700 flex items-center gap-1">
                            <Eye size={12} />
                            <span>Rendu final exact tel que vu par les élèves et parents</span>
                          </span>
                          <span className="text-[9.5px] font-mono text-slate-400">Format enrichi actif</span>
                        </div>
                        {formDescription.trim() ? (
                          <FormattedHomeworkContent content={formDescription} />
                        ) : (
                          <p className="text-xs text-slate-400 italic py-4 text-center">
                            Aucune consigne rédigée pour le moment. Cliquez sur "Rédiger" pour saisir le devoir.
                          </p>
                        )}
                      </div>
                    ) : (
                      /* Mode Saisie Standard */
                      <textarea
                        id="homework-description-textarea"
                        required={formAttachments.length === 0}
                        rows={5}
                        placeholder="Rédigez les consignes, questions, pages à lire ou critères de notation..."
                        value={formDescription}
                        onChange={e => setFormDescription(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-t-0 border-slate-200 rounded-b-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-indigo-500 transition-all leading-relaxed placeholder:text-slate-400"
                      />
                    )}

                    {/* Footer de l'éditeur avec compteurs et astuce */}
                    <div className="flex items-center justify-between text-[10.5px] text-slate-400 px-1 pt-0.5">
                      <span className="font-medium">
                        {formDescription.trim().length} caractères • {formDescription.trim().split(/\s+/).filter(Boolean).length} mots
                      </span>
                      <div className="flex items-center gap-2">
                        <span>
                          Lecture estimée : ~{Math.max(1, Math.ceil(formDescription.trim().split(/\s+/).filter(Boolean).length / 100))} min
                        </span>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        <span className="hidden sm:inline text-indigo-600 font-semibold cursor-pointer" onClick={() => setEditorViewMode('SPLIT')}>
                          ⚡ Mode Scindé disponible
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* SOUS-PANNEAU 2 : JOINDRE UN DOCUMENT DÉJÀ TAPÉ (AVEC PRÉVISUALISATION DIRECTE IMAGE & PDF) */}
                {(formContentMode === 'ATTACH_DOC' || formContentMode === 'BOTH') && (
                  <div className="space-y-2.5 animate-in fade-in duration-150 pt-1">
                    
                    {/* Drag and Drop Zone */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files) handleFilesUpload(e.target.files);
                      }}
                      multiple
                      accept=".pdf,.doc,.docx,.odt,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.svg"
                      className="hidden"
                    />

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                        isDraggingFile
                          ? 'border-indigo-500 bg-indigo-50/70 scale-[0.99]'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-indigo-50/30 hover:border-indigo-300'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                        {uploadingFile ? <RefreshCw size={18} className="animate-spin text-indigo-600" /> : <FileUp size={18} />}
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {isDraggingFile ? "Déposez votre document ici !" : "Glissez-déposez votre document de devoir ici"}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          ou <span className="text-indigo-600 font-bold hover:underline">cliquez pour parcourir vos fichiers</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium pt-1 flex-wrap justify-center">
                        <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-rose-700">PDF</span>
                        <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-purple-700">Images (PNG/JPG)</span>
                        <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">Word (.docx)</span>
                        <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">LibreOffice</span>
                        <span>(max 15 Mo • Prévisualisation intégrée)</span>
                      </div>
                    </div>

                    {/* Liste des documents attachés avec vignettes et boutons d'aperçu direct */}
                    {formAttachments.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <span>Documents joints aux élèves ({formAttachments.length})</span>
                            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                              ✓ Prévisualisation disponible
                            </span>
                          </span>

                          {/* Bouton pour afficher/masquer le panneau de prévisualisation intégrée */}
                          <button
                            type="button"
                            onClick={() => setActiveInlinePreviewIdx(prev => prev === null ? 0 : null)}
                            className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50/60 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/60 transition-colors"
                          >
                            <Eye size={12} />
                            <span>{activeInlinePreviewIdx !== null ? "Masquer l'aperçu intégré" : "Afficher l'aperçu intégré"}</span>
                          </button>
                        </div>

                        {/* Cartes de documents attachés */}
                        <div className="space-y-1.5">
                          {formAttachments.map((att, idx) => {
                            const cat = getFileCategory(att.name, att.type);
                            const sizeText = formatFileSize(att.size);
                            const isImage = cat === 'image' || att.url?.startsWith('data:image/');
                            const isPdf = cat === 'pdf' || att.url?.startsWith('data:application/pdf') || att.name.toLowerCase().endsWith('.pdf');

                            return (
                              <div
                                key={idx}
                                className={`flex items-center justify-between p-2.5 bg-white border rounded-xl shadow-2xs transition-all ${
                                  activeInlinePreviewIdx === idx
                                    ? 'border-indigo-400 ring-2 ring-indigo-500/10 bg-indigo-50/10'
                                    : 'border-slate-200/90 hover:border-indigo-200'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {/* Miniature d'image si c'est une image */}
                                  {isImage ? (
                                    <div
                                      onClick={() => {
                                        setPreviewAttachment(att);
                                        setPreviewZoom(100);
                                        setPreviewRotation(0);
                                      }}
                                      className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 cursor-pointer group/thumb shrink-0 bg-slate-100 shadow-2xs"
                                      title="Cliquer pour prévisualiser l'image en grand format"
                                    >
                                      <img
                                        src={att.url}
                                        alt={att.name}
                                        className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity">
                                        <Eye size={13} />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10.5px] ${
                                      isPdf ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                      cat === 'doc' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                      cat === 'sheet' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                      'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    }`}>
                                      {isPdf ? 'PDF' :
                                       cat === 'doc' ? 'DOC' :
                                       cat === 'sheet' ? 'XLS' :
                                       <Paperclip size={14} />}
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 truncate text-[11.5px]" title={att.name}>
                                      {att.name}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                      {sizeText && <span className="font-mono">{sizeText}</span>}
                                      {sizeText && <span>•</span>}
                                      <span className="font-semibold text-indigo-600">
                                        {isImage ? 'Image prête' : isPdf ? 'PDF prêt' : 'Fichier joint'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions sur le document */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Bouton de Prévisualisation Pro */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreviewAttachment(att);
                                      setPreviewZoom(100);
                                      setPreviewRotation(0);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
                                      isPdf
                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80'
                                        : isImage
                                        ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80'
                                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80'
                                    }`}
                                    title="Prévisualiser ce document en haute résolution"
                                  >
                                    <Eye size={12} />
                                    <span>{isPdf ? 'Aperçu PDF' : isImage ? 'Aperçu Image' : 'Aperçu'}</span>
                                  </button>

                                  {att.url && (
                                    <a
                                      href={att.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      download={att.name}
                                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                      title="Télécharger / Ouvrir"
                                    >
                                      <Download size={13} />
                                    </a>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      removeAttachment(idx);
                                      if (activeInlinePreviewIdx === idx) {
                                        setActiveInlinePreviewIdx(null);
                                      }
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Retirer ce document"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Tiroir / Accordéon de prévisualisation intégrée dans le formulaire */}
                        {activeInlinePreviewIdx !== null && formAttachments[activeInlinePreviewIdx] && (
                          <div className="mt-2 p-3 bg-slate-900 rounded-xl border border-slate-700 text-white space-y-2 animate-in fade-in zoom-in-95 duration-150 shadow-md">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                  Aperçu direct
                                </span>
                                <span className="text-xs font-bold truncate text-slate-200" title={formAttachments[activeInlinePreviewIdx].name}>
                                  {formAttachments[activeInlinePreviewIdx].name}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewAttachment(formAttachments[activeInlinePreviewIdx]);
                                    setPreviewZoom(100);
                                    setPreviewRotation(0);
                                  }}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Agrandir en plein écran"
                                >
                                  <Maximize2 size={11} />
                                  <span>Plein écran</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveInlinePreviewIdx(null)}
                                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Fermer la prévisualisation"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Contenu de la prévisualisation intégrée */}
                            <div className="bg-slate-950 rounded-lg p-2 min-h-[180px] max-h-80 overflow-auto flex items-center justify-center custom-scrollbar">
                              {getFileCategory(formAttachments[activeInlinePreviewIdx].name, formAttachments[activeInlinePreviewIdx].type) === 'image' ||
                               formAttachments[activeInlinePreviewIdx].url?.startsWith('data:image/') ? (
                                <img
                                  src={formAttachments[activeInlinePreviewIdx].url}
                                  alt={formAttachments[activeInlinePreviewIdx].name}
                                  className="max-h-72 max-w-full object-contain rounded shadow-md"
                                />
                              ) : getFileCategory(formAttachments[activeInlinePreviewIdx].name, formAttachments[activeInlinePreviewIdx].type) === 'pdf' ||
                                 formAttachments[activeInlinePreviewIdx].url?.startsWith('data:application/pdf') ||
                                 formAttachments[activeInlinePreviewIdx].name.toLowerCase().endsWith('.pdf') ? (
                                <div className="w-full h-72 rounded overflow-hidden">
                                  <object
                                    data={formAttachments[activeInlinePreviewIdx].url}
                                    type="application/pdf"
                                    className="w-full h-full rounded"
                                  >
                                    <iframe
                                      src={formAttachments[activeInlinePreviewIdx].url}
                                      title={formAttachments[activeInlinePreviewIdx].name}
                                      className="w-full h-full border-0"
                                    >
                                      <div className="p-4 text-center text-xs text-slate-300">
                                        Prévisualisation PDF prête. Cliquez sur Plein écran pour l'ouvrir.
                                      </div>
                                    </iframe>
                                  </object>
                                </div>
                              ) : (
                                <div className="text-center p-4 space-y-1">
                                  <FileText size={32} className="mx-auto text-indigo-400" />
                                  <p className="text-xs font-bold text-white">{formAttachments[activeInlinePreviewIdx].name}</p>
                                  <p className="text-[10px] text-slate-400">Document prêt à être téléchargé par les élèves</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Option Lien Cloud direct (Google Drive / Docs, OneDrive, ENT) */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1">
                          <Link size={11} className="text-indigo-600" />
                          <span>Ou ajouter un lien Cloud (Google Docs / Drive, OneDrive, ENT)</span>
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-1.5">
                        <input
                          type="text"
                          placeholder="Nom de la ressource"
                          value={newAttachmentName}
                          onChange={e => setNewAttachmentName(e.target.value)}
                          className="sm:w-1/3 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                        />
                        <input
                          type="url"
                          placeholder="Lien / URL (https://drive.google.com/...)"
                          value={newAttachmentUrl}
                          onChange={e => setNewAttachmentUrl(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={addAttachment}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                        >
                          Ajouter le lien
                        </button>
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Row 4 : Échéances : Date limite, Heure limite, Durée estimée */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-800">Date limite *</label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={e => setFormDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 cursor-pointer focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-800">Heure limite</label>
                  <input
                    type="time"
                    value={formDueTime}
                    onChange={e => setFormDueTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 cursor-pointer focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800">Durée estimée (min)</label>
                    <span className="text-[9.5px] font-mono text-slate-400 font-bold">{formDuration} min</span>
                  </div>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    step={5}
                    value={formDuration}
                    onChange={e => setFormDuration(parseInt(e.target.value, 10) || 30)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 5 : Modalité & Barème compacts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-800">Modalité de rendu</label>
                  <SelectPill
                    options={[
                      { value: 'IN_CLASS', label: 'Vérification en classe (Sur cahier)' },
                      { value: 'ONLINE_FILE', label: 'Remise numérique (Photo / PDF)' },
                      { value: 'ONLINE_TEXT', label: 'Réponse rédigée en ligne' },
                      { value: 'NONE_READ_ONLY', label: 'Leçon à apprendre (Sans écrit)' },
                    ]}
                    value={formSubmissionType}
                    onChange={(val) => setFormSubmissionType(val as HomeworkSubmissionType)}
                    variant="field"
                    size="sm"
                    colorScheme="indigo"
                    className="w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={formIsGraded}
                      onChange={e => setFormIsGraded(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Devoir noté</span>
                  </label>
                  {formIsGraded ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-semibold">Barème : /</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={formMaxScore}
                        onChange={e => setFormMaxScore(parseFloat(e.target.value) || 20)}
                        className="w-20 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-900"
                      />
                      <span className="text-[10px] text-slate-400">points</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 block pt-1">Sans notation officielle (Exercice d'entraînement)</span>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {submittingForm ? <RefreshCw className="animate-spin" size={13} /> : <Check size={13} />}
                  <span>{editingAssignment ? 'Sauvegarder les modifications' : 'Publier le devoir'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL : HIGH-FIDELITY DOCUMENT PREVIEW (IMAGES & PDFS)
          ========================================================================= */}
      {previewAttachment && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-5 overflow-hidden animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                  getFileCategory(previewAttachment.name, previewAttachment.type) === 'pdf' || previewAttachment.url?.startsWith('data:application/pdf') ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                  getFileCategory(previewAttachment.name, previewAttachment.type) === 'image' || previewAttachment.url?.startsWith('data:image/') ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                  'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                }`}>
                  {getFileCategory(previewAttachment.name, previewAttachment.type) === 'pdf' || previewAttachment.url?.startsWith('data:application/pdf') ? 'PDF' :
                   getFileCategory(previewAttachment.name, previewAttachment.type) === 'image' || previewAttachment.url?.startsWith('data:image/') ? 'IMG' : 'DOC'}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold truncate text-white" title={previewAttachment.name}>
                    {previewAttachment.name}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {formatFileSize(previewAttachment.size) ? `${formatFileSize(previewAttachment.size)} • ` : ''}Prévisualisation du document
                  </p>
                </div>
              </div>

              {/* Toolbar Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {(getFileCategory(previewAttachment.name, previewAttachment.type) === 'image' || previewAttachment.url?.startsWith('data:image/')) && (
                  <div className="flex items-center gap-1 bg-slate-700/80 rounded-lg p-0.5 border border-slate-600 mr-2">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(z => Math.max(50, z - 25))}
                      className="p-1.5 hover:bg-slate-600 rounded text-slate-200 hover:text-white transition-colors cursor-pointer"
                      title="Zoom arrière (-)"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <span className="text-[10px] font-mono font-bold px-1 text-slate-300">{previewZoom}%</span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(z => Math.min(300, z + 25))}
                      className="p-1.5 hover:bg-slate-600 rounded text-slate-200 hover:text-white transition-colors cursor-pointer"
                      title="Zoom avant (+)"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewRotation(r => (r + 90) % 360)}
                      className="p-1.5 hover:bg-slate-600 rounded text-slate-200 hover:text-white transition-colors cursor-pointer"
                      title="Faire pivoter de 90°"
                    >
                      <RotateCw size={14} />
                    </button>
                  </div>
                )}

                {previewAttachment.url && (
                  <a
                    href={previewAttachment.url}
                    target="_blank"
                    rel="noreferrer"
                    download={previewAttachment.name}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                    title="Télécharger / Ouvrir dans un nouvel onglet"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline text-[11px]">Télécharger</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 bg-slate-700/80 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer ml-1"
                  title="Fermer la prévisualisation"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Preview Content Body */}
            <div className="flex-1 bg-slate-950 p-2 sm:p-4 overflow-auto flex items-center justify-center relative custom-scrollbar">
              {(getFileCategory(previewAttachment.name, previewAttachment.type) === 'image' || previewAttachment.url?.startsWith('data:image/')) ? (
                <div className="overflow-auto max-w-full max-h-full flex items-center justify-center p-2">
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    style={{
                      transform: `scale(${previewZoom / 100}) rotate(${previewRotation}deg)`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.15s ease-out'
                    }}
                    className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl drop-shadow-md select-none"
                  />
                </div>
              ) : (getFileCategory(previewAttachment.name, previewAttachment.type) === 'pdf' || previewAttachment.url?.startsWith('data:application/pdf') || previewAttachment.name.toLowerCase().endsWith('.pdf')) ? (
                <div className="w-full h-full bg-slate-900 rounded-xl overflow-hidden flex flex-col">
                  <object
                    data={previewAttachment.url}
                    type="application/pdf"
                    className="w-full h-full rounded-xl"
                  >
                    <iframe
                      src={previewAttachment.url}
                      title={previewAttachment.name}
                      className="w-full h-full border-0 rounded-xl"
                    >
                      <div className="p-8 text-center text-white flex flex-col items-center justify-center h-full gap-3">
                        <FileText size={48} className="text-rose-400" />
                        <p className="text-sm font-bold">Document PDF prêt à être consulté</p>
                        <p className="text-xs text-slate-400">Le lecteur PDF intégré de votre navigateur n'a pas pu s'ouvrir automatiquement.</p>
                        <a
                          href={previewAttachment.url}
                          target="_blank"
                          rel="noreferrer"
                          download={previewAttachment.name}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-2"
                        >
                          <Download size={14} />
                          <span>Télécharger / Ouvrir le fichier PDF</span>
                        </a>
                      </div>
                    </iframe>
                  </object>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl max-w-md space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto">
                    <FileText size={32} />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">{previewAttachment.name}</h5>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatFileSize(previewAttachment.size)} • Document bureautique
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">
                    Ce format de fichier ({getFileCategory(previewAttachment.name, previewAttachment.type).toUpperCase()}) sera téléchargeable par les élèves.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <a
                      href={previewAttachment.url}
                      download={previewAttachment.name}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Download size={13} />
                      <span>Télécharger le fichier</span>
                    </a>
                    {previewAttachment.url.startsWith('http') && (
                      <a
                        href={`https://docs.google.com/viewer?url=${encodeURIComponent(previewAttachment.url)}&embedded=true`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs flex items-center gap-1.5 border border-slate-700"
                      >
                        <ExternalLink size={13} />
                        <span>Aperçu Google Docs</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL : AUTOMATED REMINDER (SMS / EMAIL) FOR UNREAD HOMEWORK
          ========================================================================= */}
      {isReminderModalOpen && reminderAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-4 py-3 sm:px-5 sm:py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bell size={14} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Rappels aux Non-Lecteurs
                  </h3>
                  <p className="text-[11px] text-amber-900 font-medium">
                    {reminderAssignment.class_name} • {reminderAssignment.subject_name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsReminderModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 max-h-[78vh] overflow-y-auto custom-scrollbar">
              
              {/* Reminder Criteria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Période d'inactivité</label>
                  <SelectPill
                    options={[
                      { value: 'ALL_UNREAD', label: 'Tous les non-lecteurs' },
                      { value: '24H', label: 'Non ouvert après 24h' },
                      { value: '48H', label: 'Non ouvert après 48h' },
                      { value: 'EVE_OF_DUE', label: "Veille de l'échéance" },
                    ]}
                    value={reminderPeriod}
                    onChange={(val) => setReminderPeriod(val as any)}
                    variant="field"
                    size="sm"
                    colorScheme="indigo"
                    className="w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Canal</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReminderChannel('SMS')}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        reminderChannel === 'SMS'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Phone size={12} /> SMS
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderChannel('EMAIL')}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        reminderChannel === 'EMAIL'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Mail size={12} /> Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderChannel('BOTH')}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        reminderChannel === 'BOTH'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Les deux
                    </button>
                  </div>
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700">Message aux destinataires</label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {reminderMessage.length} car.
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={reminderMessage}
                  onChange={e => setReminderMessage(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:outline-indigo-500 transition-all leading-relaxed"
                />
              </div>

              {/* Target Students Selection List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                    <Users size={13} className="text-indigo-600" />
                    <span>Destinataires ({selectedRecipientIds.length} / {filteredRecipients.length})</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRecipientIds.length === filteredRecipients.length) {
                        setSelectedRecipientIds([]);
                      } else {
                        setSelectedRecipientIds(filteredRecipients.map(r => r.id));
                      }
                    }}
                    className="text-[10.5px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    {selectedRecipientIds.length === filteredRecipients.length ? 'Désélectionner tout' : 'Tout sélectionner'}
                  </button>
                </div>

                {loadingRecipients ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Chargement des non-lecteurs...
                  </div>
                ) : filteredRecipients.length === 0 ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 font-medium">
                    ✓ Tous les élèves de la classe ont déjà consulté ce devoir. Aucun rappel requis.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                    {filteredRecipients.map(r => {
                      const isSelected = selectedRecipientIds.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className="flex items-center justify-between p-2 hover:bg-slate-50 text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedRecipientIds(prev => 
                                  isSelected ? prev.filter(id => id !== r.id) : [...prev, r.id]
                                );
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate text-[11px]">{r.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                Parent: {r.parentName} {r.parentPhone ? `• ${r.parentPhone}` : ''}
                              </p>
                            </div>
                          </div>

                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 border border-rose-100 shrink-0">
                            Non lu
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Actions */}
            <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsReminderModalOpen(false)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={sendingReminders || selectedRecipientIds.length === 0}
                onClick={handleSendReminders}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {sendingReminders ? <RefreshCw className="animate-spin" size={13} /> : <Send size={13} />}
                <span>
                  {sendingReminders 
                    ? "Envoi..." 
                    : `Envoyer ${selectedRecipientIds.length} rappel(s)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL : DETAILED VIEW & TRACEABILITY TRACKING SHEET
          ========================================================================= */}
      {isDetailModalOpen && activeDetailAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl sm:max-w-2xl w-full border border-slate-200 shadow-2xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-4 py-3 sm:px-5 sm:py-3 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {activeDetailAssignment.class_name}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    {activeDetailAssignment.subject_name}
                  </span>
                  {activeDetailAssignment.is_graded && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                      Noté /{activeDetailAssignment.max_score || 20}
                    </span>
                  )}
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                  {activeDetailAssignment.title}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Par {activeDetailAssignment.teacher_name} • Échéance : {new Date(activeDetailAssignment.due_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              
              <div className="space-y-1">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Consignes & Énoncé</h4>
                <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl">
                  <FormattedHomeworkContent content={activeDetailAssignment.description} />
                </div>
              </div>

              {activeDetailAssignment.attachments && activeDetailAssignment.attachments.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Documents joints ({activeDetailAssignment.attachments.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeDetailAssignment.attachments.map((file, idx) => {
                      const cat = getFileCategory(file.name, file.type);
                      const sizeText = formatFileSize(file.size);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-200 transition-colors shadow-2xs group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] ${
                              cat === 'pdf' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              cat === 'doc' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              cat === 'sheet' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              cat === 'image' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}>
                              {cat === 'pdf' ? 'PDF' :
                               cat === 'doc' ? 'DOC' :
                               cat === 'sheet' ? 'XLS' :
                               cat === 'image' ? 'IMG' :
                               <Paperclip size={13} />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate text-[11px]" title={file.name}>
                                {file.name}
                              </p>
                              {sizeText && (
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {sizeText}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewAttachment(file);
                                setPreviewZoom(100);
                                setPreviewRotation(0);
                              }}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                              title="Aperçu instantané"
                            >
                              <Eye size={12} />
                              <span>Aperçu</span>
                            </button>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              download={file.name}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
                              title="Consulter ou télécharger"
                            >
                              <span>Ouvrir</span>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Student/Parent Action Section */}
              {(isStudent || isParent) && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="text-emerald-600" size={16} />
                      <span className="text-xs font-bold text-emerald-950">Statut du travail</span>
                    </div>
                    {studentReads[activeDetailAssignment.id]?.is_read && (
                      <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-md">
                        ✓ Consulté
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => toggleStudentWorkDone(
                        activeDetailAssignment.id, 
                        studentReads[activeDetailAssignment.id]?.work_status || 'TODO'
                      )}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                        studentReads[activeDetailAssignment.id]?.work_status === 'COMPLETED'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-50'
                      }`}
                    >
                      {studentReads[activeDetailAssignment.id]?.work_status === 'COMPLETED' ? <CheckCircle2 size={13} /> : <Square size={13} />}
                      <span>
                        {studentReads[activeDetailAssignment.id]?.work_status === 'COMPLETED'
                          ? 'Terminé (cliquer pour annuler)'
                          : 'Marquer comme fait'}
                      </span>
                    </button>

                    {isParent && (
                      <button
                        type="button"
                        onClick={() => recordHomeworkRead(activeDetailAssignment.id, true)}
                        className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Shield size={12} />
                        <span>Signer (Visa)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Teacher Section : Tracking Sheet */}
              {canManageHomework && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Users size={13} className="text-indigo-600" />
                      <span>Traçabilité & Lectures des Élèves</span>
                    </h4>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenReminderModal(activeDetailAssignment)}
                        className="py-1 px-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Bell size={11} />
                        <span>Relancer non-lecteurs</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => loadClassTracking(activeDetailAssignment.id)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                        title="Rafraîchir"
                      >
                        <RefreshCw size={12} className={loadingTracking ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>

                  {loadingTracking ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Chargement des lectures...
                    </div>
                  ) : classTrackingList.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                      Aucune consultation enregistrée pour l'instant.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="max-h-40 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                            <tr>
                              <th className="py-1.5 px-2.5 font-bold">Élève</th>
                              <th className="py-1.5 px-2.5 font-bold">1ère lecture</th>
                              <th className="py-1.5 px-2.5 font-bold">Vues</th>
                              <th className="py-1.5 px-2.5 font-bold">Statut</th>
                              <th className="py-1.5 px-2.5 font-bold">Visa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {classTrackingList.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/60">
                                <td className="py-1.5 px-2.5 font-bold text-slate-900 text-[11px]">
                                  {item.students?.first_name} {item.students?.last_name}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-500 text-[10.5px]">
                                  {item.first_read_at 
                                    ? new Date(item.first_read_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                    : 'Non lu'}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-700 font-semibold text-[10.5px]">
                                  {item.read_count || 1}
                                </td>
                                <td className="py-1.5 px-2.5">
                                  <span className={`px-1.5 py-0.2 rounded-md text-[9.5px] font-bold ${
                                    item.work_status === 'COMPLETED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {item.work_status === 'COMPLETED' ? 'Fait' : 'En attente'}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2.5">
                                  {item.parent_acknowledged ? (
                                    <span className="text-emerald-600 font-bold text-[10px] flex items-center gap-0.5">
                                      <Check size={10} /> Visé
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                ID : {activeDetailAssignment.id.substring(0, 8)}
              </span>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL : PLANIFIER L'ARCHIVAGE AUTOMATIQUE (CLOUD & STOCKAGE EXTERNE EN FIN DE MOIS)
          ========================================================================= */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl sm:max-w-2xl w-full border border-slate-200 shadow-2xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-3 bg-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 text-indigo-200 flex items-center justify-center shrink-0">
                  <FolderArchive size={14} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Planifier l'Archivage Cloud
                    </h3>
                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      Fin de mois
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveArchiveSettings} className="p-4 sm:p-5 space-y-3 max-h-[78vh] overflow-y-auto custom-scrollbar">
              
              {/* 1. Toggle Activation Card */}
              <div className={`p-3 rounded-xl border transition-all ${
                archiveSettings.isEnabled 
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950' 
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white shadow-2xs shrink-0 ${
                      archiveSettings.isEnabled ? 'bg-emerald-600' : 'bg-slate-400'
                    }`}>
                      {archiveSettings.isEnabled ? <Check size={14} /> : <X size={14} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">
                        Archivage automatique fin de mois
                      </h4>
                      <p className="text-[10.5px] text-slate-500">
                        {archiveSettings.isEnabled 
                          ? 'Actif : Sauvegarde automatique des devoirs et statistiques chaque fin de mois.' 
                          : 'Désactivé : Aucune exportation automatique programmée.'}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      checked={archiveSettings.isEnabled} 
                      onChange={e => setArchiveSettings(prev => ({ ...prev, isEnabled: e.target.checked }))} 
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {archiveSettings.isEnabled && (
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[10.5px] text-emerald-800 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-emerald-600" />
                      Prochaine échéance : <strong className="font-bold">{nextMonthEnd.dateFormatted} à 23h59</strong>
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md font-bold text-[10px]">
                      J-{nextMonthEnd.daysRemaining}
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Fréquence et Périodicité */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Calendar size={12} className="text-indigo-600" />
                  Fréquence programmée
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'MONTHLY', label: 'Fin de mois', desc: 'Dernier jour ouvré à 23h59' },
                    { id: 'TRIMESTER', label: 'Fin de trimestre', desc: 'Clôture de chaque période' },
                    { id: 'WEEKLY', label: 'Hebdomadaire', desc: 'Chaque dimanche soir' },
                  ].map(item => {
                    const isSelected = archiveSettings.frequency === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setArchiveSettings(prev => ({ ...prev, frequency: item.id as any }))}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-500 text-indigo-950 ring-1 ring-indigo-500'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold block">{item.label}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Destination de l'archivage */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Cloud size={12} className="text-indigo-600" />
                  Destination
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { 
                      id: 'SUPABASE_STORAGE', 
                      icon: Server, 
                      label: 'Supabase Storage', 
                      desc: 'Bucket cloud de l\'école' 
                    },
                    { 
                      id: 'EXTERNAL_CLOUD', 
                      icon: Cloud, 
                      label: 'Cloud Externe', 
                      desc: 'Synchronisation API sécurisée' 
                    },
                    { 
                      id: 'LOCAL_AND_EMAIL', 
                      icon: Mail, 
                      label: 'Email & Export', 
                      desc: 'Copie email + téléchargement' 
                    },
                  ].map(dest => {
                    const isSelected = archiveSettings.destination === dest.id;
                    const IconComp = dest.icon;
                    return (
                      <button
                        key={dest.id}
                        type="button"
                        onClick={() => setArchiveSettings(prev => ({ ...prev, destination: dest.id as any }))}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-500 text-indigo-950 ring-1 ring-indigo-500'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <IconComp size={12} />
                          </div>
                          <span className="text-xs font-bold truncate">{dest.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug">{dest.desc}</p>
                      </button>
                    );
                  })}
                </div>

                {archiveSettings.destination === 'SUPABASE_STORAGE' && (
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-0.5 mt-1.5">
                    <label className="text-[10.5px] font-bold text-slate-700">
                      Bucket Supabase Storage :
                    </label>
                    <input
                      type="text"
                      value={archiveSettings.bucketName}
                      onChange={e => setArchiveSettings(prev => ({ ...prev, bucketName: e.target.value }))}
                      placeholder="academic_archives"
                      className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-mono text-slate-800"
                    />
                  </div>
                )}
              </div>

              {/* 4. Données et Formats inclus */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <FileText size={12} className="text-indigo-600" />
                  Contenu de l'archive
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={archiveSettings.includeStats}
                      onChange={e => setArchiveSettings(prev => ({ ...prev, includeStats: e.target.checked }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 text-[11px] block">Statistiques Recharts</span>
                      <span className="text-[10px] text-slate-400">Taux de lecture et achèvement</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={archiveSettings.includePdf}
                      onChange={e => setArchiveSettings(prev => ({ ...prev, includePdf: e.target.checked }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 text-[11px] block">Rapport PDF officiel</span>
                      <span className="text-[10px] text-slate-400">Registre imprimable certifié</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={archiveSettings.includeCsv}
                      onChange={e => setArchiveSettings(prev => ({ ...prev, includeCsv: e.target.checked }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 text-[11px] block">Données tabulaires CSV</span>
                      <span className="text-[10px] text-slate-400">Fichier Excel pour tableur</span>
                    </div>
                  </label>

                  <div className="flex items-center gap-2 p-2 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-semibold text-emerald-900 text-[11px] block">Accusés horodatés</span>
                      <span className="text-[10px] text-emerald-700">Lectures élèves & visas parents</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Notification Email */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Mail size={12} className="text-indigo-600" />
                  Email de notification
                </label>
                <input
                  type="email"
                  value={archiveSettings.notificationEmail}
                  onChange={e => setArchiveSettings(prev => ({ ...prev, notificationEmail: e.target.value }))}
                  placeholder="direction@edunova.com"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white"
                />
              </div>

              {/* 6. Historique compact */}
              {archiveHistory.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <FolderArchive size={12} className="text-indigo-600" />
                      Archives récentes ({archiveHistory.length})
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                    {archiveHistory.slice(0, 2).map((item, idx) => (
                      <div key={item.id || idx} className="p-2 bg-white hover:bg-slate-50 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <FileText size={13} className="text-indigo-600 shrink-0" />
                          <div>
                            <p className="font-semibold text-slate-900 text-[11px] leading-tight">
                              Archive {item.monthName || 'Mensuelle'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {new Date(item.dateCreated).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} • {item.totalAssignments} devoirs
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800">
                          {item.fileSizeKb} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. Action immédiate */}
              <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                    <Sparkles size={13} className="text-indigo-600" />
                    Archivage immédiat
                  </p>
                  <p className="text-[10.5px] text-indigo-700">
                    Génère et télécharge l'archive du mois en cours maintenant.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={executingArchiveNow}
                  onClick={handleExecuteArchiveNow}
                  className="py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {executingArchiveNow ? <RefreshCw className="animate-spin" size={12} /> : <Download size={12} />}
                  <span>Archiver maintenant</span>
                </button>
              </div>

              {/* Modal Footer */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Fermer
                </button>

                <button
                  type="submit"
                  disabled={savingArchiveSettings}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                >
                  {savingArchiveSettings ? <RefreshCw className="animate-spin" size={13} /> : <Save size={13} />}
                  <span>Enregistrer</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL : GUIDE & SCRIPT SQL SUPABASE (CORRECTION ERREUR 42P01 CAMPUSES)
          ========================================================================= */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Database size={14} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Script SQL Supabase — Devoirs
                    </h3>
                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/30 text-emerald-300">
                      v2.0
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="p-1 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-3 max-h-[78vh] overflow-y-auto custom-scrollbar">
              
              {/* Step by step guide */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h4 className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Terminal size={12} className="text-indigo-600" />
                  <span>Installation en 3 étapes dans Supabase</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 bg-white border border-slate-200/80 rounded-lg space-y-0.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9.5px] font-bold flex items-center justify-center">1</span>
                    <p className="font-bold text-slate-900 text-[11px]">SQL Editor</p>
                    <p className="text-[10.5px] text-slate-500 leading-snug">
                      Ouvrez votre projet Supabase &gt; SQL Editor.
                    </p>
                  </div>

                  <div className="p-2 bg-white border border-slate-200/80 rounded-lg space-y-0.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9.5px] font-bold flex items-center justify-center">2</span>
                    <p className="font-bold text-slate-900 text-[11px]">Collez & Exécutez</p>
                    <p className="text-[10.5px] text-slate-500 leading-snug">
                      Collez le code et cliquez sur <strong>RUN</strong>.
                    </p>
                  </div>

                  <div className="p-2 bg-white border border-slate-200/80 rounded-lg space-y-0.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9.5px] font-bold flex items-center justify-center">3</span>
                    <p className="font-bold text-slate-900 text-[11px]">Vérifiez</p>
                    <p className="text-[10.5px] text-slate-500 leading-snug">
                      Revenez ici et cliquez sur Tester.
                    </p>
                  </div>
                </div>
              </div>

              {/* Code viewer */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <FileCode size={12} className="text-indigo-600" />
                    Code SQL
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      {copiedSql ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      <span>{copiedSql ? "Copié !" : "Copier"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadSql}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Download size={11} />
                      <span>Télécharger</span>
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 shadow-inner">
                  <pre className="p-3 text-slate-200 text-[10.5px] font-mono overflow-x-auto max-h-56 custom-scrollbar leading-relaxed">
                    {HOMEWORK_MODULE_SQL}
                  </pre>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Fermer
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  {copiedSql ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedSql ? "Copié !" : "Copier le Script"}</span>
                </button>
                <button
                  type="button"
                  disabled={checkingDb}
                  onClick={handleCheckDbConnection}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={checkingDb ? "animate-spin" : ""} size={12} />
                  <span>{checkingDb ? "Test..." : "Tester la connexion"}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default HomeworkManager;
