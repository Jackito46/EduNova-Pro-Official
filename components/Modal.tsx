import React, { useEffect } from 'react';
import { X, Info, CheckCircle2, ShieldAlert, AlertTriangle, Loader2 } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: React.ReactNode;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'info' | 'success' | 'warning';
  isLoading?: boolean;
  children?: React.ReactNode;
  hideDefaultActions?: boolean;
  containerClassName?: string;
  contentClassName?: string;
  hideIcon?: boolean;
  hideTitle?: boolean;
  hideCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  type = 'info',
  isLoading = false,
  children,
  hideDefaultActions = false,
  containerClassName = '',
  contentClassName = '',
  hideIcon = false,
  hideTitle = false,
  hideCloseButton = false
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  const config = {
    danger: {
      icon: ShieldAlert,
      iconClass: 'bg-rose-50 text-rose-600 border border-rose-200/80 shadow-sm',
      btnClass: 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 text-white',
      borderClass: 'border-rose-100'
    },
    info: {
      icon: Info,
      iconClass: 'bg-indigo-50 text-indigo-600 border border-indigo-200/80 shadow-sm',
      btnClass: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20 text-white',
      borderClass: 'border-indigo-100'
    },
    warning: {
      icon: AlertTriangle,
      iconClass: 'bg-amber-50 text-amber-600 border border-amber-200/80 shadow-sm',
      btnClass: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20 text-white',
      borderClass: 'border-amber-100'
    },
    success: {
      icon: CheckCircle2,
      iconClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200/80 shadow-sm',
      btnClass: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 text-white',
      borderClass: 'border-emerald-100'
    }
  };

  const current = config[type] || config.info;
  const Icon = current.icon;
  const isFullyCustom = hideIcon && hideTitle && hideDefaultActions;
  const hasCustomMaxWidth = containerClassName && containerClassName.includes('max-w-');
  const hasCustomRounded = containerClassName && (containerClassName.includes('rounded-') || containerClassName.includes('rounded'));

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" 
        onClick={!isLoading ? onClose : undefined}
      />
      
      {/* Modal Container */}
      <div className={`relative bg-white w-full ${hasCustomMaxWidth ? '' : 'max-w-lg'} ${hasCustomRounded ? '' : 'rounded-2xl sm:rounded-3xl'} max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200/80 my-auto ${containerClassName}`}>
        
        {/* Header Section */}
        {(!hideIcon || !hideTitle || !hideCloseButton) && (
          <div className="px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {!hideIcon && (
                <div className={`w-9 h-9 sm:w-10 sm:h-10 ${current.iconClass} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} className="sm:w-5 sm:h-5" />
                </div>
              )}
              
              {!hideTitle && (
                <div className="min-w-0 flex-1">
                  {typeof title === 'string' ? (
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug truncate">
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                  {message && (
                    <div className="text-slate-600 text-xs font-normal tracking-normal leading-normal mt-0.5 line-clamp-2">
                      {message}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Close Button */}
            {!hideCloseButton && (
              <button 
                onClick={onClose}
                disabled={isLoading}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors flex-shrink-0 disabled:opacity-50"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Content Section */}
        {isFullyCustom ? (
          <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${contentClassName}`}>
            {children}
          </div>
        ) : (
          <div className={`flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 text-slate-800 ${contentClassName}`}>
            {children}
          </div>
        )}

        {/* Footer Section */}
        {!hideDefaultActions && (
          <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-slate-50/90 border-t border-slate-100 flex-shrink-0">
            <div className={`flex items-center ${onConfirm ? 'justify-end' : 'justify-center'} gap-2.5 sm:gap-3`}>
              <button 
                type="button"
                onClick={onClose} 
                disabled={isLoading}
                className="px-4 py-2.5 sm:px-5 sm:py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs tracking-tight transition-all active:scale-95 disabled:opacity-50 shadow-sm"
              >
                {cancelLabel}
              </button>
              {onConfirm && (
                <button 
                  type="button"
                  onClick={onConfirm} 
                  disabled={isLoading}
                  className={`px-5 py-2.5 sm:px-6 sm:py-2.5 rounded-xl font-bold text-xs tracking-tight shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${current.btnClass}`}
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  {confirmLabel}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;