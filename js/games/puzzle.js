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

function runBlockEscape({
  container,
  onComplete
}) {
  const size = 6;

  const boardData =
    createRandomEscapeBoard();

  let active = true;
  let moves = 0;

  const startedAt =
    performance.now();

  container.innerHTML = `
    <div class="puzzle-wrap">

      <div class="puzzle-top">

        <span>
          MOVES
        </span>

        <strong data-puzzle-moves>
          0
        </strong>

      </div>

      <div
        class="block-board"
        data-block-board
      ></div>

      <div class="puzzle-message">
        赤いブロックを右の出口へ
      </div>

    </div>
  `;

  const board =
    container.querySelector(
      "[data-block-board]"
    );

  const movesDisplay =
    container.querySelector(
      "[data-puzzle-moves]"
    );

  renderBlocks();


  function renderBlocks() {
    board.innerHTML = "";

    board.style.setProperty(
      "--grid-size",
      size
    );

    boardData.blocks.forEach(
      block => {
        const element =
          document.createElement(
            "button"
          );

        element.type =
          "button";

        element.className =
          "puzzle-block";

        if (block.target) {
          element.classList.add(
            "target"
          );
        }

        element.dataset.id =
          block.id;

        element.style.gridColumn =
          `${block.x + 1} / span ${block.w}`;

        element.style.gridRow =
          `${block.y + 1} / span ${block.h}`;

        element.textContent =
          block.target
            ? "EXIT"
            : "";

        attachBlockControls(
          element,
          block
        );

        board.appendChild(
          element
        );
      }
    );
  }


  function attachBlockControls(
    element,
    block
  ) {
    let startX = 0;
    let startY = 0;

    element.addEventListener(
      "pointerdown",
      event => {
        if (!active) {
          return;
        }

        startX =
          event.clientX;

        startY =
          event.clientY;

        element.setPointerCapture?.(
          event.pointerId
        );
      }
    );

    element.addEventListener(
      "pointerup",
      event => {
        if (!active) {
          return;
        }

        const dx =
          event.clientX -
          startX;

        const dy =
          event.clientY -
          startY;

        if (
          Math.abs(dx) < 18 &&
          Math.abs(dy) < 18
        ) {
          return;
        }

        if (block.w > block.h) {
          if (
            Math.abs(dx) <
            Math.abs(dy)
          ) {
            return;
          }

          moveBlock(
            block,
            dx > 0 ? 1 : -1,
            0
          );
        } else {
          if (
            Math.abs(dy) <
            Math.abs(dx)
          ) {
            return;
          }

          moveBlock(
            block,
            0,
            dy > 0 ? 1 : -1
          );
        }
      }
    );


    element.addEventListener(
      "keydown",
      event => {
        if (!active) {
          return;
        }

        let dx = 0;
        let dy = 0;

        if (
          event.key ===
          "ArrowLeft"
        ) {
          dx = -1;
        }

        if (
          event.key ===
          "ArrowRight"
        ) {
          dx = 1;
        }

        if (
          event.key ===
          "ArrowUp"
        ) {
          dy = -1;
        }

        if (
          event.key ===
          "ArrowDown"
        ) {
          dy = 1;
        }

        if (
          dx === 0 &&
          dy === 0
        ) {
          return;
        }

        event.preventDefault();

        if (
          block.w > block.h &&
          dy !== 0
        ) {
          return;
        }

        if (
          block.h > block.w &&
          dx !== 0
        ) {
          return;
        }

        moveBlock(
          block,
          dx,
          dy
        );
      }
    );
  }


  function moveBlock(
    block,
    dx,
    dy
  ) {
    const newX =
      block.x + dx;

    const newY =
      block.y + dy;

    if (
      !canMove(
        block,
        newX,
        newY
      )
    ) {
      return;
    }

    block.x =
      newX;

    block.y =
      newY;

    moves++;

    movesDisplay.textContent =
      moves;

    renderBlocks();

    if (
      block.target &&
      block.x + block.w >= size
    ) {
      finishSuccess();
    }
  }


  function canMove(
    block,
    newX,
    newY
  ) {
    const isTargetExit =
      block.target &&
      newY === block.y &&
      newX + block.w > size &&
      block.y === boardData.exitRow;

    if (
      !isTargetExit &&
      (
        newX < 0 ||
        newY < 0 ||
        newX + block.w > size ||
        newY + block.h > size
      )
    ) {
      return false;
    }

    for (
      const other of
      boardData.blocks
    ) {
      if (
        other.id === block.id
      ) {
        continue;
      }

      const overlap =
        newX <
          other.x + other.w &&
        newX + block.w >
          other.x &&
        newY <
          other.y + other.h &&
        newY + block.h >
          other.y;

      if (overlap) {
        return false;
      }
    }

    return true;
  }


  function finishSuccess() {
    if (!active) {
      return;
    }

    active = false;

    const elapsed =
      performance.now() -
      startedAt;

    const idealMoves =
      boardData.idealMoves;

    const movePenalty =
      Math.max(
        0,
        moves - idealMoves
      ) * 8;

    const timePenalty =
      Math.max(
        0,
        elapsed - 4500
      ) / 180;

    const score =
      clamp(
        100 -
        movePenalty -
        timePenalty,
        0,
        100
      );

    onComplete?.({
      score:
        Math.round(score),

      adapt:
        Math.round(
          clamp(
            65 +
            (
              idealMoves /
              Math.max(
                idealMoves,
                moves
              )
            ) * 35,
            0,
            100
          )
        ),

      meta: {
        moves,
        idealMoves,
        elapsed:
          Math.round(elapsed)
      }
    });
  }


  return () => {
    active = false;
  };
}


