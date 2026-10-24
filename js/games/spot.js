// GAMIQ（ゲーミック） v2 - Spot the Difference
//
// SPOT IT!
// - A new picture is made at random every game (no fixed images).
// - The second picture has some differences:
//   color / missing object / size / flipped / small detail color.
// - Tap a difference (on either picture): it gets a circle on both.
// - A wrong tap shows a red X and costs 2 seconds.
// - Level: more differences, busier pictures, subtler changes.

import { t } from "../i18n.js";
import { byLevel, byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createSpotGames() {
  return [
    {
      id: "spot_difference",
      type: "spot_difference",
      title: "SPOT IT!",
      rule: "FIND ALL THE DIFFERENCES BEFORE TIME RUNS OUT!",
      skill: "SPEED",
      theme: "picture",
      duration: 35000
    }
  ];
}

export function runSpotGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "spot_difference") {
    return runSpotDifference({
      container,
      onComplete,
      level: game.level
    });
  }

  return () => {};
}


/* ==========================================
PICTURE PARTS
(all drawn inside a 100 x 75 box)
========================================== */

const VIEW_W = 100;
const VIEW_H = 75;

// Main colors: clearly different from each other
const COLORS = [
  "#ff5a5f", "#ffb400", "#3fb950", "#2f81f7",
  "#a371f7", "#ff7eb6", "#f0883e", "#14b8a6"
];

// Subtle pairs (for higher levels): looks almost the same
const SUBTLE = {
  "#ff5a5f": "#ff8a65",
  "#ffb400": "#ffd54a",
  "#3fb950": "#7bd389",
  "#2f81f7": "#5aa9ff",
  "#a371f7": "#c09bff",
  "#ff7eb6": "#ffa8cf",
  "#f0883e": "#f7b267",
  "#14b8a6": "#5fd6c9"
};

// Where each kind of thing can be placed
const TYPES = {
  cloud:    { zone: "sky",    size: [10, 14],  flip: false },
  balloon:  { zone: "sky",    size: [6.5, 8.5], flip: false },
  bird:     { zone: "sky",    size: [6, 8],    flip: true },
  star:     { zone: "sky",    size: [5, 7],    flip: false },
  house:    { zone: "ground", size: [13, 17],  flip: true },
  tree:     { zone: "ground", size: [11, 15],  flip: false },
  flower:   { zone: "ground", size: [6, 8],    flip: false },
  car:      { zone: "ground", size: [12, 15],  flip: true },
  mushroom: { zone: "ground", size: [6.5, 8.5], flip: true }
};

