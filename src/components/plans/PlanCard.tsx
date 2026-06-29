import { Edit2, Trash2, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import type { Plan } from '../../types/database';

interface PlanCardProps {
  plan: Plan;
  onEdit: (plan: Plan) => void;
  onDelete: (plan: Plan) => void;
  onToggleActive: (plan: Plan) => void;
  onAssign: (plan: Plan) => void;
}

export function PlanCard({ plan, onEdit, onDelete, onToggleActive, onAssign }: PlanCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-2 ${plan.active ? 'border-green-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
          {plan.description && (
            <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
          )}
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          plan.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {plan.active ? 'Activo' : 'Inactivo'}
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Límite mensual:</span>
          <span className="text-lg font-bold text-gray-900">{plan.monthly_limit}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Precio mensual:</span>
          <span className="text-lg font-semibold text-green-600">
            ${plan.monthly_price.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Análisis IA:</span>
          <div className="flex items-center gap-1">
            {plan.ai_enabled ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <span className="text-sm font-medium">
              {plan.ai_enabled ? 'Habilitado' : 'Deshabilitado'}
            </span>
          </div>
        </div>

        {plan.ai_enabled && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Límite IA mensual:</span>
            <span className="text-sm font-medium text-gray-900">
              {plan.ai_monthly_limit}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onEdit(plan)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          <span>Editar</span>
        </button>

        <button
          onClick={() => onAssign(plan)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          <span>Asignar</span>
        </button>

        <button
          onClick={() => onToggleActive(plan)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            plan.active
              ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
          title={plan.active ? 'Desactivar' : 'Activar'}
        >
          {plan.active ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
        </button>

        <button
          onClick={() => onDelete(plan)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          title="Eliminar"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}