// GAMIQ（ゲーミック） v2 - Results Overlay

import { t } from "./i18n.js";
import { getProfile } from "./profile.js";
import { fetchRanking } from "./api.js";
import { titleFor, rankText, shareResult, createShareButtons, buildShareText, buildShareImage } from "./share.js";
import { track } from "./analytics.js";
import { IS_CRAZYGAMES } from "./platform.js";
import { adBox, fillAds } from "./adslots.js";

export class GamiqResults {
  constructor({
    scoreEngine,
    onContinue = null,
    onRanking = null
  }) {
    this.scoreEngine = scoreEngine;
    this.onContinue = onContinue;
    this.onRanking = onRanking;
    this.overlay = null;

    this.handleEscape =
      this.handleEscape.bind(this);
  }


  create() {
    if (this.overlay) {
      return this.overlay;
    }


    const overlay =
      document.createElement("div");


    overlay.className =
      "gamiq-results-overlay";


    overlay.setAttribute(
      "aria-hidden",
      "true"
    );


    overlay.innerHTML = `
      <div
        class="gamiq-results-card"
        role="dialog"
        aria-modal="true"
        aria-label="${t("results.aria")}"
      >

        <div
          class="gamiq-results-player"
          data-results-player
        ></div>

        <div class="gamiq-results-level">
          <span>${t("results.level")}</span>
          <strong data-results-level>1</strong>
          <em data-results-level-max></em>
        </div>

        <div class="gamiq-results-label">
          ${t("results.current")}
        </div>

        <div
          class="gamiq-results-score"
          data-results-gamiq
        >
          ---
        </div>

        <div class="gamiq-results-badges">
          <span class="gamiq-results-title" data-results-title hidden></span>
          <span class="gamiq-results-rank" data-results-rank hidden></span>
        </div>

        <div class="gamiq-results-confidence">

          <span>
            ${t("results.confidence")}
          </span>

          <strong
            data-results-confidence
          >
            0%
          </strong>

        </div>

        <div class="gamiq-results-confidence-track">

          <div
            class="gamiq-results-confidence-fill"
            data-results-confidence-fill
          ></div>

        </div>


        <div class="gamiq-results-grid">

          <div class="gamiq-result-item">
            <span>REFLEX</span>
            <strong data-result-skill="REFLEX">
              --
            </strong>
          </div>

          <div class="gamiq-result-item">
            <span>SPEED</span>
            <strong data-result-skill="SPEED">
              --
            </strong>
          </div>

          <div class="gamiq-result-item">
            <span>AIM</span>
            <strong data-result-skill="AIM">
              --
            </strong>
          </div>

          <div class="gamiq-result-item">
            <span>LOGIC</span>
            <strong data-result-skill="LOGIC">
              --
            </strong>
          </div>

          <div class="gamiq-result-item">
            <span>MEMORY</span>
            <strong data-result-skill="MEMORY">
              --
            </strong>
          </div>

          <div class="gamiq-result-item">
            <span>ADAPT</span>
            <strong data-result-skill="ADAPT">
              --
            </strong>
          </div>

        </div>


        <div class="gamiq-results-played">

          <span>
            ${t("results.played")}
          </span>

          <strong
            data-results-played
          >
            0
          </strong>

        </div>


        <div class="gamiq-results-stats">

          <div class="gamiq-result-item">
            <span>${t("results.clears")}</span>
            <strong data-results-stat="clears">--</strong>
          </div>

          <div class="gamiq-result-item">
            <span>${t("results.clearRate")}</span>
            <strong data-results-stat="clearRate">--</strong>
          </div>

          <div class="gamiq-result-item">
            <span>${t("results.bestStreak")}</span>
            <strong data-results-stat="bestStreak">--</strong>
          </div>

          <div class="gamiq-result-item">
            <span>${t("results.playTime")}</span>
            <strong data-results-stat="playTime">--</strong>
          </div>

        </div>


        <div
          class="gamiq-results-next"
          data-results-next
        ></div>

        <div class="gamiq-results-history" data-results-history-box hidden>
          <div class="gamiq-results-history-title">
            ${t("results.history")}
          </div>
          <ol data-results-history></ol>
        </div>

        <div class="gamiq-results-reset">
          ${t("results.resetNote")}
        </div>


        <div class="gamiq-results-actions">
          <button
            type="button"
            class="gamiq-results-share"
            data-results-share
          >
            📤 ${t("share.button")}
          </button>

          <button
            type="button"
            class="gamiq-results-ranking"
            data-results-ranking
          >
            🏆 ${t("rank.title")}
          </button>
        </div>

        <div data-results-share-row></div>

        <div class="gamiq-results-share-note" data-results-share-note></div>

        <button
          type="button"
          class="gamiq-results-continue"
          data-results-continue
        >
          ${t("results.continue")}
        </button>

        <div data-results-ad></div>

      </div>
    `;


    document.body.appendChild(
      overlay
    );

    // Ad at the very bottom (away from the buttons). Off until AdSense.
    overlay.querySelector("[data-results-ad]").replaceWith(adBox("results"));


    const continueButton =
      overlay.querySelector(
        "[data-results-continue]"
      );


    overlay
      .querySelector("[data-results-ranking]")
      .addEventListener("click", () => {
        // Close results (without "continue") and open the ranking.
        this.hide();

        if (typeof this.onRanking === "function") {
          this.onRanking();
        }
      });

    // SHARE
    const shareButton =
      overlay.querySelector("[data-results-share]");

    const shareNote =
      overlay.querySelector("[data-results-share-note]");

    // LINE / X / COPY buttons (text + link)
    // CrazyGames: no sharing (links to our own site are not allowed there)
    if (IS_CRAZYGAMES) {
      overlay.querySelector("[data-results-share]")?.remove();
    }

    overlay.querySelector("[data-results-share-row]").replaceWith(IS_CRAZYGAMES ? document.createElement("span") :
      createShareButtons({
        getText: () =>
          buildShareText({
            summary: this.scoreEngine.getSummary(),
            nickname: getProfile().nickname,
            rank: this.lastRankText
          }),
        onShare: method =>
          track("share_result", {
            share_method: method,
            gamiq_score: this.scoreEngine.getSummary().gamiq ?? 0
          })
      })
    );

    shareButton.addEventListener("click", async () => {
      shareButton.disabled = true;
      shareNote.textContent = "";

      const result = await shareResult({
        summary: this.scoreEngine.getSummary(),
        nickname: getProfile().nickname,
        rank: this.lastRankText
      });

      track("share_result", {
        share_method: result,
        gamiq_score: this.scoreEngine.getSummary().gamiq ?? 0
      });

      if (result === "downloaded") {
        shareNote.textContent = t("share.downloaded");
      } else if (result === "failed") {
        shareNote.textContent = t("share.failed");
      }

      shareButton.disabled = false;
    });

    continueButton.addEventListener(
      "click",
      () => {
        this.closeAndContinue();
      }
    );


    overlay.addEventListener(
      "pointerdown",
      event => {

        if (
          event.target === overlay
        ) {
          this.closeAndContinue();
        }

      }
    );


    this.overlay =
      overlay;


    return overlay;
  }


