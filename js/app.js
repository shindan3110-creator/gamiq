// GAMIQ（ゲーミック） v2 - App Core

import {
  IS_CRAZYGAMES
} from "./platform.js";

import {
  tapFx,
  celebrate,
  initJuice,
  ruleTimer,
  goFx
} from "./juice.js";

import { initRails } from "./adslots.js";

initJuice();

initRails();

import {
  GamiqFeed
} from "./feed.js";

import {
  GamiqRandomizer
} from "./randomizer.js";

import {
  GamiqScore,
  GAMES_PER_LEVEL
} from "./score.js";

import {
  GamiqResults
} from "./results.js";

import {
  GamiqAnalytics,
  track
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
  createStopwatchGames,
  runStopwatchGame
} from "./games/stopwatch.js";

import {
  createEggGames,
  runEggGame
} from "./games/egg.js";

import {
  createCardMatchGames,
  runCardMatchGame
} from "./games/cardmatch.js";

import {
  createCircleGames,
  runCircleGame
} from "./games/circle.js";

import {
  createPkGames,
  runPkGame
} from "./games/pk.js";

import {
  createDarumaGames,
  runDarumaGame
} from "./games/daruma.js";

import {
  createSortGames,
  runSortGame
} from "./games/sort.js";

import {
  createBasketGames,
  runBasketGame
} from "./games/basket.js";

import {
  createColorMixGames,
  runColorMixGame
} from "./games/colormix.js";

import {
  createBeatSwipeGames,
  runBeatSwipeGame
} from "./games/beatswipe.js";

import {
  t,
  LANG
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
  isSoloLink,
  soloMedal,
  soloDetail,
  soloUrl,
  shareSoloImage,
  postSoloOnX
} from "./solo.js";

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
  ...createOddOneGames(),
  ...createStopwatchGames(),
  ...createEggGames(),
  ...createCardMatchGames(),
  ...createCircleGames(),
  ...createPkGames(),
  ...createDarumaGames(),
  ...createSortGames(),
  ...createBasketGames(),
  ...createColorMixGames(),
  ...createBeatSwipeGames()
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

      // Playing: lock the page (the text below the start screen is hidden)
      document.documentElement.classList.add("gq-playing");
      window.scrollTo(0, 0);

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

  // SOLO CHALLENGE: no name screen, the game starts right away.
  if (isSoloLink() && getStartGame()) {
    document.documentElement.classList.add("gq-solo-mode");
    startButton.click();
  }
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
                : `<a href="/about?lang=${LANG}">About</a>
                   <a href="/privacy?lang=${LANG}">Privacy</a>
                   <a href="/contact?lang=${LANG}">Contact</a>`
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


/*
 * START LINK  (?start=pk)
 * A link can choose the FIRST game, e.g. from a promo video:
 *   https://playgamiq.com/?start=pk
 * After that game everything is random as usual.
 * The full game id works too (?start=reflex_pk_keeper).
 */
const START_ALIASES = {
  bullseye: "aim_bullseye",
  hoop: "aim_hoop_shot",
  beat: "speed_beat_swipe",
  cards: "memory_card_match",
  circle: "aim_perfect_circle",
  colormix: "memory_color_mix",
  cups: "memory_cup_shuffle",
  redlight: "reflex_daruma",
  egg: "speed_egg_smash",
  flash: "memory_sequence",
  ghost: "memory_positions",
  number: "memory_numbers",
  odd: "logic_odd_one_out",
  pk: "reflex_pk_keeper",
  block: "puzzle_block_escape",
  pipe: "puzzle_pipe_connect",
  ninja: "reflex_ninja_counter",
  draw: "reflex_quick_draw",
  lane: "reflex_lane_panic",
  foe: "reflex_friend_foe",
  drum: "rhythm_drum_duo",
  sort: "speed_sort_rush",
  color: "speed_color_switch",
  spot: "spot_difference",
  stop: "reflex_blind_stop",
  zombie: "three_zombie_assault",
  space: "three_space_blaster",
  rush: "three_lane_dodge",
  army: "three_factory_rush",
  tower: "aim_tower_stack"
};

