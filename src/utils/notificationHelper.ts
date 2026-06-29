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

  await sendPushNotification({
    userId,
    title,
    body,
    data: {
      reportId,
      status: newStatus,
      url: '/gallery',
    },
  });
}

export async function notifyNewReportAssigned(
  reportId: string,
  reportDescription: string,
  assignedToId: string
): Promise<void> {
  const title = 'Nuevo Reporte Asignado';
  const body = `Se te ha asignado un nuevo reporte: "${reportDescription.substring(0, 50)}..."`;

  await sendPushNotification({
    userId: assignedToId,
    title,
    body,
    data: {
      reportId,
      url: '/gallery',
    },
  });
}

export async function processNotificationQueue(): Promise<void> {
  try {
    const { data: pendingNotifications, error } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Error fetching pending notifications:', error);
      return;
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return;
    }

    for (const notification of pendingNotifications) {
      let pushSuccess = false;

      try {
        const { data: userData } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', notification.user_id)
          .maybeSingle();

        if (!userData) {
          console.error('User not found for notification:', notification.user_id);
          continue;
        }

        const notificationType =
          notification.title.toLowerCase().includes('nuevo reporte') ? 'report_created' :
          notification.title.toLowerCase().includes('asignado') ? 'report_assigned' :
          notification.title.toLowerCase().includes('evidencia') ? 'evidence_uploaded' :
          notification.title.toLowerCase().includes('cerrado') ? 'report_closed' :
          'report_status_changed';

        const { error: insertError } = await supabase
          .from('notifications')
          .insert({
            user_id: notification.user_id,
            company_id: userData.company_id,
            type: notificationType,
            title: notification.title,
            message: notification.body,
            data: notification.data || {},
            read: false,
          });

        if (insertError) {
          console.error('Error inserting notification:', insertError);
          continue;
        }

        pushSuccess = await sendPushNotification({
          userId: notification.user_id,
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
        });
      } catch (err) {
        console.error('Error processing notification:', err);
      }

      const { error: updateError } = await supabase
        .from('notification_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: pushSuccess ? null : 'Push notification failed but in-app notification created',
        })
        .eq('id', notification.id);

      if (updateError) {
        console.error('Error updating notification status:', updateError);
      }
    }
  } catch (error) {
    console.error('Error processing notification queue:', error);
  }
}
