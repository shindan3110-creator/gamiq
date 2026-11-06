// GAMIQ（ゲーミック） v2 - PLAY DATA (anonymous)
//
// Every finished game sends ONE small, anonymous record:
//   game, level, score, clear/fail, play time, phone/PC, language.
// No nickname, no player id. Used to:
//   - see real averages per game ("the average PK is 4.2 saves")
//   - turn scores into "top X%" later (more accurate GAMIQ)
//   - see which games people quit in the middle
//
// Outcomes:
//   done = the game was finished
//   quit = the page was closed DURING a game
//   exit = the page was closed right AFTER this game (last game played)
//
// Network errors never stop the game.

import { API_BASE } from "./platform.js";
import { LANG } from "./i18n.js";

function device() {
  try {
    return window.matchMedia("(pointer: coarse)").matches ? "sp" : "pc";
  } catch (error) {
    return "pc";
  }
}

function record({ game, level, score = 0, success = false, ms = 0, solo = false, outcome }) {
  return {
    gameId: game?.id,
    skill: game?.skill,
    level: Math.max(1, Math.min(10, Math.round(Number(level) || 1))),
    score: Math.max(0, Math.min(100, Math.round(Number(score) || 0))),
    success: success ? 1 : 0,
    ms: Math.max(0, Math.min(600000, Math.round(Number(ms) || 0))),
    solo: solo ? 1 : 0,
    device: device(),
    lang: LANG === "ja" ? "ja" : "en",
    outcome
  };
}

// A finished game
export function logPlay(data) {
  if (!data?.game?.id) return;

  try {
    fetch(`${API_BASE}/play`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record({ ...data, outcome: "done" })),
      keepalive: true
    }).catch(() => {});
  } catch (error) {
    // ignore
  }
}

// The page is closing (quit = during a game, exit = after a game)
export function logLeave(data) {
  if (!data?.game?.id) return;

  try {
    const body = JSON.stringify(record(data));

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${API_BASE}/play`,
        new Blob([body], { type: "text/plain" })
      );
    } else {
      fetch(`${API_BASE}/play`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body,
        keepalive: true
      }).catch(() => {});
    }
  } catch (error) {
    // ignore
  }
}
