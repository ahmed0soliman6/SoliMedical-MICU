import { NotificationType } from '../types/notification.ts';

/**
 * Web Audio API gentle tone generator for Soli Medical MICU
 * Generates custom gentle chimes for ICU clinical events:
 * - ADMISSION: Gentle uplifting 2-tone melodic chime (C5 -> E5)
 * - DISCHARGE / DEATH / TRANSFER: Gentle resolving 2-tone soft chime (E5 -> C5)
 * - SBAR_HANDOVER: Professional 3-note ascending clinical handover cascade (A4 -> C#5 -> E5)
 * - SBAR_RECEIVED: Affirmative crisp double chime (D5 -> A5)
 * - ISOLATION_CHANGE: Warm caution alert tone (B4 -> D#5)
 * - CRITICAL_TELEMETRY: Dual pulse telemetry monitor chime
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (err) {
    console.warn('Web Audio Context initialization warning:', err);
    return null;
  }
}

function playTonePair(
  ctx: AudioContext, 
  f1: number, 
  f2: number, 
  vol: number = 0.12, 
  dur: number = 0.14
) {
  const t0 = ctx.currentTime;
  
  // Note 1
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(f1, t0);
  gain1.gain.setValueAtTime(vol, t0);
  gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(t0);
  osc1.stop(t0 + dur);

  // Note 2
  const t1 = t0 + dur * 0.75;
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(f2, t1);
  gain2.gain.setValueAtTime(vol * 1.1, t1);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t1 + dur * 1.5);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t1);
  osc2.stop(t1 + dur * 1.5);
}

function playToneTriple(
  ctx: AudioContext, 
  f1: number, 
  f2: number, 
  f3: number, 
  vol: number = 0.12, 
  dur: number = 0.12
) {
  const t0 = ctx.currentTime;
  
  // Note 1
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(f1, t0);
  gain1.gain.setValueAtTime(vol, t0);
  gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(t0);
  osc1.stop(t0 + dur);

  // Note 2
  const t1 = t0 + dur * 0.7;
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(f2, t1);
  gain2.gain.setValueAtTime(vol, t1);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t1 + dur);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t1);
  osc2.stop(t1 + dur);

  // Note 3
  const t2 = t1 + dur * 0.7;
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(f3, t2);
  gain3.gain.setValueAtTime(vol * 1.15, t2);
  gain3.gain.exponentialRampToValueAtTime(0.0001, t2 + dur * 1.6);
  osc3.connect(gain3);
  gain3.connect(ctx.destination);
  osc3.start(t2);
  osc3.stop(t2 + dur * 1.6);
}

function playPulseTone(
  ctx: AudioContext, 
  freq: number, 
  vol: number = 0.15
) {
  const t0 = ctx.currentTime;
  
  // Pulse 1
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq, t0);
  gain1.gain.setValueAtTime(vol, t0);
  gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(t0);
  osc1.stop(t0 + 0.12);

  // Pulse 2
  const t1 = t0 + 0.16;
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 1.1, t1);
  gain2.gain.setValueAtTime(vol, t1);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.18);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t1);
  osc2.stop(t1 + 0.18);
}

export function playGentleNotificationTone(type: NotificationType): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    switch (type) {
      case 'ADMISSION':
        // C5 (523.25 Hz) -> E5 (659.25 Hz) - Uplifting hospital admission chime
        playTonePair(ctx, 523.25, 659.25, 0.13, 0.15);
        break;

      case 'DISCHARGE':
      case 'DEATH':
      case 'TRANSFER':
        // E5 (659.25 Hz) -> C5 (523.25 Hz) - Soft resolution tone
        playTonePair(ctx, 659.25, 523.25, 0.12, 0.18);
        break;

      case 'SBAR_HANDOVER':
        // A4 (440 Hz) -> C#5 (554.37 Hz) -> E5 (659.25 Hz) - 3-note shift handover melody
        playToneTriple(ctx, 440.0, 554.37, 659.25, 0.13, 0.13);
        break;

      case 'SBAR_RECEIVED':
        // D5 (587.33 Hz) -> A5 (880 Hz) - Crisp affirmative confirmation chime
        playTonePair(ctx, 587.33, 880.0, 0.14, 0.13);
        break;

      case 'ISOLATION_CHANGE':
        // B4 (493.88 Hz) -> D#5 (622.25 Hz) - Warm caution indicator
        playTonePair(ctx, 493.88, 622.25, 0.14, 0.16);
        break;

      case 'CRITICAL_TELEMETRY':
      default:
        // Medical alert pulse
        playPulseTone(ctx, 784.0, 0.16);
        break;
    }
  } catch (e) {
    console.warn('Unable to play gentle notification audio:', e);
  }
}
