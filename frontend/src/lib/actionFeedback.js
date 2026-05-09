const FEEDBACK_SETTINGS_KEY = "motionholic_os_action_feedback_enabled";

const FEEDBACK_PATTERNS = {
  approve: {
    frequency: 880,
    secondFrequency: 1175,
    duration: 0.09,
    vibrate: [35],
  },
  reject: {
    frequency: 220,
    secondFrequency: 165,
    duration: 0.12,
    vibrate: [60, 35, 60],
  },
  request: {
    frequency: 660,
    secondFrequency: 990,
    duration: 0.08,
    vibrate: [25, 30, 25],
  },
  default: {
    frequency: 520,
    secondFrequency: 780,
    duration: 0.08,
    vibrate: [30],
  },
};

export function isActionFeedbackEnabled() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(FEEDBACK_SETTINGS_KEY) !== "false";
}

export function setActionFeedbackEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FEEDBACK_SETTINGS_KEY, enabled ? "true" : "false");
}

function vibrate(pattern) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration is optional and unsupported on many desktop browsers.
  }
}

function playTone({ frequency, secondFrequency, duration }) {
  if (typeof window === "undefined") return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  try {
    const audioContext = new AudioContext();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(audioContext.destination);

    const firstOscillator = audioContext.createOscillator();
    firstOscillator.type = "sine";
    firstOscillator.frequency.setValueAtTime(frequency, now);
    firstOscillator.connect(gain);
    firstOscillator.start(now);
    firstOscillator.stop(now + duration);

    if (secondFrequency) {
      const secondOscillator = audioContext.createOscillator();
      secondOscillator.type = "triangle";
      secondOscillator.frequency.setValueAtTime(secondFrequency, now + duration * 0.35);
      secondOscillator.connect(gain);
      secondOscillator.start(now + duration * 0.35);
      secondOscillator.stop(now + duration + 0.02);
    }

    setTimeout(() => audioContext.close().catch(() => {}), (duration + 0.12) * 1000);
  } catch {
    // Browsers may block audio until the user interacts with the page.
  }
}

export function playActionFeedback(type = "default") {
  if (!isActionFeedbackEnabled()) return;

  const pattern = FEEDBACK_PATTERNS[type] || FEEDBACK_PATTERNS.default;

  vibrate(pattern.vibrate);
  playTone(pattern);
}
