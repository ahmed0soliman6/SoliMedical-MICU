import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Users, 
  User, 
  Search, 
  Hash, 
  ShieldCheck, 
  Stethoscope, 
  Clock, 
  Plus, 
  CheckCheck,
  Building,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Maximize2
} from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { ChatConversation, ChatMessage, IcuUser } from '../types/schema.ts';
import { 
  subscribeToUserChats, 
  subscribeToChatMessages, 
  sendChatMessage, 
  getOrCreateDirectChat, 
  ensureDefaultDepartmentChats,
  markChatAsRead,
  DEFAULT_DEPARTMENTS 
} from '../services/chatService.ts';

export const HospitalChatView: React.FC = () => {
  const { currentUser, allUsers } = useAuth();
  const { lang, isRTL } = useTranslation();

  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('dept_general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Responsive mobile navigation state
  const [showMobileChat, setShowMobileChat] = useState<boolean>(false);

  // Floating Action Button visibility state
  const [isFloatingWidgetEnabled, setIsFloatingWidgetEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('soli_show_floating_chat_widget');
    return saved !== null ? saved === 'true' : true;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize default channels on mount
  useEffect(() => {
    if (currentUser?.uid) {
      ensureDefaultDepartmentChats(
        currentUser.uid, 
        currentUser.displayName || currentUser.nameEn || 'Staff'
      );
    }
  }, [currentUser]);

  // Subscribe to user's chat channels
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToUserChats(currentUser.uid, (list) => {
      setChats(list);
      // Default to first chat if current active is invalid
      if (list.length > 0 && !list.some(c => c.id === activeChatId)) {
        setActiveChatId(list[0].id);
      }
    });
    return () => unsub();
  }, [currentUser, activeChatId]);

  // Subscribe to messages of active conversation and mark as read
  useEffect(() => {
    if (!activeChatId) return;
    const unsub = subscribeToChatMessages(activeChatId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    if (currentUser?.uid) {
      markChatAsRead(activeChatId, currentUser.uid);
    }

    return () => unsub();
  }, [activeChatId, currentUser]);

  const handleToggleFloatingWidget = () => {
    const nextState = !isFloatingWidgetEnabled;
    setIsFloatingWidgetEnabled(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('soli_show_floating_chat_widget', String(nextState));
      window.dispatchEvent(new CustomEvent('soli_toggle_floating_chat', { detail: { visible: nextState } }));
    }
  };

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
      if (currentUser?.uid) {
        markChatAsRead(activeChatId, currentUser.uid);
      }
    } catch (err) {
      console.warn('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartDirectChat = async (targetUser: IcuUser) => {
    if (!currentUser) return;
    try {
      const chatId = await getOrCreateDirectChat(currentUser, targetUser);
      setActiveChatId(chatId);
      setShowMobileChat(true);
      setIsNewChatModalOpen(false);
      if (currentUser?.uid) {
        markChatAsRead(chatId, currentUser.uid);
      }
    } catch (err) {
      console.warn('Error starting direct chat:', err);
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId) || {
    id: activeChatId,
    name: 'MICU Channel',
    type: 'DEPARTMENT',
  } as ChatConversation;

  // Compute active chat title
  const getChatDisplayName = (chat: ChatConversation) => {
    if (chat.type === 'DEPARTMENT') {
      const found = DEFAULT_DEPARTMENTS.find(d => d.id === chat.id);
      if (found) {
        return lang === 'ar' ? found.nameAr : found.nameEn;
      }
      return chat.name;
    }
    // 1-to-1: show other user's name
    if (chat.participantUids && currentUser) {
      const otherUid = chat.participantUids.find(u => u !== currentUser.uid);
      const otherUser = (allUsers || []).find(u => u.uid === otherUid);
      if (otherUser) {
        return lang === 'ar' ? (otherUser.nameAr || otherUser.displayName) : (otherUser.nameEn || otherUser.displayName);
      }
    }
    return chat.name;
  };

  const filteredUsers = (allUsers || []).filter(u => 
    u.uid !== currentUser?.uid &&
    u.isActive !== false &&
    ((u.nameEn && u.nameEn.toLowerCase().includes(searchUserQuery.toLowerCase())) ||
     (u.nameAr && u.nameAr.includes(searchUserQuery)) ||
     (u.email && u.email.toLowerCase().includes(searchUserQuery.toLowerCase())))
  );

  return (
    <div className="flex h-[calc(100vh-5.5rem)] max-w-7xl mx-auto rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070d18] shadow-2xl relative" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Left Sidebar: Conversations & Channels (Hidden on Mobile if Chat is Selected) */}
      <div className={`w-full md:w-80 sm:w-96 flex flex-col border-r border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#091122] ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-100/70 dark:bg-[#0a1428]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-700 dark:text-teal-300">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {lang === 'ar' ? 'الدردشة السريرية' : 'Clinical Chat'}
              </h2>
              <span className="text-[10px] sm:text-[11px] text-teal-700 dark:text-teal-400 font-mono">
                {lang === 'ar' ? 'تنسيق الحالات الحرجة' : 'ICU Coordination'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Toggle Floating Action Button */}
            <button
              type="button"
              onClick={handleToggleFloatingWidget}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                isFloatingWidgetEnabled
                  ? 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/40 hover:bg-teal-200'
                  : 'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={lang === 'ar' ? 'تفعيل/إلغاء الزر العائم' : 'Toggle Floating Button'}
            >
              <GripVertical className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isFloatingWidgetEnabled ? (lang === 'ar' ? 'الزر العائم مفعّل' : 'FAB On') : (lang === 'ar' ? 'الزر العائم معطّل' : 'FAB Off')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewChatModalOpen(true)}
              className="p-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-500/20 dark:hover:bg-teal-500/30 dark:text-teal-300 border border-teal-500/40 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title={lang === 'ar' ? 'بدء محادثة خاصة جديدة' : 'New Direct Chat'}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Channels List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-2 py-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            {lang === 'ar' ? 'القنوات الجماعية' : 'Department Channels'}
          </div>

          {chats.filter(c => c.type === 'DEPARTMENT').map((chat) => {
            const isActive = chat.id === activeChatId;
            const cUnread = currentUser?.uid ? (chat.unreadCounts?.[currentUser.uid] || 0) : 0;
            return (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setShowMobileChat(true);
                  if (currentUser?.uid) {
                    markChatAsRead(chat.id, currentUser.uid);
                  }
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-50 border border-teal-300 text-teal-950 font-semibold shadow-sm dark:bg-teal-500/20 dark:border-teal-500/50 dark:text-white'
                    : 'text-slate-700 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-teal-200 text-teal-800 dark:bg-teal-500/30 dark:text-teal-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                    <Hash className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{getChatDisplayName(chat)}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {chat.lastMessageSenderName ? `${chat.lastMessageSenderName}: ` : ''}
                      {chat.lastMessage || (lang === 'ar' ? 'لا توجد رسائل بعد' : 'No messages yet')}
                    </p>
                  </div>
                </div>

                {cUnread > 0 && !isActive && (
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 ml-2 animate-pulse">
                    {cUnread}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 px-2 py-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            {lang === 'ar' ? 'المحادثات الخاصة 1-to-1' : 'Direct Messages'}
          </div>

          {chats.filter(c => c.type === 'DIRECT').length === 0 ? (
            <div className="p-3 text-center text-slate-400 dark:text-slate-500 text-xs italic">
              {lang === 'ar' ? 'لا توجد محادثات خاصة حالياً' : 'No direct chats yet'}
            </div>
          ) : (
            chats.filter(c => c.type === 'DIRECT').map((chat) => {
              const isActive = chat.id === activeChatId;
              const cUnread = currentUser?.uid ? (chat.unreadCounts?.[currentUser.uid] || 0) : 0;
              return (
                <button
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setShowMobileChat(true);
                    if (currentUser?.uid) {
                      markChatAsRead(chat.id, currentUser.uid);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 border border-teal-300 text-teal-950 font-semibold shadow-sm dark:bg-teal-500/20 dark:border-teal-500/50 dark:text-white'
                      : 'text-slate-700 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-teal-200 text-teal-800 dark:bg-teal-500/30 dark:text-teal-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{getChatDisplayName(chat)}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {chat.lastMessage || ''}
                      </p>
                    </div>
                  </div>

                  {cUnread > 0 && !isActive && (
                    <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 ml-2 animate-pulse">
                      {cUnread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Area: Messages View & Composer (Hidden on Mobile if Channel List is Active) */}
      <div className={`flex-1 flex-col bg-slate-50 dark:bg-[#060b14] ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Active Chat Header */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#08101e]">
          <div className="flex items-center gap-2.5">
            {/* Mobile Back Button */}
            <button
              type="button"
              onClick={() => setShowMobileChat(false)}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer"
            >
              {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              <span>{lang === 'ar' ? 'القنوات' : 'Channels'}</span>
            </button>

            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
              {activeChat.type === 'DEPARTMENT' ? <Building className="w-4 h-4 sm:w-5 sm:h-5" /> : <User className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {getChatDisplayName(activeChat)}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">{lang === 'ar' ? 'اتصال سريري آمن مشفر' : 'Secure Clinical Stream'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 space-y-2 text-center py-10">
              <MessageSquare className="w-10 h-10 text-slate-400 dark:text-slate-600 stroke-1" />
              <p className="text-xs">
                {lang === 'ar' ? 'لا توجد رسائل سابقة في هذه القناة. ابدأ المحادثة الآن.' : 'No messages yet. Send a message to start communicating.'}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderUid === currentUser?.uid;
              const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{msg.senderName}</span>
                    {msg.senderRole && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-teal-800 dark:text-teal-400 border border-slate-300 dark:border-slate-700 font-mono">
                        {msg.senderRole}
                      </span>
                    )}
                    <span className="text-slate-400 dark:text-slate-500 text-[10px]">{formattedTime}</span>
                  </div>

                  <div className={`max-w-[88%] sm:max-w-lg p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    isMine
                      ? 'bg-teal-600 text-white rounded-br-none border border-teal-500/50'
                      : 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-700'
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
        <form onSubmit={handleSendMessage} className="p-2.5 sm:p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#091122] flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={lang === 'ar' ? 'اكتب رسالتك السريرية هنا...' : 'Type a clinical message...'}
            className="flex-1 bg-slate-100 dark:bg-[#060b14] border border-slate-300 dark:border-slate-700 focus:border-teal-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400 disabled:opacity-40 text-white dark:text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-teal-500/20 shrink-0 min-h-[42px]"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'إرسال' : 'Send'}</span>
          </button>
        </form>
      </div>

      {/* New Direct Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#0a1224] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-slate-900 dark:text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'بدء محادثة خاصة مع كادر' : 'Start Direct Chat'}
                </h3>
              </div>
              <button 
                onClick={() => setIsNewChatModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                placeholder={lang === 'ar' ? 'البحث بالاسم أو البريد...' : 'Search staff by name or email...'}
                className="w-full bg-slate-100 dark:bg-[#070d1a] border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                  {lang === 'ar' ? 'لم يتم العثور على كوادر مطابقة' : 'No matching staff members found'}
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.uid}
                    onClick={() => handleStartDirectChat(user)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 text-left transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center">
                        {(user.displayName || user.nameEn || 'S').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {lang === 'ar' ? (user.nameAr || user.displayName) : (user.nameEn || user.displayName)}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{user.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-teal-800 dark:text-teal-400 font-mono">
                      {user.role}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
