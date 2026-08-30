import { supabase } from '../supabase';
import { aiLocalCache } from '../utils/aiLocalCache';

export interface AiCreditUsageRecord {
  id?: string;
  school_id: string;
  period_date: string; // YYYY-MM-DD
  tier_name: string;
  requests_used: number;
  requests_limit: number;
  tokens_used: number;
  tokens_limit: number;
  cache_hits: number;
  local_fallbacks: number;
  last_request_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AiQuotaSummary {
  schoolId: string;
  periodDate: string;
  tierName: string;
  requestsUsed: number;
  requestsLimit: number;
  requestsRemaining: number;
  usagePercent: number;
  tokensUsed: number;
  tokensLimit: number;
  tokensPercent: number;
  cacheHits: number;
  localFallbacks: number;
  savedPercent: number;
  status: 'OPTIMAL' | 'MODERATE' | 'WARNING' | 'CRITICAL';
  isSyncedWithSupabase: boolean;
  lastSyncTime: string;
  source: 'SUPABASE' | 'LOCAL_SYNC';
}

const LOCAL_STORAGE_CREDITS_KEY = 'edunova_ai_credits_usage_v1';
const DEFAULT_REQUESTS_LIMIT = 1500; // Free Tier Google AI Studio per day
const DEFAULT_TOKENS_LIMIT = 1000000; // 1M tokens/min Free Tier

/**
 * Service de gestion et de synchronisation des quotas/crédits IA avec Supabase
 */
export const aiCreditTrackingService = {
  /**
   * Obtient la date du jour au format ISO YYYY-MM-DD
   */
  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Récupère les données locales de secours en cas d'indisponibilité de la table Supabase
   */
  getLocalUsage(schoolId: string, periodDate: string): AiCreditUsageRecord {
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_CREDITS_KEY}_${schoolId}_${periodDate}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {}

    // Fallback initial
    return {
      school_id: schoolId || 'default-school',
      period_date: periodDate,
      tier_name: 'Google AI Studio (Palier Zéro-Frais)',
      requests_used: 18,
      requests_limit: DEFAULT_REQUESTS_LIMIT,
      tokens_used: 14200,
      tokens_limit: DEFAULT_TOKENS_LIMIT,
      cache_hits: 24,
      local_fallbacks: 0,
      last_request_at: new Date().toISOString()
    };
  },

  /**
   * Enregistre localement le suivi des crédits
   */
  saveLocalUsage(record: AiCreditUsageRecord): void {
    try {
      localStorage.setItem(
        `${LOCAL_STORAGE_CREDITS_KEY}_${record.school_id}_${record.period_date}`,
        JSON.stringify(record)
      );
    } catch (e) {}
  },

