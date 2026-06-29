import { AlertTriangle, Info, XCircle } from 'lucide-react';
import type { AIUsageDetails } from '../../types/database';

interface AILimitAlertProps {
  usage: AIUsageDetails;
  onRequestIncrease?: () => void;
  canRequestIncrease?: boolean;
}

export function AILimitAlert({ usage, onRequestIncrease, canRequestIncrease = false }: AILimitAlertProps) {
  if (!usage.enabled || usage.status === 'ok') {
    return null;
  }

  const getAlertConfig = () => {
    switch (usage.status) {
      case 'exceeded':
        return {
          icon: <XCircle className="w-5 h-5" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-500',
          title: 'Límite de IA alcanzado',
          message: 'Has alcanzado el límite mensual de análisis de IA. Los reportes se crearán en modo manual hasta el próximo mes.',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-500',
          title: 'Quedan pocos análisis disponibles',
          message: `Has usado el ${(usage.percentage ?? 0).toFixed(0)}% de tu límite mensual. Solo quedan ${usage.remaining} análisis disponibles.`,
        };
      case 'caution':
        return {
          icon: <Info className="w-5 h-5" />,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-500',
          title: 'Mitad del límite alcanzado',
          message: `Has usado el ${(usage.percentage ?? 0).toFixed(0)}% de tu límite mensual. Quedan ${usage.remaining} análisis disponibles.`,
        };
      default:
        return null;
    }
  };

  const config = getAlertConfig();
  if (!config) return null;

  return (
    <div className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4`}>
      <div className="flex gap-3">
        <div className={config.iconColor}>
          {config.icon}
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <h3 className={`font-semibold ${config.textColor}`}>
              {config.title}
            </h3>
            <p className={`text-sm ${config.textColor} mt-1`}>
              {config.message}
            </p>
          </div>

          {usage.will_exceed_at_current_rate && usage.status !== 'exceeded' && (
            <p className={`text-sm ${config.textColor}`}>
              A tu ritmo actual ({(usage.estimated_daily_usage ?? 0).toFixed(1)} análisis/día),
              excederás el límite antes de fin de mes.
            </p>
          )}

          {canRequestIncrease && onRequestIncrease && (
            <button
              onClick={onRequestIncrease}
              className="text-sm font-medium underline hover:no-underline"
            >
              Solicitar aumento de límite
            </button>
          )}
        </div>
      </div>
    </div>
  );
}