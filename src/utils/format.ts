import { ReportStatus, ReportPriority, ReportType, UserRole } from '../types/database';

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Hace un momento';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `Hace ${diffInMinutes} ${diffInMinutes === 1 ? 'minuto' : 'minutos'}`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `Hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `Hace ${diffInDays} ${diffInDays === 1 ? 'día' : 'días'}`;
  }

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getStatusLabel(status: ReportStatus): string {
  const labels: Record<ReportStatus, string> = {
    reported: 'Reportado',
    assigned: 'Pendiente Evidencia',
    in_review: 'En Revisión',
    evidence_rejected: 'Reenviar Evidencia',
    closed: 'Cerrado',
  };
  return labels[status];
}

export function getStatusColor(status: ReportStatus): string {
  const colors: Record<ReportStatus, string> = {
    reported: 'bg-gray-500',
    assigned: 'bg-blue-500',
    in_review: 'bg-yellow-500',
    evidence_rejected: 'bg-red-500',
    closed: 'bg-green-600',
  };
  return colors[status];
}

export function getPriorityLabel(priority: ReportPriority): string {
  const labels: Record<ReportPriority, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    critical: 'Crítica',
  };
  return labels[priority];
}

export function getPriorityColor(priority: ReportPriority): string {
  const colors: Record<ReportPriority, string> = {
    low: 'bg-gray-400',
    medium: 'bg-yellow-400',
    high: 'bg-orange-500',
    critical: 'bg-red-600',
  };
  return colors[priority];
}

export function getTypeLabel(type: ReportType): string {
  const labels: Record<ReportType, string> = {
    unsafe_act: 'Acto Inseguro',
    unsafe_condition: 'Condición Insegura',
  };
  return labels[type];
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    worker: 'Trabajador',
    sst_manager: 'Gestor SST',
    hr_observer: 'RRHH/Observador',
    super_admin: 'Super Admin',
  };
  return labels[role];
}

export const formatDistanceToNow = formatDate;

export function formatDateOnly(dateString: string): string {
  const [year, month, day] = dateString.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

export function parseDateSafe(dateString: string): Date {
  const [year, month, day] = dateString.split('T')[0].split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
}

export function getClosureDateStatus(proposedClosureDate: string | null, reportStatus: ReportStatus): 'overdue' | 'soon' | 'normal' | null {
  if (!proposedClosureDate) return null;
  if (reportStatus === 'closed') return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const closureDate = parseDateSafe(proposedClosureDate);
  closureDate.setHours(0, 0, 0, 0);

  const diffTime = closureDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'soon';
  return 'normal';
}

export function getClosureDateMessage(proposedClosureDate: string | null, reportStatus: ReportStatus): string | null {
  if (!proposedClosureDate) return null;
  if (reportStatus === 'closed') return null;

  const status = getClosureDateStatus(proposedClosureDate, reportStatus);

  if (status === 'overdue') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closureDate = parseDateSafe(proposedClosureDate);
    closureDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - closureDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `Vencida hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  }

  if (status === 'soon') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closureDate = parseDateSafe(proposedClosureDate);
    closureDate.setHours(0, 0, 0, 0);
    const diffTime = closureDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Vence hoy';
    return `Vence en ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  }

  return null;
}
