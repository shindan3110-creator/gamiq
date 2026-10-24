// GAMIQ（ゲーミック） v2 - Cup Shuffle
//
// CUP SHUFFLE
// - A ball is shown under one cup.
// - The cups go down and get shuffled.
// - Tap the cup with the ball. 3 rounds.
// - Level: more cups, more swaps, faster swaps.

import { t } from "../i18n.js";
import { byLevel, byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createCupGames() {
  return [
    {
      id: "memory_cup_shuffle",
      type: "cup_shuffle",
      title: "CUP SHUFFLE",
      rule: "FOLLOW THE CUP WITH THE BALL!",
      skill: "MEMORY",
      theme: "table",
      duration: 25000
    }
  ];
}

export function runCupGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "cup_shuffle") {
    return runCupShuffle({
      container,
      onComplete,
      level: game.level
    });
  }

  return () => {};
}


const CUP_SVG = `
  <svg viewBox="0 0 100 110" aria-hidden="true">
    <path d="M14 104 L26 12 Q50 4 74 12 L86 104 Q50 112 14 104 Z" fill="#d93a4a"/>
    <path d="M26 12 Q50 4 74 12 L76 26 Q50 18 24 26 Z" fill="#ff6b78"/>
    <path d="M33 30 L28 96" stroke="rgba(255,255,255,.35)" stroke-width="6" stroke-linecap="round"/>
    <path d="M14 104 Q50 112 86 104 L86 98 Q50 106 14 98 Z" fill="#a52432"/>
  </svg>
`;

const ROUNDS = 3;
const ANSWER_TIME_MS = 6000;

