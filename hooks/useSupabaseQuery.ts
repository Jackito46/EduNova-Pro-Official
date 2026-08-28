import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

interface QueryOptions {
  cacheKey?: string;
  ttl?: number; // Time to live in milliseconds
  enabled?: boolean;
}

export const useSupabaseQuery = <T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: QueryOptions = {}
) => {
  const { cacheKey, ttl = 1000 * 60 * 5, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(enabled);
  const [retryCount, setRetryCount] = useState(0);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled && !force) return;

    // Check cache
    if (cacheKey && !force) {
      const cached = localStorage.getItem(`cache_${cacheKey}`);
      if (cached) {
        const { value, expiry } = JSON.parse(cached);
        if (Date.now() < expiry) {
          setData(value);
          setLoading(false);
          return;
        }
      }
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: queryError } = await queryFn();
      
      if (queryError) {
        throw queryError;
      }

      setData(result);
      
      // Save to cache
      if (cacheKey && result) {
        localStorage.setItem(`cache_${cacheKey}`, JSON.stringify({
          value: result,
          expiry: Date.now() + ttl
        }));
      }
    } catch (err: any) {
      console.error(`Query error [${cacheKey || 'anonymous'}]:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [queryFn, cacheKey, ttl, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData, retryCount]);

  const refetch = () => {
    setRetryCount(prev => prev + 1);
  };

  return { data, error, loading, refetch };
};
