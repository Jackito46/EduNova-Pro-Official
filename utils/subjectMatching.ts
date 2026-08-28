import { Subject, SchoolClass } from '../types';

/**
 * Normalise une chaîne de caractères pour comparaison insensible aux accents,
 * à la casse, à la ponctuation et aux variations orthographiques scolaires courantes.
 */
export function normalizeString(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9]/g, ' ')      // Remplace la ponctuation par des espaces
    .replace(/\s+/g, ' ')            // Réduit les espaces consécutifs
    .trim();
}

/**
 * Extrait la racine d'un niveau ou d'une classe (ex: "9e", "9ème Année Fondamentale", "9e AF" -> "9")
 */
export function normalizeClassName(className: string | undefined | null): string {
  if (!className) return '';
  const norm = normalizeString(className);
  
  // Remplacements spécifiques aux niveaux scolaires
  return norm
    .replace(/\b(annee|fondamentale|af|fondamental|secondaire|ns|section|classe|groupe|salle)\b/g, '')
    .replace(/\b9(eme|e|ieme)\b/g, '9')
    .replace(/\b8(eme|e|ieme)\b/g, '8')
    .replace(/\b7(eme|e|ieme)\b/g, '7')
    .replace(/\b6(eme|e|ieme)\b/g, '6')
    .replace(/\b5(eme|e|ieme)\b/g, '5')
    .replace(/\b4(eme|e|ieme)\b/g, '4')
    .replace(/\b3(eme|e|ieme)\b/g, '3')
    .replace(/\b2(nde|nd|e|eme)\b/g, 'seconde')
    .replace(/\b1(ere|er|re|e|eme)\b/g, 'premiere')
    .replace(/\b(terminale|term|tle|philo)\b/g, 'terminale')
    .replace(/\bns\s*1\b/g, 'ns1')
    .replace(/\bns\s*2\b/g, 'ns2')
    .replace(/\bns\s*3\b/g, 'ns3')
    .replace(/\bns\s*4\b/g, 'ns4')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Vérifie si deux identifiants ou noms de classes correspondent.
 */
export function matchClasses(
  c1: { id?: string; name?: string } | string | undefined | null,
  c2: { id?: string; name?: string } | string | undefined | null,
  classesList: SchoolClass[] = []
): boolean {
  if (!c1 || !c2) return false;

  const id1 = typeof c1 === 'string' ? c1 : c1.id;
  const id2 = typeof c2 === 'string' ? c2 : c2.id;

  // 1. Correspondance exacte par ID
  if (id1 && id2 && id1 === id2) return true;

  // Récupération des noms
  let name1 = typeof c1 === 'object' ? c1.name : undefined;
  let name2 = typeof c2 === 'object' ? c2.name : undefined;

  if (!name1 && id1) {
    const found = classesList.find(c => c.id === id1);
    if (found) name1 = found.name;
    else name1 = id1; // Peut être déjà le nom si string brute
  }

  if (!name2 && id2) {
    const found = classesList.find(c => c.id === id2);
    if (found) name2 = found.name;
    else name2 = id2;
  }

  if (!name1 || !name2) return false;

  // 2. Correspondance exacte insensible à la casse
  if (name1.toLowerCase().trim() === name2.toLowerCase().trim()) return true;

  // 3. Correspondance normalisée approfondie
  const norm1 = normalizeClassName(name1);
  const norm2 = normalizeClassName(name2);

  if (norm1 && norm2) {
    if (norm1 === norm2) return true;
    if (norm1.startsWith(norm2) || norm2.startsWith(norm1)) return true;
  }

  return false;
}

/**
 * Normalise une matière pour regrouper les synonymes et abréviations usuelles.
 * Ex: Math, Maths, Mathématiques, Mathematiques -> "math"
 */
export function normalizeSubjectName(subjName: string | undefined | null): string {
  if (!subjName) return '';
  const norm = normalizeString(subjName);

  if (/\b(math|maths|mathematique|mathematiques|mathematics|calcul|algebre|geometrie)\b/.test(norm)) {
    return 'math';
  }
  if (/\b(francais|fr|communication francaise|grammaire|litterature|expression francaise)\b/.test(norm)) {
    return 'francais';
  }
  if (/\b(physique|chimie|physique chimie|pc|sc physiques|sciences physiques)\b/.test(norm)) {
    return 'physique-chimie';
  }
  if (/\b(svt|sciences de la vie|biologie|bio|geologie|sciences de la nature|sciences naturelles)\b/.test(norm)) {
    return 'svt';
  }
  if (/\b(histoire|geographie|histoire geo|hg|sciences sociales|geo)\b/.test(norm)) {
    return 'histoire-geo';
  }
  if (/\b(anglais|english|ang)\b/.test(norm)) {
    return 'anglais';
  }
  if (/\b(espagnol|spanish|esp)\b/.test(norm)) {
    return 'espagnol';
  }
  if (/\b(creole|kreyol|kreyol ayisyen|communication creole)\b/.test(norm)) {
    return 'creole';
  }
  if (/\b(informatique|info|tic|technologie|tech)\b/.test(norm)) {
    return 'informatique';
  }
  if (/\b(philosophie|philo)\b/.test(norm)) {
    return 'philosophie';
  }
  if (/\b(economie|eco|ses)\b/.test(norm)) {
    return 'economie';
  }
  if (/\b(eps|sport|education physique)\b/.test(norm)) {
    return 'sport';
  }
  if (/\b(art|arts plastiques|musique|dessin)\b/.test(norm)) {
    return 'arts';
  }

  return norm;
}

/**
 * Vérifie si une matière correspond à une recherche (ID, nom, code ou variante).
 */
export function matchSubjects(
  s1: { id?: string; name?: string; code?: string } | string | undefined | null,
  s2: { id?: string; name?: string; code?: string } | string | undefined | null,
  subjectsList: Subject[] = []
): boolean {
  if (!s1 || !s2) return false;

  const id1 = typeof s1 === 'string' ? s1 : s1.id;
  const id2 = typeof s2 === 'string' ? s2 : s2.id;

  // 1. Correspondance directe par ID
  if (id1 && id2 && id1 === id2) return true;

  // Récupération des objets et noms
  let obj1 = typeof s1 === 'object' ? s1 : subjectsList.find(s => s.id === id1 || s.name.toLowerCase() === id1?.toLowerCase());
  let obj2 = typeof s2 === 'object' ? s2 : subjectsList.find(s => s.id === id2 || s.name.toLowerCase() === id2?.toLowerCase());

  const name1 = obj1?.name || (typeof s1 === 'string' ? s1 : '');
  const name2 = obj2?.name || (typeof s2 === 'string' ? s2 : '');
  const code1 = obj1?.code || '';
  const code2 = obj2?.code || '';

  // 2. Correspondance exacte de nom
  if (name1 && name2 && name1.toLowerCase().trim() === name2.toLowerCase().trim()) return true;

  // 3. Correspondance par code matière (ex: MATH, FR, PC)
  if (code1 && code2 && code1.toUpperCase().trim() === code2.toUpperCase().trim()) return true;
  if (code1 && name2 && code1.toUpperCase().trim() === name2.toUpperCase().trim()) return true;
  if (code2 && name1 && code2.toUpperCase().trim() === name1.toUpperCase().trim()) return true;

  // 4. Correspondance de famille sémantique normalisée (Math <-> Mathématiques, etc.)
  const norm1 = normalizeSubjectName(name1 || code1);
  const norm2 = normalizeSubjectName(name2 || code2);

  if (norm1 && norm2 && norm1 === norm2) return true;

  // 5. Préfixe / inclusion
  const rawNorm1 = normalizeString(name1);
  const rawNorm2 = normalizeString(name2);
  if (rawNorm1 && rawNorm2) {
    if (rawNorm1.startsWith(rawNorm2) || rawNorm2.startsWith(rawNorm1)) return true;
  }

  return false;
}

/**
 * Trouve une matière dans la liste des matières par ID, nom, code ou variante normalisée.
 */
export function findSubjectInList(
  query: string | undefined | null,
  subjects: Subject[]
): Subject | undefined {
  if (!query || !subjects.length) return undefined;

  // 1. ID direct
  const byId = subjects.find(s => s.id === query);
  if (byId) return byId;

  // 2. Nom exact
  const byExactName = subjects.find(s => s.name.toLowerCase().trim() === query.toLowerCase().trim());
  if (byExactName) return byExactName;

  // 3. Code exact
  const byCode = subjects.find(s => s.code && s.code.toUpperCase().trim() === query.toUpperCase().trim());
  if (byCode) return byCode;

  // 4. Correspondance sémantique (Mathématiques <-> Math, etc.)
  const bySemantic = subjects.find(s => matchSubjects(s, query, subjects));
  if (bySemantic) return bySemantic;

  return undefined;
}

/**
 * Trouve une classe dans la liste des classes par ID, nom ou variante normalisée.
 */
export function findClassInList(
  query: string | undefined | null,
  classes: SchoolClass[]
): SchoolClass | undefined {
  if (!query || !classes.length) return undefined;

  // 1. ID direct
  const byId = classes.find(c => c.id === query);
  if (byId) return byId;

  // 2. Nom exact
  const byExactName = classes.find(c => c.name.toLowerCase().trim() === query.toLowerCase().trim());
  if (byExactName) return byExactName;

  // 3. Correspondance normalisée (9e, 9ème, 9e AF, 9ème Année Fondamentale)
  const byNormalized = classes.find(c => matchClasses(c, query, classes));
  if (byNormalized) return byNormalized;

  return undefined;
}
