import { jsPDF } from 'jspdf';
import { UserProfile } from '../types';

interface WatermarkOptions {
  user?: UserProfile | null;
  ipAddress?: string | null;
  enabled?: boolean;
}

/**
 * Gestion du filigrane de sécurité des documents PDF.
 * Désactivé pour garantir des documents administratifs et académiques sains,
 * nets et totalement vierges de filigranes diagonaux, de mentions de date d'impression
 * ou d'annonces publicitaires dans le corps et le pied de page.
 */
export const addSecurityWatermark = (_doc: jsPDF, _options?: WatermarkOptions) => {
  // Volontairement sans effet : supprime tout filigrane diagonal, date d'impression
  // et mention publicitaire/confidentielle dans le pied des documents générés.
};

