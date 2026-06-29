import { useState } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AIUsageDetails } from '../../types/database';
import { Button } from '../common/Button';

interface RequestLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsage: AIUsageDetails;
  companyId: string;
}

export function RequestLimitModal({ isOpen, onClose, currentUsage, companyId }: RequestLimitModalProps) {
  const [requestedLimit, setRequestedLimit] = useState(currentUsage.limit * 2);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('No hay usuario autenticado');
      }

      const { error: rpcError } = await supabase.rpc('request_limit_increase', {
        company_uuid: companyId,
        requester_id: userData.user.id,
        new_limit: requestedLimit,
        request_reason: reason,
      });

      if (rpcError) throw rpcError;

      onClose();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  const suggestedLimits = [
    currentUsage.limit * 1.5,
    currentUsage.limit * 2,
    currentUsage.limit * 3,
  ];

  return (
    <div className="fixed inset-0 z-[202] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Solicitar aumento de límite
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Límite actual:</span>
              <span className="font-medium">{currentUsage.limit} análisis/mes</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Uso actual:</span>
              <span className="font-medium">{currentUsage.current_usage} ({(currentUsage.percentage ?? 0).toFixed(0)}%)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Días restantes:</span>
              <span className="font-medium">{currentUsage.days_left_in_month} días</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nuevo límite solicitado
            </label>
            <input
              type="number"
              min={currentUsage.limit + 1}
              step="10"
              value={requestedLimit}
              onChange={(e) => setRequestedLimit(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestedLimits.map((limit) => (
                <button
                  key={limit}
                  type="button"
                  onClick={() => setRequestedLimit(Math.round(limit))}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
                >
                  {Math.round(limit)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo de la solicitud
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Explica por qué necesitas más análisis de IA..."
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">Nota:</p>
            <p>
              Tu solicitud será revisada por un administrador. Recibirás una notificación cuando sea aprobada o rechazada.
            </p>
          </div>

          <div className="flex gap-3">
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
              {isSubmitting ? 'Enviando...' : 'Enviar solicitud'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}