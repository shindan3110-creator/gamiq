// GAMIQ（ゲーミック） v2 - Puzzle Games

import { t } from "../i18n.js";
import { byLevel, byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createPuzzleGames() {
  return [
    {
      id: "puzzle_block_escape",
      type: "block_escape",
      title: "BLOCK ESCAPE",
      rule: "SLIDE THE BLOCKS. GET THE RED ONE OUT!",
      skill: "LOGIC",
      theme: "factory",
      duration: 12000
    },
    {
      id: "puzzle_pipe_connect",
      type: "pipe_connect",
      title: "PIPE CONNECT",
      rule: "ROTATE THE PIPES TO CONNECT THEM!",
      skill: "LOGIC",
      theme: "factory",
      duration: 10000
    }

    // LASER MIRROR is paused (not in the random pool) until it is rebuilt.
    // Its game code (runLaserMirror) is kept below.
  ];
}

export function runPuzzleGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "block_escape") {
    return runBlockEscape({
      game,
      container,
      onComplete
    });
  }

  if (game.type === "pipe_connect") {
    return runPipeConnect({
      game,
      container,
      onComplete
    });
  }

  if (game.type === "laser_mirror") {
    return runLaserMirror({
      game,
      container,
      onComplete
    });
  }

  return () => {};
}

/* ==========================================
BLOCK ESCAPE
========================================== */

