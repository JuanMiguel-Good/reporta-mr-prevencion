import { useState, useEffect } from 'react';
import { Plus, Send, Calendar, Users, Mail, Clock, AlertCircle, Info, AlertTriangle, CheckCircle2, Upload, X, Eye, Trash2, Building2, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { useNavigate } from 'react-router-dom';

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'info' | 'warning' | 'important';
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  scheduled_for: string | null;
  sent_at: string | null;
  recipient_count: number;
  attachment_urls: string[];
  created_at: string;
  updated_at: string;
}

interface AnnouncementRecipient {
  id: string;
  user_id: string;
  email_sent: boolean;
  email_sent_at: string | null;
  read_at: string | null;
  users: {
    full_name: string;
    email: string;
    companies: {
      name: string;
    };
  };
}

interface Company {
  id: string;
  name: string;
  manager_count: number;
}

interface SSTManager {
  id: string;
  full_name: string;
  email: string;
  company_id: string;
  company_name: string;
}

export function AnnouncementsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [recipients, setRecipients] = useState<AnnouncementRecipient[]>([]);
  const [sstManagerCount, setSstManagerCount] = useState(0);
  const [previewRecipientCount, setPreviewRecipientCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sstManagers, setSstManagers] = useState<SSTManager[]>([]);
  const [recipientType, setRecipientType] = useState<'all' | 'companies' | 'managers'>('all');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'info' as 'info' | 'warning' | 'important',
    sendImmediately: true,
    scheduledFor: '',
  });

  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadAnnouncements();
      loadSSTManagerCount();
      loadCompanies();
      loadSSTManagers();
    }
  }, [user]);

  useEffect(() => {
    if (showCreateModal) {
      updateRecipientCount();
    }
  }, [recipientType, selectedCompanies, selectedManagers, companies, sstManagers]);

  useEffect(() => {
    if (showPreviewModal && selectedAnnouncement) {
      calculateAnnouncementRecipients(selectedAnnouncement);
    }
  }, [showPreviewModal, selectedAnnouncement]);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error loading announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSSTManagerCount = async () => {
    try {
      const { count, error } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'sst_manager')
        .eq('active', true)
        .not('email', 'is', null);

      if (error) throw error;
      setSstManagerCount(count || 0);
    } catch (error) {
      console.error('Error loading SST manager count:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          users!users_company_id_fkey (
            id
          )
        `)
        .eq('users.role', 'sst_manager')
        .eq('users.active', true)
        .not('users.email', 'is', null);

      if (error) throw error;

      const companiesWithCount = (data || []).map(company => ({
        id: company.id,
        name: company.name,
        manager_count: Array.isArray(company.users) ? company.users.length : 0,
      })).filter(c => c.manager_count > 0);

      setCompanies(companiesWithCount);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const loadSSTManagers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          company_id,
          companies:company_id (
            name
          )
        `)
        .eq('role', 'sst_manager')
        .eq('active', true)
        .not('email', 'is', null)
        .order('full_name');

      if (error) throw error;

      const managersFormatted = (data || []).map(manager => ({
        id: manager.id,
        full_name: manager.full_name,
        email: manager.email,
        company_id: manager.company_id,
        company_name: (manager.companies as any)?.name || 'Sin empresa',
      }));

      setSstManagers(managersFormatted);
    } catch (error) {
      console.error('Error loading SST managers:', error);
    }
  };

  const updateRecipientCount = () => {
    if (recipientType === 'all') {
      return;
    }

    if (recipientType === 'companies') {
      const count = companies
        .filter(c => selectedCompanies.includes(c.id))
        .reduce((sum, c) => sum + c.manager_count, 0);
      setSstManagerCount(count);
    } else if (recipientType === 'managers') {
      setSstManagerCount(selectedManagers.length);
    }
  };

  const calculateAnnouncementRecipients = async (announcement: Announcement) => {
    try {
      if (!announcement.data || announcement.data.type === 'all') {
        setPreviewRecipientCount(sstManagerCount);
        return;
      }

      const filters = announcement.data;

      if (filters.type === 'companies' && filters.company_ids && filters.company_ids.length > 0) {
        const { count, error } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'sst_manager')
          .eq('active', true)
          .not('email', 'is', null)
          .in('company_id', filters.company_ids);

        if (error) {
          console.error('Error counting recipients:', error);
          setPreviewRecipientCount(0);
        } else {
          setPreviewRecipientCount(count || 0);
        }
      } else if (filters.type === 'managers' && filters.manager_ids && filters.manager_ids.length > 0) {
        setPreviewRecipientCount(filters.manager_ids.length);
      } else {
        setPreviewRecipientCount(0);
      }
    } catch (error) {
      console.error('Error calculating recipients:', error);
      setPreviewRecipientCount(0);
    }
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();

    if (recipientType !== 'all' &&
        ((recipientType === 'companies' && selectedCompanies.length === 0) ||
         (recipientType === 'managers' && selectedManagers.length === 0))) {
      alert('Debes seleccionar al menos un destinatario');
      return;
    }

    setCreating(true);

    try {
      const attachmentUrls: string[] = [];

      for (const file of attachmentFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `announcements/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('report-photos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('report-photos')
          .getPublicUrl(filePath);

        attachmentUrls.push(publicUrl);
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user?.id)
        .maybeSingle();

      if (!userData) throw new Error('User not found');

      const scheduledFor = formData.sendImmediately
        ? null
        : formData.scheduledFor ? new Date(formData.scheduledFor).toISOString() : null;

      const recipientFilters = {
        type: recipientType,
        company_ids: recipientType === 'companies' ? selectedCompanies : undefined,
        manager_ids: recipientType === 'managers' ? selectedManagers : undefined,
      };

      const { data: announcement, error } = await supabase
        .from('announcements')
        .insert({
          title: formData.title,
          message: formData.message,
          priority: formData.priority,
          status: formData.sendImmediately ? 'draft' : 'scheduled',
          created_by: userData.id,
          scheduled_for: scheduledFor,
          attachment_urls: attachmentUrls,
          data: recipientFilters,
        })
        .select()
        .single();

      if (error) throw error;

      if (formData.sendImmediately) {
        setSelectedAnnouncement(announcement);
        setShowCreateModal(false);
        setShowPreviewModal(true);
      } else {
        resetForm();
        setShowCreateModal(false);
        loadAnnouncements();
        loadSSTManagerCount();
        alert('Anuncio programado exitosamente');
      }
    } catch (error: any) {
      console.error('Error creating announcement:', error);
      alert(`Error al crear anuncio: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleSendAnnouncement = async (announcementId: string) => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-announcement`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ announcementId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al enviar anuncio');
      }

      alert(`Anuncio enviado exitosamente a ${result.recipient_count} gestores SST`);
      setShowPreviewModal(false);
      setSelectedAnnouncement(null);
      resetForm();
      loadAnnouncements();
      loadSSTManagerCount();
    } catch (error: any) {
      console.error('Error sending announcement:', error);
      alert(`Error al enviar anuncio: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const loadAnnouncementDetails = async (announcement: Announcement) => {
    try {
      const { data, error } = await supabase
        .from('announcement_recipients')
        .select(`
          id,
          user_id,
          email_sent,
          email_sent_at,
          read_at,
          users:user_id (
            full_name,
            email,
            companies:company_id (
              name
            )
          )
        `)
        .eq('announcement_id', announcement.id);

      if (error) throw error;
      setRecipients(data || []);
      setSelectedAnnouncement(announcement);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error loading announcement details:', error);
      alert('Error al cargar detalles del anuncio');
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!confirm('¿Estás seguro de eliminar este anuncio? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId);

      if (error) throw error;

      loadAnnouncements();
      alert('Anuncio eliminado exitosamente');
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      alert(`Error al eliminar anuncio: ${error.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      priority: 'info',
      sendImmediately: true,
      scheduledFor: '',
    });
    setAttachmentFiles([]);
    setRecipientType('all');
    setSelectedCompanies([]);
    setSelectedManagers([]);
    loadSSTManagerCount();
  };

  const handleSelectAllCompanies = () => {
    if (selectedCompanies.length === companies.length) {
      setSelectedCompanies([]);
    } else {
      setSelectedCompanies(companies.map(c => c.id));
    }
  };

  const handleSelectAllManagers = () => {
    if (selectedManagers.length === sstManagers.length) {
      setSelectedManagers([]);
    } else {
      setSelectedManagers(sstManagers.map(m => m.id));
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      info: 'bg-blue-100 text-blue-700 border-blue-200',
      warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      important: 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[priority as keyof typeof colors] || colors.info;
  };

  const getPriorityIcon = (priority: string) => {
    const icons = {
      info: <Info className="w-4 h-4" />,
      warning: <AlertTriangle className="w-4 h-4" />,
      important: <AlertCircle className="w-4 h-4" />,
    };
    return icons[priority as keyof typeof icons] || icons.info;
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      info: 'Información',
      warning: 'Advertencia',
      important: 'Importante',
    };
    return labels[priority as keyof typeof labels] || priority;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-blue-100 text-blue-700',
      sent: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    return colors[status as keyof typeof colors] || colors.draft;
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      draft: 'Borrador',
      scheduled: 'Programado',
      sent: 'Enviado',
      failed: 'Error',
    };
    return labels[status as keyof typeof labels] || status;
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
              <h1 className="text-2xl font-bold text-gray-900">Anuncios del Sistema</h1>
              <p className="text-sm text-gray-600 mt-1">
                Envía comunicaciones a Gestores SST
              </p>
            </div>
            <Button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nuevo Anuncio
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Gestores SST</p>
                  <p className="text-2xl font-bold text-blue-900">{sstManagerCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Send className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-600 font-medium">Enviados</p>
                  <p className="text-2xl font-bold text-green-900">
                    {announcements.filter(a => a.status === 'sent').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Programados</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {announcements.filter(a => a.status === 'scheduled').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {announcements.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Mail className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No hay anuncios creados</p>
                <p className="text-sm mt-1">Crea tu primer anuncio para comunicarte con los gestores SST</p>
              </div>
            ) : (
              announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${getPriorityColor(announcement.priority)}`}>
                      {getPriorityIcon(announcement.priority)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {announcement.title}
                        </h3>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(announcement.status)}`}>
                          {getStatusLabel(announcement.status)}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {announcement.message}
                      </p>

                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(announcement.created_at)}
                        </span>
                        {announcement.sent_at && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Send className="w-3 h-3" />
                              Enviado: {formatDate(announcement.sent_at)}
                            </span>
                          </>
                        )}
                        {announcement.scheduled_for && !announcement.sent_at && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Programado: {formatDate(announcement.scheduled_for)}
                            </span>
                          </>
                        )}
                        {announcement.status === 'sent' && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {announcement.recipient_count} destinatarios
                            </span>
                          </>
                        )}
                      </div>

                      {announcement.attachment_urls.length > 0 && (
                        <div className="mb-3">
                          <span className="text-xs text-gray-500">
                            📎 {announcement.attachment_urls.length} archivo(s) adjunto(s)
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {announcement.status === 'sent' && (
                          <button
                            onClick={() => loadAnnouncementDetails(announcement)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            Ver Detalles
                          </button>
                        )}

                        {announcement.status === 'draft' && (
                          <button
                            onClick={() => {
                              setSelectedAnnouncement(announcement);
                              setShowPreviewModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 rounded-md transition-colors"
                          >
                            <Send className="w-4 h-4" />
                            Enviar Ahora
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteAnnouncement(announcement.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Crear Nuevo Anuncio</h2>

            <form onSubmit={handleCreateDraft} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título del Anuncio <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Ej: Nueva funcionalidad de IA disponible"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Escribe el contenido completo del anuncio..."
                  rows={8}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este mensaje se enviará por correo a los gestores SST seleccionados
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prioridad <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.priority === 'info' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="priority"
                      value="info"
                      checked={formData.priority === 'info'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex items-center gap-1">
                      <Info className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">Información</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.priority === 'warning' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="priority"
                      value="warning"
                      checked={formData.priority === 'warning'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-4 h-4 text-yellow-600"
                    />
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium">Advertencia</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.priority === 'important' ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="priority"
                      value="important"
                      checked={formData.priority === 'important'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-4 h-4 text-red-600"
                    />
                    <div className="flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium">Importante</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Archivos Adjuntos (Opcional)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-red-500 transition-colors">
                  <input
                    type="file"
                    id="attachment-upload"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setAttachmentFiles([...attachmentFiles, ...files]);
                    }}
                    className="hidden"
                  />
                  <label htmlFor="attachment-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <div className="text-sm text-gray-600 mb-1">
                      Subir archivos adjuntos
                    </div>
                    <div className="text-xs text-gray-500">
                      Imágenes, PDF, Word (máx. 10MB cada uno)
                    </div>
                  </label>
                </div>

                {attachmentFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachmentFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700 truncate flex-1">
                          📎 {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentFiles(attachmentFiles.filter((_, i) => i !== index));
                          }}
                          className="text-red-600 hover:text-red-700 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Destinatarios <span className="text-red-500">*</span>
                </label>

                <div className="space-y-3">
                  <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    recipientType === 'all' ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="recipientType"
                      checked={recipientType === 'all'}
                      onChange={() => {
                        setRecipientType('all');
                        loadSSTManagerCount();
                      }}
                      className="mt-0.5 w-4 h-4 text-red-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-900">Todos los Gestores SST</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Enviar a todos los gestores SST activos del sistema
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    recipientType === 'companies' ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="recipientType"
                      checked={recipientType === 'companies'}
                      onChange={() => setRecipientType('companies')}
                      className="mt-0.5 w-4 h-4 text-red-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-900">Por Empresas</span>
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        Selecciona empresas específicas
                      </div>

                      {recipientType === 'companies' && (
                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                          <div className="flex items-center justify-between mb-2 pb-2 border-b">
                            <span className="text-xs font-medium text-gray-700">
                              {selectedCompanies.length} de {companies.length} seleccionadas
                            </span>
                            <button
                              type="button"
                              onClick={handleSelectAllCompanies}
                              className="text-xs text-red-600 hover:text-red-700 font-medium"
                            >
                              {selectedCompanies.length === companies.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                            </button>
                          </div>
                          {companies.map((company) => (
                            <label key={company.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedCompanies.includes(company.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCompanies([...selectedCompanies, company.id]);
                                  } else {
                                    setSelectedCompanies(selectedCompanies.filter(id => id !== company.id));
                                  }
                                }}
                                className="w-4 h-4 text-red-600 rounded"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">{company.name}</div>
                                <div className="text-xs text-gray-500">{company.manager_count} gestor(es)</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    recipientType === 'managers' ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="recipientType"
                      checked={recipientType === 'managers'}
                      onChange={() => setRecipientType('managers')}
                      className="mt-0.5 w-4 h-4 text-red-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-900">Gestores Específicos</span>
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        Selecciona gestores SST individuales
                      </div>

                      {recipientType === 'managers' && (
                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                          <div className="flex items-center justify-between mb-2 pb-2 border-b">
                            <span className="text-xs font-medium text-gray-700">
                              {selectedManagers.length} de {sstManagers.length} seleccionados
                            </span>
                            <button
                              type="button"
                              onClick={handleSelectAllManagers}
                              className="text-xs text-red-600 hover:text-red-700 font-medium"
                            >
                              {selectedManagers.length === sstManagers.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                            </button>
                          </div>
                          {sstManagers.map((manager) => (
                            <label key={manager.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedManagers.includes(manager.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedManagers([...selectedManagers, manager.id]);
                                  } else {
                                    setSelectedManagers(selectedManagers.filter(id => id !== manager.id));
                                  }
                                }}
                                className="w-4 h-4 text-red-600 rounded"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">{manager.full_name}</div>
                                <div className="text-xs text-gray-500">{manager.email}</div>
                                <div className="text-xs text-gray-400">{manager.company_name}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Programación de Envío
                </label>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="scheduling"
                      checked={formData.sendImmediately}
                      onChange={() => setFormData({ ...formData, sendImmediately: true, scheduledFor: '' })}
                      className="mt-0.5 w-4 h-4 text-red-600"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Preparar para envío inmediato</div>
                      <div className="text-xs text-gray-500">Se mostrará una vista previa antes de enviar</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="scheduling"
                      checked={!formData.sendImmediately}
                      onChange={() => setFormData({ ...formData, sendImmediately: false })}
                      className="mt-0.5 w-4 h-4 text-red-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-2">Programar para más tarde</div>
                      {!formData.sendImmediately && (
                        <input
                          type="datetime-local"
                          value={formData.scheduledFor}
                          onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                          required={!formData.sendImmediately}
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Este anuncio se enviará a {sstManagerCount} gestor(es) SST</strong>
                  {recipientType === 'companies' && selectedCompanies.length > 0 && ` en ${selectedCompanies.length} empresa(s) seleccionada(s)`}
                  {recipientType === 'managers' && selectedManagers.length > 0 && ` seleccionado(s) manualmente`}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={creating}>
                  {formData.sendImmediately ? 'Continuar' : 'Programar Anuncio'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPreviewModal && selectedAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8">
            <h2 className="text-xl font-bold mb-4">Vista Previa del Anuncio</h2>

            <div className="border-2 border-gray-200 rounded-lg p-6 mb-6 bg-gray-50">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 ${getPriorityColor(selectedAnnouncement.priority)}`}>
                {getPriorityIcon(selectedAnnouncement.priority)}
                <span className="text-sm font-medium">{getPriorityLabel(selectedAnnouncement.priority)}</span>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {selectedAnnouncement.title}
              </h3>

              <div className="text-gray-700 whitespace-pre-wrap mb-4">
                {selectedAnnouncement.message}
              </div>

              {selectedAnnouncement.attachment_urls.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Archivos adjuntos:</p>
                  <ul className="space-y-1">
                    {selectedAnnouncement.attachment_urls.map((url, index) => (
                      <li key={index} className="text-sm text-blue-600">
                        📎 {url.split('/').pop()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 mb-1">
                    Confirmar envío
                  </p>
                  <p className="text-sm text-yellow-700">
                    Este anuncio se enviará por correo electrónico a <strong>{previewRecipientCount} gestor(es) SST</strong>. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => {
                  setShowPreviewModal(false);
                  setSelectedAnnouncement(null);
                }}
                variant="secondary"
                className="flex-1"
                disabled={sending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleSendAnnouncement(selectedAnnouncement.id)}
                variant="primary"
                className="flex-1 bg-green-600 hover:bg-green-700"
                loading={sending}
              >
                <Send className="w-4 h-4 mr-2" />
                Confirmar y Enviar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Detalles del Anuncio</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedAnnouncement(null);
                  setRecipients([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {selectedAnnouncement.title}
              </h3>
              <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">
                {selectedAnnouncement.message}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className={`px-2 py-1 rounded ${getPriorityColor(selectedAnnouncement.priority)}`}>
                  {getPriorityLabel(selectedAnnouncement.priority)}
                </span>
                <span>Enviado: {selectedAnnouncement.sent_at ? formatDate(selectedAnnouncement.sent_at) : '-'}</span>
                <span>{selectedAnnouncement.recipient_count} destinatarios</span>
              </div>
            </div>

            <h3 className="font-semibold text-gray-900 mb-3">Destinatarios</h3>
            <div className="space-y-2">
              {recipients.map((recipient) => (
                <div key={recipient.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{recipient.users.full_name}</p>
                    <p className="text-sm text-gray-600">{recipient.users.email}</p>
                    <p className="text-xs text-gray-500">{(recipient.users.companies as any)?.name}</p>
                  </div>
                  <div className="text-right">
                    {recipient.email_sent ? (
                      <div className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Enviado</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Pendiente</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