function getStartGame() {
  try {
    const raw = (
      new URLSearchParams(window.location.search).get("start") || ""
    ).trim().toLowerCase();

    if (!raw) {
      return null;
    }

    const id = START_ALIASES[raw] || raw;

    return gamePool.find(game => game.id === id) || null;
  } catch (error) {
    return null;
  }
}

// SOLO CHALLENGE (?start=pk&solo=1): the first game only, once.
let soloUsed = false;

function startKeyFor(game) {
  const key =
    Object.keys(START_ALIASES).find(k => START_ALIASES[k] === game.id);
  return key || game.id;
}

function getNextGame() {
  if (!firstPickDone) {
    firstPickDone = true;

    const startGame = getStartGame();

    if (startGame) {
      // pick() from a pool of one = this game, saved in the history.
      return randomizer.pick([startGame], scoreEngine.getAbilityCounts());
    }

    if (scoreEngine.played === 0) {
      const showcase =
        gamePool.filter(game => SHOWCASE_IDS.includes(game.id));

      if (showcase.length) {
        return randomizer.pick(showcase, scoreEngine.getAbilityCounts());
      }
    }
  }

  // After 25 games in a level, only the genres that still
  // need games (5 each) are picked.
  const onlySkills =
    scoreEngine.levelPlayed >= GAMES_PER_LEVEL
      ? scoreEngine.getMissingSkills()
      : [];

  return randomizer.pick(
    gamePool,
    scoreEngine.getAbilityCounts(),
    onlySkills
  );
}


/* ==========================================
LEVEL UP: AUTO NEXT
After a level up the next game starts by itself
after a short countdown (swipe = start right away).
Stops if the player opens the results or ranking.
========================================== */

const LEVELUP_AUTO_SECONDS = 3;

