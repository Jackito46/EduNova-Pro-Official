/**
 * Middleware d'analyse de sécurité des requêtes sortantes (Outgoing API Security Middleware)
 * 
 * Intercepte et inspecte les requêtes sortantes (Supabase PostgREST, RPC, Auth, et API REST /api/*)
 * afin de bloquer en amont les tentatives d'injections SQL, charges utiles malformées,
 * caractères de contrôle non autorisés et attaques par falsification de requêtes.
 * 
 * Basé sur les patterns de sécurité observés dans App.tsx (AuditLogger, consoleSanitizer,
 * authHelpers, gestion d'erreurs d'état et notifications d'alerte de sécurité).
 */

export interface SecurityViolation {
  category: 'SQL_INJECTION' | 'MALFORMED_PAYLOAD' | 'PROHIBITED_CHARS' | 'OVERSIZED_PAYLOAD';
  pattern: string;
  location: 'url' | 'body' | 'headers' | 'query';
  sample: string;
}

export interface SecurityAnalysisResult {
  isSafe: boolean;
  violation?: SecurityViolation;
}

/**
 * Motifs d'injection SQL stricts (mots-clés destructeurs, tautologies, commentaires, empilements)
 */
const SQL_INJECTION_RULES: { pattern: RegExp; description: string }[] = [
  // Tautologies classiques (ex: 1=1, 'a'='a', 1=1--, ' or '1'='1)
  {
    pattern: /(?:'|"|`|\b)(?:or|and)\s+(?:'[^']+'|[0-9]+)\s*=\s*(?:'[^']+'|[0-9]+)/i,
    description: "Tautologie logique SQL ('1'='1' ou 'a'='a')"
  },
  // Mots-clés SQL combinés dangereux (UNION SELECT, DROP TABLE, etc.)
  {
    pattern: /\b(union\s+(?:all\s+)?select|insert\s+into|delete\s+from|drop\s+(?:table|database|function|view)|alter\s+table|truncate\s+table)\b/i,
    description: "Commande SQL combinée suspecte (UNION SELECT, DROP, TRUNCATE)"
  },
  // Injections de commentaires SQL et terminaisons de requêtes (-- ou /* ... */ ou ;)
  {
    pattern: /(?:--\s|\/\*.*?\*\/|;\s*(?:select|insert|update|delete|drop|alter|exec|declare)\b)/i,
    description: "Séquence de commentaire SQL ou empilement d'instructions point-virgule"
  },
  // Fonctions de temporisation aveugle / blind injection (ex: pg_sleep, waitfor delay)
  {
    pattern: /\b(?:pg_sleep|waitfor\s+delay|benchmark)\s*\(/i,
    description: "Tentative d'injection SQL temporelle (pg_sleep / benchmark)"
  },
  // Appel à exec / execute arbitraire ou crypt / cast non paramétré
  {
    pattern: /\b(?:exec|execute)\s+(?:sp_|xp_|immediate)\b/i,
    description: "Exécution de procédure SQL dynamique non autorisée"
  }
];

/**
 * Détecte les caractères de contrôle non imprimables (null bytes, carriage injection, etc.)
 */
const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

/**
 * Endpoints autorisés à contenir des mots-clés SQL légitimes (ex: export ou audit)
 */
const WHITELISTED_PATHS = [
  '/api/export-github',
  '/api/backups'
];

/**
 * Analyse une chaîne de caractères pour identifier des signatures d'injection SQL
 */
export function analyzeStringForSqlInjection(input: string): { detected: boolean; rule?: string; sample?: string } {
  if (!input || typeof input !== 'string') return { detected: false };

  // Vérification de la présence de null bytes ou caractères de contrôle dangereux
  if (CONTROL_CHAR_REGEX.test(input)) {
    return {
      detected: true,
      rule: "Caractères de contrôle non imprimables / Null-byte injecté",
      sample: input.slice(0, 60)
    };
  }

  for (const { pattern, description } of SQL_INJECTION_RULES) {
    if (pattern.test(input)) {
      return {
        detected: true,
        rule: description,
        sample: input.slice(0, 80)
      };
    }
  }

  return { detected: false };
}

/**
 * Analyse récursive d'un objet (payload JSON, query parameters)
 */
export function analyzePayloadRecursively(
  payload: any, 
  currentPath = '', 
  depth = 0
): { detected: boolean; path?: string; rule?: string; sample?: string } {
  if (depth > 8) return { detected: false };
  if (payload === null || payload === undefined) return { detected: false };

  if (typeof payload === 'string') {
    // Ignorer les chaînes de types tokens ou hashes base64 longs
    if (payload.startsWith('eyJ') || payload.length > 5000) {
      return { detected: false };
    }
    const result = analyzeStringForSqlInjection(payload);
    if (result.detected) {
      return {
        detected: true,
        path: currentPath || 'root',
        rule: result.rule,
        sample: result.sample
      };
    }
    return { detected: false };
  }

  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i++) {
      const res = analyzePayloadRecursively(payload[i], `${currentPath}[${i}]`, depth + 1);
      if (res.detected) return res;
    }
    return { detected: false };
  }

  if (typeof payload === 'object') {
    for (const [key, value] of Object.entries(payload)) {
      // Analyser la clé elle-même
      const keyAnalysis = analyzeStringForSqlInjection(key);
      if (keyAnalysis.detected) {
        return {
          detected: true,
          path: `${currentPath}.${key}`,
          rule: keyAnalysis.rule,
          sample: key
        };
      }
      // Analyser la valeur
      const valAnalysis = analyzePayloadRecursively(value, `${currentPath}.${key}`, depth + 1);
      if (valAnalysis.detected) return valAnalysis;
    }
  }

  return { detected: false };
}

