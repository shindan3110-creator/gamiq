// GAMIQ（ゲーミック） v2 - Daily Challenge
//
// DAILY CHALLENGE (like Wordle)
// - Every day (0:00 UTC) there is a new set of 5 games.
// - Everyone gets the SAME 5 games, in the same order,
//   with the same starting layouts (same random seed).
// - One game from each genre: REFLEX / SPEED / AIM / LOGIC / MEMORY.
// - Fixed difficulty: Lv5 for everyone.
// - One try per day. Leaving in the middle = that game is 0.
// - Share text shows only colors, no game names (no spoilers).
// - Separate from the normal GAMIQ score / level (does not change them).

import { t } from "./i18n.js";
import { todayKey, msUntilReset } from "./score.js";
import { sfx } from "./sound.js";
import { submitChallenge } from "./api.js";
import { rankText } from "./share.js";

const STORAGE_KEY = "gamiq_v2_daily";

export const DAILY_LEVEL = 5;
export const DAILY_GAMES = 5;

// Daily #1 = 2026-10-17 (UTC)
const FIRST_DAY_UTC = Date.UTC(2026, 9, 17);

const SKILLS = ["REFLEX", "SPEED", "AIM", "LOGIC", "MEMORY"];

const SKILL_ICON = {
  REFLEX: "⚡",
  SPEED: "💨",
  AIM: "🎯",
  LOGIC: "🧩",
  MEMORY: "🧠"
};


/* ==========================================
SEEDED RANDOM
Same seed = same numbers on every device.
========================================== */

function hashString(text) {
  let h = 1779033703 ^ text.length;

  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);

  return (h ^ (h >>> 16)) >>> 0;
}

export function seededRandom(seedText) {
  let a = hashString(seedText);

  // mulberry32
  return function random() {
    a = (a + 0x6d2b79f5) | 0;

    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;

    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}


/* ==========================================
TODAY'S CHALLENGE
========================================== */

export function dailyNumber(day = todayKey()) {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - FIRST_DAY_UTC) / 86400000) + 1;
}

export function dailyGames(pool, day = todayKey()) {
  const random = seededRandom(`gamiq-daily-${day}`);

  // Genre order is shuffled each day.
  const order = [...SKILLS];

  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  // Sort by id so the pick does not depend on the pool order in app.js.
  return order
    .map(skill => {
      const list = pool
        .filter(game => game.skill === skill)
        .sort((a, b) => a.id.localeCompare(b.id));

      return list.length ? list[Math.floor(random() * list.length)] : null;
    })
    .filter(Boolean);
}


/* ==========================================
SAVED RECORD (today only)
========================================== */

function loadRecord() {
  const day = todayKey();

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");

    if (saved && saved.day === day && Array.isArray(saved.results)) {
      return saved;
    }
  } catch (error) {
    // broken / blocked storage: start fresh
  }

  return { day, results: [] };
}

function saveRecord(record) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    // storage blocked: the challenge still works for this visit
  }
}

export function dailyStatus() {
  const record = loadRecord();
  const total = record.results.reduce((sum, r) => sum + (r.score || 0), 0);

  return {
    number: dailyNumber(record.day),
    played: record.results.length,
    done: record.results.length >= DAILY_GAMES,
    total
  };
}

function squareFor(score) {
  if (score >= 80) return "🟩";
  if (score >= 50) return "🟨";
  return "🟥";
}

export function dailyShareText(record = loadRecord()) {
  const total = record.results.reduce((sum, r) => sum + (r.score || 0), 0);

  const squares = record.results
    .map(r => `${SKILL_ICON[r.skill] || ""}${squareFor(r.score || 0)}`)
    .join(" ");

  const url = `${location.origin}${location.pathname}`;

  return t("daily.shareText", {
    n: dailyNumber(record.day),
    total,
    max: DAILY_GAMES * 100,
    squares,
    url
  });
}


/* ==========================================
DAILY SCREEN
========================================== */

