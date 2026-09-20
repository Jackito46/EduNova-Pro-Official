import { jsPDF } from 'jspdf';
import { UserProfile } from '../types';

interface WatermarkOptions {
  user?: UserProfile | null;
  ipAddress?: string | null;
}

export const addSecurityWatermark = (doc: jsPDF, options: WatermarkOptions) => {
  try {
    const { user, ipAddress } = options;
    const pageCount = doc.getNumberOfPages();
    const dateStr = new Date().toLocaleString('fr-FR');
    const userName = user?.full_name || user?.email || 'EduNova Pro';
    const watermarkText = `Généré par: ${userName} | Date: ${dateStr} | IP: ${ipAddress || 'Inconnue'} | Confidentiel EduNova`;

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Save current state
      const currentFontSize = doc.getFontSize();
      const currentTextColor = doc.getTextColor();

      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200); // Very light gray
      
      // Add watermark at the bottom of the page
      const pageSize = doc.internal.pageSize;
      const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
      
      // Print in the bottom margin, centered
      doc.text(watermarkText, pageWidth / 2, pageHeight - 5, { align: 'center' });
      
      // Add a diagonal hidden/very faint watermark across the middle
      try {
        doc.saveGraphicsState();
        const GState: any = (doc as any).GState;
        if (GState) {
          doc.setGState(new GState({opacity: 0.15}));
        }
        doc.setFontSize(24);
        doc.text(watermarkText, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
        doc.restoreGraphicsState();
      } catch {
        // Fallback if GState is not available
      }

      // Restore state
      doc.setFontSize(currentFontSize);
      doc.setTextColor(currentTextColor);
    }
  } catch (err) {
    console.warn('Erreur lors de l\'ajout du filigrane de sécurité:', err);
  }
};
