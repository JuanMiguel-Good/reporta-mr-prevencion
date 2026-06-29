import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppBadge } from '../../hooks/useAppBadge';
import { useAuth } from '../../contexts/AuthContext';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

export function GlobalNotificationManager() {
  const { user } = useAuth();
  const { setBadge, isSupported } = useAppBadge();
  const { isInstalled } = useInstallPrompt();

  useEffect(() => {
    if (!user) return;

    const checkBadgeSupport = async () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isAndroid = /android/.test(userAgent);
      const notificationPermission = 'Notification' in window ? Notification.permission : 'not-supported';

      console.log('[Badge System Status]', {
        platform: isAndroid ? 'Android' : 'iOS/Other',
        apiSupported: isSupported,
        pwaInstalled: isInstalled,
        notificationPermission,
        launcher: isAndroid ? 'Android Launcher (soporte variable)' : 'N/A',
        message: !isInstalled
          ? 'Para ver el badge en el ícono, debes INSTALAR la app'
          : isAndroid
          ? 'Android: El badge depende del launcher. Algunos launchers NO lo soportan (Samsung, Xiaomi, OnePlus).'
          : 'App instalada correctamente.'
      });

      if (isAndroid && notificationPermission !== 'granted') {
        console.warn('[WARNING] Los permisos de notificación deben estar habilitados para que funcione el badge en Android');
      }
    };

    checkBadgeSupport();

    const updateBadgeCount = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false);

        if (error) {
          console.error('Error counting notifications:', error);
          return;
        }

        const unreadCount = count || 0;
        console.log('[Updating App Badge]', {
          count: unreadCount,
          installed: isInstalled,
          willShowOnIcon: isInstalled && unreadCount > 0
        });
        await setBadge(unreadCount);
      } catch (error) {
        console.error('Error updating badge:', error);
      }
    };

    updateBadgeCount();

    const channel = supabase
      .channel('global-notifications-badge')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          updateBadgeCount();
        }
      )
      .subscribe();

    const interval = setInterval(updateBadgeCount, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, setBadge, isInstalled, isSupported]);

  return null;
}
