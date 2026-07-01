import { useState, useEffect } from 'react';
import { X, MapPin, User, Calendar, ChevronLeft, ChevronRight, Upload, CheckCircle, XCircle, CreditCard as Edit2, Trash2, UserPlus, AlertTriangle, Clock, Camera, FileText } from 'lucide-react';
import { Report, ReportStatus, Category, ReportType, ReportPriority } from '../../types/database';
import { formatDate, getStatusLabel, getStatusColor, getPriorityLabel, getPriorityColor, getTypeLabel, getClosureDateStatus, getClosureDateMessage, formatDateOnly } from '../../utils/format';
import { Button } from '../common/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadPhoto, compressImage, uploadEvidenceFile, isImageFile } from '../../utils/storage';

interface ReportDetailModalProps {
  report: Report;
  onClose: () => void;
  onUpdate?: () => void;
  onAssignClick?: () => void;
}

export function ReportDetailModal({ report, onClose, onUpdate, onAssignClick }: ReportDetailModalProps) {
  const { user } = useAuth();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editForm, setEditForm] = useState({
    type: report.type,
    category_id: report.category_id || '',
    description: report.description,
    proposed_closure: report.proposed_closure || '',
    area: report.area || '',
    proyecto: report.proyecto || '',
    priority: report.priority,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableProyectos, setAvailableProyectos] = useState<string[]>([]);
  const [showImageFullscreen, setShowImageFullscreen] = useState(false);
  const [showEvidenceOptions, setShowEvidenceOptions] = useState(false);
  const [evidenceDescription, setEvidenceDescription] = useState('');

  const photos = report.photos || [];
  const canUploadEvidence = report.assigned_to_id === user?.id && (report.status === 'assigned' || report.status === 'evidence_rejected');
  const isManager = user?.role === 'sst_manager' || user?.role === 'super_admin';
  const canValidate = isManager && report.status === 'in_review';
  const canEditOrDelete = isManager && report.status === 'reported';
  const canAssign = isManager && report.status === 'reported' && onAssignClick;

  useEffect(() => {
    if (user && canEditOrDelete) {
      loadCategories();
      loadAreasAndProyectos();
    }
  }, [user, canEditOrDelete]);

  const loadCategories = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('display_order');

    if (data) {
      setCategories(data);
    }
  };

  const loadAreasAndProyectos = async () => {
    if (!user) return;

    const { data: areasData } = await supabase
      .from('areas')
      .select('name')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('name');

    const { data: proyectosData } = await supabase
      .from('proyectos')
      .select('name')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('name');

    if (areasData) {
      setAvailableAreas(areasData.map(a => a.name));
    }

    if (proyectosData) {
      setAvailableProyectos(proyectosData.map(p => p.name));
    }
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handleTakePhoto = async () => {
    setShowEvidenceOptions(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.multiple = false;

    input.onchange = async (e: any) => {
      const files = Array.from(e.target?.files || []) as File[];
      if (files.length === 0 || !user) return;

      setUploading(true);
      try {
        const file = files[0];
        const compressedPhoto = await compressImage(file);
        const photoUrl = await uploadPhoto(compressedPhoto, user.company_id, report.id, true);

        await supabase.from('report_photos').insert({
          report_id: report.id,
          photo_url: photoUrl,
          is_main: false,
          is_evidence: true,
          uploaded_by: user.id,
          description: evidenceDescription || null,
        });

        alert('Evidencia subida correctamente. El reporte ahora está en revisión.');
        setEvidenceDescription('');
        if (onUpdate) onUpdate();
        onClose();
      } catch (error) {
        console.error('Error uploading evidence:', error);
        alert('Error al subir evidencia');
      } finally {
        setUploading(false);
      }
    };

    input.click();
  };

  const handleUploadEvidence = async () => {
    setShowEvidenceOptions(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx';
    input.multiple = true;

    input.onchange = async (e: any) => {
      const files = Array.from(e.target?.files || []) as File[];
      if (files.length === 0 || !user) return;

      setUploading(true);
      try {
        for (const file of files) {
          let photoUrl: string;

          if (isImageFile(file)) {
            const compressedPhoto = await compressImage(file);
            photoUrl = await uploadPhoto(compressedPhoto, user.company_id, report.id, true);
          } else {
            photoUrl = await uploadEvidenceFile(file, user.company_id, report.id);
          }

          await supabase.from('report_photos').insert({
            report_id: report.id,
            photo_url: photoUrl,
            is_main: false,
            is_evidence: true,
            uploaded_by: user.id,
            description: evidenceDescription || null,
          });
        }

        alert('Evidencia subida correctamente. El reporte ahora está en revisión.');
        setEvidenceDescription('');
        if (onUpdate) onUpdate();
        onClose();
      } catch (error) {
        console.error('Error uploading evidence:', error);
        alert('Error al subir evidencia');
      } finally {
        setUploading(false);
      }
    };

    input.click();
  };

  const handleUpdateStatus = async (newStatus: ReportStatus, reason?: string) => {
    setUpdating(true);
    try {
      const updateData: any = { status: newStatus };
      if (reason) {
        updateData.rejection_reason = reason;
      }
      if (newStatus === 'closed') {
        updateData.closed_at = new Date().toISOString();
        updateData.closed_by_id = user?.id;
      }

      const { error } = await supabase
        .from('reports')
        .update(updateData)
        .eq('id', report.id);

      if (error) throw error;

      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado');
    } finally {
      setUpdating(false);
    }
  };

  const handleApprove = async () => {
    await handleUpdateStatus('closed');
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Por favor ingresa un motivo de rechazo');
      return;
    }
    await handleUpdateStatus('evidence_rejected', rejectionReason);
  };

  const handleEdit = async () => {
    if (!editForm.description.trim() || !editForm.category_id) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          type: editForm.type,
          category_id: editForm.category_id,
          description: editForm.description,
          proposed_closure: editForm.proposed_closure,
          area: editForm.area || null,
          proyecto: editForm.proyecto || null,
          priority: editForm.priority,
        })
        .eq('id', report.id);

      if (error) throw error;

      alert('Reporte actualizado correctamente');
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating report:', error);
      alert('Error al actualizar el reporte');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    setUpdating(true);
    try {
      const { error: photosError } = await supabase
        .from('report_photos')
        .delete()
        .eq('report_id', report.id);

      if (photosError) throw photosError;

      const { error: reportError } = await supabase
        .from('reports')
        .delete()
        .eq('id', report.id);

      if (reportError) throw reportError;

      alert('Reporte eliminado correctamente');
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Error al eliminar el reporte');
    } finally {
      setUpdating(false);
    }
  };

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Editar Reporte</h2>
            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Reporte
              </label>
              <select
                value={editForm.type}
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value as ReportType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="unsafe_act">Acto Inseguro</option>
                <option value="unsafe_condition">Condición Insegura</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría *
              </label>
              <select
                value={editForm.category_id}
                onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Área
                </label>
                <select
                  value={editForm.area}
                  onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Selecciona un área</option>
                  {availableAreas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proyecto
                </label>
                <select
                  value={editForm.proyecto}
                  onChange={(e) => setEditForm({ ...editForm, proyecto: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Selecciona un proyecto</option>
                  {availableProyectos.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción *
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Describe el reporte..."
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Propuesta de Cierre
              </label>
              <textarea
                value={editForm.proposed_closure}
                onChange={(e) => setEditForm({ ...editForm, proposed_closure: e.target.value })}
                placeholder="Propón una solución..."
                className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nivel de Riesgo
              </label>
              <select
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as ReportPriority })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={() => setIsEditing(false)}
                variant="secondary"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEdit}
                variant="primary"
                className="flex-1"
                loading={updating}
              >
                Guardar Cambios
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Detalle del Reporte</h2>
          <div className="flex items-center gap-2">
            {canAssign && (
              <button
                onClick={onAssignClick}
                className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                title="Asignar responsable"
              >
                <UserPlus className="w-5 h-5" />
              </button>
            )}
            {canEditOrDelete && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                  title="Editar reporte"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                  title="Eliminar reporte"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {photos.length > 0 && (
            <div className="relative">
              <div
                className="aspect-video bg-gray-200 rounded-lg overflow-hidden cursor-pointer group relative"
                onClick={() => setShowImageFullscreen(true)}
              >
                <img
                  src={photos[currentPhotoIndex].photo_url}
                  alt="Report photo"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                  <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm">
                    Clic para ampliar
                  </div>
                </div>
              </div>

              {photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                    {currentPhotoIndex + 1} / {photos.length}
                  </div>
                </>
              )}

              {photos[currentPhotoIndex].is_evidence && (
                <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                  Evidencia
                </div>
              )}
            </div>
          )}

          {photos.length > 0 && photos[currentPhotoIndex].description && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Descripción: </span>
                {photos[currentPhotoIndex].description}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className={`${getStatusColor(report.status)} text-white text-sm px-3 py-1 rounded-full`}>
                {getStatusLabel(report.status)}
              </span>
              <span className={`${getPriorityColor(report.priority)} text-white text-sm px-3 py-1 rounded-full`}>
                {getPriorityLabel(report.priority)}
              </span>
              <span className="text-sm text-gray-600">{getTypeLabel(report.type)}</span>
            </div>

            {report.category && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Categoría</h3>
                <p className="text-gray-900">{report.category.name}</p>
              </div>
            )}

            {(report.area || report.proyecto) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {report.area && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Área</h3>
                    <p className="text-gray-900">{report.area}</p>
                  </div>
                )}
                {report.proyecto && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Proyecto</h3>
                    <p className="text-gray-900">{report.proyecto}</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Descripción</h3>
              <p className="text-gray-900">{report.description}</p>
            </div>

            {report.proposed_closure && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Propuesta de Cierre</h3>
                <p className="text-gray-900">{report.proposed_closure}</p>
              </div>
            )}

            {report.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-700 mb-1">Motivo de Rechazo</h3>
                <p className="text-red-900">{report.rejection_reason}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <User className="w-4 h-4" />
                <span>{report.reporter?.full_name || 'Usuario'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(report.created_at)}</span>
              </div>
            </div>

            {report.assigned_to && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Asignado a:</span> {report.assigned_to.full_name}
                </p>
                {report.proposed_closure_date && (
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Fecha propuesta de cierre:</span>{' '}
                    {formatDateOnly(report.proposed_closure_date)}
                  </p>
                )}
              </div>
            )}

            {getClosureDateStatus(report.proposed_closure_date, report.status) === 'overdue' && (
              <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-red-800 mb-1">Fecha de Cierre Vencida</h3>
                  <p className="text-sm text-red-700">
                    {getClosureDateMessage(report.proposed_closure_date, report.status)}. Este reporte requiere atención inmediata.
                  </p>
                </div>
              </div>
            )}

            {getClosureDateStatus(report.proposed_closure_date, report.status) === 'soon' && (
              <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-orange-800 mb-1">Fecha de Cierre Próxima</h3>
                  <p className="text-sm text-orange-700">
                    {getClosureDateMessage(report.proposed_closure_date, report.status)}. Por favor, prioriza este reporte.
                  </p>
                </div>
              </div>
            )}

            {report.status === 'closed' && report.closed_by && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                <p className="text-sm text-green-900">
                  <span className="font-semibold">Cerrado por:</span> {report.closed_by.full_name}
                </p>
                {report.closed_at && (
                  <p className="text-sm text-green-900">
                    <span className="font-semibold">Fecha de cierre:</span>{' '}
                    {new Date(report.closed_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            )}

            {report.location_address && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{report.location_address}</span>
              </div>
            )}
          </div>

          {canUploadEvidence && (
            <div className="pt-4 border-t relative">
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  Sube evidencia del cierre. Puedes tomar una foto directamente o subir imágenes y documentos (PDF, Word, Excel). Una vez subida, el reporte pasará automáticamente a revisión del Gestor SST.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción de la evidencia (opcional)
                </label>
                <textarea
                  value={evidenceDescription}
                  onChange={(e) => setEvidenceDescription(e.target.value)}
                  placeholder="Describe brevemente lo que muestra esta evidencia..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                />
              </div>

              {!showEvidenceOptions ? (
                <Button
                  onClick={() => setShowEvidenceOptions(true)}
                  variant="primary"
                  size="lg"
                  className="w-full flex items-center justify-center gap-2"
                  loading={uploading}
                >
                  <Upload className="w-5 h-5" />
                  Subir Evidencia
                </Button>
              ) : (
                <div className="space-y-3">
                  <Button
                    onClick={handleTakePhoto}
                    variant="primary"
                    size="lg"
                    className="w-full flex items-center justify-center gap-2"
                    loading={uploading}
                  >
                    <Camera className="w-5 h-5" />
                    Tomar Foto
                  </Button>
                  <Button
                    onClick={handleUploadEvidence}
                    variant="primary"
                    size="lg"
                    className="w-full flex items-center justify-center gap-2"
                    loading={uploading}
                  >
                    <FileText className="w-5 h-5" />
                    Subir Archivos
                  </Button>
                  <Button
                    onClick={() => setShowEvidenceOptions(false)}
                    variant="secondary"
                    size="lg"
                    className="w-full"
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}

          {canValidate && (
            <div className="pt-4 border-t space-y-3" data-onboarding="status-button">
              {!showRejectionInput ? (
                <>
                  <Button
                    onClick={handleApprove}
                    variant="success"
                    className="w-full flex items-center justify-center gap-2"
                    loading={updating}
                  >
                    <CheckCircle className="w-5 h-5" />
                    Aprobar y Cerrar
                  </Button>
                  <Button
                    onClick={() => setShowRejectionInput(true)}
                    variant="danger"
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    Rechazar Evidencia
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Motivo del rechazo..."
                    className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setShowRejectionInput(false)}
                      variant="secondary"
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleReject}
                      variant="danger"
                      className="flex-1"
                      loading={updating}
                    >
                      Confirmar Rechazo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">Confirmar Eliminación</h2>
            <p className="text-gray-700 mb-6">
              ¿Estás seguro de que deseas eliminar este reporte? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="secondary"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                variant="danger"
                className="flex-1"
                loading={updating}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showImageFullscreen && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setShowImageFullscreen(false)}
        >
          <button
            onClick={() => setShowImageFullscreen(false)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="relative max-w-7xl w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[currentPhotoIndex].photo_url}
              alt="Full screen report photo"
              className="max-w-full max-h-full object-contain rounded-lg"
            />

            {photos.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevPhoto();
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-colors"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    nextPhoto();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-colors"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full backdrop-blur-sm">
                  {currentPhotoIndex + 1} / {photos.length}
                </div>
              </>
            )}

            {photos[currentPhotoIndex].is_evidence && (
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                <div className="bg-green-600 text-white px-4 py-2 rounded-full">
                  Evidencia
                </div>
                {photos[currentPhotoIndex].description && (
                  <div className="bg-black/70 text-white px-4 py-2 rounded-lg max-w-md backdrop-blur-sm">
                    <p className="text-sm">{photos[currentPhotoIndex].description}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
