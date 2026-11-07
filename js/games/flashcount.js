// GAMIQ（ゲーミック） v2 - Flash Count
//
// FLASH COUNT (SPEED)
// - Dots flash on the screen for a moment. How many were there?
// - Pick the number from 4 choices (PC: keys 1-4).
// - 8 rounds. Exact = full points, off by one = some points.
// - Higher level: more dots, shorter flash, and from Lv5 mixed colors:
//   "How many RED?" — count only one color.

import { t } from "../i18n.js";
import { byLevel, byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createFlashCountGames() {
  return [
    {
      id: "speed_flash_count",
      type: "flash_count",
      title: "FLASH COUNT",
      rule: "DOTS FLASH FOR A MOMENT. HOW MANY WERE THERE?",
      skill: "SPEED",
      theme: "lab",
      duration: 30000,
      maxDuration: 60000
    }
  ];
}

export function runFlashCountGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "flash_count") {
    return runFlashCount({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const ROUNDS = 8;
const ANSWER_MS = 4000;

const COLORS = [
  { key: "red", css: "#ff4d5e" },
  { key: "blue", css: "#3d8bff" },
  { key: "yellow", css: "#ffd23a" }
];

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function runFlashCount({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   dots:  3-9 (Lv1) -> 7-15 (old Lv10)
   *   flash: 800ms (Lv1) -> 350ms
   *   colors: one color (Lv1-4) -> count one color among 2 (Lv5+) / 3 (Lv8+)
   */
  const minDots = Math.min(10, byLevelInt(level, 3, 7));
  const maxDots = Math.min(18, byLevelInt(level, 9, 15));
  const flashMs = Math.max(220, byLevel(level, 800, 350));
  const colorCount = level >= 8 ? 3 : level >= 5 ? 2 : 1;

  let finished = false;
  let round = 0;
  let total = 0;
  let exact = 0;
  let near = 0;
  let answer = 0;
  let waiting = false;
  let askedAt = 0;
  let timers = [];
  let answerTimer = null;
  const startedAt = performance.now();

  container.innerHTML = `
    <div class="be-game fc-game">
      <div class="be-hud">
        <div>
          <span>ROUND</span>
          <strong data-fc-round>1 / ${ROUNDS}</strong>
        </div>
        <div>
          <span>EXACT</span>
          <strong data-fc-exact>0</strong>
        </div>
        <div>
          <span>POINTS</span>
          <strong data-fc-points>0</strong>
        </div>
      </div>

      <div class="fc-stage" data-fc-stage>
        <div class="fc-dots" data-fc-dots></div>
        <div class="fc-mask" data-fc-mask></div>
        <div class="fc-question" data-fc-question></div>
        <div class="fc-result" data-fc-result></div>
        <div class="fc-anstime"><i data-fc-anstime></i></div>
      </div>

      <div class="fc-choices" data-fc-choices>
        ${[0, 1, 2, 3].map(i => `<button type="button" class="fc-btn" data-fc-pick="${i}" disabled>?</button>`).join("")}
      </div>
    </div>
  `;

  const stage = container.querySelector("[data-fc-stage]");
  const dotsEl = container.querySelector("[data-fc-dots]");
  const maskEl = container.querySelector("[data-fc-mask]");
  const questionEl = container.querySelector("[data-fc-question]");
  const resultEl = container.querySelector("[data-fc-result]");
  const ansBar = container.querySelector("[data-fc-anstime]");
  const roundEl = container.querySelector("[data-fc-round]");
  const exactEl = container.querySelector("[data-fc-exact]");
  const pointsEl = container.querySelector("[data-fc-points]");
  const buttons = [...container.querySelectorAll("[data-fc-pick]")];

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);
    timers.push(id);
  }


  /* ---------- ROUND ---------- */

  function placeDots(n, colorsFor) {
    dotsEl.innerHTML = "";
    const rect = stage.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const size = Math.max(16, Math.min(w, h) * 0.075);
    const pts = [];

    for (let i = 0; i < n; i++) {
      let p = null;
      for (let tries = 0; tries < 200; tries++) {
        const x = size + Math.random() * (w - size * 2);
        const y = size + Math.random() * (h - size * 2);
        if (pts.every(q => Math.hypot(q.x - x, q.y - y) > size * 1.5)) {
          p = { x, y };
          break;
        }
      }
      if (!p) p = { x: size + Math.random() * (w - size * 2), y: size + Math.random() * (h - size * 2) };
      pts.push(p);

      const dot = document.createElement("i");
      dot.className = "fc-dot";
      dot.style.left = `${p.x}px`;
      dot.style.top = `${p.y}px`;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.background = colorsFor[i];
      dotsEl.appendChild(dot);
    }
  }

  function startRound() {
    roundEl.textContent = `${round + 1} / ${ROUNDS}`;
    resultEl.textContent = "";
    resultEl.className = "fc-result";
    buttons.forEach(b => {
      b.disabled = true;
      b.className = "fc-btn";
      b.textContent = "?";
    });

    // What to count this round
    const n = minDots + Math.floor(Math.random() * (maxDots - minDots + 1));
    let colorsFor;
    let targetColor = null;

    if (colorCount === 1) {
      colorsFor = Array(n).fill("#ffffff");
      answer = n;
      questionEl.textContent = t("fc.ready");
    } else {
      const palette = COLORS.slice(0, colorCount);
      targetColor = palette[Math.floor(Math.random() * palette.length)];
      // at least 2 of the target color, the rest mixed
      const targetN = Math.max(2, Math.round(n * (0.35 + Math.random() * 0.25)));
      colorsFor = [];
      for (let i = 0; i < n; i++) {
        if (i < targetN) colorsFor.push(targetColor.css);
        else {
          const others = palette.filter(c => c !== targetColor);
          colorsFor.push(others[Math.floor(Math.random() * others.length)].css);
        }
      }
      shuffle(colorsFor);
      answer = targetN;
      questionEl.innerHTML = t("fc.countColor", { color: `<b style="color:${targetColor.css}">${t(`fc.${targetColor.key}`)}</b>` });
    }

    questionEl.className = "fc-question show";
    maskEl.className = "fc-mask";
    dotsEl.innerHTML = "";

    // 1) question / ready  2) flash  3) mask  4) choices
    later(() => {
      placeDots(n, colorsFor);
      questionEl.className = "fc-question";
      sfx("tick");
      later(() => {
        dotsEl.innerHTML = "";
        maskEl.className = "fc-mask show";
        later(ask, 180);
      }, flashMs);
    }, colorCount > 1 ? 1100 : 700);
  }

  function ask() {
    maskEl.className = "fc-mask";
    questionEl.innerHTML = colorCount > 1 ? questionEl.innerHTML : t("fc.howMany");
    questionEl.className = "fc-question show";

    // 4 choices close to the answer
    const set = new Set([answer]);
    const near = shuffle([-2, -1, 1, 2, 3, -3]);
    for (const d of near) {
      if (set.size >= 4) break;
      if (answer + d >= 1) set.add(answer + d);
    }
    const choices = [...set].sort((a, b) => a - b);

    buttons.forEach((b, i) => {
      b.textContent = String(choices[i]);
      b.dataset.value = String(choices[i]);
      b.disabled = false;
    });

    waiting = true;
    askedAt = performance.now();
    ansBar.style.transition = "none";
    ansBar.style.transform = "scaleX(1)";
    void ansBar.offsetWidth;
    ansBar.style.transition = `transform ${ANSWER_MS}ms linear`;
    ansBar.style.transform = "scaleX(0)";

    clearTimeout(answerTimer);
    answerTimer = setTimeout(() => {
      if (!finished && waiting) choose(null);
    }, ANSWER_MS);

    // For automatic tests only (not used by the game)
    stage.__fc = { answer };
  }

  function choose(value) {
    if (!waiting) return;
    waiting = false;
    clearTimeout(answerTimer);
    ansBar.style.transition = "none";

    const diff = value === null ? 99 : Math.abs(value - answer);
    let pts = 0;

    if (diff === 0) {
      exact++;
      pts = 100;
      sfx("good");
      resultEl.textContent = `${t("fc.exact")} ${answer}`;
      resultEl.className = "fc-result good";
    } else if (diff === 1) {
      near++;
      pts = 40;
      sfx("thud");
      resultEl.textContent = `${t("fc.close")} ${answer}`;
      resultEl.className = "fc-result near";
    } else {
      sfx("bad");
      resultEl.textContent = `${value === null ? t("fc.timeUp") : t("fc.miss")} ${answer}`;
      resultEl.className = "fc-result bad";
    }

    total += pts;

    buttons.forEach(b => {
      b.disabled = true;
      if (Number(b.dataset.value) === answer) b.classList.add("ans");
      else if (value !== null && Number(b.dataset.value) === value) b.classList.add("wrong");
    });

    questionEl.className = "fc-question";
    updateHud();

    round++;
    if (round >= ROUNDS) later(finish, 900);
    else later(startRound, 900);
  }

  function onPick(event) {
    event.preventDefault();
    const b = event.currentTarget;
    if (b.disabled) return;
    choose(Number(b.dataset.value));
  }

  function onKey(event) {
    const map = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };
    const i = map[event.code];
    if (i === undefined || !waiting) return;
    event.preventDefault();
    choose(Number(buttons[i].dataset.value));
  }

  function updateHud() {
    exactEl.textContent = String(exact);
    pointsEl.textContent = String(total);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;
    finished = true;

    const score = clamp(total / ROUNDS, 0, 100);
    const success = exact >= ROUNDS / 2;

    sfx(success ? "clear" : "fail");

    setTimeout(() => {
      onComplete?.({
        score: Math.round(score),
        adapt: Math.round(clamp(30 + (exact / ROUNDS) * 55 + (near / ROUNDS) * 15, 0, 100)),
        meta: {
          success,
          exact,
          near,
          rounds: ROUNDS,
          elapsed: Math.round(performance.now() - startedAt)
        }
      });
    }, 400);
  }


  /* ---------- START ---------- */

  buttons.forEach(b => b.addEventListener("pointerdown", onPick));
  window.addEventListener("keydown", onKey);

  updateHud();
  later(startRound, 300);

  return () => {
    finished = true;
    timers.forEach(clearTimeout);
    clearTimeout(answerTimer);
    buttons.forEach(b => b.removeEventListener("pointerdown", onPick));
    window.removeEventListener("keydown", onKey);
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