function runBlockEscape({ game, container, onComplete }) {
  const size = 6;

  // A new random board every time (always solvable).
  // Higher levels need more moves to solve.
  const boardData = createRandomEscapeBoard(game?.level ?? 1);

  // Bigger puzzles get more time (45s - 80s).
  const BLOCK_TIME_LIMIT = Math.round(
    clamp(20000 + boardData.idealMoves * 2200, 45000, 80000)
  );

  // PC: click a block and then click arrows.
  // Mobile: swipe blocks directly.
  const desktopControls = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  ).matches;

  let active = true;
  let moves = 0;
  let selectedId = null;
  let clockTimer = null;

  const startedAt = performance.now();

  const targetBlock =
    boardData.blocks.find(block => block.target);

  const targetStartX = targetBlock.x;

  container.innerHTML = `
    <div class="puzzle-wrap block-escape-game">
      <div class="puzzle-top">
        <span>MOVES</span>
        <strong data-puzzle-moves>0</strong>
        <span class="puzzle-top-gap">TIME</span>
        <strong data-puzzle-time>${BLOCK_TIME_LIMIT / 1000}</strong>
      </div>

      <div
        class="block-board"
        data-block-board
        aria-label="BLOCK ESCAPE puzzle"
      ></div>

      <div class="puzzle-message" data-puzzle-hint></div>
    </div>
  `;

  const board =
    container.querySelector("[data-block-board]");

  const movesDisplay =
    container.querySelector("[data-puzzle-moves]");

  const hint =
    container.querySelector("[data-puzzle-hint]");

  hint.textContent = desktopControls
    ? t("block.hintClick")
    : t("block.hintSwipe");

  function directionsFor(block) {
    return block.w > block.h
      ? [
          {
            dx: -1,
            dy: 0,
            text: "◀",
            side: "left",
            label: t("block.moveLeft")
          },
          {
            dx: 1,
            dy: 0,
            text: "▶",
            side: "right",
            label: t("block.moveRight")
          }
        ]
      : [
          {
            dx: 0,
            dy: -1,
            text: "▲",
            side: "up",
            label: t("block.moveUp")
          },
          {
            dx: 0,
            dy: 1,
            text: "▼",
            side: "down",
            label: t("block.moveDown")
          }
        ];
  }

  function renderBlocks() {
    board.innerHTML = "";
    board.style.setProperty("--grid-size", size);
    board.style.setProperty("--exit-row", boardData.exitRow);

    for (const block of boardData.blocks) {
      const element = document.createElement("button");

      element.type = "button";
      element.className = "puzzle-block";

      // Wood grain runs along the long side of the block.
      element.classList.add(
        block.w > block.h ? "wood-h" : "wood-v"
      );
      element.dataset.id = block.id;

      element.style.gridColumn =
        `${block.x + 1} / span ${block.w}`;

      element.style.gridRow =
        `${block.y + 1} / span ${block.h}`;

      element.textContent = block.target ? "EXIT" : "";

      element.setAttribute(
        "aria-label",
        block.target
          ? t("block.targetLabel")
          : t("block.blockLabel", { id: block.id })
      );

      if (block.target) {
        element.classList.add("target");
      }

      // PC: a clicked block can also be moved with the arrow keys
      const selected = desktopControls && selectedId === block.id;
      element.classList.toggle("selected", selected);

      // Phone and PC: drag the block, it slides as far as you pull it
      attachDrag(element, block);

      board.appendChild(element);
    }
  }

  function renderDirections(block) {
    for (const direction of directionsFor(block)) {
      const nextX = block.x + direction.dx;
      const nextY = block.y + direction.dy;

      if (!canMove(block, nextX, nextY)) {
        continue;
      }

      const arrow = document.createElement("button");

      arrow.type = "button";
      arrow.className =
        `puzzle-direction ${direction.side}`;

      arrow.textContent = direction.text;

      arrow.setAttribute(
        "aria-label",
        direction.label
      );

      arrow.style.gridColumn =
        `${block.x + 1} / span ${block.w}`;

      arrow.style.gridRow =
        `${block.y + 1} / span ${block.h}`;

      arrow.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        moveBlock(
          block,
          direction.dx,
          direction.dy
        );
      });

      board.appendChild(arrow);
    }
  }

  /* ==========================================
  DRAG (phone and PC)
  The block follows your finger / mouse and slides
  several squares at once. Letting go snaps it to the grid.
  ========================================== */

  function cellPitch() {
    const style = getComputedStyle(board);
    const pad = parseFloat(style.paddingLeft) || 0;
    const gap = parseFloat(style.columnGap) || 0;
    return (board.clientWidth - pad * 2 + gap) / size;
  }

  // How many squares the block can slide each way
  function freeRange(block) {
    const horizontal = block.w > block.h;
    let back = 0;
    let forward = 0;

    while (canMove(block, block.x - (horizontal ? back + 1 : 0), block.y - (horizontal ? 0 : back + 1))) back++;
    while (canMove(block, block.x + (horizontal ? forward + 1 : 0), block.y + (horizontal ? 0 : forward + 1))) forward++;

    return { back, forward };
  }

  function attachDrag(element, block) {
    let drag = null;

    element.addEventListener("pointerdown", event => {
      if (!active) return;

      event.preventDefault();
      element.setPointerCapture?.(event.pointerId);

      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        pitch: cellPitch(),
        range: freeRange(block),
        horizontal: block.w > block.h,
        offset: 0
      };

      element.classList.add("dragging");
    });

    element.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId) return;

      const raw = drag.horizontal ? event.clientX - drag.x : event.clientY - drag.y;

      // A little rubber band at the ends
      const min = -drag.range.back * drag.pitch;
      const max = drag.range.forward * drag.pitch;
      const offset = raw < min ? min + (raw - min) * 0.15 : raw > max ? max + (raw - max) * 0.15 : raw;

      drag.offset = offset;
      element.style.transform = drag.horizontal ? `translateX(${offset}px)` : `translateY(${offset}px)`;
    });

    const end = event => {
      if (!drag || drag.id !== event.pointerId) return;

      const d = drag;
      drag = null;

      element.classList.remove("dragging");

      const steps = Math.max(-d.range.back, Math.min(d.range.forward, Math.round(d.offset / d.pitch)));

      if (steps === 0) {
        element.style.transform = "";

        // Just a click: select it (PC arrow keys)
        if (desktopControls && Math.abs(d.offset) < 4) {
          selectedId = block.id;
          renderBlocks();
        }
        return;
      }

      // Where it was let go, compared with where it snaps to
      const leftover = d.offset - steps * d.pitch;

      slideBlock(block, d.horizontal ? steps : 0, d.horizontal ? 0 : steps, leftover, d.horizontal);
    };

    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
  }

  /* ==========================================
  COLLISION / MOVEMENT
  ========================================== */

  function canMove(block, newX, newY) {
    // Only the red target can leave the board
    // from the right-hand exit.
    const isExit =
      block.target &&
      newY === boardData.exitRow &&
      newX >= 0 &&
      newX + block.w === size + 1;

    if (
      !isExit &&
      (
        newX < 0 ||
        newY < 0 ||
        newX + block.w > size ||
        newY + block.h > size
      )
    ) {
      return false;
    }

    return !boardData.blocks.some(other => {
      if (other.id === block.id) {
        return false;
      }

      return (
        newX < other.x + other.w &&
        newX + block.w > other.x &&
        newY < other.y + other.h &&
        newY + block.h > other.y
      );
    });
  }

  // Move several squares at once (one drag = one move)
  function slideBlock(block, dx, dy, leftover = 0, horizontal = true) {
    if (!active) return;

    block.x += dx;
    block.y += dy;

    moves++;
    movesDisplay.textContent = String(moves);

    // Sharp "shupa!"
    sfx("swish");

    if (block.target && block.x + block.w > size) {
      finishSuccess();
      return;
    }

    selectedId = desktopControls ? block.id : selectedId;
    renderBlocks();

    // Finish the slide smoothly from where it was let go
    const element = board.querySelector(`[data-id="${block.id}"]`);

    if (element && leftover) {
      element.style.transition = "none";
      element.style.transform = horizontal ? `translateX(${leftover}px)` : `translateY(${leftover}px)`;
      void element.offsetWidth;
      element.style.transition = "transform .12s cubic-bezier(.2,.9,.3,1)";
      element.style.transform = "";
    }
  }

  function moveBlock(block, dx, dy) {
    if (!active) return;

    const newX = block.x + dx;
    const newY = block.y + dy;

    if (!canMove(block, newX, newY)) {
      return;
    }

    block.x = newX;
    block.y = newY;

    moves++;

    sfx("swish");
    movesDisplay.textContent = String(moves);

    if (
      block.target &&
      block.x + block.w > size
    ) {
      finishSuccess();
    } else {
      // Keep the same block selected on PC.
      renderBlocks();
    }
  }

  /* ==========================================
  OPTIONAL PC KEYBOARD CONTROLS
  ========================================== */

  function onKey(event) {
    if (
      !active ||
      !desktopControls ||
      !selectedId
    ) {
      return;
    }

    const block = boardData.blocks.find(
      item => item.id === selectedId
    );

    if (!block) return;

    const dir = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }[event.key];

    if (!dir) return;

    event.preventDefault();

    if (block.w > block.h && dir[1] !== 0) {
      return;
    }

    if (block.h > block.w && dir[0] !== 0) {
      return;
    }

    moveBlock(block, dir[0], dir[1]);
  }

  /* ==========================================
  SUCCESS / SCORING
  ========================================== */

  /* ==========================================
  TIME LIMIT
  ========================================== */

  const timeDisplay =
    container.querySelector("[data-puzzle-time]");

  clockTimer = setInterval(() => {
    if (!active) return;

    const left = Math.max(
      0,
      BLOCK_TIME_LIMIT - (performance.now() - startedAt)
    );

    timeDisplay.textContent = String(Math.ceil(left / 1000));
    timeDisplay.classList.toggle("danger", left <= 10000);

    if (left <= 0) {
      finishTimeUp();
    }
  }, 200);

  function finishTimeUp() {
    if (!active) return;

    active = false;
    clearInterval(clockTimer);

    // Partial credit: how far the red block got toward the exit.
    const progress = clamp(
      (targetBlock.x - targetStartX) /
      Math.max(1, size - targetBlock.w - targetStartX + 1),
      0,
      1
    );

    hint.textContent = "TIME UP";

    onComplete?.({
      score: Math.round(progress * 30),
      adapt: Math.round(30 + progress * 20),
      meta: {
        success: false,
        moves,
        idealMoves: boardData.idealMoves,
        elapsed: BLOCK_TIME_LIMIT
      }
    });
  }

  function finishSuccess() {
    if (!active) return;

    active = false;
    clearInterval(clockTimer);

    const elapsed =
      performance.now() - startedAt;

    const idealMoves =
      boardData.idealMoves;

    const movePenalty =
      Math.max(0, moves - idealMoves) * 6;

    // Time allowance grows with the puzzle size.
    const allowedMs =
      4000 + idealMoves * 900;

    const timePenalty =
      Math.max(0, elapsed - allowedMs) / 400;

    const score = clamp(
      100 - movePenalty - timePenalty,
      0,
      100
    );

    onComplete?.({
      score: Math.round(score),

      adapt: Math.round(
        clamp(
          65 +
          (
            idealMoves /
            Math.max(idealMoves, moves)
          ) * 35,
          0,
          100
        )
      ),

      meta: {
        success: true,
        moves,
        idealMoves,
        elapsed: Math.round(elapsed),
        inputMode: desktopControls
          ? "click"
          : "swipe"
      }
    });
  }

  /* ==========================================
  START / CLEANUP
  ========================================== */

  if (desktopControls) {
    window.addEventListener("keydown", onKey);
  }

  renderBlocks();

  return () => {
    active = false;
    clearInterval(clockTimer);

    if (desktopControls) {
      window.removeEventListener("keydown", onKey);
    }
  };
}

