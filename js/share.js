// GAMIQ（ゲーミック） v2 - Titles, "TOP x%" and Sharing
//
// - Title from your GAMIQ (ROOKIE ... LEGEND).
// - Rank text: "TOP 8%" only when enough players are on the
//   ranking (10+). With fewer players: "#3 / 5 players".
//   (No made-up numbers.)
// - Share: a result image (radar chart) + text.
//   Phones: the share sheet. Otherwise: image download + text copy.

import { t, LANG } from "./i18n.js";

const SKILLS = ["REFLEX", "SPEED", "AIM", "LOGIC", "MEMORY"];

// Show "TOP x%" only with at least this many players.
const MIN_PLAYERS_FOR_PERCENT = 10;

const TITLES = [
  { min: 930, id: "legend", color: "#ffd76a" },
  { min: 850, id: "master", color: "#ff9d5c" },
  { min: 750, id: "elite", color: "#c38bff" },
  { min: 650, id: "pro", color: "#5fefff" },
  { min: 550, id: "skilled", color: "#7cf7a8" },
  { min: 450, id: "player", color: "#c9d1dc" },
  { min: 0, id: "rookie", color: "#8c97a8" }
];


/* ==========================================
TITLE
========================================== */

export function titleFor(gamiq) {
  if (!Number.isFinite(gamiq)) {
    return null;
  }

  const found = TITLES.find(item => gamiq >= item.min) || TITLES.at(-1);

  return {
    id: found.id,
    name: t(`title.${found.id}`),
    color: found.color
  };
}


/* ==========================================
RANK TEXT
========================================== */

/**
 * @param {object|null} me     ranking "me" entry ({ rank, ... })
 * @param {number} total       players on that ranking
 * @returns {string|null}
 */
export function rankText(me, total) {
  if (!me || !me.rank || !total) {
    return null;
  }

  if (total >= MIN_PLAYERS_FOR_PERCENT) {
    const percent = Math.max(1, Math.ceil((me.rank / total) * 100));

    return t("share.topPercent", { p: percent });
  }

  return t("share.rankOf", { rank: me.rank, total });
}


/* ==========================================
SKILLS FOR THE IMAGE
========================================== */

export function shareAbilities(summary) {
  const current = summary?.abilities || {};
  const hasCurrent = SKILLS.some(skill => Number.isFinite(current[skill]));

  if (hasCurrent) {
    return current;
  }

  // Just after a level up: use the level that was just finished.
  return summary?.levelHistory?.at(-1)?.abilities || {};
}


/* ==========================================
SHARE TEXT
========================================== */

export function buildShareText({ summary, nickname, rank }) {
  const gamiq = summary?.gamiq ?? "---";
  const title = titleFor(summary?.gamiq);

  const lines = [
    title
      ? t("share.line1", { gamiq, title: title.name })
      : t("share.line1NoTitle", { gamiq }),
    t("share.line2", {
      level: summary?.level ?? 1,
      rank: rank || t("share.noRank")
    }),
    t("share.line3"),
    shareUrl()
  ];

  return lines.filter(Boolean).join("\n");
}

function shareUrl() {
  const url = new URL(window.location.origin + window.location.pathname);

  if (LANG) {
    url.searchParams.set("lang", LANG);
  }

  return url.toString();
}


/* ==========================================
SHARE IMAGE (1080 x 1080)
========================================== */

export async function buildShareImage({ summary, nickname, rank }) {
  const size = 1080;
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const g = canvas.getContext("2d");

  const font = (weight, px) =>
    `${weight} ${px}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", sans-serif`;

  // Background
  const bg = g.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, "#0f1a26");
  bg.addColorStop(1, "#04070c");
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);

  const glow = g.createRadialGradient(size * 0.7, size * 0.55, 20, size * 0.7, size * 0.55, 480);
  glow.addColorStop(0, "rgba(95,239,255,.18)");
  glow.addColorStop(1, "rgba(95,239,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);

  // Logo
  g.fillStyle = "#ffffff";
  g.font = font(900, 64);
  g.textBaseline = "top";
  g.fillText("GAMIQ", 72, 64);

  g.fillStyle = "#5fefff";
  g.font = font(800, 24);
  g.fillText("GAME + IQ", 76, 138);

  // Player
  if (nickname) {
    g.fillStyle = "#9aa5b5";
    g.font = font(800, 30);
    g.textAlign = "right";
    g.fillText(nickname, size - 72, 82);
    g.textAlign = "left";
  }

  // GAMIQ number
  const gamiq = summary?.gamiq;
  const title = titleFor(gamiq);

  g.fillStyle = "#7c8798";
  g.font = font(900, 26);
  g.fillText("GAMIQ", 72, 240);

  g.fillStyle = "#ffffff";
  g.font = font(900, 190);
  g.fillText(String(gamiq ?? "---"), 62, 270);

  if (title) {
    g.fillStyle = title.color;
    g.font = font(900, 54);
    g.fillText(title.name, 72, 480);
  }

  // Level + rank
  g.fillStyle = "#ffd76a";
  g.font = font(900, 40);
  g.fillText(`LV ${summary?.level ?? 1}`, 72, 570);

  if (rank) {
    g.fillStyle = "#ffffff";
    g.font = font(800, 40);
    g.fillText(rank, 72, 630);
  }

  // Radar chart
  drawRadar(g, {
    cx: 760,
    cy: 600,
    radius: 230,
    abilities: shareAbilities(summary),
    font
  });

  // Footer
  g.fillStyle = "#5f6a7a";
  g.font = font(800, 28);
  g.fillText(t("share.footer"), 72, size - 110);

  g.fillStyle = "#5fefff";
  g.font = font(800, 30);
  g.fillText(window.location.host, 72, size - 70);

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), "image/png");
  });
}

