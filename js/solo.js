// GAMIQ（ゲーミック） v2 - SOLO CHALLENGE (?start=pk&solo=1)
//
// For posts on X: the link opens ONE game right away.
// After it: a big result card (score + medal) that is easy to post,
// "Try again", and "Play more" (the normal random GAMIQ).
// A solo score is NOT added to today's GAMIQ record.

import { t, LANG } from "./i18n.js";
import { siteOrigin } from "./share.js";

export function isSoloLink() {
  try {
    return new URLSearchParams(window.location.search).get("solo") === "1";
  } catch (error) {
    return false;
  }
}

export function soloMedal(score) {
  if (score >= 85) return "gold";
  if (score >= 70) return "silver";
  if (score >= 50) return "bronze";
  return "try";
}

// One line about what the player did (only for games that report it)
export function soloDetail(game, meta) {
  if (!meta) return "";

  if (game.id === "reflex_pk_keeper" && Number.isFinite(meta.saves)) {
    return t("solo.pk", { saves: meta.saves, kicks: meta.kicks ?? 8 });
  }

  return "";
}

// The link people share: same game, solo again
export function soloUrl(startKey) {
  const base = `${siteOrigin()}/${LANG === "ja" ? "ja/" : ""}`;
  return `${base}?start=${encodeURIComponent(startKey)}&solo=1`;
}

export function soloShareText({ game, score, medal, detail, url }) {
  return [
    t("solo.shareLine1", { title: game.title, score }),
    `${t(`solo.medal.${medal}`)}${detail ? ` / ${detail}` : ""}`,
    t("solo.shareLine2"),
    url,
    "#GAMIQ"
  ].join("\n");
}


/* ==========================================
SHARE IMAGE (1080 x 1080)
========================================== */

const MEDAL_COLOR = {
  gold: "#ffd76a",
  silver: "#d7e0ea",
  bronze: "#f0a070",
  try: "#9aa5b5"
};

export function buildSoloImage({ game, score, medal, detail }) {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const g = canvas.getContext("2d");
  const font = (weight, px) =>
    `${weight} ${px}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif`;

  // Background
  const bg = g.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, "#0f1a26");
  bg.addColorStop(1, "#04070c");
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);

  const glow = g.createRadialGradient(size / 2, size * 0.46, 20, size / 2, size * 0.46, 520);
  glow.addColorStop(0, "rgba(95,239,255,.2)");
  glow.addColorStop(1, "rgba(95,239,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);

  g.textAlign = "center";
  g.textBaseline = "alphabetic";

  // Game title
  g.fillStyle = "#ffd76a";
  g.font = font(900, 52);
  g.fillText(game.title, size / 2, 190);

  // Score
  g.fillStyle = "#ffffff";
  g.font = font(900, 300);
  const scoreText = String(score);
  g.fillText(scoreText, size / 2 - 40, 520);

  const w = g.measureText(scoreText).width;
  g.font = font(900, 72);
  g.textAlign = "left";
  g.fillText(t("solo.pts"), size / 2 - 40 + w / 2 + 10, 520);
  g.textAlign = "center";

  // Medal badge
  const label = t(`solo.medal.${medal}`);
  g.font = font(900, 64);
  const bw = g.measureText(label).width + 110;
  const bx = size / 2 - bw / 2;
  const by = 580;

  g.fillStyle = "rgba(255,255,255,.06)";
  g.strokeStyle = MEDAL_COLOR[medal];
  g.lineWidth = 5;
  roundRect(g, bx, by, bw, 110, 55);
  g.fill();
  g.stroke();

  g.fillStyle = MEDAL_COLOR[medal];
  g.fillText(label, size / 2, by + 78);

  // Detail
  if (detail) {
    g.fillStyle = "#c9d3df";
    g.font = font(800, 46);
    g.fillText(detail, size / 2, 780);
  }

  // Challenge line
  g.fillStyle = "#5fefff";
  g.font = font(900, 44);
  g.fillText(t("solo.shareLine2"), size / 2, 870);

  // Logo
  g.fillStyle = "#ffffff";
  g.font = font(900, 56);
  g.fillText("GAMIQ", size / 2, 990);

  g.fillStyle = "#7c8798";
  g.font = font(800, 28);
  g.fillText("playgamiq.com", size / 2, 1035);

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), "image/png");
  });
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}


/* ==========================================
SHARE ACTIONS
========================================== */

// Phone: share sheet with the image (pick X there).
// PC / no share sheet: download the image.
export async function shareSoloImage(data) {
  const text = soloShareText(data);
  let blob = null;

  try {
    blob = await buildSoloImage(data);
  } catch (error) {
    blob = null;
  }

  const file =
    blob && typeof File === "function"
      ? new File([blob], "gamiq-challenge.png", { type: "image/png" })
      : null;

  if (navigator.share && file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
    }
  }

  if (blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gamiq-challenge.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return "downloaded";
  }

  return "failed";
}

// Text post on X (the link shows as a card)
export function postSoloOnX(data) {
  const url = `https://x.com/intent/post?text=${encodeURIComponent(soloShareText(data))}`;
  window.open(url, "_blank", "noopener");
}
