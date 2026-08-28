import React, { useState, useMemo, useRef } from 'react';
import { 
  Printer, CheckCircle2, Share2, Copy, Check, 
  Download, MessageSquare, Plus, X, FileText, 
  Receipt, Calendar, Clock, User, CreditCard, 
  ArrowLeft, Sparkles, ShieldCheck, QrCode, 
  Building, ExternalLink, Store, Tag, BadgeCheck, 
  Landmark, Layers, Eye, Smartphone, CheckCheck,
  Scissors, Barcode as BarcodeIcon, DollarSign,
  ChevronRight, RefreshCw, SmartphoneNfc
} from 'lucide-react';
import { toast } from 'sonner';
import { formatStudentName } from '../utils/formatters';

export interface SaleReceiptItem {
  id?: string;
  catalog_item_id?: string;
  label?: string;
  description?: string;
  unit_price: number;
  quantity: number;
  currency?: string;
  unit_measure?: string;
  is_deferred?: boolean;
  category?: string;
  total_amount?: number;
}

export interface ModernSaleReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewSale?: () => void;
  transactionRef: string;
  created_at?: string | Date;
  student?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    effectiveClassName?: string;
    class?: { name?: string };
    classes?: { name?: string };
  } | null;
  items: SaleReceiptItem[];
  totalAmount: number;
  currency?: 'HTG' | 'USD';
  paymentMethod?: string;
  bankName?: string;
  referenceNumber?: string;
  cashierName?: string;
  schoolDetails?: {
    name?: string;
    address?: string;
    phone?: string;
    logo_url?: string;
    email?: string;
    slogan?: string;
  } | null;
  academicYearLabel?: string;
  exchangeRate?: number;
  amountReceived?: number;
  changeDue?: number;
}

// Generate realistic SVG Barcode for Epson thermal crisp reproduction
const ThermalBarcodeSVG: React.FC<{ code: string }> = ({ code }) => {
  const cleanCode = (code || 'POS-000000').toUpperCase();
  // Generate consistent bar widths based on code characters
  const bars = useMemo(() => {
    let pattern = [2, 1, 1, 2, 1, 2, 2, 1, 1, 2];
    for (let i = 0; i < cleanCode.length; i++) {
      const charCode = cleanCode.charCodeAt(i);
      pattern.push((charCode % 3) + 1, ((charCode * 2) % 3) + 1, (charCode % 2) + 1);
    }
    pattern.push(2, 1, 1, 2, 1, 2);
    return pattern;
  }, [cleanCode]);

  let currentX = 10;
  return (
    <div className="flex flex-col items-center justify-center my-1.5 w-full">
      <svg className="h-10 w-full max-w-[200px]" viewBox="0 0 220 40" xmlns="http://www.w3.org/2000/svg">
        <rect width="220" height="40" fill="#ffffff" />
        {bars.map((width, idx) => {
          const isBar = idx % 2 === 0;
          const x = currentX;
          currentX += width * 2.2;
          if (x > 210) return null;
          return isBar ? (
            <rect key={idx} x={x} y="2" width={width * 2} height="32" fill="#000000" />
          ) : null;
        })}
      </svg>
      <span className="font-mono text-[9px] tracking-widest font-black text-black uppercase mt-0.5">
        *{cleanCode}*
      </span>
    </div>
  );
};

