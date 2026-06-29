import { useState, useEffect } from 'react';
import { Clock, Trash2, AlertCircle } from 'lucide-react';
import { offlineStorage, OfflineReport } from '../../utils/offlineStorage';

export function PendingReportsSection() {
  const [pendingReports, setPendingReports] = useState<OfflineReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingReports();

    const handleOnline = () => {
      setTimeout(loadPendingReports, 2000);
    };

    window.addEventListener('network-online', handleOnline);

    const interval = setInterval(loadPendingReports, 15000);

    return () => {
      window.removeEventListener('network-online', handleOnline);
      clearInterval(interval);
    };
  }, []);

  const loadPendingReports = async () => {
    try {
      const reports = await offlineStorage.getPendingReports();
      setPendingReports(reports);
    } catch (error) {
      console.error('Error loading pending reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('¿Eliminar este reporte pendiente?')) return;

    try {
      await offlineStorage.deleteReport(reportId);
      await loadPendingReports();
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Error al eliminar el reporte');
    }
  };

  if (loading) return null;
  if (pendingReports.length === 0) return null;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4">
      <div className="flex items-start gap-3 mb-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">
            Reportes Pendientes de Sincronizar
          </h3>
          <p className="text-sm text-amber-700 mt-1">
            {pendingReports.length} {pendingReports.length === 1 ? 'reporte' : 'reportes'} {' '}
            esperando conexión para enviarse
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {pendingReports.map((report) => (
          <div
            key={report.id}
            className="bg-white rounded-lg p-3 shadow-sm border border-amber-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {report.title}
                  </p>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2 mb-1">
                  {report.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{new Date(report.created_at).toLocaleString('es')}</span>
                  {report.photos.length > 0 && (
                    <span>{report.photos.length} foto{report.photos.length !== 1 && 's'}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(report.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                title="Eliminar reporte"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
