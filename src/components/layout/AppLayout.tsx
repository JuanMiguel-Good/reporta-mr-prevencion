import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Camera, Grid3x3, Users, LogOut, BarChart3, X, Settings, Building2, HelpCircle, MessageCircle, MoreVertical, Brain, Megaphone, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NetworkStatusBanner } from '../common/NetworkStatusBanner';
import { UpdatePrompt } from '../common/UpdatePrompt';
import { InstallPrompt } from '../common/InstallPrompt';
import { NotificationBell } from '../notifications/NotificationBell';
import { PushNotificationPrompt } from '../notifications/PushNotificationPrompt';
import { syncService } from '../../utils/syncService';
import { useNotificationProcessor } from '../../hooks/useNotificationProcessor';
import { useOnboarding } from '../../hooks/useOnboarding';
import { OnboardingTooltip } from '../common/OnboardingTooltip';
import { OnboardingHighlight } from '../common/OnboardingHighlight';
import { WelcomeModal } from '../common/WelcomeModal';
import { useAIUsage } from '../../hooks/useAIUsage';
import { AIUsageDashboard } from '../ai/AIUsageDashboard';
import { RequestLimitModal } from '../ai/RequestLimitModal';
import { offlineStorage } from '../../utils/offlineStorage';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useNotificationProcessor();
  const {
    isActive,
    currentStepData,
    nextStep,
    skipOnboarding,
    currentStep,
    steps,
    showWelcome,
    startTour,
    skipTour
  } = useOnboarding(user?.role);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const { usage: aiUsage, loading: loadingAI } = useAIUsage(user?.company_id || null);

  useEffect(() => {
    if (user && user.role !== 'super_admin' && user.company_id) {
      syncService.startAutoSync(user.company_id, user.id);
    }
  }, [user]);

  useEffect(() => {
    const updatePendingCount = async () => {
      const count = await offlineStorage.getPendingCount();
      setPendingCount(count);
    };

    updatePendingCount();

    const interval = setInterval(updatePendingCount, 5000);

    const handleSynced = () => {
      updatePendingCount();
    };

    window.addEventListener('reports-synced', handleSynced);

    return () => {
      clearInterval(interval);
      window.removeEventListener('reports-synced', handleSynced);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getNavItems = () => {
    if (user.role === 'super_admin') {
      return [
        {
          icon: Building2,
          label: 'Empresas',
          path: '/companies',
          show: true,
          onboardingId: 'companies-button',
        },
        {
          icon: Megaphone,
          label: 'Anuncios',
          path: '/announcements',
          show: true,
          onboardingId: 'announcements-button',
        },
        {
          icon: TrendingUp,
          label: 'Analytics',
          path: '/analytics',
          show: true,
          onboardingId: 'analytics-button',
        },
      ];
    }

    const baseItems = [
      { icon: Grid3x3, label: 'Galería', path: '/gallery', show: user.role !== 'super_admin', onboardingId: 'gallery-button', isPrimary: false },
    ];

    if (user.role === 'sst_manager') {
      baseItems.push(
        {
          icon: Users,
          label: 'Usuarios',
          path: '/users',
          show: true,
          onboardingId: 'users-button',
          isPrimary: false,
        },
        { icon: Camera, label: 'Reportar', path: '/camera', show: true, onboardingId: 'camera-button', isPrimary: true },
        {
          icon: Settings,
          label: 'Configuración',
          path: '/configuration',
          show: true,
          onboardingId: 'configuration-button',
          isPrimary: false,
        },
        {
          icon: BarChart3,
          label: 'Métricas',
          path: '/metrics',
          show: true,
          onboardingId: 'metrics-button',
          isPrimary: false,
        }
      );
    } else if (user.role === 'hr_observer') {
      baseItems.push(
        { icon: Camera, label: 'Reportar', path: '/camera', show: true, onboardingId: 'camera-button', isPrimary: true },
        {
          icon: Settings,
          label: 'Configuración',
          path: '/configuration',
          show: true,
          onboardingId: 'configuration-button',
          isPrimary: false,
        },
        {
          icon: BarChart3,
          label: 'Métricas',
          path: '/metrics',
          show: true,
          onboardingId: 'metrics-button',
          isPrimary: false,
        }
      );
    } else {
      baseItems.push({ icon: Camera, label: 'Reportar', path: '/camera', show: true, onboardingId: 'camera-button', isPrimary: true });
    }

    return baseItems.filter((item) => item.show);
  };

  const navItems = getNavItems();

  const handleHelpClick = () => {
    const userName = user.full_name || 'Usuario';
    const companyName = user.company?.name || 'Sin empresa';
    const message = `Hola, soy ${userName} de ${companyName}. Vengo de la app Reporta y necesito ayuda.`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/51962342328?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const getAIIconColor = () => {
    if (!aiUsage || !aiUsage.enabled) return 'text-gray-400';
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

  const getAIBadgeColor = () => {
    if (!aiUsage || !aiUsage.enabled) return 'bg-gray-400';
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
    <div className="min-h-screen bg-gray-50 pb-20">
      <UpdatePrompt />
      <NetworkStatusBanner />
      <InstallPrompt />
      <PushNotificationPrompt />
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Reporta</h1>
            <p className="text-xs text-gray-600">{user.full_name}</p>
            {user.company && (
              <p className="text-xs text-gray-500 font-medium">{user.company.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user.role !== 'super_admin' && (
              <NotificationBell />
            )}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                title="Menú"
                data-onboarding="menu-button"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {user.role === 'sst_manager' && !loadingAI && aiUsage && (
                    <>
                      <button
                        onClick={() => {
                          setIsAIPanelOpen(true);
                          setIsMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors relative"
                      >
                        <div className="relative">
                          <Brain className={`w-5 h-5 ${getAIIconColor()}`} />
                          {aiUsage.enabled && aiUsage.status !== 'ok' && (
                            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 ${getAIBadgeColor()} rounded-full animate-pulse`}></span>
                          )}
                        </div>
                        <span className="text-sm font-medium">Uso de IA</span>
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                    </>
                  )}

                  <button
                    onClick={() => {
                      navigate('/help');
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    data-onboarding="help-button"
                  >
                    <HelpCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Guía rápida</span>
                  </button>

                  <button
                    onClick={() => {
                      handleHelpClick();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Contactar soporte</span>
                  </button>

                  <div className="border-t border-gray-200 my-1"></div>

                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-40">
        <div className="max-w-7xl mx-auto px-2 py-2.5">
          <div className="flex items-stretch justify-around gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isHighlighted = isActive && currentStepData?.target === item.onboardingId;
              const isPrimary = (item as any).isPrimary === true;

              const getPrimaryButtonClasses = () => {
                const baseClasses = 'flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200';
                const sizeClasses = user.role === 'worker'
                  ? 'px-6 py-2.5'
                  : user.role === 'sst_manager'
                  ? 'px-5 py-2.5'
                  : 'px-4 py-2';

                const colorClasses = isActive
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-red-500 text-white shadow-md hover:bg-red-600 hover:shadow-lg';

                return `${baseClasses} ${sizeClasses} ${colorClasses}`;
              };

              if (isPrimary) {
                return (
                  <OnboardingHighlight
                    key={item.path}
                    id={item.onboardingId}
                    isActive={isHighlighted}
                  >
                    <button
                      onClick={() => navigate(item.path)}
                      className={getPrimaryButtonClasses()}
                      aria-label="Crear nuevo reporte de seguridad"
                    >
                      <Camera className="w-6 h-6" />
                      <span className="text-[11px] font-semibold whitespace-nowrap">{item.label}</span>
                    </button>
                  </OnboardingHighlight>
                );
              }

              return (
                <OnboardingHighlight
                  key={item.path}
                  id={item.onboardingId}
                  isActive={isHighlighted}
                >
                  <button
                    onClick={() => navigate(item.path)}
                    className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors relative ${
                      isActive
                        ? 'text-red-600 bg-red-50'
                        : 'text-gray-500 hover:text-red-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="relative">
                      <Icon className="w-6 h-6" />
                      {item.path === '/gallery' && pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                          {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
                  </button>
                </OnboardingHighlight>
              );
            })}
          </div>
        </div>
      </nav>

      {showWelcome && user?.role && (
        <WelcomeModal
          role={user.role}
          onStartTour={startTour}
          onSkip={skipTour}
        />
      )}

      {isActive && currentStepData && (
        <OnboardingTooltip
          step={currentStepData}
          onNext={nextStep}
          onSkip={skipOnboarding}
          isLastStep={currentStep === steps.length - 1}
          currentStepNumber={currentStep + 1}
          totalSteps={steps.length}
        />
      )}

      {isAIPanelOpen && (
        <>
          <div
            className="fixed inset-0 z-[200] sm:hidden bg-black bg-opacity-50"
            onClick={() => setIsAIPanelOpen(false)}
          />
          <div className="fixed inset-0 z-[201] sm:fixed sm:inset-auto sm:right-4 sm:top-16 sm:w-96 sm:z-[201]">
            <div className="h-full sm:h-auto bg-white sm:rounded-lg sm:shadow-xl border-t sm:border border-gray-200 overflow-y-auto sm:max-h-[calc(100vh-80px)]">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sm:hidden z-10">
                <h2 className="text-lg font-semibold text-gray-900">Uso de IA</h2>
                <button
                  onClick={() => setIsAIPanelOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4">
                <AIUsageDashboard onRequestLimitIncrease={() => {
                  setShowRequestModal(true);
                  setIsAIPanelOpen(false);
                }} />
              </div>
            </div>
          </div>
        </>
      )}

      {showRequestModal && user && aiUsage && (
        <RequestLimitModal
          isOpen={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          currentUsage={aiUsage}
          companyId={user.company_id}
        />
      )}
    </div>
  );
}
