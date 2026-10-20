// GAMIQ（ゲーミック） v2 - App Core

import {
  IS_CRAZYGAMES
} from "./platform.js";

import {
  tapFx,
  celebrate,
  initJuice
} from "./juice.js";

initJuice();

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
  createSpeedGames,
  runSpeedGame
} from "./games/speed.js";

import {
  createAimGames,
  runAimGame
} from "./games/aim.js";

import {
  createRhythmGames,
  runRhythmGame
} from "./games/rhythm.js";

import {
  createSpotGames,
  runSpotGame
} from "./games/spot.js";

import {
  createCupGames,
  runCupGame
} from "./games/cups.js";

import {
  createTowerGames,
  runTowerGame
} from "./games/tower.js";

import {
  GamiqDaily,
  dailyStatus
} from "./daily.js";

import {
  createOddOneGames,
  runOddOneGame
} from "./games/oddone.js";

import {
  t
} from "./i18n.js";

import {
  requestBreakAd,
  isAdRunning
} from "./ads.js";

import {
  submitBestScore
} from "./api.js";

import {
  initSound,
  sfx,
  isMuted,
  toggleMuted
} from "./sound.js";

import {
  GamiqRanking
} from "./ranking.js";

import {
  titleFor
} from "./share.js";

import {
  getProfile,
  saveNickname,
  suggestNickname,
  NICKNAME_MAX
} from "./profile.js";


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

// Games finished in this visit (lifetime count is in scoreEngine).
let sessionGames =
  0;


/* ==========================================
GAME POOL
========================================== */

