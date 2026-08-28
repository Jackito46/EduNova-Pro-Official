
/**
 * Utility to check if a date is a Sunday or a Haitian Public Holiday (Legal Bank Holiday).
 * Includes floating holidays for 2024-2026.
 */
export const isRestrictedBankDate = (dateString: string): { restricted: boolean; reason?: string } => {
  if (!dateString) return { restricted: false };
  
  // Date input returns YYYY-MM-DD
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create a date object at midnight in local time for comparison
  const checkDateLocal = new Date(year, month - 1, day);
  const dayOfWeek = checkDateLocal.getDay(); // 0 is Sunday

  // 1. Future Date Check (No post-dating allowed)
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (checkDateLocal > todayLocal) {
    return { restricted: true, reason: "Date post-datée non autorisée" };
  }

  // 2. Sunday Check
  if (dayOfWeek === 0) {
    return { restricted: true, reason: "Le dimanche est un jour de fermeture bancaire" };
  }

  // 3. Haitian Holidays
  // Fixed Holidays
  const fixedHolidays: Record<string, string> = {
    '1-1': "Jour de l'Indépendance",
    '1-2': "Jour des Aïeux",
    '5-1': "Fête de l'Agriculture et du Travail",
    '5-18': "Fête du Drapeau et de l'Université",
    '8-15': "Assomption de Marie",
    '10-17': "Anniversaire de la mort de Dessalines",
    '11-1': "Toussaint",
    '11-2': "Jour des Morts",
    '11-18': "Bataille de Vertières",
    '12-25': "Noël"
  };

  const key = `${month}-${day}`;
  if (fixedHolidays[key]) {
    return { restricted: true, reason: `Férié : ${fixedHolidays[key]}` };
  }

  // Floating Holidays (2024-2026)
  const floatingHolidays: Record<string, Record<string, string>> = {
    '2024': {
      '2-13': "Mardi Gras",
      '2-14': "Mercredi des Cendres",
      '3-29': "Vendredi Saint",
      '5-9': "Ascension",
      '5-30': "Fête Dieu"
    },
    '2025': {
      '3-4': "Mardi Gras",
      '3-5': "Mercredi des Cendres",
      '4-18': "Vendredi Saint",
      '5-29': "Ascension",
      '6-19': "Fête Dieu"
    },
    '2026': {
      '2-17': "Mardi Gras",
      '2-18': "Mercredi des Cendres",
      '4-3': "Vendredi Saint",
      '5-14': "Ascension",
      '6-4': "Fête Dieu"
    }
  };

  const yearStr = year.toString();
  if (floatingHolidays[yearStr] && floatingHolidays[yearStr][key]) {
    return { restricted: true, reason: `Férié : ${floatingHolidays[yearStr][key]}` };
  }

  return { restricted: false };
};

/**
 * Returns today's date in YYYY-MM-DD format based on local time.
 */
export const getLocalTodayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