function drawThing(o) {
  const { x, y, s, color, color2 } = o;
  const k = s / 10; // parts are designed for size 10

  const flip = o.flip ? -1 : 1;

  const g = inner =>
    `<g transform="translate(${x} ${y}) scale(${k * flip} ${k})">${inner}</g>`;

  switch (o.type) {
    case "cloud":
      return g(`
        <circle cx="-3" cy="0" r="3.2" fill="${color}"/>
        <circle cx="1" cy="-1.5" r="4" fill="${color}"/>
        <circle cx="4.5" cy="0.5" r="2.8" fill="${color}"/>
        <rect x="-5.5" y="0" width="12" height="2.8" rx="1.4" fill="${color}"/>`);

    case "balloon":
      return g(`
        <path d="M0 4 Q-1 7 1 10" stroke="#e6e6e6" stroke-width=".5" fill="none"/>
        <ellipse cx="0" cy="-1" rx="4" ry="5" fill="${color}"/>
        <ellipse cx="-1.4" cy="-2.6" rx="1" ry="1.6" fill="${color2}" opacity=".9"/>`);

    case "bird":
      return g(`
        <path d="M-5 0 Q-2.5 -3 0 0 Q2.5 -3 5 0" stroke="${color}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
        <circle cx="5" cy="-0.6" r=".9" fill="${color2}"/>`);

    case "star":
      return g(`
        <polygon points="0,-5 1.5,-1.6 5,-1.5 2.2,0.8 3.1,4.5 0,2.4 -3.1,4.5 -2.2,0.8 -5,-1.5 -1.5,-1.6" fill="${color}"/>`);

    case "house":
      return g(`
        <rect x="-5" y="-3" width="10" height="8" fill="${color}"/>
        <polygon points="-6.5,-3 0,-8.5 6.5,-3" fill="${color2}"/>
        <rect x="-3.6" y="0.2" width="2.4" height="4.8" fill="#5b3a1e"/>
        <rect x="0.8" y="-1.4" width="3" height="2.6" fill="#cfe8ff" stroke="#ffffff" stroke-width=".4"/>`);

    case "tree":
      return g(`
        <rect x="-1" y="1" width="2" height="5" fill="#7a4b22"/>
        <circle cx="0" cy="-2" r="4.6" fill="${color}"/>
        <circle cx="1.6" cy="-3.2" r="1" fill="${color2}"/>
        <circle cx="-1.8" cy="-1" r=".9" fill="${color2}"/>`);

    case "flower":
      return g(`
        <rect x="-0.35" y="0" width=".7" height="5" fill="#2f8f3f"/>
        <circle cx="0" cy="-2.6" r="1.6" fill="${color}"/>
        <circle cx="2.4" cy="-0.8" r="1.6" fill="${color}"/>
        <circle cx="-2.4" cy="-0.8" r="1.6" fill="${color}"/>
        <circle cx="1.5" cy="1.6" r="1.6" fill="${color}"/>
        <circle cx="-1.5" cy="1.6" r="1.6" fill="${color}"/>
        <circle cx="0" cy="0" r="1.2" fill="${color2}"/>`);

    case "car":
      return g(`
        <rect x="-5" y="-1.5" width="10" height="3.5" rx="1.2" fill="${color}"/>
        <path d="M-3 -1.5 L-1.8 -4 L2.2 -4 L3.4 -1.5 Z" fill="${color}"/>
        <path d="M-1.4 -3.5 L-0.6 -1.8 L1.6 -1.8 L1.9 -3.5 Z" fill="#cfe8ff"/>
        <circle cx="4.6" cy="0" r=".6" fill="${color2}"/>
        <circle cx="-2.8" cy="2.2" r="1.4" fill="#222"/>
        <circle cx="2.8" cy="2.2" r="1.4" fill="#222"/>`);

    case "mushroom":
      return g(`
        <rect x="-1.2" y="0" width="2.4" height="4" rx="1" fill="#f3e3c3"/>
        <path d="M-5 0.5 Q-4 -5 0 -5 Q4 -5 5 0.5 Z" fill="${color}"/>
        <circle cx="-2" cy="-2" r=".9" fill="${color2}"/>
        <circle cx="1.6" cy="-3" r=".8" fill="${color2}"/>
        <circle cx="2.6" cy="-0.8" r=".6" fill="${color2}"/>`);

    default:
      return "";
  }
}

function drawScene(things, sky) {
  return `
    <svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <clipPath id="clip-${sky.id}">
          <rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" rx="3"/>
        </clipPath>
        <linearGradient id="sky-${sky.id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${sky.top}"/>
          <stop offset="1" stop-color="${sky.bottom}"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#clip-${sky.id})">
      <rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="url(#sky-${sky.id})"/>
      <ellipse cx="80" cy="12" rx="6" ry="6" fill="#fff4c2" opacity=".9"/>
      <path d="M0 44 Q25 38 50 43 T100 41 L100 75 L0 75 Z" fill="#5fae5a"/>
      <path d="M0 52 Q30 47 60 52 T100 50 L100 75 L0 75 Z" fill="#4c9a4a"/>
      ${things.filter(o => !o.hidden).map(drawThing).join("")}
      </g>
      <g data-marks></g>
    </svg>
  `;
}


/* ==========================================
SCENE + DIFFERENCES
========================================== */

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function makeScene(count) {
  const things = [];
  const typeNames = Object.keys(TYPES);

  let guard = 0;

  while (things.length < count && guard < 600) {
    guard++;

    const type = pick(typeNames);
    const info = TYPES[type];
    const s = rand(info.size[0], info.size[1]);

    const x = rand(6 + s / 2, VIEW_W - 6 - s / 2);

    const y =
      info.zone === "sky"
        ? rand(5 + s / 2, 32)
        : rand(46, VIEW_H - 2 - s / 2);

    // Keep things apart so every difference is easy to point at.
    const tooClose = things.some(other =>
      Math.hypot(other.x - x, other.y - y) < (other.s + s) * 0.55
    );

    if (tooClose) {
      continue;
    }

    const color =
      type === "cloud"
        ? "#ffffff"
        : pick(COLORS);

    let color2 = pick(COLORS);

    while (color2 === color) {
      color2 = pick(COLORS);
    }

    things.push({
      id: things.length,
      type,
      x,
      y,
      s,
      color,
      color2,
      flip: info.flip && Math.random() < 0.5
    });
  }

  // Ground things far away (higher on screen) are drawn first.
  return things.sort((a, b) => a.y - b.y);
}

/**
 * Make the second picture and the list of differences.
 * subtle: 0 (obvious) ... 1 (subtle)
 */
