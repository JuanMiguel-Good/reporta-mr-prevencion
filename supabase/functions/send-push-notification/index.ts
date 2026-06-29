import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const VAPID_PUBLIC_KEY = 'BN8nNI3QKH5hI5Gy-hfZvkEo8ab4JV2YzbiY-Sz9Of7Xl33Rn9JgKYMX1SJXyTEVpKtub_kEGtr13zuivmWiaXQ';
const VAPID_PRIVATE_KEY = 'PFnz7mTQfXInu11a0_JouoWfFBvKB_Fri6HE9fEpPkc';
const VAPID_SUBJECT = 'mailto:admin@reporta.app';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

interface NotificationPayload {
  notificationId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const payload: NotificationPayload = await req.json();

    const { data: notification, error: notifError } = await supabaseClient
      .from('notification_queue')
      .select('*')
      .eq('id', payload.notificationId)
      .eq('status', 'pending')
      .single();

    if (notifError || !notification) {
      return new Response(
        JSON.stringify({ error: 'Notification not found or already processed' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: subscriptions, error: subError } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', notification.user_id);

    if (subError || !subscriptions || subscriptions.length === 0) {
      await supabaseClient
        .from('notification_queue')
        .update({
          status: 'failed',
          error_message: 'No push subscriptions found',
          sent_at: new Date().toISOString()
        })
        .eq('id', notification.id);

      return new Response(
        JSON.stringify({ success: false, error: 'No subscriptions' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let sentSuccessfully = false;
    const errors = [];

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: subscription.keys
        };

        const notificationPayload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
        });

        await webpush.sendNotification(pushSubscription, notificationPayload);

        await supabaseClient
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', subscription.id);

        sentSuccessfully = true;
      } catch (error: any) {
        console.error('Error sending to subscription:', error);
        errors.push(error.message);

        if (error.statusCode === 404 || error.statusCode === 410) {
          await supabaseClient
            .from('push_subscriptions')
            .delete()
            .eq('id', subscription.id);
        }
      }
    }

    if (sentSuccessfully) {
      await supabaseClient
        .from('notification_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', notification.id);

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      await supabaseClient
        .from('notification_queue')
        .update({
          status: 'failed',
          error_message: errors.join(', '),
          sent_at: new Date().toISOString()
        })
        .eq('id', notification.id);

      return new Response(
        JSON.stringify({ success: false, errors }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});