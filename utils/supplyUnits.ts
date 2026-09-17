// Utilitaires de détection, formatage et harmonisation des unités de mesure scolaires
export interface SupplyUnitOption {
  value: string;
  label: string;
  categoryHint?: string;
  allowFractions?: boolean;
}

export const STANDARD_SUPPLY_UNITS: SupplyUnitOption[] = [
  { value: 'Aune', label: 'Aune (Tissu, Kaki, Uniforme)', categoryHint: 'Uniforme', allowFractions: true },
  { value: 'Exemplaire', label: 'Exemplaire (Manuels, Livres, Recueils)', categoryHint: 'Manuel' },
  { value: 'Rame', label: 'Rame (Papier 8.5x11, Papier ministre)', categoryHint: 'Fourniture' },
  { value: 'Cahier', label: 'Cahier (Cahier devoirs, travaux pratiques)', categoryHint: 'Fourniture' },
  { value: 'Boîte', label: 'Boîte (Craies, Stylos, Marqueurs, Compas)', categoryHint: 'Fourniture' },
  { value: 'Paquet', label: 'Paquet / Lot (Copies d\'examen, Enveloppes)', categoryHint: 'Fourniture' },
  { value: 'Douzaine', label: 'Douzaine (Crayons, Bics, Cahiers)', categoryHint: 'Fourniture' },
  { value: 'Ensemble', label: 'Ensemble / Tenue (Uniforme complet, EPS)', categoryHint: 'Uniforme' },
  { value: 'Paire', label: 'Paire (Chaussettes, Chaussures, Baskets)', categoryHint: 'Uniforme' },
  { value: 'Mètre', label: 'Mètre (Ruban, Élastique, Galon)', categoryHint: 'Uniforme', allowFractions: true },
  { value: 'Rouleau', label: 'Rouleau (Scotch, Papier craft, Adhésif)', categoryHint: 'Fourniture' },
  { value: 'Flacon', label: 'Flacon / Tube (Colle liquide, Encre, Gouache)', categoryHint: 'Fourniture' },
  { value: 'Bouteille', label: 'Bouteille (Désinfectant, Alcool 70°)', categoryHint: 'Entretien' },
  { value: 'Gallon', label: 'Gallon / Bidon (Savon liquide, Eau de Javel)', categoryHint: 'Entretien', allowFractions: true },
  { value: 'Carton', label: 'Carton (Conditionnement de gros)', categoryHint: 'Fourniture' },
  { value: 'Kit', label: 'Kit (Trousse garnie, Set géométrie)', categoryHint: 'Fourniture' },
  { value: 'Pièce', label: 'Pièce (Article individuel général)', categoryHint: 'Fourniture' },
  { value: 'Forfait', label: 'Forfait (Services, Droits, Cantine, Transport)', categoryHint: 'Service' }
];

/**
 * Détecte intelligemment l'unité naturelle la plus appropriée
 * en fonction de la désignation et de la catégorie de l'article.
 */
