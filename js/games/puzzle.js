
// GAMIQ（ゲーミック） v2 - Puzzle Games

export function createPuzzleGames() {
  return [
    {
      id: "puzzle_block_escape",
      type: "block_escape",
      title: "BLOCK ESCAPE",
      rule: "赤いブロックを最短手数で出口へ出せ",
      skill: "LOGIC",
      theme: "factory",
      duration: 12000
    },
    {
      id: "puzzle_pipe_connect",
      type: "pipe_connect",
      title: "PIPE CONNECT",
      rule: "3回以内にパイプをつなげ",
      skill: "LOGIC",
      theme: "factory",
      duration: 10000
    },
    {
      id: "puzzle_laser_mirror",
      type: "laser_mirror",
      title: "LASER MIRROR",
      rule: "鏡を動かしてレーザーを標的へ当てろ",
      skill: "LOGIC",
      theme: "cyber",
      duration: 10000
    }
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
    ? "ブロックをクリック → 矢印をクリックして移動"
    : "ブロックをスワイプして赤いブロックを右へ";

  function directionsFor(block) {
    return block.w > block.h
      ? [
          {
            dx: -1,
            dy: 0,
            text: "◀",
            side: "left",
            label: "左へ移動"
          },
          {
            dx: 1,
            dy: 0,
            text: "▶",
            side: "right",
            label: "右へ移動"
          }
        ]
      : [
          {
            dx: 0,
            dy: -1,
            text: "▲",
            side: "up",
            label: "上へ移動"
          },
          {
            dx: 0,
            dy: 1,
            text: "▼",
            side: "down",
            label: "下へ移動"
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
          ? "赤い脱出ブロック"
          : `ブロック ${block.id}`
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
PIPE CONNECT — ORIGINAL
========================================== */

function runPipeConnect({
  container,
  onComplete
}) {
  let active = true;
  let moves = 0;

  const tiles = [
    0, 1, 0,
    2, 3, 1,
    0, 2, 0
  ];

  container.innerHTML = `
    <div class="puzzle-wrap">
      <div class="puzzle-top">
        <span>ROTATIONS</span>
        <strong data-pipe-moves>0</strong>
      </div>

      <div class="pipe-grid" data-pipe-grid></div>
    </div>
  `;

  const grid = container.querySelector(
    "[data-pipe-grid]"
  );

  const display = container.querySelector(
    "[data-pipe-moves]"
  );

  render();

  function render() {
    grid.innerHTML = "";

    tiles.forEach((rotation, index) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "pipe-tile";

      button.style.transform =
        `rotate(${rotation * 90}deg)`;

      button.innerHTML = "└";

      button.addEventListener("click", () => {
        if (!active) return;

        tiles[index] =
          (tiles[index] + 1) % 4;

        moves++;
        display.textContent = moves;

        if (moves >= 3) {
          finish();
        }

        render();
      });

      grid.appendChild(button);
    });
  }

  function finish() {
    if (!active) return;

    active = false;

    const score = clamp(
      100 - Math.max(0, moves - 3) * 15,
      0,
      100
    );

    onComplete?.({
      score,
      adapt: 70,
      meta: { moves }
    });
  }

  return () => {
    active = false;
  };
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
