// GAMIQ（ゲーミック） v2 - Rhythm Games
//
// DRUM DUO (call & response, "Rhythm Heaven" style)
// - The master drummer plays a rhythm for one bar.
// - You copy the same rhythm in the next bar.
// - 4 rounds. Later rounds are harder.
// - Works WITH or WITHOUT sound:
//   beat lamps flash on every beat, and the rhythm bar shows
//   where the hits are, with a moving playhead.
// - Every hit is judged: PERFECT / GOOD / MISS.
//   Extra taps (mashing) cost points.

import { t } from "../i18n.js";
import { byLevel, byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createRhythmGames() {
  return [
    {
      id: "rhythm_drum_duo",
      type: "drum_duo",
      title: "DRUM DUO",
      rule: "LISTEN TO THE MASTER, THEN DRUM THE SAME RHYTHM!",
      skill: "REFLEX",
      theme: "rhythm",
      duration: 22000
    }
  ];
}

export function runRhythmGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "drum_duo") {
    return runDrumDuo({
      container,
      onComplete,
      level: game.level
    });
  }

  return () => {};
}


/* ==========================================
DRUM DUO
========================================== */

const ROUNDS = 4;
const SLOTS = 8; // eighth notes in one bar (4 beats)

const DRUMMER_SVG = (body, skin) => `
  <svg viewBox="0 0 120 140" aria-hidden="true">
    <ellipse cx="60" cy="132" rx="40" ry="6" fill="rgba(0,0,0,.35)"/>
    <path d="M30 120 Q28 78 60 74 Q92 78 90 120 Z" fill="${body}"/>
    <circle cx="60" cy="50" r="26" fill="${skin}"/>
    <path d="M34 44 Q60 14 86 44 L86 36 Q60 8 34 36 Z" fill="#2b2140"/>
    <rect x="34" y="40" width="52" height="6" rx="3" fill="#ff4d6a"/>
    <circle class="rh-eye" cx="50" cy="54" r="3.5" fill="#1d1a16"/>
    <circle class="rh-eye" cx="70" cy="54" r="3.5" fill="#1d1a16"/>
    <path class="rh-mouth" d="M52 64 Q60 70 68 64" stroke="#1d1a16" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g class="rh-arm">
      <rect x="84" y="80" width="10" height="34" rx="5" fill="${skin}" transform="rotate(-35 89 82)"/>
      <rect x="96" y="58" width="6" height="34" rx="3" fill="#d9a35b" transform="rotate(-35 99 60)"/>
    </g>
  </svg>
`;

const DRUM_SVG = `
  <svg viewBox="0 0 120 70" aria-hidden="true">
    <ellipse cx="60" cy="18" rx="54" ry="14" fill="#f3e3c3" stroke="#7a4b22" stroke-width="4"/>
    <path d="M6 18 L12 56 Q60 72 108 56 L114 18 Q60 34 6 18 Z" fill="#c2472f"/>
    <path d="M20 24 L24 58 M40 29 L42 64 M60 31 L60 66 M80 29 L78 64 M100 24 L96 58" stroke="#7a2a1a" stroke-width="3"/>
  </svg>
`;

