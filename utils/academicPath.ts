export interface ClassPathItem {
  name: string;
  minAge: number;
  maxAge: number;
  recommendedAge: number;
}

export const ACADEMIC_PATH: Record<string, ClassPathItem[]> = {
  MATERNELLE: [
    { name: 'Petite Section', minAge: 2, maxAge: 4, recommendedAge: 3 },
    { name: 'Moyenne Section', minAge: 3, maxAge: 5, recommendedAge: 4 },
    { name: 'Grande Section', minAge: 4, maxAge: 7, recommendedAge: 5 }
  ],
  FONDAMENTALE: [
    { name: '1ère AF', minAge: 5, maxAge: 10, recommendedAge: 6 },
    { name: '2ème AF', minAge: 6, maxAge: 11, recommendedAge: 7 },
    { name: '3ème AF', minAge: 7, maxAge: 12, recommendedAge: 8 },
    { name: '4ème AF', minAge: 8, maxAge: 13, recommendedAge: 9 },
    { name: '5ème AF', minAge: 9, maxAge: 14, recommendedAge: 10 },
    { name: '6ème AF', minAge: 10, maxAge: 15, recommendedAge: 11 },
    { name: '7ème AF', minAge: 11, maxAge: 16, recommendedAge: 12 },
    { name: '8ème AF', minAge: 12, maxAge: 17, recommendedAge: 13 },
    { name: '9ème AF', minAge: 13, maxAge: 22, recommendedAge: 14 }
  ],
  SECONDAIRE: [
    { name: 'NS I', minAge: 14, maxAge: 24, recommendedAge: 15 },
    { name: 'NS II', minAge: 15, maxAge: 25, recommendedAge: 16 },
    { name: 'NS III', minAge: 16, maxAge: 26, recommendedAge: 17 },
    { name: 'NS IV', minAge: 17, maxAge: 28, recommendedAge: 18 }
  ],
  LICENCE: [
    { name: 'Niveau I (L1)', minAge: 17, maxAge: 45, recommendedAge: 19 },
    { name: 'Niveau II (L2)', minAge: 18, maxAge: 46, recommendedAge: 20 },
    { name: 'Niveau III (L3)', minAge: 19, maxAge: 47, recommendedAge: 21 },
    { name: 'Niveau IV (L4)', minAge: 20, maxAge: 48, recommendedAge: 22 },
    { name: 'Niveau V (L5)', minAge: 21, maxAge: 50, recommendedAge: 23 }
  ],
  MASTER: [
    { name: 'Master I (M1)', minAge: 21, maxAge: 55, recommendedAge: 23 },
    { name: 'Master II (M2)', minAge: 22, maxAge: 56, recommendedAge: 24 }
  ],
  CERTIFICAT: [
    { name: 'Année 1', minAge: 16, maxAge: 55, recommendedAge: 18 },
    { name: 'Année 2', minAge: 17, maxAge: 56, recommendedAge: 19 }
  ],
  DIPLOME: [
    { name: 'Année 1', minAge: 16, maxAge: 55, recommendedAge: 18 },
    { name: 'Année 2', minAge: 17, maxAge: 56, recommendedAge: 19 }
  ],
  
  // Backward compatibility keys
  UNIVERSITAIRE: [
    { name: 'Niveau I (L1)', minAge: 17, maxAge: 45, recommendedAge: 19 },
    { name: 'Niveau II (L2)', minAge: 18, maxAge: 46, recommendedAge: 20 },
    { name: 'Niveau III (L3)', minAge: 19, maxAge: 47, recommendedAge: 21 },
    { name: 'Niveau IV (L4)', minAge: 20, maxAge: 48, recommendedAge: 22 },
    { name: 'Niveau V (L5)', minAge: 21, maxAge: 50, recommendedAge: 23 }
  ],
  PROFESSIONNEL: [
    { name: 'Année 1', minAge: 16, maxAge: 55, recommendedAge: 18 },
    { name: 'Année 2', minAge: 17, maxAge: 56, recommendedAge: 19 }
  ],
  TECHNIQUE: [
    { name: 'Année 1', minAge: 16, maxAge: 55, recommendedAge: 18 },
    { name: 'Année 2', minAge: 17, maxAge: 56, recommendedAge: 19 }
  ]
};