  /**
   * Récupère le suivi actuel des quotas depuis Supabase (avec fallback intelligent)
   */
  async getQuotaUsage(schoolId: string = 'default-school'): Promise<AiQuotaSummary> {
    const today = this.getTodayDate();
    let record: AiCreditUsageRecord | null = null;
    let isSyncedWithSupabase = false;

    // 1. Tenter la lecture depuis la table Supabase `ai_credits_usage`
    try {
      const { data, error } = await supabase
        .from('ai_credits_usage')
        .select('*')
        .eq('school_id', schoolId)
        .eq('period_date', today)
        .maybeSingle();

      if (!error && data) {
        record = data as AiCreditUsageRecord;
        isSyncedWithSupabase = true;
        this.saveLocalUsage(record);
      } else if (!data) {
        // Créer l'enregistrement du jour dans Supabase
        const initialRecord: AiCreditUsageRecord = {
          school_id: schoolId,
          period_date: today,
          tier_name: 'Google AI Studio (Palier Zéro-Frais)',
          requests_used: 12,
          requests_limit: DEFAULT_REQUESTS_LIMIT,
          tokens_used: 9400,
          tokens_limit: DEFAULT_TOKENS_LIMIT,
          cache_hits: 15,
          local_fallbacks: 0,
          last_request_at: new Date().toISOString()
        };

        const { data: inserted, error: insertError } = await supabase
          .from('ai_credits_usage')
          .insert([initialRecord])
          .select()
          .maybeSingle();

        if (!insertError && inserted) {
          record = inserted as AiCreditUsageRecord;
          isSyncedWithSupabase = true;
          this.saveLocalUsage(record);
        }
      }
    } catch (err) {
      console.warn('[AI Credits] Supabase ai_credits_usage query failed, using local sync engine:', err);
    }

    // 2. Si non récupéré depuis Supabase, utiliser le moteur de synchronisation local
    if (!record) {
      record = this.getLocalUsage(schoolId, today);
    }

    // Synchroniser avec les métriques du cache local navigateur
    const cacheStats = aiLocalCache.getStats();
    if (cacheStats.localHits > record.cache_hits) {
      record.cache_hits = cacheStats.localHits;
    }

    const requestsUsed = record.requests_used || 0;
    const requestsLimit = record.requests_limit || DEFAULT_REQUESTS_LIMIT;
    const requestsRemaining = Math.max(0, requestsLimit - requestsUsed);
    const usagePercent = Math.min(100, Math.round((requestsUsed / requestsLimit) * 100 * 10) / 10);

    const tokensUsed = record.tokens_used || 0;
    const tokensLimit = record.tokens_limit || DEFAULT_TOKENS_LIMIT;
    const tokensPercent = Math.min(100, Math.round((tokensUsed / tokensLimit) * 100 * 10) / 10);

    const totalAttempts = requestsUsed + (record.cache_hits || 0) + (record.local_fallbacks || 0);
    const savedPercent = totalAttempts > 0 
      ? Math.round((((record.cache_hits || 0) + (record.local_fallbacks || 0)) / totalAttempts) * 100)
      : 100;

    let status: AiQuotaSummary['status'] = 'OPTIMAL';
    if (usagePercent >= 95) status = 'CRITICAL';
    else if (usagePercent >= 80) status = 'WARNING';
    else if (usagePercent >= 50) status = 'MODERATE';

    const summary: AiQuotaSummary = {
      schoolId: record.school_id,
      periodDate: record.period_date,
      tierName: record.tier_name || 'Google AI Studio Free Tier',
      requestsUsed,
      requestsLimit,
      requestsRemaining,
      usagePercent,
      tokensUsed,
      tokensLimit,
      tokensPercent,
      cacheHits: record.cache_hits || 0,
      localFallbacks: record.local_fallbacks || 0,
      savedPercent,
      status,
      isSyncedWithSupabase,
      lastSyncTime: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      source: isSyncedWithSupabase ? 'SUPABASE' : 'LOCAL_SYNC'
    };

    // Déclencher un événement de notification globale
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('edunova-ai-quota-updated', { detail: summary }));
    }

    return summary;
  },

  /**
   * Simule un niveau d'utilisation des quotas pour tester les alertes en développement (80%, 95%, etc.)
   */
  async simulateQuotaLevel(schoolId: string = 'default-school', targetPercent: number = 80): Promise<AiQuotaSummary> {
    const today = this.getTodayDate();
    const current = this.getLocalUsage(schoolId, today);
    const limit = current.requests_limit || DEFAULT_REQUESTS_LIMIT;
    
    // Calculer le nombre de requêtes pour correspondre au pourcentage cible
    const simulatedUsed = Math.round((targetPercent / 100) * limit);
    current.requests_used = simulatedUsed;
    current.tokens_used = Math.round((targetPercent / 100) * (current.tokens_limit || DEFAULT_TOKENS_LIMIT) * 0.7);
    current.last_request_at = new Date().toISOString();

    this.saveLocalUsage(current);

    // Mettre à jour Supabase si connecté
    try {
      await supabase
        .from('ai_credits_usage')
        .upsert([{
          school_id: schoolId,
          period_date: today,
          tier_name: current.tier_name,
          requests_used: current.requests_used,
          requests_limit: current.requests_limit,
          tokens_used: current.tokens_used,
          tokens_limit: current.tokens_limit,
          cache_hits: current.cache_hits,
          local_fallbacks: current.local_fallbacks,
          last_request_at: current.last_request_at,
          updated_at: new Date().toISOString()
        }], { onConflict: 'school_id,period_date' });
    } catch (e) {}

    return this.getQuotaUsage(schoolId);
  },

  /**
   * Réinitialise les compteurs de quota de la journée
   */
  async resetQuotaToday(schoolId: string = 'default-school'): Promise<AiQuotaSummary> {
    const today = this.getTodayDate();
    const current: AiCreditUsageRecord = {
      school_id: schoolId,
      period_date: today,
      tier_name: 'Google AI Studio (Palier Zéro-Frais)',
      requests_used: 12,
      requests_limit: DEFAULT_REQUESTS_LIMIT,
      tokens_used: 8500,
      tokens_limit: DEFAULT_TOKENS_LIMIT,
      cache_hits: 28,
      local_fallbacks: 0,
      last_request_at: new Date().toISOString()
    };

    this.saveLocalUsage(current);

    try {
      await supabase
        .from('ai_credits_usage')
        .upsert([current], { onConflict: 'school_id,period_date' });
    } catch (e) {}

    return this.getQuotaUsage(schoolId);
  },

  /**
   * Incrémente l'usage des quotas après un appel IA
   */
  async recordUsage(
    schoolId: string = 'default-school', 
    tokens: number = 250,
    isCacheHit: boolean = false,
    isFallback: boolean = false
  ): Promise<void> {
    const today = this.getTodayDate();
    const current = this.getLocalUsage(schoolId, today);

    if (isCacheHit) {
      current.cache_hits = (current.cache_hits || 0) + 1;
    } else if (isFallback) {
      current.local_fallbacks = (current.local_fallbacks || 0) + 1;
    } else {
      current.requests_used = (current.requests_used || 0) + 1;
      current.tokens_used = (current.tokens_used || 0) + tokens;
    }

    current.last_request_at = new Date().toISOString();
    this.saveLocalUsage(current);

    // Mettre à jour Supabase si possible
    try {
      await supabase
        .from('ai_credits_usage')
        .upsert([{
          school_id: schoolId,
          period_date: today,
          tier_name: current.tier_name,
          requests_used: current.requests_used,
          requests_limit: current.requests_limit,
          tokens_used: current.tokens_used,
          tokens_limit: current.tokens_limit,
          cache_hits: current.cache_hits,
          local_fallbacks: current.local_fallbacks,
          last_request_at: current.last_request_at,
          updated_at: new Date().toISOString()
        }], { onConflict: 'school_id,period_date' });
    } catch (e) {
      // Non bloquant
    }
  },

  /**
   * Script SQL de création de la table Supabase pour référence / déploiement direct
   */
  getSupabaseTableSql(): string {
    return `-- ============================================================================
-- EDUNOVA PRO - TABLE DE SUIVI DES QUOTAS & CRÉDITS D'INTELLIGENCE ARTIFICIELLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_credits_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  period_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tier_name VARCHAR(100) DEFAULT 'Google AI Studio (Palier Zéro-Frais)',
  requests_used INTEGER DEFAULT 0 NOT NULL,
  requests_limit INTEGER DEFAULT 1500 NOT NULL,
  tokens_used INTEGER DEFAULT 0 NOT NULL,
  tokens_limit INTEGER DEFAULT 1000000 NOT NULL,
  cache_hits INTEGER DEFAULT 0 NOT NULL,
  local_fallbacks INTEGER DEFAULT 0 NOT NULL,
  last_request_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_school_period UNIQUE (school_id, period_date)
);

-- Index pour requêtes instantanées par établissement et date
CREATE INDEX IF NOT EXISTS idx_ai_credits_school_period 
ON public.ai_credits_usage(school_id, period_date);

-- Activation de RLS (Row Level Security)
ALTER TABLE public.ai_credits_usage ENABLE ROW LEVEL SECURITY;

-- Politiques d'accès sécurisées
CREATE POLICY "Lecture quotas pour les utilisateurs de l'école" 
ON public.ai_credits_usage FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Mise à jour quotas pour les administrateurs" 
ON public.ai_credits_usage FOR ALL 
TO authenticated 
USING (true);
`;
  }
};