export const ModernSaleReceiptModal: React.FC<ModernSaleReceiptModalProps> = ({
  isOpen,
  onClose,
  onNewSale,
  transactionRef,
  created_at = new Date(),
  student,
  items = [],
  totalAmount = 0,
  currency = 'HTG',
  paymentMethod = 'Cash',
  bankName,
  referenceNumber,
  cashierName,
  schoolDetails,
  academicYearLabel,
  exchangeRate,
  amountReceived,
  changeDue
}) => {
  // Default directly to 'thermal' as requested for Epson 80mm printer focus
  const [activeTab, setActiveTab] = useState<'thermal' | 'card' | 'invoice'>('thermal');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const dateObj = useMemo(() => {
    return created_at instanceof Date ? created_at : new Date(created_at);
  }, [created_at]);

  const formattedDate = dateObj.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const formattedTime = dateObj.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const studentName = student 
    ? formatStudentName(student.last_name, student.first_name).fullName 
    : 'Client Passant / Vente Libre';

  const studentClass = student?.effectiveClassName || 
    student?.class?.name || 
    student?.classes?.name || 
    'Vente Directe';

  const totalQuantity = items.reduce((acc, it) => acc + (it.quantity || 1), 0);

  // Generate plain text summary for copying and WhatsApp sharing
  const receiptText = useMemo(() => {
    const schoolName = schoolDetails?.name || 'Institution Scolaire';
    const lines = [
      `🏫 *${schoolName.toUpperCase()}*`,
      `📄 *REÇU DE VENTE & FOURNITURES*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🔖 *Ticket N° :* #${transactionRef}`,
      `📅 *Date :* ${formattedDate} à ${formattedTime}`,
      `👤 *Acheteur / Élève :* ${studentName}`,
      `🎓 *Classe :* ${studentClass}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🛒 *ARTICLES ACHETÉS :*`,
      ...items.map(item => {
        const itemLabel = item.label || item.description || 'Article';
        const qty = item.quantity || 1;
        const measure = item.unit_measure ? ` ${item.unit_measure}` : '';
        const itemTotal = (item.total_amount || (item.unit_price * qty)).toLocaleString();
        const deferredTag = item.is_deferred ? ' ⚠️ (Livraison différée)' : '';
        return `• ${qty}${measure}x ${itemLabel} : ${itemTotal} ${item.currency || currency}${deferredTag}`;
      }),
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💰 *NET TOTAL PERÇU :* ${totalAmount.toLocaleString()} ${currency}`,
      `💳 *Mode Règlement :* ${paymentMethod}${bankName ? ` (${bankName})` : ''}`,
      `✍️ *Caissier :* ${cashierName || 'Boutique'}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `_Conservez ce reçu pour toute réclamation. Merci !_`
    ];
    return lines.join('\n');
  }, [schoolDetails, transactionRef, formattedDate, formattedTime, studentName, studentClass, items, totalAmount, currency, paymentMethod, bankName, cashierName]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(receiptText);
      setCopied(true);
      toast.success("Reçu copié dans le presse-papier !");
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      toast.error("Impossible de copier le reçu.");
    }
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(receiptText)}`;
    window.open(url, '_blank');
  };

  const handleDownloadTxt = () => {
    const element = document.createElement("a");
    const file = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `Recu_Vente_Epson80mm_${transactionRef}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Fichier ticket téléchargé !");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* SCREEN MODAL DIALOG */}
      <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto print:hidden animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-2xl w-full max-h-[94vh] flex flex-col border border-slate-200/90 my-auto transition-all">
          
          {/* TOP MODERN DARK BANNER */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-5 relative overflow-hidden shrink-0 border-b border-slate-800">
            {/* Ambient Background Accents */}
            <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 transform -translate-x-8 translate-y-8 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="relative z-10 flex items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-emerald-500/20 shrink-0">
                  <Printer size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Prêt pour Impression Epson 80mm
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {formattedDate} • {formattedTime}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5 flex items-center gap-2">
                    <span>Fiche de Vente & Reçu</span>
                    {academicYearLabel && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {academicYearLabel}
                      </span>
                    )}
                  </h2>
                </div>
              </div>

              {/* Close Icon */}
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Metadata summary strip */}
            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 text-[11px]">
              <div className="bg-white/5 rounded-xl p-2 border border-white/10">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Ticket N°</span>
                <span className="font-mono font-black text-emerald-400 truncate block">#{transactionRef}</span>
              </div>
              <div className="bg-white/5 rounded-xl p-2 border border-white/10">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Élève / Acheteur</span>
                <span className="font-black text-white truncate block">{studentName}</span>
              </div>
              <div className="bg-white/5 rounded-xl p-2 border border-white/10">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Règlement</span>
                <span className="font-bold text-slate-200 truncate block">{paymentMethod}</span>
              </div>
              <div className="bg-white/5 rounded-xl p-2 border border-white/10 text-right">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Net Encaissé</span>
                <span className="font-mono font-black text-emerald-300 block">{totalAmount.toLocaleString()} {currency}</span>
              </div>
            </div>

            {/* FORMAT / VIEW MODE TABS (SOUPLESSE) */}
            <div className="relative z-10 flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/10 flex-wrap">
              <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveTab('thermal')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    activeTab === 'thermal'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone size={13} />
                  <span>Ticket Epson 80mm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('card')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    activeTab === 'card'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye size={13} />
                  <span>Vue Écran</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('invoice')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    activeTab === 'invoice'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText size={13} />
                  <span>Facture A4</span>
                </button>
              </div>

              {/* Utility Quick Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleWhatsApp}
                  title="Partager sur WhatsApp"
                  className="p-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl border border-emerald-500/30 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                >
                  <MessageSquare size={13} />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>

                <button
                  onClick={handleCopy}
                  title="Copier le récapitulatif"
                  className="p-1.5 sm:px-2.5 sm:py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl border border-white/10 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                >
                  {copied ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span className="hidden sm:inline">{copied ? 'Copié' : 'Copier'}</span>
                </button>

                <button
                  onClick={handleDownloadTxt}
                  title="Télécharger fichier ticket"
                  className="p-1.5 sm:px-2.5 sm:py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl border border-white/10 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Ticket TXT</span>
                </button>
              </div>
            </div>
          </div>

          {/* TAB 1: THERMAL RECEIPT 80MM (DEFAULT & HIGHLY POLISHED FOR EPSON) */}
          {activeTab === 'thermal' && (
            <div className="p-4 sm:p-6 bg-slate-200/70 overflow-y-auto flex-1 flex flex-col items-center justify-start">
              
              {/* EPSON 80MM THERMAL PAPER SIMULATOR CONTAINER */}
              <div className="w-full max-w-[360px] bg-white text-black font-mono text-[11px] leading-tight shadow-2xl border border-slate-300 rounded-2xl p-4 sm:p-5 relative transition-all">
                
                {/* Paper Top Jagged/Cutter Marker */}
                <div className="flex items-center justify-between text-[8px] text-slate-600 uppercase font-black tracking-widest pb-2 mb-2 border-b border-dashed border-slate-400">
                  <span className="flex items-center gap-1">
                    <Scissors size={10} /> Rouleau Thermique 80mm
                  </span>
                  <span>Epson ESC/POS Ready</span>
                </div>

                {/* 1. INSTITUTIONAL HEADER */}
                <div className="text-center space-y-1 pb-2.5 border-b-2 border-black">
                  {schoolDetails?.logo_url ? (
                    <img 
                      src={schoolDetails.logo_url} 
                      alt="Logo" 
                      className="h-10 mx-auto mb-1 object-contain grayscale contrast-200" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div className="w-8 h-8 mx-auto bg-black text-white font-black text-xs flex items-center justify-center rounded mb-1">
                      {schoolDetails?.name?.charAt(0) || 'E'}
                    </div>
                  )}

                  <h1 className="font-black text-[13px] tracking-tight uppercase leading-snug text-black">
                    {schoolDetails?.name || 'INSTITUTION SCOLAIRE'}
                  </h1>

                  {schoolDetails?.slogan && (
                    <p className="text-[9px] font-sans italic text-slate-700">« {schoolDetails.slogan} »</p>
                  )}

                  <div className="text-[9px] text-slate-800 space-y-0.2 font-sans font-medium">
                    {schoolDetails?.address && <p>{schoolDetails.address}</p>}
                    {schoolDetails?.phone && <p>Tél: {schoolDetails.phone}</p>}
                    {schoolDetails?.email && <p>Email: {schoolDetails.email}</p>}
                  </div>
                </div>

                {/* 2. RECEIPT TITLE & BARCODE BADGE */}
                <div className="my-2 py-1 text-center bg-slate-100 border border-black rounded">
                  <p className="font-black text-xs tracking-widest uppercase text-black">
                    REÇU DE VENTE & FOURNITURES
                  </p>
                  <p className="text-[10px] font-bold text-black tracking-wider">
                    TICKET N° #{transactionRef}
                  </p>
                </div>

                {/* 3. TRANSACTION CONTEXT METADATA */}
                <div className="grid grid-cols-2 gap-2 text-[9.5px] py-1.5 border-b border-dashed border-black">
                  <div className="space-y-0.5">
                    <div>
                      <span className="text-slate-600 uppercase text-[8px] font-bold block">Date & Heure :</span>
                      <span className="font-black text-black">{formattedDate} {formattedTime}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 uppercase text-[8px] font-bold block">Caissier :</span>
                      <span className="font-black text-black">{cashierName || 'Boutique / Économat'}</span>
                    </div>
                    {academicYearLabel && (
                      <div>
                        <span className="text-slate-600 uppercase text-[8px] font-bold block">Session :</span>
                        <span className="font-bold text-black">{academicYearLabel}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5 text-right border-l border-dashed border-slate-300 pl-2">
                    <div>
                      <span className="text-slate-600 uppercase text-[8px] font-bold block">Acheteur / Élève :</span>
                      <span className="font-black text-black block truncate">{studentName}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 uppercase text-[8px] font-bold block">Classe / Section :</span>
                      <span className="font-bold text-black block truncate">{studentClass}</span>
                    </div>
                    {student?.id && (
                      <div>
                        <span className="text-slate-600 uppercase text-[8px] font-bold block">Matricule :</span>
                        <span className="font-mono text-black">ID-{student.id.substring(0, 8)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. ITEMS TABLE (3 COLUMNS: QTE | ARTICLE | TOTAL) */}
                <div className="my-2">
                  <div className="flex justify-between text-[8.5px] font-black uppercase text-slate-700 border-b border-black pb-1 mb-1">
                    <span className="w-8">Qté</span>
                    <span className="flex-1 px-1">Désignation</span>
                    <span className="text-right">Total</span>
                  </div>

                  <div className="space-y-1.5">
                    {items.map((item, idx) => {
                      const itemLabel = item.label || item.description || 'Article';
                      const qty = item.quantity || 1;
                      const unitP = item.unit_price || 0;
                      const lineTotal = item.total_amount || (unitP * qty);
                      const itemCurr = item.currency || currency;

                      return (
                        <div key={idx} className="border-b border-dotted border-slate-200 pb-1 last:border-0">
                          <div className="flex justify-between items-start">
                            <span className="w-8 font-black text-black text-[10px]">
                              {qty}x
                            </span>
                            <div className="flex-1 px-1">
                              <p className="font-black text-black text-[10.5px] leading-tight">
                                {itemLabel}
                              </p>
                              <p className="text-[8.5px] text-slate-600">
                                PU: {unitP.toLocaleString()} {itemCurr} / {item.unit_measure || 'U'}
                                {item.is_deferred && (
                                  <span className="ml-1 font-bold text-black underline">
                                    [DIFFÉRÉ]
                                  </span>
                                )}
                              </p>
                            </div>
                            <span className="font-black text-black text-[10.5px] text-right shrink-0">
                              {lineTotal.toLocaleString()} {itemCurr}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. FINANCIAL TOTALS BLOCK (HEAVY BORDER BOX) */}
                <div className="my-2.5 border-2 border-black rounded-lg p-2 bg-slate-50 space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold uppercase text-slate-700">Nombre d'articles :</span>
                    <span className="font-black text-black font-mono">{totalQuantity} article(s)</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold uppercase text-slate-700">Mode de paiement :</span>
                    <span className="font-black text-black">{paymentMethod} {bankName ? `(${bankName})` : ''}</span>
                  </div>

                  {referenceNumber && (
                    <div className="flex justify-between items-center text-[9px] text-slate-600">
                      <span>Réf. Paiement :</span>
                      <span className="font-mono font-bold text-black">{referenceNumber}</span>
                    </div>
                  )}

                  <div className="pt-1.5 mt-1 border-t-2 border-black flex justify-between items-center">
                    <span className="font-black text-xs uppercase tracking-wider text-black">
                      NET TOTAL PERÇU :
                    </span>
                    <span className="font-black text-sm sm:text-base font-mono text-black">
                      {totalAmount.toLocaleString()} {currency}
                    </span>
                  </div>

                  {amountReceived !== undefined && amountReceived > 0 && (
                    <div className="flex justify-between items-center text-[9px] pt-0.5 text-slate-700 border-t border-dotted border-slate-300">
                      <span>Montant Versé :</span>
                      <span className="font-bold text-black">{amountReceived.toLocaleString()} {currency}</span>
                    </div>
                  )}

                  {changeDue !== undefined && changeDue > 0 && (
                    <div className="flex justify-between items-center text-[9px] text-slate-700">
                      <span>Monnaie Rendue :</span>
                      <span className="font-black text-black">{changeDue.toLocaleString()} {currency}</span>
                    </div>
                  )}
                </div>

                {/* 6. SECURITY BARCODE */}
                <ThermalBarcodeSVG code={transactionRef} />

                {/* 7. SIGNATURE & TEAR LINE */}
                <div className="text-center space-y-2 pt-2 border-t border-dashed border-black">
                  <div className="w-3/4 mx-auto pt-4 border-b border-black"></div>
                  <p className="text-[8.5px] uppercase font-black text-black">
                    Signature Caissier : {cashierName || 'Boutique'}
                  </p>
                  
                  <p className="text-[8px] font-sans font-medium text-slate-700 leading-tight italic">
                    Merci pour votre confiance. Veuillez conserver ce reçu officiel pour toute réclamation ou retrait de fournitures.
                  </p>
                </div>

                {/* 8. PAPER CUTTER MARGIN (EPSON AUTO-CUTTER SAFETY ZONE) */}
                <div className="h-6 flex items-center justify-center text-[7px] text-slate-600 uppercase tracking-widest pt-2">
                  - - - - - - - - - - - - - - - - - - - - - - -
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MODERN CARD VIEW */}
          {activeTab === 'card' && (
            <div className="p-4 sm:p-6 space-y-4 bg-slate-50/70 overflow-y-auto flex-1">
              
              {/* ARTICLES LIST */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-black text-slate-500 uppercase tracking-wider px-1">
                  <span className="flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-500" />
                    Articles & Fournitures ({totalQuantity})
                  </span>
                  <span>Total Ligne</span>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100 max-h-56 overflow-y-auto shadow-xs">
                  {items.map((item, idx) => {
                    const itemLabel = item.label || item.description || 'Article';
                    const qty = item.quantity || 1;
                    const unitP = item.unit_price || 0;
                    const lineTotal = item.total_amount || (unitP * qty);
                    const itemCurr = item.currency || currency;

                    return (
                      <div key={idx} className="p-3.5 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-50/80 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 font-mono text-xs flex items-center justify-center font-black border border-slate-200/80 shrink-0">
                            {qty} {item.unit_measure || 'Pièce'}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black text-slate-900 leading-snug">{itemLabel}</p>
                              {item.is_deferred && (
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[9px] font-black tracking-tight flex items-center gap-1">
                                  <Clock size={10} /> Livraison Différée
                                </span>
                              )}
                              {item.category && (
                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[9px] font-bold rounded">
                                  {item.category}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                              PU: {unitP.toLocaleString()} {itemCurr} / {item.unit_measure || 'Pièce'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-slate-900 text-sm sm:text-base">
                            {lineTotal.toLocaleString()} <span className="text-xs font-bold text-slate-500">{itemCurr}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FINANCIAL SUMMARY / TOTAL NET DISPLAY */}
              <div className="bg-slate-950 text-white p-4.5 rounded-2xl border border-slate-800 flex items-center justify-between shadow-xl shrink-0 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="relative z-10">
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <Sparkles size={13} />
                    Net Total Perçu & Encaissé
                  </span>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    Règlement intégral • Statut : <span className="text-emerald-400 font-bold">Acquitté</span>
                  </p>
                </div>
                <div className="text-right relative z-10">
                  <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-400">
                    {totalAmount.toLocaleString()} <span className="text-base text-white">{currency}</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FORMAL INVOICE A4 VIEW */}
          {activeTab === 'invoice' && (
            <div className="p-4 sm:p-6 bg-slate-100/90 overflow-y-auto flex-1 flex justify-center">
              <div className="bg-white p-6 w-full max-w-xl text-slate-900 font-sans text-xs shadow-xl border border-slate-300 rounded-2xl space-y-4">
                
                {/* Institutional Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                  <div className="flex items-center gap-3">
                    {schoolDetails?.logo_url ? (
                      <img src={schoolDetails.logo_url} alt="Logo" className="h-12 w-12 object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-base">
                        {schoolDetails?.name?.charAt(0) || 'E'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-black text-sm uppercase tracking-tight text-slate-950">
                        {schoolDetails?.name || 'INSTITUTION SCOLAIRE'}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium">République d'Haïti • Ministère de l'Éducation Nationale</p>
                      <p className="text-[10px] text-slate-500">{schoolDetails?.address || 'Port-au-Prince, Haïti'} • Tél: {schoolDetails?.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded-lg border border-emerald-200 uppercase">
                      Payé & Acquitté
                    </span>
                    <p className="text-xs font-mono font-black text-slate-900 mt-1">Facture #{transactionRef}</p>
                  </div>
                </div>

                {/* Client / Sale Info */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Facturé à :</span>
                    <strong className="text-slate-900 text-xs block mt-0.5">{studentName}</strong>
                    <span className="text-slate-600 block text-[11px]">Classe : {studentClass}</span>
                    {student?.id && <span className="font-mono text-[10px] text-slate-400">Matricule : {student.id.substring(0,8)}</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Détails Règlement :</span>
                    <strong className="text-slate-900 text-xs block mt-0.5">{paymentMethod} {bankName ? `(${bankName})` : ''}</strong>
                    <span className="text-slate-600 block text-[11px]">Date : {formattedDate} à {formattedTime}</span>
                    <span className="text-slate-500 text-[10px] block">Caissier : {cashierName || 'Boutique'}</span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Désignation</th>
                        <th className="p-2.5 text-center">Quantité</th>
                        <th className="p-2.5 text-right">P.U. ({currency})</th>
                        <th className="p-2.5 text-right">Total ({currency})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => {
                        const itemLabel = item.label || item.description || 'Article';
                        const qty = item.quantity || 1;
                        const unitP = item.unit_price || 0;
                        const lineTotal = item.total_amount || (unitP * qty);
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900">
                              {itemLabel}
                              {item.is_deferred && (
                                <span className="ml-2 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  Différé
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-mono text-slate-700">{qty} {item.unit_measure || 'Pièce'}</td>
                            <td className="p-2.5 text-right font-mono text-slate-700">{unitP.toLocaleString()}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">{lineTotal.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Total Row */}
                <div className="flex justify-end pt-1">
                  <div className="w-1/2 bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Total Net Perçu :</span>
                    <span className="text-lg font-black font-mono text-white">{totalAmount.toLocaleString()} {currency}</span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-center text-[10px]">
                  <div>
                    <p className="font-bold text-slate-600 uppercase mb-6">Le Caissier</p>
                    <p className="font-bold text-slate-900">{cashierName || 'Service Économat'}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-600 uppercase mb-6">Direction / Économat</p>
                    <p className="font-bold text-slate-400 italic">Cachet & Signature</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTION BUTTONS BAR */}
          <div className="p-3 sm:p-4 bg-white border-t border-slate-200/90 grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
            <button 
              type="button"
              onClick={handlePrint} 
              className="col-span-1 sm:col-span-2 py-3.5 bg-slate-950 hover:bg-slate-900 text-white rounded-2xl font-black text-xs sm:text-sm shadow-xl shadow-slate-950/20 transition-all active:scale-98 flex items-center justify-center gap-2 min-h-[48px]"
            >
              <Printer size={18} className="text-emerald-400" /> 
              <span>Imprimer Reçu (Epson 80mm ESC/POS)</span>
            </button>
            
            {onNewSale ? (
              <button 
                type="button"
                onClick={onNewSale} 
                className="py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-98 flex items-center justify-center gap-1.5 min-h-[48px]"
              >
                <Plus size={18} /> 
                <span>Nouvelle Vente</span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={onClose} 
                className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-98 flex items-center justify-center gap-1.5 min-h-[48px]"
              >
                <span>Fermer</span>
              </button>
            )}

            <button 
              type="button"
              onClick={onClose} 
              className="col-span-full py-0.5 text-slate-400 hover:text-slate-600 text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              Fermer cet aperçu
            </button>
          </div>
        </div>
      </div>

      {/* DEDICATED PRINT TEMPLATE FOR EPSON 80MM PRINTERS */}
      <div 
        id="thermal-pos-receipt" 
        className="hidden print:flex bg-white text-black font-mono leading-tight flex-col border-none shadow-none"
        style={{
          width: '76mm',
          maxWidth: '76mm',
          padding: '2mm',
          margin: '0 auto',
          fontSize: '11px',
          color: '#000000',
          backgroundColor: '#ffffff'
        }}
      >
        {/* 1. Header */}
        <div className="w-full text-center border-b-2 border-black pb-2 mb-2">
          {schoolDetails?.logo_url && (
            <img 
              src={schoolDetails.logo_url} 
              alt="Logo" 
              className="h-10 mx-auto mb-1 object-contain grayscale contrast-200" 
              referrerPolicy="no-referrer" 
            />
          )}
          <h1 className="text-[13px] font-black uppercase leading-tight mb-0.5">
            {schoolDetails?.name || 'INSTITUTION SCOLAIRE'}
          </h1>
          {schoolDetails?.slogan && (
            <p className="text-[8.5px] font-sans italic opacity-90 mb-0.5">« {schoolDetails.slogan} »</p>
          )}
          <div className="text-[8.5px] font-bold space-y-0 opacity-90 text-black">
            {schoolDetails?.address && <p>{schoolDetails.address}</p>}
            {schoolDetails?.phone && <p>Téls: {schoolDetails.phone}</p>}
          </div>
        </div>

        {/* 2. Document Title */}
        <div className="w-full text-center mb-2 py-1 bg-gray-100 rounded border border-black">
          <h2 className="text-[11.5px] font-black tracking-widest uppercase">REÇU DE VENTE</h2>
          <p className="text-[9px] font-bold opacity-90 mt-0.5">#{transactionRef}</p>
        </div>

        {/* 3. Metadata Grid */}
        <div className="w-full grid grid-cols-2 gap-2 text-[9px] mb-2 border-b border-black pb-1.5">
          <div className="space-y-0.5">
            <div>
              <p className="text-[7.5px] uppercase font-black text-gray-700">Date & Heure</p>
              <p className="font-bold leading-none">{formattedDate} {formattedTime}</p>
            </div>
            <div>
              <p className="text-[7.5px] uppercase font-black text-gray-700">Caissier</p>
              <p className="font-bold leading-none">{cashierName || 'Boutique'}</p>
            </div>
            {academicYearLabel && (
              <div>
                <p className="text-[7.5px] uppercase font-black text-gray-700">Année Scolaire</p>
                <p className="font-bold leading-none">{academicYearLabel}</p>
              </div>
            )}
          </div>
          <div className="space-y-0.5 text-right border-l border-gray-300 pl-1.5">
            <div>
              <p className="text-[7.5px] uppercase font-black text-gray-700">Acheteur / Élève</p>
              <p className="font-black text-[9.5px] leading-tight">{studentName}</p>
              <p className="text-[8px] font-bold text-gray-700 italic">{studentClass}</p>
            </div>
            {student?.id && (
              <p className="text-[7.5px] font-mono text-gray-600">ID: {student.id.substring(0, 8)}</p>
            )}
          </div>
        </div>

        {/* 4. Articles Breakdown */}
        <div className="w-full mb-2 border-b border-dashed border-black pb-1.5">
          <div className="flex justify-between text-[8px] font-black uppercase text-gray-700 mb-1 border-b border-gray-300 pb-0.5">
            <span className="w-6">Qté</span>
            <span className="flex-1 px-1">Désignation</span>
            <span className="text-right">Total</span>
          </div>
          <div className="space-y-1">
            {items.map((item, idx) => {
              const itemLabel = item.label || item.description || 'Article';
              const qty = item.quantity || 1;
              const unitP = item.unit_price || 0;
              const lineTotal = item.total_amount || (unitP * qty);
              return (
                <div key={idx} className="flex flex-col border-b border-gray-100 pb-0.5 last:border-0">
                  <div className="flex justify-between items-start">
                    <span className="w-6 text-[9px] font-black">{qty}x</span>
                    <span className="flex-1 px-1 text-[9px] font-bold leading-tight truncate">{itemLabel}</span>
                    <span className="text-[9px] font-black shrink-0">{lineTotal.toLocaleString()} <span className="text-[7px]">{item.currency || currency}</span></span>
                  </div>
                  <div className="flex text-[7.5px] font-bold text-gray-600 ml-6 italic">
                    <span>PU: {unitP.toLocaleString()} {item.currency || currency} / {item.unit_measure || 'Pièce'}</span>
                    {item.is_deferred && <span className="ml-1 font-black underline">[DIFFÉRÉ]</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Totals Box */}
        <div className="w-full border-2 border-black rounded-md p-1.5 mb-2 text-center bg-gray-50 text-black">
          <p className="text-[8px] font-black uppercase tracking-wider text-gray-700">
            Total Net Perçu ({paymentMethod})
          </p>
          <p className="text-[15px] font-black tracking-tight leading-none mt-1 font-mono text-black">
            {totalAmount.toLocaleString()} {currency}
          </p>
          {referenceNumber && (
            <p className="text-[7.5px] font-mono mt-0.5 text-gray-600">Réf: {referenceNumber}</p>
          )}
        </div>

        {/* 6. Barcode representation for Epson Print */}
        <div className="w-full flex justify-center my-1">
          <ThermalBarcodeSVG code={transactionRef} />
        </div>

        {/* 7. Signatures & Footer Note */}
        <div className="w-full text-center space-y-2 mt-1">
          <div className="w-3/4 mx-auto space-y-0.5 pt-1">
            <div className="h-6 border-b border-black"></div>
            <p className="text-[7.5px] font-black uppercase tracking-widest">Sign. Caissier: {cashierName || 'Boutique'}</p>
          </div>
          <p className="text-[7.5px] font-bold italic pt-1 border-t border-black text-center text-gray-800">
            Conservez ce reçu officiel précieusement pour toute réclamation ou retrait.
          </p>
        </div>

        {/* 8. Bottom Feed / Cut Spacing (20mm) */}
        <div className="w-full h-8 text-center text-[7px] text-gray-400 pt-2">
          - - - - - - - - - - - - - - - - - -
        </div>
      </div>
    </>
  );
};
