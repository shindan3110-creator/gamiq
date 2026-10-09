// GAMIQ（ゲーミック） v2 - App Core

import {
  GamiqFeed
} from "./feed.js";

import {
  GamiqRandomizer
} from "./randomizer.js";

import {
  GamiqScore
} from "./score.js";

import {
  GamiqResults
} from "./results.js";

import {
  GamiqAnalytics
} from "./analytics.js";

import {
  createReflexGames,
  runReflexGame
} from "./games/reflex.js";

import {
  createPuzzleGames,
  runPuzzleGame
} from "./games/puzzle.js";

import {
  createMemoryGames,
  runMemoryGame
} from "./games/memory.js";

import {
  createThreeGames,
  runThreeGame
} from "./games/three-games.js";


/* ==========================================
APP STATE
========================================== */

const scoreEngine =
  new GamiqScore();

const randomizer =
  new GamiqRandomizer();

const analytics =
  new GamiqAnalytics();

let feedController =
  null;

let activeCleanup =
  null;

let activeSafetyTimer =
  null;

let activeRunToken =
  0;

let currentFinished =
  false;

let currentGame =
  null;

let previousGame =
  null;

let started =
  false;


/* ==========================================
GAME POOL
========================================== */

const gamePool = [
  ...createReflexGames(),
  ...createPuzzleGames(),
  ...createMemoryGames(),
  ...createThreeGames()
];


/* ==========================================
BOOT
========================================== */

document.addEventListener(
  "DOMContentLoaded",
  boot
);


function boot() {
  const mount =
    getOrCreateMount();

  mount.innerHTML =
    createAppMarkup();


  const feedElement =
    mount.querySelector(
      "[data-gamiq-feed]"
    );

  const currentCard =
    mount.querySelector(
      "[data-feed-current]"
    );

  const nextCard =
    mount.querySelector(
      "[data-feed-next]"
    );

  const startButton =
    mount.querySelector(
      "[data-gamiq-start]"
    );

  const startScreen =
    mount.querySelector(
      "[data-start-screen]"
    );

  const resultsButton =
    mount.querySelector(
      "[data-open-results]"
    );


  const results =
    new GamiqResults({
      scoreEngine,

      onContinue: () => {
        analytics.resultsContinue(
          scoreEngine.getSummary()
        );
      }
    });


  feedController =
    new GamiqFeed({
      feed:
        feedElement,

      currentCard,

      nextCard,

      getNextGame:
        getNextGame,

      renderCard:
        renderGameCard,

      onGameEnter:
        enterGame,

      canAdvance:
        () =>
          currentFinished
    });


  startButton.addEventListener(
    "click",
    () => {
      if (started) {
        return;
      }

      started = true;

      startScreen.classList.add(
        "hidden"
      );

      analytics.gameStart({
        source:
          "start_screen"
      });

      feedController.start();

      updateLiveStatus();
    }
  );


  resultsButton.addEventListener(
    "click",
    () => {
      analytics.resultsOpen(
        scoreEngine.getSummary()
      );

      results.show();
    }
  );


  updateLiveStatus();
}


/* ==========================================
MOUNT
========================================== */

function getOrCreateMount() {
  let mount =
    document.querySelector(
      "#gamiq-app"
    );

  if (mount) {
    return mount;
  }

  mount =
    document.createElement(
      "div"
    );

  mount.id =
    "gamiq-app";

  document.body.appendChild(
    mount
  );

  return mount;
}


/* ==========================================
APP HTML
========================================== */

function createAppMarkup() {
  return `
    <div class="gamiq-v2">

      <header class="gamiq-live-header">

        <div class="gamiq-live-brand">

          <strong>
            GAMIQ
          </strong>

          <span>
            GAME IQ
          </span>

        </div>

        <div class="gamiq-live-data">

          <div class="gamiq-live-item">

            <span>
              GAMIQ
            </span>

            <strong
              data-live-gamiq
            >
              ---
            </strong>

          </div>

          <div class="gamiq-live-item">

            <span>
              CONFIDENCE
            </span>

            <strong
              data-live-confidence
            >
              0%
            </strong>

          </div>

          <button
            type="button"
            class="gamiq-results-button"
            data-open-results
          >
            GAMIQを確認
          </button>

        </div>

      </header>

      <main
        class="gamiq-feed"
        data-gamiq-feed
      >

        <section
          class="gamiq-feed-card current"
          data-feed-current
        ></section>

        <section
          class="gamiq-feed-card next"
          data-feed-next
        ></section>

      </main>

      <div
        class="gamiq-start-screen"
        data-start-screen
      >

        <div class="gamiq-start-inner">

          <div class="gamiq-start-logo">
            GAMIQ
          </div>

          <div class="gamiq-start-sub">
            GAME + IQ
          </div>

          <h1>
            未知のゲームで、<br>
            本当のゲーム力を測れ。
          </h1>

          <p>
            次々に現れるランダムゲームをプレイ。
            <br>
            遊ぶほどGAMIQの測定精度が上がります。
          </p>

          <button
            type="button"
            class="gamiq-start-button"
            data-gamiq-start
          >
            START
          </button>

          <small>
            ゲームは選べません。
            何が出るかはランダムです。
          </small>

        </div>

      </div>

    </div>
  `;
}


