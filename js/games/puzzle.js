// GAMIQ（ゲーミック） v2 - Puzzle Games

import { t } from "../i18n.js";

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

function runBlockEscape({ container, onComplete }) {
  const size = 6;
  const boardData = createRandomEscapeBoard();

  // PC: click a block and then click arrows.
  // Mobile: swipe blocks directly.
  const desktopControls = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  ).matches;

  let active = true;
  let moves = 0;
  let selectedId = null;

  const startedAt = performance.now();

  container.innerHTML = `
    <div class="puzzle-wrap block-escape-game">
      <div class="puzzle-top">
        <span>MOVES</span>
        <strong data-puzzle-moves>0</strong>
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

    for (const block of boardData.blocks) {
      const element = document.createElement("button");

      element.type = "button";
      element.className = "puzzle-block";
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

      if (desktopControls) {
        const selected = selectedId === block.id;

        element.classList.toggle("selected", selected);
        element.setAttribute("aria-pressed", String(selected));

        element.addEventListener("click", () => {
          if (!active) return;

          selectedId = block.id;
          renderBlocks();
        });

      } else {
        attachSwipe(element, block);
      }

      board.appendChild(element);
    }

    // Show movement buttons only for the selected block.
    // Only legal directions are shown.
    if (
      desktopControls &&
      selectedId !== null &&
      active
    ) {
      const selected = boardData.blocks.find(
        block => block.id === selectedId
      );

      if (selected) {
        renderDirections(selected);
      }
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
  MOBILE SWIPE
  ========================================== */

  function attachSwipe(element, block) {
    let swipe = null;

    element.addEventListener("pointerdown", event => {
      if (!active) return;

      swipe = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY
      };

      element.setPointerCapture?.(
        event.pointerId
      );
    });

    element.addEventListener("pointerup", event => {
      if (
        !active ||
        !swipe ||
        swipe.id !== event.pointerId
      ) {
        return;
      }

      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;

      swipe = null;

      if (block.w > block.h) {
        // Horizontal block
        if (
          Math.abs(dx) >= 22 &&
          Math.abs(dx) > Math.abs(dy)
        ) {
          moveBlock(
            block,
            dx > 0 ? 1 : -1,
            0
          );
        }

      } else {
        // Vertical block
        if (
          Math.abs(dy) >= 22 &&
          Math.abs(dy) > Math.abs(dx)
        ) {
          moveBlock(
            block,
            0,
            dy > 0 ? 1 : -1
          );
        }
      }
    });

    element.addEventListener("pointercancel", () => {
      swipe = null;
    });
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

  function finishSuccess() {
    if (!active) return;

    active = false;

    const elapsed =
      performance.now() - startedAt;

    const idealMoves =
      boardData.idealMoves;

    const movePenalty =
      Math.max(0, moves - idealMoves) * 8;

    const timePenalty =
      Math.max(0, elapsed - 4500) / 180;

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

    if (desktopControls) {
      window.removeEventListener("keydown", onKey);
    }
  };
}

/* ==========================================
BOARD GENERATION
========================================== */

function createRandomEscapeBoard() {
  const presets = [
    {
      exitRow: 2,
      idealMoves: 8,

      blocks: [
        {
          id: "target",
          x: 1,
          y: 2,
          w: 2,
          h: 1,
          target: true
        },
        {
          id: "a",
          x: 3,
          y: 0,
          w: 1,
          h: 3
        },
        {
          id: "b",
          x: 4,
          y: 1,
          w: 1,
          h: 2
        },
        {
          id: "c",
          x: 0,
          y: 0,
          w: 2,
          h: 1
        },
        {
          id: "d",
          x: 0,
          y: 4,
          w: 3,
          h: 1
        }
      ]
    },

    {
      exitRow: 2,
      idealMoves: 12,

      blocks: [
        {
          id: "target",
          x: 0,
          y: 2,
          w: 2,
          h: 1,
          target: true
        },
        {
          id: "a",
          x: 2,
          y: 1,
          w: 1,
          h: 2
        },
        {
          id: "b",
          x: 3,
          y: 0,
          w: 1,
          h: 3
        },
        {
          id: "c",
          x: 4,
          y: 2,
          w: 1,
          h: 2
        },
        {
          id: "d",
          x: 0,
          y: 4,
          w: 3,
          h: 1
        },
        {
          id: "e",
          x: 3,
          y: 4,
          w: 2,
          h: 1
        }
      ]
    },

    {
      exitRow: 3,
      idealMoves: 6,

      blocks: [
        {
          id: "target",
          x: 1,
          y: 3,
          w: 2,
          h: 1,
          target: true
        },
        {
          id: "a",
          x: 3,
          y: 2,
          w: 1,
          h: 2
        },
        {
          id: "b",
          x: 4,
          y: 1,
          w: 1,
          h: 3
        },
        {
          id: "c",
          x: 0,
          y: 0,
          w: 3,
          h: 1
        },
        {
          id: "d",
          x: 0,
          y: 5,
          w: 2,
          h: 1
        }
      ]
    }
  ];

  const selected = presets[
    Math.floor(Math.random() * presets.length)
  ];

  return JSON.parse(JSON.stringify(selected));
}

/* ==========================================
PIPE CONNECT (v2: a real rotation puzzle)
- 4x4 tiles. Water comes IN on the left, must go OUT on the right.
- Tap / click a tile to rotate it 90°.
- Connected pipes light up as water flows.
- Every board is generated randomly and is always solvable.
========================================== */

const PIPE_SIZE = 4;
const PIPE_TIME_LIMIT = 40000;

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


function createPipeBoard() {
  // Random path from the left edge to the right edge.
  for (let attempt = 0; attempt < 200; attempt++) {
    const startY =
      Math.floor(Math.random() * PIPE_SIZE);

    const path = [{ x: 0, y: startY }];
    const visited = new Set([`0,${startY}`]);

    let ok = false;

    while (path.length < 14) {
      const last = path[path.length - 1];

      if (
        last.x === PIPE_SIZE - 1 &&
        path.length >= 7
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
      path.length < 7 ||
      path.length > 11
    ) {
      continue;
    }

    return buildPipeTiles(path);
  }

  // Fallback (practically never used): a simple fixed path.
  return buildPipeTiles([
    { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 },
    { x: 2, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 1 }
  ]);
}


function buildPipeTiles(path) {
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
      Math.random() < 0.85
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
  container,
  onComplete
}) {
  let board = createPipeBoard();

  // Make sure the puzzle is not already solved.
  while (tracePipeFlow(board).solved) {
    board = createPipeBoard();
  }

  let active = true;
  let moves = 0;
  let finishTimer = null;
  let clockTimer = null;

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
          ${
            tile.type === "straight"
              ? `
                <path class="pipe2-shell" d="M50 0 V100" />
                <path class="pipe2-water" d="M50 0 V100" />
              `
              : `
                <path class="pipe2-shell" d="M50 0 V50 H100" />
                <path class="pipe2-water" d="M50 0 V50 H100" />
              `
          }
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
      button.classList.toggle(
        "flow",
        flow.filled.has(tile)
      );
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
    }, success ? 650 : 400);
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
      return { filled, solved: false };
    }

    const mask = pipeMask(tile);

    if (!(mask & enteringFrom)) {
      return { filled, solved: false };
    }

    filled.add(tile);

    const outBit = mask & ~enteringFrom;

    // Reached the right edge on the OUT row.
    if (
      outBit === PIPE_E &&
      x === PIPE_SIZE - 1 &&
      y === board.endY
    ) {
      return { filled, solved: true };
    }

    const dir = PIPE_DIRS.find(d => d.bit === outBit);

    if (!dir) {
      return { filled, solved: false };
    }

    x += dir.dx;
    y += dir.dy;
    enteringFrom = dir.opposite;
  }

  return { filled, solved: false };
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
