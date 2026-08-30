import { aiLocalCache, AI_CACHE_TTL } from '../utils/aiLocalCache';
import { aiCreditTrackingService } from './aiCreditTrackingService';

export interface GeminiRequestOptions {
  forceRefresh?: boolean;
  ttlMs?: number;
  type?: string;
  schoolId?: string;
}

export const geminiService = {
  /**
   * Generates a pedagogical comment based on student performance.
   * Utilise le cache local pour éviter de reconsommer du quota sur les mêmes notes.
   */
  async generateStudentReport(
    studentName: string, 
    grades: any[], 
    options?: GeminiRequestOptions
  ): Promise<string> {
    const cacheKey = aiLocalCache.generateKey('student', { studentName, grades });
    const schoolId = options?.schoolId || 'default-school';

    // 1. Vérification du cache local navigateur (0 latence, 0 quota consommé)
    if (!options?.forceRefresh) {
      const cached = aiLocalCache.get<string>(cacheKey);
      if (cached && cached.data) {
        aiCreditTrackingService.recordUsage(schoolId, 0, true, false);
        return cached.data;
      }
    }

    // 2. Appel API serveur si non présent en cache ou rafraîchissement forcé
    try {
      const startTime = performance.now();
      const response = await fetch('/api/gemini/generate-student-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, grades }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const text = data.text || "Analyse pédagogique haute précision indisponible.";
      const latencyMs = Math.round(performance.now() - startTime);

      // 3. Sauvegarde dans le cache local avec TTL de 48h
      aiLocalCache.set(cacheKey, text, {
        ttlMs: options?.ttlMs || AI_CACHE_TTL.STUDENT_REPORT,
        model: data.model || 'Gemini 2.5 Flash',
        source: data.source || 'API',
        latencyMs: data.latencyMs || latencyMs,
        prefix: 'student'
      });

      // 4. Enregistrement télémétrique du crédit consommé
      aiCreditTrackingService.recordUsage(
        schoolId, 
        280, 
        false, 
        data.source === 'FALLBACK'
      );

      return text;
    } catch (error: any) {
      console.error("Gemini Pro Error:", error?.message || error);
      aiCreditTrackingService.recordUsage(schoolId, 0, false, true);
      return "Analyse pédagogique haute précision indisponible.";
    }
  },

  /**
   * Analyzes financial trends for the school administrator.
   * Réutilise l'analyse en cache tant que les données financières restent identiques.
   */
  async analyzeFinancialHealth(
    stats: any, 
    options?: GeminiRequestOptions
  ): Promise<string> {
    const cacheKey = aiLocalCache.generateKey('finance', stats);
    const schoolId = options?.schoolId || 'default-school';

    // 1. Vérification du cache local
    if (!options?.forceRefresh) {
      const cached = aiLocalCache.get<string>(cacheKey);
      if (cached && cached.data) {
        aiCreditTrackingService.recordUsage(schoolId, 0, true, false);
        return cached.data;
      }
    }

    // 2. Appel API serveur
    try {
      const startTime = performance.now();
      const response = await fetch('/api/gemini/analyze-financial-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const text = data.text || "Audit financier stratégique indisponible.";
      const latencyMs = Math.round(performance.now() - startTime);

      // 3. Mise en cache local avec TTL de 12h
      aiLocalCache.set(cacheKey, text, {
        ttlMs: options?.ttlMs || AI_CACHE_TTL.FINANCIAL_AUDIT,
        model: data.model || 'Gemini 2.5 Flash',
        source: data.source || 'API',
        latencyMs: data.latencyMs || latencyMs,
        prefix: 'finance'
      });

      aiCreditTrackingService.recordUsage(
        schoolId, 
        350, 
        false, 
        data.source === 'FALLBACK'
      );

      return text;
    } catch (error: any) {
      console.error("Gemini Finance Error:", error?.message || error);
      aiCreditTrackingService.recordUsage(schoolId, 0, false, true);
      return "Audit financier stratégique indisponible.";
    }
  },

  /**
   * Generates a generic text response based on a prompt.
   */
  async generateText(
    prompt: string, 
    options?: GeminiRequestOptions
  ): Promise<string | null> {
    const cacheKey = aiLocalCache.generateKey('text', { prompt });
    const schoolId = options?.schoolId || 'default-school';

    // 1. Vérification du cache local
    if (!options?.forceRefresh) {
      const cached = aiLocalCache.get<string>(cacheKey);
      if (cached && cached.data) {
        aiCreditTrackingService.recordUsage(schoolId, 0, true, false);
        return cached.data;
      }
    }

    // 2. Appel API serveur
    try {
      const startTime = performance.now();
      const response = await fetch('/api/gemini/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, type: options?.type }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const latencyMs = Math.round(performance.now() - startTime);

      if (data.text) {
        aiLocalCache.set(cacheKey, data.text, {
          ttlMs: options?.ttlMs || AI_CACHE_TTL.TEXT_PROMPT,
          model: data.model || 'Gemini 2.5 Flash',
          source: data.source || 'API',
          latencyMs: data.latencyMs || latencyMs,
          prefix: 'text'
        });
      }

      aiCreditTrackingService.recordUsage(
        schoolId, 
        200, 
        false, 
        data.source === 'FALLBACK'
      );

      return data.text;
    } catch (error: any) {
      console.error("Gemini Text Generation Error:", error?.message || error);
      aiCreditTrackingService.recordUsage(schoolId, 0, false, true);
      return null;
    }
  },

  /**
   * Expose les outils de gestion du cache local
   */
  cache: aiLocalCache
};

