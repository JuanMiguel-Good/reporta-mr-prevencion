import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { AIUsageDetails } from '../types/database';

export function useAIUsage(companyId: string | null) {
  const [usage, setUsage] = useState<AIUsageDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    loadUsage();

    const interval = setInterval(() => {
      loadUsage();
    }, 60000);

    return () => clearInterval(interval);
  }, [companyId]);

  const loadUsage = async () => {
    try {
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_ai_usage_detailed', {
        company_uuid: companyId,
      });

      if (rpcError) throw rpcError;

      setUsage(data as AIUsageDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar uso de IA');
      console.error('Error loading AI usage:', err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setLoading(true);
    loadUsage();
  };

  return { usage, loading, error, refresh };
}