export class GamiqDaily {
  /**
   * @param {object} options
   * @param {HTMLElement} options.mount   where the overlay is added
   * @param {Array} options.pool          all games
   * @param {Function} options.renderCard renderGameCard(card, game)
   * @param {Function} options.runGame    runSelectedGame({game, container, onComplete})
   * @param {object} options.analytics
   * @param {Function} options.onClose
   * @param {Function} options.onRanking  opens the Daily Challenge ranking
   */
  constructor({ mount, pool, renderCard, runGame, analytics, onClose, onRanking }) {
    this.mount = mount;
    this.pool = pool;
    this.renderCard = renderCard;
    this.runGame = runGame;
    this.analytics = analytics;
    this.onClose = onClose;
    this.onRanking = onRanking;

    this.overlay = null;
    this.token = 0;
    this.cleanup = null;
    this.safetyTimer = null;
    this.countdownTimer = null;
    this.nativeRandom = null;
  }

  /* ---------- OPEN / CLOSE ---------- */

  open() {
    this.record = loadRecord();
    this.games = dailyGames(this.pool, this.record.day);
    this.number = dailyNumber(this.record.day);

    if (!this.overlay) {
      this.overlay = document.createElement("div");
      this.overlay.className = "dl-overlay";
      this.mount.appendChild(this.overlay);
    }

    this.overlay.innerHTML = `
      <div class="dl-bar">
        <strong>📅 ${t("daily.short")} #${this.number}</strong>
        <div class="dl-dots" data-dl-dots></div>
        <button type="button" class="dl-close" data-dl-close aria-label="Close">✕</button>
      </div>
      <div class="dl-stage" data-dl-stage></div>
    `;

    this.stage = this.overlay.querySelector("[data-dl-stage]");
    this.dots = this.overlay.querySelector("[data-dl-dots]");
    this.closeButton = this.overlay.querySelector("[data-dl-close]");

    this.closeButton.addEventListener("click", () => this.onCloseTap());

    this.overlay.classList.add("show");

    this.renderDots(-1);

    if (this.record.results.length >= DAILY_GAMES) {
      this.showFinal();
    } else {
      this.showIntro();
    }
  }

  onCloseTap() {
    // During a game: tap twice to quit (that game becomes 0).
    if (this.playing && !this.closeButton.classList.contains("confirm")) {
      this.closeButton.classList.add("confirm");
      this.closeButton.textContent = t("daily.quit");

      clearTimeout(this.confirmTimer);
      this.confirmTimer = setTimeout(() => {
        this.closeButton.classList.remove("confirm");
        this.closeButton.textContent = "✕";
      }, 2200);

      return;
    }

    this.close();
  }

  close() {
    this.token++;
    this.stopGame();

    clearInterval(this.countdownTimer);
    clearTimeout(this.confirmTimer);

    this.overlay?.classList.remove("show");

    if (this.overlay) {
      this.overlay.innerHTML = "";
    }

    this.onClose?.();
  }

  renderDots(current) {
    this.dots.innerHTML = this.games
      .map((game, i) => {
        const r = this.record.results[i];

        const cls =
          i === current ? "now" :
          r ? (r.score >= 80 ? "g" : r.score >= 50 ? "y" : "r") :
          "";

        return `<span class="${cls}"></span>`;
      })
      .join("");
  }


  /* ---------- INTRO ---------- */

  showIntro() {
    const resumeAt = this.record.results.length;

    this.stage.innerHTML = `
      <div class="dl-panel">
        <div class="dl-kicker">${t("daily.kicker")}</div>
        <h2>${t("daily.title", { n: this.number })}</h2>
        <p>${t("daily.text")}</p>

        <div class="dl-genres">
          ${this.games.map(g => `<span>${SKILL_ICON[g.skill]}<small>${g.skill}</small></span>`).join("")}
        </div>

        <ul class="dl-rules">
          <li>${t("daily.rule1", { level: DAILY_LEVEL })}</li>
          <li>${t("daily.rule2")}</li>
          <li>${t("daily.rule3")}</li>
        </ul>

        <button type="button" class="dl-go" data-dl-go>
          ${resumeAt > 0 ? t("daily.resume", { i: resumeAt + 1, n: DAILY_GAMES }) : t("daily.go")}
        </button>
      </div>
    `;

    this.stage.querySelector("[data-dl-go]").addEventListener("click", () => {
      sfx("click");

      if (resumeAt === 0) {
        this.analytics?.send?.("daily_start", { daily_no: this.number });
      }

      this.playGame(resumeAt);
    });
  }