/* ==========================================
BOARD GENERATION
========================================== */

/* ==========================================
BLOCK ESCAPE - RANDOM BOARD GENERATOR
- Places blocks at random on a 6x6 board.
- Finds the shortest solution (BFS, 1 cell = 1 move).
- Keeps the board only if the shortest solution length
  is inside the range for the level.
- Every board is solvable, and idealMoves is the real minimum.
========================================== */

const ESCAPE_SIZE = 6;

function createRandomEscapeBoard(level = 1) {
  // Shortest solution: Lv1 6-12 moves (5 blocks) -> Lv10 11-22 moves (10 blocks)
  const minMoves = Math.min(12, byLevelInt(level, 6, 11));
  const maxMoves = Math.min(24, byLevelInt(level, 12, 22));
  const blockCount = Math.min(11, byLevelInt(level, 5, 10));

  // Never freeze the game for long: stop after 300ms
  // and use the closest board found.
  const deadline = performance.now() + 300;

  let best = null;

  let attempts = 0;

  while ((performance.now() < deadline || !best) && attempts < 3000) {
    attempts++;

    const board = randomEscapeLayout(blockCount);

    if (!board) {
      continue;
    }

    const solution = solveEscapeBoard(board);

    if (solution === null) {
      continue;
    }

    board.idealMoves = solution;

    if (solution >= minMoves && solution <= maxMoves) {
      return board;
    }

    const distance =
      solution < minMoves ? minMoves - solution : solution - maxMoves;

    if (!best || distance < best.distance) {
      best = { board, distance };
    }
  }

  return best ? best.board : escapeFallbackBoard();
}

