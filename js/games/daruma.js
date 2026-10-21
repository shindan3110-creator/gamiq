// GAMIQ（ゲーミック） v2 - Daruma-san ga Koronda (Red light, green light)
//
// DARUMA
// - Hold the screen to walk toward the oni.
// - The oni says "da-ru-ma-sa-n-ga-ko-ro-n-da" and then turns around.
// - If you are still moving when the oni looks: caught! (back you go)
// - Reach the oni before time runs out. 3 lives.
// - Higher level: the chant speed changes more, the oni looks
//   longer and sooner, and you have less time to stop.

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createDarumaGames() {
  return [
    {
      id: "reflex_daruma",
      type: "daruma",
      title: "RED LIGHT",
      rule: "HOLD TO WALK. FREEZE WHEN THE ONI TURNS AROUND!",
      skill: "REFLEX",
      theme: "park",
      duration: 25000
    }
  ];
}

export function runDarumaGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "daruma") {
    return runDaruma({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const TIME_LIMIT_MS = 30000;
const LIVES = 3;
const WALK_PER_SEC = 13; // % of the way per second while holding

function runDaruma({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   time to stop after the oni turns: 320ms (Lv1) -> 150ms (Lv10)
   *   chant speed: steady (Lv1) -> changes a lot, sometimes very fast
   *   oni looks for: 0.9-1.4s (Lv1) -> 0.8-2.2s (Lv10)
   *   fake glances (no danger, just to scare you): 0% -> 30%
   */
  const graceMs = byLevel(level, 320, 150);
  const speedSpread = byLevel(level, 0.15, 0.75);
  const lookMin = byLevel(level, 900, 800);
  const lookMax = byLevel(level, 1400, 2200);
  const fakeRate = byLevel(level, 0, 0.3);

  const syllables = t("daruma.chant").split("|");

  let finished = false;
  let holding = false;
  let state = "chant"; // chant | turning | look
  let progress = 0;
  let lives = LIVES;
  let caught = 0;
  let lookStartedAt = 0;
  let lastFrame = 0;
  let frame = 0;
  let startedAt = 0;
  let timers = [];
  let stoppedInTime = 0;

  container.innerHTML = `
    <div class="dr-game">

      <div class="dr-hud">
        <div>
          <span>LIFE</span>
          <strong data-dr-lives>${"♥".repeat(LIVES)}</strong>
        </div>
        <div>
          <span>DISTANCE</span>
          <strong data-dr-dist>0%</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-dr-time>${TIME_LIMIT_MS / 1000}</strong>
        </div>
      </div>

      <div class="dr-stage" data-dr-stage>

        <div class="dr-sky"></div>
        <div class="dr-ground"></div>
        <div class="dr-tree"></div>

        <div class="dr-bubble" data-dr-bubble></div>

        <div class="dr-oni" data-dr-oni>
          <svg viewBox="0 0 60 100" aria-hidden="true">
            <ellipse cx="30" cy="97" rx="18" ry="3" fill="rgba(0,0,0,.25)"/>
            <rect x="19" y="70" width="9" height="26" rx="4" fill="#2b2b3a"/>
            <rect x="32" y="70" width="9" height="26" rx="4" fill="#2b2b3a"/>
            <rect x="14" y="38" width="32" height="36" rx="10" fill="#e8a33c"/>
            <g class="dr-oni-back">
              <circle cx="30" cy="22" r="15" fill="#2b1a0f"/>
              <rect x="6" y="40" width="9" height="22" rx="4" fill="#e8a33c" transform="rotate(-30 10 42)"/>
              <rect x="45" y="40" width="9" height="22" rx="4" fill="#e8a33c" transform="rotate(30 50 42)"/>
            </g>
            <g class="dr-oni-face">
              <circle cx="30" cy="22" r="15" fill="#f6cfa6"/>
              <path d="M15 18 Q16 6 30 7 Q44 6 45 18 Q38 12 30 13 Q22 12 15 18 Z" fill="#2b1a0f"/>
              <circle cx="24" cy="23" r="3.4" fill="#1d1a16"/>
              <circle cx="36" cy="23" r="3.4" fill="#1d1a16"/>
              <circle cx="25" cy="22" r="1.1" fill="#fff"/>
              <circle cx="37" cy="22" r="1.1" fill="#fff"/>
              <path d="M24 31 Q30 28 36 31" stroke="#1d1a16" stroke-width="2" fill="none" stroke-linecap="round"/>
              <rect x="8" y="44" width="8" height="24" rx="4" fill="#e8a33c"/>
              <rect x="44" y="44" width="8" height="24" rx="4" fill="#e8a33c"/>
            </g>
          </svg>
          <b class="dr-eye" aria-hidden="true">!</b>
        </div>

        <div class="dr-player" data-dr-player>
          <svg viewBox="0 0 50 90" aria-hidden="true">
            <ellipse cx="25" cy="87" rx="14" ry="3" fill="rgba(0,0,0,.25)"/>
            <g class="dr-leg-a"><rect x="16" y="58" width="8" height="28" rx="4" fill="#3a4a6b"/></g>
            <g class="dr-leg-b"><rect x="26" y="58" width="8" height="28" rx="4" fill="#3a4a6b"/></g>
            <rect x="12" y="30" width="26" height="32" rx="9" fill="#5fefff"/>
            <g class="dr-arm"><rect x="31" y="32" width="7" height="22" rx="3.5" fill="#5fefff"/></g>
            <circle cx="25" cy="18" r="12" fill="#f6cfa6"/>
            <path d="M13 16 Q14 5 25 6 Q36 5 37 16 Q31 10 25 11 Q19 10 13 16 Z" fill="#1d1a16"/>
            <circle cx="30" cy="19" r="2.2" fill="#1d1a16"/>
          </svg>
        </div>

        <div class="dr-call" data-dr-call></div>
        <div class="dr-hint" data-dr-hint>${t("daruma.hint")}</div>
      </div>

    </div>
  `;

  const stage = container.querySelector("[data-dr-stage]");
  const oni = container.querySelector("[data-dr-oni]");
  const player = container.querySelector("[data-dr-player]");
  const bubble = container.querySelector("[data-dr-bubble]");
  const callEl = container.querySelector("[data-dr-call]");
  const hintEl = container.querySelector("[data-dr-hint]");
  const livesEl = container.querySelector("[data-dr-lives]");
  const distEl = container.querySelector("[data-dr-dist]");
  const timeEl = container.querySelector("[data-dr-time]");

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);

    timers.push(id);
  }

  function call(text, kind = "") {
    callEl.className = "dr-call";
    void callEl.offsetWidth;
    callEl.className = `dr-call show ${kind}`;
    callEl.textContent = text;
  }

  function place() {
    // Player walks from the left edge up to the oni
    const startX = stage.clientWidth * 0.05;
    const endX = oni.offsetLeft - player.offsetWidth * 0.9;
    const x = startX + (Math.max(startX, endX) - startX) * (progress / 100);

    player.style.left = `${x}px`;
    distEl.textContent = `${Math.floor(progress)}%`;
  }

  window.addEventListener("resize", place);


  /* ---------- THE ONI ---------- */

  function chant() {
    state = "chant";
    oni.classList.remove("look", "turning", "glance");
    bubble.textContent = "";
    bubble.classList.add("show");

    // This round's speed: sometimes slow, sometimes fast
    const speed = 1 + (Math.random() * 2 - 1) * speedSpread;
    const base = 240 / Math.max(0.35, speed);

    let i = 0;
    let glanced = false;

    function next() {
      if (finished) return;

      if (i >= syllables.length) {
        turn();
        return;
      }

      bubble.textContent += syllables[i];
      sfx("tick");
      i++;

      // Fake glance: the oni twitches, but does not really look
      if (!glanced && i > 2 && i < syllables.length - 2 && Math.random() < fakeRate / 4) {
        glanced = true;
        oni.classList.add("glance");
        later(() => oni.classList.remove("glance"), 260);
      }

      // The last syllables can come faster or slower
      const wobble = 1 + (Math.random() * 2 - 1) * speedSpread * 0.6;
      later(next, base * wobble);
    }

    next();
  }

  function turn() {
    state = "turning";
    lookStartedAt = performance.now();

    oni.classList.add("turning", "look");
    sfx("whoosh");

    // After a short moment, moving = caught
    later(() => {
      state = "look";

      if (holding) {
        catchPlayer();
        return;
      }

      stoppedInTime++;
    }, graceMs);

    const lookFor = lookMin + Math.random() * (lookMax - lookMin);

    later(() => {
      if (state === "look" || state === "turning") {
        bubble.classList.remove("show");
        chant();
      }
    }, lookFor);
  }

  function catchPlayer() {
    caught++;
    lives--;

    livesEl.textContent = "♥".repeat(Math.max(0, lives)) + "♡".repeat(LIVES - Math.max(0, lives));

    call(t("daruma.caught"), "bad");
    sfx("bad");

    player.classList.add("caught");

    // Back you go
    progress = Math.max(0, progress - 25);
    place();

    if (lives <= 0) {
      finish(false);
      return;
    }

    later(() => {
      player.classList.remove("caught");
      bubble.classList.remove("show");
      chant();
    }, 1100);

    state = "caughtPause";
  }


  /* ---------- WALKING ---------- */

  function loop(now) {
    if (finished) return;

    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;

    const moving = holding && state !== "caughtPause";

    player.classList.toggle("walk", moving);

    if (moving) {
      // Moving while the oni is really looking (after the grace time)
      if (state === "look") {
        catchPlayer();
      } else {
        progress = Math.min(100, progress + WALK_PER_SEC * dt);
        place();

        if (progress >= 100) {
          finish(true);
          return;
        }
      }
    }

    const left = Math.max(0, TIME_LIMIT_MS - (now - startedAt));
    timeEl.textContent = String(Math.ceil(left / 1000));
    timeEl.classList.toggle("danger", left <= 8000);

    if (left <= 0) {
      finish(false);
      return;
    }

    frame = requestAnimationFrame(loop);
  }


  /* ---------- INPUT (hold) ---------- */

  function press(event) {
    event?.preventDefault?.();
    holding = true;
    hintEl.classList.add("hide");
  }

  function release(event) {
    event?.preventDefault?.();
    holding = false;
  }

  stage.addEventListener("pointerdown", press);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  stage.addEventListener("contextmenu", event => event.preventDefault());

  function onKeyDown(event) {
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) press();
    }
  }

  function onKeyUp(event) {
    if (event.code === "Space") release(event);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Switching apps / tabs = let go
  function onBlur() {
    holding = false;
  }

  window.addEventListener("blur", onBlur);


  /* ---------- FINISH ---------- */

  function finish(reached) {
    if (finished) return;

    finished = true;
    holding = false;

    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    removeListeners();

    player.classList.remove("walk");
    bubble.classList.remove("show");

    const usedMs = performance.now() - startedAt;

    let score;

    if (reached) {
      const speed = Math.max(0, 1 - usedMs / TIME_LIMIT_MS);
      score = 70 + (lives / LIVES) * 20 + speed * 10;

      player.classList.add("win");
      oni.classList.add("tagged");

      call(t("daruma.touch"), "good");
      sfx("perfect");
    } else {
      score = progress * 0.6;

      call(lives <= 0 ? t("daruma.out") : t("daruma.timeUp"), "bad");
    }

    setTimeout(() => {
      onComplete?.({
        score: Math.round(clamp(score, 0, 100)),

        adapt: Math.round(clamp(40 + stoppedInTime * 6 - caught * 10 + (reached ? 20 : 0), 0, 100)),

        meta: {
          success: reached,
          reached,
          caught,
          distance: Math.round(progress)
        }
      });
    }, 1100);
  }

  function removeListeners() {
    window.removeEventListener("resize", place);
    window.removeEventListener("pointerup", release);
    window.removeEventListener("pointercancel", release);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
  }


  /* ---------- START ---------- */

  requestAnimationFrame(place);

  later(() => {
    startedAt = performance.now();
    frame = requestAnimationFrame(loop);
    chant();
  }, 300);


  return () => {
    finished = true;
    holding = false;

    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    removeListeners();
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
