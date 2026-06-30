import { supabase } from '../lib/supabase';

interface SendNotificationParams {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

interface SendNotificationToMultipleParams {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function sendPushNotification(params: SendNotificationParams): Promise<boolean> {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('No session found');
      return false;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        userId: params.userId,
        title: params.title,
        body: params.body,
        data: params.data || {},
      }),
    });

    if (!response.ok) {
      console.error('Failed to send notification:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

export async function sendPushNotificationToMultiple(params: SendNotificationToMultipleParams): Promise<boolean> {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('No session found');
      return false;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        userIds: params.userIds,
        title: params.title,
        body: params.body,
        data: params.data || {},
      }),
    });

    if (!response.ok) {
      console.error('Failed to send notifications:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return false;
  }
}

export async function createInAppNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  url?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      source_app: 'reporta',
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data || {},
      url: params.url ?? null,
      read: false,
    });

  if (error) {
    console.error('Error inserting notification:', error);
  }
}

export async function notifyReportStatusChange(
  reportId: string,
  reportDescription: string,
  newStatus: string,
  userId: string
): Promise<void> {
  const statusLabels: Record<string, string> = {
    open: 'Abierto',
    in_review: 'En Revisión',
    in_progress: 'En Proceso',
    closed: 'Cerrado',
  };

  const title = 'Actualización de Reporte';
  const body = `Tu reporte "${reportDescription.substring(0, 50)}..." cambió a: ${statusLabels[newStatus] || newStatus}`;

  await Promise.all([
    sendPushNotification({ userId, title, body, data: { reportId, status: newStatus, url: '/gallery' } }),
    createInAppNotification({ userId, type: 'report_status_changed', title, message: body, data: { reportId, status: newStatus }, url: '/gallery' }),
  ]);
}

export async function notifyNewReportAssigned(
  reportId: string,
  reportDescription: string,
  assignedToId: string
): Promise<void> {
  const title = 'Nuevo Reporte Asignado';
  const body = `Se te ha asignado un nuevo reporte: "${reportDescription.substring(0, 50)}..."`;

  await Promise.all([
    sendPushNotification({ userId: assignedToId, title, body, data: { reportId, url: '/gallery' } }),
    createInAppNotification({ userId: assignedToId, type: 'report_assigned', title, message: body, data: { reportId }, url: '/gallery' }),
  ]);
}