const gamePool = [
  ...createReflexGames(),
  ...createPuzzleGames(),
  ...createMemoryGames(),
  ...createThreeGames(),
  ...createSpeedGames(),
  ...createAimGames(),
  ...createRhythmGames(),
  ...createSpotGames(),
  ...createCupGames(),
  ...createTowerGames(),
  ...createOddOneGames()
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


  const ranking =
    new GamiqRanking();

  const results =
    new GamiqResults({
      scoreEngine,
      onRanking: () => {
        ranking.show("daily");
      },

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

      // No swiping while a game is playing or an ad is running.
      canAdvance:
        () =>
          currentFinished &&
          !isAdRunning()
    });


  /*
   * NICKNAME
   * Saved name is filled in. First time: a random name is
   * suggested so the player can press PLAY right away.
   */
  const nicknameForm =
    mount.querySelector("[data-nickname-form]");

  const nicknameInput =
    mount.querySelector("[data-nickname-input]");

  const nicknameError =
    mount.querySelector("[data-nickname-error]");

  nicknameInput.value =
    getProfile().nickname || suggestNickname();

  nicknameInput.addEventListener("input", () => {
    nicknameError.textContent = "";
    nicknameForm.classList.remove("invalid");
  });

  /*
   * SOUND
   * Starts after the first tap (browser rule).
   * The speaker button turns it ON / OFF.
   */
  initSound();

  const soundButton =
    mount.querySelector("[data-sound-toggle]");

  const renderSoundButton = () => {
    const off = isMuted();

    soundButton.textContent = off ? "🔇" : "🔊";
    soundButton.classList.toggle("off", off);
    soundButton.setAttribute("aria-pressed", String(!off));
  };

  renderSoundButton();

  soundButton.addEventListener("click", () => {
    toggleMuted();
    renderSoundButton();
    sfx("click");
  });

  /*
   * DAILY CHALLENGE (same 5 games for everyone, once a day)
   * Opens on top of the start screen. Does not change GAMIQ / level.
   */
  const dailyButton =
    mount.querySelector("[data-start-daily]");

  const renderDailyButton = () => {
    const status = dailyStatus();

    dailyButton.classList.toggle("done", status.done);

    dailyButton.innerHTML =
      status.done
        ? t("daily.buttonDone", { total: status.total })
        : status.played > 0
          ? t("daily.buttonResume", { i: status.played + 1, n: 5 })
          : t("daily.button", { n: status.number });
  };

  renderDailyButton();

  const daily =
    new GamiqDaily({
      mount: mount.querySelector(".gamiq-v2"),
      pool: gamePool,
      renderCard: renderGameCard,
      runGame: runSelectedGame,
      analytics,
      onClose: renderDailyButton,
      onRanking: () => ranking.show("challenge")
    });

  dailyButton.addEventListener("click", () => {
    if (started) {
      return;
    }

    // The nickname is needed for the Daily Challenge ranking too.
    const savedName =
      saveNickname(nicknameInput.value);

    if (!savedName.ok) {
      nicknameError.textContent = t(savedName.error);
      nicknameForm.classList.add("invalid");
      nicknameInput.focus();
      return;
    }

    nicknameInput.value = savedName.value;
    nicknameInput.blur();

    sfx("click");
    daily.open();
  });

  // Ranking from the start screen
  mount
    .querySelector("[data-start-ranking]")
    .addEventListener("click", () => {
      ranking.show("daily");
    });

  // Enter key = PLAY
  nicknameForm.addEventListener("submit", event => {
    event.preventDefault();
    startButton.click();
  });


  startButton.addEventListener(
    "click",
    () => {
      if (started) {
        return;
      }

      const saved =
        saveNickname(nicknameInput.value);

      if (!saved.ok) {
        nicknameError.textContent = t(saved.error);
        nicknameForm.classList.add("invalid");
        nicknameInput.focus();
        return;
      }

      nicknameInput.value = saved.value;
      nicknameInput.blur();

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

          <div class="gamiq-live-item gamiq-live-level">
            <span>${t("header.level")}</span>
            <strong data-live-level>1</strong>
          </div>

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
            class="gamiq-sound-button"
            data-sound-toggle
            aria-label="Sound"
          ></button>

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

          <form
            class="gamiq-nickname"
            data-nickname-form
            novalidate
          >
            <label for="gamiq-nickname-input">
              ${t("nick.label")}
            </label>

            <input
              id="gamiq-nickname-input"
              type="text"
              data-nickname-input
              maxlength="${NICKNAME_MAX * 2}"
              autocomplete="nickname"
              autocapitalize="off"
              spellcheck="false"
              enterkeyhint="go"
              placeholder="${t("nick.placeholder")}"
            >

            <small
              class="gamiq-nickname-error"
              data-nickname-error
              aria-live="polite"
            ></small>
          </form>

          <button
            type="button"
            class="gamiq-start-button"
            data-gamiq-start
          >
            ${t("start.play")}
          </button>

          <button
            type="button"
            class="gamiq-start-daily"
            data-start-daily
          ></button>

          <button
            type="button"
            class="gamiq-start-ranking"
            data-start-ranking
          >
            🏆 ${t("rank.title")}
          </button>

          <small>
            ${t("start.note")}
          </small>

          <nav class="gamiq-start-links" aria-label="Site information">
            ${
              IS_CRAZYGAMES
                // CrazyGames: only the privacy policy (no links to other sites with the game)
                ? `<a href="./privacy.html" target="_blank" rel="noopener">Privacy</a>`
                : `<a href="./about.html">About</a>
                   <a href="./privacy.html">Privacy</a>
                   <a href="./contact.html">Contact</a>`
            }
          </nav>

        </div>
      </div>

    </div>
  `;
}


/* ==========================================
RANDOM GAME
========================================== */


// Very first game for a new player: one of the flashiest games,
// so the first few seconds look good. After that: fully random.
const SHOWCASE_IDS = [
  "reflex_quick_draw",
  "reflex_ninja_counter",
  "aim_tower_stack"
];

let firstPickDone = false;

function getNextGame() {
  if (!firstPickDone) {
    firstPickDone = true;

    if (scoreEngine.played === 0) {
      const showcase =
        gamePool.filter(game => SHOWCASE_IDS.includes(game.id));

      if (showcase.length) {
        return randomizer.pick(showcase, scoreEngine.getAbilityCounts());
      }
    }
  }

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

  // Genre color for the card frame (see STEP 45 in styles.css)
  card.dataset.skill =
    game.skill;

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

        <div
          class="gamiq-levelup"
          data-levelup
          hidden
        ></div>

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

  // Ring effect where the player taps (all games)
  tapFx(host);


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

  const gameStartedAt =
    performance.now();


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


      const playMs =
        performance.now() -
        gameStartedAt;


      const safetyTimeout =
        result?.meta?.safetyTimeout === true;


      /*
       * CLEAR / FAIL
       * Games that report meta.success use it.
       * Other games count as a clear at 60 points or more.
       */

      const success =
        typeof result?.meta?.success ===
          "boolean"
          ? result.meta.success
          : score >= 60;


      /*
       * A safety timeout means a bug, not the player's skill.
       * It is not added to GAMIQ.
       */

      let levelUp = null;

      if (!safetyTimeout) {
        levelUp = scoreEngine.addResult({
          skill:
            game.skill,

          score,

          adapt,

          success,

          durationMs:
            playMs
        });

        sessionGames++;
      }


      currentFinished =
        true;

      setResultsLocked(false);


      const summary =
        scoreEngine.getSummary();


      analytics.miniGameComplete({
        game,

        score,

        adapt,

        summary,

        success,

        playSeconds:
          playMs / 1000,

        sessionGames,

        safetyTimeout
      });


      updateLiveStatus();


      // Send today's best score to the ranking (only if it improved).
      if (!safetyTimeout) {
        submitBestScore(summary);
      }


      showCardComplete(
        card,
        safetyTimeout
          ? null
          : score,
        safetyTimeout,
        levelUp
      );


      // Jingle: level up > clear > fail
      if (!safetyTimeout) {
        sfx(levelUp ? "levelUp" : success ? "clear" : "fail");
      }

      if (levelUp) {
        analytics.levelUp({
          ...levelUp,
          played: summary.played
        });
      }


      /*
       * AD BREAK (does nothing yet, see ads.js)
       * - Level up: always ask.
       * - Normal game end: only after Lv1 is cleared today,
       *   so new players are never interrupted early.
       *   The ad SDK itself limits how often ads really show.
       */
      if (levelUp) {
        requestBreakAd("level_up");
      } else if (summary.levelHistory.length > 0) {
        requestBreakAd("game_end");
      }
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
        // The current level is passed to the game for its difficulty.
        game: {
          ...game,
          level: scoreEngine.level
        },
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


  const speedTypes =
    new Set([
      "color_switch"
    ]);


  const aimTypes =
    new Set([
      "bullseye"
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


  if (
    speedTypes.has(
      game.type
    )
  ) {
    return runSpeedGame({
      game,
      container,
      onComplete
    });
  }


  if (
    aimTypes.has(
      game.type
    )
  ) {
    return runAimGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "odd_one_out") {
    return runOddOneGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "tower_stack") {
    return runTowerGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "cup_shuffle") {
    return runCupGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "spot_difference") {
    return runSpotGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "drum_duo") {
    return runRhythmGame({
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
  error = false,
  levelUp = null
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

  // Count-up + rating word + particles
  if (!error && Number.isFinite(score)) {
    celebrate(card, score);
  }


  // LEVEL UP banner
  const levelUpElement =
    card.querySelector(
      "[data-levelup]"
    );

  if (levelUpElement) {
    if (levelUp) {
      levelUpElement.innerHTML = `
        <span class="gamiq-levelup-title">
          ${escapeHtml(t("levelup.title", { level: levelUp.level }))}
        </span>
        <strong class="gamiq-levelup-gamiq">
          GAMIQ ${escapeHtml(levelUp.gamiq ?? "---")}
        </strong>
        ${
          titleFor(levelUp.gamiq)
            ? `<span class="gamiq-levelup-rankname" style="color:${titleFor(levelUp.gamiq).color}">${escapeHtml(titleFor(levelUp.gamiq).name)}</span>`
            : ""
        }
        <span class="gamiq-levelup-next">
          ${escapeHtml(
            levelUp.maxed
              ? t("levelup.max")
              : t("levelup.next", { level: levelUp.nextLevel })
          )}
        </span>
      `;

      levelUpElement.hidden = false;
      overlay.classList.add("has-levelup");

    } else {
      levelUpElement.hidden = true;
      overlay.classList.remove("has-levelup");
    }
  }

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

  const levelElement =
    document.querySelector(
      "[data-live-level]"
    );

  if (levelElement) {
    levelElement.textContent =
      summary.level;
  }

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
  // Results or ranking open = don't start the game behind it.
  return Boolean(
    document.querySelector(
      ".gamiq-results-overlay.show, .gamiq-ranking-overlay.show"
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
