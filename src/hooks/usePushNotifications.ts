import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);
        const hasSubscription = await checkSubscription();

        if (!hasSubscription && Notification.permission !== 'denied') {
          setTimeout(() => {
            subscribe();
          }, 2000);
        }
      }
    };

    checkSupport();
  }, []);

  const checkSubscription = async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const hasSubscription = !!subscription;
      setIsSubscribed(hasSubscription);
      return hasSubscription;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      console.log('Las notificaciones push no están soportadas en este navegador');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  };

  const subscribe = async (): Promise<boolean> => {
    if (!isSupported) return false;

    setLoading(true);
    try {
      const hasPermission = permission === 'granted' || await requestPermission();
      if (!hasPermission) {
        console.log('Permiso de notificaciones denegado');
        setLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BN8nNI3QKH5hI5Gy-hfZvkEo8ab4JV2YzbiY-Sz9Of7Xl33Rn9JgKYMX1SJXyTEVpKtub_kEGtr13zuivmWiaXQ';

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      const subscriptionJSON = subscription.toJSON();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);

      const { error } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: user.id,
          endpoint: subscriptionJSON.endpoint!,
          keys: {
            p256dh: subscriptionJSON.keys!.p256dh,
            auth: subscriptionJSON.keys!.auth
          },
          user_agent: navigator.userAgent,
          last_used_at: new Date().toISOString()
        });

      if (error) throw error;

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setLoading(false);
      return false;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    if (!isSupported) return false;

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);

        if (error) throw error;
      }

      setIsSubscribed(false);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setLoading(false);
      return false;
    }
  };

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    requestPermission,
    subscribe,
    unsubscribe
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
