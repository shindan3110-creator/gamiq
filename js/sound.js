// GAMIQ（ゲーミック） v2 - Sound Effects
//
// - All sounds are made in the browser with the Web Audio API
//   (no sound files to download, no copyright issues).
// - Phones only allow sound after the first tap,
//   so the audio starts on the first touch / click / key.
// - The player can turn sound ON / OFF (saved in this browser).
// - Sound never stops the game: every call is safe even if audio fails.
//
// Usage:
//   import { sfx } from "../sound.js";
//   sfx("slash");

const MUTE_KEY = "gamiq_v2_muted";


// Kept at load time: the daily challenge replaces Math.random with a
// seeded one while a game is played. Sounds must not use those numbers,
// or the layouts would change depending on how the player plays.
const nativeRandom = Math.random.bind(Math);

let ctx = null;
let master = null;
let noiseBuffer = null;

let muted = readMuted();

// Ads etc. can silence the game for a while (see ads.js).
let suspendedByAd = false;


/* ==========================================
SETUP
========================================== */

function getContext() {
  if (ctx) {
    return ctx;
  }

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  try {
    ctx = new AudioContextClass();

    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);

    // 1 second of white noise, reused for "sh", "bang", "boom"...
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = nativeRandom() * 2 - 1;
    }
  } catch (error) {
    ctx = null;
  }

  return ctx;
}

// Call once: sound starts working after the first user gesture.
export function initSound() {
  const unlock = () => {
    const audio = getContext();

    if (audio && audio.state === "suspended") {
      audio.resume().catch(() => {});
    }
  };

  ["pointerdown", "keydown", "touchend"].forEach(type => {
    window.addEventListener(type, unlock, { passive: true });
  });
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);

  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch (error) {
    // Ignore.
  }
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

// For ads: silence everything while an ad plays.
export function setAdSilence(value) {
  suspendedByAd = Boolean(value);
}

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch (error) {
    return false;
  }
}


/* ==========================================
BUILDING BLOCKS
========================================== */

function canPlay() {
  if (muted || suspendedByAd) {
    return null;
  }

  const audio = getContext();

  if (!audio || audio.state !== "running") {
    return null;
  }

  return audio;
}

// A simple tone with a fast attack and a decay.
function tone(audio, {
  type = "sine",
  freq = 440,
  to = null,          // pitch slide target
  start = 0,          // seconds from now
  length = 0.15,
  volume = 0.3,
  attack = 0.005
}) {
  const t0 = audio.currentTime + start;

  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  if (to) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + length);
  }

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);

  osc.connect(gain);
  gain.connect(master);

  osc.start(t0);
  osc.stop(t0 + length + 0.02);
}

// Filtered noise: "shh", "bang", "boom", "whoosh"...
function noise(audio, {
  filter = "bandpass",
  freq = 2000,
  to = null,
  q = 1,
  start = 0,
  length = 0.2,
  volume = 0.3,
  attack = 0.003
}) {
  const t0 = audio.currentTime + start;

  const source = audio.createBufferSource();
  source.buffer = noiseBuffer;

  const biquad = audio.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, t0);
  biquad.Q.value = q;

  if (to) {
    biquad.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + length);
  }

  const gain = audio.createGain();

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);

  source.connect(biquad);
  biquad.connect(gain);
  gain.connect(master);

  source.start(t0, nativeRandom() * 0.5);
  source.stop(t0 + length + 0.02);
}



// Crisp noise burst with exact shape: rises in "attack", stays for
// "hold", then drops to silence in "release" (straight line = clean cut).
// The filter frequency moves from "freq" to "to" over the whole sound.
function cut(audio, {
  filter = "bandpass", freq = 3000, to = null, q = 1,
  start = 0, attack = 0.004, hold = 0.02, release = 0.05, volume = 0.4
}) {
  const t0 = audio.currentTime + start;
  const total = attack + hold + release;

  const source = audio.createBufferSource();
  source.buffer = noiseBuffer;

  const biquad = audio.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, t0);
  biquad.Q.value = q;

  if (to) {
    biquad.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + total);
  }

  const gain = audio.createGain();

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + attack);
  gain.gain.setValueAtTime(volume, t0 + attack + hold);
  gain.gain.linearRampToValueAtTime(0, t0 + total);

  source.connect(biquad);
  biquad.connect(gain);
  gain.connect(master);

  source.start(t0, nativeRandom() * 0.5);
  source.stop(t0 + total + 0.02);
}


