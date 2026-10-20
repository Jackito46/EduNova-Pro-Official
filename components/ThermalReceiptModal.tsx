import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  MessageSquare, 
  Download, 
  ShieldCheck, 
  QrCode, 
  Eye, 
  FileText,
  Sliders,
  Sparkles,
  Building2,
  Calendar,
  User,
  CreditCard,
  Layers,
  Coins
} from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '../contexts/SchoolContext';
import { generateReceiptQRCode } from '../utils/receiptVerification';

export interface ThermalReceiptData {
  id?: string;
  reference?: string;
  receipt_number?: string;
  created_at?: string | Date;
  date?: string;
  studentName: string;
  studentCode?: string;
  studentClass?: string;
  studentId?: string;
  parentName?: string;
  parentPhone?: string;
  amount: number;
  currency: string;
  feeType: string;
  feeTypeLabel?: string;
  paymentMethod: string;
  cashierName?: string;
  campusName?: string;
  notes?: string;
  status?: string;
  // Financial situation
  totalDue?: number;
  previousPaid?: number;
  remainingAmount?: number;
  globalRemaining?: number;
  walletBalance?: number;
  // Multi-currency details
  exchangeRateApplied?: number;
  convertedAmountHTG?: number;
  originalAmountUSD?: number;
}

export interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ThermalReceiptData | null;
  schoolDetails?: {
    name?: string;
    logo_url?: string;
    address?: string;
    phone?: string;
    slogan?: string;
    campus_name?: string;
  };
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData,
  schoolDetails: customSchoolDetails
}) => {
  const { school, currentCampusId, campuses, terminology } = useSchool();
  
  // Format thermique : 80mm (Standard POS) ou 58mm (Compact Mobile)
  const [thermalFormat, setThermalFormat] = useState<'80mm' | '58mm'>(() => {
    try {
      const saved = localStorage.getItem('edunova_pos_receipt_format');
      return saved === '58mm' ? '58mm' : '80mm';
    } catch {
      return '80mm';
    }
  });

  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSignature, setQrSignature] = useState<string>('');
  const [qrVerificationUrl, setQrVerificationUrl] = useState<string>('');
  const [generatingQr, setGeneratingQr] = useState<boolean>(false);

  // Sauvegarde de la préférence utilisateur de l'imprimante thermique
  const handleFormatChange = (newFormat: '80mm' | '58mm') => {
    setThermalFormat(newFormat);
    try {
      localStorage.setItem('edunova_pos_receipt_format', newFormat);
      toast.info(`Format de ticket réglé sur ${newFormat}`);
    } catch {}
  };

  const activeCampus = useMemo(() => {
    return campuses?.find(c => c.id === currentCampusId);
  }, [campuses, currentCampusId]);

  const schoolDetails = useMemo(() => {
    return {
      name: customSchoolDetails?.name || activeCampus?.name || school?.name || 'ÉTABLISSEMENT SCOLAIRE',
      logo_url: customSchoolDetails?.logo_url || (activeCampus as any)?.logo_url || school?.logo_url,
      address: customSchoolDetails?.address || activeCampus?.address || school?.address,
      phone: customSchoolDetails?.phone || activeCampus?.phone || school?.phone,
      slogan: customSchoolDetails?.slogan || (school as any)?.slogan,
      campus_name: customSchoolDetails?.campus_name || activeCampus?.name
    };
  }, [customSchoolDetails, activeCampus, school]);

  const transactionRef = useMemo(() => {
    if (!receiptData) return 'SANS-REF';
    return receiptData.receipt_number || receiptData.reference || (receiptData.id ? `RCP-${receiptData.id.substring(0, 8).toUpperCase()}` : `RCP-${Date.now().toString().slice(-6)}`);
  }, [receiptData]);

  const formattedDateTime = useMemo(() => {
    if (!receiptData) return { date: '', time: '' };
    const d = receiptData.created_at ? new Date(receiptData.created_at) : new Date();
    return {
      date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
  }, [receiptData]);

  // Génération du QR Code officiel d'authenticité pour le reçu
  useEffect(() => {
    if (!isOpen || !receiptData) return;

    let isMounted = true;
    setGeneratingQr(true);

    generateReceiptQRCode({
      ref: transactionRef,
      studentName: receiptData.studentName || '',
      studentClass: receiptData.studentClass || '',
      amount: receiptData.amount || 0,
      currency: receiptData.currency || 'HTG',
      feeType: receiptData.feeTypeLabel || receiptData.feeType || 'Scolarité',
      date: formattedDateTime.date,
      cashierName: receiptData.cashierName || 'Comptabilité',
      schoolName: schoolDetails.name,
      exchangeRate: receiptData.exchangeRateApplied
    }).then(result => {
      if (isMounted) {
        setQrDataUrl(result.dataUrl);
        setQrSignature(result.signature);
        setQrVerificationUrl(result.url);
        setGeneratingQr(false);
      }
    }).catch(e => {
      console.warn('Erreur génération QR Code Reçu:', e);
      if (isMounted) setGeneratingQr(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, receiptData, transactionRef, formattedDateTime, schoolDetails.name]);

  // Construction du texte brut pour export fichier ou imprimante série
  const rawReceiptText = useMemo(() => {
    if (!receiptData) return '';
    const sep = thermalFormat === '58mm' ? '--------------------------------' : '------------------------------------------';
    const lines = [
      schoolDetails.name.toUpperCase(),
      schoolDetails.campus_name ? `Campus: ${schoolDetails.campus_name}` : null,
      schoolDetails.phone ? `Tels: ${schoolDetails.phone}` : null,
      sep,
      `RECU DE CAISSE OFFICIEL #${transactionRef}`,
      `Date : ${formattedDateTime.date} ${formattedDateTime.time}`,
      `Caissier : ${receiptData.cashierName || 'Comptabilite'}`,
      sep,
      `Eleve : ${receiptData.studentName}`,
      receiptData.studentClass ? `Classe : ${receiptData.studentClass}` : null,
      receiptData.studentCode ? `Matricule : ${receiptData.studentCode}` : null,
      sep,
      `Motif : ${receiptData.feeTypeLabel || receiptData.feeType}`,
      `Mode : ${receiptData.paymentMethod}`,
      sep,
      `NET REGLE : ${Number(receiptData.amount).toLocaleString('fr-FR')} ${receiptData.currency}`,
      receiptData.currency === 'USD' && receiptData.exchangeRateApplied ? `Taux applique : 1 USD = ${receiptData.exchangeRateApplied} HTG` : null,
      receiptData.currency === 'USD' && receiptData.convertedAmountHTG ? `Contre-valeur : ${Number(receiptData.convertedAmountHTG).toLocaleString('fr-FR')} HTG` : null,
      receiptData.currency !== 'USD' && receiptData.originalAmountUSD && receiptData.exchangeRateApplied ? `Bareme en USD : $${receiptData.originalAmountUSD} USD (Taux: ${receiptData.exchangeRateApplied} HTG)` : null,
      receiptData.notes ? `Note : ${receiptData.notes}` : null,
      receiptData.remainingAmount !== undefined ? `Reste sur ce motif : ${Number(receiptData.remainingAmount).toLocaleString('fr-FR')} ${receiptData.currency}` : null,
      receiptData.globalRemaining !== undefined ? `Solde total session : ${Number(receiptData.globalRemaining).toLocaleString('fr-FR')} HTG` : null,
      sep,
      `Sign. Caissier : ${receiptData.cashierName || 'Direction'}`,
      `Signature Securisee : ${qrSignature || `EDN-${transactionRef}`}`,
      `Controle : ${qrVerificationUrl || 'https://edunova.app'}`,
      sep,
      `Merci pour votre confiance !`,
      `Conservez precieusement ce recu.`,
      '\n\n\n'
    ];
    return lines.filter(Boolean).join('\n');
  }, [receiptData, thermalFormat, schoolDetails, transactionRef, formattedDateTime, qrSignature, qrVerificationUrl]);

  // Impression native déclenchée
  const handlePrint = () => {
    window.print();
  };

  // Copier le texte du ticket
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(rawReceiptText);
      setCopiedText(true);
      toast.success('Texte du ticket copié dans le presse-papier !');
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      toast.error('Impossible de copier le texte.');
    }
  };

  // Télécharger le ticket texte pour imprimantes directes
  const handleDownloadTxt = () => {
    try {
      const blob = new Blob([rawReceiptText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ticket_${thermalFormat}_${transactionRef}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Fichier ticket (${thermalFormat}) téléchargé.`);
    } catch {
      toast.error('Erreur lors du téléchargement.');
    }
  };

  // Partager via WhatsApp
  const handleShareWhatsApp = () => {
    const parentPhone = receiptData?.parentPhone || '';
    const cleanPhone = parentPhone.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(
      `🎓 *${schoolDetails.name}*\n` +
      `Bonjour, voici le reçu officiel de versement pour *${receiptData?.studentName}* (${receiptData?.studentClass || 'Classe'}).\n\n` +
      `📄 *Reçu N° :* #${transactionRef}\n` +
      `💰 *Montant :* ${Number(receiptData?.amount || 0).toLocaleString('fr-FR')} ${receiptData?.currency}\n` +
      `🏷️ *Motif :* ${receiptData?.feeTypeLabel || receiptData?.feeType}\n` +
      `📅 *Date :* ${formattedDateTime.date}\n` +
      (receiptData?.remainingAmount !== undefined ? `⚖️ *Reste motif :* ${Number(receiptData.remainingAmount).toLocaleString('fr-FR')} ${receiptData.currency}\n` : '') +
      `🔒 *Vérification officielle :* ${qrVerificationUrl}\n\n` +
      `_EduNova Pro • Économat certifié_`
    );
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${message}` : `https://wa.me/?text=${message}`;
    window.open(waUrl, '_blank');
  };

  if (!isOpen || !receiptData) return null;

  const is58mm = thermalFormat === '58mm';
  const widthClass = is58mm ? 'w-[58mm] max-w-[58mm]' : 'w-[80mm] max-w-[80mm]';
  const textScaleClass = is58mm ? 'text-[8.5px]' : 'text-[9.5px]';

  return (
    <>
      {/* MODAL CONTAINER FLUIDE AVEC BACKDROP BLUR */}
      <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:hidden animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[96vh]">
          
          {/* HEADER MODAL AVEC SÉLECTEUR DE FORMAT THERMIQUE 58MM / 80MM */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-4 sm:p-5 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
                <Printer size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white tracking-tight">Reçu de Caisse Thermique</h2>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">
                    POS Ready
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  #{transactionRef} • {receiptData.studentName}
                </p>
              </div>
            </div>

            {/* SÉLECTEUR DE LARGEUR DE TICKET 58MM VS 80MM */}
            <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={() => handleFormatChange('80mm')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  thermalFormat === '80mm'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
                title="Format Standard POS (Epson TM-T20, Star Micronics, Bixolon, 80mm)"
              >
                <span>80 mm</span>
                <span className="text-[9px] opacity-75 font-normal hidden sm:inline">(Standard)</span>
              </button>

              <button
                type="button"
                onClick={() => handleFormatChange('58mm')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  thermalFormat === '58mm'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
                title="Format Compact (Imprimantes Bluetooth portables, caisse 58mm)"
              >
                <span>58 mm</span>
                <span className="text-[9px] opacity-75 font-normal hidden sm:inline">(Compact)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer ml-auto sm:ml-0"
              title="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          {/* ZONE D'APERÇU DU TICKET THERMIQUE (SCROLLABLE) */}
          <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100/80 flex-1 flex flex-col items-center justify-start min-h-0">
            
            {/* BARRE D'INDICATIONS TECHNIQUES AU-DESSUS DU TICKET */}
            <div className={`${widthClass} transition-all duration-200 flex items-center justify-between text-[11px] font-bold text-slate-500 mb-2 px-1`}>
              <span className="flex items-center gap-1.5 text-slate-700">
                <Eye size={12} className="text-indigo-600" />
                <span>Aperçu Réel Ticket {thermalFormat}</span>
              </span>
              <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-600 font-mono">
                {is58mm ? '58mm (32 col)' : '80mm (48 col)'}
              </span>
            </div>

            {/* FEUILLE DU TICKET THERMIQUE (SIMULATION HAUTE FIDÉLITÉ) */}
            <div
              className={`bg-white ${is58mm ? 'p-3' : 'p-4 sm:p-6'} ${widthClass} transition-all duration-200 shadow-xl rounded-2xl border border-slate-300 text-black font-sans leading-tight flex flex-col relative select-text`}
            >
              {/* Ligne de découpe supérieure */}
              <div className="w-full flex justify-between items-center opacity-30 text-[6px] tracking-[0.25em] mb-2 font-mono select-none" aria-hidden="true">
                <span>• • • • • • • • • • • • • • • • • • • • • • • • • •</span>
              </div>

              {/* EN-TÊTE ÉTABLISSEMENT */}
              <div className="w-full text-center border-b-2 border-black pb-2 mb-2.5">
                {schoolDetails.logo_url && (
                  <img
                    src={schoolDetails.logo_url}
                    alt="Logo"
                    className={`${is58mm ? 'h-10' : 'h-13'} mx-auto mb-1.5 object-contain grayscale contrast-150`}
                    referrerPolicy="no-referrer"
                  />
                )}
                <h1 className={`${is58mm ? 'text-[11px]' : 'text-[13px]'} font-black uppercase leading-tight tracking-tight text-black`}>
                  {schoolDetails.name}
                </h1>
                {schoolDetails.campus_name && (
                  <p className={`${is58mm ? 'text-[8.5px]' : 'text-[9.5px]'} font-black uppercase tracking-wider text-black mt-0.5`}>
                    Annexe / Campus : {schoolDetails.campus_name}
                  </p>
                )}
                <div className={`${is58mm ? 'text-[7.5px]' : 'text-[8.5px]'} font-bold text-gray-700 italic mt-0.5 space-y-0.5`}>
                  {schoolDetails.address && <p>{schoolDetails.address}</p>}
                  {schoolDetails.phone && <p>Téls: {schoolDetails.phone}</p>}
                </div>
              </div>

              {/* TITRE DU REÇU AVEC RÉFÉRENCE ET CODE-BARRES */}
              <div className="w-full text-center mb-2.5 py-1.5 bg-gray-100 rounded border border-gray-300">
                <h2 className={`${is58mm ? 'text-[10.5px]' : 'text-[12px]'} font-black tracking-widest uppercase text-black`}>
                  REÇU DE CAISSE OFFICIEL
                </h2>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className={`${is58mm ? 'text-[8.5px]' : 'text-[9.5px]'} font-black font-mono`}>
                    #{transactionRef}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(transactionRef);
                      setCopiedRef(true);
                      setTimeout(() => setCopiedRef(false), 2000);
                      toast.success('Référence copiée !');
                    }}
                    className="p-0.5 hover:bg-gray-200 rounded text-gray-600 transition-colors cursor-pointer"
                    title="Copier la référence"
                  >
                    {copiedRef ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                  </button>
                </div>
                {/* Pattern code-barres thermique stylisé */}
                <div className="w-28 mx-auto my-1 flex justify-center items-center gap-[1.5px] opacity-85 h-2.5 overflow-hidden select-none" aria-hidden="true">
                  {[1, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2].map((w, idx) => (
                    <span key={idx} className="h-full bg-black block" style={{ width: `${w}px` }} />
                  ))}
                </div>
              </div>

              {/* INFOS TRANSACTION & ÉLÈVE */}
              <div className={`w-full grid grid-cols-2 gap-1.5 ${is58mm ? 'text-[8px]' : 'text-[9px]'} mb-2.5 border-b border-black pb-2`}>
                <div className="space-y-0.5">
                  <div>
                    <p className="text-[7px] uppercase font-black text-gray-500">Date & Heure</p>
                    <p className="font-bold leading-none">{formattedDateTime.date} {formattedDateTime.time}</p>
                  </div>
                  <div>
                    <p className="text-[7px] uppercase font-black text-gray-500">Caissier</p>
                    <p className="font-bold leading-none">{receiptData.cashierName || 'Comptabilité'}</p>
                  </div>
                </div>
                <div className="space-y-0.5 text-right border-l border-gray-200 pl-1.5">
                  <div>
                    <p className="text-[7px] uppercase font-black text-gray-500">{terminology.student}</p>
                    <p className={`${is58mm ? 'text-[9px]' : 'text-[10px]'} font-black leading-tight truncate`} title={receiptData.studentName}>
                      {receiptData.studentName}
                    </p>
                    {receiptData.studentClass && (
                      <p className="text-[7.5px] font-bold text-gray-600 italic">{receiptData.studentClass}</p>
                    )}
                    {receiptData.studentCode && (
                      <p className="text-[7px] font-mono text-gray-500">Mat: {receiptData.studentCode}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* NATURE DU FRAIS & MODE DE PAIEMENT */}
              <div className={`w-full ${is58mm ? 'text-[8px]' : 'text-[9px]'} mb-2.5 space-y-1 border-b border-dashed border-gray-400 pb-2`}>
                <div className="flex justify-between items-start py-0.5">
                  <span className="font-bold uppercase text-gray-600 shrink-0">Type de Frais :</span>
                  <span className={`${is58mm ? 'text-[9.5px]' : 'text-[10.5px]'} font-black text-right text-black uppercase pl-2`}>
                    {receiptData.feeTypeLabel || receiptData.feeType}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="font-bold uppercase text-gray-600">Mode de Règlement :</span>
                  <span className="font-black text-[9.5px] text-black uppercase">{receiptData.paymentMethod}</span>
                </div>
                {receiptData.notes && (
                  <div className="flex justify-between items-start py-0.5 text-[7.5px] italic text-gray-700">
                    <span className="font-semibold uppercase text-gray-500 shrink-0">Précision :</span>
                    <span className="text-right truncate pl-2 font-medium">{receiptData.notes}</span>
                  </div>
                )}
                {receiptData.status && (
                  <div className="flex justify-between items-center py-0.5 text-[7.5px]">
                    <span className="font-semibold uppercase text-gray-500">Statut Comptable :</span>
                    <span className="font-bold text-black uppercase">
                      {receiptData.status === 'ANNULE' ? 'ANNULÉ' : 'CERTIFIÉ CONFORME'}
                    </span>
                  </div>
                )}
              </div>

              {/* SITUATION FINANCIÈRE SI DISPONIBLE */}
              {(receiptData.totalDue !== undefined || receiptData.previousPaid !== undefined) && (
                <div className={`w-full space-y-0.5 ${is58mm ? 'text-[8px]' : 'text-[8.5px]'} mb-2.5 bg-gray-50 p-1.5 rounded border border-gray-200`}>
                  {receiptData.totalDue !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-600">Total Dû (Engagement) :</span>
                      <span className="font-bold">{Number(receiptData.totalDue).toLocaleString('fr-FR')} {receiptData.currency}</span>
                    </div>
                  )}
                  {receiptData.previousPaid !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-600">Déjà Versé :</span>
                      <span className="font-bold">{Number(receiptData.previousPaid).toLocaleString('fr-FR')} {receiptData.currency}</span>
                    </div>
                  )}
                </div>
              )}

              {/* BOÎTE NET PERÇU / MONTANT ENCAISSÉ */}
              <div className="w-full border-2 border-black rounded-lg p-2 mb-2.5 text-center bg-gray-50 text-black">
                <p className="text-[7.5px] font-black uppercase tracking-wider text-gray-700">Net Perçu (Montant Encaissé)</p>
                <p className={`${is58mm ? 'text-[15px]' : 'text-[17px]'} font-black tracking-tight leading-none mt-1 text-black font-mono`}>
                  {Number(receiptData.amount).toLocaleString('fr-FR')} <span className="text-[10px] font-bold">{receiptData.currency}</span>
                </p>

                {/* DÉTAILS DU TAUX DE CHANGE SI USD OU DOUBLE MONNAIE */}
                {receiptData.currency === 'USD' && receiptData.exchangeRateApplied && (
                  <div className="mt-1.5 pt-1.5 border-t border-black/20 text-left space-y-0.5 bg-white p-1.5 rounded text-[7.5px]">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-gray-700">Taux appliqué :</span>
                      <span className="font-mono bg-black text-white px-1 py-0.2 rounded text-[7px] font-black">
                        1 USD = {receiptData.exchangeRateApplied} HTG
                      </span>
                    </div>
                    {receiptData.convertedAmountHTG && (
                      <div className="flex justify-between items-center font-black text-black border-t border-dashed border-gray-300 pt-0.5">
                        <span>Contre-valeur Gourdes :</span>
                        <span className="font-mono">{Number(receiptData.convertedAmountHTG).toLocaleString('fr-FR')} HTG</span>
                      </div>
                    )}
                  </div>
                )}

                {/* DÉTAILS SI PAIEMENT EN GOURDES AVEC BARÈME USD */}
                {receiptData.currency !== 'USD' && receiptData.originalAmountUSD && receiptData.originalAmountUSD > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-black/20 text-left space-y-0.5 bg-white p-1.5 rounded text-[7.5px]">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-gray-700">Barème fixé en Dollars :</span>
                      <span className="font-mono font-black text-black">${receiptData.originalAmountUSD} USD</span>
                    </div>
                    {receiptData.exchangeRateApplied && (
                      <div className="flex justify-between items-center text-gray-700">
                        <span>Taux appliqué :</span>
                        <span className="font-mono font-bold">1 USD = {receiptData.exchangeRateApplied} HTG</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RESTE À PAYER ET SOLDE */}
              {(receiptData.remainingAmount !== undefined || receiptData.globalRemaining !== undefined) && (
                <div className={`w-full space-y-0.5 ${is58mm ? 'text-[8px]' : 'text-[8.5px]'} mb-2.5 border-b border-black pb-1.5`}>
                  {receiptData.remainingAmount !== undefined && (
                    <div className="flex justify-between items-center font-bold">
                      <span>Reste sur Motif :</span>
                      <span className="text-[9.5px] font-black font-mono">
                        {Number(receiptData.remainingAmount).toLocaleString('fr-FR')} {receiptData.currency}
                      </span>
                    </div>
                  )}
                  {receiptData.globalRemaining !== undefined && (
                    <div className="flex justify-between items-center text-[7.5px] text-gray-600 italic">
                      <span>Solde Global (Session) :</span>
                      <span className="font-bold font-mono">
                        {Number(receiptData.globalRemaining).toLocaleString('fr-FR')} HTG
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* QR CODE SÉCURISÉ D'AUTHENTICITÉ SCANNABLE */}
              <div className="w-full my-2 p-1.5 bg-gray-50 rounded border border-black/30 text-center flex flex-col items-center justify-center">
                <div className="bg-white p-1 rounded border border-black/40 mb-1 inline-block">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Code d'Authenticité"
                      className={`${is58mm ? 'w-20 h-20' : 'w-24 h-24'} object-contain mx-auto block`}
                    />
                  ) : (
                    <div className={`${is58mm ? 'w-20 h-20' : 'w-24 h-24'} flex items-center justify-center bg-gray-100`}>
                      <QrCode size={24} className="text-gray-400" />
                    </div>
                  )}
                </div>
                <p className="text-[7px] font-black uppercase tracking-wider text-black">
                  Scan Rapide • Vérification d'Authenticité
                </p>
                <p className="text-[6.5px] font-mono font-bold text-gray-800 mt-0.5">
                  Scellé : {qrSignature || `EDN-${transactionRef}`}
                </p>
                <p className="text-[6px] text-gray-600 italic mt-0.5">
                  Scannez avec votre smartphone pour attester de la validité
                </p>
              </div>

              {/* SIGNATURE & CACHET NUMÉRIQUE */}
              <div className="w-full text-center space-y-1.5 mt-1">
                <div className="w-3/4 mx-auto space-y-0.5 pt-1">
                  <div className="h-5 border-b border-black"></div>
                  <p className="text-[6.5px] font-black uppercase tracking-widest text-slate-800">
                    Sign. Caissier : {receiptData.cashierName || 'Direction'}
                  </p>
                </div>

                <div className="py-0.5 px-1.5 border border-black/30 rounded bg-gray-50 text-[6.5px] font-bold text-gray-700">
                  ✓ Scellé Certifié par EduNova Pro • Conservez ce reçu précieux
                </div>
              </div>

              {/* BUFFER MARGE DE COUPE (AUTO-CUTTER EPSON / STAR) */}
              <div className="w-full pt-2 mt-2 border-t border-dashed border-gray-400 text-center">
                <p className="text-[6.5px] font-black uppercase tracking-[0.2em] opacity-60 text-gray-500 select-none">
                  - - - MARGE DE COUPE POS - - -
                </p>
                <div className="h-4"></div>
              </div>
            </div>
          </div>

          {/* FOOTER ACTIONS MODAL : IMPRIMER, WHATSAPP, COPIER, TÉLÉCHARGER */}
          <div className="bg-slate-50 px-4 sm:px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Partager WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Partager le reçu directement au parent via WhatsApp"
              >
                <MessageSquare size={14} className="text-emerald-600" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              {/* Copier le texte */}
              <button
                type="button"
                onClick={handleCopyText}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Copier le texte du ticket"
              >
                {copiedText ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span className="hidden sm:inline">Copier</span>
              </button>

              {/* Télécharger TXT */}
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Télécharger fichier ticket texte (compatible ESC/POS)"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Fichier TXT</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Fermer
              </button>

              {/* BOUTON D'ACTION PRINCIPAL : IMPRIMER DIRECTEMENT LE TICKET */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 hover:from-slate-900 hover:to-indigo-900 text-white rounded-xl font-black text-xs sm:text-sm shadow-xl shadow-slate-950/20 transition-all flex items-center gap-2 cursor-pointer ring-2 ring-indigo-500/40 active:scale-95"
                title={`Lancer l'impression directe sur imprimante ${thermalFormat}`}
              >
                <Printer size={15} />
                <span>Imprimer ({thermalFormat})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DEDICATED PRINT ELEMENT FOR THERMAL PRINTERS (58MM & 80MM) */}
      <div
        id="thermal-pos-modal-receipt"
        className="hidden print:flex bg-white text-black font-mono leading-tight flex-col border-none shadow-none"
        style={{
          width: is58mm ? '54mm' : '76mm',
          maxWidth: is58mm ? '54mm' : '76mm',
          padding: '1.5mm',
          margin: '0 auto',
          fontSize: is58mm ? '8.5px' : '10px',
          color: '#000000',
          backgroundColor: '#ffffff'
        }}
      >
        {/* Header */}
        <div className="w-full text-center border-b-2 border-black pb-1.5 mb-1.5">
          {schoolDetails.logo_url && (
            <img
              src={schoolDetails.logo_url}
              alt="Logo"
              className={`${is58mm ? 'h-9' : 'h-12'} mx-auto mb-1 object-contain grayscale contrast-200`}
              referrerPolicy="no-referrer"
            />
          )}
          <h1 className={`${is58mm ? 'text-[10px]' : 'text-[12px]'} font-black uppercase leading-tight mb-0.5`}>
            {schoolDetails.name}
          </h1>
          {schoolDetails.campus_name && (
            <p className="text-[7.5px] uppercase font-black">Campus: {schoolDetails.campus_name}</p>
          )}
          <div className="text-[7.5px] font-bold space-y-0 text-black">
            {schoolDetails.address && <p>{schoolDetails.address}</p>}
            {schoolDetails.phone && <p>Téls: {schoolDetails.phone}</p>}
          </div>
        </div>

        {/* Title */}
        <div className="w-full text-center mb-1.5 py-1 bg-gray-100 rounded border border-black">
          <h2 className={`${is58mm ? 'text-[9.5px]' : 'text-[11px]'} font-black tracking-widest uppercase`}>
            REÇU DE CAISSE OFFICIEL
          </h2>
          <p className="text-[8px] font-bold mt-0.5">#{transactionRef}</p>
        </div>

        {/* Metadata */}
        <div className={`w-full grid grid-cols-2 gap-1 text-[7.5px] mb-1.5 border-b border-black pb-1`}>
          <div>
            <p className="font-bold">{formattedDateTime.date} {formattedDateTime.time}</p>
            <p className="font-semibold">Caissier: {receiptData.cashierName || 'Comptabilité'}</p>
          </div>
          <div className="text-right border-l border-gray-300 pl-1">
            <p className="font-black truncate">{receiptData.studentName}</p>
            {receiptData.studentClass && <p className="italic">{receiptData.studentClass}</p>}
            {receiptData.studentCode && <p className="font-mono">Mat: {receiptData.studentCode}</p>}
          </div>
        </div>

        {/* Fee & Method */}
        <div className="w-full text-[8px] mb-1.5 border-b border-dashed border-black pb-1 space-y-0.5">
          <div className="flex justify-between">
            <span className="font-bold uppercase">Motif :</span>
            <span className="font-black uppercase text-right truncate pl-1">{receiptData.feeTypeLabel || receiptData.feeType}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold uppercase">Mode :</span>
            <span className="font-black uppercase">{receiptData.paymentMethod}</span>
          </div>
          {receiptData.notes && (
            <div className="flex justify-between text-[6.5px] italic">
              <span className="font-medium uppercase">Précision :</span>
              <span className="truncate pl-1">{receiptData.notes}</span>
            </div>
          )}
        </div>

        {/* Net Perçu */}
        <div className="w-full border-2 border-black rounded p-1 mb-1.5 text-center bg-gray-50 text-black">
          <p className="text-[7px] font-black uppercase">Net Perçu</p>
          <p className={`${is58mm ? 'text-[13px]' : 'text-[15px]'} font-black tracking-tight leading-none mt-0.5 font-mono text-black`}>
            {Number(receiptData.amount).toLocaleString('fr-FR')} {receiptData.currency}
          </p>
          {receiptData.currency === 'USD' && receiptData.exchangeRateApplied && (
            <p className="text-[6.5px] font-bold mt-0.5">
              Taux: 1 USD = {receiptData.exchangeRateApplied} HTG
              {receiptData.convertedAmountHTG ? ` (Eq: ${Number(receiptData.convertedAmountHTG).toLocaleString('fr-FR')} HTG)` : ''}
            </p>
          )}
          {receiptData.currency !== 'USD' && receiptData.originalAmountUSD && receiptData.originalAmountUSD > 0 && (
            <p className="text-[6.5px] font-bold mt-0.5">
              Barème: ${receiptData.originalAmountUSD} USD {receiptData.exchangeRateApplied ? `(@${receiptData.exchangeRateApplied} HTG)` : ''}
            </p>
          )}
        </div>

        {/* Solde & Reste */}
        {(receiptData.remainingAmount !== undefined || receiptData.globalRemaining !== undefined) && (
          <div className="w-full text-[7.5px] mb-1.5 border-b border-black pb-1 space-y-0.5">
            {receiptData.remainingAmount !== undefined && (
              <div className="flex justify-between font-bold">
                <span>Reste Motif :</span>
                <span className="font-mono">{Number(receiptData.remainingAmount).toLocaleString('fr-FR')} {receiptData.currency}</span>
              </div>
            )}
            {receiptData.globalRemaining !== undefined && (
              <div className="flex justify-between text-gray-700">
                <span>Solde Global :</span>
                <span className="font-mono">{Number(receiptData.globalRemaining).toLocaleString('fr-FR')} HTG</span>
              </div>
            )}
          </div>
        )}

        {/* QR Code */}
        {qrDataUrl && (
          <div className="w-full flex flex-col items-center justify-center my-1">
            <img
              src={qrDataUrl}
              alt="QR Code"
              className={`${is58mm ? 'w-16 h-16' : 'w-20 h-20'} object-contain mx-auto block`}
            />
            <p className="text-[6px] font-mono mt-0.5">Scellé: {qrSignature || transactionRef}</p>
          </div>
        )}

        {/* Signature & Note */}
        <div className="w-full text-center space-y-1 mt-1">
          <div className="w-3/4 mx-auto pt-0.5">
            <div className="h-5 border-b border-black"></div>
            <p className="text-[6.5px] font-black uppercase tracking-widest">
              Sign. Caissier: {receiptData.cashierName || 'Comptabilité'}
            </p>
          </div>
          <p className="text-[6.5px] font-bold italic pt-0.5 border-t border-black text-center text-gray-800">
            Conservez ce reçu précieux pour toute réclamation.
          </p>
        </div>

        {/* Bottom Feed / Margin (15mm) */}
        <div className="w-full h-6 text-center text-[6px] text-gray-400 pt-1">
          - - - - - - - - - - - - - -
        </div>
      </div>

      {/* STYLES D'IMPRESSION DÉDIÉS AUX IMPRIMANTES THERMIQUES POS (58MM & 80MM) */}
      <style>{`
        @media print {
          @page {
            size: ${is58mm ? '58mm auto' : '80mm auto'};
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-pos-modal-receipt, #thermal-pos-modal-receipt * {
            visibility: visible !important;
          }
          #thermal-pos-modal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${is58mm ? '54mm' : '76mm'} !important;
            max-width: ${is58mm ? '54mm' : '76mm'} !important;
            margin: 0 auto !important;
            padding: 2mm !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace, sans-serif !important;
            color: #000000 !important;
            background-color: #ffffff !important;
            display: flex !important;
            flex-direction: column !important;
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `}</style>
    </>
  );
};
