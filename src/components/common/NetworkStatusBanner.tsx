import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { offlineStorage } from '../../utils/offlineStorage';

export function NetworkStatusBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [justCameOnline, setJustCameOnline] = useState(false);

  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const count = await offlineStorage.getPendingCount();
        setPendingCount(count);
      } catch (error) {
        console.error('Error getting pending count:', error);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
      setJustCameOnline(false);
    } else if (wasOffline && isOnline) {
      setJustCameOnline(true);
      setShowBanner(true);
      setTimeout(() => {
        setShowBanner(false);
        setJustCameOnline(false);
      }, 5000);
    }
  }, [isOnline, wasOffline]);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-white text-sm font-medium transition-all ${
        isOnline
          ? 'bg-green-600'
          : 'bg-amber-600'
      }`}
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="h-5 w-5" />
              <span>Conexión restaurada</span>
              {pendingCount > 0 && (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                  <span>Sincronizando {pendingCount} {pendingCount === 1 ? 'reporte' : 'reportes'}...</span>
                </>
              )}
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5" />
              <span>Modo Offline</span>
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {pendingCount} pendiente{pendingCount !== 1 && 's'}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
