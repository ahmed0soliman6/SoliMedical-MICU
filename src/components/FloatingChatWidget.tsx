import React, { useState, useEffect, useRef } from 'react';
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
  ArrowLeft,
  ArrowRight,
  Plus,
  CheckCheck
} from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { ChatConversation, ChatMessage } from '../types/schema.ts';
import { 
  subscribeToUserChats, 
  subscribeToChatMessages, 
  sendChatMessage, 
  markChatAsRead,
  calculateTotalUnreadCount,
  DEFAULT_DEPARTMENTS 
} from '../services/chatService.ts';

interface FloatingChatWidgetProps {
  onOpenFullChatPage?: () => void;
}

const POS_STORAGE_KEY = 'soli_floating_chat_pos_v2';
const VISIBILITY_STORAGE_KEY = 'soli_show_floating_chat_widget';

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({ onOpenFullChatPage }) => {
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
  const [mobileSelectedChat, setMobileSelectedChat] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Save position on drag end
  const handleDragEnd = (_: any, info: { offset: { x: number; y: number } }) => {
    const newPos = {
      x: position.x + info.offset.x,
      y: position.y + info.offset.y,
    };
    setPosition(newPos);
    try {
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(newPos));
    } catch (e) {
      console.warn('Unable to save floating chat position:', e);
    }
  };

  // Subscribe to chats
  useEffect(() => {
    if (!currentUser?.uid || !isVisible) return;
    const unsub = subscribeToUserChats(currentUser.uid, (list) => {
      setChats(list);
      if (list.length > 0 && !list.some(c => c.id === activeChatId)) {
        setActiveChatId(list[0].id);
      }
    });
    return () => unsub();
  }, [currentUser, isVisible, activeChatId]);

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

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentUser || !activeChatId || isSending) return;

    try {
      setIsSending(true);
      const text = inputText;
      setInputText('');
      await sendChatMessage(
        activeChatId,
        currentUser.uid,
        currentUser.displayName || (lang === 'ar' ? currentUser.nameAr : currentUser.nameEn) || 'Staff',
        currentUser.role,
        text
      );
      if (currentUser.uid) {
        markChatAsRead(activeChatId, currentUser.uid);
      }
    } catch (err) {
      console.warn('Failed to send floating message:', err);
    } finally {
      setIsSending(false);
    }
  };

  if (!currentUser || !isVisible) return null;

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

  return (
    <div className="fixed bottom-6 left-6 sm:left-8 z-50 pointer-events-none select-none" dir={isRTL ? 'rtl' : 'ltr'}>
      <motion.div
        drag={!isOpen}
        dragMomentum={false}
        dragElastic={0.05}
        onDragEnd={handleDragEnd}
        animate={{ x: position.x, y: position.y }}
        transition={isOpen ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 300 }}
        className="pointer-events-auto relative flex flex-col items-start"
      >
        {/* Quick Popup Floating Card when Open */}
        <AnimatePresence>
          {isOpen && (
            <div className="absolute bottom-full left-0 mb-3 z-50 pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                transition={{ duration: 0.12 }}
                className="w-[92vw] sm:w-[380px] h-[500px] max-h-[75vh] bg-white dark:bg-[#081020] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl text-slate-900 dark:text-slate-100"
              >
                {/* Header */}
                <div className="p-3 bg-slate-100 dark:bg-[#0a1428] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-700 dark:text-teal-300">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                        {lang === 'ar' ? 'الدردشة السريرية المباشرة' : 'Clinical Direct Chat'}
                      </h3>
                      <span className="text-[10px] text-teal-700 dark:text-teal-400 font-mono block">
                        {getChatDisplayName(activeChat)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
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
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-[#060b14]">
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
                            setMobileSelectedChat(true);
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
                        const isMine = msg.senderUid === currentUser.uid;
                        const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div 
                            key={msg.id} 
                            className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center gap-1 mb-0.5 px-1 text-[10px]">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{msg.senderName}</span>
                              <span className="text-slate-400 dark:text-slate-500 text-[9px]">{formattedTime}</span>
                            </div>

                            <div className={`max-w-[85%] p-2.5 rounded-xl text-[11px] leading-relaxed shadow-sm ${
                              isMine
                                ? 'bg-teal-600 text-white rounded-br-none border border-teal-500/50'
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-700'
                            }`}>
                              <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                            </div>
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
            </div>
          )}
        </AnimatePresence>

        {/* Floating Action Button (FAB) */}
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
          className={`relative group flex items-center gap-2 px-3.5 py-3 rounded-full shadow-2xl border backdrop-blur-xl transition-all cursor-grab active:cursor-grabbing ${
            isOpen
              ? 'bg-teal-600 text-white border-teal-400 ring-4 ring-teal-500/30 dark:bg-teal-500 dark:text-slate-950 dark:border-teal-300'
              : unreadCount > 0
              ? 'bg-rose-600 text-white border-rose-400 ring-4 ring-rose-500/40 animate-bounce'
              : 'bg-white text-teal-800 hover:bg-teal-50 hover:text-teal-950 border-2 border-teal-500/80 shadow-xl ring-2 ring-teal-500/20 dark:bg-[#0a1428]/95 dark:text-teal-300 dark:hover:bg-teal-950/80 dark:hover:text-white dark:border-teal-500/60 dark:ring-teal-500/20'
          }`}
          title={lang === 'ar' ? 'زر الدردشة السريرية العائم (يمكنك تحريكه بسحب)' : 'Floating Clinical Chat (Drag to move)'}
        >
          <GripVertical className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
          <MessageSquare className="w-5 h-5 shrink-0" />
          <span className="hidden sm:inline text-xs font-bold leading-none">
            {lang === 'ar' ? 'الدردشة السريرية' : 'Chat'}
          </span>

          {/* Dynamic Unread Badge Counter */}
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-[#081020] shadow-md animate-pulse">
              {unreadCount}
            </span>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
};
