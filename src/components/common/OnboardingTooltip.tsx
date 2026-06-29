import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { OnboardingStep } from '../../hooks/useOnboarding';

interface OnboardingTooltipProps {
  step: OnboardingStep;
  onNext: () => void;
  onSkip: () => void;
  isLastStep: boolean;
  currentStepNumber: number;
  totalSteps: number;
}

export function OnboardingTooltip({
  step,
  onNext,
  onSkip,
  isLastStep,
  currentStepNumber,
  totalSteps
}: OnboardingTooltipProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const targetElement = document.querySelector(`[data-onboarding="${step.target}"]`);

    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);

      const isMobile = window.innerWidth < 640;
      const tooltipWidth = isMobile ? window.innerWidth - 32 : 360;
      const padding = 16;

      let top = 0;
      let left = 0;

      if (isMobile) {
        if (rect.top > window.innerHeight / 2) {
          top = rect.top - 200;
          left = padding;
        } else {
          top = rect.bottom + padding;
          left = padding;
        }
      } else {
        if (rect.bottom + 220 > window.innerHeight) {
          top = rect.top - 200;
        } else {
          top = rect.bottom + padding;
        }
        left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
      }

      top = Math.max(padding, Math.min(top, window.innerHeight - 220));

      setPosition({ top, left });
      setTimeout(() => setVisible(true), 100);
    }
  }, [step]);

  if (!visible || !targetRect) return null;

  const spotlightPadding = 12;
  const spotlightRect = {
    x: targetRect.left - spotlightPadding,
    y: targetRect.top - spotlightPadding,
    width: targetRect.width + spotlightPadding * 2,
    height: targetRect.height + spotlightPadding * 2,
  };

  return (
    <>
      <svg
        className="fixed inset-0 z-40 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={spotlightRect.x}
              y={spotlightRect.y}
              width={spotlightRect.width}
              height={spotlightRect.height}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
        />
        <rect
          x={spotlightRect.x}
          y={spotlightRect.y}
          width={spotlightRect.width}
          height={spotlightRect.height}
          rx="12"
          fill="none"
          stroke="rgba(59, 130, 246, 0.9)"
          strokeWidth="4"
        />
      </svg>

      <div
        className="fixed inset-0 z-40"
        onClick={onSkip}
        style={{ background: 'transparent' }}
      />

      <div
        className="fixed z-50 bg-white rounded-xl shadow-2xl p-5 max-w-[calc(100vw-32px)] sm:w-[360px] animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
      >
        <button
          onClick={onSkip}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pr-6 mb-3">
          <p className="text-sm text-gray-700 leading-relaxed">
            {step.content}
          </p>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">
              {currentStepNumber} de {totalSteps}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < currentStepNumber
                      ? 'w-4 bg-blue-500'
                      : 'w-1.5 bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onSkip}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors font-medium px-2"
            >
              Omitir
            </button>
            <button
              onClick={onNext}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
            >
              {isLastStep ? 'Finalizar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
