import { useState, useCallback } from 'react';

interface ShareData {
  title?: string;
  text?: string;
  url?: string;
}

export function useWebShare() {
  const [isSupported, setIsSupported] = useState(() => {
    return typeof navigator !== 'undefined' && 'share' in navigator;
  });

  const share = useCallback(async (data: ShareData): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Web Share API not supported');
      return false;
    }

    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Share cancelled');
      } else {
        console.error('Error sharing:', error);
      }
      return false;
    }
  }, [isSupported]);

  return {
    isSupported,
    share,
  };
}