function makeDifferences(things, count, subtle) {
  const copy = things.map(o => ({ ...o }));

  const candidates = [...copy].sort(() => Math.random() - 0.5);
  const diffs = [];

  for (const o of candidates) {
    if (diffs.length >= count) {
      break;
    }

    const kinds = ["color", "remove", "size"];

    if (TYPES[o.type].flip) kinds.push("flip");
    // "detail" only where the detail is big enough to see
    const hasDetail = ["house", "tree", "flower", "mushroom", "balloon"].includes(o.type);

    if (hasDetail) kinds.push("detail");

    // Higher levels use the sneaky kinds more often.
    if (Math.random() < subtle) {
      if (hasDetail) kinds.push("detail");
      if (TYPES[o.type].flip) kinds.push("flip");
    }

    let kind = pick(kinds);

    if (kind === "flip" && !TYPES[o.type].flip) kind = "color";
    if (kind === "color" && o.type === "cloud") kind = "remove";

    switch (kind) {
      case "color":
        o.color =
          Math.random() < subtle && SUBTLE[o.color]
            ? SUBTLE[o.color]
            : pick(COLORS.filter(c => c !== o.color));
        break;

      case "detail":
        o.color2 = pick(COLORS.filter(c => c !== o.color2 && c !== o.color));
        break;

      case "remove":
        o.hidden = true;
        break;

      case "size":
        o.s = o.s * (Math.random() < 0.5 ? 0.62 : 1.38) * (subtle > 0.6 ? 0.9 : 1);
        break;

      case "flip":
        o.flip = !o.flip;
        break;
    }

    diffs.push({
      x: o.x,
      y: o.y,
      r: Math.max(5.5, o.s * 0.75),
      kind,
      found: false
    });
  }

  return { copy, diffs };
}


/* ==========================================
GAME
========================================== */

