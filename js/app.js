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

import {
  t
} from "./i18n.js";


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
      // A案: results cannot be opened while a game is being played.
      if (resultsButton.disabled) {
        return;
      }

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
          <strong>GAMIQ</strong>
          <span>GAME IQ</span>
        </div>

        <div class="gamiq-live-data">

          <div class="gamiq-live-item">
            <span>GAMIQ</span>
            <strong data-live-gamiq>---</strong>
          </div>

          <div class="gamiq-live-item">
            <span>CONFIDENCE</span>
            <strong data-live-confidence>0%</strong>
          </div>

          <button
            type="button"
            class="gamiq-results-button"
            data-open-results
          >
            ${t("header.viewResults")}
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

          <div class="gamiq-start-logo">GAMIQ</div>

          <div class="gamiq-start-sub">GAME + IQ</div>

          <h1>
            ${t("start.title")}
          </h1>

          <p>
            ${t("start.text")}
          </p>

          <button
            type="button"
            class="gamiq-start-button"
            data-gamiq-start
          >
            ${t("start.play")}
          </button>

          <small>
            ${t("start.note")}
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
          ${t("card.rule")}
        </span>

        <strong>
          ${escapeHtml(
            t(
              `rule.${game.id}`,
              null,
              game.rule
            )
          )}
        </strong>

      </div>

      <div
        class="gamiq-card-complete"
        data-card-complete
      >

        <div class="gamiq-complete-label">
          ${t("card.complete")}
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
          ${
            isDesktopPointer()
              ? t("card.nextScroll")
              : t("card.nextSwipe")
          }
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

  // Rule screen: results can still be opened.
  setResultsLocked(false);


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

  // If the results screen is open, wait until it is closed
  // so the game does not start behind it.
  while (
    isResultsOpen() &&
    runToken === activeRunToken
  ) {
    await wait(150);
  }


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

  // Playing: lock the results button.
  setResultsLocked(true);


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

      setResultsLocked(false);


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
            game.maxDuration ?? 90000
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

    setResultsLocked(false);


    host.innerHTML = `
      <div class="gamiq-game-error">

        <strong>
          ${t("card.error")}
        </strong>

                <span>
          ${
            isDesktopPointer()
              ? t("card.errorScroll")
              : t("card.errorSwipe")
          }
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

function isDesktopPointer() {
  return window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  ).matches;
}

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


function setResultsLocked(locked) {
  const button =
    document.querySelector(
      "[data-open-results]"
    );

  if (!button) {
    return;
  }

  button.disabled =
    locked;

  button.setAttribute(
    "aria-disabled",
    String(locked)
  );
}


function isResultsOpen() {
  return Boolean(
    document.querySelector(
      ".gamiq-results-overlay.show"
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
