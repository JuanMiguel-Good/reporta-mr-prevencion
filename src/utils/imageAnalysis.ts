import { supabase } from '../lib/supabase';
import { AIAnalysisResult } from '../types/database';

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzeImages(
  photos: File[],
  companyId: string,
  categories: string[]
): Promise<AIAnalysisResult> {
  const imageDataUrls = await Promise.all(
    photos.slice(0, 3).map(photo => fileToBase64(photo))
  );

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-safety-images`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      images: imageDataUrls,
      companyId,
      categories
    })
  });

  if (!response.ok) {
    const error = await response.json();
    const err: any = new Error(error.message || error.error || 'Error al analizar las imágenes');
    err.code = error.code;
    throw err;
  }

  const result: AIAnalysisResult = await response.json();
  return result;
}

// AI availability is determined by the current user's subscription_status in profiles.
// active and trial subscriptions have AI enabled; expired/cancelled do not.
export async function getAISettings(companyId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;

  if (!userId) {
    return { company_id: companyId, ai_enabled: false, monthly_analysis_limit: 0 };
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .maybeSingle();

  const status = profileData?.subscription_status;
  const aiEnabled = status === 'active' || status === 'trial';

  return {
    company_id: companyId,
    ai_enabled: aiEnabled,
    monthly_analysis_limit: aiEnabled ? 100 : 0,
  };
}

export async function getAIUsageStats(companyId: string) {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data, error } = await supabase
    .from('ai_usage_tracking')
    .select('*')
    .eq('company_id', companyId)
    .eq('month', currentMonth)
    .maybeSingle();

  if (error) {
    console.error('Error fetching AI usage stats:', error);
    return null;
  }

  return data;
}

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return 'Excelente';
  if (confidence >= 0.75) return 'Bueno';
  if (confidence >= 0.6) return 'Aceptable';
  return 'Revisar';
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-300';
  if (confidence >= 0.75) return 'text-cyan-300';
  if (confidence >= 0.6) return 'text-yellow-300';
  return 'text-orange-300';
}
