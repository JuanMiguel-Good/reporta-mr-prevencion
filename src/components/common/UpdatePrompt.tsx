import { RefreshCw, X } from 'lucide-react';
import { useAppUpdate } from '../../hooks/useAppUpdate';

export function UpdatePrompt() {
  const { showPrompt, updateAndReload, dismissUpdate } = useAppUpdate();

  if (!showPrompt) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Nueva versión disponible</p>
                <p className="text-xs text-blue-100 mt-0.5">Actualiza ahora para obtener las últimas mejoras</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={updateAndReload}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-semibold shadow-sm"
              >
                Actualizar
              </button>
              <button
                onClick={dismissUpdate}
                className="p-2 text-blue-100 hover:text-white hover:bg-blue-600 rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
