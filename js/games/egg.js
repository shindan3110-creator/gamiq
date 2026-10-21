// GAMIQ（ゲーミック） v2 - Egg Smash
//
// EGG SMASH
// - Tap the egg as fast as you can to crack it open.
// - How many eggs can you smash in 15 seconds?
// - Sometimes a GOLDEN egg comes: harder, but counts as 2.
// - Higher level: harder shells (more taps per egg).

import { t } from "../i18n.js";
import { byLevel, byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createEggGames() {
  return [
    {
      id: "speed_egg_smash",
      type: "egg_smash",
      title: "EGG SMASH",
      rule: "TAP LIKE CRAZY! SMASH AS MANY EGGS AS YOU CAN!",
      skill: "SPEED",
      theme: "kitchen",
      duration: 15000
    }
  ];
}

export function runEggGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "egg_smash") {
    return runEggSmash({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const TIME_LIMIT_MS = 15000;

function runEggSmash({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   taps per egg: 6 (Lv1) -> 11 (Lv10)
   *   eggs for a full score: 10 -> 9
   *   (Lv1 needs about 4 taps/second, Lv10 about 6.6)
   */
  const baseHp = byLevel(level, 6, 11);
  const goal = byLevelInt(level, 10, 9);

  let finished = false;
  let started = false;
  let startedAt = 0;
  let eggs = 0;
  let taps = 0;
  let hp = 0;
  let maxHp = 0;
  let golden = false;
  let clockTimer = null;
  let finishTimer = null;

  // Taps in the first / second half (for ADAPT)
  let firstHalfTaps = 0;
  let secondHalfTaps = 0;

  container.innerHTML = `
    <div class="egg-game">

      <div class="egg-hud">
        <div>
          <span>EGGS</span>
          <strong data-egg-count>0</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-egg-time>${TIME_LIMIT_MS / 1000}</strong>
        </div>
      </div>

      <div class="egg-stage" data-egg-stage>
        <div class="egg-hint" data-egg-hint>${t("egg.hint")}</div>

        <div class="egg-holder" data-egg-holder></div>

        <div class="egg-bar"><i data-egg-bar></i></div>
      </div>

    </div>
  `;

  const stage = container.querySelector("[data-egg-stage]");
  const holder = container.querySelector("[data-egg-holder]");
  const countEl = container.querySelector("[data-egg-count]");
  const timeEl = container.querySelector("[data-egg-time]");
  const hintEl = container.querySelector("[data-egg-hint]");
  const barEl = container.querySelector("[data-egg-bar]");

  let eggEl = null;


  /* ---------- EGG ---------- */

  // Crack lines appear one by one as the egg gets hit
  const CRACKS = [
    "M50 38 L46 48 L52 54",
    "M52 54 L47 63 L54 70",
    "M38 60 L46 63",
    "M54 70 L62 66 L66 74",
    "M30 72 L40 70 L47 77",
    "M62 50 L70 56 L68 64",
    "M47 77 L52 86 L60 84"
  ];

  function eggSvg(isGolden) {
    const fill = isGolden ? "url(#eggGold)" : "url(#eggShell)";

    return `
      <svg viewBox="0 0 100 120" aria-hidden="true">
        <defs>
          <radialGradient id="eggShell" cx="38%" cy="30%" r="75%">
            <stop offset="0%" stop-color="#fffaf0"/>
            <stop offset="65%" stop-color="#f3dcc0"/>
            <stop offset="100%" stop-color="#d9b48c"/>
          </radialGradient>
          <radialGradient id="eggGold" cx="38%" cy="30%" r="75%">
            <stop offset="0%" stop-color="#fff6c4"/>
            <stop offset="55%" stop-color="#ffcf3f"/>
            <stop offset="100%" stop-color="#c98a12"/>
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="114" rx="30" ry="5" fill="rgba(0,0,0,.25)"/>
        <path d="M50 6 C76 6 92 48 92 74 C92 98 74 112 50 112 C26 112 8 98 8 74 C8 48 24 6 50 6 Z" fill="${fill}"/>
        <ellipse cx="36" cy="34" rx="9" ry="14" fill="rgba(255,255,255,.55)" transform="rotate(-20 36 34)"/>
        ${CRACKS.map((d, i) => `<path class="egg-crack" data-crack="${i}" d="${d}"/>`).join("")}
      </svg>
    `;
  }

  function newEgg() {
    // About 1 in 6 eggs is golden (never the very first one)
    golden = eggs > 0 && Math.random() < 0.17;

    maxHp = Math.round(golden ? baseHp * 1.6 : baseHp);
    hp = maxHp;

    eggEl = document.createElement("div");
    eggEl.className = golden ? "egg golden" : "egg";
    eggEl.innerHTML = eggSvg(golden);

    holder.innerHTML = "";
    holder.appendChild(eggEl);

    updateBar();
  }

  function updateBar() {
    barEl.style.transform = `scaleX(${1 - hp / maxHp})`;
  }

  function hit() {
    if (finished) return;

    if (!started) {
      started = true;
      startedAt = performance.now();
      hintEl.classList.add("hide");
      clockTimer = setInterval(updateClock, 100);
    }

    taps++;

    if (performance.now() - startedAt < TIME_LIMIT_MS / 2) firstHalfTaps++;
    else secondHalfTaps++;

    hp--;

    // Shake + show cracks
    eggEl.classList.remove("hit");
    void eggEl.offsetWidth;
    eggEl.classList.add("hit");

    const broken = Math.ceil((1 - hp / maxHp) * CRACKS.length);
    eggEl.querySelectorAll(".egg-crack").forEach((path, i) => {
      path.classList.toggle("show", i < broken);
    });

    updateBar();

    if (hp <= 0) {
      smash();
    } else {
      sfx("thud");
    }
  }

  function smash() {
    const gain = golden ? 2 : 1;
    eggs += gain;

    countEl.textContent = String(eggs);

    // Broken egg: shell halves fly away, yolk splat
    const splat = document.createElement("div");
    splat.className = golden ? "egg-splat golden" : "egg-splat";
    splat.innerHTML = `
      <i class="egg-half left"></i>
      <i class="egg-half right"></i>
      <b class="egg-yolk"></b>
      <em>+${gain}</em>
    `;
    stage.appendChild(splat);
    setTimeout(() => splat.remove(), 700);

    sfx(golden ? "perfect" : "pop");

    newEgg();
  }


  /* ---------- INPUT ---------- */

  function onPointer(event) {
    event.preventDefault();
    hit();
  }

  stage.addEventListener("pointerdown", onPointer);

  function onKey(event) {
    // Holding a key down does not count, only real presses
    if (event.repeat) return;

    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      hit();
    }
  }

  window.addEventListener("keydown", onKey);


  /* ---------- CLOCK ---------- */

  function updateClock() {
    const left = Math.max(0, TIME_LIMIT_MS - (performance.now() - startedAt));

    timeEl.textContent = String(Math.ceil(left / 1000));
    timeEl.classList.toggle("danger", left <= 5000);

    if (left <= 0) finish();
  }

  // If the player never taps, the clock starts by itself after 3s
  const autoStart = setTimeout(() => {
    if (!started && !finished) {
      started = true;
      startedAt = performance.now();
      clockTimer = setInterval(updateClock, 100);
    }
  }, 3000);


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;

    finished = true;

    clearInterval(clockTimer);
    window.removeEventListener("keydown", onKey);

    eggEl?.classList.add("done");
    hintEl.textContent = t("egg.timeUp", { n: eggs });
    hintEl.classList.remove("hide");
    hintEl.classList.add("end");

    // Count the egg in progress too (a little)
    const partial = maxHp ? (1 - hp / maxHp) : 0;
    const score = clamp(Math.min(1, (eggs + partial) / goal) * 100, 0, 100);

    // ADAPT: kept the speed up in the second half?
    const keep = firstHalfTaps ? secondHalfTaps / firstHalfTaps : 0;

    finishTimer = setTimeout(() => {
      onComplete?.({
        score: Math.round(score),

        adapt: Math.round(clamp(30 + Math.min(1, keep) * 40 + Math.min(1, eggs / goal) * 30, 0, 100)),

        meta: {
          success: eggs >= Math.ceil(goal * 0.6),
          eggs,
          goal,
          taps,
          tapsPerSecond: Math.round((taps / (TIME_LIMIT_MS / 1000)) * 10) / 10
        }
      });
    }, 900);
  }


  /* ---------- START ---------- */

  newEgg();


  return () => {
    finished = true;

    clearTimeout(autoStart);
    clearInterval(clockTimer);
    clearTimeout(finishTimer);
    window.removeEventListener("keydown", onKey);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
