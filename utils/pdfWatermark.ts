import { jsPDF } from 'jspdf';
import { UserProfile } from '../types';

interface WatermarkOptions {
  user: UserProfile;
  ipAddress: string | null;
}

export const addSecurityWatermark = (doc: jsPDF, options: WatermarkOptions) => {
  const { user, ipAddress } = options;
  const pageCount = doc.getNumberOfPages();
  const dateStr = new Date().toLocaleString('fr-FR');
  const watermarkText = `Généré par: ${user.full_name} | Date: ${dateStr} | IP: ${ipAddress || 'Inconnue'} | Confidentiel EduNova`;

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
    doc.saveGraphicsState();
    const GState: any = (doc as any).GState;
    doc.setGState(new GState({opacity: 0.15}));
    doc.setFontSize(24);
    // Rotate 45 degrees
    // The rotation origin is the text coordinate
    doc.text(watermarkText, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();

    // Restore state
    doc.setFontSize(currentFontSize);
    doc.setTextColor(currentTextColor);
  }
};