  /* ---------- ONE GAME ---------- */

  async playGame(index) {
    const token = ++this.token;
    const game = this.games[index];

    if (!game) {
      this.showFinal();
      return;
    }

    // Saved as 0 BEFORE playing: leaving in the middle counts as 0.
    this.record.results[index] = {
      id: game.id,
      skill: game.skill,
      score: 0,
      done: false
    };

    saveRecord(this.record);

    this.renderDots(index);

    this.stage.innerHTML = `<section class="gamiq-feed-card current dl-card"></section>`;

    const card = this.stage.querySelector(".dl-card");

    this.renderCard(card, game);

    // Replace "swipe for next" with a button.
    const nextSlot = card.querySelector(".gamiq-swipe-next");

    if (nextSlot) {
      const last = index === this.games.length - 1;

      nextSlot.outerHTML = `
        <button type="button" class="dl-next" data-dl-next disabled>
          ${last ? t("daily.finish") : t("daily.next")}
        </button>
      `;
    }

    const host = card.querySelector("[data-game-host]");
    const rule = card.querySelector("[data-rule-overlay]");

    // Rule reading time (same as the normal feed)
    await wait(1800);

    if (token !== this.token) return;

    rule?.classList.add("hide");

    this.playing = true;

    let completed = false;

    const onComplete = result => {
      if (completed || token !== this.token) return;

      completed = true;
      this.playing = false;

      this.restoreRandom();
      clearTimeout(this.safetyTimer);

      const safety = result?.meta?.safetyTimeout === true;
      const score = safety ? 0 : clampScore(result?.score);

      this.record.results[index].score = score;
      this.record.results[index].done = true;

      saveRecord(this.record);

      this.renderDots(-1);

      const success =
        typeof result?.meta?.success === "boolean"
          ? result.meta.success
          : score >= 60;

      sfx(success ? "clear" : "fail");

      const overlay = card.querySelector("[data-card-complete]");
      const scoreEl = card.querySelector("[data-complete-score]");

      if (scoreEl) scoreEl.textContent = String(score);

      requestAnimationFrame(() => overlay?.classList.add("show"));

      const nextButton = card.querySelector("[data-dl-next]");

      if (nextButton) {
        // Short delay so a tap meant for the game does not skip ahead.
        setTimeout(() => {
          nextButton.disabled = false;
        }, 600);

        nextButton.addEventListener("click", () => {
          sfx("click");
          this.stopGame();

          if (index + 1 < this.games.length) {
            this.playGame(index + 1);
          } else {
            this.analytics?.send?.("daily_complete", {
              daily_no: this.number,
              daily_total: this.record.results.reduce((s, r) => s + r.score, 0)
            });

            this.showFinal();
          }
        });
      }
    };

    // Safety: a game that never ends counts as 0.
    this.safetyTimer = setTimeout(() => {
      onComplete({ score: 0, meta: { safetyTimeout: true } });
    }, game.maxDuration ?? 90000);

    // Same seed for everyone -> same layout.
    this.useSeededRandom(`gamiq-daily-${this.record.day}-${index}-${game.id}`);

    try {
      const cleanup = await Promise.resolve(
        this.runGame({
          game: { ...game, level: DAILY_LEVEL },
          container: host,
          onComplete
        })
      );

      if (token !== this.token) {
        if (typeof cleanup === "function") cleanup();
        return;
      }

      this.cleanup = typeof cleanup === "function" ? cleanup : null;

    } catch (error) {
      console.error("Daily game failed:", error);
      onComplete({ score: 0, meta: { safetyTimeout: true } });
    }
  }

  stopGame() {
    this.playing = false;

    clearTimeout(this.safetyTimer);
    this.restoreRandom();

    if (this.cleanup) {
      try {
        this.cleanup();
      } catch (error) {
        // ignore
      }
    }

    this.cleanup = null;
  }

  useSeededRandom(seedText) {
    this.restoreRandom();

    this.nativeRandom = Math.random;
    Math.random = seededRandom(seedText);
  }

