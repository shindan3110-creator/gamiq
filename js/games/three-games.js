// GAMIQ（ゲーミック） v2 - 3D / Action Games

import {
  runZombie3D
} from "./zombie-3d.js";

import {
  runSpace3D
} from "./space-3d.js";

export function createThreeGames() {
  return [
    {
      id: "three_zombie_assault",
      type: "zombie_assault",
      title: "ZOMBIE ASSAULT",
      rule: "迫ってくるゾンビを倒せ",
      skill: "SPEED",
      theme: "zombie",
      duration: 10000
    },

    {
      id: "three_space_blaster",
      type: "space_blaster",
      title: "SPACE BLASTER",
      rule: "敵艦を狙って撃ち落とせ",
      skill: "AIM",
      theme: "space",
      duration: 10000
    },

    {
      id: "three_lane_dodge",
      type: "lane_dodge",
      title: "HIGHWAY DODGE",
      rule: "障害物を避け続けろ",
      skill: "REFLEX",
      theme: "race",
      duration: 10000
    },

    {
      id: "three_factory_rush",
      type: "factory_rush",
      title: "FACTORY RUSH",
      rule: "ラインを止めずに処理しろ",
      skill: "SPEED",
      theme: "factory",
      duration: 10000
    }
  ];
}


export function runThreeGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  switch (game.type) {
    case "zombie_assault":
  return runZombie3D({
    container,
    onComplete
  });

    case "space_blaster":
  return runSpace3D({
    container,
    onComplete
  });

    case "lane_dodge":
      return runLaneDodge({
        container,
        onComplete
      });

    case "factory_rush":
      return runFactoryRush({
        container,
        onComplete
      });

    default:
      return () => {};
  }
}




/* ==========================================
LANE DODGE
========================================== */

function runLaneDodge({
  container,
  onComplete
}) {
  let active = true;

  let lane = 1;
  let avoided = 0;

  let obstacleLane =
    randomLane();

  const startedAt =
    performance.now();

  container.innerHTML = `
    <div class="three-stage race-stage">

      <div class="three-hud">
        <span>
          DODGED
        </span>

        <strong
          data-race-score
        >
          0
        </strong>
      </div>

      <div class="race-road">

        <div
          class="race-player"
          data-race-player
        >
          🏎️
        </div>

        <div
          class="race-obstacle"
          data-race-obstacle
        >
          🚧
        </div>

      </div>

      <div class="race-controls">

        <button
          type="button"
          data-race-left
        >
          ←
        </button>

        <button
          type="button"
          data-race-right
        >
          →
        </button>

      </div>

    </div>
  `;

  const player =
    container.querySelector(
      "[data-race-player]"
    );

  const obstacle =
    container.querySelector(
      "[data-race-obstacle]"
    );

  const scoreDisplay =
    container.querySelector(
      "[data-race-score]"
    );

  const left =
    container.querySelector(
      "[data-race-left]"
    );

  const right =
    container.querySelector(
      "[data-race-right]"
    );


  function updatePlayer() {
    player.dataset.lane =
      String(lane);

    player.style.left =
      `${16 + lane * 34}%`;
  }


  function updateObstacle() {
    obstacle.style.left =
      `${16 + obstacleLane * 34}%`;

    obstacle.classList.remove(
      "race-drop"
    );

    void obstacle.offsetWidth;

    obstacle.classList.add(
      "race-drop"
    );
  }


  function changeLane(
    direction
  ) {
    if (!active) {
      return;
    }

    lane =
      clamp(
        lane + direction,
        0,
        2
      );

    updatePlayer();
  }


  function resolveObstacle() {
    if (!active) {
      return;
    }

    if (lane === obstacleLane) {
      finish(false);
      return;
    }

    avoided++;

    scoreDisplay.textContent =
      avoided;

    if (avoided >= 7) {
      finish(true);
      return;
    }

    obstacleLane =
      randomLane();

    updateObstacle();
  }


  let timer =
    setInterval(
      resolveObstacle,
      850
    );


  function finish(success) {
    if (!active) {
      return;
    }

    active = false;

    clearInterval(timer);

    const elapsed =
      performance.now() -
      startedAt;

    const score =
      success
        ? clamp(
            70 +
            avoided * 4,
            0,
            100
          )
        : clamp(
            avoided * 12,
            0,
            70
          );

    onComplete?.({
      score:
        Math.round(score),

      adapt:
        success
          ? 75
          : 40,

      meta: {
        avoided,
        elapsed:
          Math.round(elapsed)
      }
    });
  }


  left.addEventListener(
    "pointerdown",
    () => changeLane(-1)
  );

  right.addEventListener(
    "pointerdown",
    () => changeLane(1)
  );


  updatePlayer();
  updateObstacle();


  return () => {
    active = false;

    clearInterval(timer);
  };
}


/* ==========================================
FACTORY RUSH
========================================== */

function runFactoryRush({
  container,
  onComplete
}) {
  let active = true;

  let progress = 0;
  let mistakes = 0;

  const startedAt =
    performance.now();

  container.innerHTML = `
    <div class="three-stage factory-stage">

      <div class="three-hud">

        <span>
          OUTPUT
        </span>

        <strong
          data-factory-progress
        >
          0%
        </strong>

      </div>

      <div class="factory-machine">

        <div class="factory-belt">

          <div
            class="factory-box"
            data-factory-box
          >
            📦
          </div>

        </div>

        <button
          type="button"
          class="three-action-button"
          data-factory-action
        >
          PROCESS
        </button>

      </div>

    </div>
  `;

  const box =
    container.querySelector(
      "[data-factory-box]"
    );

  const action =
    container.querySelector(
      "[data-factory-action]"
    );

  const display =
    container.querySelector(
      "[data-factory-progress]"
    );


  let sweetSpot = false;


  function cycle() {
    if (!active) {
      return;
    }

    sweetSpot =
      Math.random() > 0.45;

    box.classList.toggle(
      "factory-ready",
      sweetSpot
    );

    box.textContent =
      sweetSpot
        ? "✅"
        : "📦";
  }


  function process() {
    if (!active) {
      return;
    }

    if (sweetSpot) {
      progress +=
        14 +
        Math.random() * 8;
    } else {
      mistakes++;
      progress -= 4;
    }

    progress =
      clamp(
        progress,
        0,
        100
      );

    display.textContent =
      `${Math.round(progress)}%`;

    if (progress >= 100) {
      finish();
    }

    cycle();
  }


  let timer =
    setInterval(
      cycle,
      700
    );


  function finish() {
    if (!active) {
      return;
    }

    active = false;

    clearInterval(timer);

    const elapsed =
      performance.now() -
      startedAt;

    const score =
      clamp(
        100 -
        mistakes * 10 -
        Math.max(
          0,
          elapsed - 5000
        ) / 180,
        0,
        100
      );

    onComplete?.({
      score:
        Math.round(score),

      adapt:
        Math.round(
          clamp(
            80 -
            mistakes * 8,
            20,
            100
          )
        ),

      meta: {
        mistakes,
        elapsed:
          Math.round(elapsed)
      }
    });
  }


  action.addEventListener(
    "pointerdown",
    process
  );


  cycle();


  return () => {
    active = false;

    clearInterval(timer);

    action.removeEventListener(
      "pointerdown",
      process
    );
  };
}


/* ==========================================
UTIL
========================================== */

function randomLane() {
  return Math.floor(
    Math.random() * 3
  );
}


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