function startLevelUpAutoNext(card) {
  const label =
    card.querySelector("[data-levelup-auto]");

  let left = LEVELUP_AUTO_SECONDS;

  // The game this level up belongs to.
  const token = activeRunToken;

  const panelOpen = () =>
    !!document.querySelector(
      ".gamiq-results-overlay.show, .gamiq-ranking-overlay.show"
    );

  const tick = () => {
    // Already moved on (swiped), or the card is gone.
    if (
      !feedController ||
      feedController.currentCard !== card ||
      !card.isConnected ||
      activeRunToken !== token
    ) {
      return;
    }

    // Results / ranking open: wait, do not jump away.
    if (panelOpen()) {
      if (label) label.textContent = "";
      return;
    }

    if (left <= 0) {
      if (label) label.textContent = "";
      feedController.advance();
      return;
    }

    if (label) {
      label.textContent = t("levelup.auto", { n: left });
    }

    left--;
    setTimeout(tick, 1000);
  };

  // Let the jingle and the count-up play first.
  setTimeout(tick, 900);
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

  // Solo challenge: only the very first game of a ?solo=1 link
  const isSolo =
    !soloUsed &&
    isSoloLink() &&
    game.id === getStartGame()?.id;

  if (isSolo) {
    soloUsed = true;
  }

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

  // The very first game of this visit gets a bigger "GO!"
  const firstGame =
    scoreEngine.played === 0 &&
    !previousGame;

  ruleTimer(ruleOverlay, 1800);


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

  goFx(card, firstGame);


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

      // SOLO CHALLENGE: own result card, not added to today's record.
      if (isSolo && !safetyTimeout) {
        currentFinished = true;
        setResultsLocked(false);

        sfx(success ? "clear" : "fail");

        track("solo_complete", {
          game_id: game.id,
          game_score: score
        });

        showSoloResult(card, game, score, result?.meta);
        return;
      }

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

        // Keep the flow going: the next game starts by itself.
        startLevelUpAutoNext(card);
      }


      /*
       * AD BREAK (does nothing yet, see ads.js)
       * - Level up: always ask.
       * - Normal game end: only after Lv1 is cleared today,
       *   so new players are never interrupted early.
       *   The ad SDK itself limits how often ads really show.
       */
      // No ad on level up: that moment must not stop the flow.
      if (!levelUp && summary.levelHistory.length > 0) {
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
          // Solo challenge: always Lv1, so everybody plays the same game.
          level: isSolo ? 1 : scoreEngine.level
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


  if (game.type === "beat_swipe") {
    return runBeatSwipeGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "color_mix") {
    return runColorMixGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "hoop_shot") {
    return runBasketGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "sort_rush") {
    return runSortGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "daruma") {
    return runDarumaGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "pk_keeper") {
    return runPkGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "perfect_circle") {
    return runCircleGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "card_match") {
    return runCardMatchGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "egg_smash") {
    return runEggGame({
      game,
      container,
      onComplete
    });
  }


  if (game.type === "blind_stop") {
    return runStopwatchGame({
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
        <span class="gamiq-levelup-auto" data-levelup-auto></span>
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
SOLO CHALLENGE RESULT
========================================== */

function showSoloResult(card, game, score, meta) {
  const overlay =
    card.querySelector("[data-card-complete]");

  if (!overlay) {
    return;
  }

  const medal = soloMedal(score);
  const detail = soloDetail(game, meta);
  const data = {
    game,
    score,
    medal,
    detail,
    url: soloUrl(startKeyFor(game))
  };

  overlay.classList.add("gq-solo-done");
  overlay.innerHTML = `
    <div class="gq-solo" data-solo>
      <div class="gq-solo-game">${escapeHtml(game.title)}</div>
      <div class="gq-solo-score">${score}<span>${escapeHtml(t("solo.pts"))}</span></div>
      <div class="gq-solo-medal ${medal}">${escapeHtml(t(`solo.medal.${medal}`))}</div>
      ${detail ? `<div class="gq-solo-detail">${escapeHtml(detail)}</div>` : ""}
      <div class="gq-solo-skill">${escapeHtml(t("solo.skillLine", { skill: game.skill, name: t(`skillName.${game.skill}`) }))}</div>
      <div class="gq-solo-ask">${escapeHtml(t("solo.shareLine2"))}</div>
      <div class="gq-solo-row">
        <button type="button" class="gq-solo-btn share" data-solo-image>📸 ${escapeHtml(t("solo.shareImage"))}</button>
        <button type="button" class="gq-solo-btn x" data-solo-x>𝕏 ${escapeHtml(t("solo.postX"))}</button>
      </div>
      <button type="button" class="gq-solo-btn sub" data-solo-retry>↻ ${escapeHtml(t("solo.retry"))}</button>
      <button type="button" class="gq-solo-btn main" data-solo-more>
        🧠 ${escapeHtml(t("solo.more"))}
        <small>${escapeHtml(t("solo.moreSub"))}</small>
      </button>
      <div class="gq-solo-note" data-solo-note></div>
    </div>
  `;

  const panel = overlay.querySelector("[data-solo]");
  const note = overlay.querySelector("[data-solo-note]");

  // Taps on the buttons must not start a swipe.
  panel.addEventListener("pointerdown", event => event.stopPropagation());

  overlay.querySelector("[data-solo-image]").addEventListener("click", async () => {
    track("solo_share", { game_id: game.id, share_method: "image" });
    const res = await shareSoloImage(data);
    if (res === "downloaded") note.textContent = t("solo.saved");
  });

  overlay.querySelector("[data-solo-x]").addEventListener("click", () => {
    track("solo_share", { game_id: game.id, share_method: "x" });
    postSoloOnX(data);
  });

  overlay.querySelector("[data-solo-retry]").addEventListener("click", () => {
    track("solo_retry", { game_id: game.id });
    window.location.reload();
  });

  overlay.querySelector("[data-solo-more]").addEventListener("click", () => {
    track("solo_more", { game_id: game.id });
    document.documentElement.classList.remove("gq-solo-mode");
    feedController?.advance();
  });

  requestAnimationFrame(() => {
    overlay.classList.add("show");
  });
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
