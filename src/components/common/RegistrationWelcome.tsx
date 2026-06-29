import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { WelcomePlanModal } from './WelcomePlanModal';
import { MoreVertical } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description: string;
  monthly_limit: number;
  monthly_price: number;
  ai_enabled: boolean;
  ai_monthly_limit: number;
}

export function RegistrationWelcome() {
  const [showModal, setShowModal] = useState(false);
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [assignedPlan, setAssignedPlan] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const checkWelcomeFlag = async () => {
      const shouldShow = localStorage.getItem('show_welcome_modal');
      const planName = localStorage.getItem('assigned_plan');

      if (shouldShow === 'true' && planName) {
        const { data } = await supabase
          .from('plans')
          .select('*')
          .eq('active', true)
          .order('monthly_price');

        if (data) {
          setPlans(data);
          setAssignedPlan(planName);
          setShowModal(true);
        }
      }
    };

    checkWelcomeFlag();
  }, []);

  const handleClose = () => {
    localStorage.removeItem('show_welcome_modal');
    localStorage.removeItem('assigned_plan');
    setShowModal(false);
    setTimeout(() => {
      const menuButton = document.querySelector('[data-onboarding="menu-button"]') as HTMLButtonElement;
      if (menuButton) {
        menuButton.click();
      }
      setTimeout(() => {
        setShowHelpTooltip(true);
      }, 100);
    }, 500);
  };

  const handleCloseTooltip = () => {
    setShowHelpTooltip(false);
  };

  if (showHelpTooltip) {
    const helpButton = document.querySelector('[data-onboarding="menu-button"]');
    if (helpButton) {
      const rect = helpButton.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;

      const spotlightPadding = 12;
      const spotlightRect = {
        x: rect.left - spotlightPadding,
        y: rect.top - spotlightPadding,
        width: rect.width + spotlightPadding * 2,
        height: rect.height + spotlightPadding * 2,
      };

      return (
        <>
          <svg
            className="fixed inset-0 z-40 pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              <mask id="help-spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={spotlightRect.x}
                  y={spotlightRect.y}
                  width={spotlightRect.width}
                  height={spotlightRect.height}
                  rx="8"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.6)"
              mask="url(#help-spotlight-mask)"
            />
            <rect
              x={spotlightRect.x}
              y={spotlightRect.y}
              width={spotlightRect.width}
              height={spotlightRect.height}
              rx="8"
              fill="none"
              stroke="rgba(59, 130, 246, 0.9)"
              strokeWidth="3"
              className="animate-pulse"
            />
          </svg>

          <div
            className="fixed inset-0 z-40"
            onClick={handleCloseTooltip}
            style={{ background: 'transparent' }}
          />

          <div
            className="fixed z-50 bg-white rounded-xl shadow-2xl p-5 max-w-[320px] sm:max-w-[360px] animate-in fade-in slide-in-from-top-2 duration-300"
            style={{
              top: isMobile ? `${rect.bottom + 16}px` : `${rect.bottom + 12}px`,
              right: isMobile ? '16px' : `${window.innerWidth - rect.right}px`,
            }}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <MoreVertical className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">
                  ¿Necesitas ayuda?
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  En este menú encontrarás la <strong>Guía Rápida</strong> para ver el uso de Reporta y <strong>Contactar Soporte</strong> si tienes alguna consulta.
                </p>
              </div>
            </div>
            <button
              onClick={handleCloseTooltip}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Entendido
            </button>
          </div>
        </>
      );
    }
  }

  if (!showModal || plans.length === 0) {
    return null;
  }

  return (
    <WelcomePlanModal
      isOpen={showModal}
      onClose={handleClose}
      plans={plans}
      assignedPlanName={assignedPlan}
    />
  );
}
