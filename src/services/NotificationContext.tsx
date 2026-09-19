import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppNotification, NotificationType, AppNotificationTarget } from '../types/notification.ts';
import { useSystemSettings } from './SettingsContext.tsx';
import { playGentleNotificationTone, isAudioGloballyMuted } from './NotificationAudio.ts';

const NOTIFICATIONS_STORAGE_KEY = 'soli_icu_notifications_queue_v2';
const MAX_NOTIFICATIONS = 20;

interface TriggerNotificationParams {
  type: NotificationType;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  target?: AppNotificationTarget;
  forceVisual?: boolean;
  forceAudio?: boolean;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  activeBanner: AppNotification | null;
  triggerNotification: (params: TriggerNotificationParams) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  dismissBanner: () => void;
  handleNotificationClick: (notif: AppNotification) => void;
  setNavigationHandler: (handler: (target: AppNotificationTarget) => void) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

function loadSavedNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_NOTIFICATIONS);
    }
  } catch (err) {
    console.error('Failed to load notifications from storage:', err);
  }
  return [];
}

function saveNotificationsToStorage(list: AppNotification[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_NOTIFICATIONS)));
  } catch (err) {
    console.error('Failed to save notifications to storage:', err);
  }
}

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings } = useSystemSettings();
  const [notifications, setNotifications] = useState<AppNotification[]>(loadSavedNotifications);
  const [activeBanner, setActiveBanner] = useState<AppNotification | null>(null);
  const [navHandler, setNavHandler] = useState<((target: AppNotificationTarget) => void) | null>(null);

  // Sync to storage
  useEffect(() => {
    saveNotificationsToStorage(notifications);
  }, [notifications]);

  // Auto-dismiss top visual banner after 2.8 seconds (2 to 3 seconds as requested)
  useEffect(() => {
    if (!activeBanner) return;
    const timer = setTimeout(() => {
      setActiveBanner(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [activeBanner]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Single chime on reload/startup IF and ONLY IF there are unread notifications
  const hasTriggeredStartupChimeRef = useRef(false);
  useEffect(() => {
    if (hasTriggeredStartupChimeRef.current) return;
    hasTriggeredStartupChimeRef.current = true;

    // Strict user rule: Only play ONE single notification chime on reload if there are unread notifications
    // If unread is 0 or if muted, absolutely no sound should play!
    const isMuted = settings.notifications.isMuted || isAudioGloballyMuted();
    if (unreadCount > 0 && !isMuted && settings.notifications.masterAudio) {
      const timer = setTimeout(() => {
        playGentleNotificationTone('CRITICAL_TELEMETRY');
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [unreadCount, settings.notifications.isMuted, settings.notifications.masterAudio]);

  const setNavigationHandler = useCallback((handler: (target: AppNotificationTarget) => void) => {
    setNavHandler(() => handler);
  }, []);

  const triggerNotification = useCallback(
    ({
      type,
      titleEn,
      titleAr,
      messageEn,
      messageAr,
      target,
      forceVisual = false,
      forceAudio = false,
    }: TriggerNotificationParams) => {
      const notifSettings = settings.notifications;
      const isMuted = notifSettings.isMuted || isAudioGloballyMuted();

      // Deduplicate rapid identical triggers within 6 seconds
      const now = Date.now();
      const isDuplicate = notifications.slice(0, 5).some((n) => {
        const timeDiff = now - new Date(n.timestamp).getTime();
        return (
          timeDiff < 6000 &&
          n.type === type &&
          n.target?.bedNumber === target?.bedNumber &&
          n.titleEn === titleEn
        );
      });
      if (isDuplicate) {
        return;
      }

      // Determine which event key in settings this belongs to
      let eventKey: keyof typeof notifSettings.events = 'admission';
      if (type === 'ADMISSION') eventKey = 'admission';
      else if (type === 'DISCHARGE' || type === 'DEATH' || type === 'TRANSFER') eventKey = 'discharge';
      else if (type === 'SBAR_HANDOVER') eventKey = 'sbarHandover';
      else if (type === 'SBAR_RECEIVED') eventKey = 'sbarReceived';
      else if (type === 'ISOLATION_CHANGE') eventKey = 'isolationChange';
      else if (type === 'CRITICAL_TELEMETRY') eventKey = 'criticalTelemetry';

      const eventConfig = notifSettings.events[eventKey] || { visual: true, audio: true };

      const shouldShowVisual = forceVisual || (notifSettings.masterVisual && eventConfig.visual);
      // Strict mute: if muted, NEVER play audio!
      const shouldPlayAudio =
        !isMuted && (forceAudio || (notifSettings.masterAudio && eventConfig.audio));

      const newNotif: AppNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        titleEn,
        titleAr,
        messageEn,
        messageAr,
        timestamp: new Date().toISOString(),
        read: false,
        target,
      };

      // 1. Play gentle audio tone (if not muted)
      if (shouldPlayAudio) {
        playGentleNotificationTone(type);
      }

      // 2. Show top banner if visual enabled
      if (shouldShowVisual) {
        setActiveBanner(newNotif);
      }

      // 3. Add to notifications queue (Max 20 items, newest first, auto-prune)
      setNotifications((prev) => {
        const updated = [newNotif, ...prev.filter((p) => p.id !== newNotif.id)];
        return updated.slice(0, MAX_NOTIFICATIONS);
      });
    },
    [settings.notifications, notifications]
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissBanner = useCallback(() => {
    setActiveBanner(null);
  }, []);

  const handleNotificationClick = useCallback(
    (notif: AppNotification) => {
      // Mark as read immediately on click
      markAsRead(notif.id);
      setActiveBanner(null);

      // Trigger navigation if target is set
      if (notif.target && navHandler) {
        navHandler(notif.target);
      }
    },
    [markAsRead, navHandler]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeBanner,
        triggerNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        dismissBanner,
        handleNotificationClick,
        setNavigationHandler,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useAppNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useAppNotifications must be used within a NotificationProvider');
  }
  return context;
}
