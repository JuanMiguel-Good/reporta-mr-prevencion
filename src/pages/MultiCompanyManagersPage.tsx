import { useState, useEffect } from 'react';
import { Plus, Building2, UserCog, Trash2, Edit2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';

interface MultiCompanyManager {
  id: string;
  dni: string;
  primary_email: string;
  full_name: string;
  created_at: string;
  company_count?: number;
  companies?: Array<{
    user_id: string;
    company_id: string;
    company_name: string;
    company_logo: string | null;
  }>;
}

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
}

export function MultiCompanyManagersPage() {
  const { user } = useAuth();
  const [managers, setManagers] = useState<MultiCompanyManager[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState<MultiCompanyManager | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [formData, setFormData] = useState({
    dni: '',
    full_name: '',
    email: '',
    password: '',
    company_ids: [] as string[],
  });

  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
  });

  const [addCompanyData, setAddCompanyData] = useState({
    company_id: '',
  });

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadManagers();
      loadCompanies();
    }
  }, [user]);

  const loadManagers = async () => {
    setLoading(true);
    try {
      const { data: managersData, error: managersError } = await supabase
        .from('multi_company_managers')
        .select('*')
        .order('created_at', { ascending: false });

      if (managersError) throw managersError;

      const managersWithCompanies = await Promise.all(
        (managersData || []).map(async (manager) => {
          const { data: companiesData } = await supabase.rpc(
            'get_companies_for_dni',
            { user_dni: manager.dni }
          );

          return {
            ...manager,
            company_count: companiesData?.length || 0,
            companies: companiesData || [],
          };
        })
      );

      setManagers(managersWithCompanies);
    } catch (error) {
      console.error('Error loading managers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.company_ids.length === 0) {
      alert('Debes seleccionar al menos una empresa');
      return;
    }

    setCreating(true);
    try {
      const { data: existingManager } = await supabase
        .from('multi_company_managers')
        .select('dni')
        .eq('dni', formData.dni)
        .maybeSingle();

      if (existingManager) {
        throw new Error('Ya existe un gestor multiempresa con este DNI');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const { error: managerError } = await supabase
        .from('multi_company_managers')
        .insert({
          dni: formData.dni,
          primary_email: formData.email,
          full_name: formData.full_name,
        });

      if (managerError) throw managerError;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;

      const createdUsers = [];
      for (const companyId of formData.company_ids) {
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              email: formData.email,
              dni: formData.dni,
              full_name: formData.full_name,
              role: 'sst_manager',
              company_id: companyId,
              area: null,
              proyecto: null,
              can_close_reports: false,
              password: formData.password || formData.dni,
              is_multi_company_manager: true,
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            console.error('Error response:', result);
            throw new Error(result.error || `Error al crear usuario en empresa ${companyId}`);
          }

          createdUsers.push(companyId);
        } catch (error: any) {
          console.error(`Error creating user for company ${companyId}:`, error);
          throw error;
        }
      }

      console.log('Users created successfully for companies:', createdUsers);

      setFormData({
        dni: '',
        full_name: '',
        email: '',
        password: '',
        company_ids: [],
      });
      setShowCreateModal(false);
      loadManagers();
      alert('Gestor multiempresa creado exitosamente');
    } catch (error: any) {
      console.error('Error creating multi-company manager:', error);
      alert(`Error al crear gestor multiempresa: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManager) return;

    setUpdating(true);
    try {
      const alreadyExists = selectedManager.companies?.some(
        (c) => c.company_id === addCompanyData.company_id
      );

      if (alreadyExists) {
        throw new Error('Este gestor ya tiene acceso a esta empresa');
      }

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: selectedManager.primary_email,
          dni: selectedManager.dni,
          full_name: selectedManager.full_name,
          role: 'sst_manager',
          company_id: addCompanyData.company_id,
          area: null,
          proyecto: null,
          can_close_reports: false,
          password: selectedManager.dni,
          is_multi_company_manager: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al agregar empresa');
      }

      setAddCompanyData({ company_id: '' });
      setShowAddCompanyModal(false);
      setSelectedManager(null);
      loadManagers();
      alert('Empresa agregada exitosamente');
    } catch (error: any) {
      console.error('Error adding company:', error);
      alert(`Error al agregar empresa: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveCompany = async (manager: MultiCompanyManager, companyId: string, userId: string) => {
    if (manager.company_count! <= 1) {
      alert('No puedes eliminar la última empresa. Elimina el gestor completo si deseas hacerlo.');
      return;
    }

    if (!confirm('¿Estás seguro de eliminar el acceso a esta empresa?')) {
      return;
    }

    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);

      if (error) throw error;

      loadManagers();
      alert('Empresa eliminada exitosamente');
    } catch (error: any) {
      console.error('Error removing company:', error);
      alert(`Error al eliminar empresa: ${error.message}`);
    }
  };

  const handleEditManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManager) return;

    setUpdating(true);
    try {
      const { error } = await supabase.rpc('sync_multi_company_manager_data', {
        manager_dni: selectedManager.dni,
        new_full_name: editFormData.full_name,
        new_email: editFormData.email,
      });

      if (error) throw error;

      setEditFormData({ full_name: '', email: '' });
      setShowEditModal(false);
      setSelectedManager(null);
      loadManagers();
      alert('Gestor actualizado exitosamente en todas sus empresas');
    } catch (error: any) {
      console.error('Error updating manager:', error);
      alert(`Error al actualizar gestor: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteManager = async (manager: MultiCompanyManager) => {
    if (!confirm(`¿Estás seguro de eliminar al gestor ${manager.full_name}? Esto eliminará su acceso a todas las empresas.`)) {
      return;
    }

    try {
      const { error: usersError } = await supabase
        .from('users')
        .delete()
        .eq('dni', manager.dni)
        .eq('is_multi_company_manager', true);

      if (usersError) throw usersError;

      const { error: managerError } = await supabase
        .from('multi_company_managers')
        .delete()
        .eq('id', manager.id);

      if (managerError) throw managerError;

      loadManagers();
      alert('Gestor eliminado exitosamente');
    } catch (error: any) {
      console.error('Error deleting manager:', error);
      alert(`Error al eliminar gestor: ${error.message}`);
    }
  };

  const openEditModal = (manager: MultiCompanyManager) => {
    setSelectedManager(manager);
    setEditFormData({
      full_name: manager.full_name,
      email: manager.primary_email,
    });
    setShowEditModal(true);
  };

  const openAddCompanyModal = (manager: MultiCompanyManager) => {
    setSelectedManager(manager);
    setAddCompanyData({ company_id: '' });
    setShowAddCompanyModal(true);
  };

  if (user?.role !== 'super_admin') {
    return null;
  }

  if (loading) {
    return <Loading fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestores SST Multiempresa</h1>
              <p className="text-sm text-gray-600 mt-1">
                Gestores que pueden acceder a múltiples empresas con el mismo DNI
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Crear Gestor Multiempresa
            </Button>
          </div>

          <div className="grid gap-4">
            {managers.map((manager) => (
              <div
                key={manager.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                      <UserCog className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {manager.full_name}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1 mt-1">
                        <p>DNI: {manager.dni}</p>
                        <p>Email: {manager.primary_email}</p>
                        <p className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          {manager.company_count} {manager.company_count === 1 ? 'empresa' : 'empresas'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(manager)}
                      className="p-2 rounded-lg transition-colors hover:bg-blue-50 text-blue-600"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteManager(manager)}
                      className="p-2 rounded-lg transition-colors hover:bg-red-50 text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {manager.companies && manager.companies.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Empresas con acceso:</p>
                    <div className="grid gap-2">
                      {manager.companies.map((company) => (
                        <div
                          key={company.company_id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {company.company_logo && (
                              <img
                                src={company.company_logo}
                                alt={company.company_name}
                                className="w-8 h-8 object-contain rounded"
                              />
                            )}
                            <span className="text-sm font-medium text-gray-900">
                              {company.company_name}
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              handleRemoveCompany(manager, company.company_id, company.user_id)
                            }
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-50 text-red-600"
                            title="Eliminar acceso"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={() => openAddCompanyModal(manager)}
                      variant="secondary"
                      size="sm"
                      className="mt-2 w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Empresa
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {managers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No hay gestores multiempresa creados
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Crear Gestor SST Multiempresa</h2>

            <form onSubmit={handleCreateManager} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  DNI <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.dni}
                  onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este email será compartido en todas las empresas
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña (opcional)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Por defecto será el DNI"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Empresas <span className="text-red-500">*</span>
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-2">
                  {companies.map((company) => (
                    <label
                      key={company.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.company_ids.includes(company.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              company_ids: [...formData.company_ids, company.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              company_ids: formData.company_ids.filter((id) => id !== company.id),
                            });
                          }
                        }}
                        className="w-4 h-4 text-red-600"
                      />
                      <span className="text-sm text-gray-900">{company.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selecciona al menos una empresa
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      dni: '',
                      full_name: '',
                      email: '',
                      password: '',
                      company_ids: [],
                    });
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

      {showAddCompanyModal && selectedManager && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-2">Agregar Empresa</h2>
            <p className="text-sm text-gray-600 mb-4">
              Gestor: <span className="font-semibold">{selectedManager.full_name}</span>
            </p>

            <form onSubmit={handleAddCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Empresa <span className="text-red-500">*</span>
                </label>
                <select
                  value={addCompanyData.company_id}
                  onChange={(e) => setAddCompanyData({ company_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecciona una empresa</option>
                  {companies
                    .filter(
                      (company) =>
                        !selectedManager.companies?.some((c) => c.company_id === company.id)
                    )
                    .map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddCompanyModal(false);
                    setSelectedManager(null);
                    setAddCompanyData({ company_id: '' });
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={updating}>
                  Agregar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedManager && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-2">Editar Gestor Multiempresa</h2>
            <p className="text-sm text-gray-600 mb-4">
              DNI: <span className="font-semibold">{selectedManager.dni}</span>
            </p>

            <form onSubmit={handleEditManager} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  Estos cambios se aplicarán en todas las empresas donde este gestor tiene acceso
                  ({selectedManager.company_count} empresas).
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedManager(null);
                    setEditFormData({ full_name: '', email: '' });
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={updating}>
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
