import { useEffect, useState } from 'react';
import { Brain, TrendingUp, AlertCircle, CheckCircle, Clock, ArrowUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { AIUsageDetails } from '../../types/database';

interface AIUsageDashboardProps {
  onRequestLimitIncrease?: () => void;
}

export function AIUsageDashboard({ onRequestLimitIncrease }: AIUsageDashboardProps) {
  const { user } = useAuth();
  const [usage, setUsage] = useState<AIUsageDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.company_id) {
      loadUsage();
    }
  }, [user?.company_id]);

  const loadUsage = async () => {
    if (!user?.company_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_ai_usage_detailed', {
        company_uuid: user.company_id,
      });

      if (error) throw error;

      setUsage(data);
    } catch (error) {
      console.error('Error loading AI usage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!usage) {
    return null;
  }

  const getStatusIcon = () => {
    switch (usage.status) {
      case 'exceeded':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-orange-600" />;
      case 'caution':
        return <AlertCircle className="w-6 h-6 text-yellow-600" />;
      case 'disabled':
        return <Brain className="w-6 h-6 text-gray-400" />;
      default:
        return <CheckCircle className="w-6 h-6 text-green-600" />;
    }
  };

  const getStatusColor = () => {
    switch (usage.status) {
      case 'exceeded':
        return 'bg-red-100 border-red-300 text-red-900';
      case 'warning':
        return 'bg-orange-100 border-orange-300 text-orange-900';
      case 'caution':
        return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      case 'disabled':
        return 'bg-gray-100 border-gray-300 text-gray-900';
      default:
        return 'bg-green-100 border-green-300 text-green-900';
    }
  };

  const getProgressColor = () => {
    if (usage.percentage >= 100) return 'bg-red-600';
    if (usage.percentage >= 80) return 'bg-orange-600';
    if (usage.percentage >= 50) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  const getStatusMessage = () => {
    if (!usage.enabled) return 'El análisis con IA está deshabilitado';
    if (usage.status === 'exceeded') return 'Has alcanzado el límite mensual de análisis IA';
    if (usage.status === 'warning') return 'Estás cerca del límite mensual';
    if (usage.status === 'caution') return 'Has usado la mitad de tu límite mensual';
    return 'Uso de IA dentro del límite normal';
  };

  if (!usage.enabled) {
    return (
      <div className="bg-gray-50 rounded-lg border-2 border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <Brain className="w-8 h-8 text-gray-400 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Análisis con IA Deshabilitado
            </h3>
            <p className="text-sm text-gray-600">
              El análisis con inteligencia artificial no está disponible en tu plan actual.
              Contacta al administrador para habilitar esta funcionalidad.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border-2 p-6 ${getStatusColor()}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold">Uso de Análisis IA</h3>
            <p className="text-sm opacity-90">{getStatusMessage()}</p>
          </div>
        </div>
        {user?.role === 'sst_manager' && usage.status !== 'ok' && onRequestLimitIncrease && (
          <button
            onClick={onRequestLimitIncrease}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-900 rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowUp className="w-4 h-4" />
            Solicitar Aumento
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white bg-opacity-50 rounded-lg p-4">
          <div className="text-sm opacity-75 mb-1">Análisis Realizados</div>
          <div className="text-2xl font-bold">{usage.current_usage}</div>
        </div>

        <div className="bg-white bg-opacity-50 rounded-lg p-4">
          <div className="text-sm opacity-75 mb-1">Límite Mensual</div>
          <div className="text-2xl font-bold">{usage.limit}</div>
        </div>

        <div className="bg-white bg-opacity-50 rounded-lg p-4">
          <div className="text-sm opacity-75 mb-1">Disponibles</div>
          <div className="text-2xl font-bold">{usage.remaining}</div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Progreso</span>
            <span className="font-bold">{(usage.percentage ?? 0).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-white bg-opacity-30 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${Math.min(usage.percentage ?? 0, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" />
            <div>
              <div className="font-medium">Días restantes</div>
              <div className="opacity-90">{usage.days_left_in_month} días</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4" />
            <div>
              <div className="font-medium">Promedio diario</div>
              <div className="opacity-90">{(usage.estimated_daily_usage ?? 0).toFixed(1)} análisis</div>
            </div>
          </div>
        </div>

        {usage.will_exceed_at_current_rate && (
          <div className="mt-4 p-3 bg-white bg-opacity-50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold mb-1">Advertencia</div>
                <div className="opacity-90">
                  Al ritmo actual de uso, es probable que excedas tu límite mensual antes de fin de mes.
                  {user?.role === 'sst_manager' && onRequestLimitIncrease && (
                    <span> Considera solicitar un aumento de límite.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}