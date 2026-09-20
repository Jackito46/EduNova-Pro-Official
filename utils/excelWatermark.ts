import * as XLSX from 'xlsx';
import { UserProfile } from '../types';

interface WatermarkOptions {
  user?: UserProfile | null;
  ipAddress?: string | null;
}

export const appendSecuritySheet = (_wb: XLSX.WorkBook, _options?: WatermarkOptions) => {
  // Volontairement sans effet pour garder des fichiers tableurs sains et sans feuille de traçabilité intrusive.
};

