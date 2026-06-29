import { useState, useEffect, useRef } from 'react';
import { Plus, UserX, UserCheck, Search, Download, Upload, AlertCircle, CheckCircle2, Edit2, Trash2, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types/database';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { ResetPasswordModal } from '../components/users/ResetPasswordModal';
import { downloadTemplate, parseExcelFile, validateUserRow, UserRow } from '../utils/excelHelper';

interface Company {
  id: string;
  name: string;
}

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableProyectos, setAvailableProyectos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkUsers, setBulkUsers] = useState<UserRow[]>([]);
  const [bulkUploadErrors, setBulkUploadErrors] = useState<string[]>([]);
  const [bulkUploadProgress, setBulkUploadProgress] = useState({ current: 0, total: 0 });
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkCompanyId, setBulkCompanyId] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    email: '',
    dni: '',
    full_name: '',
    role: 'worker' as UserRole,
    password: '',
    area: '',
    proyecto: '',
    company_id: '',
    can_close_reports: false,
  });

  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      loadUsers();
      loadAreasAndProyectos();
      if (user.role === 'super_admin') {
        loadCompanies();
      }
    }
  }, [user]);

  useEffect(() => {
    loadAreasAndProyectos();
  }, [formData.company_id]);

  useEffect(() => {
    if (searchTerm) {
      setFilteredUsers(
        users.filter(
          (u) =>
            u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            u.dni.includes(searchTerm)
        )
      );
    } else {
      setFilteredUsers(users);
    }
  }, [users, searchTerm]);

  const loadUsers = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('users')
        .select(`
          *,
          company:companies(name)
        `)
        .order('created_at', { ascending: false });

      if (user.role === 'sst_manager') {
        query = query.eq('company_id', user.company_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      setCompanies(data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const loadAreasAndProyectos = async () => {
    if (!user) return;

    const companyId = user.role === 'super_admin' && formData.company_id
      ? formData.company_id
      : user.company_id;

    if (!companyId) return;

    try {
      const { data: areasData } = await supabase
        .from('areas')
        .select('name')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('name');

      const { data: proyectosData } = await supabase
        .from('proyectos')
        .select('name')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('name');

      if (areasData) {
        setAvailableAreas(areasData.map(a => a.name));
      }

      if (proyectosData) {
        setAvailableProyectos(proyectosData.map(p => p.name));
      }
    } catch (error) {
      console.error('Error loading areas and proyectos:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const targetCompanyId = user.role === 'super_admin' ? formData.company_id : user.company_id;

    if (!targetCompanyId) {
      alert('Debes seleccionar una empresa');
      return;
    }

    setCreating(true);
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('dni')
        .eq('dni', formData.dni)
        .maybeSingle();

      if (existingUser) {
        throw new Error('Ya existe un usuario con este DNI');
      }

      const password = formData.password || formData.dni;
      const email = formData.email?.trim() || null;

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: email,
          dni: formData.dni,
          full_name: formData.full_name,
          role: formData.role,
          company_id: targetCompanyId,
          area: formData.area || null,
          proyecto: formData.proyecto || null,
          can_close_reports: formData.can_close_reports,
          password: password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error response:', { status: response.status, result });
        throw new Error(result.error || `Error al crear usuario (${response.status})`);
      }

      setFormData({
        email: '',
        dni: '',
        full_name: '',
        role: 'worker',
        password: '',
        area: '',
        proyecto: '',
        company_id: '',
        can_close_reports: false,
      });
      setShowCreateModal(false);
      loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(`Error al crear usuario: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ active: !currentActive })
        .eq('id', userId);

      if (error) throw error;

      loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert('Error al cambiar estado del usuario');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingUser) return;

    setUpdating(true);
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          role: formData.role,
          area: formData.area || null,
          proyecto: formData.proyecto || null,
          can_close_reports: formData.can_close_reports,
        })
        .eq('id', editingUser.id);

      if (updateError) throw updateError;

      setFormData({
        email: '',
        dni: '',
        full_name: '',
        role: 'worker',
        password: '',
        area: '',
        proyecto: '',
        company_id: '',
        can_close_reports: false,
      });
      setEditingUser(null);
      setShowEditModal(false);
      loadUsers();
      alert('Usuario actualizado correctamente');
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(`Error al actualizar usuario: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', deletingUser.id);

      if (deleteError) throw deleteError;

      setDeletingUser(null);
      setShowDeleteConfirm(false);
      loadUsers();
      alert('Usuario eliminado correctamente');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(`Error al eliminar usuario: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const openEditModal = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setFormData({
      email: userToEdit.email || '',
      dni: userToEdit.dni,
      full_name: userToEdit.full_name,
      role: userToEdit.role,
      password: '',
      area: userToEdit.area || '',
      proyecto: userToEdit.proyecto || '',
      company_id: userToEdit.company_id || '',
      can_close_reports: userToEdit.can_close_reports || false,
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (userToDelete: User) => {
    setDeletingUser(userToDelete);
    setShowDeleteConfirm(true);
  };

  const openResetPasswordModal = (userToReset: User) => {
    setResettingUser(userToReset);
    setShowResetPasswordModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      console.log('Procesando archivo:', file.name);
      const parsedUsers = await parseExcelFile(file);
      console.log('Usuarios parseados:', parsedUsers.length);

      if (parsedUsers.length === 0) {
        alert('El archivo no contiene usuarios válidos. Asegúrate de que el archivo tenga datos y use la plantilla correcta.');
        return;
      }

      const errors: string[] = [];
      parsedUsers.forEach((row, index) => {
        const error = validateUserRow(row, index);
        if (error) {
          errors.push(error);
        }
      });

      setBulkUsers(parsedUsers);
      setBulkUploadErrors(errors);
      setShowBulkUploadModal(true);

      if (errors.length > 0) {
        console.log('Errores de validación:', errors);
      } else {
        console.log('Usuarios validados correctamente');
      }
    } catch (error: any) {
      console.error('Error procesando archivo:', error);
      alert(`Error al procesar archivo: ${error.message}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBulkUpload = async () => {
    if (!user || bulkUsers.length === 0) return;

    const targetCompanyId = user.role === 'super_admin' ? bulkCompanyId : user.company_id;

    if (!targetCompanyId) {
      alert('Debes seleccionar una empresa');
      return;
    }

    setIsProcessingBulk(true);
    setBulkUploadProgress({ current: 0, total: bulkUsers.length });

    const errors: string[] = [];
    let successCount = 0;

    const existingDnis = new Set<string>();
    const { data: existingUsers } = await supabase
      .from('users')
      .select('dni')
      .in('dni', bulkUsers.map(u => u.dni));

    if (existingUsers) {
      existingUsers.forEach(u => existingDnis.add(u.dni));
    }

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    if (!token) {
      alert('No hay sesión activa');
      setIsProcessingBulk(false);
      return;
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;

    for (let i = 0; i < bulkUsers.length; i++) {
      const userData = bulkUsers[i];
      setBulkUploadProgress({ current: i + 1, total: bulkUsers.length });

      try {
        if (existingDnis.has(userData.dni)) {
          errors.push(`${userData.full_name} (DNI: ${userData.dni}): DNI ya existe en el sistema`);
          continue;
        }

        const password = userData.password || userData.dni;
        const email = userData.email?.trim() || null;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: email,
            dni: userData.dni,
            full_name: userData.full_name,
            role: userData.role,
            company_id: targetCompanyId,
            area: userData.area || null,
            proyecto: userData.proyecto || null,
            can_close_reports: userData.can_close_reports || false,
            password: password,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          errors.push(`${userData.full_name} (DNI: ${userData.dni}): ${result.error}`);
          continue;
        }

        existingDnis.add(userData.dni);
        successCount++;
      } catch (error: any) {
        errors.push(`${userData.full_name} (DNI: ${userData.dni}): ${error.message}`);
      }
    }

    setIsProcessingBulk(false);
    setBulkUploadErrors(errors);

    if (errors.length === 0) {
      alert(`¡Éxito! Se crearon ${successCount} usuarios correctamente.`);
      setShowBulkUploadModal(false);
      setBulkUsers([]);
      setBulkCompanyId('');
      loadUsers();
    } else {
      alert(
        `Se crearon ${successCount} usuarios. ${errors.length} fallaron. Revisa los errores en la lista.`
      );
    }
  };

  const handleDownloadTemplate = () => {
    downloadTemplate();
  };

  const getRoleLabel = (role: UserRole): string => {
    const labels: Record<UserRole, string> = {
      worker: 'Trabajador',
      sst_manager: 'Gestor SST',
      hr_observer: 'RRHH/Observador',
      super_admin: 'Super Admin',
    };
    return labels[role];
  };

  const availableRoles: UserRole[] =
    user?.role === 'super_admin'
      ? ['worker', 'sst_manager', 'hr_observer']
      : user?.role === 'sst_manager'
      ? ['worker', 'sst_manager', 'hr_observer']
      : [];

  if (loading) {
    return <Loading fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col gap-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleDownloadTemplate}
                variant="secondary"
                className="flex items-center justify-center gap-2 flex-1"
              >
                <Download className="w-5 h-5" />
                Descargar Plantilla
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="secondary"
                className="flex items-center justify-center gap-2 flex-1"
              >
                <Upload className="w-5 h-5" />
                Carga Masiva
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="primary"
                className="flex items-center justify-center gap-2 flex-1"
              >
                <Plus className="w-5 h-5" />
                Crear Usuario
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">
                    Nombre
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">
                    Email
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">
                    DNI
                  </th>
                  {user?.role === 'super_admin' && (
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">
                      Empresa
                    </th>
                  )}
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">
                    Área
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">
                    Proyecto
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">
                    Rol
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-900 whitespace-nowrap">
                    Puede Cerrar
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">
                    Estado
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap">{u.full_name}</td>
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{u.email}</td>
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{u.dni}</td>
                    {user?.role === 'super_admin' && (
                      <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {(u as any).company?.name || '-'}
                      </td>
                    )}
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{u.area || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{u.proyecto || '-'}</td>
                    <td className="px-3 py-3 text-sm whitespace-nowrap">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-center whitespace-nowrap">
                      {u.can_close_reports ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 inline" />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-blue-50 text-blue-600"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {user?.role === 'super_admin' && (
                          <button
                            onClick={() => openResetPasswordModal(u)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-orange-50 text-orange-600"
                            title="Resetear Contraseña"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleUserActive(u.id, u.active)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.active
                              ? 'hover:bg-yellow-50 text-yellow-600'
                              : 'hover:bg-green-50 text-green-600'
                          }`}
                          title={u.active ? 'Desactivar' : 'Activar'}
                        >
                          {u.active ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(u)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-50 text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Crear Nuevo Usuario</h2>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {user?.role === 'super_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Empresa <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecciona una empresa</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  Rol <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="can_close_reports_create"
                  checked={formData.can_close_reports}
                  onChange={(e) => setFormData({ ...formData, can_close_reports: e.target.checked })}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <label htmlFor="can_close_reports_create" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Puede ser asignado como responsable de cierre de reportes
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (opcional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="ejemplo@empresa.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Área (opcional)
                </label>
                <select
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Selecciona un área</option>
                  {availableAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proyecto (opcional)
                </label>
                <select
                  value={formData.proyecto}
                  onChange={(e) => setFormData({ ...formData, proyecto: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Selecciona un proyecto</option>
                  {availableProyectos.map((proyecto) => (
                    <option key={proyecto} value={proyecto}>
                      {proyecto}
                    </option>
                  ))}
                </select>
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

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      email: '',
                      dni: '',
                      full_name: '',
                      role: 'worker',
                      password: '',
                      area: '',
                      proyecto: '',
                      company_id: '',
                      can_close_reports: false,
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

      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Editar Usuario</h2>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  DNI
                </label>
                <input
                  type="text"
                  value={formData.dni}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">El DNI no puede ser modificado</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || 'No asignado'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">El email no puede ser modificado</p>
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
                  Rol <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="can_close_reports_edit"
                  checked={formData.can_close_reports}
                  onChange={(e) => setFormData({ ...formData, can_close_reports: e.target.checked })}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <label htmlFor="can_close_reports_edit" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Puede ser asignado como responsable de cierre de reportes
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Área (opcional)
                </label>
                <select
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Selecciona un área</option>
                  {availableAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proyecto (opcional)
                </label>
                <select
                  value={formData.proyecto}
                  onChange={(e) => setFormData({ ...formData, proyecto: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Selecciona un proyecto</option>
                  {availableProyectos.map((proyecto) => (
                    <option key={proyecto} value={proyecto}>
                      {proyecto}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setFormData({
                      email: '',
                      dni: '',
                      full_name: '',
                      role: 'worker',
                      password: '',
                      area: '',
                      proyecto: '',
                      company_id: '',
                      can_close_reports: false,
                    });
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

      {showDeleteConfirm && deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Confirmar Eliminación</h2>
                <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">
                ¿Estás seguro que deseas eliminar a este usuario?
              </p>
              <div className="space-y-1 text-sm">
                <p className="font-medium text-gray-900">{deletingUser.full_name}</p>
                <p className="text-gray-600">DNI: {deletingUser.dni}</p>
                <p className="text-gray-600">Email: {deletingUser.email || 'No asignado'}</p>
                <p className="text-gray-600">Rol: {getRoleLabel(deletingUser.role)}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingUser(null);
                }}
                variant="secondary"
                className="flex-1"
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDeleteUser}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                loading={deleting}
              >
                Eliminar Usuario
              </Button>
            </div>
          </div>
        </div>
      )}

      {showBulkUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">Carga Masiva de Usuarios</h2>
              <p className="text-sm text-gray-600 mt-1">
                {bulkUsers.length} usuarios encontrados en el archivo
              </p>
            </div>

            {user?.role === 'super_admin' && (
              <div className="p-6 bg-gray-50 border-b border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Empresa <span className="text-red-500">*</span>
                </label>
                <select
                  value={bulkCompanyId}
                  onChange={(e) => setBulkCompanyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                  disabled={isProcessingBulk}
                >
                  <option value="">Selecciona una empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Todos los usuarios se crearán en la empresa seleccionada
                </p>
              </div>
            )}

            {isProcessingBulk && (
              <div className="p-6 bg-blue-50 border-b border-blue-200">
                <div className="flex items-center gap-3 mb-2">
                  <Loading />
                  <span className="font-medium text-blue-900">
                    Procesando usuarios... {bulkUploadProgress.current} de {bulkUploadProgress.total}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${(bulkUploadProgress.current / bulkUploadProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {bulkUploadErrors.length > 0 && (
              <div className="p-6 bg-red-50 border-b border-red-200">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-2">
                      Se encontraron {bulkUploadErrors.length} errores:
                    </h3>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {bulkUploadErrors.map((error, index) => (
                        <p key={index} className="text-sm text-red-700">
                          • {error}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900">
                        DNI
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900">
                        Nombre
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900">
                        Rol
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900">
                        Email
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900">
                        Área
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900">
                        Proyecto
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-900">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bulkUsers.map((userData, index) => {
                      const hasError = validateUserRow(userData, index);
                      return (
                        <tr
                          key={index}
                          className={hasError ? 'bg-red-50' : 'hover:bg-gray-50'}
                        >
                          <td className="px-3 py-2 font-medium">{userData.dni}</td>
                          <td className="px-3 py-2">{userData.full_name}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                              {getRoleLabel(userData.role as UserRole)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {userData.email || 'Auto-generado'}
                          </td>
                          <td className="px-3 py-2">{userData.area || '-'}</td>
                          <td className="px-3 py-2">{userData.proyecto || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            {hasError ? (
                              <AlertCircle className="w-4 h-4 text-red-600 inline" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-green-600 inline" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setShowBulkUploadModal(false);
                    setBulkUsers([]);
                    setBulkUploadErrors([]);
                    setBulkCompanyId('');
                    setFormData({
                      email: '',
                      dni: '',
                      full_name: '',
                      role: 'worker',
                      password: '',
                      area: '',
                      proyecto: '',
                      company_id: '',
                      can_close_reports: false,
                    });
                  }}
                  variant="secondary"
                  className="flex-1"
                  disabled={isProcessingBulk}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleBulkUpload}
                  variant="primary"
                  className="flex-1"
                  disabled={
                    isProcessingBulk ||
                    bulkUsers.length === 0 ||
                    bulkUploadErrors.length > 0 ||
                    (user?.role === 'super_admin' && !bulkCompanyId)
                  }
                  loading={isProcessingBulk}
                >
                  {isProcessingBulk
                    ? `Creando ${bulkUploadProgress.current}/${bulkUploadProgress.total}...`
                    : bulkUploadErrors.length > 0
                    ? 'Corrige los errores para continuar'
                    : user?.role === 'super_admin' && !bulkCompanyId
                    ? 'Selecciona una empresa'
                    : `Crear ${bulkUsers.length} Usuarios`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResetPasswordModal && resettingUser && (
        <ResetPasswordModal
          userId={resettingUser.id}
          userName={resettingUser.full_name}
          userDni={resettingUser.dni}
          onClose={() => {
            setShowResetPasswordModal(false);
            setResettingUser(null);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}
