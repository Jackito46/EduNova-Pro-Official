export interface ReportCardGrade {
  name: string;
  coef: number;
  note: number | null;
  annualNote?: number | null;
  termScores?: Record<string, number | null> | null;
  teacherName?: string;
  appreciation?: string;
}

export interface ReportCardStudent {
  id: string;
  name: string;
  nisu: string;
  class: string;
  classId?: string;
  campusId?: string;
  campusName?: string;
  total: number;
  totalCoef: number;
  average: number;
  annualAverage?: number;
  base?: number | null;
  isMaxPointsSystem?: boolean;
  isMaternelle?: boolean;
  grades: ReportCardGrade[];
  place: string;
  classAverage: number;
  gender?: string;
  birthDate?: string;
  photoUrl?: string;
}

export interface ReportCardOptions {
  showRank: boolean;
  showClassAverage: boolean;
  showQrCode: boolean;
  showStamp: boolean;
  showDecision: boolean;
  showHonorsBadge: boolean;
  density: 'auto' | 'confort' | 'dense' | 'super-dense';
  colorTheme: 'navy' | 'classic' | 'emerald' | 'burgundy';
  colorMode?: 'monochrome' | 'color';
}
