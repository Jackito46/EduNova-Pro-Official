/**
 * Formate le nom de l'élève : NOM en majuscules, Prénom en Capital Case.
 */
export const formatClassName = (name: string, schoolType?: string) => {
  if (schoolType !== 'UNIVERSITY' && schoolType !== 'PROFESSIONAL') return name;
  let cleanName = name.replace(
    /\s*(I|II|III|IV|V|VI|\d+|Année \d+|Niveau \d+|Niveau [IVX]+|\(L\d+\)|Licence \d+|Master \d+)\s*$/i,
    "",
  );
  cleanName = cleanName.replace(/^(licence|master|dipl[ôo]me|certificat)\s*(en|de)?\s*/i, "");
  return cleanName.trim() || name;
};

export const formatStudentName = (lastName: string, firstName: string) => {
  const formattedLastName = (lastName || '').trim().toUpperCase();
  const formattedFirstName = (firstName || '')
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return {
    lastName: formattedLastName,
    firstName: formattedFirstName,
    fullName: `${formattedLastName} ${formattedFirstName}`
  };
};

/**
 * Formate un nom complet : NOM en majuscules, Prénom en Capital Case.
 */
export const formatFullName = (fullName: string) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0].toUpperCase();
  
  const lastName = parts[parts.length - 1].toUpperCase();
  const firstNames = parts.slice(0, parts.length - 1)
    .map(name => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())
    .join(' ');
    
  return `${lastName} ${firstNames}`;
};

/**
 * Met une chaîne en Capital Case (ex: "jean paul" -> "Jean Paul")
 */
export const toTitleCase = (str: string) => {
  return (str || '')
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Met une chaîne en MAJUSCULES
 */
export const toUpperCase = (str: string) => {
  return (str || '').trim().toUpperCase();
};

/**
 * Retourne un déterminant défini grammaticalement correct selon le mot fourni (ex: "la matière", "le cours", "l'élève").
 */
export const getDefiniteArticle = (word: string, capitalized: boolean = false) => {
  const lower = (word || '').trim().toLowerCase();
  if (!lower) return '';

  const startsWithVowel = /^[aeiouyéèêëàâîïôûù]/i.test(lower);
  const isMasculine = ['cours', 'module', 'domaine', 'programme', 'sujet', 'travail', 'élève', 'étudiant', 'enseignant', 'professeur'].includes(lower);

  if (startsWithVowel) {
    return capitalized ? "L'" : "l'";
  }
  if (isMasculine) {
    return capitalized ? 'Le' : 'le';
  }
  return capitalized ? 'La' : 'la';
};

/**
 * Combine une action avec le terme ajusté selon la terminologie (ex: "Mettre à jour la matière", "Enregistrer le cours").
 */
export const formatActionWithTerminology = (
  action: 'UPDATE' | 'CREATE' | 'DELETE' | 'REMOVE' | 'SELECT' | 'IDENTIFY',
  term: string
) => {
  const lower = (term || '').trim().toLowerCase();
  const article = getDefiniteArticle(term, false);
  const space = article.endsWith("'") ? '' : ' ';

  switch (action) {
    case 'UPDATE':
      return `Mettre à jour ${article}${space}${lower}`;
    case 'CREATE':
      return `Enregistrer ${article}${space}${lower}`;
    case 'DELETE':
    case 'REMOVE':
      return `Retirer ${article}${space}${lower}`;
    case 'SELECT':
      return `Sélectionner ${article}${space}${lower}`;
    case 'IDENTIFY':
      return `Identifier ${article}${space}${lower}`;
    default:
      return `${action} ${article}${space}${lower}`;
  }
};
