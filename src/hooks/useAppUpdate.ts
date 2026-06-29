import { useState, useEffect } from 'react';

interface AppUpdateState {
  updateAvailable: boolean;
  showPrompt: boolean;
  updateAndReload: () => void;
  dismissUpdate: () => void;
}

const UPDATE_DISMISSED_KEY = 'update_dismissed_timestamp';
const UPDATE_DETECTED_KEY = 'update_detected_timestamp';
const DISMISS_DURATION = 2 * 60 * 60 * 1000;

export function useAppUpdate(): AppUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = (event: CustomEvent) => {
      console.log('Update available event received');
      setUpdateAvailable(true);

      const dismissedTime = localStorage.getItem(UPDATE_DISMISSED_KEY);
      const now = Date.now();

      if (dismissedTime) {
        const timeSinceDismissed = now - parseInt(dismissedTime, 10);
        if (timeSinceDismissed < DISMISS_DURATION) {
          console.log('Update dismissed recently, not showing prompt yet');
          return;
        }
      }

      localStorage.setItem(UPDATE_DETECTED_KEY, now.toString());
      setShowPrompt(true);
    };

    window.addEventListener('app-update-available', handleUpdateAvailable as EventListener);

    return () => {
      window.removeEventListener('app-update-available', handleUpdateAvailable as EventListener);
    };
  }, []);

  const updateAndReload = () => {
    console.log('User requested app update');
    localStorage.removeItem(UPDATE_DISMISSED_KEY);
    localStorage.removeItem(UPDATE_DETECTED_KEY);

    const event = new CustomEvent('app-update-reload');
    window.dispatchEvent(event);

    setShowPrompt(false);
  };

  const dismissUpdate = () => {
    console.log('User dismissed update');
    const now = Date.now();
    localStorage.setItem(UPDATE_DISMISSED_KEY, now.toString());
    setShowPrompt(false);
  };

  return {
    updateAvailable,
    showPrompt,
    updateAndReload,
    dismissUpdate,
  };
}
