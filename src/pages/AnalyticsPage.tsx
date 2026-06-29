import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, Building2, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CompanyData {
  date: string;
  count: number;
  cumulative: number;
}

interface ReportData {
  date: string;
  count: number;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [companiesData, setCompaniesData] = useState<CompanyData[]>([]);
  const [reportsData, setReportsData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      navigate('/gallery');
    }
  }, [user, navigate]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { data: companies } = await supabase
        .from('companies')
        .select('created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at');

      const { data: reports } = await supabase
        .from('reports')
        .select('created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at');

      const companiesByDate = new Map<string, number>();
      companies?.forEach(company => {
        const date = new Date(company.created_at).toISOString().split('T')[0];
        companiesByDate.set(date, (companiesByDate.get(date) || 0) + 1);
      });

      const reportsByDate = new Map<string, number>();
      reports?.forEach(report => {
        const date = new Date(report.created_at).toISOString().split('T')[0];
        reportsByDate.set(date, (reportsByDate.get(date) || 0) + 1);
      });

      const allDates = new Set([...companiesByDate.keys(), ...reportsByDate.keys()]);
      const dateArray = Array.from(allDates).sort();

      let cumulativeCount = 0;
      const companiesChartData: CompanyData[] = dateArray.map(date => {
        const count = companiesByDate.get(date) || 0;
        cumulativeCount += count;
        return {
          date,
          count,
          cumulative: cumulativeCount
        };
      });

      const reportsChartData: ReportData[] = dateArray.map(date => ({
        date,
        count: reportsByDate.get(date) || 0
      }));

      setCompaniesData(companiesChartData);
      setReportsData(reportsChartData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadAnalytics();
    }
  }, [startDate, endDate, user]);

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  const totalCompanies = companiesData.reduce((sum, item) => sum + item.count, 0);
  const totalReports = reportsData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-600 rounded-xl">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
            <p className="text-slate-600">Visualiza el crecimiento del sistema</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <Calendar className="w-5 h-5 text-slate-600" />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Empresas Registradas</h3>
            </div>
            <p className="text-4xl font-bold">{totalCompanies}</p>
            <p className="text-blue-200 text-sm mt-2">En el periodo seleccionado</p>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Reportes Creados</h3>
            </div>
            <p className="text-4xl font-bold">{totalReports}</p>
            <p className="text-green-200 text-sm mt-2">En el periodo seleccionado</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-600 mt-4">Cargando datos...</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-slate-900">Empresas Registradas</h2>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={companiesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Registradas por día"
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="Total acumulado"
                    dot={{ fill: '#8b5cf6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-green-600" />
                <h2 className="text-xl font-semibold text-slate-900">Reportes Creados</h2>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={reportsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="count"
                    fill="#10b981"
                    name="Reportes por día"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
