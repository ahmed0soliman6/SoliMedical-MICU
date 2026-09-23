import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Maximize2, 
  Minimize2, 
  GripVertical, 
  Sparkles,
  Building,
  User,
  Users,
  Search,
  ArrowLeft,
  ArrowRight,
  Plus,
  CheckCheck,
  Trash2
} from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { auth } from '../services/firebase.ts';
import { ChatConversation, ChatMessage, IcuUser } from '../types/schema.ts';
import { 
  subscribeToUserChats, 
  subscribeToChatMessages, 
  sendChatMessage, 
  getOrCreateDirectChat,
  markChatAsRead,
  calculateTotalUnreadCount,
  deleteChatMessage,
  DEFAULT_DEPARTMENTS 
} from '../services/chatService.ts';

interface FloatingChatWidgetProps {
  activeTab?: string;
  onOpenFullChatPage?: () => void;
}

const POS_STORAGE_KEY = 'soli_floating_chat_pos_v2';
const VISIBILITY_STORAGE_KEY = 'soli_show_floating_chat_widget';

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({ activeTab, onOpenFullChatPage }) => {
  const { currentUser, allUsers } = useAuth();
  const { lang, isRTL } = useTranslation();

  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    return saved !== null ? saved === 'true' : true;
  });

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('dept_general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isStaffDrawerOpen, setIsStaffDrawerOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  // Position state with localStorage persistence
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    try {
      const saved = localStorage.getItem(POS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved floating chat position:', e);
    }
    return { x: 0, y: 0 };
  });

  // Dynamic state for popup placement relative to FAB
  const [isAbove, setIsAbove] = useState<boolean>(true);
  const [isLeftAligned, setIsLeftAligned] = useState<boolean>(true);

  // Measure FAB position on window whenever isOpen changes
  useEffect(() => {
    if (isOpen && fabRef.current) {
      const rect = fabRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;

      // If FAB is in top 45% of viewport, show popup below it; otherwise above
      setIsAbove(rect.top > windowHeight * 0.45);

      // If FAB is near right edge (< 400px), align popup to right; else align to left
      if (rect.left + 380 > windowWidth) {
        setIsLeftAligned(false);
      } else {
        setIsLeftAligned(true);
      }
    }
  }, [isOpen, position]);

  // Listen for global visibility toggle event
  useEffect(() => {
    const handleToggle = (e: CustomEvent<{ visible: boolean }>) => {
      if (e.detail && typeof e.detail.visible === 'boolean') {
        setIsVisible(e.detail.visible);
      } else {
        setIsVisible(prev => !prev);
      }
    };
    window.addEventListener('soli_toggle_floating_chat' as any, handleToggle);
    return () => window.removeEventListener('soli_toggle_floating_chat' as any, handleToggle);
  }, []);

  // Save position on drag end with Messenger-style edge snapping
  const handleDragEnd = (_: any, info: { offset: { x: number; y: number } }) => {
    const rawX = position.x + info.offset.x;
    const rawY = position.y + info.offset.y;

    if (fabRef.current) {
      const rect = fabRef.current.getBoundingClientRect();
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const centerX = rect.left + rect.width / 2;

      // Snap to closest edge (left vs right)
      let targetX = rawX;
      if (centerX < screenW / 2) {
        targetX = 0; // Left edge
      } else {
        targetX = screenW - rect.width - 24; // Right edge
      }

      // Constrain vertical bounds safely within viewport
      let targetY = rawY;
      if (rect.top < 60) {
        targetY = rawY + (60 - rect.top);
      } else if (rect.bottom > screenH - 70) {
        targetY = rawY - (rect.bottom - (screenH - 70));
      }

      const snappedPos = { x: targetX, y: targetY };
      setPosition(snappedPos);
      try {
        localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(snappedPos));
      } catch (e) {
        console.warn('Unable to save floating chat position:', e);
      }
    } else {
      const newPos = { x: rawX, y: rawY };
      setPosition(newPos);
    }
  };

  // Subscribe to chats only when open and visible
  useEffect(() => {
    if (!currentUser?.uid || !isVisible || !isOpen) return;
    const unsub = subscribeToUserChats(currentUser.uid, (list) => {
      setChats(list);
      if (list.length > 0 && !list.some(c => c.id === activeChatId)) {
        setActiveChatId(list[0].id);
      }
    });
    return () => unsub();
  }, [currentUser, isVisible, isOpen, activeChatId]);

  // Subscribe to messages in active chat
  useEffect(() => {
    if (!activeChatId || !isOpen || !isVisible) return;
    const unsub = subscribeToChatMessages(activeChatId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    // Mark as read when active chat is open
    if (currentUser?.uid) {
      markChatAsRead(activeChatId, currentUser.uid);
    }

    return () => unsub();
  }, [activeChatId, isOpen, isVisible, currentUser]);

  const unreadCount = currentUser?.uid ? calculateTotalUnreadCount(chats, currentUser.uid) : 0;

  const handleDeleteMessage = async (messageId: string) => {
    const confirmMsg = lang === 'ar' 
      ? 'هل أنت متأكد من حذف هذه الرسالة؟' 
      : 'Are you sure you want to delete this message?';
    if (!window.confirm(confirmMsg)) return;
    try {
      await deleteChatMessage(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      if (selectedMsgId === messageId) {
        setSelectedMsgId(null);
      }
    } catch (err) {
      console.warn('Failed to delete floating message:', err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentUser || !activeChatId || isSending) return;

    try {
      setIsSending(true);
      const text = inputText;
      setInputText('');
      const activeSenderUid = auth.currentUser?.uid || currentUser.uid;
      await sendChatMessage(
        activeChatId,
        activeSenderUid,
        currentUser.displayName || (lang === 'ar' ? currentUser.nameAr : currentUser.nameEn) || 'Staff',
        currentUser.role,
        text
      );
      if (currentUser.uid) {
        markChatAsRead(activeChatId, currentUser.uid);
      }
      if (auth.currentUser?.uid && auth.currentUser.uid !== currentUser.uid) {
        markChatAsRead(activeChatId, auth.currentUser.uid);
      }
    } catch (err) {
      console.warn('Failed to send floating message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartDirectChat = async (targetUser: IcuUser) => {
    if (!currentUser) return;
    try {
      const chatId = await getOrCreateDirectChat(currentUser, targetUser);
      setActiveChatId(chatId);
      setIsStaffDrawerOpen(false);
      if (currentUser?.uid) {
        markChatAsRead(chatId, currentUser.uid);
      }
    } catch (err) {
      console.warn('Failed to open direct chat:', err);
    }
  };

  // Automatically hide floating widget when user is actively inside the Chat view
  if (!currentUser || !isVisible || activeTab === 'chat') return null;

  const activeChat = chats.find(c => c.id === activeChatId) || {
    id: activeChatId,
    name: 'MICU Channel',
    type: 'DEPARTMENT',
  } as ChatConversation;

  const getChatDisplayName = (chat: ChatConversation) => {
    if (chat.type === 'DEPARTMENT') {
      const found = DEFAULT_DEPARTMENTS.find(d => d.id === chat.id);
      if (found) {
        return lang === 'ar' ? found.nameAr : found.nameEn;
      }
      return chat.name;
    }
    if (chat.participantUids && currentUser) {
      const otherUid = chat.participantUids.find(u => u !== currentUser.uid);
      const otherUser = (allUsers || []).find(u => u.uid === otherUid);
      if (otherUser) {
        return lang === 'ar' ? (otherUser.nameAr || otherUser.displayName) : (otherUser.nameEn || otherUser.displayName);
      }
    }
    return chat.name;
  };

  const filteredStaff = (allUsers || []).filter(u => 
    u.uid !== currentUser?.uid &&
    u.isActive !== false &&
    ((u.nameEn && u.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
     (u.nameAr && u.nameAr.includes(searchQuery)) ||
     (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <>
      {/* Messenger-style Floating Window Portal (Rendered at document.body level to avoid CSS transform container clipping) */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div dir={isRTL ? 'rtl' : 'ltr'}>
          {/* Outside Click / Backdrop Dismiss Overlay */}
          <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] pointer-events-auto cursor-pointer"
              onClick={() => setIsOpen(false)}
              title={lang === 'ar' ? 'اضغط لإغلاق الدردشة' : 'Click outside to close chat'}
            />
          </AnimatePresence>

          {/* Floating Chat Modal Box */}
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="fixed z-50 bottom-20 sm:bottom-24 inset-x-3 sm:inset-x-auto sm:right-6 sm:w-[390px] w-[calc(100vw-24px)] h-[520px] max-h-[78vh] bg-white dark:bg-[#081020] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl text-slate-900 dark:text-slate-100 ring-1 ring-black/10 pointer-events-auto"
            >
                {/* Header */}
                <div className="p-3 bg-slate-100 dark:bg-[#0a1428] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
                      {activeChat.type === 'DEPARTMENT' ? <Building className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                        {getChatDisplayName(activeChat)}
                      </h3>
                      <span className="text-[10px] text-teal-700 dark:text-teal-400 font-mono block truncate">
                        {activeChat.type === 'DEPARTMENT' 
                          ? (lang === 'ar' ? 'قناة عامة' : 'Public Channel') 
                          : (lang === 'ar' ? 'محادثة خاصة' : 'Direct Message')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Toggle Users/Staff Drawer */}
                    <button
                      type="button"
                      onClick={() => setIsStaffDrawerOpen(!isStaffDrawerOpen)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isStaffDrawerOpen
                          ? 'bg-teal-600 text-white border-teal-500 dark:bg-teal-500 dark:text-slate-950'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 border-transparent dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white'
                      }`}
                      title={lang === 'ar' ? 'قائمة الكوادر الطبية' : 'Staff Members'}
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>

                    {onOpenFullChatPage && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenFullChatPage();
                        }}
                        className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer"
                        title={lang === 'ar' ? 'تكبير للشاشة الكاملة' : 'Maximize to full view'}
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Chat Content Body */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-[#060b14] relative">
                  {/* Horizontal Channel Selector */}
                  <div className="p-2 bg-slate-100 dark:bg-[#091122] border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                    {chats.map((c) => {
                      const isActive = c.id === activeChatId;
                      const cUnread = currentUser?.uid ? (c.unreadCounts?.[currentUser.uid] || 0) : 0;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setActiveChatId(c.id);
                            setIsStaffDrawerOpen(false);
                            if (currentUser?.uid) {
                              markChatAsRead(c.id, currentUser.uid);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950 shadow-sm'
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="truncate max-w-[110px]">{getChatDisplayName(c)}</span>
                          {cUnread > 0 && !isActive && (
                            <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                              {cUnread}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Staff Selection Drawer Overlay */}
                  <AnimatePresence>
                    {isStaffDrawerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute inset-x-0 top-0 bottom-0 z-20 bg-white/95 dark:bg-[#081020]/95 backdrop-blur-md p-3 flex flex-col"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {lang === 'ar' ? 'الكوادر الطبية المتاحة' : 'Staff Directory'}
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsStaffDrawerOpen(false)}
                            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative my-2">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={lang === 'ar' ? 'بحث عن كادر...' : 'Search staff...'}
                            className="w-full bg-slate-100 dark:bg-[#0c162c] border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                          />
                        </div>

                        {/* Staff List */}
                        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                          {filteredStaff.length === 0 ? (
                            <p className="text-center text-slate-400 text-xs py-4">
                              {lang === 'ar' ? 'لا يوجد كوادر مطابقة' : 'No staff found'}
                            </p>
                          ) : (
                            filteredStaff.map((u) => (
                              <button
                                key={u.uid}
                                onClick={() => handleStartDirectChat(u)}
                                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0">
                                    {(u.displayName || u.nameEn || 'S').slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {lang === 'ar' ? (u.nameAr || u.displayName) : (u.nameEn || u.displayName)}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{u.role}</p>
                                  </div>
                                </div>
                                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold shrink-0">
                                  {lang === 'ar' ? 'محادثة' : 'Chat'}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Messages Stream */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 space-y-1 text-center py-6">
                        <MessageSquare className="w-8 h-8 text-slate-400 dark:text-slate-600 stroke-1" />
                        <p className="text-[11px]">
                          {lang === 'ar' ? 'لا توجد رسائل سابقة في هذه المحادثة' : 'No messages in this chat'}
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMine = msg.senderUid === currentUser.uid || 
                          (auth.currentUser && msg.senderUid === auth.currentUser.uid) ||
                          (Boolean(currentUser?.displayName) && msg.senderName === currentUser?.displayName);
                        const isAdminUser = currentUser?.role === 'ADMIN' || currentUser?.isSuperAdmin === true || (currentUser?.role as any) === 'admin';
                        const canDelete = isAdminUser || isMine;
                        const isSelected = selectedMsgId === msg.id;
                        const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div 
                            key={msg.id} 
                            className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group transition-all`}
                          >
                            <div className="flex items-center gap-1 mb-0.5 px-1 text-[10px]">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{msg.senderName}</span>
                              <span className="text-slate-400 dark:text-slate-500 text-[9px]">{formattedTime}</span>
                            </div>

                            <div className="flex items-center gap-1.5 max-w-[90%]">
                              {isMine && canDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMessage(msg.id);
                                  }}
                                  className={`p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white dark:bg-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500 dark:hover:text-white cursor-pointer shrink-0 transition-all ${
                                    isSelected ? 'opacity-100 scale-105 ring-1 ring-rose-500' : 'opacity-0 md:group-hover:opacity-100'
                                  }`}
                                  title={lang === 'ar' ? 'حذف الرسالة' : 'Delete Message'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}

                              <div 
                                onClick={() => setSelectedMsgId(isSelected ? null : msg.id)}
                                className={`p-2.5 rounded-xl text-[11px] leading-relaxed shadow-sm cursor-pointer transition-all ${
                                  isMine
                                    ? 'bg-teal-600 text-white rounded-br-none border border-teal-500/50'
                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-700'
                                } ${
                                  isSelected ? 'ring-2 ring-rose-400 shadow-md' : ''
                                }`}
                                title={lang === 'ar' ? 'انقر للخيارات أو الحذف' : 'Click for delete option'}
                              >
                                <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                              </div>

                              {!isMine && canDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMessage(msg.id);
                                  }}
                                  className={`p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white dark:bg-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500 dark:hover:text-white cursor-pointer shrink-0 transition-all ${
                                    isSelected ? 'opacity-100 scale-105 ring-1 ring-rose-500' : 'opacity-0 md:group-hover:opacity-100'
                                  }`}
                                  title={lang === 'ar' ? 'حذف الرسالة' : 'Delete Message'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {/* Tap Action Bar when selected */}
                            {isSelected && canDelete && (
                              <div className="flex items-center gap-1.5 mt-1 px-1 animate-in fade-in duration-100">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMessage(msg.id);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-600 text-white text-[10px] font-bold shadow-sm cursor-pointer active:scale-95"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMsgId(null);
                                  }}
                                  className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px]"
                                >
                                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Bar */}
                  <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081020] flex items-center gap-1.5">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={lang === 'ar' ? 'اكتب رسالتك السريرية...' : 'Type clinical note...'}
                      className="flex-1 bg-slate-100 dark:bg-[#050912] border border-slate-300 dark:border-slate-700 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || isSending}
                      className="p-2 rounded-xl bg-teal-600 hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400 disabled:opacity-40 text-white dark:text-slate-950 font-bold cursor-pointer transition-all shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </motion.div>
          </AnimatePresence>
        </div>,
        document.body
      )}

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-6 left-6 sm:left-8 z-50 pointer-events-none select-none" dir={isRTL ? 'rtl' : 'ltr'}>
        <motion.div
          ref={fabRef}
          drag={!isOpen}
          dragMomentum={false}
          dragElastic={0.05}
          onDragEnd={handleDragEnd}
          animate={{ x: position.x, y: position.y }}
          transition={isOpen ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 300 }}
          className="pointer-events-auto relative flex flex-col items-start"
        >
          <motion.button
          whileHover={!isOpen ? { scale: 1.04 } : undefined}
          whileTap={!isOpen ? { scale: 0.96 } : undefined}
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen && currentUser?.uid) {
              markChatAsRead(activeChatId, currentUser.uid);
            }
          }}
          className={`relative group flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg border-2 backdrop-blur-md transition-all duration-200 opacity-85 hover:opacity-100 cursor-grab active:cursor-grabbing ${
            isOpen
              ? 'bg-teal-600/90 text-white border-teal-400/80 ring-2 ring-teal-500/20 dark:bg-teal-500/90 dark:text-slate-950 dark:border-teal-300/80'
              : unreadCount > 0
              ? 'bg-rose-600/95 text-white border-rose-400/80 ring-2 ring-rose-500/30'
              : 'bg-white/75 text-teal-800 hover:bg-white border-teal-500/50 shadow-md ring-1 ring-teal-500/10 dark:bg-[#0a1428]/75 dark:text-teal-300 dark:hover:bg-[#0a1428] dark:border-teal-500/50'
          }`}
          title={lang === 'ar' ? 'زر الدردشة السريرية العائم (اسحب لتحريكه)' : 'Floating Clinical Chat (Drag to move)'}
        >
          {unreadCount > 0 ? (
            <div className="flex items-center gap-1.5 px-0.5">
              <MessageSquare className="w-4 h-4 shrink-0 text-white animate-pulse" />
              <span className="text-[11px] font-black bg-white/20 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                {unreadCount}
              </span>
            </div>
          ) : (
            <>
              <GripVertical className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline text-xs font-bold leading-none">
                {lang === 'ar' ? 'الدردشة' : 'Chat'}
              </span>
            </>
          )}
        </motion.button>
      </motion.div>
    </div>
    </>
  );
};

