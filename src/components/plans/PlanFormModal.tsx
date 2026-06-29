import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../common/Button';
import type { Plan } from '../../types/database';

interface PlanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plan?: Plan | null;
}

export function PlanFormModal({ isOpen, onClose, onSuccess, plan }: PlanFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState(100);
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiMonthlyLimit, setAiMonthlyLimit] = useState(50);
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDescription(plan.description || '');
      setMonthlyLimit(plan.monthly_limit);
      setMonthlyPrice(plan.monthly_price);
      setAiEnabled(plan.ai_enabled);
      setAiMonthlyLimit(plan.ai_monthly_limit);
      setActive(plan.active);
    } else {
      resetForm();
    }
  }, [plan, isOpen]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setMonthlyLimit(100);
    setMonthlyPrice(0);
    setAiEnabled(false);
    setAiMonthlyLimit(50);
    setActive(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const planData = {
        name,
        description: description || null,
        monthly_limit: monthlyLimit,
        monthly_price: monthlyPrice,
        ai_enabled: aiEnabled,
        ai_monthly_limit: aiMonthlyLimit,
        active,
      };

      if (plan) {
        const { error: updateError } = await supabase
          .from('plans')
          .update(planData)
          .eq('id', plan.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('plans')
          .insert([planData]);

        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {plan ? 'Editar Plan' : 'Crear Nuevo Plan'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Plan *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe las características del plan..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Límite Mensual de Reportes *
              </label>
              <input
                type="number"
                min="1"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precio Mensual (USD) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Habilitar Análisis con IA
                </span>
              </label>
            </div>

            {aiEnabled && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Límite Mensual de Análisis IA *
                </label>
                <input
                  type="number"
                  min="1"
                  value={aiMonthlyLimit}
                  onChange={(e) => setAiMonthlyLimit(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Número máximo de análisis de IA que pueden realizarse al mes
                </p>
              </div>
            )}

            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Plan Activo
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-7">
                Solo los planes activos pueden ser asignados a empresas
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Guardando...' : plan ? 'Actualizar Plan' : 'Crear Plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}