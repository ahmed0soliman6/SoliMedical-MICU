/**
 * Soli Medical MICU (ICU-Sync)
 * Hospital Clinical Chat Service (Firestore SSOT)
 * 
 * Manages 1-to-1 staff conversations and department channels.
 * Separated strictly from patient medical records per clinical regulations.
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp, 
  arrayUnion, 
  increment,
  deleteDoc,
  Unsubscribe 
} from 'firebase/firestore';
import { firestore, setDoc, updateDoc } from './firebase.ts';
import { COLLECTIONS } from '../types/contracts.ts';
import { ChatConversation, ChatMessage, IcuUser } from '../types/schema.ts';

const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'chatMessages';

export const DEFAULT_DEPARTMENTS = [
  { id: 'dept_general', nameEn: 'MICU Central Coordination', nameAr: 'القناة العامة - تنسيق العناية المركزة', dept: 'ALL' },
];

/**
 * Ensures default department channels exist in Firestore
 */
export async function ensureDefaultDepartmentChats(creatorUid: string, creatorName: string): Promise<void> {
  try {
    for (const dept of DEFAULT_DEPARTMENTS) {
      const chatDocRef = doc(firestore, CHATS_COLLECTION, dept.id);
      const existing = await getDoc(chatDocRef);
      if (!existing.exists()) {
        const newChat: ChatConversation = {
          id: dept.id,
          type: 'DEPARTMENT',
          name: dept.nameEn,
          participantUids: [],
          department: dept.dept,
          lastMessage: 'Channel initialized for secure clinical communications.',
          lastMessageAt: new Date().toISOString(),
          lastMessageSenderName: 'System',
          unreadCounts: {},
          createdAt: new Date().toISOString(),
          createdByUid: creatorUid,
        };
        await setDoc(chatDocRef, newChat);
      }
    }
  } catch (error) {
    console.warn('Notice ensuring department chat channels:', error);
  }
}

/**
 * Subscribe to all conversations accessible to the current user
 */
export function subscribeToUserChats(
  currentUid: string, 
  callback: (chats: ChatConversation[]) => void
): Unsubscribe {
  const colRef = collection(firestore, CHATS_COLLECTION);
  
  return onSnapshot(colRef, (snapshot) => {
    const list: ChatConversation[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as ChatConversation;
      // Show if it's the main department channel OR if current user is in participant list
      if (
        (data.type === 'DEPARTMENT' && DEFAULT_DEPARTMENTS.some(dept => dept.id === data.id)) || 
        (data.type === 'DIRECT' && data.participantUids && data.participantUids.includes(currentUid))
      ) {
        list.push(data);
      }
    });

    // Sort by last message timestamp descending
    list.sort((a, b) => {
      const tA = new Date(a.lastMessageAt || a.createdAt).getTime();
      const tB = new Date(b.lastMessageAt || b.createdAt).getTime();
      return tB - tA;
    });

    callback(list);
  }, (err) => {
    console.warn('Real-time chat list subscription warning:', err);
    callback([]);
  });
}

/**
 * Subscribe to messages within a specific conversation
 */
export function subscribeToChatMessages(
  chatId: string, 
  callback: (messages: ChatMessage[]) => void
): Unsubscribe {
  const colRef = collection(firestore, MESSAGES_COLLECTION);
  const q = query(
    colRef,
    where('chatId', '==', chatId),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const msgs: ChatMessage[] = [];
    snapshot.forEach((d) => {
      msgs.push(d.data() as ChatMessage);
    });

    msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    callback(msgs);
  }, (err) => {
    console.warn('Real-time chat messages subscription warning:', err);
    callback([]);
  });
}

/**
 * Send a message in a conversation
 */
export async function sendChatMessage(
  chatId: string,
  senderUid: string,
  senderName: string,
  senderRole: string,
  text: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const msg: ChatMessage = {
    id: messageId,
    chatId,
    senderUid,
    senderName,
    senderRole,
    message: trimmed,
    createdAt: nowIso,
    readBy: [senderUid],
  };

  const msgRef = doc(firestore, MESSAGES_COLLECTION, messageId);
  const chatRef = doc(firestore, CHATS_COLLECTION, chatId);

  await setDoc(msgRef, msg);

  // Update chat last message preview and increment unread count for other participants
  try {
    const chatSnap = await getDoc(chatRef);
    const existingData = chatSnap.data() as ChatConversation | undefined;
    const unreadCounts = { ...(existingData?.unreadCounts || {}) };

    // Reset sender's unread count to 0, increment for everyone else
    unreadCounts[senderUid] = 0;
    
    if (existingData?.participantUids && existingData.participantUids.length > 0) {
      existingData.participantUids.forEach((uid) => {
        if (uid !== senderUid) {
          unreadCounts[uid] = (unreadCounts[uid] || 0) + 1;
        }
      });
    }

    await setDoc(chatRef, {
      lastMessage: trimmed,
      lastMessageAt: nowIso,
      lastMessageSenderName: senderName,
      unreadCounts,
    }, { merge: true });
  } catch (err) {
    console.warn('Error updating chat lastMessage:', err);
  }
}

