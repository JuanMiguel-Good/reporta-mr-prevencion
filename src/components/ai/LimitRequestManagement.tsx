import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../common/Button';
import type { UsageLimitRequest } from '../../types/database';

interface LimitRequestWithDetails extends UsageLimitRequest {
  company_name?: string;
  requester_name?: string;
}

export function LimitRequestManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LimitRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadRequests();
    }
  }, [user?.role]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usage_limit_requests')
        .select(`
          *,
          company:companies(name),
          requester:profiles!requested_by(full_name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const requestsWithDetails = (data || []).map((req: any) => ({
        ...req,
        company_name: req.company?.name || 'Desconocida',
        requester_name: req.requester?.full_name || 'Desconocido',
      }));

      setRequests(requestsWithDetails);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string, temporaryDays?: number) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.rpc('approve_limit_request', {
        request_uuid: requestId,
        reviewer_id: user.id,
        is_approved: true,
        review_note: reviewNotes || null,
        temporary_duration_days: temporaryDays || null,
      });

      if (error) throw error;

      await loadRequests();
      setReviewingId(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Error al aprobar la solicitud');
    }
  };

  const handleReject = async (requestId: string) => {
    if (!user?.id) return;

    if (!reviewNotes.trim()) {
      alert('Debes proporcionar una razón para rechazar la solicitud');
      return;
    }

    try {
      const { error } = await supabase.rpc('approve_limit_request', {
        request_uuid: requestId,
        reviewer_id: user.id,
        is_approved: false,
        review_note: reviewNotes,
        temporary_duration_days: null,
      });

      if (error) throw error;

      await loadRequests();
      setReviewingId(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Error al rechazar la solicitud');
    }
  };

  if (user?.role !== 'super_admin') {
    return null;
  }

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

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No hay solicitudes pendientes
          </h3>
          <p className="text-gray-600">
            Todas las solicitudes de aumento de límite han sido revisadas
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-900">
          Solicitudes de Aumento de Límite
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {requests.length} solicitud{requests.length !== 1 ? 'es' : ''} pendiente{requests.length !== 1 ? 's' : ''} de revisión
        </p>
      </div>

      <div className="divide-y">
        {requests.map((request) => (
          <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">{request.company_name}</h3>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pendiente
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  Solicitado por: <span className="font-medium">{request.requester_name}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(request.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-xs text-gray-600 mb-1">Límite Actual</div>
                <div className="text-lg font-bold text-gray-900">{request.current_limit}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Límite Solicitado</div>
                <div className="text-lg font-bold text-blue-600">{request.requested_limit}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-gray-600 mb-1">Aumento</div>
                <div className="text-sm font-semibold text-green-600">
                  +{request.requested_limit - request.current_limit} análisis/mes
                  {request.current_limit > 0 && ` (${((request.requested_limit / request.current_limit - 1) * 100).toFixed(0)}%)`}
                </div>
              </div>
            </div>

            {request.reason && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-1">Motivo</div>
                <p className="text-sm text-blue-800">{request.reason}</p>
              </div>
            )}

            {reviewingId === request.id ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas de Revisión
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Agrega comentarios sobre tu decisión..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(request.id)}
                    variant="primary"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Aprobar
                  </Button>
                  <Button
                    onClick={() => handleApprove(request.id, 30)}
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Clock className="w-4 h-4" />
                    Aprobar por 30 días
                  </Button>
                  <Button
                    onClick={() => handleReject(request.id)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Rechazar
                  </Button>
                  <Button
                    onClick={() => {
                      setReviewingId(null);
                      setReviewNotes('');
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={() => setReviewingId(request.id)}
                  variant="primary"
                  size="sm"
                >
                  Revisar Solicitud
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}