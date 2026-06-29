import { useState } from 'react';
import { Bell, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function TestNotificationButton() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const sendTestNotification = async () => {
    if (!user) return;

    setLoading(true);
    setStatus('idle');

    try {
      const { data, error } = await supabase.rpc('send_test_notification', {
        target_user_id: user.id
      });

      if (error) throw error;

      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error('Error sending test notification:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={sendTestNotification}
      disabled={loading}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
        ${status === 'success'
          ? 'bg-green-600 text-white'
          : status === 'error'
          ? 'bg-red-600 text-white'
          : 'bg-blue-600 text-white hover:bg-blue-700'}
        ${loading ? 'opacity-50 cursor-not-allowed' : ''}
        min-h-[44px]
      `}
    >
      {status === 'success' ? (
        <>
          <Check className="w-5 h-5" />
          <span>Notificación Enviada</span>
        </>
      ) : status === 'error' ? (
        <>
          <AlertCircle className="w-5 h-5" />
          <span>Error al Enviar</span>
        </>
      ) : (
        <>
          <Bell className="w-5 h-5" />
          <span>{loading ? 'Enviando...' : 'Probar Notificación'}</span>
        </>
      )}
    </button>
  );
}
