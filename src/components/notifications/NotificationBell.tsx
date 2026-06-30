import { useState, useEffect, useRef } from 'react';
import { Bell, Check, BellOff, AlertCircle, AlertTriangle, Info, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Notification } from '../../types/database';
import { formatDistanceToNow } from '../../utils/format';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAppBadge } from '../../hooks/useAppBadge';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isSupported, isSubscribed, loading, subscribe } = usePushNotifications();
  const { setBadge, clearBadge } = useAppBadge();

  useEffect(() => {
    loadNotifications();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const setupRealtimeSubscription = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const channel = supabase
        .channel('notifications-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userData.user.id}`,
          },
          () => {
            loadNotifications();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userData.user.id}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupRealtimeSubscription();

    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, []);

  useEffect(() => {
    setBadge(unreadCount);
  }, [unreadCount, setBadge]);

  const loadNotifications = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('source_app', 'reporta')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.read).length || 0);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userData.user.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      clearBadge();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleEnablePushNotifications = async () => {
    if (!isSubscribed) {
      await subscribe();
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "w-8 h-8 rounded-full flex items-center justify-center";

    switch (type) {
      case 'ai_limit_100':
        return (
          <div className={`${iconClass} bg-red-100 text-red-600`}>
            <AlertCircle className="w-5 h-5" />
          </div>
        );
      case 'ai_limit_80':
        return (
          <div className={`${iconClass} bg-orange-100 text-orange-600`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      case 'ai_limit_50':
        return (
          <div className={`${iconClass} bg-yellow-100 text-yellow-600`}>
            <Info className="w-5 h-5" />
          </div>
        );
      case 'ai_limit_renewed':
        return (
          <div className={`${iconClass} bg-green-100 text-green-600`}>
            <RefreshCw className="w-5 h-5" />
          </div>
        );
      case 'limit_request_approved':
        return (
          <div className={`${iconClass} bg-green-100 text-green-600`}>
            <CheckCircle className="w-5 h-5" />
          </div>
        );
      case 'limit_request_rejected':
        return (
          <div className={`${iconClass} bg-red-100 text-red-600`}>
            <XCircle className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className={`${iconClass} bg-blue-100 text-blue-600`}>
            <Info className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-w-[calc(100vw-2rem)]">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Notificaciones</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>
            {isSupported && (
              <div>
                {isSubscribed ? (
                  <div className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm bg-green-50 text-green-700">
                    <Bell className="w-4 h-4" />
                    <span>Notificaciones Push Activas</span>
                  </div>
                ) : (
                  <button
                    onClick={handleEnablePushNotifications}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <BellOff className="w-4 h-4" />
                    <span>{loading ? 'Activando...' : 'Activar Notificaciones'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-gray-900 text-sm break-words">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-blue-600 hover:text-blue-700 flex-shrink-0"
                              title="Marcar como leída"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 break-words whitespace-normal">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {formatDistanceToNow(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}