export const getNextClassLevel = (currentClassName: string, level: string): { name: string, level: string } | null => {
  const normalizedLevel = level?.toUpperCase() || 'FONDAMENTALE';
  const classLower = currentClassName.trim().toLowerCase();

  // 1. Check for classical Maternelle transitions
  if (classLower.includes('grande section') || classLower.match(/\bg\.?\s*s\.?\b/)) {
    const match = currentClassName.match(/(?:grande\s+section|g\.?\s*s\.?)\s*(.*)/i);
    const suffix = match ? match[1].trim() : '';
    const nextName = suffix ? `1ère AF ${suffix}` : '1ère AF';
    return { name: nextName, level: 'FONDAMENTALE' };
  } else if (classLower.includes('moyenne section') || classLower.match(/\bm\.?\s*s\.?\b/)) {
    const match = currentClassName.match(/(?:moyenne\s+section|m\.?\s*s\.?)\s*(.*)/i);
    const suffix = match ? match[1].trim() : '';
    const nextName = suffix ? `Grande Section ${suffix}` : 'Grande Section';
    return { name: nextName, level: 'MATERNELLE' };
  } else if (classLower.includes('petite section') || classLower.match(/\bp\.?\s*s\.?\b/)) {
    const match = currentClassName.match(/(?:petite\s+section|p\.?\s*s\.?)\s*(.*)/i);
    const suffix = match ? match[1].trim() : '';
    const nextName = suffix ? `Moyenne Section ${suffix}` : 'Moyenne Section';
    return { name: nextName, level: 'MATERNELLE' };
  }

  // 2. Check for 9ème AF -> NS I classical transition
  const afMatch9 = currentClassName.match(/\b9(?:ème|eme|e|ère|er)?\s*(?:af|a\.f\.)\s*(.*)/i);
  if (afMatch9) {
    const suffix = afMatch9[1] ? afMatch9[1].trim() : '';
    const nextName = suffix ? `NS I ${suffix}` : 'NS I';
    return { name: nextName, level: 'SECONDAIRE' };
  }

  // 3. Check for AF digits (1ère AF to 8ème AF) -> Return immediately on match!
  const afMatch = currentClassName.match(/(\d+)(?:ère|ere|ème|eme|e)?\s*(?:af|a\.f\.)(?:\s*(.*))?/i);
  if (afMatch) {
    const curNum = parseInt(afMatch[1], 10);
    const sectionSuffix = afMatch[2] ? ` ${afMatch[2].trim()}` : '';
    if (curNum >= 1 && curNum < 8) {
      const nextNum = curNum + 1;
      const suffix = nextNum === 1 ? 'ère' : 'ème';
      return { name: `${nextNum}${suffix} AF${sectionSuffix}`, level: 'FONDAMENTALE' };
    } else if (curNum === 8) {
      return { name: `9ème AF${sectionSuffix}`, level: 'FONDAMENTALE' };
    } else if (curNum === 9) {
      return { name: `NS I${sectionSuffix}`, level: 'SECONDAIRE' };
    }
  }

  // 4. Check for NS IV / NS 4 -> Niveau I (L1) transition
  const nsIVMatch = currentClassName.match(/\bns\s*(?:iv|4)\s*(.*)/i);
  if (nsIVMatch) {
    const suffix = nsIVMatch[1] ? nsIVMatch[1].trim() : '';
    const nextName = suffix ? `Niveau I (L1) ${suffix}` : 'Niveau I (L1)';
    return { name: nextName, level: 'LICENCE' };
  }

  // 5. Upgrade NS Roman numerals or digits: e.g. "NS I" -> "NS II"
  const nsMatch = currentClassName.match(/\bns\s*(i+|iv|v|\d+)\s*(.*)/i);
  if (nsMatch) {
    const val = nsMatch[1].toUpperCase();
    const suffix = nsMatch[2] ? ` ${nsMatch[2].trim()}` : '';
    const romanToNum: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
    const numToRoman = ['0', 'I', 'II', 'III', 'IV'];
    let num = parseInt(val, 10);
    if (isNaN(num)) {
      num = romanToNum[val] || 1;
    }
    const nextNum = num + 1;
    if (nextNum <= 4) {
      const nextRoman = numToRoman[nextNum];
      return { name: `NS ${nextRoman}${suffix}`, level: 'SECONDAIRE' };
    } else if (nextNum > 4) {
      return { name: `Niveau I (L1)${suffix}`, level: 'LICENCE' };
    }
  }

  // 6. Upgrade university L-digits: e.g. "L1" -> "L2", "L3" -> "L4"
  const lMatch = currentClassName.match(/\bL(\d+)\b/i);
  if (lMatch) {
    const num = parseInt(lMatch[1], 10);
    if (num < 5) {
      const nextNum = num + 1;
      const updated = currentClassName.replace(lMatch[0], `L${nextNum}`);
      return { name: updated, level: 'LICENCE' };
    } else if (num === 5) {
      const updated = currentClassName.replace(lMatch[0], `M1`);
      return { name: updated, level: 'MASTER' };
    }
  }

  // 7. Upgrade Master M-digits: e.g. "M1" -> "M2"
  const mMatch = currentClassName.match(/\bM(\d+)\b/i);
  if (mMatch) {
    const num = parseInt(mMatch[1], 10);
    if (num < 2) {
      const nextNum = num + 1;
      const updated = currentClassName.replace(mMatch[0], `M${nextNum}`);
      return { name: updated, level: 'MASTER' };
    }
  }

  // 8. Upgrade Niveau Roman numerals: e.g. "Niveau I" -> "Niveau II"
  const niveauMatch = currentClassName.match(/\bniveau\s*(i+|iv|v|\d+)\b/i);
  if (niveauMatch) {
    const val = niveauMatch[1].toUpperCase();
    const romanToNum: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5 };
    const numToRoman = ['0', 'I', 'II', 'III', 'IV', 'V'];
    let num = parseInt(val, 10);
    if (isNaN(num)) {
      num = romanToNum[val] || 1;
    }
    const nextNum = num + 1;
    if (nextNum <= 5) {
      const nextRoman = numToRoman[nextNum];
      const updated = currentClassName.replace(niveauMatch[0], `Niveau ${nextRoman}`);
      return { name: updated, level: normalizedLevel };
    }
  }

  // 9. Upgrade professional Année digits: e.g. "Année 1" -> "Année 2"
  const anneeMatch = currentClassName.match(/\bann[ée]e\s*(\d+)\b/i);
  if (anneeMatch) {
    const num = parseInt(anneeMatch[1], 10);
    const nextNum = num + 1;
    const updated = currentClassName.replace(anneeMatch[0], `Année ${nextNum}`);
    return { name: updated, level: normalizedLevel };
  }

  // 10. Upgrade generic French ordinals if no specific pattern matched
  const ordinalMatch = currentClassName.match(/\b(1ère|1ere|1er|1e|2ème|2eme|2e|3ème|3eme|3e|4ème|4eme|4e|5ème|5eme|5e|6ème|6eme|6e|7ème|7eme|7e|8ème|8eme|8e)\b/i);
  if (ordinalMatch) {
    const ordLower = ordinalMatch[1].toLowerCase().replace('ere', 'ère').replace('eme', 'ème');
    const ordMap: Record<string, string> = {
      '1er': '2ème', '1ère': '2ème', '1e': '2e',
      '2ème': '3ème', '2e': '3e',
      '3ème': '4ème', '3e': '4e',
      '4ème': '5ème', '4e': '5e',
      '5ème': '6ème', '5e': '6e',
      '6ème': '7ème', '6e': '7e',
      '7ème': '8ème', '7e': '8e',
      '8ème': '9ème', '8e': '9e'
    };
    const nextOrd = ordMap[ordLower];
    if (nextOrd) {
      const isUpper = ordinalMatch[1] === ordinalMatch[1].toUpperCase();
      const finalOrd = isUpper ? nextOrd.toUpperCase() : nextOrd;
      const updated = currentClassName.replace(ordinalMatch[0], finalOrd);
      return { name: updated, level: normalizedLevel };
    }
  }

  // 7. Fallback direct catalog sequence
  const path = ACADEMIC_PATH[normalizedLevel];
  if (!path) return null;
  const currentIndex = path.findIndex(item => item.name.toLowerCase() === currentClassName.toLowerCase());
  if (currentIndex === -1) {
    const fuzzyIndex = path.findIndex(item => currentClassName.toLowerCase().includes(item.name.toLowerCase()));
    if (fuzzyIndex !== -1 && fuzzyIndex < path.length - 1) {
      return { name: path[fuzzyIndex + 1].name, level: normalizedLevel };
    }
    return null;
  }
  if (currentIndex === path.length - 1) {
    if (normalizedLevel === 'MATERNELLE') return { name: '1ère AF', level: 'FONDAMENTALE' };
    if (normalizedLevel === 'FONDAMENTALE') return { name: 'NS I', level: 'SECONDAIRE' };
    if (normalizedLevel === 'SECONDAIRE') return { name: 'Niveau I (L1)', level: 'LICENCE' };
    return null;
  }

  return { name: path[currentIndex + 1].name, level: normalizedLevel };
};

