import { useState, useEffect } from 'react';
import { Filter, Search, UserPlus, AlertCircle, Grid2x2 as Grid, List, AlertTriangle, Clock, X, Download, WifiOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Report, ReportStatus, ReportPriority, ReportType, User, Category } from '../types/database';
import { ReportCard } from '../components/gallery/ReportCard';
import { ReportDetailModal } from '../components/gallery/ReportDetailModal';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { getStatusLabel, getStatusColor, getPriorityLabel, getPriorityColor, getTypeLabel, getRoleLabel, getClosureDateStatus, formatDateOnly } from '../utils/format';
import { PendingReportsSection } from '../components/gallery/PendingReportsSection';
import { exportReportsToExcel } from '../utils/excelHelper';
import { offlineStorage, OfflineReport } from '../utils/offlineStorage';

export function GalleryPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [offlineReports, setOfflineReports] = useState<OfflineReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<ReportPriority | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ReportType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [reporterFilter, setReporterFilter] = useState<string>('all');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedReportForAssign, setSelectedReportForAssign] = useState<Report | null>(null);
  const [responsibles, setResponsibles] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [reporters, setReporters] = useState<User[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedResponsible, setSelectedResponsible] = useState<string | null>(null);
  const [proposedClosureDate, setProposedClosureDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ message: '', current: 0, total: 0 });
  const [showExportProgress, setShowExportProgress] = useState(false);

  useEffect(() => {
    if (user) {
      loadReports();
      loadFilterOptions();
      if (user.role === 'sst_manager') {
        loadResponsibles();
      }
    }

    const handleOnline = () => {
      setIsOffline(false);
      if (user) loadReports();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    const handleSynced = () => {
      if (user) loadReports();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('reports-synced', handleSynced);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('reports-synced', handleSynced);
    };
  }, [user]);

  useEffect(() => {
    filterReports();
  }, [reports, searchTerm, statusFilter, priorityFilter, typeFilter, categoryFilter, areaFilter, projectFilter, reporterFilter, dateFromFilter, dateToFilter]);

  const loadResponsibles = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('can_close_reports', true)
      .order('full_name');

    if (data) {
      setResponsibles(data);
    }
  };

  const loadFilterOptions = async () => {
    if (!user) return;

    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (categoriesData) {
      setCategories(categoriesData);
    }

    let reportsQuery = supabase
      .from('reports')
      .select('area, proyecto, reporter:profiles!reports_reporter_id_fkey(id, full_name)');

    if (user.role === 'worker') {
      reportsQuery = reportsQuery.or(`assigned_to_id.eq.${user.id},reporter_id.eq.${user.id}`);
    } else if (user.can_close_reports && user.role !== 'sst_manager' && user.role !== 'hr_observer' && user.role !== 'super_admin') {
      reportsQuery = reportsQuery.or(`assigned_to_id.eq.${user.id},reporter_id.eq.${user.id}`);
    }

    const { data: reportsData } = await reportsQuery;

    if (reportsData) {
      const uniqueAreas = [...new Set(reportsData.map(r => r.area).filter(Boolean))] as string[];
      const uniqueProjects = [...new Set(reportsData.map(r => r.proyecto).filter(Boolean))] as string[];
      const uniqueReporters = Array.from(
        new Map(reportsData.map(r => r.reporter).filter(Boolean).map(u => [u.id, u])).values()
      ) as User[];

      setAreas(uniqueAreas.sort());
      setProjects(uniqueProjects.sort());
      setReporters(uniqueReporters.sort((a, b) => a.full_name.localeCompare(b.full_name)));
    }
  };

  const loadReports = async () => {
    if (!user) return;

    setLoading(true);

    try {
      if (!navigator.onLine) {
        const offline = await offlineStorage.getAllReports();
        setOfflineReports(offline);
        setReports([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('reports')
        .select(`
          *,
          reporter:profiles!reports_reporter_id_fkey(*),
          assigned_to:profiles!reports_assigned_to_fkey(*),
          category:categories(*),
          photos:report_photos(*),
          history:report_history(*)
        `)
        .order('created_at', { ascending: false });

      if (user.role === 'worker') {
        query = query.or(`assigned_to_id.eq.${user.id},reporter_id.eq.${user.id}`);
      } else if (user.can_close_reports && user.role !== 'sst_manager' && user.role !== 'hr_observer' && user.role !== 'super_admin') {
        query = query.or(`assigned_to_id.eq.${user.id},reporter_id.eq.${user.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setReports((data as Report[]) || []);
      setOfflineReports([]);
    } catch (error) {
      console.error('Error loading reports:', error);
      const offline = await offlineStorage.getAllReports();
      setOfflineReports(offline);
    } finally {
      setLoading(false);
    }
  };

  const filterReports = () => {
    let filtered = [...reports];

    if (searchTerm) {
      filtered = filtered.filter((report) =>
        report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.reporter?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((report) => report.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((report) => report.priority === priorityFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((report) => report.type === typeFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((report) => report.category_id === categoryFilter);
    }

    if (areaFilter !== 'all') {
      filtered = filtered.filter((report) => report.area === areaFilter);
    }

    if (projectFilter !== 'all') {
      filtered = filtered.filter((report) => report.proyecto === projectFilter);
    }

    if (reporterFilter !== 'all') {
      filtered = filtered.filter((report) => report.reporter_id === reporterFilter);
    }

    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((report) => {
        const reportDate = new Date(report.created_at);
        reportDate.setHours(0, 0, 0, 0);
        return reportDate >= fromDate;
      });
    }

    if (dateToFilter) {
      const toDate = new Date(dateToFilter);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((report) => {
        const reportDate = new Date(report.created_at);
        return reportDate <= toDate;
      });
    }

    setFilteredReports(filtered);
  };

  const reloadReport = async (reportId: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          reporter:profiles!reports_reporter_id_fkey(*),
          assigned_to:profiles!reports_assigned_to_fkey(*),
          category:categories(*),
          photos:report_photos(*),
          history:report_history(*)
        `)
        .eq('id', reportId)
        .maybeSingle();

      if (error) throw error;
      return data as Report | null;
    } catch (error) {
      console.error('Error reloading report:', error);
      return null;
    }
  };

  const handleAssignResponsible = async () => {
    if (!selectedReportForAssign || !selectedResponsible || !proposedClosureDate) {
      alert('Por favor complete todos los campos');
      return;
    }

    try {
      const dateObj = new Date(proposedClosureDate + 'T12:00:00');
      const isoDate = dateObj.toISOString().split('T')[0];

      const { error } = await supabase
        .from('reports')
        .update({
          assigned_to_id: selectedResponsible,
          proposed_closure_date: isoDate,
          status: 'assigned',
        })
        .eq('id', selectedReportForAssign.id);

      if (error) throw error;

      setShowAssignModal(false);
      setSelectedReportForAssign(null);
      setSelectedResponsible(null);
      setProposedClosureDate('');

      await loadReports();

      if (selectedReport && selectedReport.id === selectedReportForAssign.id) {
        const updatedReport = await reloadReport(selectedReportForAssign.id);
        if (updatedReport) {
          setSelectedReport(updatedReport);
        }
      }
    } catch (error) {
      console.error('Error assigning responsible:', error);
      alert('Error al asignar responsable');
    }
  };

  const canManage = user?.role === 'sst_manager';
  const canExport = user?.role === 'sst_manager' || user?.role === 'hr_observer';

  const handleExportToExcel = async () => {
    if (filteredReports.length === 0) {
      alert('No hay reportes para exportar');
      return;
    }

    const totalImages = filteredReports.reduce((sum, r) => sum + (r.photos?.length || 0), 0);

    if (totalImages > 0) {
      const confirmed = confirm(
        `Se exportarán ${filteredReports.length} reporte${filteredReports.length !== 1 ? 's' : ''} con ${totalImages} imagen${totalImages !== 1 ? 'es' : ''}.\n\n` +
        `Las imágenes se incluirán directamente en el archivo Excel.\n` +
        `Este proceso puede tomar algunos momentos.\n\n` +
        `¿Deseas continuar?`
      );

      if (!confirmed) return;
    }

    setIsExporting(true);
    setShowExportProgress(true);
    setExportProgress({ message: 'Iniciando exportación...', current: 0, total: totalImages });

    try {
      const result = await exportReportsToExcel(
        filteredReports,
        (message, current, total) => {
          setExportProgress({ message, current, total });
        }
      );

      setShowExportProgress(false);

      if (result.failedImages > 0) {
        alert(
          `Exportación completada con advertencias:\n\n` +
          `Reportes: ${result.totalReports}\n` +
          `Imágenes descargadas: ${result.successfulImages}/${result.totalImages}\n` +
          `Imágenes fallidas: ${result.failedImages}\n\n` +
          `El archivo se guardó exitosamente, pero algunas imágenes no se pudieron descargar.\n` +
          `Revisa la consola del navegador para más detalles.`
        );
      } else {
        alert(
          `Exportación exitosa:\n\n` +
          `Reportes: ${result.totalReports}\n` +
          `Imágenes: ${result.successfulImages}/${result.totalImages}\n\n` +
          `Todas las imágenes se descargaron correctamente.`
        );
      }
    } catch (error) {
      console.error('Error exporting reports:', error);
      setShowExportProgress(false);
      alert('Error al exportar los reportes. Por favor, intenta nuevamente.');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return <Loading fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {isOffline && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900 text-sm">Modo Sin Conexión</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  Mostrando reportes guardados localmente. Los reportes se sincronizarán cuando haya conexión.
                </p>
              </div>
            </div>
          </div>
        )}
        <PendingReportsSection />

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar reportes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              {canExport && (
                <button
                  onClick={handleExportToExcel}
                  disabled={isExporting || filteredReports.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Exportar ${filteredReports.length} reporte${filteredReports.length !== 1 ? 's' : ''} a Excel`}
                >
                  <Download className={`w-5 h-5 ${isExporting ? 'animate-bounce' : ''}`} />
                  <span className="hidden sm:inline">
                    {isExporting ? 'Exportando...' : `Exportar (${filteredReports.length})`}
                  </span>
                  <span className="sm:hidden">
                    {isExporting ? '...' : filteredReports.length}
                  </span>
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="relative p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Filter className="w-5 h-5" />
                {(statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all' || categoryFilter !== 'all' || areaFilter !== 'all' || projectFilter !== 'all' || reporterFilter !== 'all' || dateFromFilter || dateToFilter) && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-xs rounded-full flex items-center justify-center">
                    {[statusFilter !== 'all', priorityFilter !== 'all', typeFilter !== 'all', categoryFilter !== 'all', areaFilter !== 'all', projectFilter !== 'all', reporterFilter !== 'all', dateFromFilter, dateToFilter].filter(Boolean).length}
                  </span>
                )}
              </button>
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  title="Vista de galería"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 ${viewMode === 'table' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  title="Vista de tabla"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="pt-4 border-t space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-2 sticky top-0 bg-white z-10 pb-2">
                <h3 className="text-sm font-semibold text-gray-700">Filtros Avanzados</h3>
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setPriorityFilter('all');
                    setTypeFilter('all');
                    setCategoryFilter('all');
                    setAreaFilter('all');
                    setProjectFilter('all');
                    setReporterFilter('all');
                    setDateFromFilter('');
                    setDateToFilter('');
                  }}
                  className="text-xs sm:text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Limpiar filtros</span>
                  <span className="sm:hidden">Limpiar</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Estado
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ReportStatus | 'all')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="all">Todos</option>
                    <option value="reported">Reportado</option>
                    <option value="assigned">Asignado</option>
                    <option value="in_review">En Revisión</option>
                    <option value="evidence_rejected">Evidencia Rechazada</option>
                    <option value="closed">Cerrado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Nivel de Riesgo
                  </label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as ReportPriority | 'all')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="all">Todas</option>
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Tipo
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as ReportType | 'all')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="all">Todos</option>
                    <option value="unsafe_act">Acto Inseguro</option>
                    <option value="unsafe_condition">Condición Insegura</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Categoría
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="all">Todas</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Área
                  </label>
                  <select
                    value={areaFilter}
                    onChange={(e) => setAreaFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="all">Todas</option>
                    {areas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Proyecto
                  </label>
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="all">Todos</option>
                    {projects.map((project) => (
                      <option key={project} value={project}>
                        {project}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Reportado por
                  </label>
                  <select
                    value={reporterFilter}
                    onChange={(e) => setReporterFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="all">Todos</option>
                    {reporters.map((reporter) => (
                      <option key={reporter.id} value={reporter.id}>
                        {reporter.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Fecha desde
                  </label>
                  <input
                    type="date"
                    value={dateFromFilter}
                    onChange={(e) => setDateFromFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Fecha hasta
                  </label>
                  <input
                    type="date"
                    value={dateToFilter}
                    onChange={(e) => setDateToFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {filteredReports.length === 0 && offlineReports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay reportes
            </h3>
            <p className="text-gray-600">
              {user?.role === 'worker'
                ? 'Aún no has creado ningún reporte'
                : 'No se encontraron reportes con los filtros seleccionados'}
            </p>
          </div>
        ) : isOffline && offlineReports.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reportes Guardados Localmente ({offlineReports.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {offlineReports.map((report) => (
                <div
                  key={report.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 text-sm line-clamp-1">
                      {report.title}
                    </h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${report.synced ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {report.synced ? 'Sincronizado' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {report.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{new Date(report.created_at).toLocaleDateString('es')}</span>
                    {report.photos.length > 0 && (
                      <span>{report.photos.length} foto{report.photos.length !== 1 && 's'}</span>
                    )}
                  </div>
                  {report.location && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {report.location}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
            {filteredReports.map((report, index) => (
              <div key={report.id} className="relative" data-onboarding={index === 0 ? 'report-card' : undefined}>
                <ReportCard
                  report={report}
                  onClick={() => setSelectedReport(report)}
                />
                {canManage && report.status === 'reported' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedReportForAssign(report);
                      setShowAssignModal(true);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg z-[1]"
                    title="Asignar responsable"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nivel de Riesgo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoría
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Área
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Proyecto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reportado por
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Prop. Cierre
                    </th>
                    {canManage && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReports.map((report) => (
                    <tr
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(report.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`${getStatusColor(report.status)} text-white text-xs px-2.5 py-1 rounded-full font-medium`}>
                          {getStatusLabel(report.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getTypeLabel(report.type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`${getPriorityColor(report.priority)} text-white text-xs px-2.5 py-1 rounded-full font-medium`}>
                          {getPriorityLabel(report.priority)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.category?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.area || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.proyecto || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.reporter?.full_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                        {report.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {report.proposed_closure_date ? (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">
                              {formatDateOnly(report.proposed_closure_date)}
                            </span>
                            {getClosureDateStatus(report.proposed_closure_date, report.status) === 'overdue' && (
                              <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse" title="Fecha vencida" />
                            )}
                            {getClosureDateStatus(report.proposed_closure_date, report.status) === 'soon' && (
                              <Clock className="w-4 h-4 text-orange-500" title="Vence pronto" />
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      {canManage && report.status === 'reported' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReportForAssign(report);
                              setShowAssignModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Asignar
                          </button>
                        </td>
                      )}
                      {canManage && report.status !== 'reported' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {report.assigned_to?.full_name || '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpdate={async () => {
            await loadReports();
            const updatedReport = await reloadReport(selectedReport.id);
            if (updatedReport) {
              setSelectedReport(updatedReport);
            } else {
              setSelectedReport(null);
            }
          }}
          onAssignClick={
            canManage && selectedReport.status === 'reported'
              ? () => {
                  setSelectedReportForAssign(selectedReport);
                  setShowAssignModal(true);
                }
              : undefined
          }
        />
      )}

      {showAssignModal && selectedReportForAssign && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Asignar Responsable</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Responsable
              </label>
              <select
                value={selectedResponsible || ''}
                onChange={(e) => setSelectedResponsible(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">Seleccione un responsable</option>
                {responsibles.map((responsible) => (
                  <option key={responsible.id} value={responsible.id}>
                    {responsible.full_name} - {getRoleLabel(responsible.role)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Propuesta de Cierre
              </label>
              <input
                type="date"
                value={proposedClosureDate}
                onChange={(e) => setProposedClosureDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedReportForAssign(null);
                  setSelectedResponsible(null);
                  setProposedClosureDate('');
                }}
                variant="secondary"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAssignResponsible}
                className="flex-1"
              >
                Asignar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showExportProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                <h3 className="text-lg font-semibold text-gray-900">Exportando a Excel</h3>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">{exportProgress.message}</p>

                {exportProgress.total > 0 && (
                  <>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-red-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(exportProgress.current / exportProgress.total) * 100}%`
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 text-right">
                      {exportProgress.current} / {exportProgress.total}
                    </p>
                  </>
                )}
              </div>

              <p className="text-xs text-gray-500 text-center">
                Por favor, no cierres esta ventana
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