  update() {
    const overlay =
      this.create();


    const summary =
      this.scoreEngine.getSummary();


    const gamiqElement =
      overlay.querySelector(
        "[data-results-gamiq]"
      );


    const confidenceElement =
      overlay.querySelector(
        "[data-results-confidence]"
      );


    const confidenceFill =
      overlay.querySelector(
        "[data-results-confidence-fill]"
      );


    const playedElement =
      overlay.querySelector(
        "[data-results-played]"
      );


    const nextElement =
      overlay.querySelector(
        "[data-results-next]"
      );


    gamiqElement.textContent =
      summary.gamiq ?? "---";

    // TITLE (from GAMIQ)
    const titleElement =
      overlay.querySelector("[data-results-title]");

    const title = titleFor(summary.gamiq);

    titleElement.hidden = !title;

    if (title) {
      titleElement.textContent = title.name;
      titleElement.style.setProperty("--title-color", title.color);
    }

    // TODAY'S RANK (loaded from the server)
    this.loadRank();


    confidenceElement.textContent =
      `${summary.confidence}%`;


    confidenceFill.style.width =
      `${summary.confidence}%`;


    playedElement.textContent =
      summary.played;


    const stats = {
      clears:
        summary.cleared ?? 0,

      clearRate:
        summary.clearRate === null ||
        summary.clearRate === undefined
          ? "--"
          : `${summary.clearRate}%`,

      bestStreak:
        summary.bestStreak ?? 0,

      playTime:
        formatPlayTime(
          summary.totalPlaySeconds ?? 0
        )
    };


    Object.entries(stats).forEach(
      ([name, value]) => {
        const element =
          overlay.querySelector(
            `[data-results-stat="${name}"]`
          );

        if (element) {
          element.textContent =
            value;
        }
      }
    );


    Object.entries(
      summary.abilities
    )
    .forEach(
      ([skill, value]) => {

        const element =
          overlay.querySelector(
            `[data-result-skill="${skill}"]`
          );


        if (!element) {
          return;
        }


        element.textContent =
          value === null
            ? "--"
            : value;
      }
    );


    // PLAYER
    const playerElement =
      overlay.querySelector("[data-results-player]");

    const nickname =
      getProfile().nickname;

    playerElement.textContent =
      nickname ? `PLAYER  ${nickname}` : "";

    playerElement.hidden = !nickname;

    // LEVEL
    overlay.querySelector("[data-results-level]").textContent =
      summary.level;

    overlay.querySelector("[data-results-level-max]").textContent =
      `/ ${summary.maxLevel}`;

    // "N more games to fix your Lv X GAMIQ"
    nextElement.textContent =
      t("results.toLevelUp", {
        games: summary.gamesToLevelUp,
        level: summary.level
      });

    // Today's finished levels
    const historyBox =
      overlay.querySelector("[data-results-history-box]");

    const historyList =
      overlay.querySelector("[data-results-history]");

    historyList.innerHTML =
      summary.levelHistory
        .slice()
        .reverse()
        .slice(0, 10)
        .map(item => `
          <li>
            <span>Lv ${Number(item.level) || "-"}</span>
            <strong>GAMIQ ${Number(item.gamiq) || "---"}</strong>
          </li>
        `)
        .join("");

    historyBox.hidden =
      summary.levelHistory.length === 0;
  }