/**
 * Mark a conversation as read by the current user
 */
export async function markChatAsRead(chatId: string, userUid: string): Promise<void> {
  if (!chatId || !userUid) return;
  try {
    const chatRef = doc(firestore, CHATS_COLLECTION, chatId);
    
    // Store in localStorage as instant offline fallback
    if (typeof window !== 'undefined') {
      localStorage.setItem(`soli_chat_read_${chatId}_${userUid}`, new Date().toISOString());
    }

    await setDoc(chatRef, {
      unreadCounts: {
        [userUid]: 0
      }
    }, { merge: true });
  } catch (err) {
    console.warn('Error marking chat as read:', err);
  }
}

/**
 * Calculate total unread count for a user across all conversations
 */
export function calculateTotalUnreadCount(chats: ChatConversation[], userUid: string): number {
  if (!chats || !userUid) return 0;
  
  let total = 0;
  for (const chat of chats) {
    const firestoreUnread = chat.unreadCounts?.[userUid] || 0;
    
    // Check localStorage fallback timestamp
    let isReadLocally = false;
    if (typeof window !== 'undefined') {
      const readTs = localStorage.getItem(`soli_chat_read_${chat.id}_${userUid}`);
      if (readTs && chat.lastMessageAt) {
        const lastMsgTime = new Date(chat.lastMessageAt).getTime();
        const localReadTime = new Date(readTs).getTime();
        if (localReadTime >= lastMsgTime) {
          isReadLocally = true;
        }
      }
    }

    if (!isReadLocally && firestoreUnread > 0) {
      total += firestoreUnread;
    }
  }
  return total;
}

/**
 * Start or retrieve a 1-to-1 conversation with a specific user
 */
export async function getOrCreateDirectChat(
  currentUser: IcuUser, 
  targetUser: IcuUser
): Promise<string> {
  const directId = [currentUser.uid, targetUser.uid].sort().join('_');
  const chatRef = doc(firestore, CHATS_COLLECTION, directId);
  const snap = await getDoc(chatRef);

  if (!snap.exists()) {
    const newChat: ChatConversation = {
      id: directId,
      type: 'DIRECT',
      name: `${currentUser.displayName || currentUser.nameEn} & ${targetUser.displayName || targetUser.nameEn}`,
      participantUids: [currentUser.uid, targetUser.uid],
      lastMessage: 'Conversation opened.',
      lastMessageAt: new Date().toISOString(),
      lastMessageSenderName: currentUser.displayName || currentUser.nameEn,
      unreadCounts: {
        [currentUser.uid]: 0,
        [targetUser.uid]: 0,
      },
      createdAt: new Date().toISOString(),
      createdByUid: currentUser.uid,
    };
    await setDoc(chatRef, newChat);
  }

  return directId;
}

/**
 * Deletes a chat message from Firestore
 */
export async function deleteChatMessage(messageId: string): Promise<void> {
  if (!messageId) return;
  const docRef = doc(firestore, MESSAGES_COLLECTION, messageId);
  await deleteDoc(docRef);
}

/**
 * Periodically deletes chat messages that are older than 3 months (90 days)
 */
export async function cleanupOldMessages(): Promise<number> {
  try {
    const colRef = collection(firestore, MESSAGES_COLLECTION);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const limitIso = ninetyDaysAgo.toISOString();

    const q = query(colRef, where('createdAt', '<', limitIso));
    const snapshot = await getDocs(q);

    let deletedCount = 0;
    for (const docSnap of snapshot.docs) {
      await deleteDoc(docSnap.ref);
      deletedCount++;
    }
    
    if (deletedCount > 0) {
      console.log(`[Chat CleanUp] Cleaned up ${deletedCount} clinical messages older than 90 days.`);
    }
    return deletedCount;
  } catch (err) {
    console.warn('Error during old messages cleanup:', err);
    return 0;
  }
}