function drawRadar(g, { cx, cy, radius, abilities, font }) {
  const n = SKILLS.length;
  const angleOf = i => -Math.PI / 2 + (i * Math.PI * 2) / n;
  const point = (i, r) => [cx + Math.cos(angleOf(i)) * r, cy + Math.sin(angleOf(i)) * r];

  // Grid
  g.strokeStyle = "rgba(255,255,255,.12)";
  g.lineWidth = 2;

  for (const ratio of [0.25, 0.5, 0.75, 1]) {
    g.beginPath();

    for (let i = 0; i < n; i++) {
      const [x, y] = point(i, radius * ratio);
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }

    g.closePath();
    g.stroke();
  }

  for (let i = 0; i < n; i++) {
    const [x, y] = point(i, radius);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(x, y);
    g.stroke();
  }

  // Values
  g.beginPath();

  for (let i = 0; i < n; i++) {
    const value = Number(abilities?.[SKILLS[i]]);
    const r = radius * (Number.isFinite(value) ? Math.max(0.04, value / 100) : 0.04);
    const [x, y] = point(i, r);
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }

  g.closePath();
  g.fillStyle = "rgba(95,239,255,.28)";
  g.fill();
  g.strokeStyle = "#5fefff";
  g.lineWidth = 5;
  g.stroke();

  // Labels
  g.textAlign = "center";
  g.textBaseline = "middle";

  for (let i = 0; i < n; i++) {
    const [x, y] = point(i, radius + 52);
    const value = Number(abilities?.[SKILLS[i]]);

    g.fillStyle = "#c9d1dc";
    g.font = font(900, 26);
    g.fillText(SKILLS[i], x, y - 14);

    g.fillStyle = "#ffffff";
    g.font = font(900, 30);
    g.fillText(Number.isFinite(value) ? String(value) : "--", x, y + 20);
  }

  g.textAlign = "left";
  g.textBaseline = "top";
}


/* ==========================================
SHARE
========================================== */

/**
 * Share the result.
 * @returns {Promise<"shared"|"downloaded"|"cancelled"|"failed">}
 */
export async function shareResult({ summary, nickname, rank }) {
  const text = buildShareText({ summary, nickname, rank });

  let blob = null;

  try {
    blob = await buildShareImage({ summary, nickname, rank });
  } catch (error) {
    blob = null;
  }

  const file =
    blob && typeof File === "function"
      ? new File([blob], "gamiq-result.png", { type: "image/png" })
      : null;

  // 1) Phone share sheet (with the image if possible)
  if (navigator.share) {
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        await navigator.share({ text });
      }

      return "shared";

    } catch (error) {
      if (error?.name === "AbortError") {
        return "cancelled";
      }
      // fall through to download
    }
  }

  // 2) PC: download the image + copy the text
  try {
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "gamiq-result.png";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    await navigator.clipboard?.writeText(text);

    return "downloaded";

  } catch (error) {
    return "failed";
  }
}


/* ==========================================
SHARE BUTTONS: LINE / X / COPY (/ OTHER)
One row of buttons. Each opens the app or site directly.
========================================== */

/**
 * @param {object} options
 * @param {() => string} options.getText   text to share (includes the URL)
 * @param {(method: string) => void} [options.onShare]  for analytics
 * @param {boolean} [options.withOther]    add "OTHER" (phone share sheet)
 * @param {() => Promise<Blob>} [options.getImage]  adds an Instagram button
 * @returns {HTMLElement}
 */