function randomEscapeLayout(blockCount) {
  const size = ESCAPE_SIZE;
  const exitRow = 1 + Math.floor(Math.random() * 4); // rows 1-4
  const grid = Array.from({ length: size }, () => Array(size).fill(false));

  const blocks = [];

  const place = block => {
    for (let y = block.y; y < block.y + block.h; y++) {
      for (let x = block.x; x < block.x + block.w; x++) {
        if (x >= size || y >= size || grid[y][x]) return false;
      }
    }
    for (let y = block.y; y < block.y + block.h; y++) {
      for (let x = block.x; x < block.x + block.w; x++) grid[y][x] = true;
    }
    blocks.push(block);
    return true;
  };

  // Red target: 2 wide, on the exit row, on the left half.
  place({
    id: "target",
    x: Math.floor(Math.random() * 3),
    y: exitRow,
    w: 2,
    h: 1,
    target: true
  });

  const ids = "abcdefghijk";
  let tries = 0;

  while (blocks.length < blockCount + 1 && tries < 200) {
    tries++;

    const vertical = Math.random() < 0.6;
    const length = Math.random() < 0.3 ? 3 : 2;

    const block = {
      id: ids[blocks.length - 1],
      x: Math.floor(Math.random() * (vertical ? size : size - length + 1)),
      y: Math.floor(Math.random() * (vertical ? size - length + 1 : size)),
      w: vertical ? 1 : length,
      h: vertical ? length : 1
    };

    // A horizontal block on the exit row would block it forever.
    if (!vertical && block.y === exitRow) continue;

    place(block);
  }

  if (blocks.length < blockCount + 1) {
    return null;
  }

  return { exitRow, blocks };
}