  restoreRandom() {
    if (this.nativeRandom) {
      Math.random = this.nativeRandom;
      this.nativeRandom = null;
    }
  }


  /* ---------- FINAL ---------- */

  showFinal() {
    this.token++;
    this.renderDots(-1);

    const results = this.record.results;
    const total = results.reduce((sum, r) => sum + (r.score || 0), 0);

    const titleOf = id =>
      this.pool.find(game => game.id === id)?.title || id;

    this.stage.innerHTML = `
      <div class="dl-panel dl-final">
        <div class="dl-kicker">${t("daily.title", { n: this.number })}</div>

        <div class="dl-total">
          <span>${t("daily.total")}</span>
          <strong>${total}<small> / ${DAILY_GAMES * 100}</small></strong>
        </div>

        <div class="dl-rows">
          ${results.map(r => `
            <div class="dl-row">
              <span class="dl-row-icon">${SKILL_ICON[r.skill] || ""}</span>
              <span class="dl-row-name">${escapeHtml(titleOf(r.id))}</span>
              <span class="dl-row-bar"><i style="width:${r.score}%" class="${r.score >= 80 ? "g" : r.score >= 50 ? "y" : "r"}"></i></span>
              <strong>${r.score}</strong>
            </div>
          `).join("")}
        </div>

        <pre class="dl-share-preview">${escapeHtml(dailyShareText(this.record))}</pre>

        <div class="dl-rank" data-dl-rank>${t("daily.rankSending")}</div>

        <button type="button" class="dl-go" data-dl-share>${t("daily.share")}</button>

        <button type="button" class="dl-rank-button" data-dl-ranking>${t("daily.rankButton")}</button>

        <div class="dl-countdown" data-dl-countdown></div>

        <button type="button" class="dl-back" data-dl-back>${t("daily.back")}</button>
      </div>
    `;

    const shareButton = this.stage.querySelector("[data-dl-share]");

    shareButton.addEventListener("click", async () => {
      const text = dailyShareText(this.record);

      this.analytics?.send?.("daily_share", { daily_no: this.number });

      if (navigator.share) {
        try {
          await navigator.share({ text });
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }

      try {
        await navigator.clipboard.writeText(text);
        shareButton.textContent = t("daily.copied");
      } catch (error) {
        shareButton.textContent = t("daily.copyFailed");
      }

      setTimeout(() => {
        shareButton.textContent = t("daily.share");
      }, 2000);
    });

    this.stage.querySelector("[data-dl-back]").addEventListener("click", () => this.close());

    this.stage.querySelector("[data-dl-ranking]").addEventListener("click", () => {
      sfx("click");
      this.onRanking?.();
    });

    this.sendToRanking();

    const countdownEl = this.stage.querySelector("[data-dl-countdown]");

    const tick = () => {
      const ms = msUntilReset();

      if (ms <= 1000) {
        // A new day started while this screen was open.
        clearInterval(this.countdownTimer);
        countdownEl.textContent = t("daily.newReady");
        return;
      }

      const s = Math.floor(ms / 1000);
      const time = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
        .map(v => String(v).padStart(2, "0"))
        .join(":");

      countdownEl.textContent = t("daily.nextIn", { time });
    };

    clearInterval(this.countdownTimer);
    tick();
    this.countdownTimer = setInterval(tick, 1000);
  }
}


/* Send the result (the server keeps only the first one of the day). */
GamiqDaily.prototype.sendToRanking = async function () {
  const token = this.token;
  const rankEl = this.stage.querySelector("[data-dl-rank]");

  const reply = await submitChallenge({
    day: this.record.day,
    scores: this.record.results.map(r => r.score || 0)
  });

  // The screen changed while sending.
  if (token !== this.token || !rankEl.isConnected) return;

  if (reply.ok && reply.rank) {
    rankEl.textContent = t("daily.rank", {
      rank: rankText({ rank: reply.rank }, reply.total) || `#${reply.rank}`
    });
    rankEl.classList.add("ok");
  } else {
    rankEl.textContent = t("daily.rankFailed");
  }
};


function clampScore(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return 0;

  return Math.round(Math.max(0, Math.min(100, n)));
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
