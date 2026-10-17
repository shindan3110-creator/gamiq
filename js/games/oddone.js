// GAMIQ（ゲーミック） v2 - Odd One Out
//
// ODD ONE OUT
// - Many same pictures, one is different. Tap it!
// - Find as many as you can in 20 seconds.
// - Each round: bigger grid, subtler difference.
// - Wrong tap = -1.5 seconds.

import { t } from "../i18n.js";
import { byLevel, byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createOddOneGames() {
  return [
    {
      id: "logic_odd_one_out",
      type: "odd_one_out",
      title: "ODD ONE OUT",
      rule: "ONE IS DIFFERENT. FIND IT FAST!",
      skill: "LOGIC",
      theme: "grid",
      duration: 20000
    }
  ];
}

export function runOddOneGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "odd_one_out") {
    return runOddOneOut({
      container,
      onComplete,
      level: game.level
    });
  }

  return () => {};
}


/* ==========================================
PICTURES (viewBox 0 0 40 40)
Each has options that can be changed for the odd one.
========================================== */

const SHAPES = {
  fish: {
    asym: true,
    draw: o => `
      <path d="M8 20 Q16 9 27 14 L35 9 L33 20 L35 31 L27 26 Q16 31 8 20 Z" fill="${o.color}"/>
      ${o.noDetail ? "" : `<circle cx="14" cy="18" r="2.2" fill="#1d1a16"/>`}`
  },
  apple: {
    asym: true,
    draw: o => `
      <path d="M20 13 Q12 8 8 16 Q5 26 13 33 Q17 35 20 33 Q23 35 27 33 Q35 26 32 16 Q28 8 20 13 Z" fill="${o.color}"/>
      <path d="M20 13 Q20 8 22 6" stroke="#7a4b22" stroke-width="2" fill="none"/>
      ${o.noDetail ? "" : `<path d="M22 9 Q28 5 30 9 Q26 12 22 9 Z" fill="#3fb950"/>`}`
  },
  clock: {
    asym: true,
    draw: o => `
      <circle cx="20" cy="20" r="14" fill="${o.color}"/>
      <circle cx="20" cy="20" r="11" fill="#ffffff"/>
      <path d="M20 20 L20 12" stroke="#1d1a16" stroke-width="2.4" stroke-linecap="round"/>
      ${o.noDetail ? "" : `<path d="M20 20 L26 23" stroke="#1d1a16" stroke-width="2" stroke-linecap="round"/>`}`
  },
  face: {
    asym: false,
    draw: o => `
      <circle cx="20" cy="20" r="15" fill="${o.color}"/>
      <circle cx="14.5" cy="17" r="2" fill="#1d1a16"/>
      ${o.noDetail
        ? `<path d="M23.5 17 L27.5 17" stroke="#1d1a16" stroke-width="2" stroke-linecap="round"/>`
        : `<circle cx="25.5" cy="17" r="2" fill="#1d1a16"/>`}
      <path d="M13 24 Q20 30 27 24" stroke="#1d1a16" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
  },
  ghost: {
    asym: true,
    draw: o => `
      <path d="M10 34 L10 18 Q10 7 20 7 Q30 7 30 18 L30 34 L26 31 L22 34 L18 31 L14 34 Z" fill="${o.color}"/>
      <circle cx="16" cy="18" r="2" fill="#1d1a16"/>
      <circle cx="24" cy="18" r="2" fill="#1d1a16"/>
      ${o.noDetail ? "" : `<ellipse cx="27" cy="23" rx="2" ry="1.2" fill="#ff8fb1"/>`}`
  }
};

// Letter pairs: (normal, odd). Later pairs look more alike.
const LETTERS = [
  ["E", "F"], ["M", "N"], ["8", "B"], ["6", "9"],
  ["O", "Q"], ["P", "R"], ["b", "d"], ["p", "q"], ["I", "l"]
];

const COLORS = ["#ff5a5f", "#ffb400", "#3fb950", "#2f81f7", "#a371f7", "#ff7eb6", "#14b8a6"];

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;

    h *= 60;
  }

  return [h, s * 100, l * 100];
}

function shiftHue(hex, degrees) {
  const [h, s, l] = hexToHsl(hex);
  return `hsl(${(h + degrees + 360) % 360} ${s}% ${l}%)`;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}


/* ==========================================
GAME
========================================== */

const TIME_LIMIT_MS = 20000;
const WRONG_PENALTY_MS = 1500;

function runOddOneOut({
  container,
  onComplete,
  level = 1
}) {
  /*
   * DIFFICULTY BY LEVEL
   *   first grid: 3x3 -> 4x4 (grows every 2 finds, up to 7x7)
   *   subtle: color shift 70deg -> 18deg, small rotations, mirrors...
   *   finds for a full score: 8 -> 10
   */
  const startSize = byLevelInt(level, 3, 4);
  const subtleBase = byLevel(level, 0, 0.6);
  const goal = byLevelInt(level, 8, 10);

  let active = true;
  let solved = 0;
  let wrong = 0;
  let penaltyMs = 0;
  let oddIndex = -1;
  let roundStartedAt = 0;
  let clockTimer = null;
  let finishTimer = null;

  const findTimes = [];
  const startedAt = performance.now();


  container.innerHTML = `
    <div class="odd-game">

      <div class="odd-hud">
        <div>
          <span>FOUND</span>
          <strong data-odd-found>0</strong>
        </div>

        <div>
          <span>TIME</span>
          <strong data-odd-time>${TIME_LIMIT_MS / 1000}</strong>
        </div>
      </div>

      <div class="odd-stage" data-odd-stage>
        <div class="odd-grid" data-odd-grid></div>
      </div>

      <div class="odd-message" data-odd-message>${t("odd.hint")}</div>

    </div>
  `;

  const stage = container.querySelector("[data-odd-stage]");
  const grid = container.querySelector("[data-odd-grid]");
  const foundEl = container.querySelector("[data-odd-found]");
  const timeEl = container.querySelector("[data-odd-time]");
  const messageEl = container.querySelector("[data-odd-message]");


  /* ---------- LAYOUT: square grid that fits ---------- */

  function fitGrid() {
    const size = Math.max(120, Math.min(stage.clientWidth, stage.clientHeight) - 8);

    grid.style.width = `${size}px`;
    grid.style.height = `${size}px`;

    // Letter size follows the cell size.
    const n = Number(grid.style.getPropertyValue("--n")) || startSize;
    grid.style.setProperty("--cell", `${size / n}px`);
  }

  window.addEventListener("resize", fitGrid);


  /* ---------- ROUND ---------- */

  function makeRound() {
    const n = Math.min(7, startSize + Math.floor(solved / 2));
    const total = n * n;

    // How subtle this round is (0 obvious ... 1 very subtle)
    const subtle = Math.min(1, subtleBase + solved * 0.06);

    oddIndex = Math.floor(Math.random() * total);

    const useLetters = Math.random() < 0.25;

    let normalHtml;
    let oddHtml;

    if (useLetters) {
      // Similar-looking letters get more likely when subtle.
      const from = Math.floor(subtle * (LETTERS.length - 3));
      const [a, b] = LETTERS[from + Math.floor(Math.random() * 3)];
      const color = pick(COLORS);

      normalHtml = `<span class="odd-letter" style="color:${color}">${a}</span>`;
      oddHtml = `<span class="odd-letter" style="color:${color}">${b}</span>`;
    } else {
      const name = pick(Object.keys(SHAPES));
      const shape = SHAPES[name];
      const color = pick(COLORS);

      const normal = { color, noDetail: false };
      const odd = { ...normal };

      let transform = "";

      const kinds = ["color", "detail", "size"];
      if (shape.asym) kinds.push("mirror", "rotate");

      const kind = pick(kinds);

      switch (kind) {
        case "color":
          // 70deg (obvious) -> 18deg (subtle)
          odd.color = shiftHue(color, (Math.random() < 0.5 ? -1 : 1) * (70 - subtle * 52));
          break;
        case "detail":
          odd.noDetail = true;
          break;
        case "size":
          transform = `scale(${0.82 + subtle * 0.08})`;
          break;
        case "mirror":
          transform = "scaleX(-1)";
          break;
        case "rotate":
          transform = `rotate(${subtle > 0.5 ? pick([-25, 25]) : pick([90, 180, -90])}deg)`;
          break;
      }

      const svg = (o, tf) => `
        <svg viewBox="0 0 40 40" aria-hidden="true" style="${tf ? `transform:${tf}` : ""}">
          ${shape.draw(o)}
        </svg>`;

      normalHtml = svg(normal, "");
      oddHtml = svg(odd, transform);
    }

    grid.style.setProperty("--n", n);
    fitGrid();
    grid.innerHTML = "";

    for (let i = 0; i < total; i++) {
      const cell = document.createElement("button");

      cell.type = "button";
      cell.className = "odd-cell";
      cell.innerHTML = i === oddIndex ? oddHtml : normalHtml;

      cell.addEventListener("pointerdown", event => {
        event.preventDefault();
        choose(i, cell);
      });

      grid.appendChild(cell);
    }

    roundStartedAt = performance.now();

    grid.classList.remove("odd-new");
    void grid.offsetWidth;
    grid.classList.add("odd-new");
  }

  function choose(index, cell) {
    if (!active) {
      return;
    }

    if (index === oddIndex) {
      solved++;
      findTimes.push(performance.now() - roundStartedAt);

      foundEl.textContent = String(solved);

      cell.classList.add("right");

      sfx(solved % 5 === 0 ? "perfect" : "pop");

      messageEl.textContent = t("odd.found");
      messageEl.className = "odd-message good";

      // Next round after a short flash
      active = false;

      setTimeout(() => {
        if (timeLeft() <= 0) {
          active = true;
          finish();
          return;
        }

        active = true;
        makeRound();
      }, 220);

      return;
    }

    wrong++;
    penaltyMs += WRONG_PENALTY_MS;

    cell.classList.remove("wrong");
    void cell.offsetWidth;
    cell.classList.add("wrong");

    sfx("bad");

    messageEl.textContent = t("odd.wrong");
    messageEl.className = "odd-message bad";

    updateClock();
  }


  /* ---------- CLOCK ---------- */

  function timeLeft() {
    return Math.max(0, TIME_LIMIT_MS - (performance.now() - startedAt) - penaltyMs);
  }

  function updateClock() {
    const left = timeLeft();

    timeEl.textContent = String(Math.ceil(left / 1000));
    timeEl.classList.toggle("danger", left <= 5000);

    if (left <= 0) {
      finish();
    }
  }

  clockTimer = setInterval(updateClock, 100);


  /* ---------- FINISH ---------- */

  let finished = false;

  function finish() {
    if (finished) {
      return;
    }

    finished = true;
    active = false;

    clearInterval(clockTimer);

    // Show where the odd one was
    grid.children[oddIndex]?.classList.add("reveal");

    const accuracy = solved + wrong > 0 ? solved / (solved + wrong) : 0;

    const score = clamp(
      Math.min(1, solved / goal) * 85 + accuracy * 15,
      0,
      100
    );

    const avgFind =
      findTimes.length
        ? findTimes.reduce((sum, v) => sum + v, 0) / findTimes.length
        : 0;

    messageEl.textContent = t("odd.timeUp", { n: solved });
    messageEl.className = "odd-message";

    finishTimer = setTimeout(() => {
      onComplete?.({
        score: Math.round(score),

        adapt: Math.round(clamp(35 + Math.min(1, solved / goal) * 45 + accuracy * 20, 0, 100)),

        meta: {
          success: solved >= Math.ceil(goal * 0.6),
          solved,
          goal,
          wrong,
          avgFind: Math.round(avgFind)
        }
      });
    }, 900);
  }


  /* ---------- START ---------- */

  requestAnimationFrame(() => {
    if (finished) return;

    makeRound();
  });


  return () => {
    finished = true;
    active = false;

    clearInterval(clockTimer);
    clearTimeout(finishTimer);

    window.removeEventListener("resize", fitGrid);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
