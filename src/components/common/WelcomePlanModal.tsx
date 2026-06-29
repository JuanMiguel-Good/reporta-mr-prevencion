import { Check, X, Sparkles } from 'lucide-react';
import { Button } from './Button';

interface Plan {
  id: string;
  name: string;
  description: string;
  monthly_limit: number;
  monthly_price: number;
  ai_enabled: boolean;
  ai_monthly_limit: number;
}

interface WelcomePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: Plan[];
  assignedPlanName: string;
}

export function WelcomePlanModal({ isOpen, onClose, plans, assignedPlanName }: WelcomePlanModalProps) {
  if (!isOpen) return null;

  const sortedPlans = [...plans].sort((a, b) => a.monthly_price - b.monthly_price);

  const formatPrice = (price: number) => {
    const priceStr = price.toFixed(2);
    const parts = priceStr.split('.');
    return {
      integer: parts[0],
      decimal: parts[1] || '00'
    };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full mb-4">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Bienvenido a Reporta
            </h2>
            <p className="text-lg text-gray-600">
              Tu cuenta ha sido creada exitosamente
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              Planes Disponibles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sortedPlans.map((plan) => {
                const isAssigned = plan.name === assignedPlanName;
                const priceFormatted = formatPrice(plan.monthly_price);

                return (
                  <div
                    key={plan.id}
                    className={`rounded-xl p-6 border-2 transition-all ${
                      isAssigned
                        ? 'border-green-500 bg-green-50 shadow-lg scale-105'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {isAssigned && (
                      <div className="flex justify-center mb-3">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
                          <Check className="w-3 h-3" />
                          Tu Plan Actual
                        </span>
                      </div>
                    )}

                    <div className="text-center mb-4">
                      <h4 className="text-xl font-bold text-gray-900 mb-2">
                        {plan.name}
                      </h4>
                      <div className="mb-2 flex items-baseline justify-center">
                        <span className="text-3xl font-bold text-gray-900">
                          ${priceFormatted.integer}
                        </span>
                        <span className="text-lg text-gray-600">
                          .{priceFormatted.decimal}
                        </span>
                        <span className="text-gray-600 text-sm ml-1">/mes</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {plan.description}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">
                          <strong>{plan.monthly_limit}</strong> reportes por mes
                        </span>
                      </div>
                      {plan.ai_enabled && (
                        <div className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">
                            <strong>{plan.ai_monthly_limit}</strong> análisis de IA
                          </span>
                        </div>
                      )}
                      {!plan.ai_enabled && (
                        <div className="flex items-start gap-2">
                          <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-500">
                            Sin análisis de IA
                          </span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">
                          Exportación de datos
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={onClose}
              variant="primary"
              size="lg"
              className="min-w-[200px]"
            >
              Empezar a usar Reporta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