// Pitches of a real katana blade (measured from a sample sound).
// [frequency Hz, loudness]
const SHAKIN_PARTIALS = [
  [2773, 0.32], [3263, 0.83], [3396, 0.34], [4393, 0.27], [4650, 0.32],
  [4923, 1], [5296, 0.97], [5473, 0.22], [6643, 0.62], [6776, 0.33],
  [7613, 0.65], [8743, 0.61], [9730, 0.25], [10870, 0.27], [11940, 0.44], [13283, 0.43]
];

// The pitches that keep ringing after the cut ("kiiin").
const RING_PARTIALS = [
  [2778, 0.86], [3268, 1], [3397, 0.43], [4658, 0.3], [4926, 0.25],
  [5473, 0.31], [6779, 0.4], [7317, 0.15], [9255, 0.12], [11397, 0.15]
];

// Noise whose loudness flutters quickly (metal rubbing on metal).
function roughNoise(audio, { freq = 3000, start = 0, attack = 0.02, hold = 0.2, release = 0.05, volume = 0.2, rate = 45 }) {
  const t0 = audio.currentTime + start;
  const total = attack + hold + release;

  const source = audio.createBufferSource();
  source.buffer = noiseBuffer;

  const hp = audio.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = freq;

  const flutter = audio.createGain();
  flutter.gain.value = 0.55;

  const lfo = audio.createOscillator();
  lfo.type = "sawtooth";
  lfo.frequency.value = rate;

  const depth = audio.createGain();
  depth.gain.value = 0.45;

  lfo.connect(depth);
  depth.connect(flutter.gain);

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + attack);
  gain.gain.setValueAtTime(volume, t0 + attack + hold);
  gain.gain.linearRampToValueAtTime(0, t0 + total);

  source.connect(hp);
  hp.connect(flutter);
  flutter.connect(gain);
  gain.connect(master);

  source.start(t0, nativeRandom() * 0.5);
  source.stop(t0 + total + 0.02);
  lfo.start(t0);
  lfo.stop(t0 + total + 0.02);
}
/* ==========================================
SOUND LIBRARY
========================================== */

