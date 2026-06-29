import { useState, useRef, useEffect } from 'react';
import { Brain, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAIUsage } from '../../hooks/useAIUsage';
import { AIUsageDashboard } from './AIUsageDashboard';
import { RequestLimitModal } from './RequestLimitModal';

export function AIUsageIcon() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { usage: aiUsage, loading } = useAIUsage(user?.company_id || null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user || user.role !== 'sst_manager' || loading || !aiUsage) {
    return null;
  }

  const getIconColor = () => {
    if (!aiUsage.enabled) return 'text-gray-400';
    switch (aiUsage.status) {
      case 'exceeded':
        return 'text-red-600';
      case 'warning':
        return 'text-orange-600';
      case 'caution':
        return 'text-yellow-600';
      default:
        return 'text-green-600';
    }
  };

  const getBadgeColor = () => {
    if (!aiUsage.enabled) return 'bg-gray-400';
    switch (aiUsage.status) {
      case 'exceeded':
        return 'bg-red-600';
      case 'warning':
        return 'bg-orange-600';
      case 'caution':
        return 'bg-yellow-600';
      default:
        return 'bg-green-600';
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
          title="Uso de IA"
        >
          <Brain className={`w-5 h-5 ${getIconColor()}`} />
          {aiUsage.enabled && aiUsage.status !== 'ok' && (
            <span className={`absolute top-1 right-1 w-2 h-2 ${getBadgeColor()} rounded-full animate-pulse`}></span>
          )}
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[200] sm:hidden"
              onClick={() => setIsOpen(false)}
            />
            <div className="fixed inset-0 z-[201] sm:fixed sm:inset-auto sm:right-4 sm:top-16 sm:w-96 sm:z-[201]">
              <div className="h-full sm:h-auto bg-white sm:rounded-lg sm:shadow-xl border-t sm:border border-gray-200 overflow-y-auto sm:max-h-[calc(100vh-80px)]">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sm:hidden z-10">
                  <h2 className="text-lg font-semibold text-gray-900">Uso de IA</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4">
                  <AIUsageDashboard onRequestLimitIncrease={() => {
                    setShowRequestModal(true);
                    setIsOpen(false);
                  }} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showRequestModal && user && aiUsage && (
        <RequestLimitModal
          isOpen={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          currentUsage={aiUsage}
          companyId={user.company_id}
        />
      )}
    </>
  );
}
