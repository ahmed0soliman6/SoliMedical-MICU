import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, User, Users } from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useSystemSettings } from '../services/SettingsContext.tsx';

interface FloatingChatWidgetProps {
  onOpenChat: () => void;
}

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({ onOpenChat }) => {
  const { lang } = useTranslation();
  const { currentUser } = useAuth();
  const { settings } = useSystemSettings();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  return (
    <div className="fixed bottom-6 end-6 z-40">
      <button
        onClick={onOpenChat}
        className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-cyan-300/40"
        title={lang === 'ar' ? 'الدردشة السريرية المباشرة' : 'Clinical Direct Chat'}
      >
        <MessageSquare className="w-6 h-6 text-slate-950 transition-transform group-hover:scale-110" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black border-2 border-[#070d18] animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default FloatingChatWidget;