const SOUNDS = {
  /* ---------- WEAPONS ---------- */

  // Katana swing: "BWO" — the blade moving through the air.
  // (Short, so it can be played on every swing.)
  slash(audio) {
    cut(audio, { freq: 600, to: 1600, q: 1.2, attack: 0.07, hold: 0.01, release: 0.07, volume: 0.32 });
    cut(audio, { filter: "lowpass", freq: 900, start: 0.02, attack: 0.06, hold: 0.03, release: 0.08, volume: 0.25 });
  },

  // Katana hit: "BWO — SHAAA — KIIIN"
  // 1) whoosh with body
  // 2) steel scraping: noise through very narrow filters at the blade's
  //    own pitches + a fluttering "shaaa" (metal rubbing on metal)
  // 3) the ring that stays after the cut
  slashHit(audio) {
    cut(audio, { freq: 600, to: 1600, q: 1.2, attack: 0.08, hold: 0.02, release: 0.08, volume: 0.4 });
    cut(audio, { filter: "lowpass", freq: 900, start: 0.03, attack: 0.07, hold: 0.08, release: 0.12, volume: 0.35 });

    SHAKIN_PARTIALS.forEach(([f, lv]) => {
      cut(audio, { freq: f, q: 45, start: 0.08, attack: 0.06, hold: 0.22, release: 0.2, volume: 2.4 * lv });
    });
    roughNoise(audio, { freq: 3500, start: 0.08, attack: 0.06, hold: 0.2, release: 0.18, volume: 0.15, rate: 47 });

    RING_PARTIALS.forEach(([f, lv], i) => {
      tone(audio, { type: "sine", freq: f, start: 0.2, length: 1.0 - i * 0.04, volume: 0.24 * lv, attack: 0.15 });
      tone(audio, { type: "sine", freq: f * 1.003, start: 0.2, length: 0.9 - i * 0.04, volume: 0.13 * lv, attack: 0.15 });
    });
  },

  // Revolver: "BANG" — crack + low boom + short echo
  gunshot(audio) {
    noise(audio, { filter: "highpass", freq: 1200, length: 0.06, volume: 0.6, attack: 0.001 });
    noise(audio, { filter: "lowpass", freq: 1400, to: 120, length: 0.35, volume: 0.55, attack: 0.001 });
    tone(audio, { type: "sine", freq: 120, to: 45, length: 0.25, volume: 0.45 });
    noise(audio, { filter: "lowpass", freq: 700, to: 150, start: 0.12, length: 0.3, volume: 0.12 });
  },

  // Enemy shot from far away (quieter, duller)
  gunshotFar(audio) {
    noise(audio, { filter: "lowpass", freq: 900, to: 100, length: 0.3, volume: 0.35, attack: 0.001 });
    tone(audio, { type: "sine", freq: 90, to: 40, length: 0.22, volume: 0.3 });
  },

  // Sci-fi blaster: "pew"
  laser(audio) {
    tone(audio, { type: "square", freq: 1500, to: 220, length: 0.14, volume: 0.12 });
    tone(audio, { type: "sawtooth", freq: 900, to: 160, length: 0.12, volume: 0.06 });
  },

  // Explosion: "boom"
  explosion(audio) {
    noise(audio, { filter: "lowpass", freq: 2200, to: 80, length: 0.7, volume: 0.6, attack: 0.002 });
    tone(audio, { type: "sine", freq: 90, to: 30, length: 0.5, volume: 0.5 });
  },

  // Dart / arrow into a target: "thunk"
  thunk(audio) {
    noise(audio, { filter: "bandpass", freq: 900, q: 2, length: 0.08, volume: 0.4 });
    tone(audio, { type: "triangle", freq: 220, to: 110, length: 0.12, volume: 0.3 });
  },

  // Hit something / impact
  impact(audio) {
    noise(audio, { filter: "lowpass", freq: 1500, to: 200, length: 0.15, volume: 0.45 });
    tone(audio, { type: "sine", freq: 160, to: 60, length: 0.14, volume: 0.35 });
  },

  // Heavy thing lands: "dosun"
  thud(audio) {
    tone(audio, { type: "sine", freq: 110, to: 40, length: 0.22, volume: 0.5 });
    noise(audio, { filter: "lowpass", freq: 600, to: 120, length: 0.18, volume: 0.3 });
  },

  // Cartoon "bonk"
  bonk(audio) {
    tone(audio, { type: "triangle", freq: 600, to: 180, length: 0.18, volume: 0.35 });
    tone(audio, { type: "sine", freq: 300, to: 90, length: 0.2, volume: 0.25 });
  },

  // Car crash
  crash(audio) {
    noise(audio, { filter: "lowpass", freq: 3000, to: 200, length: 0.45, volume: 0.55, attack: 0.001 });
    noise(audio, { filter: "bandpass", freq: 2500, q: 4, start: 0.04, length: 0.3, volume: 0.15 });
    tone(audio, { type: "sine", freq: 80, to: 35, length: 0.3, volume: 0.4 });
  },

  /* ---------- MOVES ---------- */

  whoosh(audio) {
    noise(audio, { filter: "bandpass", freq: 500, to: 2500, q: 1.5, length: 0.22, volume: 0.22, attack: 0.05 });
  },

  jump(audio) {
    tone(audio, { type: "square", freq: 280, to: 620, length: 0.14, volume: 0.1 });
  },

  boost(audio) {
    tone(audio, { type: "sawtooth", freq: 200, to: 900, length: 0.35, volume: 0.1 });
    noise(audio, { filter: "bandpass", freq: 800, to: 3000, length: 0.35, volume: 0.15 });
  },

  // Wooden block slides: "koto"
  wood(audio) {
    tone(audio, { type: "triangle", freq: 520, to: 380, length: 0.07, volume: 0.25 });
    noise(audio, { filter: "bandpass", freq: 1200, q: 3, length: 0.05, volume: 0.15 });
  },

  // Small mechanical click (rotate a pipe, etc.)
  click(audio) {
    tone(audio, { type: "square", freq: 1800, length: 0.03, volume: 0.06 });
  },

  // Water flowing
  water(audio) {
    noise(audio, { filter: "bandpass", freq: 500, to: 1400, q: 0.8, length: 0.9, volume: 0.2, attack: 0.15 });
    for (let i = 0; i < 4; i++) {
      tone(audio, { type: "sine", freq: 500 + nativeRandom() * 500, to: 900 + nativeRandom() * 600, start: 0.1 + i * 0.13, length: 0.08, volume: 0.08 });
    }
  },

  // Ghost: spooky "fuwa~"
  ghost(audio) {
    tone(audio, { type: "sine", freq: 520, to: 360, length: 0.5, volume: 0.1, attack: 0.08 });
    tone(audio, { type: "sine", freq: 780, to: 560, length: 0.5, volume: 0.05, attack: 0.08 });
  },

  // Found something: "pop!"
  pop(audio) {
    tone(audio, { type: "sine", freq: 400, to: 1100, length: 0.1, volume: 0.25 });
  },

  // Memory tiles: each tile has its own note (like "Simon")
  note(audio, index = 0) {
    const scale = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 988, 1047, 1175, 1319, 1568, 1760];
    const freq = scale[Math.abs(Math.floor(index)) % scale.length];

    tone(audio, { type: "triangle", freq, length: 0.28, volume: 0.22 });
  },

  /* ---------- RHYTHM ---------- */

  // Big drum "DON" (the master)
  drum(audio) {
    tone(audio, { type: "sine", freq: 150, to: 62, length: 0.32, volume: 0.6, attack: 0.002 });
    noise(audio, { filter: "lowpass", freq: 900, to: 200, length: 0.08, volume: 0.25, attack: 0.001 });
  },

  // Your drum: a little higher, so you can hear the difference
  drumYou(audio) {
    tone(audio, { type: "sine", freq: 210, to: 90, length: 0.28, volume: 0.55, attack: 0.002 });
    noise(audio, { filter: "bandpass", freq: 1600, q: 1.2, length: 0.06, volume: 0.22, attack: 0.001 });
  },

  // Metronome (quiet hi-hat)
  hat(audio, accent = false) {
    noise(audio, { filter: "highpass", freq: 7000, length: accent ? 0.06 : 0.035, volume: accent ? 0.12 : 0.06, attack: 0.001 });
  },

  // Count-in "1, 2, 3, 4"
  count(audio, last = false) {
    tone(audio, { type: "square", freq: last ? 1320 : 880, length: 0.07, volume: 0.08 });
  },

  /* ---------- FEEDBACK ---------- */

  good(audio) {
    tone(audio, { type: "triangle", freq: 880, length: 0.08, volume: 0.18 });
    tone(audio, { type: "triangle", freq: 1320, start: 0.06, length: 0.1, volume: 0.15 });
  },

  perfect(audio) {
    [1047, 1319, 1568, 2093].forEach((freq, i) => {
      tone(audio, { type: "triangle", freq, start: i * 0.045, length: 0.16, volume: 0.13 });
    });
  },

  bad(audio) {
    tone(audio, { type: "sawtooth", freq: 180, to: 110, length: 0.22, volume: 0.14 });
  },

  hurt(audio) {
    tone(audio, { type: "square", freq: 320, to: 90, length: 0.28, volume: 0.14 });
    noise(audio, { filter: "lowpass", freq: 900, length: 0.15, volume: 0.2 });
  },

  tick(audio) {
    tone(audio, { type: "sine", freq: 1400, length: 0.03, volume: 0.08 });
  },

  // Game clear: short happy jingle
  clear(audio) {
    [523, 659, 784, 1047].forEach((freq, i) => {
      tone(audio, { type: "triangle", freq, start: i * 0.08, length: 0.22, volume: 0.16 });
    });
  },

  // Game failed: going down
  fail(audio) {
    [392, 330, 262].forEach((freq, i) => {
      tone(audio, { type: "triangle", freq, start: i * 0.12, length: 0.25, volume: 0.15 });
    });
  },

  // Level up: bigger fanfare
  levelUp(audio) {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    const times = [0, 0.1, 0.2, 0.3, 0.45, 0.55, 0.65];

    notes.forEach((freq, i) => {
      tone(audio, { type: "square", freq, start: times[i], length: i === notes.length - 1 ? 0.6 : 0.14, volume: 0.09 });
      tone(audio, { type: "triangle", freq: freq / 2, start: times[i], length: 0.18, volume: 0.08 });
    });
  }
};


/**
 * Play a sound effect by name. Safe to call anytime.
 * @param {string} name   e.g. "slash", "gunshot", "good"
 * @param {*} option      extra value for some sounds (note index)
 */
export function sfx(name, option) {
  // Tell the visual effects (juice.js) what just happened.
  // Sent even when the sound is muted.
  try {
    window.dispatchEvent(new CustomEvent("gamiq:sfx", { detail: name }));
  } catch (error) {
    // ignore
  }

  try {
    const audio = canPlay();

    if (!audio) {
      return;
    }

    SOUNDS[name]?.(audio, option);
  } catch (error) {
    // Never stop the game because of sound.
  }
}
