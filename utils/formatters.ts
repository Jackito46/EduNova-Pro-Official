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

/**
 * Met en majuscule la première lettre de chaque mot ou sous-mot composé (ex: "carl-henry" -> "Carl-Henry", "jean-baptiste" -> "Jean-Baptiste")
 */
export const capitalizeWordOrCompound = (str: string): string => {
  if (!str) return '';
  return str
    .split(' ')
    .map(chunk => 
      chunk
        .split('-')
        .map(sub => 
          sub
            .split("'")
            .map(part => part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : '')
            .join("'")
        )
        .join('-')
    )
    .join(' ');
};

export const formatStudentName = (lastName: string, firstName: string) => {
  const formattedLastName = (lastName || '').trim().toUpperCase();
  const formattedFirstName = capitalizeWordOrCompound(firstName || '');
  
  return {
    lastName: formattedLastName,
    firstName: formattedFirstName,
    fullName: `${formattedLastName} ${formattedFirstName}`.trim()
  };
};

/**
 * Formate un nom complet : NOM en majuscules, Prénom en Capital Case.
 */
export const formatFullName = (fullName: string) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase();
  
  // Si le premier mot est déjà en majuscules (ex: "HYPPOLITE Carl-Henry")
  if (parts[0] === parts[0].toUpperCase() && parts[0].length > 1) {
    const lastName = parts[0].toUpperCase();
    const firstNames = capitalizeWordOrCompound(parts.slice(1).join(' '));
    return `${lastName} ${firstNames}`;
  }

  // Sinon convention classique : dernier mot = Nom
  const lastName = parts[parts.length - 1].toUpperCase();
  const firstNames = capitalizeWordOrCompound(parts.slice(0, parts.length - 1).join(' '));
    
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
