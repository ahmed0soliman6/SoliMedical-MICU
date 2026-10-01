import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Globe, AlertCircle, Check, Sparkles, X, Loader2, Volume2 } from 'lucide-react';
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
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessingAi, setIsProcessingAi] = useState<boolean>(false);
  const [selectedLang, setSelectedLang] = useState<'en-US' | 'ar-SA'>(
    defaultLang || (lang === 'ar' ? 'ar-SA' : 'en-US')
  );
  const [interimText, setInterimText] = useState<string>('');
  const [lastTranscribedPhrase, setLastTranscribedPhrase] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  // References
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isExplicitStopRef = useRef<boolean>(false);
  const webSpeechTranscribedRef = useRef<boolean>(false);
  const timerRef = useRef<any>(null);

  // Update selected language if defaultLang changes
  useEffect(() => {
    if (defaultLang) {
      setSelectedLang(defaultLang);
    }
  }, [defaultLang]);

  // Clean up timer and media streams on unmount
  useEffect(() => {
    return () => {
      stopAllMedia();
    };
  }, []);

  // Timer while recording
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

  const stopAllMedia = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      try {
        isExplicitStopRef.current = true;
        recognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
  };

  // Clinical Punctuation and formatting helper
  const formatClinicalDictation = (text: string, currentLang: string): string => {
    let formatted = text;
    if (currentLang === 'ar-SA' || currentLang.startsWith('ar')) {
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

  // Fallback: Transcribe audio with Gemini AI endpoint
  const transcribeAudioBlobWithAI = async (audioBlob: Blob, targetLang: string) => {
    if (!audioBlob || audioBlob.size === 0) return;
    setIsProcessingAi(true);
    setErrorMsg(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const dataUrl = await base64Promise;
      const cleanBase64 = dataUrl.split(',')[1];
      const mimeType = audioBlob.type || 'audio/webm';

      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: cleanBase64,
          mimeType,
          lang: targetLang.startsWith('ar') ? 'ar' : 'en',
        }),
      });

      if (!response.ok) {
        throw new Error(`AI transcription failed with status ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.text && result.text.trim()) {
        const cleanChunk = formatClinicalDictation(result.text.trim(), targetLang);
        setLastTranscribedPhrase(cleanChunk);
        setInterimText('');
        onTranscript(cleanChunk);
      } else if (!webSpeechTranscribedRef.current) {
        setErrorMsg(
          lang === 'ar'
            ? 'لم يتم التقاط أي صوت واضح أثناء التسجيل. يُرجى التحدث بوضوح قرب الميكروفون.'
            : 'No clear speech detected. Please speak closer to the microphone and try again.'
        );
      }
    } catch (err: any) {
      console.warn('AI audio transcription error:', err);
      if (!webSpeechTranscribedRef.current) {
        setErrorMsg(
          lang === 'ar'
            ? 'تعذر تفريغ الصوت بالذكاء الاصطناعي. يُرجى التحقق من اتصال الإنترنت أو منح إذن الميكروفون.'
            : 'Voice transcription failed. Please verify microphone permission and connection.'
        );
      }
    } finally {
      setIsProcessingAi(false);
    }
  };

  const startListening = async () => {
    setErrorMsg(null);
    setInterimText('');
    setLastTranscribedPhrase('');
    isExplicitStopRef.current = false;
    webSpeechTranscribedRef.current = false;
    audioChunksRef.current = [];

    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            } 
          });
        } catch (constraintErr) {
          console.warn('Advanced audio constraints failed, trying simple audio stream:', constraintErr);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        mediaStreamRef.current = stream;
      }
    } catch (err: any) {
      console.warn('getUserMedia error:', err);
    }

    // 1. Initialize MediaRecorder for guaranteed audio recording & Gemini fallback if stream exists
    if (stream) {
      try {
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
        let selectedMime = '';
        for (const m of mimeTypes) {
          if (MediaRecorder.isTypeSupported(m)) {
            selectedMime = m;
            break;
          }
        }

        const mediaRecorder = selectedMime 
          ? new MediaRecorder(stream, { mimeType: selectedMime })
          : new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: selectedMime || 'audio/webm' 
          });
          // If web speech API didn't finalize anything or only interim, trigger AI transcription
          if (!webSpeechTranscribedRef.current && audioBlob.size > 1000) {
            transcribeAudioBlobWithAI(audioBlob, selectedLang);
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(250); // collect chunks every 250ms
      } catch (e) {
        console.warn('MediaRecorder init error:', e);
      }
    }

    // 2. Also initialize Web Speech API if supported for live instant streaming
    const win = window as IWindowSpeechRecognition;
    const SpeechAPI = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechAPI) {
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
            webSpeechTranscribedRef.current = true;
            const cleanChunk = formatClinicalDictation(finalizedChunk.trim(), selectedLang);
            setLastTranscribedPhrase(cleanChunk);
            setInterimText('');
            onTranscript(cleanChunk);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Web Speech Recognition error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
            if (!stream) {
              setErrorMsg(
                lang === 'ar'
                  ? 'تم رفض إذن الميكروفون. يرجى السماح للموقع باستخدام الميكروفون من أيقونة القفل 🔒 بمتصفحك.'
                  : 'Microphone permission denied. Please allow microphone access in your browser settings (lock icon 🔒).'
              );
            }
          }
        };

        recognition.onend = () => {
          if (!isExplicitStopRef.current && isListening) {
            try {
              recognition.start();
              return;
            } catch {}
          }
        };

        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {}
      } catch (err) {
        console.warn('SpeechRecognition start failed, fallback to MediaRecorder only:', err);
      }
    } else if (!stream) {
      setErrorMsg(
        lang === 'ar'
          ? 'لم نتمكن من الوصول للميكروفون. يرجى التأكد من توصيل الميكروفون والسماح بالإذن من المتصفح.'
          : 'Microphone is not available or permission was denied.'
      );
      return;
    }

    setIsListening(true);
  };

  const stopListening = () => {
    isExplicitStopRef.current = true;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (mediaStreamRef.current) {
      setTimeout(() => {
        try {
          mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        } catch {}
        mediaStreamRef.current = null;
      }, 500);
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

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Voice Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-2.5 bg-slate-50 dark:bg-[#090f1d] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white">
        <div className="flex items-center gap-2">
          {/* Main Record / Stop Button */}
          <button
            type="button"
            onClick={toggleListening}
            disabled={isProcessingAi}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md select-none ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-2 ring-rose-400/40'
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold active:scale-95 disabled:opacity-50'
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
            <div className="flex items-center gap-0.5 px-2 py-1 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-md">
              <span className="w-1 h-3 bg-rose-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1 h-4 bg-rose-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1 h-2 bg-rose-500 rounded-full animate-bounce [animation-delay:-0.45s]"></span>
              <span className="w-1 h-5 bg-rose-500 rounded-full animate-bounce"></span>
              <span className="w-1 h-3 bg-rose-500 rounded-full animate-bounce [animation-delay:-0.2s]"></span>
              <span className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold ml-1.5 font-mono">
                {lang === 'ar' ? 'جاري الاستماع...' : 'Listening...'}
              </span>
            </div>
          )}

          {/* AI Processing status */}
          {isProcessingAi && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-500/30 rounded-md text-teal-800 dark:text-teal-300 text-[11px] font-bold animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600 dark:text-teal-400" />
              <span>{lang === 'ar' ? 'جارِ تفريغ الصوت بالذكاء الاصطناعي (Gemini AI)...' : 'Transcribing voice with Gemini AI...'}</span>
            </div>
          )}
        </div>

        {/* Dictation Language Selector */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
            <Globe className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'لغة الإملاء:' : 'Dictation Lang:'}</span>
          </div>
          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-800 text-[10px]">
            <button
              type="button"
              disabled={isListening || isProcessingAi}
              onClick={() => setSelectedLang('en-US')}
              className={`px-2 py-1 rounded font-semibold transition-all cursor-pointer ${
                selectedLang === 'en-US'
                  ? 'bg-teal-100 text-teal-900 dark:bg-teal-500/20 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              } ${isListening ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              English (US)
            </button>
            <button
              type="button"
              disabled={isListening || isProcessingAi}
              onClick={() => setSelectedLang('ar-SA')}
              className={`px-2 py-1 rounded font-semibold transition-all cursor-pointer ${
                selectedLang === 'ar-SA'
                  ? 'bg-teal-100 text-teal-900 dark:bg-teal-500/20 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              } ${isListening ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              العربية (SA)
            </button>
          </div>
        </div>
      </div>

      {/* Live Interim Transcription Floating Display */}
      {isListening && interimText && (
        <div className="p-2.5 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-500/40 rounded-xl text-teal-900 dark:text-teal-200 text-xs flex items-start gap-2 animate-in fade-in duration-150">
          <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5 animate-spin" style={{ animationDuration: '4s' }} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-teal-700 dark:text-teal-400 font-bold uppercase tracking-wider mb-0.5">
              {lang === 'ar' ? 'التعرف اللحظي (جاري التحويل للنص المكتوب...):' : 'Live Real-time Transcription:'}
            </div>
            <p className="font-mono italic text-slate-900 dark:text-white/90 leading-relaxed break-words">
              "{interimText}"
            </p>
          </div>
        </div>
      )}

      {/* Last Finalized Phrase Toast Badge */}
      {!isListening && lastTranscribedPhrase && (
        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg text-emerald-900 dark:text-emerald-300 text-[11px] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {lang === 'ar' ? 'تمت إضافة الملاحظة الصوتية مباشرة:' : 'Observation transcribed to note:'}
            </span>
            <span className="text-slate-700 dark:text-slate-300 truncate max-w-xs font-mono">
              "{lastTranscribedPhrase}"
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLastTranscribedPhrase('')}
            className="p-1 hover:text-slate-900 dark:hover:text-white text-emerald-600 dark:text-emerald-400/80 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Error alert banner */}
      {errorMsg && (
        <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl text-rose-800 dark:text-rose-300 text-[11px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={startListening}
              className="px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-[10px] flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <Mic className="w-3 h-3" />
              <span>{lang === 'ar' ? 'إعادة المحاولة والتسجيل' : 'Retry Recording'}</span>
            </button>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
