import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { 
  collection, 
  doc, 
  setDoc as fsetDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { AppNotification, NotificationType, AppNotificationTarget } from '../types/notification.ts';
import { useSystemSettings } from './SettingsContext.tsx';
import { useAuth } from './AuthContext.tsx';
import { playGentleNotificationTone, isAudioGloballyMuted } from './NotificationAudio.ts';
import { firestore, sanitizeForFirestore, handleFirestoreError, OperationType } from './firebase.ts';

const NOTIFICATIONS_STORAGE_KEY = 'soli_icu_notifications_queue_v2';
const MAX_NOTIFICATIONS = 25;

export const ALLOWED_NOTIFICATION_TYPES: NotificationType[] = [
  'ADMISSION',
  'DISCHARGE',
  'SBAR_HANDOVER',
  'SBAR_RECEIVED',
  'ISOLATION_CHANGE',
];

function isWhitelistedType(type: any): type is NotificationType {
  return typeof type === 'string' && ALLOWED_NOTIFICATION_TYPES.includes(type as NotificationType);
}

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
      return parsed
        .filter((item: any) => item && isWhitelistedType(item.type))
        .slice(0, MAX_NOTIFICATIONS);
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
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>(loadSavedNotifications);
  const [activeBanner, setActiveBanner] = useState<AppNotification | null>(null);
  const [navHandler, setNavHandler] = useState<((target: AppNotificationTarget) => void) | null>(null);

  // Track locally triggered notification IDs to avoid echo audio/banner loops
  const locallyTriggeredIdsRef = useRef<Set<string>>(new Set());
  const isInitialSnapshotRef = useRef(true);

  // Sync to storage
  useEffect(() => {
    saveNotificationsToStorage(notifications);
  }, [notifications]);

  // Auto-dismiss top visual banner after 2.8 seconds
  useEffect(() => {
    if (!activeBanner) return;
    const timer = setTimeout(() => {
      setActiveBanner(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [activeBanner]);

  const unreadCount = notifications.filter((n) => !n.read && isWhitelistedType(n.type)).length;

  // Single chime on reload/startup IF and ONLY IF there are unread notifications
  const hasTriggeredStartupChimeRef = useRef(false);
  useEffect(() => {
    if (hasTriggeredStartupChimeRef.current) return;
    hasTriggeredStartupChimeRef.current = true;

    const isMuted = settings.notifications.isMuted || isAudioGloballyMuted();
    if (unreadCount > 0 && !isMuted && settings.notifications.masterAudio) {
      const firstUnread = notifications.find((n) => !n.read && isWhitelistedType(n.type));
      if (firstUnread) {
        let eventKey: keyof typeof settings.notifications.events = 'admission';
        if (firstUnread.type === 'ADMISSION') eventKey = 'admission';
        else if (firstUnread.type === 'DISCHARGE') eventKey = 'discharge';
        else if (firstUnread.type === 'SBAR_HANDOVER') eventKey = 'sbarHandover';
        else if (firstUnread.type === 'SBAR_RECEIVED') eventKey = 'sbarReceived';
        else if (firstUnread.type === 'ISOLATION_CHANGE') eventKey = 'isolationChange';

        const eventConfig = settings.notifications.events[eventKey] || { visual: true, audio: true };
        if (eventConfig.audio) {
          const timer = setTimeout(() => {
            playGentleNotificationTone(firstUnread.type);
          }, 700);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [unreadCount, notifications, settings.notifications]);

  // --------------------------------------------------------------------------
  // Real-Time Multi-User Clinical Notification Listener from Firestore
  // --------------------------------------------------------------------------
  useEffect(() => {
    isInitialSnapshotRef.current = true;

    if (!currentUser?.uid) {
      return;
    }

    try {
      const notifsCol = collection(firestore, 'notifications');
      const notifsQuery = query(notifsCol, orderBy('timestamp', 'desc'), limit(MAX_NOTIFICATIONS));

      const unsubscribe = onSnapshot(notifsQuery, (snapshot) => {
        const notifSettings = settings.notifications;
        const isMuted = notifSettings.isMuted || isAudioGloballyMuted();
        const now = Date.now();

        if (isInitialSnapshotRef.current) {
          isInitialSnapshotRef.current = false;
          const remoteList: AppNotification[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as AppNotification;
            if (isWhitelistedType(data?.type)) {
              remoteList.push({
                ...data,
                id: data.id || docSnap.id,
              });
            }
          });

          if (remoteList.length > 0) {
            setNotifications((prev) => {
              const readMap = new Map(prev.map(p => [p.id, p.read]));
              const merged = remoteList.map(r => ({
                ...r,
                read: readMap.has(r.id) ? readMap.get(r.id)! : r.read,
              }));
              return merged.filter(m => isWhitelistedType(m.type)).slice(0, MAX_NOTIFICATIONS);
            });
          } else {
            setNotifications((prev) => prev.filter(p => isWhitelistedType(p.type)));
          }
          return;
        }

        // Handle Real-Time Live Changes (From other clinicians / other sessions)
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const incoming = change.doc.data() as AppNotification;
            if (!isWhitelistedType(incoming?.type)) {
              return; // Ignore non-whitelisted item
            }

            const notifId = incoming.id || change.doc.id;
            const itemTime = new Date(incoming.timestamp).getTime();
            const ageMs = now - itemTime;

            // Check if this was NOT triggered locally and is fresh (less than 45 seconds old)
            if (!locallyTriggeredIdsRef.current.has(notifId) && ageMs < 45000) {
              let eventKey: keyof typeof notifSettings.events = 'admission';
              if (incoming.type === 'ADMISSION') eventKey = 'admission';
              else if (incoming.type === 'DISCHARGE') eventKey = 'discharge';
              else if (incoming.type === 'SBAR_HANDOVER') eventKey = 'sbarHandover';
              else if (incoming.type === 'SBAR_RECEIVED') eventKey = 'sbarReceived';
              else if (incoming.type === 'ISOLATION_CHANGE') eventKey = 'isolationChange';

              const eventConfig = notifSettings.events[eventKey] || { visual: true, audio: true };
              const shouldShowVisual = notifSettings.masterVisual && eventConfig.visual;
              const shouldPlayAudio = !isMuted && notifSettings.masterAudio && eventConfig.audio;

              if (shouldPlayAudio) {
                playGentleNotificationTone(incoming.type);
              }
              if (shouldShowVisual) {
                setActiveBanner(incoming);
              }
            }
          }
        });

        // Update local state with latest snapshot list (filtered by whitelist)
        const incomingDocs: AppNotification[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as AppNotification;
          if (isWhitelistedType(data?.type)) {
            incomingDocs.push({
              ...data,
              id: data.id || docSnap.id,
            });
          }
        });

        setNotifications((prev) => {
          const readMap = new Map(prev.map(p => [p.id, p.read]));
          const merged = incomingDocs.map(r => ({
            ...r,
            read: readMap.has(r.id) ? readMap.get(r.id)! : r.read,
          }));
          return merged.filter(m => isWhitelistedType(m.type)).slice(0, MAX_NOTIFICATIONS);
        });
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'notifications');
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Could not initialize notifications Firestore listener:', e);
    }
  }, [settings.notifications, currentUser?.uid]);

  const setNavigationHandler = useCallback((handler: (target: AppNotificationTarget) => void) => {
    setNavHandler(() => handler);
  }, []);

  const triggerNotification = useCallback(
    async ({
      type,
      titleEn,
      titleAr,
      messageEn,
      messageAr,
      target,
      forceVisual = false,
      forceAudio = false,
    }: TriggerNotificationParams) => {
      // Strict Runtime Whitelist Check
      if (!isWhitelistedType(type)) {
        console.warn(`[NotificationContext] Blocked non-whitelisted notification type: ${type}`);
        return;
      }

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

      let eventKey: keyof typeof notifSettings.events = 'admission';
      if (type === 'ADMISSION') eventKey = 'admission';
      else if (type === 'DISCHARGE') eventKey = 'discharge';
      else if (type === 'SBAR_HANDOVER') eventKey = 'sbarHandover';
      else if (type === 'SBAR_RECEIVED') eventKey = 'sbarReceived';
      else if (type === 'ISOLATION_CHANGE') eventKey = 'isolationChange';

      const eventConfig = notifSettings.events[eventKey] || { visual: true, audio: true };
      const shouldShowVisual = forceVisual || (notifSettings.masterVisual && eventConfig.visual);
      const shouldPlayAudio = !isMuted && (forceAudio || (notifSettings.masterAudio && eventConfig.audio));

      const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newNotif: AppNotification = {
        id: notifId,
        type,
        titleEn,
        titleAr,
        messageEn,
        messageAr,
        timestamp: new Date().toISOString(),
        read: false,
        target,
      };

      // Register as locally triggered to prevent echo audio/banner loops
      locallyTriggeredIdsRef.current.add(notifId);

      // 1. Play gentle audio tone locally
      if (shouldPlayAudio) {
        playGentleNotificationTone(type);
      }

      // 2. Show top banner locally
      if (shouldShowVisual) {
        setActiveBanner(newNotif);
      }

      // 3. Add to local queue immediately
      setNotifications((prev) => {
        const updated = [newNotif, ...prev.filter((p) => p.id !== newNotif.id)];
        return updated.slice(0, MAX_NOTIFICATIONS);
      });

      // 4. Broadcast in real time to Cloud Firestore for other connected users
      try {
        const notifRef = doc(firestore, 'notifications', notifId);
        await fsetDoc(notifRef, sanitizeForFirestore(newNotif));
      } catch (cloudErr) {
        console.warn('Cloud notification sync (offline cache active):', cloudErr);
      }
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
    try {
      const notifRef = doc(firestore, 'notifications', id);
      deleteDoc(notifRef).catch(() => {});
    } catch {}
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissBanner = useCallback(() => {
    setActiveBanner(null);
  }, []);

  const handleNotificationClick = useCallback(
    (notif: AppNotification) => {
      markAsRead(notif.id);
      setActiveBanner(null);

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