  async loadRank() {
    const rankElement =
      this.overlay?.querySelector("[data-results-rank]");

    if (!rankElement) {
      return;
    }

    const requestId = (this.rankRequestId = (this.rankRequestId || 0) + 1);

    const data = await fetchRanking("daily");

    if (requestId !== this.rankRequestId) {
      return;
    }

    const text = data.ok ? rankText(data.me, data.total) : null;

    this.lastRankText = text;

    rankElement.hidden = !text;
    rankElement.textContent = text ? `${t("share.today")} ${text}` : "";
  }

  show() {
    const overlay =
      this.create();


    this.update();


    overlay.classList.add(
      "show"
    );


    overlay.setAttribute(
      "aria-hidden",
      "false"
    );


    document.addEventListener(
      "keydown",
      this.handleEscape
    );


    requestAnimationFrame(
      () => {

        overlay
          .querySelector(
            "[data-results-continue]"
          )
          ?.focus();

        fillAds(overlay);

      }
    );
  }


  hide() {
    if (!this.overlay) {
      return;
    }


    this.overlay.classList.remove(
      "show"
    );


    this.overlay.setAttribute(
      "aria-hidden",
      "true"
    );


    document.removeEventListener(
      "keydown",
      this.handleEscape
    );
  }


  closeAndContinue() {
    this.hide();


    if (
      typeof this.onContinue ===
      "function"
    ) {
      this.onContinue();
    }
  }


  handleEscape(event) {
    if (
      event.key !== "Escape"
    ) {
      return;
    }


    this.closeAndContinue();
  }


  toggle() {
    const overlay =
      this.create();


    if (
      overlay.classList.contains(
        "show"
      )
    ) {
      this.closeAndContinue();
    } else {
      this.show();
    }
  }
}


/* ==========================================
UTIL
========================================== */

function formatPlayTime(totalSeconds) {
  const seconds =
    Math.max(0, Math.floor(Number(totalSeconds) || 0));

  if (seconds < 60) {
    return t("time.seconds", { s: seconds });
  }

  const minutes =
    Math.floor(seconds / 60);

  if (minutes < 60) {
    return t("time.minutes", { m: minutes });
  }

  return t("time.hours", {
    h: Math.floor(minutes / 60),
    m: minutes % 60
  });
}