function runSpotDifference({
  container,
  onComplete,
  level = 1
}) {
  /*
   * DIFFICULTY BY LEVEL
   *   differences: 3 -> 6
   *   things in the picture: 10 -> 16
   *   subtle changes: rare -> common
   *   time: 30s (+3s per extra difference)
   */
  const diffCount = Math.min(7, byLevelInt(level, 3, 6));
  const thingCount = Math.min(18, byLevelInt(level, 10, 16));
  const subtle = byLevel(level, 0.1, 0.75);
  const timeLimit = Math.round(byLevel(level, 30000, 32000) + (diffCount - 3) * 2500);

  const WRONG_PENALTY_MS = 2000;

  const things = makeScene(thingCount);
  const { copy, diffs } = makeDifferences(things, diffCount, subtle);

  const sky = pick([
    { top: "#7cc8ff", bottom: "#cfeeff" },
    { top: "#ffb38a", bottom: "#ffe2b8" },
    { top: "#8a9bff", bottom: "#d6dcff" }
  ]);

  let active = true;
  let found = 0;
  let wrong = 0;
  let penaltyMs = 0;
  let clockTimer = null;
  let finishTimer = null;

  const startedAt = performance.now();

  container.innerHTML = `
    <div class="spot-game">

      <div class="spot-hud">
        <div>
          <span>FOUND</span>
          <strong data-spot-found>0 / ${diffCount}</strong>
        </div>

        <div>
          <span>TIME</span>
          <strong data-spot-time>${Math.ceil(timeLimit / 1000)}</strong>
        </div>
      </div>

      <div class="spot-pictures" data-spot-pictures>
        <div class="spot-picture" data-spot-picture="a">
          ${drawScene(things, { ...sky, id: "a" })}
        </div>

        <div class="spot-picture" data-spot-picture="b">
          ${drawScene(copy, { ...sky, id: "b" })}
        </div>
      </div>

      <div class="spot-message" data-spot-message>
        ${t("spot.hint", { n: diffCount })}
      </div>

    </div>
  `;

  const picturesEl = container.querySelector("[data-spot-pictures]");
  const pictures = [...container.querySelectorAll("[data-spot-picture]")];
  const foundEl = container.querySelector("[data-spot-found]");
  const timeEl = container.querySelector("[data-spot-time]");
  const messageEl = container.querySelector("[data-spot-message]");


  /* ---------- LAYOUT: side by side or stacked ---------- */

  function layout() {
    const rect = picturesEl.getBoundingClientRect();

    // Wide area -> side by side, tall area (phone) -> top and bottom
    const sideBySide = rect.width / Math.max(1, rect.height) > 1.25;

    picturesEl.classList.toggle("side", sideBySide);
    picturesEl.classList.toggle("stacked", !sideBySide);
  }

  layout();

  window.addEventListener("resize", layout);


  /* ---------- MARKS ---------- */

  const NS = "http://www.w3.org/2000/svg";

  function addMark(svg, x, y, r, className) {
    const marks = svg.querySelector("[data-marks]");

    if (className === "wrong") {
      const group = document.createElementNS(NS, "g");

      group.setAttribute("class", "spot-wrong");
      group.innerHTML = `
        <path d="M${x - 3} ${y - 3} L${x + 3} ${y + 3} M${x + 3} ${y - 3} L${x - 3} ${y + 3}"
              stroke="#ff3b5c" stroke-width="1.6" stroke-linecap="round"/>`;

      marks.appendChild(group);

      setTimeout(() => group.remove(), 600);
      return;
    }

    const circle = document.createElementNS(NS, "circle");

    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", r);
    circle.setAttribute("class", "spot-circle");

    marks.appendChild(circle);
  }


  /* ---------- TAP ---------- */

  function onTap(event) {
    if (!active) {
      return;
    }

    const picture = event.currentTarget;
    const svg = picture.querySelector("svg");
    const box = svg.getBoundingClientRect();

    // The picture keeps its 4:3 shape inside the box ("meet").
    const scale = Math.min(box.width / VIEW_W, box.height / VIEW_H);
    const offsetX = (box.width - VIEW_W * scale) / 2;
    const offsetY = (box.height - VIEW_H * scale) / 2;

    const x = (event.clientX - box.left - offsetX) / scale;
    const y = (event.clientY - box.top - offsetY) / scale;

    if (x < 0 || y < 0 || x > VIEW_W || y > VIEW_H) {
      return;
    }

    const hit = diffs.find(d =>
      !d.found && Math.hypot(d.x - x, d.y - y) <= d.r + 1.5
    );

    // Tapped one that was already found: ignore.
    const already = diffs.find(d =>
      d.found && Math.hypot(d.x - x, d.y - y) <= d.r + 1.5
    );

    if (hit) {
      hit.found = true;
      found++;

      pictures.forEach(p => addMark(p.querySelector("svg"), hit.x, hit.y, hit.r, "found"));

      foundEl.textContent = `${found} / ${diffCount}`;

      sfx(found === diffCount ? "perfect" : "pop");

      if (found === diffCount) {
        finish(true);
      }

      return;
    }

    if (already) {
      return;
    }

    // Wrong place
    wrong++;
    penaltyMs += WRONG_PENALTY_MS;

    addMark(svg, x, y, 0, "wrong");

    sfx("bad");

    messageEl.textContent = t("spot.wrong");
    messageEl.classList.remove("bad");
    void messageEl.offsetWidth;
    messageEl.classList.add("bad");

    updateClock();
  }

  pictures.forEach(p => p.addEventListener("pointerdown", onTap));


  /* ---------- CLOCK ---------- */

  function timeLeft() {
    return Math.max(
      0,
      timeLimit - (performance.now() - startedAt) - penaltyMs
    );
  }

  function updateClock() {
    const left = timeLeft();

    timeEl.textContent = String(Math.ceil(left / 1000));
    timeEl.classList.toggle("danger", left <= 5000);

    if (left <= 0) {
      finish(false);
    }
  }

  clockTimer = setInterval(updateClock, 100);


  /* ---------- FINISH ---------- */

  function finish(allFound) {
    if (!active) {
      return;
    }

    active = false;

    clearInterval(clockTimer);

    // Show the ones you missed (dashed circles)
    diffs.filter(d => !d.found).forEach(d => {
      pictures.forEach(p => {
        const svg = p.querySelector("svg");
        addMark(svg, d.x, d.y, d.r, "found");
        svg.querySelector("[data-marks]").lastChild?.classList.add("missed");
      });
    });

    const left = timeLeft();

    const foundRate = found / diffCount;

    const score = clamp(
      foundRate * 80 +
      (allFound ? (left / timeLimit) * 20 : 0) -
      wrong * 4,
      0,
      100
    );

    messageEl.textContent = allFound ? t("spot.clear") : t("spot.timeUp");
    messageEl.classList.toggle("bad", !allFound);

    finishTimer = setTimeout(() => {
      onComplete?.({
        score: Math.round(score),

        adapt: Math.round(
          clamp(35 + foundRate * 50 + (allFound ? 15 : 0) - wrong * 3, 0, 100)
        ),

        meta: {
          success: allFound,
          found,
          differences: diffCount,
          wrong,
          secondsLeft: Math.round(left / 1000)
        }
      });
    }, allFound ? 700 : 1400);
  }


  return () => {
    active = false;

    clearInterval(clockTimer);
    clearTimeout(finishTimer);

    window.removeEventListener("resize", layout);

    pictures.forEach(p => p.removeEventListener("pointerdown", onTap));
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