function runDrumDuo({
  container,
  onComplete,
  level = 1
}) {
  /*
   * DIFFICULTY BY LEVEL
   * - Faster tempo (BPM 96 -> 140)
   * - More off-beat (eighth note) hits
   * - More hits in a bar
   * - Tighter timing windows
   */
  const bpm = byLevel(level, 96, 140);
  const beatMs = 60000 / bpm;
  const barMs = beatMs * 4;
  const slotMs = barMs / SLOTS;

  const offbeatRate = byLevel(level, 0, 0.55);
  const maxNotes = byLevelInt(level, 4, 6);

  const perfectWindow = byLevel(level, 75, 50);
  const goodWindow = byLevel(level, 150, 100);

  // Rounds get a little harder: round 1 is simple.
  const patterns = Array.from({ length: ROUNDS }, (_, round) =>
    makePattern(round)
  );

  let active = true;
  let frameId = null;
  let finishTimer = null;

  let perfect = 0;
  let good = 0;
  let missed = 0;
  let extra = 0;
  let combo = 0;
  let bestCombo = 0;

  // Timeline: 1 count-in bar, then (master bar, your bar) x ROUNDS
  const startAt = performance.now() + 500;
  const totalBars = 1 + ROUNDS * 2;

  // Notes the player must hit: { time, round, slot, judged, el }
  const targets = [];
  // Master notes: { time, round, slot, played, el }
  const calls = [];

  patterns.forEach((pattern, round) => {
    const masterBar = 1 + round * 2;
    const yourBar = masterBar + 1;

    pattern.forEach(slot => {
      calls.push({
        time: startAt + masterBar * barMs + slot * slotMs,
        round,
        slot,
        played: false
      });

      targets.push({
        time: startAt + yourBar * barMs + slot * slotMs,
        round,
        slot,
        judged: false
      });
    });
  });

  const totalNotes = targets.length;

  let lastBeat = -1;
  let shownBar = -1;


  container.innerHTML = `
    <div class="rh-game">

      <div class="rh-hud">
        <div>
          <span>ROUND</span>
          <strong data-rh-round>1 / ${ROUNDS}</strong>
        </div>

        <div>
          <span>PERFECT</span>
          <strong data-rh-perfect>0</strong>
        </div>

        <div>
          <span>COMBO</span>
          <strong data-rh-combo>0</strong>
        </div>
      </div>

      <div class="rh-stage" data-rh-stage>

        <div class="rh-lights" data-rh-lights>
          <i></i><i></i><i></i><i></i>
        </div>

        <div class="rh-call" data-rh-call>${t("rhythm.ready")}</div>

        <div class="rh-duo">
          <div class="rh-player rh-master" data-rh-master>
            <div class="rh-figure">${DRUMMER_SVG("#3f7cff", "#f2c9a0")}</div>
            <div class="rh-drum">${DRUM_SVG}</div>
            <div class="rh-don">DON!</div>
            <span class="rh-name">MASTER</span>
          </div>

          <div class="rh-player rh-you" data-rh-you>
            <div class="rh-figure">${DRUMMER_SVG("#ff9a3d", "#f6d2ae")}</div>
            <div class="rh-drum">${DRUM_SVG}</div>
            <div class="rh-don">DON!</div>
            <span class="rh-name">YOU</span>
          </div>
        </div>

        <div class="rh-bar">
          <div class="rh-track" data-rh-track>
            <i class="rh-beat-mark" style="left:0%"></i>
            <i class="rh-beat-mark" style="left:25%"></i>
            <i class="rh-beat-mark" style="left:50%"></i>
            <i class="rh-beat-mark" style="left:75%"></i>
            <div class="rh-playhead" data-rh-playhead></div>
          </div>
        </div>

        <div class="rh-judge" data-rh-judge></div>

      </div>

      <button type="button" class="rh-tap" data-rh-tap>
        ${t("rhythm.tap")}
      </button>

    </div>
  `;

  const stage = container.querySelector("[data-rh-stage]");
  const lights = [...container.querySelectorAll("[data-rh-lights] i")];
  const callEl = container.querySelector("[data-rh-call]");
  const master = container.querySelector("[data-rh-master]");
  const you = container.querySelector("[data-rh-you]");
  const track = container.querySelector("[data-rh-track]");
  const playhead = container.querySelector("[data-rh-playhead]");
  const judgeEl = container.querySelector("[data-rh-judge]");
  const tapButton = container.querySelector("[data-rh-tap]");

  const roundEl = container.querySelector("[data-rh-round]");
  const perfectEl = container.querySelector("[data-rh-perfect]");
  const comboEl = container.querySelector("[data-rh-combo]");

  // Everyone bobs to the beat.
  stage.style.setProperty("--beat", `${beatMs}ms`);


  /* ---------- PATTERNS ---------- */

  function makePattern(round) {
    // Round 1: 2-3 hits, Round 4: up to maxNotes
    const count = Math.min(
      maxNotes,
      2 + Math.floor(Math.random() * 2) + round
    );

    const onbeat = [0, 2, 4, 6];
    const offbeat = [1, 3, 5, 7];

    const chosen = new Set();

    // Always one hit on a strong beat, so the rhythm is readable.
    chosen.add(onbeat[Math.floor(Math.random() * 3)]);

    let guard = 0;

    while (chosen.size < count && guard < 50) {
      guard++;

      const useOff =
        round > 0 && Math.random() < offbeatRate;

      const pool = useOff ? offbeat : onbeat;

      chosen.add(pool[Math.floor(Math.random() * pool.length)]);
    }

    return [...chosen].sort((a, b) => a - b);
  }


  /* ---------- BAR DRAWING ---------- */

  function drawBar(bar) {
    track.querySelectorAll(".rh-note").forEach(note => note.remove());

    if (bar < 1) {
      return;
    }

    const round = Math.floor((bar - 1) / 2);
    const isYours = (bar - 1) % 2 === 1;

    const list = (isYours ? targets : calls).filter(n => n.round === round);

    list.forEach(note => {
      const el = document.createElement("i");

      el.className = `rh-note ${isYours ? "target" : "call"}`;
      el.style.left = `${(note.slot / SLOTS) * 100}%`;

      // A note on beat 1 can be judged a moment before its bar is drawn:
      // show that result right away.
      if (isYours && note.judged) {
        el.classList.add(
          note.score >= 1 ? "perfect" : note.score > 0 ? "good" : "miss"
        );
      }

      if (!isYours && note.played) {
        el.classList.add("played");
      }

      track.appendChild(el);

      note.el = el;
    });

    track.classList.toggle("yours", isYours);

    roundEl.textContent = `${round + 1} / ${ROUNDS}`;

    callEl.textContent = isYours ? t("rhythm.yourTurn") : t("rhythm.listen");
    callEl.className = `rh-call ${isYours ? "yours" : "listen"}`;

    master.classList.toggle("active", !isYours);
    you.classList.toggle("active", isYours);
  }


  /* ---------- HITS ---------- */

  function hitAnim(player) {
    player.classList.remove("hit");
    void player.offsetWidth;
    player.classList.add("hit");
  }

  function showJudge(text, type) {
    judgeEl.textContent = text;
    judgeEl.className = `rh-judge ${type}`;

    void judgeEl.offsetWidth;

    judgeEl.classList.add("show");
  }

  function judge(note, delta) {
    note.judged = true;

    const abs = Math.abs(delta);

    if (abs <= perfectWindow) {
      perfect++;
      combo++;
      note.el?.classList.add("perfect");
      showJudge("PERFECT", "perfect");
      note.score = 1;
    } else {
      good++;
      combo++;
      note.el?.classList.add("good");
      showJudge(delta < 0 ? t("rhythm.early") : t("rhythm.late"), "good");
      note.score = 0.6;
    }

    bestCombo = Math.max(bestCombo, combo);

    perfectEl.textContent = String(perfect);
    comboEl.textContent = String(combo);
  }

  function markMiss(note) {
    note.judged = true;
    note.score = 0;

    missed++;
    combo = 0;

    note.el?.classList.add("miss");
    comboEl.textContent = "0";

    showJudge("MISS", "miss");
  }

  function tap(event) {
    event?.preventDefault?.();

    if (!active) {
      return;
    }

    const now = performance.now();

    // Your drum always sounds and moves.
    sfx("drumYou");
    hitAnim(you);

    // The closest note you haven't hit yet
    let best = null;
    let bestDelta = Infinity;

    for (const note of targets) {
      if (note.judged) continue;

      const delta = now - note.time;

      if (Math.abs(delta) < Math.abs(bestDelta)) {
        best = note;
        bestDelta = delta;
      }
    }

    if (best && Math.abs(bestDelta) <= goodWindow) {
      judge(best, bestDelta);
      return;
    }

    // Tapped when nothing was there.
    extra++;
    combo = 0;
    comboEl.textContent = "0";

    showJudge(t("rhythm.extra"), "miss");
  }

  function onKey(event) {
    if (event.code === "Space" || event.key === "Enter") {
      if (!event.repeat) {
        tap(event);
      }
    }
  }


  /* ---------- MAIN LOOP ---------- */

  function frame() {
    if (!active) {
      return;
    }

    const now = performance.now();
    const elapsed = now - startAt;

    // Metronome + beat lamps
    const beat = Math.floor(elapsed / beatMs);

    if (elapsed >= 0 && beat !== lastBeat && beat < totalBars * 4) {
      lastBeat = beat;

      const inBar = beat % 4;
      const bar = Math.floor(beat / 4);

      lights.forEach((light, i) => {
        light.classList.toggle("on", i === inBar);
      });

      stage.classList.remove("pulse");
      void stage.offsetWidth;
      stage.classList.add("pulse");

      if (bar === 0) {
        // Count-in: "1, 2, 3, 4"
        sfx("count", inBar === 3);
        callEl.textContent = String(inBar + 1);
        callEl.className = "rh-call count";
      } else {
        sfx("hat", inBar === 0);
      }
    }

    // New bar: draw its notes
    const bar = Math.floor(elapsed / barMs);

    if (elapsed >= 0 && bar !== shownBar && bar < totalBars) {
      shownBar = bar;
      drawBar(bar);
    }

    // Playhead
    if (elapsed >= 0 && bar >= 1 && bar < totalBars) {
      const inBar = (elapsed - bar * barMs) / barMs;
      playhead.style.left = `${Math.min(100, inBar * 100)}%`;
    }

    // Master plays his notes
    for (const note of calls) {
      if (!note.played && now >= note.time) {
        note.played = true;

        sfx("drum");
        hitAnim(master);
        note.el?.classList.add("played");
      }
    }

    // Notes you let pass = MISS
    for (const note of targets) {
      if (!note.judged && now - note.time > goodWindow) {
        markMiss(note);
      }
    }

    if (elapsed >= totalBars * barMs + goodWindow) {
      finish();
      return;
    }

    frameId = requestAnimationFrame(frame);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (!active) {
      return;
    }

    active = false;

    cancelAnimationFrame(frameId);

    const hitScore =
      (perfect * 1 + good * 0.6) / Math.max(1, totalNotes);

    // Mashing does not pay.
    const score = clamp((hitScore - extra * 0.04) * 100, 0, 100);

    const success = hitScore >= 0.6 && extra <= totalNotes;

    callEl.textContent = success ? "CLEAR!" : "FAILED";
    callEl.className = `rh-call ${success ? "yours" : "listen"}`;

    lights.forEach(light => light.classList.remove("on"));

    finishTimer = setTimeout(() => {
      onComplete?.({
        score: Math.round(score),

        adapt: Math.round(
          clamp(
            35 +
            hitScore * 45 +
            Math.min(1, bestCombo / totalNotes) * 20 -
            extra * 2,
            0,
            100
          )
        ),

        meta: {
          success,
          bpm: Math.round(bpm),
          notes: totalNotes,
          perfect,
          good,
          missed,
          extra,
          bestCombo
        }
      });
    }, 500);
  }


  /* ---------- START ---------- */

  tapButton.addEventListener("pointerdown", tap);
  stage.addEventListener("pointerdown", tap);
  window.addEventListener("keydown", onKey);

  frameId = requestAnimationFrame(frame);


  return () => {
    active = false;

    cancelAnimationFrame(frameId);
    clearTimeout(finishTimer);

    tapButton.removeEventListener("pointerdown", tap);
    stage.removeEventListener("pointerdown", tap);
    window.removeEventListener("keydown", onKey);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
