import React, { useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  FileSpreadsheet, 
  Package, 
  CheckCircle2, 
  Calendar, 
  Building,
  School,
  FileText
} from 'lucide-react';
import { CatalogItem } from '../types';

interface PrintableInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem[];
  schoolDetails: any;
  academicYearLabel?: string;
  selectedCategory?: string;
  selectedDiscipline?: string;
}

export const PrintableInventoryModal: React.FC<PrintableInventoryModalProps> = ({
  isOpen,
  onClose,
  catalog,
  schoolDetails,
  academicYearLabel,
  selectedCategory = 'Tous',
  selectedDiscipline = 'Tous'
}) => {
  if (!isOpen) return null;

  const printAreaRef = useRef<HTMLDivElement>(null);

  const filteredItems = catalog.filter(item => {
    if (selectedCategory !== 'Tous' && item.category !== selectedCategory) return false;
    if (selectedDiscipline !== 'Tous' && item.discipline_name && item.discipline_name !== selectedDiscipline) return false;
    return true;
  });

  const totalTheoricUnits = filteredItems.reduce((acc, i) => acc + (i.stock_quantity || 0), 0);
  const totalStockValue = filteredItems.reduce((acc, i) => acc + ((i.stock_quantity || 0) * (i.unit_price || 0)), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Référence / Article',
      'Catégorie',
      'Discipline / Classe',
      'Unité',
      'Prix Vente (HTG)',
      'Stock Théorique',
      'Stock Réel Compté',
      'Écart Constaté',
      'Observations'
    ];

    const rows = filteredItems.map(item => [
      item.id.slice(0, 8),
      `"${(item.label || '').replace(/"/g, '""')}"`,
      `"${item.category || ''}"`,
      `"${item.discipline_name || ''}"`,
      `"${item.unit_measure || 'Pièce'}"`,
      item.unit_price || 0,
      item.stock_quantity ?? 0,
      '',
      '',
      ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Fiche_Inventaire_Stocks_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[94vh]">
        
        {/* MODAL CONTROL BAR (SCREEN ONLY) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-300 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Fiche Officielle d'Inventaire & Comptage Physique</h3>
              <p className="text-xs text-slate-300 font-medium">
                {filteredItems.length} article(s) • Année: {academicYearLabel || 'En cours'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <FileSpreadsheet size={15} />
              <span className="hidden sm:inline">Export Excel / CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Printer size={15} />
              <span>Imprimer (A4)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT AREA */}
        <div className="p-6 md:p-8 overflow-y-auto bg-slate-100 flex-1 print:p-0 print:bg-white print:overflow-visible" id="printable-inventory-sheet">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-4xl mx-auto space-y-6 print:shadow-none print:border-none print:p-0 print:max-w-full">
            
            {/* HEADER ETABLISSEMENT */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div className="space-y-1">
                <div className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                  RÉPUBLIQUE D'HAÏTI • MINISTÈRE DE L'ÉDUCATION NATIONALE
                </div>
                <h1 className="text-xl font-black uppercase text-slate-900 tracking-tight">
                  {schoolDetails?.name || 'ÉTABLISSEMENT SCOLAIRE'}
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  {schoolDetails?.address || 'Direction de l\'Économat & Gestion des Stocks'} • {schoolDetails?.phone || ''}
                </p>
                <div className="inline-block mt-1 px-2.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-black uppercase text-slate-700">
                  FICHE OFFICIELLE D'INVENTAIRE & COMPTAGE EN MAGASIN
                </div>
              </div>

              <div className="text-right space-y-1 text-xs">
                <div className="font-bold text-slate-800">
                  Date d'inventaire : <span className="font-black font-mono">{new Date().toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="text-slate-600">
                  Année Académique : <span className="font-bold">{academicYearLabel || 'N/A'}</span>
                </div>
                <div className="text-slate-600">
                  Articles listés : <span className="font-black font-mono">{filteredItems.length}</span>
                </div>
              </div>
            </div>

            {/* METRICS SUMMARY */}
            <div className="grid grid-cols-3 gap-3 text-center border border-slate-300 rounded-xl p-3 bg-slate-50 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Articles</span>
                <span className="font-black font-mono text-slate-900 text-sm">{filteredItems.length} références</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Quantités Théoriques en Stock</span>
                <span className="font-black font-mono text-slate-900 text-sm">{totalTheoricUnits.toLocaleString()} unités</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Valorisation Marchande</span>
                <span className="font-black font-mono text-slate-900 text-sm">{totalStockValue.toLocaleString()} HTG</span>
              </div>
            </div>

            {/* INVENTORY TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-800 border-b border-slate-300">
                    <th className="border border-slate-300 px-3 py-2 text-center w-8">#</th>
                    <th className="border border-slate-300 px-3 py-2">Désignation Matériel / Fourniture</th>
                    <th className="border border-slate-300 px-3 py-2 text-center">Catégorie</th>
                    <th className="border border-slate-300 px-3 py-2 text-center">Unité</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">P.U (HTG)</th>
                    <th className="border border-slate-300 px-3 py-2 text-center font-bold">Stock Théorique</th>
                    <th className="border border-slate-300 px-3 py-2 text-center w-28 bg-slate-50">Stock Réel Compté</th>
                    <th className="border border-slate-300 px-3 py-2 text-center w-20 bg-slate-50">Écart (+/-)</th>
                    <th className="border border-slate-300 px-3 py-2 text-center">Observations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {filteredItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono text-[10px] text-slate-500">
                        {index + 1}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 font-bold text-slate-900">
                        <div>{item.label}</div>
                        {item.discipline_name && (
                          <div className="text-[10px] font-normal text-slate-500">
                            Prog: {item.discipline_name}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center">
                        <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {item.category}
                        </span>
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-slate-600">
                        {item.unit_measure || 'Pièce'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono font-bold text-slate-800">
                        {item.unit_price?.toLocaleString()}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-black font-mono text-slate-900 bg-slate-50/50">
                        {item.stock_quantity ?? 0}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center bg-white">
                        <div className="h-6 border-b border-dashed border-slate-400 w-full" />
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center bg-white">
                        <div className="h-6 border-b border-dashed border-slate-400 w-full" />
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-slate-400 text-[10px]">
                        <div className="h-6 border-b border-dashed border-slate-400 w-full" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SIGNATURE AREA */}
            <div className="pt-6 grid grid-cols-2 gap-8 border-t border-slate-300 text-xs">
              <div className="border border-slate-300 rounded-xl p-4 space-y-12">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Le Responsable de l'Économat / Magasinier
                </div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] text-slate-500">
                  Nom, Date et Signature
                </div>
              </div>

              <div className="border border-slate-300 rounded-xl p-4 space-y-12">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  La Direction de l'Établissement / Censeur
                </div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] text-slate-500">
                  Visa & Cachet Officiel
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
