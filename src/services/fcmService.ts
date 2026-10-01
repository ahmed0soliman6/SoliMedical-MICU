/**
 * Soli Medical MICU (ICU-Sync)
 * Firebase Cloud Messaging (FCM) Client Service
 * 
 * Supports:
 * - Instant Web Push Notifications on Android & Desktop
 * - Background push delivery via Firebase Cloud Messaging
 * - Automatic device token registration and Firestore sync
 * - Seamless integration with NotificationProvider and Settings
 */

import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { firebaseApp, firestore, auth, sanitizeForFirestore } from './firebase.ts';
import { AppNotification, NotificationType } from '../types/notification.ts';
import { IcuUser } from '../types/schema.ts';

const FCM_TOKEN_STORAGE_KEY = 'soli_icu_fcm_device_token';

let messagingInstance: Messaging | null = null;
let isMessagingSupported: boolean | null = null;

/**
 * Checks if browser environment supports Web Push & FCM
 */
export async function checkIsFcmSupported(): Promise<boolean> {
  if (isMessagingSupported !== null) {
    return isMessagingSupported;
  }
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    isMessagingSupported = false;
    return false;
  }
  try {
    isMessagingSupported = await isSupported();
    return isMessagingSupported;
  } catch (err) {
    console.warn('[FCM] Browser does not support Firebase Messaging:', err);
    isMessagingSupported = false;
    return false;
  }
}

/**
 * Gets or initializes the Firebase Messaging instance
 */
export async function getFcmMessaging(): Promise<Messaging | null> {
  const supported = await checkIsFcmSupported();
  if (!supported) return null;

  if (!messagingInstance) {
    try {
      messagingInstance = getMessaging(firebaseApp);
    } catch (e) {
      console.warn('[FCM] Could not initialize getMessaging:', e);
      return null;
    }
  }
  return messagingInstance;
}

/**
 * Requests Notification permission and registers the FCM Device Token
 */
export async function requestFcmToken(currentUser?: IcuUser | null): Promise<string | null> {
  try {
    const supported = await checkIsFcmSupported();
    if (!supported) {
      console.info('[FCM] Web Push not supported in this browser environment.');
      return null;
    }

    if (Notification.permission === 'denied') {
      console.info('[FCM] Notification permission is blocked by user.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[FCM] Notification permission not granted:', permission);
      return null;
    }

    const messaging = await getFcmMessaging();
    if (!messaging) return null;

    // Register or get existing service worker registration
    let swReg: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!swReg) {
          swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        }
      } catch (swErr) {
        console.warn('[FCM] Service Worker registration note:', swErr);
      }
    }

    // Web Push requires vapidKey; fail gracefully with clear warning if missing
    const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY is missing. Web Push requires a valid VAPID Key pair from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates -> Key pair.');
      return null;
    }

    // Get FCM registration token with mandatory vapidKey and Service Worker Registration
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    }).catch(async (tokErr) => {
      console.warn('[FCM] getToken error with vapidKey:', tokErr);
      return null;
    });

    if (!token) {
      return null;
    }

    // Cache token locally
    localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);

    // Save/update device token in Firestore /fcmTokens collection
    if (currentUser?.uid) {
      await syncTokenToFirestore(token, currentUser);
    }

    return token;
  } catch (err) {
    console.warn('[FCM] requestFcmToken notice:', err);
    return null;
  }
}

/**
 * Saves or updates FCM device token metadata in Firestore
 */
export async function syncTokenToFirestore(token: string, user: IcuUser): Promise<void> {
  try {
    if (!token || !user?.uid) return;
    // Encode token into a safe document ID
    const docId = `token_${token.slice(0, 32)}_${user.uid}`;
    const tokenRef = doc(firestore, 'fcmTokens', docId);

    const data = {
      token,
      uid: user.uid,
      userEmail: user.email || '',
      userName: user.nameEn || user.nameAr || '',
      userRole: user.role || '',
      platform: 'web-pwa',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : 'unknown',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await setDoc(tokenRef, sanitizeForFirestore(data), { merge: true });
  } catch (e) {
    console.warn('[FCM] Token Firestore sync notice:', e);
  }
}

/**
 * Unregisters the FCM device token upon user logout
 */
export async function unregisterFcmToken(currentUser?: IcuUser | null): Promise<void> {
  try {
    const token = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (!token) return;

    if (currentUser?.uid) {
      const docId = `token_${token.slice(0, 32)}_${currentUser.uid}`;
      const tokenRef = doc(firestore, 'fcmTokens', docId);
      await deleteDoc(tokenRef).catch(() => {});
    }
    localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
  } catch (e) {
    console.warn('[FCM] Unregister token notice:', e);
  }
}

/**
 * Sets up foreground FCM message listener
 */
export async function subscribeToForegroundFcmMessages(
  onForegroundMessage: (notification: AppNotification) => void
): Promise<(() => void) | null> {
  try {
    const messaging = await getFcmMessaging();
    if (!messaging) return null;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);
      const data = payload.data || {};
      const notifPayload = payload.notification || {};

      const appNotif: AppNotification = {
        id: data.id || `fcm-${Date.now()}`,
        type: (data.type as NotificationType) || 'ADMISSION',
        titleEn: data.titleEn || notifPayload.title || 'Clinical Alert',
        titleAr: data.titleAr || notifPayload.title || 'تنبيه سريري',
        messageEn: data.messageEn || notifPayload.body || '',
        messageAr: data.messageAr || notifPayload.body || '',
        timestamp: data.timestamp || new Date().toISOString(),
        read: false,
        target: data.action ? {
          action: data.action as any,
          bedNumber: data.bedNumber as any,
          patientId: data.patientId,
          patientName: data.patientName,
          patientMrn: data.patientMrn,
        } : undefined,
      };

      onForegroundMessage(appNotif);
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[FCM] Foreground listener init notice:', err);
    return null;
  }
}

/**
 * Broadcasts an FCM push notification to all active devices through the server proxy
 */
export async function broadcastFcmPush(notification: {
  type: NotificationType;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  bedNumber?: string;
  patientId?: string;
  patientName?: string;
  patientMrn?: string;
  action?: string;
}): Promise<void> {
  try {
    const payload = {
      type: notification.type,
      titleEn: notification.titleEn,
      titleAr: notification.titleAr,
      messageEn: notification.messageEn,
      messageAr: notification.messageAr,
      bedNumber: notification.bedNumber,
      patientId: notification.patientId,
      patientName: notification.patientName,
      patientMrn: notification.patientMrn,
      action: notification.action || 'OPEN_BED',
      timestamp: new Date().toISOString(),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }
      } catch (tokenErr) {
        console.warn('[FCM] Error obtaining auth ID token for broadcast:', tokenErr);
      }
    }

    // Asynchronously dispatch to full-stack server FCM broadcast route
    fetch('/api/notifications/fcm-broadcast', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.warn('[FCM] Server push broadcast dispatch notice:', err);
    });
  } catch (e) {
    console.warn('[FCM] Broadcast push exception:', e);
  }
}
