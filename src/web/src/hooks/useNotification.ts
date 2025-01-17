import { useState, useCallback, useEffect, useMemo } from 'react'; // v18.0.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Types and Interfaces
export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type ThemeMode = 'light' | 'dark' | 'high-contrast';

export interface INotification {
  id: string;
  type: NotificationType;
  message: string;
  duration: number;
  timestamp: number;
  ariaLive: 'polite' | 'assertive';
  isPaused: boolean;
  theme: ThemeMode;
  priority: number;
}

export type ShowNotificationOptions = {
  type: NotificationType;
  message: string;
  duration?: number;
  priority?: number;
  theme?: ThemeMode;
  ariaLive?: 'polite' | 'assertive';
};

// Constants
const DEFAULT_NOTIFICATION_DURATION = 5000;
const MAX_NOTIFICATIONS = 5;

const NOTIFICATION_PRIORITIES = {
  ERROR: 3,
  WARNING: 2,
  SUCCESS: 1,
  INFO: 0,
} as const;

const ARIA_LIVE_MAPPINGS = {
  ERROR: 'assertive',
  WARNING: 'assertive',
  SUCCESS: 'polite',
  INFO: 'polite',
} as const;

export const useNotification = () => {
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>('light');

  // Cleanup timers on unmount
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    notifications.forEach(notification => {
      if (!notification.isPaused) {
        const timer = setTimeout(() => {
          dismissNotification(notification.id);
        }, notification.duration);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications]);

  // Sort notifications by priority and timestamp
  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      if (a.priority === b.priority) {
        return b.timestamp - a.timestamp;
      }
      return b.priority - a.priority;
    });
  }, [notifications]);

  const showNotification = useCallback((options: ShowNotificationOptions) => {
    const {
      type,
      message,
      duration = DEFAULT_NOTIFICATION_DURATION,
      priority = NOTIFICATION_PRIORITIES[type.toUpperCase() as keyof typeof NOTIFICATION_PRIORITIES],
      theme = currentTheme,
      ariaLive = ARIA_LIVE_MAPPINGS[type.toUpperCase() as keyof typeof ARIA_LIVE_MAPPINGS],
    } = options;

    const newNotification: INotification = {
      id: uuidv4(),
      type,
      message,
      duration,
      timestamp: Date.now(),
      ariaLive,
      isPaused: false,
      theme,
      priority,
    };

    setNotifications(prev => {
      const updated = [...prev, newNotification];
      // Keep only the most recent MAX_NOTIFICATIONS, respecting priority
      return updated
        .sort((a, b) => b.priority - a.priority || b.timestamp - a.timestamp)
        .slice(0, MAX_NOTIFICATIONS);
    });
  }, [currentTheme]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const pauseNotification = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, isPaused: true }
          : notification
      )
    );
  }, []);

  const resumeNotification = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, isPaused: false }
          : notification
      )
    );
  }, []);

  const updateTheme = useCallback((theme: ThemeMode) => {
    setCurrentTheme(theme);
    // Update theme for all existing notifications
    setNotifications(prev =>
      prev.map(notification => ({
        ...notification,
        theme,
      }))
    );
  }, []);

  return {
    notifications: sortedNotifications,
    showNotification,
    dismissNotification,
    clearAllNotifications,
    pauseNotification,
    resumeNotification,
    updateTheme,
  };
};