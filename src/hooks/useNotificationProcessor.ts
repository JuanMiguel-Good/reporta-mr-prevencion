import { useEffect } from 'react';
import { processNotificationQueue } from '../utils/notificationHelper';
import { useAuth } from '../contexts/AuthContext';

export function useNotificationProcessor() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const processQueue = async () => {
      try {
        await processNotificationQueue();
      } catch (error) {
        console.error('Error processing notification queue:', error);
      }
    };

    processQueue();

    const interval = setInterval(processQueue, 30000);

    return () => clearInterval(interval);
  }, [user]);
}