// Shortest number of 1-cell moves until the red block leaves.
// Returns null if impossible (or too big to search).
function solveEscapeBoard(board) {
  const size = ESCAPE_SIZE;
  const blocks = board.blocks;
  const n = blocks.length;
  const horizontal = blocks.map(b => b.w > b.h);
  const length = blocks.map(b => Math.max(b.w, b.h));
  const fixed = blocks.map(b => (horizontal[blocks.indexOf(b)] ? b.y : b.x));
  const targetIndex = blocks.findIndex(b => b.target);

  const start = blocks.map((b, i) => (horizontal[i] ? b.x : b.y));

  const key = state => state.join(",");

  const occupied = state => {
    const grid = Array.from({ length: size }, () => Array(size).fill(-1));
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < length[i]; k++) {
        const x = horizontal[i] ? state[i] + k : fixed[i];
        const y = horizontal[i] ? fixed[i] : state[i] + k;
        if (x < size) grid[y][x] = i;
      }
    }
    return grid;
  };

  const seen = new Set([key(start)]);
  let frontier = [start];
  let depth = 0;
  const MAX_STATES = 20000;

  while (frontier.length) {
    const next = [];

    for (const state of frontier) {
      // Goal: the red block has moved one cell past the right edge.
      if (state[targetIndex] + length[targetIndex] > size) {
        return depth;
      }

      const grid = occupied(state);

      for (let i = 0; i < n; i++) {
        for (const step of [-1, 1]) {
          const pos = state[i] + step;
          const lead = step < 0 ? pos : pos + length[i] - 1;

          let ok;

          if (horizontal[i]) {
            const isExit =
              i === targetIndex && fixed[i] === board.exitRow && lead === size;
            ok = pos >= 0 && (isExit || (lead < size && grid[fixed[i]][lead] === -1));
          } else {
            ok = pos >= 0 && lead < size && grid[lead][fixed[i]] === -1;
          }

          if (!ok) continue;

          const moved = state.slice();
          moved[i] = pos;

          const k = key(moved);

          if (!seen.has(k)) {
            seen.add(k);
            next.push(moved);
          }
        }
      }

      if (seen.size > MAX_STATES) {
        return null;
      }
    }

    frontier = next;
    depth++;
  }

  return null;
}

function escapeFallbackBoard() {
  return {
    exitRow: 2,
    idealMoves: 8,
    blocks: [
      { id: "target", x: 1, y: 2, w: 2, h: 1, target: true },
      { id: "a", x: 3, y: 0, w: 1, h: 3 },
      { id: "b", x: 4, y: 1, w: 1, h: 2 },
      { id: "c", x: 0, y: 0, w: 2, h: 1 },
      { id: "d", x: 0, y: 4, w: 3, h: 1 }
    ]
  };
}

/* ==========================================
PIPE CONNECT (v2: a real rotation puzzle)
- 4x4 tiles. Water comes IN on the left, must go OUT on the right.
- Tap / click a tile to rotate it 90°.
- Connected pipes light up as water flows.
- Every board is generated randomly and is always solvable.
========================================== */

const PIPE_SIZE = 4;
// Lv1: 40s (Lv10: 34s, see runPipeConnect)
const PIPE_TIME_LIMIT_LV1 = 40000;

// Directions as bits
const PIPE_N = 1;
const PIPE_E = 2;
const PIPE_S = 4;
const PIPE_W = 8;

const PIPE_DIRS = [
  { bit: PIPE_N, dx: 0, dy: -1, opposite: PIPE_S },
  { bit: PIPE_E, dx: 1, dy: 0, opposite: PIPE_W },
  { bit: PIPE_S, dx: 0, dy: 1, opposite: PIPE_N },
  { bit: PIPE_W, dx: -1, dy: 0, opposite: PIPE_E }
];

// Base shapes at rotation 0
const PIPE_BASE = {
  straight: PIPE_N | PIPE_S,
  corner: PIPE_N | PIPE_E
};

function pipeRotateMask(mask, turns) {
  let result = mask;

  for (let i = 0; i < turns % 4; i++) {
    result =
      ((result << 1) | (result >> 3)) & 15;
  }

  return result;
}

function pipeMask(tile) {
  return pipeRotateMask(
    PIPE_BASE[tile.type],
    tile.rotation
  );
}


function createPipeBoard(level = 1) {
  // Longer pipe paths at higher levels.
  //   Lv1: 7-11 tiles   Lv10: 10-14 tiles
  const minPath = Math.min(11, byLevelInt(level, 7, 10));
  const maxPath = Math.min(14, byLevelInt(level, 11, 14));

  // Random path from the left edge to the right edge.
  for (let attempt = 0; attempt < 200; attempt++) {
    const startY =
      Math.floor(Math.random() * PIPE_SIZE);

    const path = [{ x: 0, y: startY }];
    const visited = new Set([`0,${startY}`]);

    let ok = false;

    while (path.length < maxPath + 3) {
      const last = path[path.length - 1];

      if (
        last.x === PIPE_SIZE - 1 &&
        path.length >= minPath
      ) {
        ok = true;
        break;
      }

      const options = PIPE_DIRS
        .map(dir => ({
          x: last.x + dir.dx,
          y: last.y + dir.dy
        }))
        .filter(cell =>
          cell.x >= 0 &&
          cell.y >= 0 &&
          cell.x < PIPE_SIZE &&
          cell.y < PIPE_SIZE &&
          !visited.has(`${cell.x},${cell.y}`)
        );

      if (!options.length) {
        break;
      }

      // Slight preference for moving right keeps paths reasonable.
      const weighted = options.flatMap(cell =>
        cell.x > last.x
          ? [cell, cell]
          : [cell]
      );

      const next =
        weighted[
          Math.floor(Math.random() * weighted.length)
        ];

      path.push(next);
      visited.add(`${next.x},${next.y}`);
    }

    if (
      !ok ||
      path.length < minPath ||
      path.length > maxPath
    ) {
      continue;
    }

    return buildPipeTiles(path, level);
  }

  // Fallback (practically never used): a simple fixed path.
  return buildPipeTiles([
    { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 },
    { x: 2, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 1 }
  ]);
}


