import { useState, useEffect } from 'react';

export interface OnboardingStep {
  target: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const ONBOARDING_STEPS: Record<string, OnboardingStep[]> = {
  worker: [
    {
      target: 'camera-button',
      content: 'Toca el botón de cámara para reportar. El asistente automático te ayudará con la descripción',
      position: 'top'
    }
  ],
  sst_manager: [
    {
      target: 'gallery-button',
      content: 'Revisa reportes en la galería',
      position: 'top'
    },
    {
      target: 'report-card',
      content: 'Asigna responsables y fecha de cierre',
      position: 'bottom'
    },
    {
      target: 'status-button',
      content: 'Marca como resuelto cuando esté listo',
      position: 'bottom'
    }
  ],
  hr_observer: [
    {
      target: 'metrics-button',
      content: 'Visualiza todos los reportes y métricas',
      position: 'top'
    },
    {
      target: 'excel-button',
      content: 'Descarga datos en Excel desde Métricas',
      position: 'bottom'
    }
  ],
  super_admin: [
    {
      target: 'gallery-button',
      content: 'Revisa reportes en la galería',
      position: 'top'
    },
    {
      target: 'users-button',
      content: 'Gestiona usuarios y permisos',
      position: 'top'
    }
  ]
};

export function useOnboarding(role: string | undefined) {
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isCompleted, setIsCompleted] = useState<boolean>(true);
  const [showWelcome, setShowWelcome] = useState<boolean>(false);

  const steps = role ? ONBOARDING_STEPS[role] || [] : [];

  useEffect(() => {
    if (role) {
      const completed = localStorage.getItem(`onboarding_completed_${role}`) === 'true';
      setIsCompleted(completed);
      if (!completed) {
        setShowWelcome(true);
      }
    }
  }, [role]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  const completeOnboarding = () => {
    if (role) {
      localStorage.setItem(`onboarding_completed_${role}`, 'true');
      setIsCompleted(true);
      setCurrentStep(-1);
      setShowWelcome(false);
    }
  };

  const startTour = () => {
    setShowWelcome(false);
    setCurrentStep(0);
  };

  const skipTour = () => {
    completeOnboarding();
  };

  const resetOnboarding = () => {
    if (role) {
      localStorage.removeItem(`onboarding_completed_${role}`);
      setIsCompleted(false);
      setShowWelcome(true);
      setCurrentStep(-1);
    }
  };

  return {
    currentStep,
    steps,
    isActive: !isCompleted && currentStep >= 0,
    showWelcome: !isCompleted && showWelcome,
    currentStepData: steps[currentStep] || null,
    nextStep,
    skipOnboarding,
    resetOnboarding,
    startTour,
    skipTour,
    isCompleted
  };
}
