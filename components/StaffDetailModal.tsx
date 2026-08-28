import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Phone, MapPin, Calendar, Hash, 
  X, Loader2, FileText, CreditCard, Briefcase, 
  Clock, Edit2, BookOpen, TrendingUp, History, 
  CheckCircle2, AlertTriangle, Building2, Sparkles,
  Shield, ShieldAlert, Award, DollarSign, Copy, Check,
  Printer, BadgeCheck, ChevronRight, Layers, Calculator
} from 'lucide-react';
import { supabase } from '../supabase';
import { StaffMember, UserProfile, UserRole } from '../types';
import { formatStudentName } from '../utils/formatters';

interface StaffDetailModalProps {
  staff: StaffMember | null;
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onEdit?: (staffId: string) => void;
  onAssign?: (staffId: string) => void;
  onUpdateSalary?: (staff: StaffMember) => void;
  onViewSalaryHistory?: (staff: StaffMember) => void;
}

export const StaffDetailModal: React.FC<StaffDetailModalProps> = ({
  staff,
  isOpen,
  onClose,
  user,
  onEdit,
  onAssign,
  onUpdateSalary,
  onViewSalaryHistory,
}) => {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'info' | 'assignments' | 'pay'>('info');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (staff && staff.id) {
      fetchStaffAssignments(staff.id);
    }
  }, [staff?.id]);

  const fetchStaffAssignments = async (staffId: string) => {
    setLoadingAssignments(true);
    try {
      const { data, error } = await supabase
        .from('staff_assignments')
        .select('*')
        .eq('staff_id', staffId)
        .order('day_of_week', { ascending: true });

      if (!error && data) {
        setAssignments(data);
      }
    } catch (e) {
      console.warn("Error fetching staff assignments", e);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePrintStaffSheet = async () => {
    if (!staff) return;

    let schoolName = 'Établissement Scolaire EduNova';
    let schoolLogoUrl = '';

    if (user?.school_id) {
      const cachedName = localStorage.getItem(`school_name_${user.school_id}`);
      const cachedLogo = localStorage.getItem(`school_logo_${user.school_id}`);
      if (cachedName) schoolName = cachedName;
      if (cachedLogo) schoolLogoUrl = cachedLogo;

      try {
        const { data } = await supabase
          .from('schools')
          .select('name, logo_url')
          .eq('id', user.school_id)
          .maybeSingle();
        if (data?.name) {
          schoolName = data.name;
          if (data.logo_url) schoolLogoUrl = data.logo_url;
        }
      } catch (e) {
        console.warn('Could not fetch school details for printing', e);
      }
    }

    const { fullName: formattedFullName } = formatStudentName(staff.last_name, staff.first_name);
    const dateFormatted = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const dobFormatted = staff.dob ? new Date(staff.dob).toLocaleDateString('fr-FR') : 'Non renseigné';
    const refCode = `HR-${staff.id.substring(0, 8).toUpperCase()}`;

    let totalAssignmentsMonthly = 0;
    assignments.forEach((a) => {
      const courseRate = a.hourly_rate || (staff.pay_type === 'Horaire' ? (staff.amount || 0) : 0);
      totalAssignmentsMonthly += (a.duration_hours || 0) * courseRate * 4;
    });

    const totalMonthlyEst = staff.pay_type === 'Fixe' 
      ? staff.amount 
      : (staff.calculated_base_salary || totalAssignmentsMonthly);

    const printHtml = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Fiche Dossier Personnel - ${formattedFullName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
          
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          
          * { box-sizing: border-box; }
          body { 
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; 
            margin: 0; 
            padding: 20px; 
            color: #0f172a; 
            background: #ffffff;
            font-size: 10.5pt;
            line-height: 1.45;
          }
          
          .header-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid #1e1b4b;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .school-branding { display: flex; align-items: center; gap: 14px; }
          .school-logo { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; }
          .school-title { font-size: 15pt; font-weight: 800; color: #1e1b4b; text-transform: uppercase; margin: 0; }
          .school-subtitle { font-size: 8.5pt; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 2px; }
          .doc-meta { text-align: right; }
          .doc-badge { display: inline-block; background: #eef2ff; color: #3730a3; font-size: 8pt; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; border: 1px solid #c7d2fe; }
          .doc-ref { font-family: 'JetBrains Mono', monospace; font-size: 9pt; font-weight: 700; color: #0f172a; margin-top: 5px; }
          .doc-date { font-size: 8pt; color: #64748b; margin-top: 2px; }

          .doc-main-title {
            text-align: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 10px 16px;
            margin-bottom: 20px;
          }
          .doc-main-title h2 { margin: 0; font-size: 13pt; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
          .doc-main-title p { margin: 2px 0 0 0; font-size: 8.5pt; color: #64748b; font-weight: 600; }

          .section-header {
            font-size: 9.5pt;
            font-weight: 800;
            color: #1e1b4b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 4px;
            margin-top: 18px;
            margin-bottom: 12px;
          }

          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }

          .info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 12px;
          }
          .info-label { font-size: 7.5pt; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
          .info-val { font-size: 9.5pt; font-weight: 700; color: #0f172a; }
          .info-mono { font-family: 'JetBrains Mono', monospace; }

          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8.5pt; }
          th { background: #f1f5f9; color: #334155; font-weight: 700; text-transform: uppercase; font-size: 7.5pt; padding: 7px 10px; text-align: left; border: 1px solid #cbd5e1; }
          td { padding: 7px 10px; border: 1px solid #e2e8f0; color: #0f172a; font-weight: 500; }
          tr:nth-child(even) td { background: #f8fafc; }

          .total-box {
            background: #1e1b4b;
            color: #ffffff;
            border-radius: 8px;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 15px;
          }
          .total-title { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; color: #c7d2fe; }
          .total-amount { font-family: 'JetBrains Mono', monospace; font-size: 13pt; font-weight: 800; color: #34d399; }

          .signatures {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 50px;
            page-break-inside: avoid;
          }
          .sig-box {
            border-top: 2px solid #0f172a;
            padding-top: 8px;
          }
          .sig-title { font-size: 8.5pt; font-weight: 800; color: #0f172a; text-transform: uppercase; }
          .sig-sub { font-size: 7.5pt; color: #64748b; margin-top: 2px; }
          .sig-space { height: 50px; }

          .footer-note {
            margin-top: 30px;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            display: flex;
            justify-content: space-between;
            font-size: 7.5pt;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <div class="school-branding">
            ${schoolLogoUrl ? `<img src="${schoolLogoUrl}" class="school-logo" alt="Logo" />` : ''}
            <div>
              <h1 class="school-title">${schoolName}</h1>
              <div class="school-subtitle">Direction des Ressources Humaines & Gestion du Personnel</div>
            </div>
          </div>
          <div class="doc-meta">
            <span class="doc-badge">Document Officiel RH</span>
            <div class="doc-ref">Réf: ${refCode}</div>
            <div class="doc-date">Délivré le ${dateFormatted}</div>
          </div>
        </div>

        <div class="doc-main-title">
          <h2>Fiche Signalétique & Dossier Collaborateur</h2>
          <p>Système de Gestion Éducative EduNova Pro — Registre du Personnel</p>
        </div>

        <div class="section-header">1. Identité & État Civil du Collaborateur</div>
        <div class="grid-2">
          <div class="info-box">
            <div class="info-label">Nom & Prénom</div>
            <div class="info-val">${formattedFullName}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Fonction / Poste Occupe</div>
            <div class="info-val" style="color: #4338ca;">${staff.role}</div>
          </div>
        </div>

        <div class="grid-3" style="margin-top: 10px;">
          <div class="info-box">
            <div class="info-label">Sexe / Genre</div>
            <div class="info-val">${staff.gender || 'Non renseigné'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Date de Naissance</div>
            <div class="info-val">${dobFormatted}</div>
          </div>
          <div class="info-box">
            <div class="info-label">NIF / CIN / NINU</div>
            <div class="info-val info-mono">${staff.nif_cin || 'Non spécifié'}</div>
          </div>
        </div>

        <div class="grid-2" style="margin-top: 10px;">
          <div class="info-box">
            <div class="info-label">Numéro de Téléphone</div>
            <div class="info-val info-mono">${staff.phone || 'Non renseigné'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Adresse Électronique (Email)</div>
            <div class="info-val">${staff.email || 'Aucun email enregistré'}</div>
          </div>
        </div>

        <div class="info-box" style="margin-top: 10px;">
          <div class="info-label">Adresse Résidentielle</div>
          <div class="info-val">${staff.address || 'Non communiquée'}</div>
        </div>

        <div class="section-header">2. Régime Contractuel & Modalités de Rémunération</div>
        <div class="grid-3">
          <div class="info-box">
            <div class="info-label">Type de Contrat</div>
            <div class="info-val">${staff.contract_type}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Régime de Paie</div>
            <div class="info-val">${staff.pay_type}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Statut Actuel</div>
            <div class="info-val" style="color: ${staff.status === 'Actif' ? '#059669' : '#dc2626'};">${staff.status}</div>
          </div>
        </div>

        <div class="grid-2" style="margin-top: 10px;">
          <div class="info-box">
            <div class="info-label">Base Contractuelle / Taux</div>
            <div class="info-val info-mono">${(staff.amount || 0).toLocaleString()} HTG ${staff.pay_type === 'Horaire' ? '/ heure' : '/ mois'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Volume Horaire Hebdomadaire</div>
            <div class="info-val info-mono">${staff.weekly_hours || 0} heures / semaine</div>
          </div>
        </div>

        <div class="section-header">3. Coordonnées de Versement Bancaire</div>
        <div class="grid-2">
          <div class="info-box">
            <div class="info-label">Établissement Bancaire</div>
            <div class="info-val">${staff.bank_name || 'Non spécifié (Paiement Direct/Chèque)'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Numéro de Compte Bancaire</div>
            <div class="info-val info-mono">${staff.bank_account || 'Non communiqué'}</div>
          </div>
        </div>

        ${assignments.length > 0 ? `
          <div class="section-header">4. Attributions de Cours & Horaire d'Enseignement</div>
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Matière Enseignée</th>
                <th>Classe / Promotion</th>
                <th>Horaire Hebdomadaire</th>
                <th style="text-align: right;">Volume / S.</th>
                <th style="text-align: right;">Estimation / Mois</th>
              </tr>
            </thead>
            <tbody>
              ${assignments.map((a, idx) => {
                const cRate = a.hourly_rate || (staff.pay_type === 'Horaire' ? (staff.amount || 0) : 0);
                const cMonthly = (a.duration_hours || 0) * cRate * 4;
                return `
                  <tr>
                    <td><strong>${idx + 1}</strong></td>
                    <td><strong>${a.subject_name || 'Matière'}</strong></td>
                    <td>${a.class_name || 'Non spécifiée'}</td>
                    <td>${a.day_of_week || ''} (${a.start_time || ''} - ${a.end_time || ''})</td>
                    <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">${a.duration_hours || 0}h</td>
                    <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 700;">${cMonthly > 0 ? cMonthly.toLocaleString() + ' HTG' : '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        ` : ''}

        <div class="total-box">
          <div class="total-title">Rémunération Mensuelle Brute Estimée</div>
          <div class="total-amount">${(totalMonthlyEst || 0).toLocaleString()} HTG</div>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-title">Signature du Collaborateur</div>
            <div class="sig-sub">"Lu et certifié exact"</div>
            <div class="sig-space"></div>
          </div>
          <div class="sig-box">
            <div class="sig-title">Cachet & Signature de la Direction</div>
            <div class="sig-sub">${schoolName}</div>
            <div class="sig-space"></div>
          </div>
        </div>

        <div class="footer-note">
          <span>Généré automatiquement par EduNova Pro ERP • ID: ${staff.id}</span>
          <span>Page 1 / 1</span>
        </div>
      </body>
      </html>
    `;

    // Try opening popup print window
    const printWindow = window.open('', '_blank', 'width=950,height=900');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
    } else {
      // Fallback via printable iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(printHtml);
        iframeDoc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }, 500);
      } else {
        window.print();
      }
    }
  };

  if (!isOpen || !staff) return null;

  const fullName = formatStudentName(staff.last_name, staff.first_name).fullName;
  const isAdmin = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR;

  const fixedSalary = staff.pay_type === 'Fixe' ? (staff.amount || 0) : 0;
  const teachingSalaryFromAssignments = assignments.reduce((acc, a) => {
    const rate = a.hourly_rate || (staff.pay_type === 'Horaire' ? (staff.amount || 0) : 0);
    return acc + ((a.duration_hours || 0) * rate * 4);
  }, 0);

  const totalAssignedHours = assignments.reduce((acc, a) => acc + (a.duration_hours || 0), 0);

  const monthlySalary = staff.calculated_base_salary ?? (
    assignments.length > 0
      ? (fixedSalary + teachingSalaryFromAssignments)
      : (staff.pay_type === 'Horaire'
          ? ((staff.weekly_hours || 0) * (staff.amount || 0) * 4)
          : (staff.amount || 0))
  );

  return (
    <AnimatePresence>
      <div 
        onClick={onClose}
        className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 md:p-8 overflow-y-auto bg-slate-950/75 backdrop-blur-md cursor-pointer"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh] cursor-default"
        >
          {/* Header Banner - Executive Modern Dark Palette */}
          <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 relative overflow-hidden shrink-0 border-b border-indigo-900/40">
            {/* Soft Ambient Mesh Background */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/3 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="absolute top-5 right-5 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md active:scale-90 z-30 cursor-pointer border border-white/10"
              title="Fermer le dossier"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
              <div className="flex items-center gap-4 sm:gap-5">
                {/* Modern Avatar with Status Ring */}
                <div className="relative shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 text-white font-black text-xl sm:text-2xl flex items-center justify-center shadow-xl shadow-indigo-900/50 ring-4 ring-white/10">
                    {staff.first_name?.charAt(0)}{staff.last_name?.charAt(0)}
                  </div>
                  <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ring-4 ring-slate-950 flex items-center justify-center ${
                    staff.status === 'Actif' ? 'bg-emerald-500' :
                    staff.status === 'Congé' ? 'bg-amber-500' : 'bg-rose-500'
                  }`} title={`Statut : ${staff.status}`}>
                    {staff.status === 'Actif' && <CheckCircle2 size={12} className="text-white" />}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider uppercase bg-indigo-500/25 text-indigo-200 border border-indigo-400/30 flex items-center gap-1.5">
                      <Briefcase size={12} /> {staff.role}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider uppercase border ${
                      staff.contract_type === 'Permanent' 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {staff.contract_type}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight flex items-center gap-2">
                    {fullName}
                    <BadgeCheck size={20} className="text-indigo-400 shrink-0" />
                  </h2>

                  <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300 font-medium mt-1 flex-wrap">
                    {staff.phone && (
                      <a href={`tel:${staff.phone}`} className="hover:text-indigo-300 transition-colors flex items-center gap-1 font-mono">
                        <Phone size={13} className="text-emerald-400" /> {staff.phone}
                      </a>
                    )}
                    {staff.email && (
                      <a href={`mailto:${staff.email}`} className="hover:text-indigo-300 transition-colors flex items-center gap-1">
                        <Mail size={13} className="text-indigo-400" /> {staff.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons in Header */}
              <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
                {isAdmin && onAssign && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClose(); onAssign(staff.id); }}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/15 flex items-center justify-center gap-2 backdrop-blur-md cursor-pointer active:scale-95"
                  >
                    <BookOpen size={15} /> Affectations
                  </button>
                )}
                {isAdmin && onEdit && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClose(); onEdit(staff.id); }}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-indigo-400/30"
                  >
                    <Edit2 size={15} /> Éditer Dossier
                  </button>
                )}
              </div>
            </div>

            {/* International HR Navigation Tabs */}
            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 text-xs font-bold overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  activeTab === 'info'
                    ? 'bg-white text-slate-900 shadow-lg shadow-black/20 font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <User size={15} /> Dossier Personnel
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pay')}
                className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  activeTab === 'pay'
                    ? 'bg-white text-slate-900 shadow-lg shadow-black/20 font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <DollarSign size={15} /> Contrat & Rémunération
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('assignments')}
                className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  activeTab === 'assignments'
                    ? 'bg-white text-slate-900 shadow-lg shadow-black/20 font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <BookOpen size={15} /> Affectations & Charge ({assignments.length})
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar bg-slate-50/70">
            {activeTab === 'info' && (
              <div className="space-y-6">
                {/* Section 1: Identité & Coordonnées */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <User className="text-indigo-600" size={17} /> Identité & Coordonnées Personnelles
                    </h3>
                    <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      Fiche Répertoire HR
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100/80 space-y-1">
                      <p className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Nom & Prénom</p>
                      <p className="font-extrabold text-slate-900 text-sm">{fullName}</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100/80 space-y-1">
                      <p className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Fonction / Rôle</p>
                      <p className="font-bold text-indigo-700 text-sm">{staff.role}</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100/80 space-y-1 relative group">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Téléphone</p>
                        {staff.phone && (
                          <button
                            type="button"
                            onClick={() => handleCopy(staff.phone, 'phone')}
                            className="text-slate-400 hover:text-indigo-600 p-1 cursor-pointer transition-colors"
                            title="Copier le numéro"
                          >
                            {copiedField === 'phone' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                      <p className="font-mono font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                        <Phone size={13} className="text-emerald-600 shrink-0" />
                        {staff.phone ? (
                          <a href={`tel:${staff.phone}`} className="hover:underline text-indigo-600">
                            {staff.phone}
                          </a>
                        ) : <span className="text-slate-400 font-normal">Non renseigné</span>}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Adresse Email</p>
                        {staff.email && (
                          <button
                            type="button"
                            onClick={() => handleCopy(staff.email!, 'email')}
                            className="text-slate-400 hover:text-indigo-600 p-1 cursor-pointer transition-colors"
                            title="Copier l'email"
                          >
                            {copiedField === 'email' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                      <p className="font-semibold text-slate-800 text-xs flex items-center gap-1.5 truncate">
                        <Mail size={13} className="text-slate-400 shrink-0" />
                        {staff.email ? (
                          <a href={`mailto:${staff.email}`} className="hover:underline text-indigo-600 truncate">
                            {staff.email}
                          </a>
                        ) : <span className="text-slate-400 font-normal">Non renseignée</span>}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100/80 space-y-1">
                      <p className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Genre / Sexe</p>
                      <p className="font-bold text-slate-800">{staff.gender || 'Non renseigné'}</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100/80 space-y-1">
                      <p className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Date de Naissance</p>
                      <p className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400 shrink-0" />
                        {staff.dob ? new Date(staff.dob).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Non renseignée'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">NIF / CIN / NINU</p>
                        {staff.nif_cin && (
                          <button
                            type="button"
                            onClick={() => handleCopy(staff.nif_cin, 'nif')}
                            className="text-slate-400 hover:text-indigo-600 p-1 cursor-pointer transition-colors"
                            title="Copier le NIF/CIN"
                          >
                            {copiedField === 'nif' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                      <p className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                        <Hash size={13} className="text-slate-400 shrink-0" />
                        {staff.nif_cin || 'Non renseigné'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100/80 space-y-1 sm:col-span-2">
                      <p className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Adresse Résidentielle</p>
                      <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        {staff.address || 'Non renseignée'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Coordonnées Bancaires & Paiement */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <CreditCard className="text-emerald-600" size={17} /> Coordonnées Bancaires & Virement
                    </h3>
                    <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      Paiement Direct
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100/80 space-y-1">
                      <p className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Établissement Bancaire</p>
                      <p className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                        <Building2 size={16} className="text-indigo-600 shrink-0" />
                        {staff.bank_name || 'Aucune banque enregistrée'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Numéro de Compte</p>
                        {staff.bank_account && (
                          <button
                            type="button"
                            onClick={() => handleCopy(staff.bank_account!, 'bank')}
                            className="text-slate-400 hover:text-indigo-600 p-1 cursor-pointer transition-colors"
                            title="Copier le numéro de compte"
                          >
                            {copiedField === 'bank' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                      <p className="font-mono font-extrabold text-slate-900 text-sm">
                        {staff.bank_account || 'Non renseigné'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 3: Information Ancienneté & Système */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                      <Shield size={18} />
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900">Enregistrement Système & Sécurité</p>
                      <p className="text-slate-500 text-[11px]">Dossier créé le {staff.created_at ? new Date(staff.created_at).toLocaleDateString('fr-FR') : 'Date non disponible'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl font-medium text-[11px]">
                      ID: {staff.id}
                    </span>
                  </div>
                </div>

                {/* Termination Details if Fired */}
                {staff.status === 'Licencié' && staff.termination_details && (
                  <div className="bg-rose-50 p-6 rounded-3xl border border-rose-200 text-rose-900 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-rose-700">
                      <ShieldAlert size={17} /> Historique de Licenciement / Départ
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="text-rose-600 font-semibold">Motif du départ</p>
                        <p className="font-bold text-rose-950 mt-0.5">{staff.termination_details.reason}</p>
                      </div>
                      <div>
                        <p className="text-rose-600 font-semibold">Montant du préavis</p>
                        <p className="font-mono font-black text-rose-950 mt-0.5">
                          {(staff.termination_details.notice_amount || 0).toLocaleString()} HTG
                        </p>
                      </div>
                      <div>
                        <p className="text-rose-600 font-semibold">Date de révocation</p>
                        <p className="font-bold text-rose-950 mt-0.5">
                          {staff.termination_details.date ? new Date(staff.termination_details.date).toLocaleDateString('fr-FR') : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'pay' && (
              <div className="space-y-6">
                {/* Contract & Pay Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Régime Contractuel</p>
                      <Briefcase size={16} className="text-indigo-600" />
                    </div>
                    <div>
                      <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black ${
                        staff.contract_type === 'Permanent' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {staff.contract_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Régime de paie : <strong className="text-slate-800">{staff.pay_type}</strong>
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Base Contractuelle</p>
                      <DollarSign size={16} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-mono font-black text-2xl text-slate-900">
                        {(staff.amount || 0).toLocaleString()} <span className="text-xs text-slate-500 font-semibold">HTG</span>
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {staff.pay_type === 'Horaire' ? 'Taux horaire de base / h' : 'Fixe mensuel contractuel'}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg shadow-indigo-950/20 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between relative z-10">
                      <p className="text-[11px] font-extrabold text-indigo-300 uppercase tracking-wider">Salaire Total Estimé</p>
                      <Sparkles size={16} className="text-amber-400" />
                    </div>
                    <div className="relative z-10">
                      <p className="font-mono font-black text-2xl text-emerald-400">
                        {monthlySalary.toLocaleString()} <span className="text-xs text-emerald-200 font-bold">HTG / mois</span>
                      </p>
                    </div>
                    <p className="text-xs text-indigo-200 font-medium flex items-center gap-1.5 relative z-10">
                      <Clock size={13} className="text-amber-300 shrink-0" />
                      Charge globale : {totalAssignedHours || staff.weekly_hours || 0}h / semaine
                    </p>
                  </div>
                </div>

                {/* Salary Calculation Breakdown Tree */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Calculator size={16} className="text-indigo-600" /> Composition Complète de la Rémunération
                    </h4>
                    <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      Calcul Hybride Conforme
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Fixed Component */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                          1
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900">Base Fixe Mensuelle (Rôle / Administration)</p>
                          <p className="text-slate-500 text-[11px]">
                            {staff.pay_type === 'Fixe' ? 'Salaire mensuel garanti sous contrat' : 'Aucun fixemensuel (Régime Horaire pur)'}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-extrabold text-slate-900 text-sm">
                        {fixedSalary.toLocaleString()} HTG
                      </span>
                    </div>

                    {/* Teaching Component */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                          2
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900">Cours & Charges d'Enseignement Assignés</p>
                          <p className="text-slate-500 text-[11px]">
                            {assignments.length > 0 
                              ? `${assignments.length} cours attribués (${totalAssignedHours}h/sem. × 4 semaines)`
                              : staff.pay_type === 'Horaire' ? `Volume déclaré : ${staff.weekly_hours || 0}h/sem.` : 'Aucun cours assigné actuellement'}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-extrabold text-emerald-700 text-sm">
                        +{teachingSalaryFromAssignments.toLocaleString()} HTG
                      </span>
                    </div>

                    {/* Total Line */}
                    <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-between">
                      <p className="font-extrabold text-indigo-950 text-sm uppercase tracking-wider">
                        Rémunération Brute Mensuelle Estimée
                      </p>
                      <span className="font-mono font-black text-indigo-900 text-base">
                        = {monthlySalary.toLocaleString()} HTG
                      </span>
                    </div>
                  </div>
                </div>

                {/* Salary Management Actions */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">Ajustements & Historique Salarial</h4>
                    <p className="text-xs text-slate-500">Accédez à l'historique des modifications de salaire et appliquez une révision.</p>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {onViewSalaryHistory && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onViewSalaryHistory(staff);
                        }}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <History size={15} /> Historique Salarial
                      </button>
                    )}
                    {isAdmin && onUpdateSalary && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onUpdateSalary(staff);
                        }}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <TrendingUp size={15} /> Ajuster Salaire
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'assignments' && (
              <div className="space-y-5">
                {/* Header Summary for Assignments */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <BookOpen className="text-indigo-600" size={17} /> Charges de Cours & Affectations
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {assignments.length} Cours
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Volume total : <strong className="text-slate-800">{totalAssignedHours}h / semaine</strong>
                    </p>
                  </div>

                  {isAdmin && onAssign && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onAssign(staff.id);
                      }}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                    >
                      <BookOpen size={15} /> Gérer / Affecter Cours
                    </button>
                  )}
                </div>

                {loadingAssignments ? (
                  <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-3" size={28} />
                    <p className="text-xs font-bold text-slate-600">Chargement de l'emploi du temps et des cours...</p>
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="bg-white p-10 rounded-3xl border border-slate-200/80 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <BookOpen size={22} />
                    </div>
                    <p className="font-extrabold text-slate-800 text-sm">Aucune affectation active</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Ce collaborateur n'a pas encore de cours attribué dans le planning de l'établissement pour l'année en cours.
                    </p>
                    {isAdmin && onAssign && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onAssign(staff.id);
                        }}
                        className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer"
                      >
                        Attribuer un cours maintenant
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {assignments.map((a, idx) => {
                      const courseRate = a.hourly_rate || (staff.pay_type === 'Horaire' ? (staff.amount || 0) : 0);
                      const courseMonthly = (a.duration_hours || 0) * courseRate * 4;

                      return (
                        <div key={a.id || idx} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-200 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                              {idx + 1}
                            </div>
                            <div className="space-y-1">
                              <p className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                                {a.subject_name || 'Matière d\'enseignement'}
                              </p>
                              <div className="flex items-center gap-2 text-xs flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 font-bold text-indigo-700 border border-slate-200/60">
                                  Classe : {a.class_name || 'Non spécifiée'}
                                </span>
                                <span className="text-slate-500 font-medium flex items-center gap-1">
                                  <Clock size={12} className="text-slate-400" />
                                  {a.day_of_week || 'Jour'} • {a.start_time} - {a.end_time}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 flex sm:flex-col justify-between items-center sm:items-end">
                            <span className="font-mono font-extrabold text-slate-900 text-xs">
                              {a.duration_hours || 0}h / semaine
                            </span>
                            {courseRate > 0 && (
                              <span className="text-[11px] font-mono text-emerald-700 font-bold">
                                {courseRate} HTG/h (~{courseMonthly.toLocaleString()} HTG/mois)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="font-medium flex items-center gap-1.5">
                ID Dossier: 
                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                  {staff.id.substring(0, 12)}...
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(staff.id, 'id')}
                  className="text-slate-400 hover:text-indigo-600 p-1 cursor-pointer transition-colors"
                  title="Copier l'ID complet"
                >
                  {copiedField === 'id' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handlePrintStaffSheet}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                title="Imprimer la fiche dossier"
              >
                <Printer size={15} /> Imprimer Fiche
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="px-6 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Fermer le Dossier
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default StaffDetailModal;

