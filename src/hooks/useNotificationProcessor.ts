import { useAuth } from '../contexts/AuthContext';

// In the central architecture, notifications are inserted directly to the
// notifications table via createInAppNotification — no queue processing needed.
export function useNotificationProcessor() {
  useAuth(); // keep hook signature compatible with callers
}
