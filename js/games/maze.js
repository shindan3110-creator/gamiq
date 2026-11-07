// GAMIQ（ゲーミック） v2 - Maze Dash
//
// MAZE DASH (LOGIC)
// - A small maze. Trace the path from the start to the goal with your finger.
//   (PC: drag with the mouse, or use the arrow keys / WASD)
// - Reach the goal → the next maze appears. 30 seconds.
// - You can only move along open paths, one step after another:
//   tapping far away does not jump.
// - Higher level: bigger mazes. Hell levels: you can only see around you.

import { t } from "../i18n.js";
import { byLevel, byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createMazeGames() {
  return [
    {
      id: "logic_maze_dash",
      type: "maze_dash",
      title: "MAZE DASH",
      rule: "TRACE THE PATH TO THE GOAL! AS MANY MAZES AS YOU CAN!",
      skill: "LOGIC",
      theme: "maze",
      duration: 30000
    }
  ];
}

export function runMazeGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "maze_dash") {
    return runMazeDash({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
MAZE
========================================== */

const GOAL = 3;            // mazes for a full score
const TIME_MS = 30000;
const MAX_STEP_PATH = 3;   // a drag can move at most 3 cells at once

// Walls: each cell has 4 walls [top, right, bottom, left]
function makeMaze(cols, rows) {
  const walls = Array.from({ length: cols * rows }, () => [true, true, true, true]);
  const seen = new Array(cols * rows).fill(false);
  const stack = [0];
  seen[0] = true;

  const dirs = [
    [0, -1, 0, 2],
    [1, 0, 1, 3],
    [0, 1, 2, 0],
    [-1, 0, 3, 1]
  ];

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cx = cur % cols;
    const cy = Math.floor(cur / cols);

    const options = dirs.filter(([dx, dy]) => {
      const nx = cx + dx;
      const ny = cy + dy;
      return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny * cols + nx];
    });

    if (!options.length) {
      stack.pop();
      continue;
    }

    const [dx, dy, w, back] = options[Math.floor(Math.random() * options.length)];
    const next = (cy + dy) * cols + (cx + dx);

    walls[cur][w] = false;
    walls[next][back] = false;
    seen[next] = true;
    stack.push(next);
  }

  return walls;
}

function runMazeDash({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   maze size: 5x6 (Lv1) -> 8x10 (old Lv10), up to 9x11
   *   fog (only see near you): from Lv7
   */
  const cols = Math.min(9, byLevelInt(level, 5, 8));
  const rows = Math.min(11, byLevelInt(level, 6, 10));
  const fog = level >= 7;
  const fogCells = Math.max(1.6, byLevel(level, 3.2, 2.4));

  let finished = false;
  let solved = 0;
  let steps = 0;
  let walls = [];
  let player = 0;
  let goal = 0;
  let startDist = 1;
  let trail = [];
  let dragging = false;
  let flash = 0;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let cell = 10;
  let ox = 0;
  let oy = 0;

  let frameId = null;
  let timers = [];
  const startedAt = performance.now();

  container.innerHTML = `
    <div class="be-game mz-game">
      <div class="be-hud">
        <div>
          <span>MAZE</span>
          <strong data-mz-count>0 / ${GOAL}</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-mz-time>${TIME_MS / 1000}</strong>
        </div>
        <div>
          <span>STEPS</span>
          <strong data-mz-steps>0</strong>
        </div>
      </div>

      <div class="mz-stage" data-mz-stage>
        <canvas class="mz-canvas" data-mz-canvas></canvas>
        <div class="be-message mz-message" data-mz-message></div>
        <div class="mz-hint" data-mz-hint>${t("maze.hint")}</div>
      </div>
    </div>
  `;

  const stage = container.querySelector("[data-mz-stage]");
  const canvas = container.querySelector("[data-mz-canvas]");
  const g = canvas.getContext("2d");
  const countEl = container.querySelector("[data-mz-count]");
  const timeEl = container.querySelector("[data-mz-time]");
  const stepsEl = container.querySelector("[data-mz-steps]");
  const messageEl = container.querySelector("[data-mz-message]");
  const hintEl = container.querySelector("[data-mz-hint]");

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);
    timers.push(id);
  }


  /* ---------- SIZE ---------- */

  function resize() {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const pad = 14;
    cell = Math.floor(Math.min((width - pad * 2) / cols, (height - pad * 2) / rows));
    ox = Math.round((width - cell * cols) / 2);
    oy = Math.round((height - cell * rows) / 2);
  }

  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(stage);
  resize();


  /* ---------- MAZE LOGIC ---------- */

  function neighbors(i) {
    const x = i % cols;
    const y = Math.floor(i / cols);
    const w = walls[i];
    const out = [];
    if (!w[0]) out.push(i - cols);
    if (!w[1]) out.push(i + 1);
    if (!w[2]) out.push(i + cols);
    if (!w[3]) out.push(i - 1);
    return out.filter(n => n >= 0 && n < cols * rows && (n % cols === x || Math.floor(n / cols) === y));
  }

  // Shortest path from a to b (list of cells after a), or null
  function path(a, b, limit = Infinity) {
    if (a === b) return [];
    const prev = new Map([[a, -1]]);
    const queue = [a];
    while (queue.length) {
      const cur = queue.shift();
      for (const n of neighbors(cur)) {
        if (prev.has(n)) continue;
        prev.set(n, cur);
        if (n === b) {
          const out = [n];
          let p = cur;
          while (p !== a) {
            out.unshift(p);
            p = prev.get(p);
          }
          return out.length <= limit ? out : null;
        }
        queue.push(n);
      }
    }
    return null;
  }

  function newMaze() {
    walls = makeMaze(cols, rows);

    // Start at a random corner, goal at the opposite corner
    const corners = [0, cols - 1, (rows - 1) * cols, rows * cols - 1];
    const k = Math.floor(Math.random() * 4);
    player = corners[k];
    goal = corners[3 - k];
    startDist = Math.max(1, path(player, goal).length);
    trail = [player];
    flash = 1;

    // For automatic tests only (not used by the game)
    stage.__mz = { cols, rows, get walls() { return walls; }, get player() { return player; }, get goal() { return goal; } };
  }

  function moveAlong(cells) {
    for (const c of cells) {
      player = c;
      steps++;

      // walking back over your own trail shortens it
      const idx = trail.indexOf(c);
      if (idx >= 0) trail = trail.slice(0, idx + 1);
      else trail.push(c);

      if (player === goal) {
        reachGoal();
        return;
      }
    }
    sfx("tick");
    updateHud();
  }

  function reachGoal() {
    solved++;
    sfx("good");
    showMessage(solved >= GOAL ? "GREAT!" : "GOAL!", "great");
    updateHud();
    dragging = false;
    newMaze();
  }


  /* ---------- INPUT ---------- */

  function cellAt(event) {
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left - ox;
    const y = event.clientY - rect.top - oy;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return -1;
    return cy * cols + cx;
  }

  function tryMoveTo(target) {
    if (target < 0 || target === player) return;
    const route = path(player, target, MAX_STEP_PATH);
    if (route) moveAlong(route);
  }

  function onDown(event) {
    if (finished) return;
    event.preventDefault();
    hintEl.classList.add("hide");
    dragging = true;
    stage.setPointerCapture?.(event.pointerId);
    tryMoveTo(cellAt(event));
  }

  function onMove(event) {
    if (finished || !dragging) return;
    event.preventDefault();
    tryMoveTo(cellAt(event));
  }

  function onUp() {
    dragging = false;
  }

  function onKey(event) {
    if (finished) return;
    const map = {
      ArrowUp: 0, KeyW: 0,
      ArrowRight: 1, KeyD: 1,
      ArrowDown: 2, KeyS: 2,
      ArrowLeft: 3, KeyA: 3
    };
    const d = map[event.code];
    if (d === undefined) return;
    event.preventDefault();
    hintEl.classList.add("hide");
    if (walls[player][d]) {
      sfx("bonk");
      return;
    }
    const delta = [-cols, 1, cols, -1][d];
    moveAlong([player + delta]);
  }


  /* ---------- DRAW ---------- */

  function draw(now) {
    if (finished) return;

    const left = Math.max(0, TIME_MS - (now - startedAt));
    timeEl.textContent = Math.ceil(left / 1000);

    if (left <= 0) {
      finish();
      return;
    }

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);

    // floor
    g.fillStyle = "#0d1622";
    g.fillRect(ox, oy, cell * cols, cell * rows);

    // trail
    if (trail.length > 1) {
      g.strokeStyle = "rgba(95,239,255,.35)";
      g.lineWidth = Math.max(4, cell * 0.28);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      trail.forEach((c, i) => {
        const [x, y] = center(c);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();
    }

    // goal
    const [gx, gy] = center(goal);
    const pulse = 0.85 + 0.15 * Math.sin(now / 160);
    g.fillStyle = "#ffd76a";
    starShape(gx, gy, cell * 0.34 * pulse);

    // walls
    g.strokeStyle = "#5fefff";
    g.lineWidth = Math.max(2, cell * 0.09);
    g.lineCap = "round";
    g.shadowColor = "rgba(95,239,255,.6)";
    g.shadowBlur = 6;
    g.beginPath();
    for (let i = 0; i < cols * rows; i++) {
      const x = ox + (i % cols) * cell;
      const y = oy + Math.floor(i / cols) * cell;
      const w = walls[i];
      if (w[0]) { g.moveTo(x, y); g.lineTo(x + cell, y); }
      if (w[3]) { g.moveTo(x, y); g.lineTo(x, y + cell); }
      if (i % cols === cols - 1 && w[1]) { g.moveTo(x + cell, y); g.lineTo(x + cell, y + cell); }
      if (Math.floor(i / cols) === rows - 1 && w[2]) { g.moveTo(x, y + cell); g.lineTo(x + cell, y + cell); }
    }
    g.stroke();
    g.shadowBlur = 0;

    // player
    const [px, py] = center(player);
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(px, py, cell * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ff4d8d";
    g.beginPath();
    g.arc(px, py, cell * 0.18, 0, Math.PI * 2);
    g.fill();

    // fog (hell levels): only see around you
    if (fog) {
      const r = cell * fogCells;
      const grad = g.createRadialGradient(px, py, r * 0.55, px, py, r);
      grad.addColorStop(0, "rgba(5,8,12,0)");
      grad.addColorStop(1, "rgba(5,8,12,.97)");
      g.fillStyle = grad;
      g.fillRect(0, 0, width, height);
      // keep the goal visible as a faint glow
      g.fillStyle = "rgba(255,215,106,.55)";
      starShape(gx, gy, cell * 0.22);
    }

    // new maze flash
    if (flash > 0) {
      g.fillStyle = `rgba(255,255,255,${flash * 0.25})`;
      g.fillRect(ox, oy, cell * cols, cell * rows);
      flash = Math.max(0, flash - 0.08);
    }

    frameId = requestAnimationFrame(draw);
  }

  function center(c) {
    return [
      ox + (c % cols) * cell + cell / 2,
      oy + Math.floor(c / cols) * cell + cell / 2
    ];
  }

  function starShape(x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }


  /* ---------- HUD ---------- */

  let messageTimer = null;

  function updateHud() {
    countEl.textContent = `${solved} / ${GOAL}`;
    stepsEl.textContent = String(steps);
  }

  function showMessage(text, type) {
    clearTimeout(messageTimer);
    messageEl.textContent = text;
    messageEl.className = `be-message mz-message show ${type || ""}`;
    messageTimer = setTimeout(() => {
      messageEl.className = "be-message mz-message";
    }, 700);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;
    finished = true;

    cancelAnimationFrame(frameId);

    // How far you got in the maze you were on (0..1)
    const left = path(player, goal);
    const partial = left ? Math.max(0, 1 - left.length / startDist) : 0;
    const progress = Math.min(GOAL, solved + (solved < GOAL ? partial : 0));

    // Extra mazes beyond the goal give a small bonus
    const extra = Math.max(0, solved - GOAL);
    const score = clamp((progress / GOAL) * 90 + extra * 5, 0, 100);
    const success = solved >= 2;

    showMessage(success ? "CLEAR!" : "TIME UP", success ? "perfect" : "bad");
    sfx(success ? "clear" : "fail");

    later(() => {}, 0);

    setTimeout(() => {
      onComplete?.({
        score: Math.round(score),
        adapt: Math.round(clamp(30 + (progress / GOAL) * 70, 0, 100)),
        meta: {
          success,
          solved,
          steps,
          size: `${cols}x${rows}`,
          elapsed: Math.round(performance.now() - startedAt)
        }
      });
    }, 600);
  }


  /* ---------- START ---------- */

  newMaze();
  updateHud();

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("keydown", onKey);

  frameId = requestAnimationFrame(draw);

  return () => {
    finished = true;
    cancelAnimationFrame(frameId);
    timers.forEach(clearTimeout);
    clearTimeout(messageTimer);
    observer?.disconnect();
    stage.removeEventListener("pointerdown", onDown);
    stage.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("keydown", onKey);
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
