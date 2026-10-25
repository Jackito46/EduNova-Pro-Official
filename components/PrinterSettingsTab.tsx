import React, { useState } from 'react';
import { 
  Printer, 
  Usb, 
  Bluetooth, 
  Wifi, 
  Check, 
  Save, 
  Loader2, 
  Info, 
  Scissors, 
  FileText, 
  RotateCcw,
  Sparkles,
  HelpCircle,
  Eye,
  Settings2,
  CheckCircle2,
  Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { PrinterSettings, PrinterConnectionType, ReceiptPaperWidth } from '../types';

export interface PrinterSettingsTabProps {
  schoolData: any;
  setSchoolData: (data: any) => void;
  handleUpdateSchool: () => Promise<void> | void;
  saving?: boolean;
  canManageAllCampuses: boolean;
}

export const PrinterSettingsTab: React.FC<PrinterSettingsTabProps> = ({
  schoolData,
  setSchoolData,
  handleUpdateSchool,
  saving = false,
  canManageAllCampuses
}) => {
  const currentSettings: PrinterSettings = {
    printer_type: schoolData?.global_settings?.printer_settings?.printer_type || 'USB',
    paper_width: schoolData?.global_settings?.printer_settings?.paper_width || '80mm',
    printer_name: schoolData?.global_settings?.printer_settings?.printer_name || 'Epson TM-T20 / Xprinter 80',
    network_ip: schoolData?.global_settings?.printer_settings?.network_ip || '192.168.1.200',
    network_port: schoolData?.global_settings?.printer_settings?.network_port || '9100',
    auto_cut: schoolData?.global_settings?.printer_settings?.auto_cut !== false,
    header_message: schoolData?.global_settings?.printer_settings?.header_message || "ÉCONOMAT • REÇU CERTIFIÉ CONFORME",
    footer_message: schoolData?.global_settings?.printer_settings?.footer_message || "Conservez ce reçu précieux pour tout contrôle légal ou réclamation.",
    feed_lines: schoolData?.global_settings?.printer_settings?.feed_lines ?? 3
  };

  const [printerType, setPrinterType] = useState<PrinterConnectionType>(currentSettings.printer_type);
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>(currentSettings.paper_width);
  const [printerName, setPrinterName] = useState<string>(currentSettings.printer_name || '');
  const [networkIp, setNetworkIp] = useState<string>(currentSettings.network_ip || '');
  const [networkPort, setNetworkPort] = useState<string>(currentSettings.network_port || '');
  const [autoCut, setAutoCut] = useState<boolean>(currentSettings.auto_cut !== false);
  const [headerMessage, setHeaderMessage] = useState<string>(currentSettings.header_message || '');
  const [footerMessage, setFooterMessage] = useState<string>(currentSettings.footer_message || '');
  const [feedLines, setFeedLines] = useState<number>(currentSettings.feed_lines ?? 3);

  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [activeMobileView, setActiveMobileView] = useState<'form' | 'preview'>('form');
  const [isPrintingTest, setIsPrintingTest] = useState<boolean>(false);

  // Mise à jour de l'état parent
  const updateSettingsInParent = (overrides: Partial<PrinterSettings> = {}) => {
    const updatedPrinterSettings: PrinterSettings = {
      printer_type: overrides.printer_type ?? printerType,
      paper_width: overrides.paper_width ?? paperWidth,
      printer_name: overrides.printer_name ?? printerName,
      network_ip: overrides.network_ip ?? networkIp,
      network_port: overrides.network_port ?? networkPort,
      auto_cut: overrides.auto_cut ?? autoCut,
      header_message: overrides.header_message ?? headerMessage,
      footer_message: overrides.footer_message ?? footerMessage,
      feed_lines: overrides.feed_lines ?? feedLines
    };

    const newGlobalSettings = {
      ...(schoolData?.global_settings || {}),
      printer_settings: updatedPrinterSettings
    };

    setSchoolData({
      ...schoolData,
      global_settings: newGlobalSettings
    });

    try {
      localStorage.setItem('edunova_pos_receipt_format', updatedPrinterSettings.paper_width);
    } catch {}
  };

  const handleSelectType = (type: PrinterConnectionType) => {
    setPrinterType(type);
    updateSettingsInParent({ printer_type: type });
  };

  const handleSelectWidth = (width: ReceiptPaperWidth) => {
    setPaperWidth(width);
    updateSettingsInParent({ paper_width: width });
    try {
      localStorage.setItem('edunova_pos_receipt_format', width);
    } catch {}
  };

  const handleResetDefaults = () => {
    const defaultHeader = "ÉCONOMAT • REÇU CERTIFIÉ CONFORME";
    const defaultFooter = "Conservez ce reçu précieux pour tout contrôle légal ou réclamation.";
    setHeaderMessage(defaultHeader);
    setFooterMessage(defaultFooter);
    setFeedLines(3);
    setAutoCut(true);
    updateSettingsInParent({
      header_message: defaultHeader,
      footer_message: defaultFooter,
      feed_lines: 3,
      auto_cut: true
    });
    toast.success("Messages par défaut rétablis");
  };

  // Test d'impression réelle d'un ticket de calibrage
  const handlePrintTestTicket = () => {
    setIsPrintingTest(true);
    updateSettingsInParent();

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      toast.error("Veuillez autoriser les fenêtres pop-up pour lancer le test d'impression.");
      setIsPrintingTest(false);
      return;
    }

    const is58 = paperWidth === '58mm';
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Impression POS - ${paperWidth}</title>
          <meta charset="utf-8">
          <style>
            @page {
              size: ${paperWidth} auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: ${is58 ? '52mm' : '74mm'};
              margin: 0 auto;
              padding: 3mm;
              font-size: ${is58 ? '10px' : '12px'};
              color: black;
              background: white;
              line-height: 1.25;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-bottom: 1px dashed black; margin: 5px 0; }
            .double-divider { border-bottom: 2px solid black; margin: 5px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .badge { display: inline-block; border: 1px solid black; padding: 2px 5px; font-size: 9px; font-weight: bold; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: ${is58 ? '12px' : '14px'};">
            ${schoolData?.name || 'EDUNOVA PRO - ÉTABLISSEMENT'}
          </div>
          <div class="center" style="font-size: 9px; margin-top: 2px;">
            ${headerMessage || 'TEST CALIBRAGE IMPRIMANTE THERMIQUE'}
          </div>
          <div class="double-divider"></div>

          <div class="center">
            <span class="badge">TEST ÉTALONNAGE • ${paperWidth}</span>
          </div>

          <div class="row">
            <span>Date & Heure :</span>
            <span class="bold">${dateStr}</span>
          </div>
          <div class="row">
            <span>Connexion :</span>
            <span class="bold">${printerType}</span>
          </div>
          ${printerType === 'Network' ? `
            <div class="row">
              <span>Hôte IP :</span>
              <span class="bold">${networkIp}:${networkPort}</span>
            </div>
          ` : ''}
          <div class="row">
            <span>Modèle :</span>
            <span class="bold">${printerName || 'ESC/POS Standard'}</span>
          </div>
          <div class="row">
            <span>Auto-Cutter :</span>
            <span class="bold">${autoCut ? 'Activé' : 'Manuel'}</span>
          </div>

          <div class="divider"></div>

          <div class="center bold">ÉCHANTILLON D'ÉCRITURE</div>
          <div class="row"><span>Article Test 1</span><span>500 HTG</span></div>
          <div class="row"><span>Frais Scolarité Test</span><span>1 500 HTG</span></div>
          <div class="divider"></div>
          <div class="row bold" style="font-size: ${is58 ? '11px' : '13px'};">
            <span>TOTAL TEST :</span>
            <span>2 000 HTG</span>
          </div>

          <div class="double-divider"></div>

          <div class="center" style="font-size: 8.5px; font-style: italic;">
            ${footerMessage || 'Conservez ce ticket de test.'}
          </div>

          <div style="height: ${feedLines * 5}mm;"></div>
          ${autoCut ? '<div class="center" style="font-size: 7px; color: gray;">- - - DÉCOUPE AUTOMATIQUE - - -</div>' : ''}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 1500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setIsPrintingTest(false);
    toast.success(`Ticket test ${paperWidth} envoyé à l'imprimante.`);
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* HEADER SECTION COMPACTE & FLUIDE */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Printer size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Configuration Imprimante & Tickets Reçus
                </h3>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/70 inline-flex items-center gap-1">
                  <CheckCircle2 size={12} /> ESC/POS Thermique
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                Format {paperWidth} · Connexion {printerType} · Découpe {autoCut ? 'Auto' : 'Manuelle'}
              </p>
            </div>
          </div>

          {/* ACTIONS D'ENTÊTE */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setShowHelp(prev => !prev)}
              className={`p-2 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                showHelp 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
              title="Afficher/masquer le guide technique rapide"
            >
              <HelpCircle size={15} />
              <span className="hidden sm:inline">Guide</span>
            </button>

            <button
              type="button"
              onClick={handlePrintTestTicket}
              disabled={isPrintingTest}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer disabled:opacity-50"
              title="Imprimer un ticket de test réel"
            >
              <FileText size={14} className="text-indigo-600" />
              <span>Tester</span>
            </button>

            <button
              type="button"
              onClick={() => {
                updateSettingsInParent();
                if (handleUpdateSchool) handleUpdateSchool();
              }}
              disabled={saving || !canManageAllCampuses}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="animate-spin text-emerald-400" /> : <Save size={14} className="text-emerald-400" />}
              <span>Enregistrer</span>
            </button>
          </div>
        </div>

        {/* GUIDE TECHNIQUE DÉPLIABLE (SANS ENCOMBRER L'INTERFACE) */}
        {showHelp && (
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs text-slate-600 animate-in fade-in duration-200">
            <div className="p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100/70">
              <span className="font-bold text-indigo-900 flex items-center gap-1">
                <Usb size={13} /> USB Câble
              </span>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Connectez l'imprimante directement au PC caisse. Reconnue via le gestionnaire d'impression standard.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100/70">
              <span className="font-bold text-indigo-900 flex items-center gap-1">
                <Bluetooth size={13} /> Bluetooth Mobile
              </span>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Idéal pour tablettes tactiles et terminaux mobiles de poche. Appairage direct sans fil.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100/70">
              <span className="font-bold text-indigo-900 flex items-center gap-1">
                <Wifi size={13} /> Réseau Ethernet/IP
              </span>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Permet de partager une seule imprimante entre plusieurs postes de caisse via port Raw 9100.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CONTRÔLEUR D'ONGLET MOBILE (PARAMÈTRES VS APERÇU) */}
      <div className="flex lg:hidden bg-slate-100 p-1 rounded-lg border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveMobileView('form')}
          className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
            activeMobileView === 'form' 
              ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings2 size={13} />
          <span>Paramètres</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileView('preview')}
          className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
            activeMobileView === 'preview' 
              ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Eye size={13} />
          <span>Aperçu Ticket ({paperWidth})</span>
        </button>
      </div>

      {/* GRILLE PRINCIPALE RESPONSIVE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        
        {/* COLONNE GAUCHE : FORMULAIRES OPTIMISÉS ET COMPACTS (8 COLS DESKTOP) */}
        <div className={`space-y-3.5 sm:space-y-4 lg:col-span-7 xl:col-span-8 ${activeMobileView === 'preview' ? 'hidden lg:block' : 'block'}`}>
          
          {/* SECTION 1 : CONNEXION MATÉRIELLE */}
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">1</span>
                Type de Connexion
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                Mode actuel : <strong className="text-indigo-600">{printerType}</strong>
              </span>
            </div>

            {/* SÉLECTEUR SEGMENTÉ EN 3 BOUTONS COMPACTS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* USB */}
              <button
                type="button"
                onClick={() => handleSelectType('USB')}
                className={`p-2.5 rounded-lg border text-left transition-all flex items-center sm:flex-col sm:items-start gap-2.5 cursor-pointer ${
                  printerType === 'USB'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-1 ring-indigo-500/30'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-md shrink-0 ${printerType === 'USB' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Usb size={15} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">USB Câble</span>
                    {printerType === 'USB' && <Check size={12} className="text-indigo-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">Poste direct</p>
                </div>
              </button>

              {/* BLUETOOTH */}
              <button
                type="button"
                onClick={() => handleSelectType('Bluetooth')}
                className={`p-2.5 rounded-lg border text-left transition-all flex items-center sm:flex-col sm:items-start gap-2.5 cursor-pointer ${
                  printerType === 'Bluetooth'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-1 ring-indigo-500/30'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-md shrink-0 ${printerType === 'Bluetooth' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Bluetooth size={15} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">Bluetooth</span>
                    {printerType === 'Bluetooth' && <Check size={12} className="text-indigo-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">Tablette / Mobile</p>
                </div>
              </button>

              {/* RÉSEAU IP */}
              <button
                type="button"
                onClick={() => handleSelectType('Network')}
                className={`p-2.5 rounded-lg border text-left transition-all flex items-center sm:flex-col sm:items-start gap-2.5 cursor-pointer ${
                  printerType === 'Network'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-1 ring-indigo-500/30'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-md shrink-0 ${printerType === 'Network' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Wifi size={15} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">Réseau IP</span>
                    {printerType === 'Network' && <Check size={12} className="text-indigo-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">Partagée LAN</p>
                </div>
              </button>
            </div>

            {/* DÉTAILS RÉSEAU IP (INLINE CONDITIONNEL COMPACT) */}
            {printerType === 'Network' && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in duration-200">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Adresse IP Imprimante
                  </label>
                  <input
                    type="text"
                    value={networkIp}
                    onChange={(e) => {
                      setNetworkIp(e.target.value);
                      updateSettingsInParent({ network_ip: e.target.value });
                    }}
                    placeholder="192.168.1.200"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Port Raw ESC/POS
                  </label>
                  <input
                    type="text"
                    value={networkPort}
                    onChange={(e) => {
                      setNetworkPort(e.target.value);
                      updateSettingsInParent({ network_port: e.target.value });
                    }}
                    placeholder="9100"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            {/* MODÈLE DÉCLARÉ */}
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Modèle d'imprimante (Optionnel)
              </label>
              <input
                type="text"
                value={printerName}
                onChange={(e) => {
                  setPrinterName(e.target.value);
                  updateSettingsInParent({ printer_name: e.target.value });
                }}
                placeholder="Ex: Epson TM-T20III, Xprinter XP-N160M, Zjiang..."
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          {/* SECTION 2 : FORMAT PAPIER & DÉCOUPE */}
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">2</span>
                Format du Papier & Découpe
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                Largeur : <strong className="text-emerald-700">{paperWidth}</strong>
              </span>
            </div>

            {/* SÉLECTEUR 80MM VS 58MM COMPACT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 80 MM */}
              <button
                type="button"
                onClick={() => handleSelectWidth('80mm')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  paperWidth === '80mm'
                    ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-500/30'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">80 mm · Standard Caisse</span>
                  {paperWidth === '80mm' && (
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <Check size={13} /> Actif
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Recommandé pour l'économat principal. 48 colonnes, bidevise et QR Code haute lisibilité.
                </p>
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Largeur utile: 72-76mm</span>
                  <span>48 col.</span>
                </div>
              </button>

              {/* 58 MM */}
              <button
                type="button"
                onClick={() => handleSelectWidth('58mm')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  paperWidth === '58mm'
                    ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-500/30'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">58 mm · Compact Mobile</span>
                  {paperWidth === '58mm' && (
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <Check size={13} /> Actif
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Format économique pour imprimantes de poche et guichets rapides. 32 colonnes.
                </p>
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Largeur utile: 48-52mm</span>
                  <span>32 col.</span>
                </div>
              </button>
            </div>

            {/* DÉCOUPE AUTO & LIGNES DE MARGE INLINE */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCut}
                  onChange={(e) => {
                    setAutoCut(e.target.checked);
                    updateSettingsInParent({ auto_cut: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Scissors size={14} className="text-slate-500" /> Découpe automatique (Auto-Cutter)
                </span>
              </label>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="text-[11px] font-medium text-slate-500">Marge finale :</span>
                <select
                  value={feedLines}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFeedLines(val);
                    updateSettingsInParent({ feed_lines: val });
                  }}
                  aria-label="Marge finale en lignes de saut de papier"
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value={1}>1 ligne (Court)</option>
                  <option value={2}>2 lignes</option>
                  <option value={3}>3 lignes (Standard)</option>
                  <option value={4}>4 lignes</option>
                  <option value={5}>5 lignes (Aéré)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3 : PERSONNALISATION DES MESSAGES DU TICKET */}
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">3</span>
                Messages & Mentions Légales
              </span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer"
                title="Rétablir les messages d'origine"
              >
                <RotateCcw size={12} />
                <span>Rétablir par défaut</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Sous-titre d'en-tête
                </label>
                <input
                  type="text"
                  value={headerMessage}
                  onChange={(e) => {
                    setHeaderMessage(e.target.value);
                    updateSettingsInParent({ header_message: e.target.value });
                  }}
                  placeholder="ÉCONOMAT • REÇU CERTIFIÉ CONFORME"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Message de pied de reçu
                </label>
                <input
                  type="text"
                  value={footerMessage}
                  onChange={(e) => {
                    setFooterMessage(e.target.value);
                    updateSettingsInParent({ footer_message: e.target.value });
                  }}
                  placeholder="Conservez ce reçu précieux pour tout contrôle légal ou réclamation."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : APERÇU THERMIQUE DENSE, STICKY & RÉACTIF (4-5 COLS DESKTOP) */}
        <div className={`lg:col-span-5 xl:col-span-4 ${activeMobileView === 'form' ? 'hidden lg:block' : 'block'}`}>
          <div className="lg:sticky lg:top-4 bg-slate-900 text-white rounded-xl p-3.5 sm:p-4 border border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Eye size={13} className="text-emerald-400" /> Rendu en Direct
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                {paperWidth} · {printerType}
              </span>
            </div>

            {/* FEUILLE DU TICKET THERMIQUE AVEC STYLE IMPRIMANTE CAISSE */}
            <div className={`mx-auto bg-white text-black p-3 rounded font-mono shadow-md border border-slate-300 leading-snug transition-all ${
              paperWidth === '58mm' ? 'max-w-[210px] text-[9.5px]' : 'max-w-[260px] text-[10px]'
            }`}>
              <div className="text-center font-bold text-xs truncate">
                {schoolData?.name || 'EDUNOVA PRO ACADEMY'}
              </div>
              <div className="text-center text-[8.5px] text-gray-600 mt-0.5 line-clamp-1">
                {headerMessage || 'ÉCONOMAT • REÇU CERTIFIÉ CONFORME'}
              </div>
              <div className="border-b border-black my-1.5 border-dashed"></div>

              <div className="flex justify-between text-[9px]">
                <span>Reçu N°:</span>
                <span className="font-bold">RCP-2026-0042</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span>Date:</span>
                <span>{new Date().toLocaleDateString('fr-FR')} 10:30</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span>Élève:</span>
                <span className="font-bold truncate max-w-[120px]">JEAN-BAPTISTE P.</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span>Classe:</span>
                <span>3ème Fondamentale</span>
              </div>

              <div className="border-b border-black my-1.5 border-dashed"></div>

              <div className="flex justify-between font-bold">
                <span>Frais Scolarité :</span>
                <span>5 000 HTG</span>
              </div>
              <div className="flex justify-between text-[8.5px] text-gray-600">
                <span>Mode:</span>
                <span>Cash / Espèces</span>
              </div>

              <div className="border-b-2 border-black my-1.5"></div>

              <div className="flex justify-between font-black text-xs">
                <span>PAYÉ :</span>
                <span>5 000 HTG</span>
              </div>

              {/* QR CODE COMPACT */}
              <div className="my-2 p-1.5 bg-gray-50 border border-black/30 text-center rounded">
                <div className="w-10 h-10 bg-gray-200 mx-auto flex items-center justify-center text-[7.5px] font-bold border border-black">
                  QR CODE
                </div>
                <div className="text-[7px] font-bold mt-0.5 text-gray-700">CERTIFIÉ AUTHENTIQUE</div>
              </div>

              <div className="text-center text-[7.5px] italic text-gray-600 mt-1 line-clamp-2">
                {footerMessage || 'Conservez ce reçu précieux pour tout contrôle légal ou réclamation.'}
              </div>

              {autoCut && (
                <div className="text-center text-[7px] text-gray-400 mt-1.5 border-t border-dashed border-gray-300 pt-1">
                  - - - DÉCOUPE AUTOMATIQUE - - -
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>{paperWidth === '58mm' ? 'Rouleau 58mm (32 col)' : 'Rouleau 80mm (48 col)'}</span>
              <button
                type="button"
                onClick={handlePrintTestTicket}
                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Printer size={12} />
                <span>Tester</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
