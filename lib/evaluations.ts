import { SchoolClass, SchoolType } from '../types';

export const getExamsListForClass = (currentCls: SchoolClass | undefined, schoolType: string | undefined): string[] => {
  let examsCount = 4;
  let periodFormat = '';
  
  if (currentCls && currentCls.description && currentCls.description.startsWith('{')) {
    try {
      const parsed = JSON.parse(currentCls.description);
      if (parsed.examsCount && !isNaN(parsed.examsCount)) {
        examsCount = parsed.examsCount;
      }
      if (parsed.periodFormat) {
        periodFormat = parsed.periodFormat;
      }
    } catch (e) {
      // ignore
    }
  }

  // Si non défini dans JSON, fallback basé sur type d'établissement
  if (!periodFormat) {
    if (schoolType === 'UNIVERSITY') {
      periodFormat = 'SEMESTRE_INTRA';
    } else if (schoolType === 'PROFESSIONAL') {
      periodFormat = 'CONTROLE';
    } else {
      periodFormat = 'CONTROLE'; // ou TRIMESTRE si on voulait par défaut classique
    }
  }

  const list: string[] = [];
  
  if (periodFormat === 'SEMESTRE_INTRA') {
    if (examsCount === 2) return ["Semestre 1 - Final", "Semestre 2 - Final"];
    if (examsCount === 3) return ["Semestre 1 - Intra", "Semestre 1 - Final", "Semestre 2 - Final"];
    if (examsCount === 4) return ["Semestre 1 - Intra", "Semestre 1 - Final", "Semestre 2 - Intra", "Semestre 2 - Final"];
    if (examsCount === 6) return ["S1 - Intra", "S1 - Final", "S2 - Intra", "S2 - Final", "S3 - Intra", "S3 - Final"];
    
    // Fallback if custom
    for (let i = 1; i <= Math.ceil(examsCount / 2); i++) {
        list.push(`Semestre ${i} - Intra`);
        list.push(`Semestre ${i} - Final`);
    }
    return list.slice(0, examsCount); // Truncate to exact count
  }
  
  if (periodFormat === 'SEMESTRE') {
    for(let i=1; i<=examsCount; i++) {
        list.push(`Semestre ${i}`);
    }
    return list;
  }
  
  if (periodFormat === 'TRIMESTRE') {
    for(let i=1; i<=examsCount; i++) {
        list.push(`${i}${i===1?'er':'e'} Trimestre`);
    }
    return list;
  }
  
  // Default: CONTROLE
  for(let i=1; i<=examsCount; i++) {
    if (schoolType === 'UNIVERSITY' || schoolType === 'PROFESSIONAL') {
      list.push(`Évaluation ${i}`);
    } else {
      list.push(`${i}${i===1?'er':'e'} Contrôle`);
    }
  }
  return list;
};
