// GAMIQ（ゲーミック） v2 - PK Keeper
//
// PK KEEPER
// - You are the goalkeeper. 8 penalty kicks.
// - When the ball is kicked, dive LEFT or RIGHT (tap that side).
// - Dive too early and the kicker shoots the other way!
// - Higher level: faster shots, fake kicks, and shots down
//   the middle (stay still to save those).

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createPkGames() {
  return [
    {
      id: "reflex_pk_keeper",
      type: "pk_keeper",
      title: "PK KEEPER",
      rule: "DIVE LEFT OR RIGHT WHEN THE BALL IS KICKED. DON'T GO EARLY!",
      skill: "REFLEX",
      theme: "stadium",
      duration: 25000
    }
  ];
}

export function runPkGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "pk_keeper") {
    return runPkKeeper({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const KICKS = 8;

function runPkKeeper({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   ball flight time: 700ms (Lv1) -> 380ms (Lv10)
   *   fake kicks: never -> 45% of kicks
   *   shots down the middle: never -> 25%
   */
  const travelMs = byLevel(level, 700, 380);
  const fakeRate = byLevel(level, 0, 0.45);
  const middleRate = byLevel(level, 0, 0.25);

  let finished = false;
  let kick = 0;
  let phase = "wait"; // wait | runup | flying | result
  let dive = null; // "L" | "R" | null
  let diveAt = 0;
  let kickedAt = 0;
  let target = null;
  let timers = [];

  const results = [];

  container.innerHTML = `
    <div class="pk-game">

      <div class="pk-hud">
        <div>
          <span>KICK</span>
          <strong data-pk-kick>1 / ${KICKS}</strong>
        </div>
        <div>
          <span>SAVES</span>
          <strong data-pk-saves>0</strong>
        </div>
      </div>

      <div class="pk-stage" data-pk-stage>

        <div class="pk-crowd"></div>
        <div class="pk-field"></div>
        <i class="pk-spot"></i>

        <div class="pk-kicker" data-pk-kicker>
          <svg viewBox="0 0 60 110" aria-hidden="true">
            <ellipse cx="30" cy="106" rx="16" ry="3" fill="rgba(0,0,0,.3)"/>
            <g class="pk-leg-l"><rect x="20" y="66" width="8" height="34" rx="4" fill="#f1c7a0"/><rect x="18" y="94" width="12" height="8" rx="3" fill="#1d1d1d"/></g>
            <g class="pk-leg-r"><rect x="32" y="66" width="8" height="34" rx="4" fill="#f1c7a0"/><rect x="30" y="94" width="12" height="8" rx="3" fill="#1d1d1d"/></g>
            <rect x="17" y="58" width="26" height="14" rx="4" fill="#ffffff"/>
            <rect x="15" y="28" width="30" height="34" rx="9" fill="#e23c4a"/>
            <text x="30" y="52" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">10</text>
            <rect x="8" y="30" width="8" height="26" rx="4" fill="#e23c4a"/>
            <rect x="44" y="30" width="8" height="26" rx="4" fill="#e23c4a"/>
            <circle cx="30" cy="17" r="11" fill="#f1c7a0"/>
            <path d="M19 15 Q20 4 30 5 Q41 4 41 15 Q36 9 30 10 Q24 9 19 15 Z" fill="#2b1a0f"/>
          </svg>
        </div>

        <div class="pk-ball" data-pk-ball>⚽</div>

        <div class="pk-post left"></div>
        <div class="pk-post right"></div>
        <div class="pk-bar"></div>

        <div class="pk-gloves" data-pk-gloves>
          <span>🧤</span>
        </div>

        <div class="pk-call" data-pk-call></div>

        <div class="pk-tap left" aria-hidden="true">◀</div>
        <div class="pk-tap right" aria-hidden="true">▶</div>
      </div>

    </div>
  `;

  const stage = container.querySelector("[data-pk-stage]");
  const kicker = container.querySelector("[data-pk-kicker]");
  const ball = container.querySelector("[data-pk-ball]");
  const gloves = container.querySelector("[data-pk-gloves]");
  const callEl = container.querySelector("[data-pk-call]");
  const kickEl = container.querySelector("[data-pk-kick]");
  const savesEl = container.querySelector("[data-pk-saves]");

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);

    timers.push(id);
  }

  function call(text, kind = "") {
    callEl.className = `pk-call show ${kind}`;
    callEl.textContent = text;
  }


  /* ---------- ONE KICK ---------- */

  function setBall(x, y, size, ms) {
    ball.style.transition = ms
      ? `left ${ms}ms linear, top ${ms}ms cubic-bezier(.3,0,.7,1), font-size ${ms}ms ease-in, transform ${ms}ms linear`
      : "none";
    ball.style.left = `${x}%`;
    ball.style.top = `${y}%`;
    ball.style.fontSize = `${size}px`;
  }

  function startKick() {
    phase = "runup";
    dive = null;
    target = null;

    kickEl.textContent = `${kick + 1} / ${KICKS}`;
    callEl.className = "pk-call";

    // Reset everything
    stage.classList.remove("goal", "saved");
    gloves.className = "pk-gloves";
    kicker.className = "pk-kicker";
    ball.style.transform = "rotate(0deg)";
    ball.classList.remove("away");
    setBall(50, 52, 16, 0);

    void kicker.offsetWidth;
    kicker.classList.add("run");

    // Run-up time is random so you can't just count
    const runup = 700 + Math.random() * 700;
    const fake = Math.random() < fakeRate;

    if (fake) {
      later(() => {
        // Leg swings... but no ball!
        kicker.classList.add("fake");
        sfx("whoosh");

        later(shoot, 380 + Math.random() * 250);
      }, runup);
    } else {
      later(shoot, runup);
    }
  }

  function shoot() {
    phase = "flying";
    kickedAt = performance.now();

    kicker.classList.remove("fake");
    kicker.classList.add("kick");

    // Dived too early: the kicker sees it and shoots the other way
    if (dive) {
      target = dive === "L" ? "R" : "L";
    } else {
      const r = Math.random();
      target = r < middleRate ? "C" : Math.random() < 0.5 ? "L" : "R";
    }

    sfx("thud");

    const x = target === "L" ? 17 : target === "R" ? 83 : 50;
    const y = target === "C" ? 66 : 60 + Math.random() * 10;

    ball.style.transform = `rotate(${target === "L" ? -540 : 540}deg)`;
    // Ball size at the end: fits the screen (phones sideways are short)
    const big = Math.round(Math.min(92, stage.clientHeight * 0.2, stage.clientWidth * 0.24));

    setBall(x, y, big, travelMs);

    later(arrive, travelMs);
  }

  function arrive() {
    phase = "result";

    const saved =
      (target === "C" && !dive) ||
      (dive === target && diveAt >= kickedAt);

    let points = 0;

    if (saved) {
      // Faster reaction = more points (stay-still saves get full points)
      const rt = dive ? diveAt - kickedAt : 0;
      const quick = dive ? clamp((travelMs - rt) / (travelMs - 180), 0, 1) : 1;

      points = Math.round(60 + quick * 40);

      stage.classList.add("saved");
      ball.classList.add("away");

      call(t("pk.save"), "good");
      sfx(points >= 90 ? "perfect" : "impact");
    } else {
      stage.classList.add("goal");

      call(dive && diveAt < kickedAt ? t("pk.early") : t("pk.goal"), "bad");
      sfx("bad");
    }

    results.push({ saved, points, target, early: dive && diveAt < kickedAt });
    savesEl.textContent = String(results.filter(r => r.saved).length);

    kick++;

    later(() => {
      if (kick < KICKS) startKick();
      else finish();
    }, 1200);
  }


  /* ---------- INPUT ---------- */

  function doDive(side) {
    if (finished || dive) return;
    if (phase !== "runup" && phase !== "flying") return;

    dive = side;
    diveAt = performance.now();

    gloves.classList.add(side === "L" ? "dive-l" : "dive-r");
  }

  function onPointer(event) {
    event.preventDefault();

    const rect = stage.getBoundingClientRect();
    doDive(event.clientX - rect.left < rect.width / 2 ? "L" : "R");
  }

  stage.addEventListener("pointerdown", onPointer);

  function onKey(event) {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      event.preventDefault();
      doDive("L");
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      event.preventDefault();
      doDive("R");
    }
  }

  window.addEventListener("keydown", onKey);


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;

    finished = true;

    timers.forEach(clearTimeout);
    window.removeEventListener("keydown", onKey);

    const total = results.reduce((sum, r) => sum + r.points, 0);
    const score = Math.round(total / KICKS);
    const saves = results.filter(r => r.saved).length;
    const early = results.filter(r => r.early).length;

    setTimeout(() => {
      onComplete?.({
        score,

        // ADAPT: not fooled by the kicker (no early dives)
        adapt: Math.round(clamp(40 + (saves / KICKS) * 40 + (1 - early / KICKS) * 20 - early * 3, 0, 100)),

        meta: {
          success: saves >= Math.ceil(KICKS * 0.6),
          saves,
          kicks: KICKS,
          early
        }
      });
    }, 300);
  }


  /* ---------- START ---------- */

  later(startKick, 300);


  return () => {
    finished = true;

    timers.forEach(clearTimeout);
    window.removeEventListener("keydown", onKey);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
