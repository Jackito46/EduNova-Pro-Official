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
        <header className="bg-white/95 backdrop-blur-md px-4 sm:px-6 py-3.5 border-b border-slate-200/80 shadow-xs shrink-0 z-20 print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
            
            {/* Left: Document Identity */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/80 text-indigo-600 flex items-center justify-center border border-indigo-200/60 shadow-xs shrink-0">
                <FileText size={20} className="stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h2 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-snug truncate">
                  {title}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[9.5px] uppercase tracking-wider border border-slate-200/70 truncate">
                    {subtitle}
                  </span>
                </div>
              </div>
            </div>

            {/* Center & Right: Controls + Actions */}
            <div className="flex items-center justify-between lg:justify-end gap-2.5 flex-wrap sm:flex-nowrap">
              
              {/* Custom Segmented Filters / Options */}
              {customControls && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                  {customControls}
                </div>
              )}

              {/* Action Buttons Group */}
              <div className="flex items-center gap-2 shrink-0 ml-auto lg:ml-2">
                {onExportPDF && (
                  <button 
                    onClick={onExportPDF}
                    disabled={isExporting}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 text-xs tracking-tight transition-all active:scale-95 disabled:opacity-50 shadow-2xs hover:border-slate-300"
                    title="Télécharger en document PDF haute résolution"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-indigo-600" />
                        <span className="hidden sm:inline">Export...</span>
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
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm shadow-indigo-600/25 transition-all text-xs tracking-tight active:scale-95 hover:shadow-indigo-600/35"
                  title="Lancer l'impression directe"
                >
                  <Printer size={15} />
                  <span>Imprimer</span>
                </button>

                <button 
                  onClick={onClose} 
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all active:scale-95 border border-transparent hover:border-slate-200"
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
