import { speak, stop, isSupported } from './speak.js';

let currentlyPlaying: HTMLElement | null = null;

function setPlayingState(el: HTMLElement, playing: boolean): void {
  el.classList.toggle('is-playing', playing);
  el.setAttribute('aria-pressed', String(playing));
}

function handleClick(event: Event): void {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  const text = target.dataset.speakText;
  if (!text) return;

  if (currentlyPlaying === target) {
    stop();
    setPlayingState(target, false);
    currentlyPlaying = null;
    return;
  }

  if (currentlyPlaying !== null) {
    setPlayingState(currentlyPlaying, false);
  }
  currentlyPlaying = target;
  setPlayingState(target, true);

  const lang = target.dataset.speakLang as 'en-US' | 'en-GB' | 'zh-TW' | 'zh-CN' | undefined;

  speak(text, {
    lang,
    onEnd: () => {
      if (currentlyPlaying === target) {
        setPlayingState(target, false);
        currentlyPlaying = null;
      }
    },
    onError: () => {
      setPlayingState(target, false);
      if (currentlyPlaying === target) currentlyPlaying = null;
    },
  }).catch(() => {
    setPlayingState(target, false);
    if (currentlyPlaying === target) currentlyPlaying = null;
  });
}

export function wireSpeakButtons(root: ParentNode = document): void {
  if (!isSupported()) {
    root
      .querySelectorAll<HTMLElement>('[data-speak-text]')
      .forEach((el) => {
        el.setAttribute('disabled', 'true');
        el.title = '此裝置不支援 Web Speech API';
      });
    return;
  }
  root.querySelectorAll<HTMLElement>('[data-speak-text]').forEach((el) => {
    if (el.dataset.speakWired === 'true') return;
    el.dataset.speakWired = 'true';
    el.addEventListener('click', handleClick);
  });
}

// Convenience for inline use
export { speak, stop, isSupported };