/**
 * Vérifie une requête API sortante avant sa transmission au réseau.
 */
export function inspectOutgoingRequest(
  url: string, 
  options?: RequestInit
): SecurityAnalysisResult {
  if (!url || typeof url !== 'string') {
    return {
      isSafe: false,
      violation: {
        category: 'MALFORMED_PAYLOAD',
        pattern: 'URL vide ou invalide',
        location: 'url',
        sample: String(url)
      }
    };
  }

  // Si l'URL fait partie des chemins autorisés
  const isWhitelisted = WHITELISTED_PATHS.some(path => url.includes(path));
  if (isWhitelisted) {
    return { isSafe: true };
  }

  // 1. Analyse de l'URL et de la query string (y compris PostgREST filters comme ?id=eq.1)
  try {
    const decodedUrl = decodeURIComponent(url);
    const urlAnalysis = analyzeStringForSqlInjection(decodedUrl);
    if (urlAnalysis.detected) {
      return {
        isSafe: false,
        violation: {
          category: 'SQL_INJECTION',
          pattern: urlAnalysis.rule || 'Motif SQL malveillant dans URL',
          location: 'url',
          sample: urlAnalysis.sample || url.slice(0, 100)
        }
      };
    }
  } catch (decodeErr) {
    // Si l'URL ne peut même pas être décodée, c'est une requête malformée
    return {
      isSafe: false,
      violation: {
        category: 'MALFORMED_PAYLOAD',
        pattern: 'URL malformée (échec decodeURIComponent)',
        location: 'url',
        sample: url.slice(0, 100)
      }
    };
  }

  // 2. Analyse du Body (POST/PUT/PATCH)
  if (options && options.body) {
    const body = options.body;

    if (typeof body === 'string') {
      // Vérification JSON malformé si le header indique JSON
      const contentType = (options.headers as any)?.['Content-Type'] || (options.headers as any)?.['content-type'];
      const isJson = typeof contentType === 'string' && contentType.includes('json');

      if (isJson || body.startsWith('{') || body.startsWith('[')) {
        try {
          const parsed = JSON.parse(body);
          const payloadAnalysis = analyzePayloadRecursively(parsed);
          if (payloadAnalysis.detected) {
            return {
              isSafe: false,
              violation: {
                category: 'SQL_INJECTION',
                pattern: payloadAnalysis.rule || 'Motif SQL malveillant dans payload JSON',
                location: 'body',
                sample: payloadAnalysis.sample || ''
              }
            };
          }
        } catch (jsonErr) {
          return {
            isSafe: false,
            violation: {
              category: 'MALFORMED_PAYLOAD',
              pattern: 'Payload JSON malformé',
              location: 'body',
              sample: body.slice(0, 100)
            }
          };
        }
      } else {
        // Corps texte brut
        const textAnalysis = analyzeStringForSqlInjection(body);
        if (textAnalysis.detected) {
          return {
            isSafe: false,
            violation: {
              category: 'SQL_INJECTION',
              pattern: textAnalysis.rule || 'Motif SQL malveillant dans corps de requête',
              location: 'body',
              sample: textAnalysis.sample || ''
            }
          };
        }
      }
    }
  }

  return { isSafe: true };
}

/**
 * Notifie l'application d'une alerte de sécurité critique via l'événement custom `edunova_security_alert`
 * synchronisé avec le bandeau d'alerte `apiError` dans App.tsx.
 */
export function dispatchSecurityAlert(violation: SecurityViolation, url: string) {
  if (typeof window === 'undefined') return;

  const eventDetail = {
    message: `Tentative d'opération bloquée par le middleware de sécurité (${violation.pattern}).`,
    violation,
    url: url.slice(0, 80),
    timestamp: Date.now()
  };

  console.warn('[Outgoing API Security Middleware] 🛡️ Requête sortante bloquée:', eventDetail);

  // Dispatch de l'événement système pour que App.tsx puisse afficher le bandeau apiError
  try {
    const customEvent = new CustomEvent('edunova_security_alert', {
      detail: eventDetail
    });
    window.dispatchEvent(customEvent);
  } catch (e) {}
}

/**
 * Active le middleware de sécurité global sur window.fetch
 */
let isInstalled = false;

export function installOutgoingSecurityMiddleware() {
  if (isInstalled || typeof window === 'undefined' || !window.fetch) return;

  const originalFetch = window.fetch;

  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlString = typeof input === 'string' 
      ? input 
      : input instanceof URL 
        ? input.toString() 
        : (input as Request).url || '';

    // Analyse de la requête
    const analysis = inspectOutgoingRequest(urlString, init);

    if (!analysis.isSafe && analysis.violation) {
      // Déclencher l'alerte de sécurité visible dans App.tsx
      dispatchSecurityAlert(analysis.violation, urlString);

      // Bloquer immédiatement la requête et renvoyer une réponse HTTP 400 Bad Request
      return new Response(
        JSON.stringify({
          error: "Requête bloquée par la couche d'analyse de sécurité EduNova Pro.",
          reason: analysis.violation.pattern,
          category: analysis.violation.category,
          location: analysis.violation.location
        }),
        {
          status: 400,
          statusText: "Bad Request - Security Middleware Block",
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Requête légitime : poursuite normale
    return originalFetch.apply(this, [input, init]);
  };

  isInstalled = true;
  console.log('[Outgoing API Security Middleware] 🛡️ Couche de détection active et opérationnelle.');
}