export const detectItemUnit = (label: string = '', category: string = ''): string => {
  const l = label.toLowerCase();
  const c = category.toLowerCase();

  // 1. Tissus scolaires et articles d'uniforme
  if (
    l.includes('tissu') || 
    l.includes('kaki') || 
    l.includes('popeline') || 
    l.includes('gabardine') || 
    l.includes('dacron') || 
    l.includes('galon') || 
    l.includes('ruban') || 
    l.includes('métrage') || 
    l.includes('metrage')
  ) {
    return 'Aune';
  }

  if (
    l.includes('chaussette') || 
    l.includes('chaussure') || 
    l.includes('soulier') || 
    l.includes('basket') || 
    l.includes('botte')
  ) {
    return 'Paire';
  }

  if (
    l.includes('complet') || 
    l.includes('ensemble') || 
    l.includes('tenue') || 
    (c.includes('uniforme') && (l.includes('chemise et') || l.includes('pantalon et')))
  ) {
    return 'Ensemble';
  }

  // 2. Manuels scolaires et livres
  if (
    c.includes('manuel') || 
    l.includes('livre') || 
    l.includes('manuel') || 
    l.includes('syllabus') || 
    l.includes('cahier d\'activit') || 
    l.includes('cahier dactivit') || 
    l.includes('dictionnaire') || 
    l.includes('roman') || 
    l.includes('grammaire') || 
    l.includes('mathématiques') || 
    l.includes('mathematiques') || 
    l.includes('guide péda') || 
    l.includes('recueil')
  ) {
    return 'Exemplaire';
  }

  // 3. Papeterie, ramettes, feuilles
  if (
    l.includes('rame') || 
    l.includes('ramette') || 
    l.includes('papier 8.5') || 
    l.includes('papier lettre') || 
    l.includes('papier ministre') || 
    l.includes('feuilles d\'examen')
  ) {
    return 'Rame';
  }

  // 4. Cahiers scolaires
  if (l.includes('cahier') || l.includes('carnet') || l.includes('registre')) {
    if (l.includes('douzaine') || l.includes('dz')) return 'Douzaine';
    if (l.includes('paquet') || l.includes('pack') || l.includes('lot')) return 'Paquet';
    return 'Cahier';
  }

  // 5. Craies, marqueurs, stylos
  if (l.includes('craie')) {
    return 'Boîte';
  }

  if (
    l.includes('marqueur') || 
    l.includes('stylo') || 
    l.includes('crayon') || 
    l.includes('feutre') || 
    l.includes('bic')
  ) {
    if (l.includes('boite') || l.includes('boîte') || l.includes('set') || l.includes('box')) return 'Boîte';
    if (l.includes('paquet') || l.includes('pack')) return 'Paquet';
    if (l.includes('douzaine') || l.includes('dz')) return 'Douzaine';
    return 'Pièce';
  }

  // 6. Adhésifs, rubans
  if (
    l.includes('scotch') || 
    l.includes('adhésif') || 
    l.includes('adhesif') || 
    l.includes('rouleau') || 
    l.includes('collant')
  ) {
    return 'Rouleau';
  }

  // 7. Chimie, entretien, liquides
  if (
    l.includes('colle') || 
    l.includes('encre') || 
    l.includes('peinture') || 
    l.includes('gouache') || 
    l.includes('vernis') || 
    l.includes('flacon')
  ) {
    return 'Flacon';
  }

  if (
    l.includes('javel') || 
    l.includes('désinfectant') || 
    l.includes('desinfectant') || 
    l.includes('savon liquide') || 
    l.includes('alcool')
  ) {
    if (l.includes('gallon') || l.includes('bidon')) return 'Gallon';
    return 'Bouteille';
  }

  // 8. Kits de géométrie, trousses
  if (
    l.includes('kit') || 
    l.includes('géométrie') || 
    l.includes('geometrie') || 
    l.includes('boîte math') || 
    l.includes('boite math') || 
    l.includes('trousse')
  ) {
    return 'Kit';
  }

  if (l.includes('carton')) {
    return 'Carton';
  }

  if (l.includes('boite') || l.includes('boîte')) {
    return 'Boîte';
  }

  if (l.includes('paquet') || l.includes('pack')) {
    return 'Paquet';
  }

  if (l.includes('douzaine') || l.includes('dz')) {
    return 'Douzaine';
  }

  // 9. Services et cotisations
  if (
    c.includes('service') || 
    l.includes('frais') || 
    l.includes('abonnement') || 
    l.includes('cantine') || 
    l.includes('transport') || 
    l.includes('droit') || 
    l.includes('forfait')
  ) {
    return 'Forfait';
  }

  return 'Pièce';
};

/**
 * Formate un affichage propre quantité + unité (avec pluriel adapté).
 * Ex: formatQuantityWithUnit(20, 'Aune') -> "20 Aunes"
 * Ex: formatQuantityWithUnit(1, 'Exemplaire') -> "1 Exemplaire"
 */
