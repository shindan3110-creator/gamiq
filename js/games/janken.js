// GAMIQ（ゲーミック） v2 - Janken (rock-paper-scissors) Order
//
// JANKEN ORDER (SPEED)
// - The rival shows a hand and gives an order: WIN / LOSE / DRAW.
// - Pick the hand that follows the order, as fast as you can.
//   (PC: 1 / 2 / 3 or A / S / D)
// - 20 seconds. Wrong answers cost one correct answer and a short pause.
// - Higher level: DRAW appears, then "DON'T WIN" / "DON'T LOSE"
//   (two hands are OK), and in hell levels each turn has a time limit.

import { t } from "../i18n.js";
import { byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createJankenGames() {
  return [
    {
      id: "speed_janken",
      type: "janken",
      title: "JANKEN ORDER",
      rule: "FOLLOW THE ORDER: WIN, LOSE OR DRAW AGAINST THE RIVAL'S HAND!",
      skill: "SPEED",
      theme: "arena",
      duration: 22000
    }
  ];
}

export function runJankenGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "janken") {
    return runJanken({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const TIME_MS = 20000;

// 0 = rock, 1 = scissors, 2 = paper
const HANDS = ["✊", "✌️", "✋"];

// What beats `h`: rock(0) is beaten by paper(2), scissors(1) by rock(0), paper(2) by scissors(1)
const beats = h => (h + 2) % 3;
const losesTo = h => (h + 1) % 3;

function runJanken({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   Lv1-2: WIN / LOSE
   *   Lv3+ : + DRAW
   *   Lv6+ : + DON'T WIN / DON'T LOSE (two hands are right)
   *   Lv8+ : each turn has a time limit
   *   goal for a full score: 16 (Lv1) -> 13
   */
  const orders = ["win", "lose"];
  if (level >= 3) orders.push("draw");
  if (level >= 6) orders.push("notWin", "notLose");
  const turnLimit = level >= 8 ? Math.max(700, 1500 - (level - 8) * 250) : 0;
  const goal = Math.max(12, byLevelInt(level, 16, 13));

  let finished = false;
  let right = 0;
  let wrong = 0;
  let streak = 0;
  let bestStreak = 0;
  let rival = 0;
  let order = "win";
  let locked = true;
  let turnStart = 0;

  let frameId = null;
  let timers = [];
  let messageTimer = null;
  const startedAt = performance.now();

  container.innerHTML = `
    <div class="be-game jk-game">
      <div class="be-hud">
        <div>
          <span>CORRECT</span>
          <strong data-jk-right>0</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-jk-time>${TIME_MS / 1000}</strong>
        </div>
        <div>
          <span>STREAK</span>
          <strong data-jk-streak>0</strong>
        </div>
      </div>

      <div class="jk-stage" data-jk-stage>
        <div class="jk-timebar"><i data-jk-bar></i></div>
        <div class="jk-rival">
          <div class="jk-rival-label">${t("jk.rival")}</div>
          <div class="jk-hand" data-jk-hand>✊</div>
        </div>
        <div class="jk-order" data-jk-order></div>
        <div class="jk-turnbar" data-jk-turnwrap><i data-jk-turn></i></div>
        <div class="be-message jk-message" data-jk-message></div>
      </div>

      <div class="jk-buttons">
        ${HANDS.map((h, i) => `
          <button type="button" class="jk-btn" data-jk-pick="${i}">
            <b>${h}</b><small>${t(`jk.hand${i}`)}</small>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  const stage = container.querySelector("[data-jk-stage]");
  const handEl = container.querySelector("[data-jk-hand]");
  const orderEl = container.querySelector("[data-jk-order]");
  const rightEl = container.querySelector("[data-jk-right]");
  const timeEl = container.querySelector("[data-jk-time]");
  const streakEl = container.querySelector("[data-jk-streak]");
  const bar = container.querySelector("[data-jk-bar]");
  const turnWrap = container.querySelector("[data-jk-turnwrap]");
  const turnBar = container.querySelector("[data-jk-turn]");
  const messageEl = container.querySelector("[data-jk-message]");
  const buttons = [...container.querySelectorAll("[data-jk-pick]")];

  if (!turnLimit) turnWrap.style.display = "none";

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);
    timers.push(id);
  }

  function correctHands() {
    switch (order) {
      case "win": return [beats(rival)];
      case "lose": return [losesTo(rival)];
      case "draw": return [rival];
      case "notWin": return [rival, losesTo(rival)];
      case "notLose": return [rival, beats(rival)];
      default: return [];
    }
  }

  function next() {
    let newRival = Math.floor(Math.random() * 3);
    let newOrder = orders[Math.floor(Math.random() * orders.length)];
    // avoid the exact same question twice in a row
    if (newRival === rival && newOrder === order) newRival = (newRival + 1) % 3;
    rival = newRival;
    order = newOrder;

    handEl.textContent = HANDS[rival];
    orderEl.textContent = t(`jk.${order}`);
    orderEl.className = `jk-order ${order}`;
    stage.classList.remove("good", "bad");
    handEl.classList.remove("pop");
    void handEl.offsetWidth;
    handEl.classList.add("pop");

    buttons.forEach(b => b.classList.remove("ans", "pressed"));
    turnStart = performance.now();
    locked = false;

    // For automatic tests only (not used by the game)
    stage.__jk = { answers: correctHands() };
  }

  function pick(i) {
    if (finished || locked) return;
    locked = true;

    const answers = correctHands();
    const ok = answers.includes(i);

    buttons[i].classList.add("pressed");

    if (ok) {
      right++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      sfx("good");
      stage.classList.add("good");
      if (streak % 5 === 0) showMessage(`${streak} STREAK!`, "great");
      later(next, 170);
    } else {
      miss();
    }
    updateHud();
  }

  function miss(timeout = false) {
    wrong++;
    streak = 0;
    sfx("bad");
    stage.classList.add("bad");
    showMessage(timeout ? t("jk.tooSlow") : t("jk.miss"), "bad");
    correctHands().forEach(h => buttons[h].classList.add("ans"));
    later(next, 700);
    updateHud();
  }

  function onPick(event) {
    event.preventDefault();
    pick(Number(event.currentTarget.dataset.jkPick));
  }

  function onKey(event) {
    const map = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2, KeyA: 0, KeyS: 1, KeyD: 2 };
    const i = map[event.code];
    if (i === undefined) return;
    event.preventDefault();
    pick(i);
  }

  function tick(now) {
    if (finished) return;

    const left = Math.max(0, TIME_MS - (now - startedAt));
    timeEl.textContent = Math.ceil(left / 1000);
    bar.style.transform = `scaleX(${left / TIME_MS})`;

    if (turnLimit && !locked) {
      const used = (now - turnStart) / turnLimit;
      turnBar.style.transform = `scaleX(${Math.max(0, 1 - used)})`;
      if (used >= 1) {
        locked = true;
        miss(true);
      }
    }

    if (left <= 0) {
      finish();
      return;
    }
    frameId = requestAnimationFrame(tick);
  }

  function showMessage(text, type) {
    clearTimeout(messageTimer);
    messageEl.textContent = text;
    messageEl.className = `be-message jk-message show ${type || ""}`;
    messageTimer = setTimeout(() => {
      messageEl.className = "be-message jk-message";
    }, 650);
  }

  function updateHud() {
    rightEl.textContent = String(right);
    streakEl.textContent = String(streak);
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frameId);

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

  buttons.forEach(b => b.addEventListener("pointerdown", onPick));
  window.addEventListener("keydown", onKey);

  later(next, 300);
  updateHud();
  frameId = requestAnimationFrame(tick);

  return () => {
    finished = true;
    cancelAnimationFrame(frameId);
    timers.forEach(clearTimeout);
    clearTimeout(messageTimer);
    buttons.forEach(b => b.removeEventListener("pointerdown", onPick));
    window.removeEventListener("keydown", onKey);
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
