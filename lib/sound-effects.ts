'use client';

export type SoundEffectType =
  | 'menu-open'
  | 'menu-close'
  | 'accordion-open'
  | 'accordion-close'
  | 'feedback-step';

export const DEFAULT_SOUND_FILES: Record<SoundEffectType, string> = {
  'menu-open': '/sounds/menu-open.wav',
  'menu-close': '/sounds/menu-close.wav',
  'accordion-open': '/sounds/accordion-open.wav',
  'accordion-close': '/sounds/accordion-close.wav',
  'feedback-step': '/sounds/feedback-step.wav',
};

export interface SoundSynthesisSpec {
  type: SoundEffectType;
  durationMs: number;
  startFreqHz: number;
  endFreqHz: number;
  filterFreqHz: number;
  peakGain: number;
}

/**
 * Pure function returning the acoustic synthesis parameters for each UI interaction sound.
 * Used as fallback and reference timing alongside custom audio files in /public/sounds/.
 */
export function getSoundSynthesisSpec(
  type: SoundEffectType,
  velocityPxPerSec = 0
): SoundSynthesisSpec {
  const speedFactor = Math.min(1, Math.abs(velocityPxPerSec) / 1400);

  switch (type) {
    case 'menu-open':
      return {
        type,
        durationMs: 320,
        startFreqHz: 196,
        endFreqHz: 330,
        filterFreqHz: 960,
        peakGain: 0.14,
      };
    case 'menu-close':
      return {
        type,
        durationMs: 280,
        startFreqHz: 310,
        endFreqHz: 174,
        filterFreqHz: 680,
        peakGain: 0.13,
      };
    case 'accordion-open':
      return {
        type,
        durationMs: 145,
        startFreqHz: 420,
        endFreqHz: 640,
        filterFreqHz: 1450,
        peakGain: 0.11,
      };
    case 'accordion-close':
      return {
        type,
        durationMs: 125,
        startFreqHz: 560,
        endFreqHz: 340,
        filterFreqHz: 1050,
        peakGain: 0.10,
      };
    case 'feedback-step': {
      const pitchBoost = Math.round(speedFactor * 140);
      return {
        type,
        durationMs: 42,
        startFreqHz: 880 + pitchBoost,
        endFreqHz: 320 + Math.round(pitchBoost * 0.4),
        filterFreqHz: 1850 + pitchBoost * 2,
        peakGain: Number((0.075 + speedFactor * 0.035).toFixed(4)),
      };
    }
  }
}

/**
 * Pure helper that determines whether the feedback carousel crossed into a new center slot
 * and should emit a 'feedback-step' tick sound.
 */
export function detectFeedbackSlotStep(
  previousSlot: number | null,
  scrollX: number,
  cardSize: number,
  cardGap: number
): { currentSlot: number; stepped: boolean } {
  const stride = Math.max(1, cardSize + Math.max(4, cardGap));
  const rawSlot = Math.round(-scrollX / stride);
  const currentSlot = rawSlot === 0 ? 0 : rawSlot;

  if (previousSlot === null) {
    return { currentSlot, stepped: false };
  }

  return {
    currentSlot,
    stepped: currentSlot !== previousSlot,
  };
}

let sharedAudioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let lastStepSoundTimeMs = 0;

const customSoundUrls: Record<SoundEffectType, string> = { ...DEFAULT_SOUND_FILES };
const customAudioBuffers = new Map<SoundEffectType, AudioBuffer>();
const rawArrayBuffers = new Map<SoundEffectType, ArrayBuffer>();

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }

  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }

  return sharedAudioCtx;
}

/**
 * Fetches and preloads custom sound files from /public/sounds (via /api/sounds)
 * so user-provided audio files play with zero latency on interaction.
 */
export async function preloadCustomSoundsFromFolder(
  onProgressItem?: () => void
): Promise<Record<SoundEffectType, string>> {
  if (typeof window === 'undefined') {
    return { ...customSoundUrls };
  }

  try {
    const res = await fetch('/api/sounds', { cache: 'no-store' });
    const data = await res.json();
    if (data?.sounds && typeof data.sounds === 'object') {
      (Object.keys(DEFAULT_SOUND_FILES) as SoundEffectType[]).forEach((type) => {
        if (typeof data.sounds[type] === 'string' && data.sounds[type]) {
          customSoundUrls[type] = data.sounds[type];
        }
      });
    }
  } catch {
    // Keep DEFAULT_SOUND_FILES if API unreachable
  }

  const types = Object.keys(customSoundUrls) as SoundEffectType[];
  await Promise.all(
    types.map(async (type) => {
      try {
        const res = await fetch(customSoundUrls[type]);
        if (res.ok) {
          const arrBuf = await res.arrayBuffer();
          rawArrayBuffers.set(type, arrBuf.slice(0));
          const ctx = getAudioContext();
          if (ctx) {
            const decoded = await ctx.decodeAudioData(arrBuf.slice(0));
            customAudioBuffers.set(type, decoded);
          }
        }
      } catch {
        // Fallback to synthesizer if custom file cannot be decoded
      } finally {
        if (onProgressItem) {
          onProgressItem();
        }
      }
    })
  );

  return { ...customSoundUrls };
}

function getSoftNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 0.4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.06 * white) / 1.06;
    data[i] = lastOut * 2.4;
  }
  noiseBuffer = buffer;
  return buffer;
}

/**
 * Plays the user's custom audio file from /public/sounds/ if loaded, or falls back
 * seamlessly to the Web Audio API tactile synthesizer.
 */
export function playUiSoundEffect(
  type: SoundEffectType,
  velocityPxPerSec = 0
): SoundSynthesisSpec {
  const spec = getSoundSynthesisSpec(type, velocityPxPerSec);

  if (typeof window === 'undefined') {
    return spec;
  }

  const nowMs = performance.now();
  if (type === 'feedback-step') {
    if (nowMs - lastStepSoundTimeMs < 44) {
      return spec;
    }
    lastStepSoundTimeMs = nowMs;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return spec;
  }

  // Decode lazily if ArrayBuffer was fetched before AudioContext was created
  if (!customAudioBuffers.has(type) && rawArrayBuffers.has(type)) {
    const raw = rawArrayBuffers.get(type);
    if (raw) {
      ctx
        .decodeAudioData(raw.slice(0))
        .then((decoded) => {
          customAudioBuffers.set(type, decoded);
        })
        .catch(() => {});
    }
  }

  // 1. Play user's custom audio buffer from /public/sounds/ if decoded
  const customBuffer = customAudioBuffers.get(type);
  if (customBuffer) {
    try {
      const source = ctx.createBufferSource();
      source.buffer = customBuffer;
      if (type === 'feedback-step') {
        const speedFactor = Math.min(1, Math.abs(velocityPxPerSec) / 1400);
        source.playbackRate.setValueAtTime(0.96 + speedFactor * 0.14, ctx.currentTime);
      }
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.85, ctx.currentTime);
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return spec;
    } catch {
      // Fall through to synthesized sound if buffer playback fails
    }
  }

  // 2. Fallback Web Audio API synthesizer
  try {
    const now = ctx.currentTime;
    const durSec = spec.durationMs / 1000;

    if (type === 'menu-open' || type === 'menu-close') {
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = getSoftNoiseBuffer(ctx);

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.Q.setValueAtTime(1.8, now);
      bandpass.frequency.setValueAtTime(type === 'menu-open' ? 260 : 880, now);
      bandpass.frequency.exponentialRampToValueAtTime(
        type === 'menu-open' ? 960 : 220,
        now + durSec
      );

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(spec.peakGain * 0.55, now + durSec * 0.25);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);

      noiseSrc.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSrc.start(now);
      noiseSrc.stop(now + durSec + 0.02);

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(spec.startFreqHz, now);
      osc.frequency.exponentialRampToValueAtTime(spec.endFreqHz, now + durSec * 0.88);

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(spec.filterFreqHz, now);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.linearRampToValueAtTime(spec.peakGain, now + 0.018);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);

      osc.connect(lowpass);
      lowpass.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durSec + 0.02);
    } else if (type === 'accordion-open' || type === 'accordion-close') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(spec.startFreqHz, now);
      osc.frequency.exponentialRampToValueAtTime(spec.endFreqHz, now + durSec);

      const clickOsc = ctx.createOscillator();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(spec.startFreqHz * 2.2, now);
      clickOsc.frequency.exponentialRampToValueAtTime(spec.endFreqHz * 0.9, now + 0.032);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(spec.peakGain, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(spec.peakGain * 0.45, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);

      osc.connect(gain);
      clickOsc.connect(clickGain);
      gain.connect(ctx.destination);
      clickGain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durSec + 0.015);
      clickOsc.start(now);
      clickOsc.stop(now + 0.038);
    } else if (type === 'feedback-step') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(spec.startFreqHz, now);
      osc.frequency.exponentialRampToValueAtTime(spec.endFreqHz, now + durSec);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(2.6, now);
      filter.frequency.setValueAtTime(spec.filterFreqHz, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(spec.peakGain, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durSec + 0.008);
    }
  } catch {
    // Ignore audio context errors in restricted environments
  }

  return spec;
}
