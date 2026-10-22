// GAMIQ（ゲーミック） v2 - Beat Swipe (rhythm game)
//
// BEAT SWIPE
// - Notes come down to the ring in time with the beat.
// - ● = TAP.  ↑ ↓ ← → = SWIPE that way (anywhere on the screen).
// - The closer to the beat, the better: PERFECT / GREAT / GOOD.
// - PC: SPACE = tap, arrow keys = swipe.
// - Higher level: faster tempo, more arrows, half-beat notes.

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createBeatSwipeGames() {
  return [
    {
      id: "speed_beat_swipe",
      type: "beat_swipe",
      title: "BEAT SWIPE",
      rule: "TAP THE DOTS, SWIPE THE ARROWS — RIGHT ON THE BEAT!",
      skill: "SPEED",
      theme: "club",
      duration: 25000
    }
  ];
}

export function runBeatSwipeGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "beat_swipe") {
    return runBeatSwipe({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const ARROWS = { up: "↑", down: "↓", left: "←", right: "→" };
const DIRS = Object.keys(ARROWS);

const WINDOWS = [
  { name: "perfect", ms: 70, points: 100 },
  { name: "great", ms: 130, points: 80 },
  { name: "good", ms: 200, points: 50 }
];

const MISS_AFTER_MS = 220;
const SWIPE_MIN_PX = 28;

function runBeatSwipe({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   tempo: 96 BPM (Lv1) -> 140 BPM (Lv10)
   *   notes fall for: 1.7s -> 1.35s before reaching the ring
   *   arrows (instead of taps): 45% -> 80%
   *   half-beat notes: never -> 35% of beats
   */
  const bpm = byLevel(level, 96, 140);
  const beatMs = 60000 / bpm;
  const approachMs = byLevel(level, 1700, 1350);
  const arrowRate = byLevel(level, 0.45, 0.8);
  const halfRate = byLevel(level, 0, 0.35);

  const BEATS = Math.round(byLevel(level, 28, 40));
  const LEAD_IN_BEATS = 4;

  let finished = false;
  let frame = 0;
  let startAt = 0; // time of beat 0
  let timers = [];
  let lastBeatPlayed = -LEAD_IN_BEATS - 1;

  let combo = 0;
  let bestCombo = 0;
  const counts = { perfect: 0, great: 0, good: 0, miss: 0 };

  /* ---------- CHART ---------- */

  const notes = [];

  for (let b = 0; b < BEATS; b++) {
    // A short rest now and then
    if (b > 2 && Math.random() < 0.12) continue;

    notes.push(makeNote(b));

    if (b < BEATS - 1 && Math.random() < halfRate) {
      notes.push(makeNote(b + 0.5));
    }
  }

  function makeNote(beat) {
    const isArrow = Math.random() < arrowRate;

    return {
      beat,
      kind: isArrow ? DIRS[Math.floor(Math.random() * 4)] : "tap",
      el: null,
      done: false
    };
  }

  const totalNotes = notes.length;

  container.innerHTML = `
    <div class="bs-game">

      <div class="bs-hud">
        <div>
          <span>COMBO</span>
          <strong data-bs-combo>0</strong>
        </div>
        <div>
          <span>SCORE</span>
          <strong data-bs-score>0</strong>
        </div>
        <div>
          <span>NOTES</span>
          <strong data-bs-left>${totalNotes}</strong>
        </div>
      </div>

      <div class="bs-stage" data-bs-stage>
        <div class="bs-lane" data-bs-lane>
          <div class="bs-ring" data-bs-ring></div>
        </div>

        <div class="bs-judge" data-bs-judge></div>
        <div class="bs-hint" data-bs-hint>${t("bs.hint")}</div>
      </div>

    </div>
  `;

  const stage = container.querySelector("[data-bs-stage]");
  const lane = container.querySelector("[data-bs-lane]");
  const ring = container.querySelector("[data-bs-ring]");
  const judgeEl = container.querySelector("[data-bs-judge]");
  const hintEl = container.querySelector("[data-bs-hint]");
  const comboEl = container.querySelector("[data-bs-combo]");
  const scoreEl = container.querySelector("[data-bs-score]");
  const leftEl = container.querySelector("[data-bs-left]");

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);

    timers.push(id);
  }

  const timeOf = beat => startAt + beat * beatMs;

  function points() {
    let sum = 0;
    notes.forEach(n => (sum += n.points || 0));
    return sum;
  }

  function updateHud() {
    comboEl.textContent = String(combo);
    scoreEl.textContent = String(Math.round(points() / totalNotes));
    leftEl.textContent = String(notes.filter(n => !n.done).length);
  }


  /* ---------- JUDGING ---------- */

  function showJudge(name) {
    judgeEl.className = "bs-judge";
    void judgeEl.offsetWidth;
    judgeEl.className = `bs-judge show ${name}`;
    judgeEl.textContent = name === "wrong" ? t("bs.wrong") : name.toUpperCase();
  }

  function judge(note, name, pts) {
    note.done = true;
    note.points = pts;

    counts[name === "wrong" ? "miss" : name]++;

    if (name === "miss" || name === "wrong") {
      combo = 0;
      note.el?.classList.add("missed");
    } else {
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      note.el?.classList.add("hit", name);

      ring.classList.remove("flash");
      void ring.offsetWidth;
      ring.classList.add("flash");
    }

    setTimeout(() => note.el?.remove(), 260);

    showJudge(name);
    updateHud();
  }

  // The player did something (tap or a swipe direction) at time "at"
  function act(kind, at) {
    if (finished || !startAt) return;

    hintEl.classList.add("hide");

    // The closest note that is not done yet
    let best = null;
    let bestDiff = Infinity;

    for (const note of notes) {
      if (note.done) continue;

      const diff = Math.abs(at - timeOf(note.beat));
      if (diff < bestDiff) {
        best = note;
        bestDiff = diff;
      }
    }

    // Nothing close enough: ignore (no penalty for extra taps)
    if (!best || bestDiff > WINDOWS[2].ms) return;

    if (best.kind !== kind) {
      judge(best, "wrong", 0);
      sfx("bad");
      return;
    }

    const win = WINDOWS.find(w => bestDiff <= w.ms);
    judge(best, win.name, win.points);

    sfx(win.name === "perfect" ? "perfect" : "drumYou");
  }


  /* ---------- INPUT ---------- */

  let pointer = null;

  function onDown(event) {
    if (finished) return;
    event.preventDefault();

    stage.setPointerCapture?.(event.pointerId);

    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      used: false
    };
  }

  function direction(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
    return dy > 0 ? "down" : "up";
  }

  function onMove(event) {
    if (!pointer || pointer.used || event.pointerId !== pointer.id) return;

    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;

    // Moved far enough: it is a swipe (timing = when the finger went down)
    if (Math.hypot(dx, dy) >= SWIPE_MIN_PX) {
      pointer.used = true;
      act(direction(dx, dy), pointer.at);
    }
  }

  function onUp(event) {
    if (!pointer || event.pointerId !== pointer.id) return;

    if (!pointer.used) {
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;

      if (Math.hypot(dx, dy) >= SWIPE_MIN_PX) {
        act(direction(dx, dy), pointer.at);
      } else {
        act("tap", pointer.at);
      }
    }

    pointer = null;
  }

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", () => (pointer = null));

  function onKey(event) {
    if (event.repeat) return;

    const map = {
      Space: "tap",
      Enter: "tap",
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right"
    };

    const kind = map[event.code];
    if (!kind) return;

    event.preventDefault();
    act(kind, performance.now());
  }

  window.addEventListener("keydown", onKey);


  /* ---------- LOOP ---------- */

  function loop(now) {
    if (finished) return;

    // Metronome: a hi-hat on every beat (count-in too)
    const beatNow = Math.floor((now - startAt) / beatMs);

    if (beatNow > lastBeatPlayed && beatNow < BEATS) {
      lastBeatPlayed = beatNow;

      sfx("hat", beatNow % 4 === 0);

      lane.classList.remove("pulse");
      void lane.offsetWidth;
      lane.classList.add("pulse");

      if (beatNow < 0) {
        showCount(-beatNow);
      }
    }

    const laneH = lane.clientHeight;
    const ringY = laneH * 0.82;

    for (const note of notes) {
      if (note.done) continue;

      const hitAt = timeOf(note.beat);
      const until = hitAt - now;

      // Create the note when it starts falling
      if (!note.el && until <= approachMs) {
        const el = document.createElement("div");
        el.className = note.kind === "tap" ? "bs-note tap" : `bs-note arrow ${note.kind}`;
        el.innerHTML = note.kind === "tap" ? "<i></i>" : `<b>${ARROWS[note.kind]}</b>`;
        lane.appendChild(el);
        note.el = el;
      }

      if (note.el) {
        const y = ringY * (1 - until / approachMs);
        note.el.style.transform = `translate(-50%, calc(${y}px - 50%))`;
      }

      // Too late
      if (until < -MISS_AFTER_MS) {
        judge(note, "miss", 0);
      }
    }

    if (notes.every(n => n.done)) {
      later(finish, 600);
      return;
    }

    frame = requestAnimationFrame(loop);
  }

  function showCount(n) {
    judgeEl.className = "bs-judge";
    void judgeEl.offsetWidth;
    judgeEl.className = "bs-judge show count";
    judgeEl.textContent = String(n);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;

    finished = true;

    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    window.removeEventListener("keydown", onKey);

    const score = points() / totalNotes;

    judgeEl.className = "bs-judge show end";
    judgeEl.textContent = t("bs.end", { n: bestCombo });

    setTimeout(() => {
      onComplete?.({
        score: Math.round(clamp(score, 0, 100)),

        adapt: Math.round(clamp(30 + score * 0.45 + Math.min(25, (bestCombo / totalNotes) * 25), 0, 100)),

        meta: {
          success: score >= 60,
          perfect: counts.perfect,
          great: counts.great,
          good: counts.good,
          miss: counts.miss,
          bestCombo,
          notes: totalNotes
        }
      });
    }, 700);
  }


  /* ---------- START ---------- */

  later(() => {
    // Count in 4 beats before the first note
    startAt = performance.now() + LEAD_IN_BEATS * beatMs;
    lastBeatPlayed = -LEAD_IN_BEATS - 1;
    frame = requestAnimationFrame(loop);
  }, 500);


  return () => {
    finished = true;

    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    window.removeEventListener("keydown", onKey);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