/* ==========================================
RANDOM GAME
========================================== */

function getNextGame() {
  return randomizer.pick(
    gamePool,
    scoreEngine.getAbilityCounts()
  );
}


/* ==========================================
CARD RENDER
========================================== */

function renderGameCard(
  card,
  game,
  preview = false
) {
  if (
    !card ||
    !game
  ) {
    return;
  }

  card.dataset.gameId =
    game.id;

  card.innerHTML = `
    <div class="gamiq-game-shell">

      <div class="gamiq-game-top">

        <div>

          <span class="gamiq-game-skill">
            ${escapeHtml(
              game.skill
            )}
          </span>

          <h2>
            ${escapeHtml(
              game.title
            )}
          </h2>

        </div>

        <div class="gamiq-game-type">
          ${escapeHtml(
            game.theme || ""
          )}
        </div>

      </div>

      <div
        class="gamiq-game-host"
        data-game-host
      ></div>

      <div
        class="gamiq-rule-overlay"
        data-rule-overlay
      >

        <span>
          RULE
        </span>

        <strong>
          ${escapeHtml(
            game.rule
          )}
        </strong>

      </div>

      <div
        class="gamiq-card-complete"
        data-card-complete
      >

        <div class="gamiq-complete-label">
          COMPLETE
        </div>

        <div
          class="gamiq-complete-score"
          data-complete-score
        >
          0
        </div>

        <div class="gamiq-complete-skill">
          ${escapeHtml(
            game.skill
          )}
        </div>

        <div class="gamiq-swipe-next">
          ↑ SWIPE FOR NEXT GAME
        </div>

      </div>

    </div>
  `;

  if (preview) {
    card.classList.add(
      "preview"
    );
  } else {
    card.classList.remove(
      "preview"
    );
  }
}


/* ==========================================
GAME ENTER
========================================== */

async function enterGame(
  game,
  card
) {
  if (
    !game ||
    !card
  ) {
    return;
  }

  const runToken =
    ++activeRunToken;

  cleanupCurrentGame();

  previousGame =
    currentGame;

  currentGame =
    game;

  currentFinished =
    false;


  if (
    previousGame &&
    previousGame.id !==
      currentGame.id
  ) {
    analytics.feedAdvance({
      fromGame:
        previousGame,

      toGame:
        currentGame,

      played:
        scoreEngine.played
    });
  }


  card.classList.remove(
    "preview"
  );


  const host =
    card.querySelector(
      "[data-game-host]"
    );

  const ruleOverlay =
    card.querySelector(
      "[data-rule-overlay]"
    );

  const completeOverlay =
    card.querySelector(
      "[data-card-complete]"
    );


  if (
    !host ||
    !ruleOverlay
  ) {
    return;
  }


  completeOverlay?.classList.remove(
    "show"
  );

  ruleOverlay.classList.remove(
    "hide"
  );

  host.innerHTML = "";


  /*
   * RULEを読む時間
   * 0.9秒 → 1.8秒に延長
   */

  await wait(1800);


  if (
    runToken !==
    activeRunToken
  ) {
    return;
  }


  ruleOverlay.classList.add(
    "hide"
  );


  analytics.miniGameStart(
    game
  );


  let completed =
    false;


  const onComplete =
    result => {

      if (
        completed ||
        runToken !==
          activeRunToken
      ) {
        return;
      }


      completed =
        true;


      if (
        activeSafetyTimer !==
        null
      ) {
        clearTimeout(
          activeSafetyTimer
        );

        activeSafetyTimer =
          null;
      }


      const score =
        safeScore(
          result?.score
        );


      const adapt =
        safeScore(
          result?.adapt,
          50
        );


      scoreEngine.addResult({
        skill:
          game.skill,

        score,

        adapt
      });


      currentFinished =
        true;


      const summary =
        scoreEngine.getSummary();


      analytics.miniGameComplete({
        game,

        score,

        adapt,

        summary
      });


      updateLiveStatus();


      showCardComplete(
        card,
        score
      );
    };


  /*
   * SAFETY ONLY
   *
   * 45秒経ってもゲームが終了しない場合だけ
   * バグ回避として強制終了。
   *
   * 通常のゲーム終了条件には使わない。
   */

  activeSafetyTimer =
    setTimeout(
      () => {

        if (
          completed ||
          runToken !==
            activeRunToken
        ) {
          return;
        }


        console.warn(
          "Safety timeout:",
          game.id
        );


        onComplete({
          score:
            0,

          adapt:
            25,

          meta: {
            safetyTimeout:
              true
          }
        });

      },
      45000
    );


  /*
   * GAME START
   */

  try {
    const runnerResult =
      runSelectedGame({
        game,
        container:
          host,
        onComplete
      });


    const cleanup =
      await Promise.resolve(
        runnerResult
      );


    if (
      runToken !==
      activeRunToken
    ) {
      if (
        typeof cleanup ===
        "function"
      ) {
        cleanup();
      }

      return;
    }


    activeCleanup =
      typeof cleanup ===
      "function"
        ? cleanup
        : null;

  } catch (error) {

    console.error(
      "Game start failed:",
      error
    );


    analytics.error({
      area:
        game.id,

      message:
        error?.message ||
        String(error)
    });


    if (
      activeSafetyTimer !==
      null
    ) {
      clearTimeout(
        activeSafetyTimer
      );

      activeSafetyTimer =
        null;
    }


    currentFinished =
      true;


    host.innerHTML = `
      <div class="gamiq-game-error">

        <strong>
          GAME ERROR
        </strong>

        <span>
          次のゲームへ進んでください
        </span>

      </div>
    `;


    showCardComplete(
      card,
      null,
      true
    );
  }
}


