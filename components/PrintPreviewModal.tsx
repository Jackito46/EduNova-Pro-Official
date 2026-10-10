import React from 'react';
import { Printer, X, FileText, Download, Loader2 } from 'lucide-react';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  onPrint?: () => void;
  onExportPDF?: () => void;
  children: React.ReactNode;
  isExporting?: boolean;
  customControls?: React.ReactNode;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle = 'Aperçu avant impression',
  onPrint,
  onExportPDF,
  children,
  isExporting = false,
  customControls
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-0 md:p-4 lg:p-6 print:static print:inset-auto print:bg-white print:backdrop-blur-none animate-in fade-in duration-200 overflow-hidden print:overflow-visible print:p-0 print:m-0">
      <div className="w-full h-full max-w-[1340px] flex flex-col bg-slate-100 md:rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300 print:max-w-none print:w-full print:h-auto print:block print:shadow-none print:bg-white print:rounded-none overflow-hidden print:overflow-visible">
        
        {/* MODERN FLUID HEADER (Hidden when printing) */}
        <header className="bg-white/95 backdrop-blur-md px-3.5 sm:px-5 lg:px-6 py-3 sm:py-3.5 border-b border-slate-200/80 shadow-xs shrink-0 z-20 print:hidden">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-3.5">
            
            {/* Left: Document Identity & Mobile Close */}
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/80 text-indigo-600 flex items-center justify-center border border-indigo-200/60 shadow-xs shrink-0">
                  <FileText size={18} className="stroke-[2.2] sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-extrabold text-slate-900 text-sm sm:text-base lg:text-lg tracking-tight leading-snug truncate">
                    {title}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[9px] sm:text-[9.5px] uppercase tracking-wider border border-slate-200/70 truncate">
                      {subtitle}
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button on Mobile (visible only on < sm) */}
              <button 
                onClick={onClose} 
                className="sm:hidden p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all shrink-0"
                title="Fermer l'aperçu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Center & Right: Controls + Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between xl:justify-end gap-2 sm:gap-2.5">
              
              {/* Custom Segmented Filters / Options (Scrollable on small screens) */}
              {customControls && (
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0 max-w-full">
                  {customControls}
                </div>
              )}

              {/* Action Buttons Group (Responsive on Mobile / Tablet / 14" / Desktop) */}
              <div className="flex items-center gap-2 shrink-0 sm:ml-auto xl:ml-2">
                {onExportPDF && (
                  <button 
                    onClick={onExportPDF}
                    disabled={isExporting}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 text-xs tracking-tight transition-all active:scale-95 disabled:opacity-50 shadow-2xs hover:border-slate-300 whitespace-nowrap"
                    title="Télécharger en document PDF haute résolution"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-indigo-600" />
                        <span>Export...</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} className="text-slate-600" />
                        <span>PDF</span>
                      </>
                    )}
                  </button>
                )}

                <button 
                  onClick={handlePrint} 
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm shadow-indigo-600/25 transition-all text-xs tracking-tight active:scale-95 hover:shadow-indigo-600/35 whitespace-nowrap"
                  title="Lancer l'impression directe"
                >
                  <Printer size={15} />
                  <span>Imprimer</span>
                </button>

                {/* Close Button on Desktop / Tablet (hidden on < sm) */}
                <button 
                  onClick={onClose} 
                  className="hidden sm:inline-flex p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all active:scale-95 border border-transparent hover:border-slate-200"
                  title="Fermer l'aperçu"
                >
                  <X size={18} />
                </button>
              </div>

            </div>
          </div>
        </header>

        {/* PRINTABLE CONTENT SCROLLABLE CANVAS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-200/50 print:bg-white print:p-0 print:overflow-visible">
          <div className="mx-auto w-full flex justify-center">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
