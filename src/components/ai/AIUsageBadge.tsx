import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import type { AIUsageDetails } from '../../types/database';

interface AIUsageBadgeProps {
  usage: AIUsageDetails;
  showDetails?: boolean;
}

export function AIUsageBadge({ usage, showDetails = false }: AIUsageBadgeProps) {
  const getStatusColor = () => {
    switch (usage.status) {
      case 'exceeded':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'caution':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'ok':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'disabled':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = () => {
    switch (usage.status) {
      case 'exceeded':
        return <XCircle className="w-4 h-4" />;
      case 'warning':
      case 'caution':
        return <AlertCircle className="w-4 h-4" />;
      case 'ok':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    if (!usage.enabled) return 'IA Deshabilitada';
    if (usage.status === 'exceeded') return 'Límite Alcanzado';
    return `${usage.current_usage} / ${usage.limit}`;
  };

  return (
    <div className="space-y-2">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${getStatusColor()}`}>
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </div>

      {showDetails && usage.enabled && (
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Porcentaje usado:</span>
            <span className="font-medium">{(usage.percentage ?? 0).toFixed(1)}%</span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                usage.status === 'exceeded' ? 'bg-red-500' :
                usage.status === 'warning' ? 'bg-orange-500' :
                usage.status === 'caution' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(usage.percentage ?? 0, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Restantes: {usage.remaining}</span>
            <span>Días en el mes: {usage.days_left_in_month}</span>
          </div>

          {usage.will_exceed_at_current_rate && usage.status !== 'exceeded' && (
            <div className="flex items-center gap-1.5 text-orange-600 text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>A este ritmo, excederás el límite</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}