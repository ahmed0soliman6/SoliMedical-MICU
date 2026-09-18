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
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp, 
  updateDoc, 
  arrayUnion, 
  increment,
  Unsubscribe 
} from 'firebase/firestore';
import { firestore } from './firebase.ts';
import { COLLECTIONS } from '../types/contracts.ts';
import { ChatConversation, ChatMessage, IcuUser } from '../types/schema.ts';

const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'chatMessages';

export const DEFAULT_DEPARTMENTS = [
  { id: 'dept_general', nameEn: 'MICU Central Coordination', nameAr: 'تنسيق العناية المركزة العام', dept: 'ALL' },
  { id: 'dept_physicians', nameEn: 'Physicians & Intensivists', nameAr: 'الأطباء واستشاريو الحالات الحرجة', dept: 'PHYSICIANS' },
  { id: 'dept_nursing', nameEn: 'ICU Nursing & Bedside Team', nameAr: 'كادر التمريض السريري', dept: 'NURSING' },
  { id: 'dept_allied', nameEn: 'Pharmacy & Respiratory Care', nameAr: 'الصيدلة الإكلينيكية والعلاج التنفسي', dept: 'ALLIED' },
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
      // Show if it's a department channel OR if current user is in participant list
      if (data.type === 'DEPARTMENT' || (data.participantUids && data.participantUids.includes(currentUid))) {
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

  // Update chat last message preview
  await updateDoc(chatRef, {
    lastMessage: trimmed,
    lastMessageAt: nowIso,
    lastMessageSenderName: senderName,
    [`unreadCounts.${senderUid}`]: 0,
  }).catch(() => {
    // In case doc structure requires set merge
    setDoc(chatRef, {
      lastMessage: trimmed,
      lastMessageAt: nowIso,
      lastMessageSenderName: senderName,
    }, { merge: true });
  });
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
