import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Mail, MessageSquare, Bell } from 'lucide-react';

export type CommunicationChannel = 'whatsapp' | 'email' | 'sms' | 'push';

interface CommunicationTabBarProps {
  activeChannel: CommunicationChannel;
  className?: string;
}

interface TabItem {
  id: CommunicationChannel;
  label: string;
  shortLabel?: string;
  path: string;
  icon: React.ElementType;
  colorClass: {
    active: string;
    badge: string;
    hover: string;
  };
}

const TABS: TabItem[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    shortLabel: 'WhatsApp',
    path: '/communication/whatsapp',
    icon: MessageCircle,
    colorClass: {
      active: 'bg-emerald-600 text-white shadow-xs font-bold',
      badge: 'bg-emerald-500/20 text-emerald-700',
      hover: 'hover:bg-emerald-50 hover:text-emerald-700 text-slate-600'
    }
  },
  {
    id: 'email',
    label: 'Emailing',
    shortLabel: 'Email',
    path: '/communication/email',
    icon: Mail,
    colorClass: {
      active: 'bg-blue-600 text-white shadow-xs font-bold',
      badge: 'bg-blue-500/20 text-blue-700',
      hover: 'hover:bg-blue-50 hover:text-blue-700 text-slate-600'
    }
  },
  {
    id: 'sms',
    label: 'SMS',
    shortLabel: 'SMS',
    path: '/communication/sms',
    icon: MessageSquare,
    colorClass: {
      active: 'bg-amber-600 text-white shadow-xs font-bold',
      badge: 'bg-amber-500/20 text-amber-700',
      hover: 'hover:bg-amber-50 hover:text-amber-700 text-slate-600'
    }
  },
  {
    id: 'push',
    label: 'Notifications Push',
    shortLabel: 'Push',
    path: '/communication/push',
    icon: Bell,
    colorClass: {
      active: 'bg-indigo-600 text-white shadow-xs font-bold',
      badge: 'bg-indigo-500/20 text-indigo-700',
      hover: 'hover:bg-indigo-50 hover:text-indigo-700 text-slate-600'
    }
  }
];

export const CommunicationTabBar: React.FC<CommunicationTabBarProps> = ({
  activeChannel,
  className = ''
}) => {
  const navigate = useNavigate();

  return (
    <div className={`w-full ${className}`}>
      {/* Container segmenté compact et tactile */}
      <div className="bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shadow-2xs backdrop-blur-xs">
        <nav 
          className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth py-0.5 px-0.5" 
          aria-label="Canaux de communication"
        >
          {TABS.map((tab) => {
            const isActive = activeChannel === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    navigate(tab.path);
                  }
                }}
                className={`flex-1 min-w-[90px] sm:min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold tracking-tight transition-all duration-150 shrink-0 select-none ${
                  isActive
                    ? tab.colorClass.active
                    : tab.colorClass.hover
                }`}
                title={tab.label}
              >
                <Icon size={14} className="shrink-0 stroke-[2.2]" />
                <span className="hidden sm:inline truncate">{tab.label}</span>
                <span className="sm:hidden text-[11px] truncate">{tab.shortLabel || tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
