import React, { useState } from 'react';
import { 
  Search, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  Printer, 
  Plus, 
  Filter, 
  Download, 
  MoreVertical,
  Wallet,
  Receipt,
  Users,
  Calendar,
  ChevronRight,
  TrendingUp,
  PieChart as PieIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  CreditCard,
  ArrowRight,
  // Added missing GraduationCap import
  GraduationCap
} from 'lucide-react';

const FinanceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'revenue' | 'expenses' | 'payroll'>('dashboard');

  const transactions = [
    { id: 'TRX-9821', entity: 'Marie Curie', amount: 15000, date: '12 Fév 2026', type: 'Scolarité', method: 'Cash', status: 'completed' },
    { id: 'TRX-9820', entity: 'Albert Einstein', amount: 22500, date: '11 Fév 2026', type: 'Inscription', method: 'Virement', status: 'processing' },
    { id: 'TRX-9819', entity: 'SOGEBANK', amount: 12000, date: '10 Fév 2026', type: 'Frais Service', method: 'Auto', status: 'completed' },
    { id: 'TRX-9818', entity: 'Isaac Newton', amount: 12000, date: '10 Fév 2026', type: 'Fournitures', method: 'MonCash', status: 'pending' },
  ];

  const StatusLabel = ({ status }: { status: string }) => {
    const config = {
      completed: { label: 'Effectué', classes: 'bg-green-50 text-green-700 border-green-100' },
      processing: { label: 'En cours', classes: 'bg-blue-50 text-blue-700 border-blue-100' },
      pending: { label: 'Attente', classes: 'bg-amber-50 text-amber-700 border-amber-100' }
    };
    const current = config[status as keyof typeof config] || config.pending;

    return (
      <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-medium ${current.classes}`}>
        {current.label}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      {/* Barre d'entête unifiée */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-gray-100 pb-8">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm mb-1">
            <CreditCard size={16} />
            Économat & Comptabilité
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestion Financière</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Suivez vos flux de trésorerie et la santé financière de l'établissement en temps réel.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
            <Download size={16} />
            Rapport annuel
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95">
            <Plus size={18} />
            Enregistrer un paiement
          </button>
        </div>
      </div>

      {/* Navigation par onglets fluide */}
      <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl w-fit">
        {[
          { id: 'dashboard', label: 'Vue Globale', icon: PieIcon },
          { id: 'revenue', label: 'Recettes', icon: ArrowUpRight },
          { id: 'expenses', label: 'Dépenses', icon: ArrowDownRight },
          { id: 'payroll', label: 'Paie Professeurs', icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cartes KPI Standardisées */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Trésorerie Totale', value: '789,400 G', detail: '+14% vs mois dernier', icon: Wallet, trend: 'up' },
          { label: 'Recettes du Mois', value: '182,610 G', detail: '45 règlements traités', icon: ArrowUpRight, trend: 'up' },
          { label: 'Dépenses du Mois', value: '11,200 G', detail: '2.4% du budget utilisé', icon: ArrowDownRight, trend: 'down' },
          { label: 'Impayés / Reste', value: '284,800 G', detail: '12 dossiers critiques', icon: AlertCircle, trend: 'warning' },
        ].map((card, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                <card.icon size={20} />
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                card.trend === 'up' ? 'bg-green-50 text-green-600' : 
                card.trend === 'down' ? 'bg-blue-50 text-blue-600' : 
                'bg-amber-50 text-amber-600'
              }`}>
                {card.trend === 'up' ? 'Positif' : card.trend === 'down' ? 'Normal' : 'Attention'}
              </span>
            </div>
            <p className="text-xs font-semibold text-gray-400  tracking-wider">{card.label}</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{card.value}</h3>
            <p className="text-[11px] text-gray-500 mt-3 font-medium flex items-center gap-1">
              <TrendingUp size={12} className="text-gray-400" />
              {card.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Liste des Transactions Principal */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                Dernières opérations
                <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold">LIVE</span>
              </h3>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-500" size={14} />
                <input 
                  type="text" 
                  placeholder="Rechercher par nom ou ID..." 
                  className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white w-full sm:w-64 transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-900 text-sm font-semibold border-b border-gray-100">
                    <th className="px-6 py-4">Transaction</th>
                    <th className="px-6 py-4">NOM & PRÉNOM</th>
                    <th className="px-6 py-4">Montant</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg opacity-60">
                            <Receipt size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-900">{t.id}</p>
                            <p className="text-[10px] text-gray-500 font-medium">{t.date}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-gray-700">{t.entity}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{t.type}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-gray-900">{t.amount.toLocaleString()} G</p>
                        <p className="text-[10px] text-gray-500 font-medium">{t.method}</p>
                      </td>
                      <td className="px-6 py-4">
                        <StatusLabel status={t.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all">
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <button className="w-full py-4 text-center text-sm font-medium text-blue-600 hover:bg-gray-50 transition-colors border-t border-gray-50 flex items-center justify-center gap-2">
              Consulter tout l'historique financier
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Sidebar Insights & Actions Rapides */}
        <div className="space-y-6">
          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100">
            <h4 className="text-sm font-semibold text-indigo-100 mb-6 flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-300" />
              Alertes & Échéances
            </h4>
            <div className="space-y-4">
              <div className="p-4 bg-white/10 border border-white/20 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-medium text-amber-300">En retard</span>
                  <span className="text-xs text-indigo-200">Hier</span>
                </div>
                <p className="text-sm font-medium">Facture EDH (Service Public)</p>
                <p className="text-base font-semibold mt-1">4,500 G</p>
              </div>
              <div className="p-4 bg-white/10 border border-white/20 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-medium text-blue-200">Planifié</span>
                  <span className="text-xs text-indigo-200">15 Fév</span>
                </div>
                <p className="text-sm font-medium">Masse salariale / Paie Profs</p>
                <p className="text-base font-semibold mt-1">63,280 G</p>
              </div>
            </div>
            <button className="w-full mt-6 py-2.5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl text-sm font-bold transition-all shadow-sm">
              Virement groupé
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-900 mb-6">Liens Utiles</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Scolarités', icon: GraduationCap, color: 'text-blue-500', bg: 'bg-blue-50' },
                { label: 'Salaires', icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
                { label: 'Factures', icon: Receipt, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                { label: 'Inventaire', icon: Wallet, color: 'text-orange-500', bg: 'bg-orange-50' },
              ].map((link, i) => (
                <button key={i} className="flex flex-col items-center justify-center p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:border-blue-100 transition-all group">
                  <link.icon size={20} className={`${link.color} mb-2 group-hover:scale-110 transition-transform`} />
                  <span className="text-xs font-medium text-gray-600">{link.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceView;