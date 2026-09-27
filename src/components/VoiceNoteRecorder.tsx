import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Globe, AlertCircle, Check, Volume2, Sparkles, X, RotateCcw } from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';

// Web Speech API interface declarations for TypeScript
interface IWindowSpeechRecognition extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface VoiceNoteRecorderProps {
  onTranscript: (finalChunk: string) => void;
  className?: string;
  defaultLang?: 'en-US' | 'ar-SA';
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  onTranscript,
  className = '',
  defaultLang,
}) => {
  const { lang } = useTranslation();
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [selectedLang, setSelectedLang] = useState<'en-US' | 'ar-SA'>(
    defaultLang || (lang === 'ar' ? 'ar-SA' : 'en-US')
  );
  const [interimText, setInterimText] = useState<string>('');
  const [lastTranscribedPhrase, setLastTranscribedPhrase] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  const recognitionRef = useRef<any>(null);
  const isExplicitStopRef = useRef<boolean>(false);
  const timerRef = useRef<any>(null);

  // Check support on mount
  useEffect(() => {
    const win = window as IWindowSpeechRecognition;
    const SpeechAPI = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechAPI) {
      setIsSupported(false);
    }
  }, []);

  // Update selected language if defaultLang changes or initial mount
  useEffect(() => {
    if (defaultLang) {
      setSelectedLang(defaultLang);
    }
  }, [defaultLang]);

  // Clean up timer and speech on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          isExplicitStopRef.current = true;
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Timer while listening
  useEffect(() => {
    if (isListening) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isListening]);

  // Clinical Punctuation and formatting helper
  const formatClinicalDictation = (text: string, currentLang: string): string => {
    let formatted = text;
    if (currentLang === 'ar-SA') {
      formatted = formatted
        .replace(/\b(سطر جديد|فقرة جديدة)\b/gi, '\n')
        .replace(/\b(فاصلة|فارزة)\b/gi, '،')
        .replace(/\b(نقطة|نقطه|نهاية الجملة)\b/gi, '.')
        .replace(/\b(نقطتان|نقطتين فوق بعض)\b/gi, ':');
    } else {
      formatted = formatted
        .replace(/\b(new line|next line|enter)\b/gi, '\n')
        .replace(/\b(full stop|period)\b/gi, '.')
        .replace(/\b(comma)\b/gi, ',')
        .replace(/\b(colon)\b/gi, ':')
        .replace(/\b(dash|hyphen)\b/gi, ' - ');
    }
    return formatted;
  };

  const startListening = () => {
    setErrorMsg(null);
    setInterimText('');
    setLastTranscribedPhrase('');
    isExplicitStopRef.current = false;

    const win = window as IWindowSpeechRecognition;
    const SpeechAPI = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechAPI) {
      setErrorMsg(
        lang === 'ar'
          ? 'واجهة التعرف الصوتي (SpeechRecognition API) غير مدعومة في هذا المتصفح. يُرجى استخدام متصفح Google Chrome أو Microsoft Edge.'
          : 'SpeechRecognition API is not supported in this browser. Please use Google Chrome or Microsoft Edge.'
      );
      return;
    }

    try {
      const recognition = new SpeechAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLang;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalizedChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalizedChunk += transcript + ' ';
          } else {
            currentInterim += transcript;
          }
        }

        if (currentInterim) {
          setInterimText(currentInterim);
        }

        if (finalizedChunk.trim()) {
          const cleanChunk = formatClinicalDictation(finalizedChunk.trim(), selectedLang);
          setLastTranscribedPhrase(cleanChunk);
          setInterimText('');
          onTranscript(cleanChunk);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error event:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMsg(
            lang === 'ar'
              ? 'تم حظر إذن الميكروفون. يُرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح.'
              : 'Microphone permission denied. Please allow microphone access in your browser settings.'
          );
          setIsListening(false);
        } else if (event.error === 'no-speech') {
          // Keep listening or ignore transient silence
        } else if (event.error === 'network') {
          setErrorMsg(
            lang === 'ar'
              ? 'يتطلب التعرف على الصوت اتصالاً بالإنترنت لتشغيل نموذج الصوت للمتصفح.'
              : 'Network connection required for browser speech recognition service.'
          );
          setIsListening(false);
        } else {
          // Other transient errors
          if (!isExplicitStopRef.current) {
            console.log('Transient speech recognition warning:', event.error);
          }
        }
      };

      recognition.onend = () => {
        // If the user hasn't explicitly clicked stop, and recognition ended due to silence,
        // we can gracefully restart it to keep seamless dictation going.
        if (!isExplicitStopRef.current && isListening) {
          try {
            recognition.start();
            return;
          } catch {}
        }
        setIsListening(false);
        setInterimText('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start SpeechRecognition:', err);
      setErrorMsg(
        lang === 'ar'
          ? `تعذر بدء التسجيل الصوتي: ${err.message || 'خطأ غير معروف'}`
          : `Failed to initiate voice recording: ${err.message || 'Unknown error'}`
      );
      setIsListening(false);
    }
  };

  const stopListening = () => {
    isExplicitStopRef.current = true;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <div className={`p-2.5 bg-amber-950/20 border border-amber-800/40 rounded-xl text-amber-300 text-[11px] flex items-center gap-2 ${className}`}>
        <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
        <span>
          {lang === 'ar'
            ? 'الإملاء الصوتي غير مدعوم في هذا المتصفح (ينصح باستخدام متصفح Chrome أو Edge).'
            : 'Voice dictation is not supported in this browser (Chrome or Edge recommended).'}
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Voice Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-2.5 bg-[#090f1d] border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2">
          {/* Main Record / Stop Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md select-none ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-2 ring-rose-400/40'
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold active:scale-95'
            }`}
            title={isListening ? (lang === 'ar' ? 'إيقاف التسجيل الصوتي' : 'Stop voice recording') : (lang === 'ar' ? 'بدء التسجيل الصوتي' : 'Start voice recording')}
          >
            {isListening ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-200 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                <MicOff className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إيقاف التسجيل' : 'Stop Recording'}</span>
                <span className="font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded ml-1">
                  {formatTimer(recordingSeconds)}
                </span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تسجيل صوتي (Voice Note)' : 'Record Voice Note'}</span>
              </>
            )}
          </button>

          {/* Audio Wave Effect when recording */}
          {isListening && (
            <div className="hidden sm:flex items-center gap-0.5 px-2 py-1 bg-rose-950/30 border border-rose-800/40 rounded-md">
              <span className="w-1 h-3 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1 h-4 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1 h-2 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.45s]"></span>
              <span className="w-1 h-5 bg-rose-400 rounded-full animate-bounce"></span>
              <span className="w-1 h-3 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.2s]"></span>
              <span className="text-[10px] text-rose-300 font-semibold ml-1.5 font-mono">
                {lang === 'ar' ? 'جاري الاستماع...' : 'Listening...'}
              </span>
            </div>
          )}
        </div>

        {/* Dictation Language Selector */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
            <Globe className="w-3 h-3 text-teal-400" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'لغة الإملاء:' : 'Dictation Lang:'}</span>
          </div>
          <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[10px]">
            <button
              type="button"
              disabled={isListening}
              onClick={() => setSelectedLang('en-US')}
              className={`px-2 py-1 rounded font-semibold transition-all cursor-pointer ${
                selectedLang === 'en-US'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              } ${isListening ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              English (US)
            </button>
            <button
              type="button"
              disabled={isListening}
              onClick={() => setSelectedLang('ar-SA')}
              className={`px-2 py-1 rounded font-semibold transition-all cursor-pointer ${
                selectedLang === 'ar-SA'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              } ${isListening ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              العربية (SA)
            </button>
          </div>
        </div>
      </div>

      {/* Live Interim Transcription Floating Display */}
      {isListening && interimText && (
        <div className="p-2.5 bg-teal-950/30 border border-teal-500/40 rounded-xl text-teal-200 text-xs flex items-start gap-2 animate-in fade-in duration-150">
          <Sparkles className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5 animate-spin" style={{ animationDuration: '4s' }} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-teal-400 font-bold uppercase tracking-wider mb-0.5">
              {lang === 'ar' ? 'التعرف اللحظي (جاري التحويل للنص المكتوب...):' : 'Live Real-time Transcription:'}
            </div>
            <p className="font-mono italic text-white/90 leading-relaxed break-words">
              "{interimText}"
            </p>
          </div>
        </div>
      )}

      {/* Last Finalized Phrase Toast Badge */}
      {!isListening && lastTranscribedPhrase && (
        <div className="p-2 bg-emerald-950/20 border border-emerald-800/40 rounded-lg text-emerald-300 text-[11px] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="font-semibold text-emerald-400">
              {lang === 'ar' ? 'تمت إضافة الملاحظة الصوتية مباشرة:' : 'Observation transcribed to note:'}
            </span>
            <span className="text-slate-300 truncate max-w-xs font-mono">
              "{lastTranscribedPhrase}"
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLastTranscribedPhrase('')}
            className="p-1 hover:text-white text-emerald-400/80 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Error alert banner */}
      {errorMsg && (
        <div className="p-2.5 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-300 text-[11px] flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-400 hover:text-white p-0.5 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