function buildPipeTiles(path, level = 1) {
  // Chance that a path tile starts in a WRONG rotation:
  // Lv1 85% -> Lv10 100%
  const scrambleRate = Math.min(1, byLevel(level, 0.85, 1));

  const tiles = [];

  for (let y = 0; y < PIPE_SIZE; y++) {
    for (let x = 0; x < PIPE_SIZE; x++) {
      tiles.push({
        x,
        y,
        type:
          Math.random() < 0.5
            ? "straight"
            : "corner",
        rotation:
          Math.floor(Math.random() * 4),
        onPath: false,
        targets: []
      });
    }
  }

  const tileAt = (x, y) =>
    tiles[y * PIPE_SIZE + x];

  const directionBit = (from, to) =>
    PIPE_DIRS.find(dir =>
      from.x + dir.dx === to.x &&
      from.y + dir.dy === to.y
    ).bit;

  let idealRotations = 0;

  path.forEach((cell, index) => {
    const inBit =
      index === 0
        ? PIPE_W
        : directionBit(cell, path[index - 1]);

    const outBit =
      index === path.length - 1
        ? PIPE_E
        : directionBit(cell, path[index + 1]);

    const needed = inBit | outBit;

    const type =
      needed === (PIPE_N | PIPE_S) ||
      needed === (PIPE_E | PIPE_W)
        ? "straight"
        : "corner";

    const targets = [0, 1, 2, 3].filter(
      turns =>
        pipeRotateMask(PIPE_BASE[type], turns) === needed
    );

    const tile = tileAt(cell.x, cell.y);

    tile.type = type;
    tile.onPath = true;
    tile.targets = targets;

    // Scramble: start in a wrong rotation most of the time.
    const wrong = [0, 1, 2, 3].filter(
      turns => !targets.includes(turns)
    );

    tile.rotation =
      Math.random() < scrambleRate
        ? wrong[Math.floor(Math.random() * wrong.length)]
        : targets[0];

    idealRotations += Math.min(
      ...targets.map(
        turns => (turns - tile.rotation + 4) % 4
      )
    );
  });

  return {
    tiles,
    startY: path[0].y,
    endY: path[path.length - 1].y,
    pathLength: path.length,
    idealRotations: Math.max(1, idealRotations)
  };
}


