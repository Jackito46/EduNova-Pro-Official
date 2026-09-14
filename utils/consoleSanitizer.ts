/**
 * Utilitaire de nettoyage et sécurisation de la console en production.
 * Détecte et masque automatiquement les tokens JWT, clés d'API, mots de passe,
 * et secrets de configuration pour empêcher toute fuite dans les DevTools.
 */

// Expressions régulières pour détecter des motifs de secrets
const SENSITIVE_PATTERNS = [
  // Tokens JWT (Supabase, Auth0, etc.)
  { regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, mask: '[REDACTED_JWT]' },
  // Bearer tokens
  { regex: /Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, mask: 'Bearer [REDACTED_TOKEN]' },
  // Clés secrètes préfixées (Kobara, Stripe, etc.)
  { regex: /(kbr_sk_[a-zA-Z0-9_]{10,}|whsec_[a-zA-Z0-9_]{8,}|sk_live_[a-zA-Z0-9_]{10,}|sk_test_[a-zA-Z0-9_]{10,})/gi, mask: '[REDACTED_API_KEY]' },
  // Mots de passe ou credentials dans les query strings (ex: ?key=..., &password=...)
  { regex: /([?&](?:password|pass|secret|token|api_key|client_secret)=)[^&\s]+/gi, mask: '$1[REDACTED]' }
];

// Noms de champs d'objets sensibles à masquer automatiquement
const SENSITIVE_KEY_NAMES = new Set([
  'password',
  'passwd',
  'pass',
  'secret',
  'client_secret',
  'secret_key',
  'webhook_secret',
  'smtp_pass',
  'p_new_password',
  'access_token',
  'refresh_token',
  'service_role_key',
  'private_key',
  'api_key'
]);

/**
 * Nettoie une chaîne de caractères de tout secret détecté
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return String(str);
  let cleaned = str;
  for (const { regex, mask } of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(regex, mask);
  }
  return cleaned;
}

/**
 * Nettoie récursivement un objet ou tableau
 */
export function sanitizeValue(val: any, depth = 0): any {
  if (depth > 6) return '[MAX_DEPTH]';
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    return sanitizeString(val);
  }

  if (typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }

  if (val instanceof Error) {
    const sanitizedError = new Error(sanitizeString(val.message));
    if (val.stack) sanitizedError.stack = sanitizeString(val.stack);
    return sanitizedError;
  }

  if (Array.isArray(val)) {
    return val.map(item => sanitizeValue(item, depth + 1));
  }

  if (typeof val === 'object') {
    const cleanedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(val)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEY_NAMES.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
        cleanedObj[key] = '[REDACTED_CONFIDENTIAL]';
      } else {
        cleanedObj[key] = sanitizeValue(value, depth + 1);
      }
    }
    return cleanedObj;
  }

  return val;
}

/**
 * Nettoie une liste d'arguments passés à console.*
 */
export function sanitizeLogArgs(args: any[]): any[] {
  return args.map(arg => sanitizeValue(arg));
}

let isSanitizerInitialized = false;

/**
 * Initialise l'interception globale de la console.
 * En production : supprime les logs verbeux (debug, trace, info) et filtre les avertissements/erreurs.
 * En développement : nettoie les tokens sensibles pour éviter les fuites visuelles.
 */
export function initConsoleSanitizer(): void {
  if (typeof window === 'undefined' || isSanitizerInitialized) {
    return;
  }

  isSanitizerInitialized = true;
  const isProd = import.meta.env.PROD || window.location.hostname.includes('run.app');

  const origLog = console.log;
  const origInfo = console.info;
  const origWarn = console.warn;
  const origError = console.error;
  const origDebug = console.debug;
  const origTrace = console.trace;

  if (isProd) {
    // 1. En production, désactiver les canaux de débogage verbeux
    console.debug = () => {};
    console.trace = () => {};

    // 2. Filtrer et nettoyer console.log et console.info
    console.log = (...args: any[]) => {
      // Ignorer les logs vides ou triviaux
      if (!args.length) return;
      const sanitized = sanitizeLogArgs(args);
      origLog.apply(console, sanitized);
    };

    console.info = (...args: any[]) => {
      if (!args.length) return;
      const sanitized = sanitizeLogArgs(args);
      origInfo.apply(console, sanitized);
    };
  } else {
    // En développement, filtrer les tokens tout en conservant le débogage
    console.log = (...args: any[]) => {
      origLog.apply(console, sanitizeLogArgs(args));
    };
    console.debug = (...args: any[]) => {
      origDebug.apply(console, sanitizeLogArgs(args));
    };
  }

  // 3. Toujours assainir les alertes et erreurs
  console.warn = (...args: any[]) => {
    origWarn.apply(console, sanitizeLogArgs(args));
  };

  console.error = (...args: any[]) => {
    origError.apply(console, sanitizeLogArgs(args));
  };
}
