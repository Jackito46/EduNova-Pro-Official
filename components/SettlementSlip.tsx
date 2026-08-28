
import React, { useRef, useState } from 'react';
import { 
  FileText, Printer, X, Download, 
  ShieldCheck, Calendar, User, Briefcase, 
  CreditCard, Info, MapPin, Phone, Mail,
  Loader2
} from 'lucide-react';
import { StaffMember, UserProfile, UserRole } from '../types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useSecurity } from './SecurityGuard';
import { addSecurityWatermark } from '../utils/pdfWatermark';
import { fixOklchForCanvas } from '../utils/pdfFix';
import { formatStudentName } from '../utils/formatters';

interface SettlementSlipProps {
  staff: StaffMember;
  schoolName: string;
  currentUser?: UserProfile;
  onClose: () => void;
}

const SettlementSlip: React.FC<SettlementSlipProps> = ({ staff, schoolName, currentUser, onClose }) => {
  const { ipAddress } = useSecurity();
  const printRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadPDF = async () => {
    const element = printRef.current;
    if (!element) return;

    try {
      setIsExporting(true);
      
      // Wait a bit for layout to settle
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Create a canvas from the element
      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        imageTimeout: 30000,
        onclone: (clonedDoc) => {
          fixOklchForCanvas(clonedDoc);
          const clonedElement = clonedDoc.getElementById('slip-content-wrapper');
          if (clonedElement) {
            clonedElement.style.height = 'auto';
            clonedElement.style.overflow = 'visible';
            clonedElement.style.maxHeight = 'none';
            
            // Ensure all parent elements allow full height
            let parent = clonedElement.parentElement;
            while (parent && parent !== clonedDoc.body) {
              parent.style.height = 'auto';
              parent.style.maxHeight = 'none';
              parent.style.overflow = 'visible';
              parent.style.position = 'static';
              parent.style.transform = 'none';
              parent = parent.parentElement;
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      const pageHeight = pdf.internal.pageSize.getHeight();
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      addSecurityWatermark(pdf, { user: currentUser, ipAddress });
      pdf.save(`Solde_de_Tout_Compte_${formatStudentName(staff.last_name, staff.first_name).fullName.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const windowPrint = window.open('', '', 'width=900,height=900');
    if (!windowPrint) return;

    windowPrint.document.write(`
      <html>
        <head>
          <title>Solde de Tout Compte - {formatStudentName(staff.last_name, staff.first_name).fullName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #000; line-height: 1.5; background: #fff; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 2px solid #1e1b4b; padding-bottom: 8px; }
            .school-info { text-align: left; }
            .school-name { font-size: 18px; font-weight: 800; color: #1e1b4b; text-transform: uppercase; margin-bottom: 2px; letter-spacing: -0.025em; }
            .school-sub { font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 2px; }
            .school-system { font-size: 11px; color: #64748b; }
            .doc-type { text-align: right; }
            .doc-label { font-size: 10px; text-transform: uppercase; color: #6366f1; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 2px; }
            .doc-id { font-size: 12px; font-family: monospace; color: #334155; font-weight: 600; }
            .doc-date { font-size: 11px; color: #64748b; margin-top: 2px; }
            
            .title-container { text-align: center; margin: 10px 0 15px 0; }
            .title { font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; text-decoration: underline; }
            
            .section { margin-bottom: 12px; }
            .section-title { font-weight: 700; font-size: 12px; color: #1e1b4b; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; display: flex; align-items: center; gap: 8px; }
            
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .field { margin-bottom: 6px; font-size: 13px; display: flex; justify-content: flex-start; gap: 8px; }
            .label { font-weight: 700; color: #000; min-width: 110px; }
            .value { color: #111827; font-weight: 500; }
            
            .termination-box { background: #fff7ed; border: 1px solid #ffedd5; padding: 12px; border-radius: 8px; margin-top: 8px; }
            .reason-text { font-style: italic; color: #9a3412; font-weight: 600; font-size: 14px; white-space: pre-wrap; word-break: break-word; }
            
            .amount-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .amount-table th { text-align: left; padding: 8px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; color: #64748b; }
            .amount-table td { padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            .amount-table .total-row td { background: #1e1b4b; color: #fff; font-weight: 700; font-size: 16px; padding: 12px 8px; }
            
            .legal-statement { margin-top: 25px; font-size: 12px; color: #1f2937; text-align: justify; line-height: 1.6; padding: 15px; border-left: 4px solid #e5e7eb; background: #f9fafb; }
            
            .signatures { margin-top: 25px; display: flex; justify-content: space-between; gap: 30px; }
            .sig-block { flex: 1; }
            .sig-title { font-size: 11px; font-weight: 700; color: #1e1b4b; margin-bottom: 35px; text-transform: uppercase; }
            .sig-line { border-top: 1px solid #000; padding-top: 6px; }
            .sig-name { font-weight: 700; font-size: 12px; color: #0f172a; }
            .sig-role { font-size: 10px; color: #475569; margin-bottom: 2px; }
            .sig-hint { font-size: 9px; color: #94a3b8; font-style: italic; }
            
            .footer-meta { margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 15px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
            
            @media print {
              .no-print { display: none; }
              body { padding: 0; margin: 0; }
              .termination-box { background: #fff7ed !important; -webkit-print-color-adjust: exact; }
              .amount-table th { background: #f8fafc !important; -webkit-print-color-adjust: exact; }
              .amount-table .total-row td { background: #1e1b4b !important; color: #fff !important; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div id="slip-content">
            <div className="header">
              <div className="school-info">
                <h1 className="school-name">${schoolName}</h1>
                <div className="school-sub">DIRECTION DES RESSOURCES HUMAINES</div>
                <div className="school-system">Système de Gestion Éducative EduNova Pro</div>
              </div>
              <div className="doc-type">
                <div className="doc-label">Document Administratif</div>
                <div className="doc-id">Réf: STC-${staff.id.substring(0, 8).toUpperCase()}</div>
                <div className="doc-date">Date: ${new Date().toLocaleDateString('fr-FR')}</div>
              </div>
            </div>

            <div className="title-container">
              <h2 className="title">REÇU POUR SOLDE DE TOUT COMPTE</h2>
            </div>

            <div className="section">
              <div className="section-title">IDENTIFICATION DE L'EMPLOYÉ</div>
              <div className="grid">
                <div>
                  <div className="field"><span className="label">NOM COMPLET:</span> <span className="value">{formatStudentName(staff.last_name, staff.first_name).fullName}</span></div>
                  <div className="field"><span className="label">MATRICULE:</span> <span className="value">${staff.id.substring(0, 8).toUpperCase()}</span></div>
                  <div className="field"><span className="label">FONCTION:</span> <span className="value">${staff.role}</span></div>
                </div>
                <div>
                  <div className="field"><span className="label">NIF / CIN:</span> <span className="value">${staff.nif_cin || '---'}</span></div>
                  <div className="field"><span className="label">CONTRAT:</span> <span className="value">${staff.contract_type}</span></div>
                  <div className="field"><span className="label">DATE DE SORTIE:</span> <span className="value">${terminationDate}</span></div>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="section-title">MOTIF DE LA RUPTURE</div>
              <div className="termination-box">
                <div className="reason-text">« ${staff.termination_details?.reason || 'Non spécifié'} »</div>
              </div>
            </div>

            <div className="section">
              <div className="section-title">DÉCOMPTE FINANCIER</div>
              <table className="amount-table">
                <thead>
                  <tr>
                    <th>Désignation des rubriques</th>
                    <th style="text-align: right;">Montant (HTG)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Salaire de base (Dernière période d'activité)</td>
                    <td style="text-align: right; font-family: monospace;">${(staff.amount || 0).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>Indemnité compensatrice de préavis</td>
                    <td style="text-align: right; font-family: monospace;">${(staff.termination_details?.notice_amount || 0).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>Indemnités de congés payés non pris</td>
                    <td style="text-align: right; font-family: monospace;">0,00</td>
                  </tr>
                  <tr>
                    <td>Primes et gratifications prorata temporis</td>
                    <td style="text-align: right; font-family: monospace;">0,00</td>
                  </tr>
                  <tr className="total-row">
                    <td>NET À PAYER (SOLDE FINAL)</td>
                    <td style="text-align: right;">${((staff.amount || 0) + (staff.termination_details?.notice_amount || 0)).toLocaleString()} HTG</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="legal-statement">
              Je soussigné(e), <strong>{formatStudentName(staff.last_name, staff.first_name).fullName}</strong>, reconnais avoir reçu de la part de l'établissement <strong>${schoolName}</strong>, la somme totale de <strong>${((staff.amount || 0) + (staff.termination_details?.notice_amount || 0)).toLocaleString()} HTG</strong>, par chèque ou virement, pour solde de tout compte. Cette somme m'est versée en paiement des salaires, indemnités de toute nature et accessoires de salaires qui m'étaient dus à la date de la rupture de mon contrat de travail. Je reconnais qu'with ce versement, mon compte est définitivement soldé.
            </div>

            <div className="signatures">
              <div className="sig-block">
                <div className="sig-title">POUR L'ÉTABLISSEMENT</div>
                <div className="sig-line">
                  <div className="sig-name">${currentUser?.full_name || 'Le Directeur'}</div>
                  <div className="sig-role">${currentUser?.role === UserRole.SCHOOL_ADMIN || currentUser?.role === UserRole.DIRECTOR ? 'Directeur / Administrateur' : 'Ressources Humaines'}</div>
                  <div className="sig-hint">(Signature et Cachet)</div>
                </div>
              </div>
              <div className="sig-block">
                <div className="sig-title">L'EMPLOYÉ(E)</div>
                <div className="sig-line">
                  <div className="sig-name">{formatStudentName(staff.last_name, staff.first_name).fullName}</div>
                  <div className="sig-role">${staff.role}</div>
                  <div className="sig-hint">(Précédée de la mention "Lu et approuvé")</div>
                </div>
              </div>
            </div>

            <div className="footer-meta">
              <div>Généré par EduNova Pro ERP - ${new Date().toLocaleString('fr-FR')}</div>
              <div>Page 1 sur 1</div>
            </div>
          </div>
        </body>
      </html>
    `);
    windowPrint.document.close();
  };

  const terminationDate = staff.termination_details?.date 
    ? new Date(staff.termination_details.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.6)] z-[60] flex items-center justify-center p-4">
      <style>{`
        .header { display: flex; flex-direction: column; margin-bottom: 15px; border-bottom: 2px solid #1e1b4b; padding-bottom: 8px; }
        .school-name { font-size: 20px; font-weight: 800; color: #1e1b4b; text-transform: uppercase; }
        .title { font-size: 14px; font-weight: 800; color: #111827; text-transform: uppercase; margin: 15px 0; text-align: center; }
        .section { margin-bottom: 15px; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; gap: 40px; }
        .signature-box { flex: 1; text-align: center; border-top: 1px solid #000; padding-top: 10px; font-weight: 600; font-size: 12px; }
        .legal-text { margin-top: 30px; font-size: 11px; color: #64748b; text-align: justify; line-height: 1.5; }
      `}</style>
      <div ref={modalRef} className="bg-[#ffffff] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col text-[#0f172a]" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between bg-[#f8fafc]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#e0e7ff] text-[#4f46e5] rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-bold text-[#0f172a]">Solde de Tout Compte</h3>
              <p className="text-xs text-[#64748b]">Généré le {new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-[#059669] text-[#ffffff] rounded-lg hover:bg-[#047857] transition-colors text-sm font-medium disabled:opacity-50"
              style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Exporter PDF
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5] text-[#ffffff] rounded-lg hover:bg-[#4338ca] transition-colors text-sm font-medium"
              style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}
            >
              <Printer size={16} />
              Imprimer
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-[#94a3b8] hover:text-[#475569] hover:bg-[#f1f5f9] rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ backgroundColor: '#ffffff', color: '#0f172a' }} ref={printRef} id="slip-content-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1e1b4b', paddingBottom: '8px', marginBottom: '12px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e1b4b', textTransform: 'uppercase', letterSpacing: '-0.025em' }}>{schoolName}</h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#475569', fontWeight: 600 }}>DIRECTION DES RESSOURCES HUMAINES</p>
              <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#64748b' }}>Système de Gestion Éducative EduNova Pro</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Document Administratif</div>
              <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#334155', fontWeight: 600 }}>Réf: STC-{staff.id.substring(0, 8).toUpperCase()}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Date: {new Date().toLocaleDateString('fr-FR')}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '10px 0 15px 0' }}>
            <h2 style={{ margin: 0, display: 'inline-block', fontSize: '14px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', textDecoration: 'underline' }}>
              REÇU POUR SOLDE DE TOUT COMPTE
            </h2>
          </div>

          <div className="section" style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', color: '#1e1b4b', borderBottom: '1px solid #e0e7ff', paddingBottom: '6px', marginBottom: '12px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Informations de l'Employé</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}><span style={{ color: '#0f172a', fontWeight: 'bold', minWidth: '110px' }}>Nom complet:</span> <span style={{ color: '#334155' }}>{formatStudentName(staff.last_name, staff.first_name).fullName}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}><span style={{ color: '#0f172a', fontWeight: 'bold', minWidth: '110px' }}>ID Employé:</span> <span style={{ color: '#334155' }}>{staff.id.substring(0, 8).toUpperCase()}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}><span style={{ color: '#0f172a', fontWeight: 'bold', minWidth: '110px' }}>Poste / Rôle:</span> <span style={{ color: '#334155' }}>{staff.role}</span></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}><span style={{ color: '#0f172a', fontWeight: 'bold', minWidth: '110px' }}>NIF / CIN:</span> <span style={{ color: '#334155' }}>{staff.nif_cin || 'Non renseigné'}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}><span style={{ color: '#0f172a', fontWeight: 'bold', minWidth: '110px' }}>Type de contrat:</span> <span style={{ color: '#334155' }}>{staff.contract_type}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}><span style={{ color: '#0f172a', fontWeight: 'bold', minWidth: '110px' }}>Date de sortie:</span> <span style={{ color: '#334155' }}>{terminationDate}</span></div>
              </div>
            </div>
          </div>

          <div className="section" style={{ marginTop: '15px', marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', color: '#1e1b4b', borderBottom: '1px solid #e0e7ff', paddingBottom: '6px', marginBottom: '8px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Détails du Licenciement</div>
            <div style={{ padding: '12px', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ color: '#9a3412', fontWeight: 'bold', fontSize: '13px' }}>Motif:</span> 
                <span style={{ color: '#431407', fontStyle: 'italic', fontWeight: 500, fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  « {staff.termination_details?.reason || 'Non spécifié'} »
                </span>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', marginTop: '15px' }}>
            <div style={{ fontWeight: 'bold', color: '#1e1b4b', borderBottom: '1px solid #e0e7ff', paddingBottom: '6px', marginBottom: '8px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Décompte des Sommes Dues</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#475569' }}>Salaire de base (Dernière période)</span>
                <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{(staff.amount || 0).toLocaleString()} HTG</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#475569' }}>Indemnité de préavis</span>
                <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{(staff.termination_details?.notice_amount || 0).toLocaleString()} HTG</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                <span>Autres indemnités (Congés, etc.)</span>
                <span style={{ fontFamily: 'monospace' }}>0 HTG</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', marginTop: '8px', borderTop: '2px solid #e2e8f0' }}>
                <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>TOTAL NET À PAYER</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#4f46e5' }}>
                  {((staff.amount || 0) + (staff.termination_details?.notice_amount || 0)).toLocaleString()} HTG
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '15px', fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
            Je soussigné(e) <strong style={{ color: '#0f172a' }}>{formatStudentName(staff.last_name, staff.first_name).fullName}</strong>, reconnais avoir reçu de la part de <strong style={{ color: '#0f172a' }}>{schoolName}</strong>, 
            la somme totale de <strong style={{ color: '#0f172a' }}>{((staff.amount || 0) + (staff.termination_details?.notice_amount || 0)).toLocaleString()} HTG</strong>, 
            pour solde de tout compte, en paiement des salaires, indemnités de toute nature et accessoires de salaires qui m'étaient dus 
            à la date de la rupture de mon contrat de travail.
          </div>

          <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'space-between', gap: '30px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e1b4b', marginBottom: '35px', textTransform: 'uppercase' }}>POUR L'ÉTABLISSEMENT</div>
              <div style={{ borderTop: '1px solid #000', paddingTop: '6px' }}>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>{currentUser?.full_name || 'Le Directeur'}</div>
                <div style={{ fontSize: '10px', color: '#475569', marginBottom: '2px' }}>{currentUser?.role === UserRole.SCHOOL_ADMIN || currentUser?.role === UserRole.DIRECTOR ? 'Directeur / Administrateur' : 'Ressources Humaines'}</div>
                <div style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic' }}>(Signature et Cachet)</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e1b4b', marginBottom: '35px', textTransform: 'uppercase' }}>L'EMPLOYÉ(E)</div>
              <div style={{ borderTop: '1px solid #000', paddingTop: '6px' }}>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>{formatStudentName(staff.last_name, staff.first_name).fullName}</div>
                <div style={{ fontSize: '10px', color: '#475569', marginBottom: '2px' }}>{staff.role}</div>
                <div style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic' }}>(Précédée de la mention "Lu et approuvé")</div>
              </div>
            </div>
          </div>

          <div className="legal-text" style={{ marginTop: '15px', fontSize: '9px', color: '#64748b', textAlign: 'justify', lineHeight: 1.4 }}>
            Ce reçu pour solde de tout compte est établi en deux exemplaires originaux, dont l'un est remis à l'employé. 
            Il peut être dénoncé par l'employé dans un délai de six mois suivant sa signature, par lettre recommandée.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementSlip;