function runPipeConnect({
  game,
  container,
  onComplete
}) {
  const level = game?.level ?? 1;

  // DIFFICULTY BY LEVEL: longer paths, all tiles scrambled, less time.
  const PIPE_TIME_LIMIT = Math.round(byLevel(level, PIPE_TIME_LIMIT_LV1, 34000));

  let board = createPipeBoard(level);

  // Make sure the puzzle is not already solved.
  while (tracePipeFlow(board).solved) {
    board = createPipeBoard(level);
  }

  let active = true;
  let moves = 0;
  let finishTimer = null;
  let clockTimer = null;
  let waterDelay = 0;

  const startedAt = performance.now();

  container.innerHTML = `
    <div class="puzzle-wrap pipe2-game">

      <div class="pipe2-hud">
        <div>
          <span>ROTATIONS</span>
          <strong data-pipe-moves>0</strong>
        </div>

        <div>
          <span>TIME</span>
          <strong data-pipe-time>${PIPE_TIME_LIMIT / 1000}</strong>
        </div>
      </div>

      <div class="pipe2-board" data-pipe-board></div>

      <div class="puzzle-message pipe2-message" data-pipe-message>
        IN → OUT
      </div>

    </div>
  `;

  const boardElement =
    container.querySelector("[data-pipe-board]");

  const movesDisplay =
    container.querySelector("[data-pipe-moves]");

  const timeDisplay =
    container.querySelector("[data-pipe-time]");

  const messageElement =
    container.querySelector("[data-pipe-message]");


  /* ---------- BUILD BOARD ---------- */

  const tileButtons = [];

  for (let row = 0; row < PIPE_SIZE; row++) {
    // Left edge: IN marker on the start row
    const left = document.createElement("div");

    left.className = "pipe2-edge";

    if (row === board.startY) {
      left.classList.add("in");
      left.textContent = "IN";
    }

    boardElement.appendChild(left);

    for (let col = 0; col < PIPE_SIZE; col++) {
      const tile =
        board.tiles[row * PIPE_SIZE + col];

      const button = document.createElement("button");

      button.type = "button";
      button.className = "pipe2-tile";
      button.setAttribute(
        "aria-label",
        `Pipe ${col + 1}-${row + 1}`
      );

      button.innerHTML = `
        <svg viewBox="0 0 100 100" aria-hidden="true">
          ${(() => {
            const d =
              tile.type === "straight"
                ? "M50 0 V100"
                : "M50 0 V50 H100";

            // shell = pipe, water = channel,
            // stream = moving water, fill = final water sweep
            return `
              <path class="pipe2-shell" d="${d}" />
              <path class="pipe2-water" d="${d}" />
              <path class="pipe2-stream" d="${d}" pathLength="100" />
              <path class="pipe2-fill" d="${d}" pathLength="100" />
            `;
          })()}
        </svg>
      `;

      // Keep a running angle so the animation always turns clockwise.
      tile.angle = tile.rotation * 90;

      const svg = button.querySelector("svg");
      svg.style.transform = `rotate(${tile.angle}deg)`;

      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        rotateTile(tile, svg);
      });

      boardElement.appendChild(button);

      tileButtons.push({ tile, button });
    }

    // Right edge: OUT marker on the end row
    const right = document.createElement("div");

    right.className = "pipe2-edge";

    if (row === board.endY) {
      right.classList.add("out");
      right.textContent = "OUT";
    }

    boardElement.appendChild(right);
  }


  /* ---------- PLAY ---------- */

  function rotateTile(tile, svg) {
    if (!active) {
      return;
    }

    tile.rotation = (tile.rotation + 1) % 4;

    sfx("click");
    tile.angle += 90;

    svg.style.transform = `rotate(${tile.angle}deg)`;

    moves++;
    movesDisplay.textContent = String(moves);

    const flow = tracePipeFlow(board);

    paintFlow(flow);

    if (flow.solved) {
      finish(true);
    }
  }


  function paintFlow(flow) {
    tileButtons.forEach(({ tile, button }) => {
      const filled = flow.filled.has(tile);

      button.classList.toggle("flow", filled);

      // Water direction: does it enter where the drawn path starts?
      if (filled) {
        const startSide =
          pipeRotateMask(PIPE_N, tile.rotation);

        button.classList.toggle(
          "rev",
          flow.entries.get(tile) !== startSide
        );
      }
    });

    boardElement
      .querySelector(".pipe2-edge.out")
      ?.classList.toggle("flow", flow.solved);
  }


  /* ---------- TIMER ---------- */

  clockTimer = setInterval(() => {
    if (!active) {
      return;
    }

    const left = Math.max(
      0,
      PIPE_TIME_LIMIT -
      (performance.now() - startedAt)
    );

    timeDisplay.textContent =
      String(Math.ceil(left / 1000));

    timeDisplay.classList.toggle(
      "danger",
      left <= 5000
    );

    if (left <= 0) {
      finish(false);
    }
  }, 200);


  /* ---------- FINISH ---------- */

  function finish(success) {
    if (!active) {
      return;
    }

    active = false;

    clearInterval(clockTimer);

    const elapsed =
      performance.now() - startedAt;

    const ideal = board.idealRotations;

    const flow = tracePipeFlow(board);

    let score;

    if (success) {
      // Extra rotations and slow solving lower the score.
      const extraMoves =
        Math.max(0, moves - ideal);

      const allowedMs =
        3000 + ideal * 700;

      const timePenalty =
        Math.max(0, elapsed - allowedMs) / 400;

      score = clamp(
        100 - extraMoves * 4 - timePenalty,
        25,
        100
      );

      messageElement.textContent = "CONNECTED!";
      boardElement.classList.add("solved");

      // Water rushes through the pipes
      sfx("water");

      // Water rushes through the pipes from IN to OUT, one tile after another.
      [...flow.filled].forEach((tile, order) => {
        const item =
          tileButtons.find(entry => entry.tile === tile);

        setTimeout(() => {
          item?.button.classList.add("filled");
        }, order * 110);
      });

      setTimeout(() => {
        boardElement
          .querySelector(".pipe2-edge.out")
          ?.classList.add("splash");
      }, flow.filled.size * 110);

      waterDelay =
        flow.filled.size * 110 + 300;

    } else {
      // Partial credit: how far the water got along the way.
      score = clamp(
        (flow.filled.size / board.pathLength) * 40,
        0,
        40
      );

      messageElement.textContent = "TIME UP";
      boardElement.classList.add("failed");
    }

    finishTimer = setTimeout(() => {
      onComplete?.({
        score: Math.round(score),

        adapt: Math.round(
          clamp(
            success
              ? 55 + (ideal / Math.max(ideal, moves)) * 45
              : 30 + (flow.filled.size / board.pathLength) * 25,
            0,
            100
          )
        ),

        meta: {
          success,
          moves,
          idealRotations: ideal,
          elapsed: Math.round(elapsed)
        }
      });
    }, success ? 350 + waterDelay : 400);
  }


  return () => {
    active = false;

    clearInterval(clockTimer);
    clearTimeout(finishTimer);
  };
}


