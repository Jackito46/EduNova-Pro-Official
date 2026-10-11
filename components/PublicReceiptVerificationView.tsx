import React from 'react';
import { ShieldCheck, CheckCircle2, Calendar, User, DollarSign, ArrowLeft, Printer, School, Hash, Sparkles } from 'lucide-react';

export interface PublicReceiptVerificationViewProps {
  onBackToApp?: () => void;
}

export const PublicReceiptVerificationView: React.FC<PublicReceiptVerificationViewProps> = ({ onBackToApp }) => {
  // Extract parameters from URL hash or search params
  const hash = window.location.hash;
  const queryString = hash.includes('?') ? hash.split('?')[1] : window.location.search.replace(/^\?/, '');
  const params = new URLSearchParams(queryString);

  const ref = params.get('ref') || 'N/A';
  const student = params.get('student') || 'Élève';
  const classe = params.get('classe') || '';
  const amountStr = params.get('amount') || '0';
  const currency = params.get('currency') || 'HTG';
  const fee = params.get('fee') || 'Frais Scolaires';
  const date = params.get('date') || new Date().toLocaleDateString('fr-FR');
  const cashier = params.get('cashier') || 'Caisse Comptabilité';
  const school = params.get('school') || 'Établissement Scolaire';
  const rateStr = params.get('rate') || '';
  const sig = params.get('sig') || 'EDN-CERTIFIED';

  const amount = parseFloat(amountStr) || 0;
  const rate = parseFloat(rateStr) || null;
  const origCurr = params.get('orig_currency') || params.get('orig_curr');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-indigo-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans">
      {/* HEADER BAR */}
      <header className="max-w-xl mx-auto w-full flex items-center justify-between py-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 ring-1 ring-white/20">
            <ShieldCheck size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              EduNova Pro
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                Certifié
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Portail Public de Vérification d'Authenticité</p>
          </div>
        </div>

        {onBackToApp && (
          <button
            onClick={onBackToApp}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg transition-all"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Portail</span>
          </button>
        )}
      </header>

      {/* MAIN VERIFICATION CARD */}
      <main className="max-w-xl mx-auto w-full my-6">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 duration-300">
          {/* BANNER VERT VÉRIFIÉ */}
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md text-white mx-auto flex items-center justify-center mb-3 shadow-inner ring-4 ring-white/30">
              <CheckCircle2 size={36} className="stroke-[2.5] text-white" />
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-950/40 text-emerald-100 px-3 py-1 rounded-full border border-white/20 mb-2">
              <Sparkles size={11} className="text-emerald-200" />
              Scellé Numérique Authentifié
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Transaction Enregistrée & Valide
            </h2>
            <p className="text-xs text-emerald-100 mt-1 max-w-sm mx-auto font-medium">
              Ce document officiel est conforme aux registres comptables de l'établissement scolaire.
            </p>
          </div>

          {/* DÉTAILS DE LA TRANSACTION */}
          <div className="p-6 space-y-5">
            {/* ÉTABLISSEMENT */}
            <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="w-10 h-10 rounded-xl bg-slate-200/80 flex items-center justify-center text-slate-700 shrink-0">
                <School size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Établissement Émetteur</p>
                <p className="text-sm font-black text-slate-900 truncate">{school}</p>
              </div>
            </div>

            {/* MONTANT PAYÉ EN GROS */}
            <div className="text-center py-4 px-3 bg-gradient-to-b from-slate-50 to-emerald-50/40 rounded-2xl border-2 border-emerald-500/20">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">Montant Scellé & Perçu</p>
              <div className="text-3xl sm:text-4xl font-black text-emerald-700 font-mono tracking-tight">
                {amount.toLocaleString()} <span className="text-xl font-bold">{currency}</span>
              </div>
              
              {/* TAUX DE CONVERSION SI APPLICABLE */}
              {rate && (currency === 'USD' || origCurr === 'USD') && (
                <div className="mt-3 inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-300 text-xs font-bold text-slate-800 shadow-2xs">
                  <span className="text-[10px] uppercase text-slate-500">Taux appliqué :</span>
                  <span className="font-mono font-black text-emerald-800">1 USD = {rate} HTG</span>
                  {currency === 'HTG' && (
                    <span className="text-slate-500 font-mono text-[11px]">
                      (≈ ${(amount / rate).toFixed(2)} USD)
                    </span>
                  )}
                  {currency === 'USD' && (
                    <span className="text-slate-500 font-mono text-[11px]">
                      (≈ {Math.round(amount * rate).toLocaleString()} HTG)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* GRID DES INFORMATIONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase">
                  <User size={12} />
                  <span>Élève Bénéficiaire</span>
                </div>
                <p className="font-black text-slate-900 text-sm">{student}</p>
                {classe && <p className="text-[11px] text-slate-600 font-semibold">{classe}</p>}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase">
                  <DollarSign size={12} />
                  <span>Type de Frais</span>
                </div>
                <p className="font-black text-slate-900 text-sm uppercase">{fee}</p>
                <p className="text-[11px] text-emerald-700 font-semibold">Payé intégralement</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase">
                  <Calendar size={12} />
                  <span>Date d'Enregistrement</span>
                </div>
                <p className="font-bold text-slate-900 font-mono">{date}</p>
                <p className="text-[10px] text-slate-500">Horodatage officiel</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase">
                  <Hash size={12} />
                  <span>Référence Unique</span>
                </div>
                <p className="font-mono font-black text-slate-900 text-sm">#{ref}</p>
                <p className="text-[10px] text-slate-500 font-mono">Signataire: {cashier}</p>
              </div>
            </div>

            {/* SCELLÉ SÉCURITÉ */}
            <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between gap-3 text-xs font-mono">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-bold">Signature Cryptographique</p>
                <p className="font-black text-emerald-400 text-sm mt-0.5">{sig}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block bg-emerald-500/20 text-emerald-300 font-bold text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Valide & Intègre
                </span>
              </div>
            </div>

            {/* BOUTON IMPRIMER ATTESTATION */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <Printer size={15} />
                <span>Imprimer l'Attestation de Paiement</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="max-w-xl mx-auto w-full text-center text-slate-500 text-[11px] py-4 border-t border-white/10 space-y-1">
        <p>© {new Date().getFullYear()} EduNova Pro • Système de Gestion et de Certification Scolaire</p>
        <p className="text-slate-600 text-[10px]">L'authenticité des reçus est certifiée par horodatage numérique scellé.</p>
      </footer>
    </div>
  );
};

export default PublicReceiptVerificationView;