function runCupShuffle({
  container,
  onComplete,
  level = 1
}) {
  /*
   * DIFFICULTY BY LEVEL
   *   cups:  3 -> 5
   *   swaps: 7 -> 16 (more in later rounds)
   *   swap speed: 300ms -> 120ms (faster than before)
   */
  const cupCount = Math.min(6, byLevelInt(level, 3, 5));
  const baseSwaps = byLevelInt(level, 7, 16);
  const swapMs = Math.max(85, Math.round(byLevel(level, 300, 120)));

  let active = true;
  let round = 0;
  let correct = 0;
  let canPick = false;
  let ballCup = 0;
  let pickStartedAt = 0;

  const reactionTimes = [];
  const timers = new Set();

  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      if (active) fn();
    }, ms);

    timers.add(id);
    return id;
  }

  let answerTimer = null;


  container.innerHTML = `
    <div class="cup-game">

      <div class="cup-hud">
        <div>
          <span>ROUND</span>
          <strong data-cup-round>1 / ${ROUNDS}</strong>
        </div>

        <div>
          <span>FOUND</span>
          <strong data-cup-score>0</strong>
        </div>
      </div>

      <div class="cup-stage" data-cup-stage>
        <div class="cup-message" data-cup-message>${t("cups.watch")}</div>

        <div class="cup-table">
          <div class="cup-row" data-cup-row></div>
        </div>
      </div>

    </div>
  `;

  const row = container.querySelector("[data-cup-row]");
  const messageEl = container.querySelector("[data-cup-message]");
  const roundEl = container.querySelector("[data-cup-round]");
  const scoreEl = container.querySelector("[data-cup-score]");

  row.style.setProperty("--swap", `${swapMs}ms`);
  row.style.setProperty("--cups", cupCount);


  /* ---------- CUPS ---------- */

  // cups[i] = the cup element; slotOf[i] = where cup i stands now
  const cups = [];
  const slotOf = [];

  for (let i = 0; i < cupCount; i++) {
    const cup = document.createElement("button");

    cup.type = "button";
    cup.className = "cup";
    cup.innerHTML = `
      <div class="cup-ball"></div>
      <div class="cup-body">${CUP_SVG}</div>
    `;

    cup.addEventListener("pointerdown", event => {
      event.preventDefault();
      pick(i);
    });

    row.appendChild(cup);

    cups.push(cup);
    slotOf.push(i);
  }

  function slotX(slot) {
    // centers spread evenly across the row (in %)
    return ((slot + 0.5) / cupCount) * 100;
  }

  function place(index) {
    cups[index].style.left = `${slotX(slotOf[index])}%`;
  }

  cups.forEach((_, i) => place(i));


  /* ---------- ROUND ---------- */

  function startRound() {
    canPick = false;

    roundEl.textContent = `${round + 1} / ${ROUNDS}`;
    messageEl.textContent = t("cups.watch");
    messageEl.className = "cup-message";

    cups.forEach(cup => {
      cup.classList.remove("lift", "chosen", "right", "wrong", "has-ball");
    });

    // Put the ball under a random cup and show it.
    ballCup = Math.floor(Math.random() * cupCount);
    cups[ballCup].classList.add("has-ball");

    later(() => {
      cups[ballCup].classList.add("lift");
      sfx("whoosh");
    }, 300);

    later(() => {
      cups[ballCup].classList.remove("lift");
      sfx("thud");
    }, 1400);

    // Later rounds have a few more swaps.
    const swaps = baseSwaps + round * 2;

    later(() => shuffle(swaps), 1900);
  }

  function shuffle(remaining) {
    if (remaining <= 0) {
      askPick();
      return;
    }

    messageEl.textContent = t("cups.shuffle");

    // Pick two different cups (by slot) and swap them.
    const a = Math.floor(Math.random() * cupCount);
    let b = Math.floor(Math.random() * cupCount);

    while (b === a) {
      b = Math.floor(Math.random() * cupCount);
    }

    const cupA = slotOf.indexOf(a);
    const cupB = slotOf.indexOf(b);

    slotOf[cupA] = b;
    slotOf[cupB] = a;

    // One passes in front (lower, bigger), one behind (higher, smaller)
    cups[cupA].classList.remove("arc-front", "arc-back");
    cups[cupB].classList.remove("arc-front", "arc-back");
    void cups[cupA].offsetWidth;

    cups[cupA].classList.add("arc-front");
    cups[cupB].classList.add("arc-back");

    place(cupA);
    place(cupB);

    sfx("click");

    later(() => {
      cups[cupA].classList.remove("arc-front");
      cups[cupB].classList.remove("arc-back");

      shuffle(remaining - 1);
    }, swapMs + 15);
  }

  function askPick() {
    canPick = true;
    pickStartedAt = performance.now();

    messageEl.textContent = t("cups.pick");
    messageEl.className = "cup-message ask";

    answerTimer = later(() => {
      // Too slow: counts as wrong.
      if (canPick) {
        reveal(null);
      }
    }, ANSWER_TIME_MS);
  }

  function pick(index) {
    if (!active || !canPick) {
      return;
    }

    reveal(index);
  }

  function reveal(index) {
    canPick = false;

    clearTimeout(answerTimer);
    timers.delete(answerTimer);

    const right = index === ballCup;

    if (index !== null) {
      reactionTimes.push(performance.now() - pickStartedAt);
      cups[index].classList.add("lift", "chosen", right ? "right" : "wrong");
    }

    if (right) {
      correct++;
      scoreEl.textContent = String(correct);

      messageEl.textContent = t("cups.right");
      messageEl.className = "cup-message right";

      sfx("perfect");
    } else {
      // Show where the ball really was.
      cups[ballCup].classList.add("lift", "right");

      messageEl.textContent =
        index === null ? t("cups.tooSlow") : t("cups.wrong");
      messageEl.className = "cup-message wrong";

      sfx("bad");
    }

    round++;

    later(() => {
      if (round >= ROUNDS) {
        finish();
      } else {
        startRound();
      }
    }, 1300);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (!active) {
      return;
    }

    active = false;

    timers.forEach(id => clearTimeout(id));
    timers.clear();

    const rate = correct / ROUNDS;

    const avgReaction =
      reactionTimes.length
        ? reactionTimes.reduce((sum, v) => sum + v, 0) / reactionTimes.length
        : ANSWER_TIME_MS;

    // Mostly "did you follow it", a little "how sure / quick".
    const quickBonus = clamp(1 - (avgReaction - 600) / 3000, 0, 1);

    const score = clamp(rate * 90 + (rate > 0 ? quickBonus * 10 : 0), 0, 100);

    const success = correct >= 2;

    onComplete?.({
      score: Math.round(score),

      adapt: Math.round(clamp(40 + rate * 50 + quickBonus * 10, 0, 100)),

      meta: {
        success,
        correct,
        rounds: ROUNDS,
        cups: cupCount,
        swapMs,
        avgReaction: Math.round(avgReaction)
      }
    });
  }


  /* ---------- START ---------- */

  later(startRound, 300);


  return () => {
    active = false;

    timers.forEach(id => clearTimeout(id));
    timers.clear();
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
