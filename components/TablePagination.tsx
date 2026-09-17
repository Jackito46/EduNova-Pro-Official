import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100],
  itemLabel = 'éléments',
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  // Génération de la fenêtre de pagination avec ellipses
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    pages.push(1);
    if (safeCurrentPage > 3) {
      pages.push('...');
    }
    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (safeCurrentPage < totalPages - 2) {
      pages.push('...');
    }
    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={`p-3 sm:px-6 sm:py-3.5 bg-slate-50/90 border-t border-slate-200/90 flex flex-col md:flex-row items-center justify-between gap-3 text-xs select-none ${className}`}
    >
      {/* Côté gauche: Compteurs & Sélecteur du nombre d'éléments */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-slate-500 font-medium">
        <span>
          Affichage de{' '}
          <strong className="text-slate-900 font-bold">{totalItems === 0 ? 0 : startIndex + 1}</strong> à{' '}
          <strong className="text-slate-900 font-bold">{endIndex}</strong> sur{' '}
          <strong className="text-slate-900 font-bold">{totalItems}</strong> {itemLabel}
        </span>

        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 sm:pl-2.5 sm:border-l sm:border-slate-200">
            <span className="text-[11px] text-slate-400">Par page :</span>
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
              {itemsPerPageOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    onItemsPerPageChange(size);
                    onPageChange(1);
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    itemsPerPage === size
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Côté droit: Navigation des pages */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-400 mr-2 hidden sm:inline">
            Page <strong className="text-slate-800 font-bold">{safeCurrentPage}</strong> /{' '}
            <strong className="text-slate-800 font-bold">{totalPages}</strong>
          </span>

          {/* Première page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safeCurrentPage <= 1}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
            title="Première page"
            aria-label="Première page"
          >
            <ChevronsLeft size={16} />
          </button>

          {/* Page précédente */}
          <button
            type="button"
            onClick={() => onPageChange(safeCurrentPage - 1)}
            disabled={safeCurrentPage <= 1}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
            title="Page précédente"
            aria-label="Page précédente"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Numéros de page avec fenêtre dynamique */}
          <div className="flex items-center gap-1 mx-0.5">
            {pageNumbers.map((p, idx) =>
              p === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p as number)}
                  className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                    safeCurrentPage === p
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                  aria-current={safeCurrentPage === p ? 'page' : undefined}
                >
                  {p}
                </button>
              )
            )}
          </div>

          {/* Page suivante */}
          <button
            type="button"
            onClick={() => onPageChange(safeCurrentPage + 1)}
            disabled={safeCurrentPage >= totalPages}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
            title="Page suivante"
            aria-label="Page suivante"
          >
            <ChevronRight size={16} />
          </button>

          {/* Dernière page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safeCurrentPage >= totalPages}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
            title="Dernière page"
            aria-label="Dernière page"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
