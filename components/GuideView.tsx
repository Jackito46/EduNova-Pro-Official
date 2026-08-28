import React, { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { HelpCircle, ArrowLeft, BookOpen, Download, Printer, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { fixOklchForCanvas } from '../utils/pdfFix';
import { toast } from 'sonner';

const GuideView: React.FC = () => {
  const navigate = useNavigate();
  const guideRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!guideRef.current) return;
    
    const toastId = toast.loading("Génération du PDF (Format A4) en cours...");
    
    try {
      const element = guideRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800, // Fixed width to ensure consistent layout
        onclone: (clonedDoc) => {
          fixOklchForCanvas(clonedDoc);
          try {
            const styles = clonedDoc.querySelectorAll('style, link');
            styles.forEach(s => s.remove());

            const style = clonedDoc.createElement('style');
            style.innerHTML = `
              * { box-sizing: border-box !important; }
              body { background: white !important; width: 800px !important; margin: 0 !important; }
              .prose h1 { font-size: 28px !important; margin-bottom: 15px !important; color: #111827 !important; font-weight: bold !important; }
              .prose h2 { font-size: 22px !important; margin-top: 25px !important; margin-bottom: 12px !important; color: #111827 !important; font-weight: bold !important; border-bottom: 1px solid #e5e7eb !important; padding-bottom: 8px !important; }
              .prose h3 { font-size: 18px !important; margin-top: 20px !important; margin-bottom: 10px !important; color: #111827 !important; font-weight: bold !important; }
              .prose p { font-size: 14px !important; line-height: 1.6 !important; margin-bottom: 12px !important; color: #374151 !important; }
              .prose ul { padding-left: 20px !important; margin-bottom: 12px !important; list-style-type: disc !important; }
              .prose li { font-size: 14px !important; margin-bottom: 6px !important; color: #374151 !important; }
              .prose img { max-width: 100% !important; border-radius: 12px !important; margin: 15px 0 !important; display: block !important; }
              .prose hr { border: 0 !important; border-top: 1px solid #e5e7eb !important; margin: 25px 0 !important; }
              
              .bg-\\[\\#1e3a8a\\] { background-color: #1e3a8a !important; color: white !important; padding: 30px !important; border-radius: 20px !important; display: block !important; margin-bottom: 20px !important; }
              .text-\\[\\#ffffff\\] { color: white !important; }
              .text-\\[\\#dbeafe\\] { color: #dbeafe !important; }
              .flex { display: flex !important; align-items: center !important; gap: 20px !important; }
              .w-16 { width: 50px !important; height: 50px !important; }
              .rounded-2xl { border-radius: 12px !important; }
              .bg-white\\/20 { background-color: rgba(255, 255, 255, 0.2) !important; }
              .text-3xl { font-size: 24px !important; font-weight: bold !important; }
              
              .print\\:hidden { display: none !important; }
            `;
            clonedDoc.head.appendChild(style);
          } catch (e) {
            console.error("Error in onclone:", e);
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Calculate how much of the canvas height fits on one PDF page
      const pageHeightInCanvasPixels = (canvasWidth * pdfHeight) / pdfWidth;
      
      let heightLeft = canvasHeight;
      let position = 0;
      
      // Add the first page
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, (canvasHeight * pdfWidth) / canvasWidth);
      heightLeft -= pageHeightInCanvasPixels;
      
      // Add subsequent pages if content is longer than one A4 page
      while (heightLeft > 0) {
        position = heightLeft - canvasHeight; // This moves the image up for the next page
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position * (pdfWidth / canvasWidth), pdfWidth, (canvasHeight * pdfWidth) / canvasWidth);
        heightLeft -= pageHeightInCanvasPixels;
      }
      
      pdf.save('Guide_Utilisateur_EduNova_Pro.pdf');
      toast.success("PDF A4 généré avec succès !", { id: toastId });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erreur lors de la génération du PDF. Utilisez 'Imprimer' pour un résultat garanti.", { id: toastId });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const guideContent = `
# 📘 Guide Utilisateur - EduNova Pro v3.5

![EduNova Header](https://images.unsplash.com/photo-1523050335102-c3250d85740a?auto=format&fit=crop&q=80&w=1200&h=400)

Bienvenue dans le guide officiel d'utilisation d'**EduNova Pro**. Ce document est conçu pour vous aider à naviguer et à exploiter pleinement les fonctionnalités du système selon votre profil.

---

## 🏛️ 1. Administration (Directeur, Secrétaire, Comptable)

![Administration](https://images.unsplash.com/photo-1454165833767-027ffea9e778?auto=format&fit=crop&q=80&w=800&h=300)

### 📝 Inscriptions & Vie Scolaire
*   **Inscription Administrative :** Allez dans \`Vie Scolaire > Inscription Administrative\`. Remplissez le dossier de l'élève (Identité, Parents, Photo). Le système génère automatiquement un matricule unique.
*   **Registre Élèves :** Consultez la liste complète, filtrez par classe ou par cycle (Maternelle, Fondamentale, Secondaire).
*   **Bulletins de Notes :** Dans \`Rapports > Bulletins\`, générez les bulletins par classe ou par élève. Le système adapte automatiquement la mise en page selon le nombre de matières (Mode Dense pour >14 matières).

### 💰 Gestion Financière (Économat)
*   **Encaissement :** Recherchez un élève, sélectionnez le type de frais (Scolarité, Fournitures, etc.) et validez le paiement. Un reçu professionnel est généré instantanément.
*   **Suivi des Impayés :** Utilisez le \`Suivi des Paiements\` pour voir en un coup d'œil qui est à jour et qui a des reliquats.
*   **Dépenses :** Enregistrez toutes les sorties de fonds (Salaires, Maintenance, Matériel) pour maintenir un bilan net précis.

---

## 👨‍🏫 2. Corps Enseignant

![Enseignants](https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=800&h=300)

### 🖊️ Gestion des Cours
*   **Pointage & Signature :** À la fin de chaque cours, connectez-vous pour signer votre séance. Le système récupère automatiquement votre horaire du jour. Indiquez le sujet traité et le nombre d'élèves présents.
*   **Emploi du Temps :** Consultez votre planning hebdomadaire mis à jour en temps réel par la direction.

### 📈 Évaluations
*   **Saisie des Notes :** Sélectionnez votre classe et la période (Contrôle 1, 2, etc.). Saisissez les notes directement. Le système calcule les moyennes automatiquement.
*   **Note :** Les enseignants ne peuvent saisir des notes que pour la **session active**. Les sessions passées sont verrouillées (lecture seule).

---

## 👪 3. Espace Parents & Élèves

![Famille](https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&q=80&w=800&h=300)

### 🔍 Suivi de l'Enfant
*   **Finances :** Consultez l'historique des paiements effectués et le solde restant pour chaque enfant. Téléchargez vos reçus à tout moment.
*   **Résultats :** Accédez aux notes et téléchargez le bulletin de notes dès qu'il est publié par la direction.
*   **Horaire :** Vérifiez l'emploi du temps de vos enfants pour mieux organiser leur travail à la maison.

---

## 💡 4. Conseils d'Expert pour une Gestion Optimale

*   **Synchronisation Quotidienne :** Encouragez les enseignants à signer leurs cours le jour même pour maintenir un journal de classe précis.
*   **Vérification des Reliquats :** Effectuez un point financier chaque fin de semaine via le module \`Suivi des Paiements\` pour anticiper les rappels aux parents.
*   **Sauvegarde & Sécurité :** Ne partagez jamais vos identifiants. Le système trace chaque action pour votre sécurité et celle de l'établissement.

---

## 🛡️ Sécurité & Confidentialité
*   **Multi-Établissement :** Vos données sont strictement isolées. Seuls les membres de votre école y ont accès.
*   **Déconnexion Automatique :** Pour protéger vos données, le système vous déconnectera après une période d'inactivité.
*   **Signatures Horodatées :** Toutes les actions critiques (signatures de cours, modifications de notes) sont tracées pour éviter toute fraude.

---
*EduNova Pro - L'excellence au service de l'éducation.*
  `;

  return (
    <div className="min-h-screen bg-[#f9fafb] pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#6b7280] hover:text-[#111827] transition-colors mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold text-sm">Retour</span>
        </button>

        <div className="bg-[#ffffff] rounded-3xl shadow-xl shadow-blue-900/5 border border-[#f3f4f6] overflow-hidden" ref={guideRef}>
          <div className="bg-[#1e3a8a] p-10 text-[#ffffff] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
            <div className="relative z-10 flex items-center gap-6">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30">
                <BookOpen size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Centre d'Aide</h1>
                <p className="text-[#dbeafe] mt-1 font-medium italic opacity-80">Guide complet d'utilisation du système</p>
              </div>
            </div>
          </div>

          <div className="p-10 prose prose-indigo max-w-none prose-headings:text-[#111827] prose-p:text-[#4b5563] prose-li:text-[#4b5563] prose-hr:border-[#f3f4f6]">
            <div className="flex justify-end gap-3 mb-8 print:hidden">
               <button 
                 onClick={handlePrint}
                 className="flex items-center gap-2 px-4 py-2 bg-[#f9fafb] text-[#4b5563] rounded-xl hover:bg-[#f3f4f6] transition-all text-xs font-bold border border-[#e5e7eb]"
               >
                 <Printer size={14} /> Imprimer
               </button>
               <button 
                 onClick={handleDownloadPDF}
                 className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-[#ffffff] rounded-xl hover:bg-[#1d4ed8] transition-all text-xs font-bold shadow-lg shadow-blue-600/20"
               >
                 <FileText size={14} /> Télécharger PDF
               </button>
            </div>
            <ReactMarkdown>{guideContent}</ReactMarkdown>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400 font-bold tracking-widest uppercase">
            EduNova Pro v3.5 • Support Technique • 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default GuideView;
