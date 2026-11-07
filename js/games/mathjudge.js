// GAMIQ（ゲーミック） v2 - Math Judge
//
// MATH JUDGE (LOGIC)
// - An equation appears: "7 + 5 = 13". Is it right?
// - Tap ○ (right) or × (wrong). PC: ← / → keys (or O / X).
// - 20 seconds. As many as you can. Wrong answers cost points.
// - Wrong equations are close (off by 1, 2 or 10), so look carefully.
// - Higher level: bigger numbers, ×, and three numbers at once.

import { t } from "../i18n.js";
import { byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createMathJudgeGames() {
  return [
    {
      id: "logic_math_judge",
      type: "math_judge",
      title: "MATH JUDGE",
      rule: "IS THE EQUATION RIGHT? ○ OR ×, AS FAST AS YOU CAN!",
      skill: "LOGIC",
      theme: "class",
      duration: 22000
    }
  ];
}

export function runMathJudgeGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "math_judge") {
    return runMathJudge({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const TIME_MS = 20000;

function rand(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/*
 * Make one equation for the level.
 *   tier 0: 1-digit + and −
 *   tier 1: 2-digit + and −, small ×
 *   tier 2: bigger ×, mixed
 *   tier 3 (hell): three numbers, e.g. 8 × 7 − 19
 */
function makeEquation(tier) {
  let text;
  let answer;

  const ops = tier === 0 ? ["+", "−"] : tier === 1 ? ["+", "−", "×"] : ["+", "−", "×", "×"];
  const op = pick(ops);

  if (tier >= 3 && Math.random() < 0.6) {
    // a × b ± c
    const a = rand(3, 12);
    const b = rand(3, 9);
    const c = rand(5, 40);
    const plus = Math.random() < 0.5;
    answer = a * b + (plus ? c : -c);
    text = `${a} × ${b} ${plus ? "+" : "−"} ${c}`;
  } else if (op === "+") {
    const max = tier === 0 ? 9 : tier === 1 ? 60 : 99;
    const a = rand(tier === 0 ? 1 : 11, max);
    const b = rand(tier === 0 ? 1 : 6, max);
    answer = a + b;
    text = `${a} + ${b}`;
  } else if (op === "−") {
    const max = tier === 0 ? 9 : tier === 1 ? 60 : 99;
    let a = rand(tier === 0 ? 2 : 15, max + (tier === 0 ? 0 : 20));
    let b = rand(1, a - 1);
    answer = a - b;
    text = `${a} − ${b}`;
  } else {
    const a = rand(2, tier === 1 ? 9 : 15);
    const b = rand(2, 9);
    answer = a * b;
    text = `${a} × ${b}`;
  }

  // Half of them are wrong — but only a little wrong
  const correct = Math.random() < 0.5;
  let shown = answer;

  if (!correct) {
    const offsets = tier === 0 ? [-2, -1, 1, 2] : [-10, -2, -1, 1, 2, 10];
    shown = answer + pick(offsets);
    if (shown < 0) shown = answer + 1;
  }

  return { text: `${text} = ${shown}`, correct };
}

function runMathJudge({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   numbers: 1-digit (Lv1) -> 2-digit and × (Lv4+) -> three numbers (Lv8+)
   *   goal for a full score: 18 (Lv1) -> 13 (old Lv10)
   */
  const tierAt = () => {
    if (level >= 8) return 3;
    if (level >= 5) return 2;
    if (level >= 2) return 1;
    return 0;
  };
  const goal = Math.max(11, byLevelInt(level, 18, 13));

  let finished = false;
  let right = 0;
  let wrong = 0;
  let streak = 0;
  let bestStreak = 0;
  let current = null;
  let locked = false;
  let count = 0;

  let frameId = null;
  let timers = [];
  const startedAt = performance.now();

  container.innerHTML = `
    <div class="be-game mj-game">
      <div class="be-hud">
        <div>
          <span>CORRECT</span>
          <strong data-mj-right>0</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-mj-time>${TIME_MS / 1000}</strong>
        </div>
        <div>
          <span>STREAK</span>
          <strong data-mj-streak>0</strong>
        </div>
      </div>

      <div class="mj-stage" data-mj-stage>
        <div class="mj-timebar"><i data-mj-bar></i></div>
        <div class="mj-card" data-mj-card>
          <div class="mj-eq" data-mj-eq></div>
          <div class="mj-mark" data-mj-mark></div>
        </div>
        <div class="be-message mj-message" data-mj-message></div>
      </div>

      <div class="mj-buttons">
        <button type="button" class="mj-btn ok" data-mj-yes>
          <b>○</b><small>${t("mj.right")}</small>
        </button>
        <button type="button" class="mj-btn ng" data-mj-no>
          <b>×</b><small>${t("mj.wrong")}</small>
        </button>
      </div>
    </div>
  `;

  const card = container.querySelector("[data-mj-card]");
  const eqEl = container.querySelector("[data-mj-eq]");
  const markEl = container.querySelector("[data-mj-mark]");
  const rightEl = container.querySelector("[data-mj-right]");
  const timeEl = container.querySelector("[data-mj-time]");
  const streakEl = container.querySelector("[data-mj-streak]");
  const bar = container.querySelector("[data-mj-bar]");
  const messageEl = container.querySelector("[data-mj-message]");
  const yesBtn = container.querySelector("[data-mj-yes]");
  const noBtn = container.querySelector("[data-mj-no]");

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);
    timers.push(id);
  }

  function next() {
    current = makeEquation(tierAt());
    count++;
    eqEl.textContent = current.text;
    markEl.textContent = "";
    card.className = "mj-card";
    void card.offsetWidth;
    card.classList.add("in");
    locked = false;

    // For automatic tests only (not used by the game)
    card.__mj = current;
  }

  function answer(sayRight) {
    if (finished || locked || !current) return;
    locked = true;

    const ok = sayRight === current.correct;

    if (ok) {
      right++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      sfx("good");
      card.classList.add("good");
      markEl.textContent = "○";

      if (streak > 0 && streak % 5 === 0) {
        showMessage(`${streak} STREAK!`, "great");
      }

      later(next, 160);
    } else {
      wrong++;
      streak = 0;
      sfx("bad");
      card.classList.add("bad");
      markEl.textContent = current.correct ? t("mj.wasRight") : t("mj.wasWrong");
      // a short pause after a mistake
      later(next, 650);
    }

    updateHud();
  }

  function onKey(event) {
    if (finished) return;
    if (event.code === "ArrowLeft" || event.code === "KeyO") {
      event.preventDefault();
      press(yesBtn);
      answer(true);
    } else if (event.code === "ArrowRight" || event.code === "KeyX") {
      event.preventDefault();
      press(noBtn);
      answer(false);
    }
  }

  function press(btn) {
    btn.classList.remove("pressed");
    void btn.offsetWidth;
    btn.classList.add("pressed");
  }

  function onYes(event) {
    event.preventDefault();
    answer(true);
  }

  function onNo(event) {
    event.preventDefault();
    answer(false);
  }

  function tick(now) {
    if (finished) return;
    const left = Math.max(0, TIME_MS - (now - startedAt));
    timeEl.textContent = Math.ceil(left / 1000);
    bar.style.transform = `scaleX(${left / TIME_MS})`;

    if (left <= 0) {
      finish();
      return;
    }
    frameId = requestAnimationFrame(tick);
  }

  let messageTimer = null;

  function showMessage(text, type) {
    clearTimeout(messageTimer);
    messageEl.textContent = text;
    messageEl.className = `be-message mj-message show ${type || ""}`;
    messageTimer = setTimeout(() => {
      messageEl.className = "be-message mj-message";
    }, 700);
  }

  function updateHud() {
    rightEl.textContent = String(right);
    streakEl.textContent = String(streak);
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frameId);

    // Each mistake takes back one correct answer
    const net = Math.max(0, right - wrong);
    const score = clamp((net / goal) * 100, 0, 100);
    const accuracy = right + wrong ? right / (right + wrong) : 0;
    const success = net >= goal * 0.6;

    showMessage(success ? "CLEAR!" : "TIME UP", success ? "perfect" : "bad");
    sfx(success ? "clear" : "fail");

    setTimeout(() => {
      onComplete?.({
        score: Math.round(score),
        adapt: Math.round(clamp(25 + accuracy * 45 + Math.min(1, net / goal) * 30, 0, 100)),
        meta: {
          success,
          right,
          wrong,
          bestStreak,
          goal,
          elapsed: Math.round(performance.now() - startedAt)
        }
      });
    }, 600);
  }

  yesBtn.addEventListener("pointerdown", onYes);
  noBtn.addEventListener("pointerdown", onNo);
  window.addEventListener("keydown", onKey);

  next();
  updateHud();
  frameId = requestAnimationFrame(tick);

  return () => {
    finished = true;
    cancelAnimationFrame(frameId);
    timers.forEach(clearTimeout);
    clearTimeout(messageTimer);
    yesBtn.removeEventListener("pointerdown", onYes);
    noBtn.removeEventListener("pointerdown", onNo);
    window.removeEventListener("keydown", onKey);
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