/* ==========================================
GAME ROUTER
========================================== */

function runSelectedGame({
  game,
  container,
  onComplete
}) {
  const reflexTypes =
    new Set([
      "ninja_counter",
      "quick_draw",
      "lane_panic",
      "friend_foe"
    ]);


  const puzzleTypes =
    new Set([
      "block_escape",
      "pipe_connect",
      "laser_mirror"
    ]);


  const memoryTypes =
    new Set([
      "memory_sequence",
      "memory_positions",
      "memory_numbers"
    ]);


  const threeTypes =
    new Set([
      "zombie_assault",
      "space_blaster",
      "lane_dodge",
      "factory_rush"
    ]);


  if (
    reflexTypes.has(
      game.type
    )
  ) {
    return runReflexGame({
      game,
      container,
      onComplete
    });
  }


  if (
    puzzleTypes.has(
      game.type
    )
  ) {
    return runPuzzleGame({
      game,
      container,
      onComplete
    });
  }


  if (
    memoryTypes.has(
      game.type
    )
  ) {
    return runMemoryGame({
      game,
      container,
      onComplete
    });
  }


  if (
    threeTypes.has(
      game.type
    )
  ) {
    return runThreeGame({
      game,
      container,
      onComplete
    });
  }


  throw new Error(
    `Unknown game type: ${game.type}`
  );
}


/* ==========================================
COMPLETE DISPLAY
========================================== */

function showCardComplete(
  card,
  score,
  error = false
) {
  const overlay =
    card.querySelector(
      "[data-card-complete]"
    );

  const scoreElement =
    card.querySelector(
      "[data-complete-score]"
    );

  if (!overlay) {
    return;
  }

  if (scoreElement) {
    scoreElement.textContent =
      error
        ? "!"
        : score ?? "--";
  }

  overlay.classList.toggle(
    "error",
    error
  );

  requestAnimationFrame(
    () => {
      overlay.classList.add(
        "show"
      );
    }
  );
}


/* ==========================================
LIVE GAMIQ
========================================== */

function updateLiveStatus() {
  const summary =
    scoreEngine.getSummary();

  const gamiqElement =
    document.querySelector(
      "[data-live-gamiq]"
    );

  const confidenceElement =
    document.querySelector(
      "[data-live-confidence]"
    );

  if (gamiqElement) {
    gamiqElement.textContent =
      summary.gamiq ??
      "---";
  }

  if (
    confidenceElement
  ) {
    confidenceElement.textContent =
      `${summary.confidence}%`;
  }
}


/* ==========================================
CLEANUP
========================================== */

function cleanupCurrentGame() {

  if (
    activeSafetyTimer !==
    null
  ) {
    clearTimeout(
      activeSafetyTimer
    );

    activeSafetyTimer =
      null;
  }


  if (
    typeof activeCleanup ===
    "function"
  ) {
    try {
      activeCleanup();
    } catch (error) {
      console.warn(
        "Game cleanup failed:",
        error
      );
    }
  }


  activeCleanup =
    null;
}


/* ==========================================
UTIL
========================================== */

function safeScore(
  value,
  fallback = 0
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return fallback;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        numeric
      )
    )
  );
}


function wait(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}


function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


/* ==========================================
PAGE CLEANUP
========================================== */

window.addEventListener(
  "beforeunload",
  () => {

    cleanupCurrentGame();

    feedController?.destroy();

  }
);
