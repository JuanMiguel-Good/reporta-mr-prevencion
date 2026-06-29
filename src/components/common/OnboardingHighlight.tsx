import { ReactNode } from 'react';

interface OnboardingHighlightProps {
  id: string;
  isActive: boolean;
  children: ReactNode;
}

export function OnboardingHighlight({ id, isActive, children }: OnboardingHighlightProps) {
  return (
    <div data-onboarding={id}>
      {children}
    </div>
  );
}
