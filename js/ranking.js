// GAMIQ（ゲーミック） v2 - Ranking Overlay
//
// Tabs: TODAY (resets at 0:00 UTC) / ALL-TIME (best single day)
// Nicknames are always set with textContent (never as HTML).

import { t } from "./i18n.js";
import { fetchRanking } from "./api.js";
import { msUntilReset } from "./score.js";
import { rankText } from "./share.js";

export class GamiqRanking {
  constructor({ onClose = null } = {}) {
    this.onClose = onClose;
    this.overlay = null;
    this.type = "daily";
    this.requestId = 0;

    this.handleEscape = this.handleEscape.bind(this);
  }

  create() {
    if (this.overlay) {
      return this.overlay;
    }

    const overlay = document.createElement("div");

    overlay.className = "gamiq-ranking-overlay";
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <div
        class="gamiq-ranking-card"
        role="dialog"
        aria-modal="true"
        aria-label="${t("rank.title")}"
      >
        <div class="gamiq-ranking-head">
          <strong>🏆 ${t("rank.title")}</strong>

          <button
            type="button"
            class="gamiq-ranking-close"
            data-ranking-close
            aria-label="${t("rank.close")}"
          >×</button>
        </div>

        <div class="gamiq-ranking-tabs" role="tablist">
          <button type="button" role="tab" data-ranking-tab="daily">
            ${t("rank.today")}
          </button>
          <button type="button" role="tab" data-ranking-tab="alltime">
            ${t("rank.allTime")}
          </button>
        </div>

        <div class="gamiq-ranking-note" data-ranking-note></div>

        <div class="gamiq-ranking-status" data-ranking-status></div>

        <ol class="gamiq-ranking-list" data-ranking-list></ol>

        <div class="gamiq-ranking-me" data-ranking-me hidden></div>

        <div class="gamiq-ranking-formula">
          ${t("rank.formula")}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay
      .querySelector("[data-ranking-close]")
      .addEventListener("click", () => this.hide());

    overlay.addEventListener("pointerdown", event => {
      if (event.target === overlay) {
        this.hide();
      }
    });

    overlay.querySelectorAll("[data-ranking-tab]").forEach(button => {
      button.addEventListener("click", () => {
        this.type = button.dataset.rankingTab;
        this.load();
      });
    });

    this.overlay = overlay;

    return overlay;
  }

  async load() {
    const overlay = this.create();
    const requestId = ++this.requestId;

    overlay.querySelectorAll("[data-ranking-tab]").forEach(button => {
      const selected = button.dataset.rankingTab === this.type;

      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    });

    const note = overlay.querySelector("[data-ranking-note]");
    const status = overlay.querySelector("[data-ranking-status]");
    const list = overlay.querySelector("[data-ranking-list]");
    const meBox = overlay.querySelector("[data-ranking-me]");

    note.textContent =
      this.type === "daily"
        ? t("rank.dailyNote", { time: formatResetIn(msUntilReset()) })
        : t("rank.allTimeNote");

    status.textContent = t("rank.loading");
    status.hidden = false;
    list.innerHTML = "";
    meBox.hidden = true;

    const data = await fetchRanking(this.type);

    // A newer request (tab switch) already started.
    if (requestId !== this.requestId) {
      return;
    }

    if (!data.ok) {
      status.textContent = t("rank.error");
      return;
    }

    if (!data.list.length) {
      status.textContent = t("rank.empty");
      return;
    }

    status.hidden = true;

    for (const entry of data.list) {
      list.appendChild(createRow(entry));
    }

    // Your own rank (shown even if you are not in the top 50)
    if (data.me) {
      meBox.hidden = false;
      meBox.innerHTML = "";

      const label = document.createElement("span");

      // "YOU · TOP 8%" (or "#3 of 5 players" while few players)
      const position = rankText(data.me, data.total);

      label.textContent =
        position ? `${t("rank.you")} · ${position}` : t("rank.you");

      meBox.appendChild(label);
      meBox.appendChild(createRow(data.me, true));
    } else if (this.type === "daily") {
      meBox.hidden = false;
      meBox.textContent = t("rank.notYet");
    }
  }

  show(type = "daily") {
    const overlay = this.create();

    this.type = type;

    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    document.addEventListener("keydown", this.handleEscape);

    this.load();
  }

  hide() {
    if (!this.overlay) {
      return;
    }

    this.overlay.classList.remove("show");
    this.overlay.setAttribute("aria-hidden", "true");

    document.removeEventListener("keydown", this.handleEscape);

    if (typeof this.onClose === "function") {
      this.onClose();
    }
  }

  isOpen() {
    return Boolean(this.overlay?.classList.contains("show"));
  }

  handleEscape(event) {
    if (event.key === "Escape") {
      this.hide();
    }
  }
}


/* ==========================================
UTIL
========================================== */

function createRow(entry, mine = false) {
  const row = document.createElement("li");

  row.className = "gamiq-ranking-row";

  if (entry.isMe || mine) {
    row.classList.add("me");
  }

  if (entry.rank <= 3) {
    row.classList.add(`top${entry.rank}`);
  }

  const rank = document.createElement("span");
  rank.className = "gamiq-ranking-rank";
  rank.textContent = `#${entry.rank ?? "-"}`;

  const name = document.createElement("span");
  name.className = "gamiq-ranking-name";
  name.textContent = String(entry.nickname ?? "");

  const level = document.createElement("span");
  level.className = "gamiq-ranking-level";
  level.textContent = `Lv${Number(entry.level) || "-"}`;

  const score = document.createElement("strong");
  score.className = "gamiq-ranking-score";
  score.textContent = String(Number(entry.rankScore) || 0);

  row.append(rank, name, level, score);

  return row;
}

function formatResetIn(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(minutes / 60);

  return hours > 0
    ? t("rank.hoursMinutes", { h: hours, m: minutes % 60 })
    : t("rank.minutes", { m: minutes });
}
