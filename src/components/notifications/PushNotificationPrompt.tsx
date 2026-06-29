import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export function PushNotificationPrompt() {
  return null;
}

export function NotificationToggle() {
  const { isSupported, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isSubscribed
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isSubscribed ? (
        <>
          <Bell className="w-5 h-5" />
          <span>Notificaciones activas</span>
        </>
      ) : (
        <>
          <BellOff className="w-5 h-5" />
          <span>Activar notificaciones</span>
        </>
      )}
    </button>
  );
}
