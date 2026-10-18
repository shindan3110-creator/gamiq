// GAMIQ（ゲーミック） v2 - Ranking API (talks to worker.js)
//
// - submitBestScore(): sends today's best ranking score
//   only when it is better than what was already sent.
// - fetchRanking(): gets the top 50 (today / all-time).
// - Network errors never stop the game.

import { getProfile } from "./profile.js";
import { API_BASE } from "./platform.js";

// What we already sent today, so we don't send the same score again.
const SENT_KEY = "gamiq_v2_sent";

let sending = false;


/**
 * Send today's best score if it is new.
 * @param {object} summary  scoreEngine.getSummary()
 * @returns {Promise<object|null>} server reply, or null if nothing was sent
 */
export async function submitBestScore(summary) {
  const best = summary?.bestRank;

  if (!best || sending) {
    return null;
  }

  const profile = getProfile();

  if (!profile.nickname) {
    return null;
  }

  const sent = readSent();

  if (
    sent.day === summary.day &&
    sent.nickname === profile.nickname &&
    sent.score >= best.score
  ) {
    return null;
  }

  sending = true;

  try {
    const response = await fetch(`${API_BASE}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: profile.playerId,
        nickname: profile.nickname,
        day: summary.day,
        level: best.level,
        levelPlayed: summary.levelPlayed,
        played: summary.played,
        gamiq: best.gamiq,
        rankScore: best.score
      })
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.ok) {
      writeSent({
        day: summary.day,
        nickname: profile.nickname,
        score: best.score
      });
    }

    return data;

  } catch (error) {
    // Offline etc. We will try again after the next game.
    return null;

  } finally {
    sending = false;
  }
}


/**
 * Send today's Daily Challenge result.
 * The server keeps only the first one, so sending again is safe
 * (it just returns your rank).
 * @param {{day: string, scores: number[]}} result
 * @returns {Promise<{ok: boolean, rank?: number, total?: number}>}
 */
export async function submitChallenge({ day, scores }) {
  const profile = getProfile();

  if (!profile.nickname) {
    return { ok: false };
  }

  try {
    const response = await fetch(`${API_BASE}/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: profile.playerId,
        nickname: profile.nickname,
        day,
        scores
      })
    });

    const data = await response.json().catch(() => null);

    return response.ok && data?.ok ? data : { ok: false };

  } catch (error) {
    return { ok: false };
  }
}


/**
 * @param {"daily"|"alltime"|"challenge"} type
 * @returns {Promise<{ok: boolean, list: Array, me: object|null}>}
 */
export async function fetchRanking(type = "daily") {
  const profile = getProfile();

  const params = new URLSearchParams({
    type: ["alltime", "challenge"].includes(type) ? type : "daily",
    playerId: profile.playerId
  });

  try {
    const response = await fetch(`${API_BASE}/ranking?${params}`, {
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      return { ok: false, list: [], me: null };
    }

    return data;

  } catch (error) {
    return { ok: false, list: [], me: null };
  }
}


/* ==========================================
INTERNAL
========================================== */

function readSent() {
  try {
    const data = JSON.parse(
      window.localStorage.getItem(SENT_KEY) || "null"
    );

    return {
      day: String(data?.day ?? ""),
      nickname: String(data?.nickname ?? ""),
      score: Number(data?.score) || 0
    };
  } catch (error) {
    return { day: "", nickname: "", score: 0 };
  }
}

function writeSent(value) {
  try {
    window.localStorage.setItem(SENT_KEY, JSON.stringify(value));
  } catch (error) {
    // Ignore.
  }
}