export const getAllowedClassesForReenrollment = (currentClassName: string, level: string, allClasses: any[]) => {
  const nextInfo = getNextClassLevel(currentClassName, level);
  const normalizedLevel = level?.toUpperCase() || 'FONDAMENTALE';
  
  let validClasses = allClasses.filter(c => {
    const isCurrent = (c.level === normalizedLevel && c.name.toLowerCase() === currentClassName.toLowerCase());
    
    let isNext = false;
    if (nextInfo) {
      const targetNameLower = nextInfo.name.toLowerCase();
      const classNameLower = c.name.toLowerCase();
      
      isNext = (c.level === nextInfo.level) && (
        classNameLower === targetNameLower ||
        classNameLower.startsWith(targetNameLower) ||
        classNameLower.includes(targetNameLower)
      );
    }
    
    return isCurrent || isNext;
  });

  // Fallback flexibility: If strict matching finds nothing or only current class, suggest classes with similar prefix
  if (validClasses.length <= 1) {
     const prefix = currentClassName.replace(/\s*(I|II|III|IV|V|\d+)\s*$/i, '').trim();
     if (prefix.length > 2) {
       const relatedClasses = allClasses.filter(c => c.level === normalizedLevel && c.name.toLowerCase().startsWith(prefix.toLowerCase()));
       const existingIds = new Set(validClasses.map(c => c.id));
       relatedClasses.forEach(c => {
         if (!existingIds.has(c.id)) {
           validClasses.push(c);
         }
       });
     } else {
       // Propose all classes in the level/cycle
       const cycleClasses = allClasses.filter(c => c.level === normalizedLevel);
       const existingIds = new Set(validClasses.map(c => c.id));
       cycleClasses.forEach(c => {
         if (!existingIds.has(c.id)) {
           validClasses.push(c);
         }
       });
     }
  }

  return validClasses;
};

export const getClassAgeRange = (className: string, level: string) => {
  const normalizedLevel = level?.toUpperCase() || 'FONDAMENTALE';
  const path = ACADEMIC_PATH[normalizedLevel];
  if (!path) return null;
  return path.find(item => item.name === className) || null;
};

export type AgeStatus = 'EARLY' | 'NORMAL' | 'LATE' | 'CRITICAL';

export const getStudentAgeStatus = (age: number, className: string, level: string): AgeStatus => {
  const range = getClassAgeRange(className, level);
  if (!range) return 'NORMAL';

  if (age < range.minAge) return 'EARLY';
  if (age === range.recommendedAge || (age >= range.minAge && age <= range.recommendedAge + 1)) return 'NORMAL';
  if (age > range.recommendedAge + 1 && age <= range.maxAge) return 'LATE';
  return 'CRITICAL';
};
