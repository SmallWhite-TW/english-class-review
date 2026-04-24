/**
 * Web Speech API wrapper.
 *
 * Uses the browser's built-in SpeechSynthesis — no API key, no network call.
 * Voice quality depends on the user's OS (macOS/iOS have good English voices;
 * Chromium on Linux falls back to espeak which is robotic). Acceptable
 * tradeoff for an English-learning site: zero cost and zero latency.
 */

export type SpeakLang = 'en-US' | 'en-GB' | 'zh-TW' | 'zh-CN';

export interface SpeakOptions {
  lang?: SpeakLang;
  rate?: number; // 0.1 - 10, default 1
  pitch?: number; // 0 - 2, default 1
  voice?: SpeechSynthesisVoice | null;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

interface VoicePreference {
  lang: SpeakLang;
  preferred: string[];
}

const VOICE_PREFERENCES: VoicePreference[] = [
  {
    lang: 'en-US',
    preferred: ['Samantha', 'Karen', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny'],
  },
  {
    lang: 'en-GB',
    preferred: ['Daniel', 'Google UK English Female', 'Microsoft Libby'],
  },
  {
    lang: 'zh-TW',
    preferred: ['Mei-Jia', 'Google 國語（臺灣）', 'Microsoft HsiaoChen'],
  },
  {
    lang: 'zh-CN',
    preferred: ['Tingting', 'Google 普通话（中国大陆）', 'Microsoft Xiaoxiao'],
  },
];

let cachedVoices: SpeechSynthesisVoice[] | null = null;
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  if (!('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

export function isSupported(): boolean {
  return getSynth() !== null;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = getSynth();
  if (!synth) return Promise.resolve([]);
  if (cachedVoices !== null && cachedVoices.length > 0) {
    return Promise.resolve(cachedVoices);
  }
  if (voicesReady !== null) return voicesReady;

  voicesReady = new Promise((resolve) => {
    const initial = synth.getVoices();
    if (initial.length > 0) {
      cachedVoices = initial;
      resolve(initial);
      return;
    }
    const handler = () => {
      const list = synth.getVoices();
      if (list.length > 0) {
        cachedVoices = list;
        synth.removeEventListener('voiceschanged', handler);
        resolve(list);
      }
    };
    synth.addEventListener('voiceschanged', handler);
    // Give up after 2s; we'll just use whatever comes back.
    setTimeout(() => {
      if (cachedVoices === null) {
        cachedVoices = synth.getVoices();
        synth.removeEventListener('voiceschanged', handler);
        resolve(cachedVoices);
      }
    }, 2000);
  });

  return voicesReady;
}

async function pickVoice(lang: SpeakLang): Promise<SpeechSynthesisVoice | null> {
  const all = await loadVoices();
  if (all.length === 0) return null;

  const pref = VOICE_PREFERENCES.find((p) => p.lang === lang);
  if (pref) {
    for (const name of pref.preferred) {
      const match = all.find((v) => v.name.includes(name));
      if (match) return match;
    }
  }

  const langMatch = all.find((v) => v.lang === lang);
  if (langMatch) return langMatch;

  const prefix = lang.split('-')[0];
  return all.find((v) => v.lang.startsWith(prefix ?? '')) ?? null;
}

function detectLang(text: string): SpeakLang {
  return /[一-鿿]/.test(text) ? 'zh-TW' : 'en-US';
}

export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const synth = getSynth();
  if (!synth) {
    options.onError?.(new Error('SpeechSynthesis not supported'));
    return;
  }
  synth.cancel(); // stop whatever is running

  const lang = options.lang ?? detectLang(text);
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = options.rate ?? 0.95;
  utter.pitch = options.pitch ?? 1;

  const voice = options.voice ?? (await pickVoice(lang));
  if (voice) utter.voice = voice;

  utter.onstart = () => options.onStart?.();
  utter.onend = () => options.onEnd?.();
  utter.onerror = (err) => options.onError?.(err);

  synth.speak(utter);
}

export function stop(): void {
  getSynth()?.cancel();
}
