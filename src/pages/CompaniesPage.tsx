import { useState, useEffect } from 'react';
import { Plus, Search, Building2, Package, X, Upload, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Company, Plan } from '../types/database';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';

interface CompanyWithPlan extends Company {
  current_plan?: Plan | null;
  total_reports?: number;
  last_report_date?: string | null;
}

export function CompaniesPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<CompanyWithPlan[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyWithPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showAssignPlanModal, setShowAssignPlanModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithPlan | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    razon_social: '',
    ruc: '',
    num_trabajadores: '',
    direccion: '',
    distrito: '',
    provincia: '',
    departamento: '',
    actividad_economica: '',
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [managerFormData, setManagerFormData] = useState({
    email: '',
    dni: '',
    full_name: '',
    password: '',
    area: '',
    proyecto: '',
  });

  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadCompanies();
    }
  }, [user]);

  useEffect(() => {
    if (searchTerm) {
      setFilteredCompanies(
        companies.filter((c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredCompanies(companies);
    }
  }, [companies, searchTerm]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (companiesError) throw companiesError;

      const { data: plansData } = await supabase
        .from('company_plans')
        .select('company_id, plan:plans(*)');

      const planMap = new Map(
        (plansData || []).map((cp: any) => [cp.company_id, cp.plan])
      );

      const companiesWithStats = await Promise.all(
        (companiesData || []).map(async (company) => {
          const { data: reportStats } = await supabase
            .from('reports')
            .select('created_at')
            .eq('company_id', company.id)
            .order('created_at', { ascending: false });

          return {
            ...company,
            current_plan: planMap.get(company.id) || null,
            total_reports: reportStats?.length || 0,
            last_report_date: reportStats && reportStats.length > 0 ? reportStats[0].created_at : null,
          };
        })
      );

      setCompanies(companiesWithStats);
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      let logoUrl = null;

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `company-logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('report-photos')
          .upload(filePath, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('report-photos')
          .getPublicUrl(filePath);

        logoUrl = publicUrl;
      }

      const { error } = await supabase.from('companies').insert({
        name: formData.razon_social,
        razon_social: formData.razon_social,
        ruc: formData.ruc,
        num_trabajadores: formData.num_trabajadores ? parseInt(formData.num_trabajadores) : null,
        direccion: formData.direccion || null,
        distrito: formData.distrito || null,
        provincia: formData.provincia || null,
        departamento: formData.departamento || null,
        actividad_economica: formData.actividad_economica || null,
        logo_url: logoUrl,
        active: true,
      });

      if (error) throw error;

      setFormData({ razon_social: '', ruc: '', num_trabajadores: '', direccion: '', distrito: '', provincia: '', departamento: '', actividad_economica: '' });
      setLogoFile(null);
      setShowCreateModal(false);
      loadCompanies();
    } catch (error: any) {
      alert(`Error al crear empresa: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    setCreating(true);
    try {
      const password = managerFormData.password || managerFormData.dni;

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: managerFormData.email,
        password,
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const { error: profileError } = await supabase.from('users').insert({
          id: authData.user.id,
          email: managerFormData.email,
          dni: managerFormData.dni,
          full_name: managerFormData.full_name,
          role: 'sst_manager',
          company_id: selectedCompany.id,
          active: true,
          area: managerFormData.area || null,
          proyecto: managerFormData.proyecto || null,
        });

        if (profileError) throw profileError;

        setManagerFormData({ email: '', dni: '', full_name: '', password: '', area: '', proyecto: '' });
        setShowManagerModal(false);
        setSelectedCompany(null);
      }
    } catch (error: any) {
      alert(`Error al crear gestor SST: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleCompanyActive = async (companyId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ active: !currentActive })
        .eq('id', companyId);

      if (error) throw error;
      loadCompanies();
    } catch (error) {
      alert('Error al cambiar estado de la empresa');
    }
  };

  const handleOpenEditModal = (company: CompanyWithPlan) => {
    setSelectedCompany(company);
    setFormData({
      razon_social: company.razon_social || company.name,
      ruc: company.ruc || '',
      num_trabajadores: company.num_trabajadores?.toString() || '',
      direccion: company.direccion || '',
      distrito: company.distrito || '',
      provincia: company.provincia || '',
      departamento: company.departamento || '',
      actividad_economica: company.actividad_economica || '',
    });
    setShowEditModal(true);
  };

  const handleEditCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    setCreating(true);
    try {
      let logoUrl = selectedCompany.logo_url;

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `company-logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('report-photos')
          .upload(filePath, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('report-photos')
          .getPublicUrl(filePath);

        logoUrl = publicUrl;
      }

      const { error } = await supabase
        .from('companies')
        .update({
          name: formData.razon_social,
          razon_social: formData.razon_social,
          ruc: formData.ruc,
          num_trabajadores: formData.num_trabajadores ? parseInt(formData.num_trabajadores) : null,
          direccion: formData.direccion || null,
          distrito: formData.distrito || null,
          provincia: formData.provincia || null,
          departamento: formData.departamento || null,
          actividad_economica: formData.actividad_economica || null,
          logo_url: logoUrl,
        })
        .eq('id', selectedCompany.id);

      if (error) throw error;

      setFormData({ razon_social: '', ruc: '', num_trabajadores: '', direccion: '', distrito: '', provincia: '', departamento: '', actividad_economica: '' });
      setLogoFile(null);
      setShowEditModal(false);
      setSelectedCompany(null);
      loadCompanies();
    } catch (error: any) {
      alert(`Error al actualizar empresa: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;

    setCreating(true);
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', selectedCompany.id);

      if (error) throw error;

      setShowDeleteModal(false);
      setSelectedCompany(null);
      loadCompanies();
    } catch (error: any) {
      alert(`Error al eliminar empresa: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getTimeAgo = (dateString: string | null): string => {
    if (!dateString) return 'Nunca';
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 30) return `Hace ${diffDays}d`;
    if (diffMonths < 12) return `Hace ${diffMonths} meses`;
    return `Hace ${diffYears} años`;
  };

  const handleAssignPlan = (company: CompanyWithPlan) => {
    setSelectedCompany(company);
    setShowAssignPlanModal(true);
  };

  const handlePlanAssignSuccess = () => {
    loadCompanies();
  };

  if (user?.role !== 'super_admin') return null;
  if (loading) return <Loading fullScreen />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Empresas</h1>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Crear Empresa
            </Button>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar empresas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div className="grid gap-4">
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-2.5 bg-red-50 rounded-lg flex-shrink-0">
                    <Building2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          company.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {company.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                      <span>Creada: {formatDate(company.created_at)}</span>
                      <span>•</span>
                      <span>{company.total_reports || 0} reportes</span>
                      <span>•</span>
                      <span>Último: {getTimeAgo(company.last_report_date)}</span>
                    </div>

                    {company.current_plan && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-md text-sm">
                        <Package className="w-4 h-4 text-blue-600" />
                        <span className="text-blue-900 font-medium">{company.current_plan.name}</span>
                        <span className="text-blue-700">({company.current_plan.monthly_limit} reportes/mes)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleAssignPlan(company)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    Plan
                  </button>

                  <button
                    onClick={() => {
                      setSelectedCompany(company);
                      setShowManagerModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Gestor
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(company)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </button>

                  <button
                    onClick={() => handleToggleCompanyActive(company.id, company.active)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      company.active ? 'text-gray-700 hover:bg-gray-50' : 'text-green-700 hover:bg-green-50'
                    }`}
                  >
                    {company.active ? 'Desactivar' : 'Activar'}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedCompany(company);
                      setShowDeleteModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>
              </div>
            ))}

            {filteredCompanies.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No se encontraron empresas
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8">
            <h2 className="text-xl font-bold mb-4">Agregar Empresa</h2>

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón Social <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.razon_social}
                  onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Razón social o denominación social"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RUC <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ruc}
                    onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="12345678901"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nº de Trabajadores</label>
                  <input
                    type="number"
                    value={formData.num_trabajadores}
                    onChange={(e) => setFormData({ ...formData, num_trabajadores: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="50"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Av. Principal 123, San Isidro"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Distrito</label>
                  <input
                    type="text"
                    value={formData.distrito}
                    onChange={(e) => setFormData({ ...formData, distrito: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="San Isidro"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provincia</label>
                  <input
                    type="text"
                    value={formData.provincia}
                    onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Lima"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
                  <input
                    type="text"
                    value={formData.departamento}
                    onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Lima"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Actividad Económica</label>
                <textarea
                  value={formData.actividad_economica}
                  onChange={(e) => setFormData({ ...formData, actividad_economica: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Servicios de consultoría empresarial"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Logo de la Empresa</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-red-500 transition-colors">
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) setLogoFile(file); }}
                    className="hidden"
                  />
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <div className="text-sm text-gray-600 mb-1">{logoFile ? logoFile.name : 'Subir logo'}</div>
                    <div className="text-xs text-gray-500">PNG, JPG (recomendado: 500x500)</div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" onClick={() => { setShowCreateModal(false); setLogoFile(null); }} variant="secondary" className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={creating}>
                  Crear
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showManagerModal && selectedCompany && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-2">Agregar Gestor SST</h2>
            <p className="text-sm text-gray-600 mb-4">Para empresa: {selectedCompany.name}</p>

            <form onSubmit={handleCreateManager} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Completo</label>
                <input
                  type="text"
                  value={managerFormData.full_name}
                  onChange={(e) => setManagerFormData({ ...managerFormData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={managerFormData.email}
                  onChange={(e) => setManagerFormData({ ...managerFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">DNI</label>
                <input
                  type="text"
                  value={managerFormData.dni}
                  onChange={(e) => setManagerFormData({ ...managerFormData, dni: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Área</label>
                <input
                  type="text"
                  value={managerFormData.area}
                  onChange={(e) => setManagerFormData({ ...managerFormData, area: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Ej: Producción, Logística, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Proyecto</label>
                <input
                  type="text"
                  value={managerFormData.proyecto}
                  onChange={(e) => setManagerFormData({ ...managerFormData, proyecto: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Ej: Proyecto A, Proyecto B, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña (opcional)</label>
                <input
                  type="password"
                  value={managerFormData.password}
                  onChange={(e) => setManagerFormData({ ...managerFormData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Por defecto será el DNI"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowManagerModal(false);
                    setSelectedCompany(null);
                    setManagerFormData({ email: '', dni: '', full_name: '', password: '', area: '', proyecto: '' });
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={creating}>
                  Crear
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignPlanModal && selectedCompany && (
        <SelectPlanModal
          company={selectedCompany}
          onClose={() => { setShowAssignPlanModal(false); setSelectedCompany(null); }}
          onSuccess={handlePlanAssignSuccess}
        />
      )}

      {showEditModal && selectedCompany && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8">
            <h2 className="text-xl font-bold mb-4">Editar Empresa</h2>

            <form onSubmit={handleEditCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón Social <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.razon_social}
                  onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RUC <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ruc}
                    onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nº de Trabajadores</label>
                  <input
                    type="number"
                    value={formData.num_trabajadores}
                    onChange={(e) => setFormData({ ...formData, num_trabajadores: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="50"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Distrito</label>
                  <input
                    type="text"
                    value={formData.distrito}
                    onChange={(e) => setFormData({ ...formData, distrito: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provincia</label>
                  <input
                    type="text"
                    value={formData.provincia}
                    onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
                  <input
                    type="text"
                    value={formData.departamento}
                    onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Actividad Económica</label>
                <textarea
                  value={formData.actividad_economica}
                  onChange={(e) => setFormData({ ...formData, actividad_economica: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Logo de la Empresa</label>
                {selectedCompany.logo_url && !logoFile && (
                  <div className="mb-3">
                    <img src={selectedCompany.logo_url} alt="Logo actual" className="h-20 w-auto object-contain border rounded-lg p-2" />
                    <p className="text-xs text-gray-500 mt-1">Logo actual</p>
                  </div>
                )}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-red-500 transition-colors">
                  <input
                    type="file"
                    id="logo-upload-edit"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) setLogoFile(file); }}
                    className="hidden"
                  />
                  <label htmlFor="logo-upload-edit" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <div className="text-sm text-gray-600 mb-1">{logoFile ? logoFile.name : 'Cambiar logo'}</div>
                    <div className="text-xs text-gray-500">PNG, JPG (recomendado: 500x500)</div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedCompany(null);
                    setLogoFile(null);
                    setFormData({ razon_social: '', ruc: '', num_trabajadores: '', direccion: '', distrito: '', provincia: '', departamento: '', actividad_economica: '' });
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={creating}>
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && selectedCompany && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Eliminar Empresa</h2>
            </div>

            <p className="text-gray-600 mb-4">
              ¿Estás seguro de que deseas eliminar la empresa{' '}
              <span className="font-semibold text-gray-900">{selectedCompany.name}</span>?
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-red-800 font-medium">Esta acción es permanente y no se puede deshacer.</p>
              <p className="text-xs text-red-700 mt-1">Se eliminarán todos los datos asociados: usuarios, reportes, categorías, etc.</p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => { setShowDeleteModal(false); setSelectedCompany(null); }}
                variant="secondary"
                className="flex-1"
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button onClick={handleDeleteCompany} variant="primary" className="flex-1 bg-red-600 hover:bg-red-700" loading={creating}>
                Sí, Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SelectPlanModalProps {
  company: CompanyWithPlan;
  onClose: () => void;
  onSuccess: () => void;
}

function SelectPlanModal({ company, onClose, onSuccess }: SelectPlanModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('active', true)
        .order('monthly_price', { ascending: true });

      if (error) throw error;

      setPlans(data || []);
      if (company.current_plan) {
        const currentPlan = data?.find(p => p.id === company.current_plan?.id);
        setSelectedPlan(currentPlan || (data?.[0] || null));
      } else {
        setSelectedPlan(data?.[0] || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar planes');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedPlan) return;
    setAssigning(true);
    setError(null);

    try {
      const { error: assignError } = await supabase
        .from('company_plans')
        .upsert({ company_id: company.id, plan_id: selectedPlan.id }, { onConflict: 'company_id' });

      if (assignError) throw assignError;

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar plan');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {company.current_plan ? 'Cambiar Plan' : 'Asignar Plan'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Empresa: <span className="font-medium">{company.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Cargando planes...</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay planes activos disponibles</div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => {
                const isSelected = selectedPlan?.id === plan.id;
                const isCurrent = company.current_plan?.id === plan.id;

                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                          {isCurrent && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Actual</span>
                          )}
                        </div>
                        {plan.description && <p className="text-sm text-gray-600 mb-3">{plan.description}</p>}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600">Reportes/mes:</span>
                            <span className="ml-2 font-medium text-gray-900">{plan.monthly_limit}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Precio/mes:</span>
                            <span className="ml-2 font-medium text-green-600">${plan.monthly_price}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 pb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>
          </div>
        )}

        <div className="p-6 border-t bg-gray-50">
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={assigning} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleAssign} disabled={assigning || !selectedPlan || loading} className="flex-1">
              {assigning ? 'Asignando...' : company.current_plan ? 'Cambiar Plan' : 'Asignar Plan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
