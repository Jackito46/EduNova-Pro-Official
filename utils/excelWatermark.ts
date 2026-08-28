import * as XLSX from 'xlsx';
import { UserProfile } from '../types';

interface WatermarkOptions {
  user: UserProfile;
  ipAddress: string | null;
}

export const appendSecuritySheet = (wb: XLSX.WorkBook, options: WatermarkOptions) => {
  const { user, ipAddress } = options;
  const dateStr = new Date().toLocaleString('fr-FR');
  
  const securityData = [
    ["CONFIDENTIEL EDUNOVA"],
    [""],
    ["Ce document est protégé et son utilisation est restreinte."],
    ["Toute fuite de ce document fera l'objet de poursuites."],
    [""],
    ["Informations de traçabilité :"],
    ["Généré par", user.full_name],
    ["Email", user.email],
    ["Date de génération", dateStr],
    ["Adresse IP", ipAddress || 'Inconnue'],
    ["ID Utilisateur", user.id]
  ];

  const ws = XLSX.utils.aoa_to_sheet(securityData);
  XLSX.utils.book_append_sheet(wb, ws, "Securité");
};