/* ==========================================
BOARD GENERATION
========================================== */

function createRandomEscapeBoard() {
  const presets = [
    {
      exitRow: 2,
      idealMoves: 3,

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
      idealMoves: 4,

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
      idealMoves: 3,

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

  const selected =
    presets[
      Math.floor(
        Math.random() *
        presets.length
      )
    ];

  return JSON.parse(
    JSON.stringify(
      selected
    )
  );
}


/* ==========================================
PIPE CONNECT
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
        <strong data-pipe-moves>
          0
        </strong>
      </div>

      <div
        class="pipe-grid"
        data-pipe-grid
      ></div>

    </div>
  `;

  const grid =
    container.querySelector(
      "[data-pipe-grid]"
    );

  const display =
    container.querySelector(
      "[data-pipe-moves]"
    );


  render();


  function render() {
    grid.innerHTML = "";

    tiles.forEach(
      (rotation, index) => {
        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "pipe-tile";

        button.style.transform =
          `rotate(${rotation * 90}deg)`;

        button.innerHTML =
          "└";

        button.addEventListener(
          "click",
          () => {
            if (!active) {
              return;
            }

            tiles[index] =
              (tiles[index] + 1) % 4;

            moves++;

            display.textContent =
              moves;

            if (moves >= 3) {
              finish();
            }

            render();
          }
        );

        grid.appendChild(
          button
        );
      }
    );
  }


  function finish() {
    if (!active) {
      return;
    }

    active = false;

    const score =
      clamp(
        100 -
        Math.max(
          0,
          moves - 3
        ) * 15,
        0,
        100
      );

    onComplete?.({
      score,
      adapt: 70,
      meta: {
        moves
      }
    });
  }


  return () => {
    active = false;
  };
}


/* ==========================================
LASER MIRROR
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
        <strong data-laser-moves>
          0
        </strong>
      </div>

      <div class="laser-puzzle">

        <div class="laser-source">
          ⚡
        </div>

        <button
          type="button"
          class="laser-mirror"
          data-laser-mirror
        >
          /
        </button>

        <div class="laser-target">
          ◎
        </div>

        <div
          class="laser-beam"
          data-laser-beam
        ></div>

      </div>

    </div>
  `;

  const mirrorButton =
    container.querySelector(
      "[data-laser-mirror]"
    );

  const beam =
    container.querySelector(
      "[data-laser-beam]"
    );

  const display =
    container.querySelector(
      "[data-laser-moves]"
    );


  mirrorButton.addEventListener(
    "click",
    () => {
      if (!active) {
        return;
      }

      mirror =
        mirror === 0
          ? 1
          : 0;

      moves++;

      display.textContent =
        moves;

      mirrorButton.textContent =
        mirror === 0
          ? "/"
          : "\\";

      if (mirror === 1) {
        beam.classList.add(
          "success"
        );

        finish();
      }
    }
  );


  function finish() {
    if (!active) {
      return;
    }

    active = false;

    const score =
      clamp(
        100 -
        Math.max(
          0,
          moves - 1
        ) * 20,
        0,
        100
      );

    onComplete?.({
      score,
      adapt: 75,
      meta: {
        moves
      }
    });
  }


  return () => {
    active = false;
  };
}


/* ==========================================
UTIL
========================================== */

function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}
