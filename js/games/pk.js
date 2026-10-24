// GAMIQ（ゲーミック） v2 - PK Keeper (TV view)
//
// PK KEEPER
// - You are the goalkeeper. 8 penalty kicks, seen like on TV
//   (from behind the kicker).
// - When the ball is kicked, TAP the part of the goal it is going to.
//   6 spots: left / middle / right x high / low.
// - Dive too early and the kicker shoots the other way!
// - The kicker is not a robot: run-up speed changes, sometimes a
//   stop ("paradinha"), and the body leans to one side before the kick.
//   Low level: the lean tells the truth. High level: it can lie.

import { t } from "../i18n.js";
import { byLevel, safeLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createPkGames() {
  return [
    {
      id: "reflex_pk_keeper",
      type: "pk_keeper",
      title: "PK KEEPER",
      rule: "TAP WHERE THE BALL GOES, RIGHT WHEN IT IS KICKED. DON'T GO EARLY!",
      skill: "REFLEX",
      theme: "stadium",
      duration: 30000
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
GOAL & SPOTS (in % of the stage)
========================================== */

const GOAL = { left: 13, right: 87, top: 24, bottom: 50 };

const COLS = ["L", "C", "R"];
const ROWS = ["T", "B"];

// Where the ball ends up for each spot
const SPOT_X = { L: 25, C: 50, R: 75 };
const SPOT_Y = { T: 31, B: 44 };

const KICKS = 8;

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}


/* ==========================================
GAME
========================================== */

function runPkKeeper({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   ball flight time: 760ms (Lv1) -> 430ms (Lv10)
   *   left/right AND high/low must both be right to save
   *   stop in the run-up (paradinha): 15% -> 45%
   *   the lean before the kick is a lie: never -> 50%
   *   fake kick (leg swings, no ball): never -> 30%
   */
  const lv = safeLevel(level);
  const travelMs = byLevel(level, 760, 430);
  const stopRate = byLevel(level, 0.15, 0.45);
  const lieRate = byLevel(level, 0, 0.5);
  const fakeRate = byLevel(level, 0, 0.3);

  let finished = false;
  let kick = 0;
  let phase = "wait"; // wait | runup | flying | result
  let dive = null; // { col, row }
  let diveAt = 0;
  let kickedAt = 0;
  let target = null; // { col, row }
  let timers = [];

  const results = [];

  container.innerHTML = `
    <div class="pk2-game">

      <div class="pk2-hud">
        <div>
          <span>KICK</span>
          <strong data-pk-kick>1 / ${KICKS}</strong>
        </div>
        <div>
          <span>SAVES</span>
          <strong data-pk-saves>0</strong>
        </div>
      </div>

      <div class="pk2-stage" data-pk-stage>

        <div class="pk2-crowd"></div>
        <div class="pk2-pitch"></div>

        <div class="pk2-goal" style="left:${GOAL.left}%;right:${100 - GOAL.right}%;top:${GOAL.top}%;bottom:${100 - GOAL.bottom}%">
          <div class="pk2-net"></div>
          <div class="pk2-zones">
            ${ROWS.map(r => COLS.map(c => `<i data-zone="${c}${r}"></i>`).join("")).join("")}
          </div>
        </div>

        <div class="pk2-keeper" data-pk-keeper>
          <svg viewBox="0 0 80 100" aria-hidden="true">
            <ellipse cx="40" cy="97" rx="18" ry="3" fill="rgba(0,0,0,.3)"/>
            <rect x="29" y="64" width="9" height="31" rx="4" fill="#1d1d1d"/>
            <rect x="42" y="64" width="9" height="31" rx="4" fill="#1d1d1d"/>
            <rect x="26" y="58" width="28" height="14" rx="4" fill="#222b3a"/>
            <rect x="24" y="30" width="32" height="32" rx="9" fill="#ffd23f"/>
            <rect x="34" y="40" width="12" height="4" rx="2" fill="#1d1d1d" opacity=".35"/>
            <g class="pk2-arm-l"><rect x="10" y="22" width="9" height="26" rx="4" fill="#ffd23f" transform="rotate(35 18 34)"/><circle cx="10" cy="22" r="6.5" fill="#7cffb2"/></g>
            <g class="pk2-arm-r"><rect x="61" y="22" width="9" height="26" rx="4" fill="#ffd23f" transform="rotate(-35 62 34)"/><circle cx="70" cy="22" r="6.5" fill="#7cffb2"/></g>
            <circle cx="40" cy="20" r="11" fill="#f1c7a0"/>
            <path d="M29 18 Q30 7 40 8 Q50 7 51 18 Q46 12 40 13 Q34 12 29 18 Z" fill="#2b1a0f"/>
            <circle cx="36" cy="20" r="1.6" fill="#1d1a16"/>
            <circle cx="44" cy="20" r="1.6" fill="#1d1a16"/>
          </svg>
        </div>

        <i class="pk2-spot"></i>
        <div class="pk2-ball" data-pk-ball></div>

        <div class="pk2-kicker" data-pk-kicker>
          <svg viewBox="0 0 70 120" aria-hidden="true">
            <ellipse cx="35" cy="116" rx="20" ry="4" fill="rgba(0,0,0,.3)"/>
            <g class="pk2-leg-l"><rect x="22" y="72" width="11" height="40" rx="5" fill="#f1c7a0"/><rect x="20" y="104" width="15" height="9" rx="4" fill="#111"/></g>
            <g class="pk2-leg-r"><rect x="37" y="72" width="11" height="40" rx="5" fill="#f1c7a0"/><rect x="35" y="104" width="15" height="9" rx="4" fill="#111"/></g>
            <rect x="19" y="64" width="32" height="16" rx="5" fill="#ffffff"/>
            <g class="pk2-body">
              <g class="pk2-k-arm-l"><rect x="6" y="32" width="10" height="30" rx="5" fill="#e23c4a"/></g>
              <g class="pk2-k-arm-r"><rect x="54" y="32" width="10" height="30" rx="5" fill="#e23c4a"/></g>
              <rect x="15" y="28" width="40" height="40" rx="11" fill="#e23c4a"/>
              <text x="35" y="56" text-anchor="middle" font-size="18" font-weight="900" fill="#fff">10</text>
              <circle cx="35" cy="17" r="12" fill="#2b1a0f"/>
              <rect x="27" y="26" width="16" height="4" rx="2" fill="#d9a87e"/>
            </g>
          </svg>
        </div>

        <div class="pk2-call" data-pk-call></div>
        <div class="pk2-hint" data-pk-hint>${t("pk.hint")}</div>
      </div>

    </div>
  `;

  const stage = container.querySelector("[data-pk-stage]");
  const keeper = container.querySelector("[data-pk-keeper]");
  const kicker = container.querySelector("[data-pk-kicker]");
  const ball = container.querySelector("[data-pk-ball]");
  const callEl = container.querySelector("[data-pk-call]");
  const hintEl = container.querySelector("[data-pk-hint]");
  const kickEl = container.querySelector("[data-pk-kick]");
  const savesEl = container.querySelector("[data-pk-saves]");
  const zones = [...container.querySelectorAll("[data-zone]")];

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);

    timers.push(id);
    return id;
  }

  function call(text, kind = "") {
    callEl.className = "pk2-call";
    void callEl.offsetWidth;
    callEl.className = `pk2-call show ${kind}`;
    callEl.textContent = text;
  }


  /* ---------- KEEPER ---------- */

  let diveAnim = null;

  // Keeper pose: x/y in % of the stage, rotation in degrees
  const pose = (x, y, r = 0, sy = 1) =>
    `translate(calc(-50% + ${x}cqw), calc(-100% + ${y}cqh)) rotate(${r}deg) scaleY(${sy})`;

  function placeKeeper(spot) {
    diveAnim?.cancel();
    diveAnim = null;

    // Standing in the middle of the goal, ready
    if (!spot) {
      keeper.style.transform = pose(0, 0);
      keeper.className = "pk2-keeper";
      return;
    }

    keeper.className = `pk2-keeper dive reach ${spot.col === "C" ? (spot.row === "T" ? "jump" : "crouch") : `side-${spot.col}`}`;

    let frames;

    if (spot.col === "C") {
      frames = spot.row === "T"
        // Straight up: small squat, then jump with both arms up
        ? [pose(0, 0), pose(0, 1.5, 0, 0.88), pose(0, -11, 0, 1.04), pose(0, -9)]
        // Low middle: drop down to block
        : [pose(0, 0), pose(0, 2, 0, 0.8), pose(0, 3, 0, 0.72)];
    } else {
      const dir = spot.col === "L" ? -1 : 1;
      const x = dir * 16;

      frames = spot.row === "T"
        // High: push off, fly up in an arc, body almost flat in the air
        ? [pose(0, 0), pose(dir * 1.5, 1.5, 0, 0.88), pose(x * 0.55, -15, dir * 45), pose(x, -12, dir * 80)]
        // Low: push off low and slide along the ground
        : [pose(0, 0), pose(dir * 1.5, 1.5, 0, 0.88), pose(x * 0.6, -5, dir * 55), pose(x, -3, dir * 92)];
    }

    // Fast but readable: about a quarter of a second
    const ms = Math.round(Math.min(320, Math.max(220, travelMs * 0.55)));

    diveAnim = keeper.animate(
      frames.map((transform, i) => ({ transform, offset: frames.length === 3 ? [0, 0.25, 1][i] : [0, 0.14, 0.6, 1][i] })),
      { duration: ms, easing: "cubic-bezier(.25,.8,.35,1)", fill: "forwards" }
    );
  }


  /* ---------- BALL ---------- */

  let ballAnim = null;

  function resetBall() {
    ballAnim?.cancel();
    ballAnim = null;

    ball.className = "pk2-ball";
    ball.style.left = "50%";
    ball.style.top = "82%";
    ball.style.transform = "translate(-50%, -50%) scale(1)";
  }

  function flyBall(spot, ms) {
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;

    const x0 = sw * 0.5;
    const y0 = sh * 0.82;
    const x1 = (sw * SPOT_X[spot.col]) / 100 + (Math.random() - 0.5) * sw * 0.05;
    const y1 = (sh * SPOT_Y[spot.row]) / 100 + (Math.random() - 0.5) * sh * 0.02;

    // A little curve
    const bend = (Math.random() - 0.5) * sw * 0.14;
    const frames = [];

    for (let i = 0; i <= 10; i++) {
      const p = i / 10;
      const x = x0 + (x1 - x0) * p + bend * Math.sin(Math.PI * p);
      const y = y0 + (y1 - y0) * p - sh * 0.04 * Math.sin(Math.PI * p);
      const s = 1 - 0.5 * p; // smaller as it goes away

      frames.push({
        transform: `translate(${x - x0}px, ${y - y0}px) translate(-50%, -50%) scale(${s}) rotate(${p * 720}deg)`
      });
    }

    ball.style.left = "50%";
    ball.style.top = "82%";

    ballAnim = ball.animate(frames, { duration: ms, easing: "linear", fill: "forwards" });
  }


  /* ---------- ONE KICK ---------- */

  function startKick() {
    phase = "runup";
    dive = null;
    target = null;

    kickEl.textContent = `${kick + 1} / ${KICKS}`;
    callEl.className = "pk2-call";
    stage.classList.remove("goal", "saved");
    zones.forEach(z => z.classList.remove("chosen", "shot"));

    placeKeeper(null);
    resetBall();

    // Decide the real shot now (it may change if you dive early)
    target = { col: pick(COLS), row: pick(ROWS) };

    // Body lean before the kick: truth, or a lie at higher levels
    const lie = target.col !== "C" && Math.random() < lieRate;
    const leanCol = lie ? (target.col === "L" ? "R" : "L") : target.col;

    // Run-up: walk in from behind, speed changes every time
    kicker.className = "pk2-kicker";
    kicker.style.setProperty("--run", `${600 + Math.random() * 700}ms`);
    void kicker.offsetWidth;
    kicker.classList.add("run");

    const runup = parseFloat(kicker.style.getPropertyValue("--run"));
    let at = runup;

    // Paradinha: a short stop just before the ball
    if (Math.random() < stopRate) {
      later(() => kicker.classList.add("pause"), at - 120);
      at += 350 + Math.random() * 350;
      later(() => kicker.classList.remove("pause"), at - 140);
    }

    // The lean shows a moment before the kick
    later(() => {
      kicker.classList.add(leanCol === "L" ? "lean-l" : leanCol === "R" ? "lean-r" : "lean-c");
    }, at - 260);

    // Fake kick: leg swings, no ball
    if (Math.random() < fakeRate) {
      later(() => {
        kicker.classList.add("fake");
        sfx("whoosh");
      }, at);
      later(() => kicker.classList.remove("fake"), at + 260);
      at += 520 + Math.random() * 250;
    }

    later(shoot, at);
  }

  function shoot() {
    phase = "flying";
    kickedAt = performance.now();

    kicker.classList.add("kick");

    // Dived too early: the kicker sees it and shoots the other way
    if (dive) {
      const away = dive.col === "L" ? "R" : dive.col === "R" ? "L" : pick(["L", "R"]);
      target = { col: away, row: pick(ROWS) };
    }

    sfx("thud");
    flyBall(target, travelMs);

    later(arrive, travelMs);
  }

  function arrive() {
    phase = "result";

    const early = dive && diveAt < kickedAt;

    const rightSide = dive && dive.col === target.col;
    const rightHeight = dive && dive.row === target.row;

    const saved = !early && rightSide && rightHeight;

    container.querySelector(`[data-zone="${target.col}${target.row}"]`)?.classList.add("shot");

    let points = 0;

    if (saved) {
      const rt = diveAt - kickedAt;
      const quick = clamp((travelMs - rt) / (travelMs - 180), 0, 1);

      points = Math.round(60 + quick * 40);

      stage.classList.add("saved");
      ball.classList.add("away");

      call(t("pk.save"), "good");
      sfx(points >= 90 ? "perfect" : "impact");
    } else {
      stage.classList.add("goal");
      ball.classList.add("in");

      call(early ? t("pk.early") : t("pk.goal"), "bad");
      sfx("bad");
    }

    results.push({ saved, points, early });
    savesEl.textContent = String(results.filter(r => r.saved).length);

    kick++;

    later(() => {
      if (kick < KICKS) startKick();
      else finish();
    }, 1300);
  }


  /* ---------- INPUT: tap the goal ---------- */

  function spotFromPoint(event) {
    const rect = stage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const third = (GOAL.right - GOAL.left) / 3;
    const col = x < GOAL.left + third ? "L" : x < GOAL.left + third * 2 ? "C" : "R";
    const row = y < (GOAL.top + GOAL.bottom) / 2 ? "T" : "B";

    return { col, row };
  }

  function onPointer(event) {
    event.preventDefault();

    if (finished || dive) return;
    if (phase !== "runup" && phase !== "flying") return;

    dive = spotFromPoint(event);
    diveAt = performance.now();

    hintEl.classList.add("hide");

    container.querySelector(`[data-zone="${dive.col}${dive.row}"]`)?.classList.add("chosen");
    placeKeeper(dive);
  }

  stage.addEventListener("pointerdown", onPointer);


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;

    finished = true;
    timers.forEach(clearTimeout);

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
          success: saves >= Math.ceil(KICKS * 0.5),
          saves,
          kicks: KICKS,
          early
        }
      });
    }, 300);
  }


  /* ---------- START ---------- */

  placeKeeper(null);
  resetBall();
  later(startKick, 600);


  return () => {
    finished = true;
    timers.forEach(clearTimeout);
    ballAnim?.cancel();
    diveAnim?.cancel();
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
