import { useEffect, useCallback } from 'react';

export function useAppBadge() {
  const isSupported = 'setAppBadge' in navigator && 'clearAppBadge' in navigator;

  const setBadge = useCallback(async (count: number) => {
    if (!isSupported) return;

    try {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    } catch (error) {
      console.error('Error setting app badge:', error);
    }
  }, [isSupported]);

  const clearBadge = useCallback(async () => {
    if (!isSupported) return;

    try {
      await navigator.clearAppBadge();
    } catch (error) {
      console.error('Error clearing app badge:', error);
    }
  }, [isSupported]);

  useEffect(() => {
    return () => {
      if (isSupported) {
        navigator.clearAppBadge().catch(() => {});
      }
    };
  }, [isSupported]);

  return {
    isSupported,
    setBadge,
    clearBadge
  };
}
