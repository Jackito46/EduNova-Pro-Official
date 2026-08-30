/**
 * ============================================================================
 * EDUNOVA PRO - MODULE DE MISE EN CACHE LOCALE INTELLIGENTE (LocalStorage)
 * ============================================================================
 * Stratégie de mise en cache côté client pour les requêtes d'Intelligence Artificielle.
 * Permet d'économiser les quotas API Google AI Studio Free Tier en évitant les
 * appels répétitifs sur des données académiques et financières inchangées.
 */

export interface AiCacheRecord<T = any> {
  key: string;
  prefix: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  model?: string;
  source: 'API' | 'CACHE' | 'FALLBACK';
  latencyMs?: number;
  payloadHash?: string;
}

export interface AiLocalCacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  localHits: number;
  localMisses: number;
  hitRatioPct: number;
  entries: Array<{
    key: string;
    prefix: string;
    timeFormatted: string;
    expiresInFormatted: string;
    isExpired: boolean;
    sizeKb: number;
    preview: string;
  }>;
}

const CACHE_PREFIX = 'edunova_ai_cache_';
const METRICS_KEY = 'edunova_ai_cache_metrics';

// Default TTL configurations (en millisecondes)
export const AI_CACHE_TTL = {
  STUDENT_REPORT: 48 * 60 * 60 * 1000,    // 48 heures pour les bulletins d'élèves
  FINANCIAL_AUDIT: 12 * 60 * 60 * 1000,   // 12 heures pour les audits financiers
  TEXT_PROMPT: 24 * 60 * 60 * 1000,       // 24 heures pour les prompts généraux
  DIAGNOSTIC: 6 * 60 * 60 * 1000,         // 6 heures pour les diagnostics
};

/**
 * Fonction de hachage déterministe rapide (DJB2 + CRC-style) pour chaînes JSON
 */
function deterministicHash(str: string): string {
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  return `${(hash1 >>> 0).toString(36)}_${(hash2 >>> 0).toString(36)}`;
}

/**
 * Sérialisation canonique et déterministe d'un objet (trie récursivement les clés)
 */
function canonicalStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(k => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Gestionnaire des métriques d'accès (Hits / Misses)
 */
function getMetrics(): { hits: number; misses: number } {
  try {
    const raw = localStorage.getItem(METRICS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return { hits: 0, misses: 0 };
}

function recordHit() {
  try {
    const m = getMetrics();
    m.hits += 1;
    localStorage.setItem(METRICS_KEY, JSON.stringify(m));
  } catch (e) {}
}

function recordMiss() {
  try {
    const m = getMetrics();
    m.misses += 1;
    localStorage.setItem(METRICS_KEY, JSON.stringify(m));
  } catch (e) {}
}

export const aiLocalCache = {
  /**
   * Génère une clé de cache déterministe pour une action et un jeu de données
   */
  generateKey(actionPrefix: 'student' | 'finance' | 'text' | 'diag', payload: any): string {
    const canon = canonicalStringify(payload);
    const hash = deterministicHash(canon);
    return `${CACHE_PREFIX}${actionPrefix}_${hash}`;
  },

  /**
   * Récupère une entrée du cache si elle est valide et non expirée
   */
  get<T = any>(cacheKey: string): { data: T; record: AiCacheRecord<T> } | null {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) {
        recordMiss();
        return null;
      }

      const record: AiCacheRecord<T> = JSON.parse(raw);
      const now = Date.now();

      // Vérification de la date d'expiration
      if (record.expiresAt && now > record.expiresAt) {
        localStorage.removeItem(cacheKey);
        recordMiss();
        return null;
      }

      recordHit();
      return { data: record.data, record };
    } catch (err) {
      console.warn('[AI Cache] Error reading cache item:', err);
      recordMiss();
      return null;
    }
  },

  /**
   * Enregistre un résultat dans le cache local avec gestion de saturation mémoire
   */
  set<T = any>(
    cacheKey: string,
    data: T,
    options?: {
      ttlMs?: number;
      model?: string;
      source?: 'API' | 'CACHE' | 'FALLBACK';
      latencyMs?: number;
      prefix?: string;
    }
  ): void {
    const now = Date.now();
    const ttl = options?.ttlMs || AI_CACHE_TTL.TEXT_PROMPT;
    const expiresAt = now + ttl;

    const record: AiCacheRecord<T> = {
      key: cacheKey,
      prefix: options?.prefix || cacheKey.replace(CACHE_PREFIX, '').split('_')[0] || 'general',
      data,
      timestamp: now,
      expiresAt,
      model: options?.model || 'Gemini Pro / Flash',
      source: options?.source || 'API',
      latencyMs: options?.latencyMs || 0
    };

    const serialized = JSON.stringify(record);

    try {
      localStorage.setItem(cacheKey, serialized);
    } catch (e: any) {
      // Si le localStorage est plein (QuotaExceededError), supprimer les entrées les plus anciennes
      console.warn('[AI Cache] LocalStorage quota exceeded, purging expired/old items...');
      aiLocalCache.pruneOldEntries();
      try {
        localStorage.setItem(cacheKey, serialized);
      } catch (retryError) {
        console.error('[AI Cache] Unable to write cache even after prune:', retryError);
      }
    }
  },

  /**
   * Supprime les entrées expirées ou les plus anciennes pour libérer de l'espace
   */
  pruneOldEntries(): void {
    try {
      const now = Date.now();
      const entries: Array<{ key: string; timestamp: number; expiresAt: number }> = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX) && key !== METRICS_KEY) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const record: AiCacheRecord = JSON.parse(raw);
              if (record.expiresAt && now > record.expiresAt) {
                localStorage.removeItem(key);
              } else {
                entries.push({ key, timestamp: record.timestamp || 0, expiresAt: record.expiresAt || 0 });
              }
            }
          } catch (e) {
            localStorage.removeItem(key);
          }
        }
      }

      // Si encore trop d'entrées, trier par timestamp et supprimer les 25% les plus anciennes
      if (entries.length > 20) {
        entries.sort((a, b) => a.timestamp - b.timestamp);
        const toDeleteCount = Math.ceil(entries.length * 0.25);
        for (let i = 0; i < toDeleteCount; i++) {
          localStorage.removeItem(entries[i].key);
        }
      }
    } catch (e) {
      console.warn('[AI Cache] Error during prune:', e);
    }
  },

  /**
   * Récupère les statistiques complètes du cache local pour la télémétrie et le panneau de santé
   */
  getStats(): AiLocalCacheStats {
    const now = Date.now();
    let totalSizeBytes = 0;
    const items: Array<{
      key: string;
      prefix: string;
      timeFormatted: string;
      expiresInFormatted: string;
      isExpired: boolean;
      sizeKb: number;
      preview: string;
    }> = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX) && key !== METRICS_KEY) {
          const raw = localStorage.getItem(key) || '';
          const size = new Blob([raw]).size;
          totalSizeBytes += size;

          try {
            const record: AiCacheRecord = JSON.parse(raw);
            const isExpired = !!(record.expiresAt && now > record.expiresAt);
            const remainingMs = Math.max(0, (record.expiresAt || now) - now);
            const remainingHours = Math.round(remainingMs / (1000 * 60 * 60));

            let preview = '';
            if (typeof record.data === 'string') {
              preview = record.data.replace(/\n/g, ' ').substring(0, 80);
            } else {
              preview = JSON.stringify(record.data).substring(0, 80);
            }

            items.push({
              key,
              prefix: record.prefix || key.replace(CACHE_PREFIX, '').split('_')[0],
              timeFormatted: new Date(record.timestamp || now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              expiresInFormatted: isExpired ? 'Expiré' : remainingHours > 0 ? `${remainingHours}h` : '<1h',
              isExpired,
              sizeKb: Math.round((size / 1024) * 10) / 10,
              preview: preview + (preview.length >= 80 ? '...' : '')
            });
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[AI Cache] Error calculating stats:', e);
    }

    const metrics = getMetrics();
    const totalRequests = metrics.hits + metrics.misses;
    const hitRatioPct = totalRequests > 0 ? Math.round((metrics.hits / totalRequests) * 100) : 100;

    const sizeKb = totalSizeBytes / 1024;
    const totalSizeFormatted = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} Mo` : `${sizeKb.toFixed(1)} Ko`;

    return {
      totalEntries: items.length,
      totalSizeBytes,
      totalSizeFormatted,
      localHits: metrics.hits,
      localMisses: metrics.misses,
      hitRatioPct,
      entries: items
    };
  },

  /**
   * Efface toutes les données en cache IA du navigateur
   */
  clearAll(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(CACHE_PREFIX) || key === METRICS_KEY)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.error('[AI Cache] Error clearing cache:', e);
    }
  }
};