/*
 * Follow the water from IN.
 * Returns the filled tiles and whether it reaches OUT.
 */
function tracePipeFlow(board) {
  const filled = new Set();

  // tile -> the side the water entered from
  const entries = new Map();

  const tileAt = (x, y) =>
    x >= 0 && y >= 0 && x < PIPE_SIZE && y < PIPE_SIZE
      ? board.tiles[y * PIPE_SIZE + x]
      : null;

  let x = 0;
  let y = board.startY;
  let enteringFrom = PIPE_W;

  for (let steps = 0; steps < PIPE_SIZE * PIPE_SIZE + 1; steps++) {
    const tile = tileAt(x, y);

    if (!tile || filled.has(tile)) {
      return { filled, entries, solved: false };
    }

    const mask = pipeMask(tile);

    if (!(mask & enteringFrom)) {
      return { filled, entries, solved: false };
    }

    filled.add(tile);
    entries.set(tile, enteringFrom);

    const outBit = mask & ~enteringFrom;

    // Reached the right edge on the OUT row.
    if (
      outBit === PIPE_E &&
      x === PIPE_SIZE - 1 &&
      y === board.endY
    ) {
      return { filled, entries, solved: true };
    }

    const dir = PIPE_DIRS.find(d => d.bit === outBit);

    if (!dir) {
      return { filled, entries, solved: false };
    }

    x += dir.dx;
    y += dir.dy;
    enteringFrom = dir.opposite;
  }

  return { filled, entries, solved: false };
}


/* ==========================================
LASER MIRROR — ORIGINAL
========================================== */

function runLaserMirror({
  container,
  onComplete
}) {
  let active = true;
  let moves = 0;
  let mirror = 0;

  container.innerHTML = `
    <div class="puzzle-wrap">
      <div class="puzzle-top">
        <span>MOVES</span>
        <strong data-laser-moves>0</strong>
      </div>

      <div class="laser-puzzle">
        <div class="laser-source">⚡</div>

        <button
          type="button"
          class="laser-mirror"
          data-laser-mirror
        >
          /
        </button>

        <div class="laser-target">◎</div>

        <div
          class="laser-beam"
          data-laser-beam
        ></div>
      </div>
    </div>
  `;

  const mirrorButton = container.querySelector(
    "[data-laser-mirror]"
  );

  const beam = container.querySelector(
    "[data-laser-beam]"
  );

  const display = container.querySelector(
    "[data-laser-moves]"
  );

  mirrorButton.addEventListener("click", () => {
    if (!active) return;

    mirror = mirror === 0 ? 1 : 0;

    moves++;
    display.textContent = moves;

    mirrorButton.textContent =
      mirror === 0 ? "/" : "\\";

    if (mirror === 1) {
      beam.classList.add("success");
      finish();
    }
  });

  function finish() {
    if (!active) return;

    active = false;

    const score = clamp(
      100 - Math.max(0, moves - 1) * 20,
      0,
      100
    );

    onComplete?.({
      score,
      adapt: 75,
      meta: { moves }
    });
  }

  return () => {
    active = false;
  };
}

/* ==========================================
UTIL
========================================== */

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}
