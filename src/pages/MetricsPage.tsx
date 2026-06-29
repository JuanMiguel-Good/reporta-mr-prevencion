import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import { useMetrics } from '../hooks/useMetrics';
import { exportMetricsToExcel } from '../utils/excelHelper';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../contexts/AuthContext';

const COLORS = {
  reported: '#6b7280',
  assigned: '#3b82f6',
  in_review: '#f59e0b',
  evidence_rejected: '#ef4444',
  closed: '#10b981',
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
  unsafe_act: '#8b5cf6',
  unsafe_condition: '#ec4899'
};

const STATUS_LABELS: Record<string, string> = {
  reported: 'Reportado',
  assigned: 'Pendiente Evidencia',
  in_review: 'En Revisión',
  evidence_rejected: 'Reenviar Evidencia',
  closed: 'Cerrado'
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica'
};

const TYPE_LABELS: Record<string, string> = {
  unsafe_act: 'Actos Inseguros',
  unsafe_condition: 'Condiciones Inseguras'
};

export default function MetricsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());

  const { data, loading, error } = useMetrics(startDate, endDate, user?.company_id || '');

  const handlePeriodChange = (newPeriod: typeof period) => {
    setPeriod(newPeriod);
    const end = new Date();
    const start = new Date();

    switch (newPeriod) {
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 1);
        break;
    }

    setStartDate(start);
    setEndDate(end);
  };

  const handleExport = () => {
    if (!data) return;
    exportMetricsToExcel(data, startDate, endDate);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Métricas y Análisis</h1>
          <p className="text-gray-600 mt-1">Panel de control de seguridad</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2">
            {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : p === 'quarter' ? 'Trimestre' : 'Año'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            data-onboarding="excel-button"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={startDate.toISOString().split('T')[0]}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={endDate.toISOString().split('T')[0]}
              onChange={(e) => setEndDate(new Date(e.target.value))}
              className="px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Total Reportes</p>
              <p className="text-4xl font-bold">{data.totalReports}</p>
              <div className="flex items-center gap-1 mt-2">
                {data.previousPeriodComparison > 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {Math.abs(data.previousPeriodComparison).toFixed(1)}% vs periodo anterior
                </span>
              </div>
            </div>
            <BarChart3 className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium mb-1">Tasa de Resolución</p>
              <p className="text-4xl font-bold">
                {data.totalReports > 0 ? ((data.resolvedReports / data.totalReports) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-sm mt-2">{data.resolvedReports} de {data.totalReports} cerrados</p>
            </div>
            <CheckCircle className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium mb-1">Pendientes</p>
              <p className="text-4xl font-bold">{data.pendingReports}</p>
              <p className="text-sm mt-2">Requieren atención</p>
            </div>
            <AlertTriangle className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium mb-1">Tiempo Promedio</p>
              <p className="text-4xl font-bold">{data.averageResolutionDays.toFixed(1)}</p>
              <p className="text-sm mt-2">días para resolver</p>
            </div>
            <Clock className="w-12 h-12 opacity-80" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Tendencia de Reportes</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.timeline}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name="Total" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Distribución por Estado</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.reportsByStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${STATUS_LABELS[entry.status] || entry.status} (${entry.percentage.toFixed(1)}%)`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {data.reportsByStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.status as keyof typeof COLORS] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any, name: any, props: any) => [value, STATUS_LABELS[props.payload.status] || props.payload.status]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {data.reportsByStatus.map((item) => (
              <div key={item.status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[item.status as keyof typeof COLORS] || '#6b7280' }}
                  />
                  <span className="text-sm font-medium">{STATUS_LABELS[item.status] || item.status}</span>
                </div>
                <span className="text-lg font-bold">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Distribución por Nivel de Riesgo</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.reportsByPriority}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="priority" tickFormatter={(value) => PRIORITY_LABELS[value]} />
              <YAxis />
              <Tooltip labelFormatter={(value) => PRIORITY_LABELS[value as string]} />
              <Bar dataKey="count" fill="#8884d8" radius={[8, 8, 0, 0]}>
                {data.reportsByPriority.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.priority as keyof typeof COLORS]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Por Tipo de Incidente</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.reportsByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" tickFormatter={(value) => TYPE_LABELS[value]} />
              <YAxis />
              <Tooltip labelFormatter={(value) => TYPE_LABELS[value as string]} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {data.reportsByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.type as keyof typeof COLORS]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">Evolución por Tipo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="unsafe_acts"
                stroke={COLORS.unsafe_act}
                strokeWidth={2}
                name="Actos Inseguros"
              />
              <Line
                type="monotone"
                dataKey="unsafe_conditions"
                stroke={COLORS.unsafe_condition}
                strokeWidth={2}
                name="Condiciones Inseguras"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Top 5 Categorías</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.reportsByCategory} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="category" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Top 5 Áreas con Más Incidentes</h2>
          <div className="space-y-3">
            {data.reportsByArea.map((item, index) => (
              <div key={item.area} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{item.area}</span>
                    <span className="text-lg font-bold text-blue-600">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${(item.count / data.reportsByArea[0].count) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Top 5 Reportadores Activos</h2>
          <div className="space-y-3">
            {data.topReporters.map((item, index) => (
              <div key={item.user} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full font-bold">
                  {item.user.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{item.user}</span>
                    <span className="text-lg font-bold text-green-600">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${(item.count / data.topReporters[0].count) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Responsables y Carga de Trabajo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.topResponsibles.map((item, idx) => (
            <div key={`${item.user}-${idx}`} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-full font-bold text-lg">
                  {item.user.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{item.user}</p>
                  <p className="text-sm text-gray-600">{item.count} reportes asignados</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-600">Pendientes</span>
                <span className={`font-bold ${item.pending > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {item.pending}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
