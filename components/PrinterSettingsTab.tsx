import React, { useState } from 'react';
import { 
  Printer, 
  Usb, 
  Bluetooth, 
  Wifi, 
  Sliders, 
  Check, 
  Save, 
  Loader2, 
  Sparkles, 
  Info, 
  AlertCircle, 
  Scissors, 
  FileText, 
  Layers,
  Smartphone,
  Building2,
  RefreshCw
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
      ...(schoolData.global_settings || {}),
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

  // Test d'impression réelle d'un ticket de calibrage
  const handlePrintTestTicket = () => {
    setIsPrintingTest(true);
    updateSettingsInParent();

    // Rendu d'une fenêtre d'impression pour ticket de test
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
              font-family: 'Courier New', Courier, monospace, monospace;
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
            .divider { border-bottom: 1px dashed black; margin: 6px 0; }
            .double-divider { border-bottom: 2px solid black; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .badge { display: inline-block; border: 1px solid black; padding: 2px 4px; font-size: 9px; font-weight: bold; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: ${is58 ? '12px' : '15px'};">
            ${schoolData?.name || 'EDUNOVA PRO - ÉTABLISSEMENT'}
          </div>
          <div class="center" style="font-size: 9px; margin-top: 2px;">
            ${headerMessage || 'TEST CALIBRAGE IMPRIMANTE THERMIQUE'}
          </div>
          <div class="double-divider"></div>

          <div class="center">
            <span class="badge">TEST REUSSI • ${paperWidth}</span>
          </div>

          <div class="row">
            <span>Date & Heure :</span>
            <span class="bold">${dateStr}</span>
          </div>
          <div class="row">
            <span>Type Connexion :</span>
            <span class="bold">${printerType}</span>
          </div>
          ${printerType === 'Network' ? `
            <div class="row">
              <span>IP Imprimante :</span>
              <span class="bold">${networkIp}:${networkPort}</span>
            </div>
          ` : ''}
          <div class="row">
            <span>Modèle déclaré :</span>
            <span class="bold">${printerName || 'Standard ESC/POS'}</span>
          </div>
          <div class="row">
            <span>Auto-Cutter :</span>
            <span class="bold">${autoCut ? 'ACTIVÉ (Auto)' : 'MANUEL'}</span>
          </div>

          <div class="divider"></div>

          <div class="center bold">ÉCHANTILLON D'ÉCRITURE</div>
          <div class="row"><span>Article Test 1</span><span>500 HTG</span></div>
          <div class="row"><span>Frais Écolage Test</span><span>1 500 HTG</span></div>
          <div class="divider"></div>
          <div class="row bold" style="font-size: ${is58 ? '11px' : '13px'};">
            <span>TOTAL TEST :</span>
            <span>2 000 HTG</span>
          </div>

          <div class="double-divider"></div>

          <div class="center" style="font-size: 8.5px; font-style: italic;">
            ${footerMessage || 'Conservez ce ticket de test.'}
          </div>

          <div style="height: ${feedLines * 6}mm;"></div>
          ${autoCut ? '<div class="center" style="font-size: 7px; color: gray;">- - - LIGNE DE DÉCOUPE AUTOMATIQUE - - -</div>' : ''}
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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Printer size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Configuration Imprimante & Tickets Reçus
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                ESC/POS Thermique
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Définissez le type de connexion matérielle et la largeur du rouleau papier utilisée pour tous les reçus de caisse de l'école.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrintTestTicket}
            disabled={isPrintingTest}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-200 cursor-pointer"
            title="Imprimer un ticket d'étalonnage pour tester votre imprimante thermique"
          >
            <FileText size={14} className="text-indigo-600" />
            <span>Tester l'impression</span>
          </button>

          <button
            type="button"
            onClick={() => {
              updateSettingsInParent();
              if (handleUpdateSchool) handleUpdateSchool();
            }}
            disabled={saving || !canManageAllCampuses}
            className="px-5 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin text-emerald-400" /> : <Save size={14} className="text-emerald-400" />}
            <span>Enregistrer</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLONNE GAUCHE (2/3) : PARAMÉTRAGE MATÉRIEL */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. TYPE DE CONNEXION */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-black uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">1</span>
                <span>Type de Connexion Imprimante</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 mt-1">
                Comment l'imprimante est-elle reliée au poste de travail ?
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* OPTION USB */}
              <button
                type="button"
                onClick={() => handleSelectType('USB')}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-3 cursor-pointer ${
                  printerType === 'USB'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${printerType === 'USB' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Usb size={18} />
                  </div>
                  {printerType === 'USB' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">USB (Câble direct)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Standard caisse de bureau. Branchement par port USB / Câble direct PC ou laptop.
                  </p>
                </div>
              </button>

              {/* OPTION BLUETOOTH */}
              <button
                type="button"
                onClick={() => handleSelectType('Bluetooth')}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-3 cursor-pointer ${
                  printerType === 'Bluetooth'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${printerType === 'Bluetooth' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Bluetooth size={18} />
                  </div>
                  {printerType === 'Bluetooth' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">Bluetooth (Sans-fil)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Idéal pour tablettes, smartphones ou mini-imprimantes mobiles de poche.
                  </p>
                </div>
              </button>

              {/* OPTION RÉSEAU / ETHERNET */}
              <button
                type="button"
                onClick={() => handleSelectType('Network')}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-3 cursor-pointer ${
                  printerType === 'Network'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${printerType === 'Network' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Wifi size={18} />
                  </div>
                  {printerType === 'Network' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">Réseau (Ethernet / IP)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Imprimante partagée via switch réseau ou Wi-Fi interne de l'école.
                  </p>
                </div>
              </button>
            </div>

            {/* DÉTAILS SI RÉSEAU IP */}
            {printerType === 'Network' && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Adresse IP de l'imprimante
                  </label>
                  <input
                    type="text"
                    value={networkIp}
                    onChange={(e) => {
                      setNetworkIp(e.target.value);
                      updateSettingsInParent({ network_ip: e.target.value });
                    }}
                    placeholder="Ex: 192.168.1.150"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Port Raw ESC/POS (Par défaut: 9100)
                  </label>
                  <input
                    type="text"
                    value={networkPort}
                    onChange={(e) => {
                      setNetworkPort(e.target.value);
                      updateSettingsInParent({ network_port: e.target.value });
                    }}
                    placeholder="9100"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Nom ou modèle de l'imprimante (Optionnel)
              </label>
              <input
                type="text"
                value={printerName}
                onChange={(e) => {
                  setPrinterName(e.target.value);
                  updateSettingsInParent({ printer_name: e.target.value });
                }}
                placeholder="Ex: Epson TM-T20III, Xprinter XP-N160M, Zjiang 58, Star Micronics..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          {/* 2. LARGEUR DU PAPIER THERMIQUE (58MM OU 80MM) */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-black uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">2</span>
                <span>Largeur du Rouleau Papier (Reçus)</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 mt-1">
                Sélectionnez le format exact du papier thermique inséré dans votre appareil
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* OPTION 80MM */}
              <button
                type="button"
                onClick={() => handleSelectWidth('80mm')}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-3 cursor-pointer ${
                  paperWidth === '80mm'
                    ? 'bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-black text-xs">
                    80 mm (Standard POS)
                  </span>
                  {paperWidth === '80mm' && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <Check size={14} /> Actif
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">Format Grand Rouleau (80 mm)</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    <strong>Recommandé pour l'économat et la caisse principale.</strong> Offre 48 colonnes d'affichage, une lisibilité optimale, le détail bidevise complet (HTG/USD) et un QR Code haute définition.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-600 font-mono">
                  <span>Largeur utile: ~72-76mm</span>
                  <span>48 colonnes</span>
                </div>
              </button>

              {/* OPTION 58MM */}
              <button
                type="button"
                onClick={() => handleSelectWidth('58mm')}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-3 cursor-pointer ${
                  paperWidth === '58mm'
                    ? 'bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-slate-800 text-white font-black text-xs">
                    58 mm (Compact Mobile)
                  </span>
                  {paperWidth === '58mm' && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <Check size={14} /> Actif
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">Format Rouleau Étroit (58 mm)</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    <strong>Format compact et économique.</strong> Convient aux imprimantes de poche Bluetooth et petits guichets. Affichage concentré sur 32 colonnes avec QR code adapté.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-600 font-mono">
                  <span>Largeur utile: ~48-52mm</span>
                  <span>32 colonnes</span>
                </div>
              </button>
            </div>
          </div>

          {/* 3. OPTIONS D'ÉDITION ET DÉCOUPE */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-black uppercase tracking-wider">
              <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">3</span>
              <span>Découpe et Messages Personnalisés</span>
            </div>

            <div className="space-y-4">
              {/* AUTO-CUT TOGGLE */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700">
                    <Scissors size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Découpe automatique du ticket (Auto-cutter)</p>
                    <p className="text-[11px] text-slate-500">
                      Envoie l'instruction de coupe automatique à la fin de l'émission du reçu
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCut}
                    onChange={(e) => {
                      setAutoCut(e.target.checked);
                      updateSettingsInParent({ auto_cut: e.target.checked });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* MESSAGES PERSONNALISÉS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Sous-titre d'entête du ticket
                  </label>
                  <input
                    type="text"
                    value={headerMessage}
                    onChange={(e) => {
                      setHeaderMessage(e.target.value);
                      updateSettingsInParent({ header_message: e.target.value });
                    }}
                    placeholder="Ex: ÉCONOMAT • REÇU OFFICIEL"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Message de pied de ticket
                  </label>
                  <input
                    type="text"
                    value={footerMessage}
                    onChange={(e) => {
                      setFooterMessage(e.target.value);
                      updateSettingsInParent({ footer_message: e.target.value });
                    }}
                    placeholder="Ex: Conservez ce reçu précieux pour tout recours."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE (1/3) : APERÇU DYNAMIQUE DU TICKET */}
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText size={13} className="text-emerald-400" /> Aperçu du Rendu Ticket
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {paperWidth} • {printerType}
              </span>
            </div>

            {/* SIMULATEUR TICKET THERMIQUE */}
            <div className={`mx-auto bg-white text-black p-3.5 rounded-lg font-mono text-[10.5px] shadow-lg border border-slate-300 leading-snug transition-all ${
              paperWidth === '58mm' ? 'max-w-[210px] text-[9.5px]' : 'max-w-[270px]'
            }`}>
              <div className="text-center font-bold text-xs">
                {schoolData?.name || 'EDUNOVA PRO ACADEMY'}
              </div>
              <div className="text-center text-[8.5px] text-gray-600 mt-0.5">
                {headerMessage || 'ÉCONOMAT • REÇU CERTIFIÉ CONFORME'}
              </div>
              <div className="border-b border-black my-1.5 border-dashed"></div>

              <div className="flex justify-between text-[9px]">
                <span>Réf:</span>
                <span className="font-bold">RCP-2026-0042</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span>Date:</span>
                <span>{new Date().toLocaleDateString('fr-FR')} 10:30</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span>Élève:</span>
                <span className="font-bold truncate max-w-[120px]">JEAN-BAPTISTE Pierre</span>
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
              <div className="flex justify-between text-[8.5px] text-gray-700">
                <span>Mode:</span>
                <span>Cash / Espèces</span>
              </div>

              <div className="border-b-2 border-black my-1.5"></div>

              <div className="flex justify-between font-black text-xs">
                <span>PAYÉ :</span>
                <span>5 000 HTG</span>
              </div>

              <div className="my-2 p-1.5 bg-gray-50 border border-black/30 text-center rounded">
                <div className="w-12 h-12 bg-gray-200 mx-auto flex items-center justify-center text-[8px] font-bold border border-black">
                  QR CODE
                </div>
                <div className="text-[7px] font-bold mt-0.5">VÉRIFIÉ AUTHENTIQUE</div>
              </div>

              <div className="text-center text-[7.5px] italic text-gray-700 mt-1">
                {footerMessage || 'Conservez ce reçu précieux.'}
              </div>

              {autoCut && (
                <div className="text-center text-[7px] text-gray-400 mt-2 border-t border-dashed border-gray-300 pt-1">
                  - - - DÉCOUPE AUTO - - -
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handlePrintTestTicket}
              className="w-full mt-4 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Printer size={14} />
              <span>Lancer le test sur mon imprimante</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