export const formatQuantityWithUnit = (quantity: number = 0, unit?: string): string => {
  const safeUnit = (unit || '').trim() || 'unité';
  const isPlural = Math.abs(quantity) > 1;

  switch (safeUnit) {
    case 'Aune':
      return `${quantity.toLocaleString()} ${isPlural ? 'Aunes' : 'Aune'}`;
    case 'Exemplaire':
      return `${quantity.toLocaleString()} ${isPlural ? 'Exemplaires' : 'Exemplaire'}`;
    case 'Rame':
      return `${quantity.toLocaleString()} ${isPlural ? 'Rames' : 'Rame'}`;
    case 'Cahier':
      return `${quantity.toLocaleString()} ${isPlural ? 'Cahiers' : 'Cahier'}`;
    case 'Boîte':
      return `${quantity.toLocaleString()} ${isPlural ? 'Boîtes' : 'Boîte'}`;
    case 'Paquet':
      return `${quantity.toLocaleString()} ${isPlural ? 'Paquets' : 'Paquet'}`;
    case 'Douzaine':
      return `${quantity.toLocaleString()} ${isPlural ? 'Douzaines' : 'Douzaine'}`;
    case 'Ensemble':
      return `${quantity.toLocaleString()} ${isPlural ? 'Ensembles' : 'Ensemble'}`;
    case 'Paire':
      return `${quantity.toLocaleString()} ${isPlural ? 'Paires' : 'Paire'}`;
    case 'Mètre':
      return `${quantity.toLocaleString()} ${isPlural ? 'Mètres' : 'Mètre'}`;
    case 'Rouleau':
      return `${quantity.toLocaleString()} ${isPlural ? 'Rouleaux' : 'Rouleau'}`;
    case 'Carton':
      return `${quantity.toLocaleString()} ${isPlural ? 'Cartons' : 'Carton'}`;
    case 'Flacon':
      return `${quantity.toLocaleString()} ${isPlural ? 'Flacons' : 'Flacon'}`;
    case 'Bouteille':
      return `${quantity.toLocaleString()} ${isPlural ? 'Bouteilles' : 'Bouteille'}`;
    case 'Gallon':
      return `${quantity.toLocaleString()} ${isPlural ? 'Gallons' : 'Gallon'}`;
    case 'Kit':
      return `${quantity.toLocaleString()} ${isPlural ? 'Kits' : 'Kit'}`;
    case 'Forfait':
      return `${quantity.toLocaleString()} ${isPlural ? 'Forfaits' : 'Forfait'}`;
    case 'Pièce':
      return `${quantity.toLocaleString()} ${isPlural ? 'Pièces' : 'Pièce'}`;
    default:
      return `${quantity.toLocaleString()} ${safeUnit}`;
  }
};

/**
 * Nettoie le champ discipline_name en enlevant les balises d'encodage [Unité: ...]
 */
export const extractCleanDiscipline = (discipline_name?: string | null): string | null => {
  if (!discipline_name) return null;
  const clean = discipline_name.replace(/\[Unité:[^\]]+\]/gi, '').trim();
  return clean || null;
};

/**
 * Encode l'unité choisie dans discipline_name pour assurer la pérennité
 * même sans colonne dédiée dans la base de données.
 */
export const encodeDisciplineWithUnit = (cleanDiscipline: string | null | undefined, unit: string): string => {
  const safeUnit = unit.trim() || 'Pièce';
  const tag = `[Unité: ${safeUnit}]`;
  const base = (cleanDiscipline || '').replace(/\[Unité:[^\]]+\]/gi, '').trim();
  return base ? `${base} ${tag}` : tag;
};

/**
 * Récupère l'unité d'un article :
 * 1. Propriété unit_measure directe
 * 2. Tag [Unité: ...] présent dans discipline_name
 * 3. Détection heuristique si manquante ou générique "Pièce"
 */
export const resolveItemUnit = (item: any): string => {
  if (!item) return 'Pièce';
  
  // 1. Si une unité explicite non générique est présente
  if (item.unit_measure && item.unit_measure !== 'Pièce') {
    return item.unit_measure;
  }

  // 2. Si une unité explicite est encodée dans discipline_name
  if (item.discipline_name) {
    const match = item.discipline_name.match(/\[Unité:\s*([^\]]+)\]/i);
    if (match && match[1] && match[1].trim() !== 'Pièce') {
      return match[1].trim();
    }
  }

  // 3. Détection heuristique basée sur le titre et la catégorie
  const detected = detectItemUnit(item.label, item.category);
  if (detected && detected !== 'Pièce') {
    return detected;
  }

  // 4. Si unit_measure vaut explicitement 'Pièce', on le garde
  if (item.unit_measure) return item.unit_measure;

  // 5. Fallback sur Pièce
  return 'Pièce';
};