export function createShareButtons({ getText, onShare, withOther = false, getImage = null }) {
  const row = document.createElement("div");
  row.className = "gamiq-share-row";

  const add = (method, label, className, handler) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `gamiq-share-btn ${className}`;
    button.innerHTML = label;
    button.setAttribute("aria-label", method);

    button.addEventListener("click", async () => {
      onShare?.(method);
      await handler(button);
    });

    row.appendChild(button);
  };

  const open = url => {
    window.open(url, "_blank", "noopener");
  };

  /*
   * INSTAGRAM
   * Instagram has no "share link" for websites. The only way is
   * to share an IMAGE: on phones the share sheet shows Instagram
   * (Stories / Feed / DM). On PC the image is saved instead.
   */
  if (getImage) {
    add("instagram", "Instagram", "insta", async button => {
      const original = button.textContent;

      let blob = null;

      try {
        blob = await getImage();
      } catch (error) {
        blob = null;
      }

      if (!blob) {
        button.textContent = t("share.failed");
        setTimeout(() => { button.textContent = original; }, 1800);
        return;
      }

      const file = new File([blob], "gamiq.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch (error) {
          // cancelled
        }
        return;
      }

      // PC etc.: save the image so it can be posted from the app.
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "gamiq.png";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);

      button.textContent = t("share.imageSaved");
      setTimeout(() => { button.textContent = original; }, 2500);
    });
  }

  add("line", "LINE", "line", () => {
    open(`https://line.me/R/share?text=${encodeURIComponent(getText())}`);
  });

  add("x", "𝕏", "x", () => {
    open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(getText())}`);
  });

  add("copy", t("share.copy"), "copy", async button => {
    let ok = false;

    try {
      await navigator.clipboard.writeText(getText());
      ok = true;
    } catch (error) {
      ok = false;
    }

    button.textContent = ok ? t("share.copied") : t("share.failed");

    setTimeout(() => {
      button.textContent = t("share.copy");
    }, 1800);
  });

  if (withOther && navigator.share) {
    add("other", t("share.other"), "other", async () => {
      try {
        await navigator.share({ text: getText() });
      } catch (error) {
        // cancelled
      }
    });
  }

  return row;
}


/* ==========================================
DAILY CHALLENGE IMAGE (1080 x 1920, story size)
No game names = no spoilers.
========================================== */

export async function buildDailyImage({ number, total, max, rows, nickname }) {
  const w = 1080;
  const h = 1920;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const g = canvas.getContext("2d");

  const font = (weight, px) =>
    `${weight} ${px}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", sans-serif`;

  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0d2018");
  bg.addColorStop(1, "#04070c");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  const glow = g.createRadialGradient(w / 2, 620, 40, w / 2, 620, 620);
  glow.addColorStop(0, "rgba(124,255,178,.18)");
  glow.addColorStop(1, "rgba(124,255,178,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);

  g.textAlign = "center";
  g.textBaseline = "alphabetic";

  g.fillStyle = "#ffffff";
  g.font = font(900, 96);
  g.fillText("GAMIQ", w / 2, 250);

  g.fillStyle = "#7cffb2";
  g.font = font(900, 46);
  g.fillText(`DAILY #${number}`, w / 2, 340);

  if (nickname) {
    g.fillStyle = "#9aa5b5";
    g.font = font(800, 38);
    g.fillText(nickname, w / 2, 420);
  }

  g.fillStyle = "#ffffff";
  g.font = font(900, 260);
  g.fillText(String(total), w / 2, 730);

  g.fillStyle = "#7c8798";
  g.font = font(900, 56);
  g.fillText(`/ ${max}`, w / 2, 820);

  // One row per game: icon + bar + score
  const top = 960;
  const rowH = 128;

  rows.forEach((row, i) => {
    const y = top + i * rowH;
    const color = row.score >= 80 ? "#3fb950" : row.score >= 50 ? "#e3b341" : "#f85149";

    g.fillStyle = "rgba(255,255,255,.06)";
    roundRect(g, 120, y, w - 240, 100, 24);
    g.fill();

    g.textAlign = "left";
    g.font = font(400, 58);
    g.fillStyle = "#ffffff";
    g.fillText(row.icon, 160, y + 72);

    g.fillStyle = "rgba(255,255,255,.1)";
    roundRect(g, 270, y + 38, 520, 26, 13);
    g.fill();

    g.fillStyle = color;
    roundRect(g, 270, y + 38, Math.max(26, 520 * row.score / 100), 26, 13);
    g.fill();

    g.textAlign = "right";
    g.fillStyle = "#ffffff";
    g.font = font(900, 56);
    g.fillText(String(row.score), w - 160, y + 72);
  });

  g.textAlign = "center";
  g.fillStyle = "#cfd6e2";
  g.font = font(900, 44);
  g.fillText(t("share.dailyImageCta"), w / 2, 1680);

  g.fillStyle = "#7cffb2";
  g.font = font(800, 36);
  g.fillText(location.host, w / 2, 1750);

  return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
}

function roundRect(g, x, y, width, height, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + width, y, x + width, y + height, r);
  g.arcTo(x + width, y + height, x, y + height, r);
  g.arcTo(x, y + height, x, y, r);
  g.arcTo(x, y, x + width, y, r);
  g.closePath();
}
