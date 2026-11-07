// GAMIQ（ゲーミック） v2 - Fishing
//
// FISHING (REFLEX)
// 1) Wait. The float bobs a little (nibbles — DON'T tap yet!).
// 2) When the float is pulled under and "!" appears, tap right away.
// 3) Then a needle swings on a gauge: tap when it is in the green zone
//    to land the fish.
// - 5 fish. Fast hook + good timing = big fish and more points.
// - PC: click or Space.
// - Higher level: shorter time to hook, more fake nibbles,
//   smaller green zone, faster needle.

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createFishingGames() {
  return [
    {
      id: "reflex_fishing",
      type: "fishing",
      title: "FISHING",
      rule: "TAP THE MOMENT THE FLOAT GOES UNDER! THEN STOP THE NEEDLE IN THE GREEN!",
      skill: "REFLEX",
      theme: "lake",
      duration: 30000,
      maxDuration: 70000
    }
  ];
}

export function runFishingGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "fishing") {
    return runFishing({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const FISH = 5;

const FISH_TYPES = [
  { key: "fish0", color: "#7fb3d9", min: 12, max: 24 },
  { key: "fish1", color: "#e0a04a", min: 18, max: 35 },
  { key: "fish2", color: "#c0c8d4", min: 25, max: 48 },
  { key: "fish3", color: "#e85d75", min: 30, max: 60 }
];

function runFishing({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   time to hook after "!": 1000ms (Lv1) -> 500ms (old Lv10)
   *   fake nibbles per wait:  0-1 -> 1-3
   *   green zone:             26% -> 13%
   *   needle speed:           slow -> fast
   */
  const hookMs = Math.max(320, byLevel(level, 1000, 500));
  const nibblesMax = Math.min(4, Math.round(byLevel(level, 1, 3)));
  const zoneW = Math.max(0.09, byLevel(level, 0.26, 0.13));
  const needleSpeed = Math.min(2.4, byLevel(level, 0.8, 1.5)); // sweeps per second

  let finished = false;
  let fishNo = 0;
  let state = "idle";   // wait | bite | reel | result
  let biteAt = 0;
  let hookTime = 0;
  let reelStart = 0;
  let zoneCenter = 0.5;
  let total = 0;
  let caught = 0;
  let early = 0;
  let late = 0;
  let snapped = 0;
  let bestCm = 0;
  let timers = [];
  let frameId = null;
  let floatDip = 0;     // 0 = floating, 1 = under
  let ripple = 0;
  const startedAt = performance.now();

  container.innerHTML = `
    <div class="be-game fi-game">
      <div class="be-hud">
        <div>
          <span>FISH</span>
          <strong data-fi-count>1 / ${FISH}</strong>
        </div>
        <div>
          <span>CAUGHT</span>
          <strong data-fi-caught>0</strong>
        </div>
        <div>
          <span>BEST</span>
          <strong data-fi-best>—</strong>
        </div>
      </div>

      <div class="fi-stage" data-fi-stage>
        <div class="fi-sky"></div>
        <div class="fi-water"></div>
        <svg class="fi-line" data-fi-linesvg aria-hidden="true">
          <line data-fi-line x1="0" y1="0" x2="0" y2="0"/>
        </svg>
        <div class="fi-float" data-fi-float>
          <i class="fi-float-top"></i><i class="fi-float-bottom"></i>
        </div>
        <div class="fi-ripple" data-fi-ripple></div>
        <div class="fi-bang" data-fi-bang>!</div>

        <div class="fi-gauge" data-fi-gauge>
          <div class="fi-zone" data-fi-zone></div>
          <div class="fi-needle" data-fi-needle></div>
        </div>

        <div class="fi-catch" data-fi-catch></div>
        <div class="fi-status" data-fi-status></div>
      </div>
    </div>
  `;

  const stage = container.querySelector("[data-fi-stage]");
  const floatEl = container.querySelector("[data-fi-float]");
  const rippleEl = container.querySelector("[data-fi-ripple]");
  const bang = container.querySelector("[data-fi-bang]");
  const gauge = container.querySelector("[data-fi-gauge]");
  const zone = container.querySelector("[data-fi-zone]");
  const needle = container.querySelector("[data-fi-needle]");
  const catchEl = container.querySelector("[data-fi-catch]");
  const statusEl = container.querySelector("[data-fi-status]");
  const lineEl = container.querySelector("[data-fi-line]");
  const countEl = container.querySelector("[data-fi-count]");
  const caughtEl = container.querySelector("[data-fi-caught]");
  const bestEl = container.querySelector("[data-fi-best]");

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function clearLater() {
    timers.forEach(clearTimeout);
    timers = [];
  }


  /* ---------- ONE FISH ---------- */

  function cast() {
    countEl.textContent = `${fishNo + 1} / ${FISH}`;
    state = "wait";
    floatDip = 0;
    bang.className = "fi-bang";
    gauge.className = "fi-gauge";
    catchEl.className = "fi-catch";
    statusEl.textContent = t("fi.wait");
    statusEl.className = "fi-status";

    sfx("water");

    // When the fish really bites
    const wait = 1400 + Math.random() * 2600;

    // Fake nibbles before that
    const nibbles = Math.floor(Math.random() * (nibblesMax + 1));
    for (let i = 0; i < nibbles; i++) {
      const at = 500 + Math.random() * (wait - 700);
      later(() => {
        if (state !== "wait") return;
        floatDip = 0.25;
        ripple = 1;
        sfx("tick");
        later(() => {
          if (state === "wait") floatDip = 0;
        }, 160);
      }, at);
    }

    later(bite, wait);
  }

  function bite() {
    if (state !== "wait") return;
    state = "bite";
    biteAt = performance.now();
    floatDip = 1;
    ripple = 1;
    bang.className = "fi-bang show";
    statusEl.textContent = "";
    sfx("water");

    // For automatic tests only (not used by the game)
    stage.__fi = { state: "bite" };

    later(() => {
      if (state !== "bite") return;
      late++;
      lose(t("fi.late"));
    }, hookMs);
  }

  function startReel() {
    state = "reel";
    reelStart = performance.now();
    bang.className = "fi-bang";
    floatDip = 1;
    zoneCenter = zoneW / 2 + 0.08 + Math.random() * (1 - zoneW - 0.16);
    zone.style.left = `${(zoneCenter - zoneW / 2) * 100}%`;
    zone.style.width = `${zoneW * 100}%`;
    gauge.className = "fi-gauge show";
    statusEl.textContent = t("fi.reel");
    statusEl.className = "fi-status reel";
    sfx("click");
    stage.__fi = { state: "reel", zoneCenter, zoneW, needle: () => needlePos(performance.now()) };
  }

  function needlePos(now) {
    // goes back and forth 0 -> 1 -> 0
    const p = ((now - reelStart) / 1000) * needleSpeed;
    const k = p % 2;
    return k < 1 ? k : 2 - k;
  }

  function stopNeedle() {
    const pos = needlePos(performance.now());
    const off = Math.abs(pos - zoneCenter);

    // Hook part: how fast you tapped after "!" (0..40)
    const hookPts = Math.round(40 * Math.max(0, 1 - hookTime / hookMs) + (hookTime < hookMs ? 10 : 0));

    if (off <= zoneW / 2) {
      // Gauge part: how close to the middle of the zone (0..50)
      const gaugePts = Math.round(50 * (1 - off / (zoneW / 2)) * 0.6 + 50 * 0.4);
      const pts = Math.min(100, hookPts + gaugePts);
      total += pts;
      caught++;

      const type = FISH_TYPES[Math.min(FISH_TYPES.length - 1, Math.floor((pts / 100) * FISH_TYPES.length))];
      const cm = Math.round(type.min + (type.max - type.min) * (pts / 100));
      bestCm = Math.max(bestCm, cm);

      sfx(pts >= 85 ? "perfect" : "good");
      showCatch(type, cm, pts);
      updateHud();
      next();
    } else {
      snapped++;
      // You still get half of the hook points
      total += Math.round(hookPts / 2);
      lose(t("fi.snap"));
    }
  }

  function showCatch(type, cm, pts) {
    state = "result";
    gauge.className = "fi-gauge";
    catchEl.innerHTML = `
      <svg viewBox="0 0 100 50" aria-hidden="true">
        <path d="M8 25 Q30 2 62 10 Q78 14 86 25 Q78 36 62 40 Q30 48 8 25Z" fill="${type.color}"/>
        <path d="M84 25 L98 12 L96 25 L98 38Z" fill="${type.color}"/>
        <circle cx="22" cy="21" r="3.5" fill="#1a1f27"/>
        <path d="M40 16 Q50 25 40 34" stroke="rgba(0,0,0,.25)" stroke-width="2" fill="none"/>
      </svg>
      <b>${t(`fi.${type.key}`)} ${cm}cm</b>
      <small>+${pts}</small>
    `;
    catchEl.className = "fi-catch show";
    statusEl.textContent = "";
  }

  function lose(text) {
    state = "result";
    sfx("bad");
    gauge.className = "fi-gauge";
    bang.className = "fi-bang";
    floatDip = 0;
    statusEl.textContent = text;
    statusEl.className = "fi-status bad";
    stage.__fi = { state: "result" };
    next();
  }

  function next() {
    fishNo++;
    stage.__fi = { state: "result" };
    if (fishNo >= FISH) {
      later(finish, 1200);
    } else {
      later(cast, 1300);
    }
  }


  /* ---------- INPUT ---------- */

  function action() {
    if (finished) return;

    if (state === "wait") {
      early++;
      clearLater();
      lose(t("fi.early"));
      return;
    }

    if (state === "bite") {
      hookTime = performance.now() - biteAt;
      clearLater();
      startReel();
      return;
    }

    if (state === "reel") {
      stopNeedle();
    }
  }

  function onDown(event) {
    event.preventDefault();
    action();
  }

  function onKey(event) {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      action();
    }
  }


  /* ---------- ANIMATION ---------- */

  function frame(now) {
    if (finished) return;

    const rect = stage.getBoundingClientRect();
    const t0 = now / 1000;

    // float bobbing
    const bob = state === "wait" ? Math.sin(t0 * 2.4) * 3 : 0;
    const dipPx = floatDip * 26;
    floatEl.style.transform = `translate(-50%, ${bob + dipPx}px)`;
    floatEl.classList.toggle("under", floatDip >= 1);

    if (ripple > 0) {
      rippleEl.style.opacity = String(ripple);
      rippleEl.style.transform = `translate(-50%, -50%) scale(${1 + (1 - ripple) * 2.2})`;
      ripple = Math.max(0, ripple - 0.03);
    }

    // fishing line from the top-left rod tip to the float
    const fr = floatEl.getBoundingClientRect();
    lineEl.setAttribute("x1", String(rect.width * 0.02));
    lineEl.setAttribute("y1", String(rect.height * 0.04));
    lineEl.setAttribute("x2", String(fr.left - rect.left + fr.width / 2));
    lineEl.setAttribute("y2", String(fr.top - rect.top + 2));

    if (state === "reel") {
      needle.style.left = `${needlePos(now) * 100}%`;
    }

    frameId = requestAnimationFrame(frame);
  }


  /* ---------- HUD ---------- */

  function updateHud() {
    caughtEl.textContent = String(caught);
    bestEl.textContent = bestCm ? `${bestCm}cm` : "—";
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frameId);

    const score = clamp(total / FISH, 0, 100);
    const success = caught >= 3;

    sfx(success ? "clear" : "fail");

    setTimeout(() => {
      onComplete?.({
        score: Math.round(score),
        adapt: Math.round(clamp(30 + (caught / FISH) * 50 - early * 4 + (score / 100) * 20, 0, 100)),
        meta: {
          success,
          caught,
          early,
          late,
          snapped,
          bestCm,
          elapsed: Math.round(performance.now() - startedAt)
        }
      });
    }, 300);
  }


  /* ---------- START ---------- */

  stage.addEventListener("pointerdown", onDown);
  window.addEventListener("keydown", onKey);

  stage.__fi = { state: "idle" };
  updateHud();
  later(cast, 400);
  frameId = requestAnimationFrame(frame);

  return () => {
    finished = true;
    cancelAnimationFrame(frameId);
    clearLater();
    stage.removeEventListener("pointerdown", onDown);
    window.removeEventListener("keydown", onKey);
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
