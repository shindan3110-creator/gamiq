// GAMIQ（ゲーミック） v2 - Server (Cloudflare Worker)
//
// - Normal files (index.html, js/..., css) are served as static assets.
//   This code only runs for requests that are NOT a file, i.e. /api/...
// - Ranking data is stored in Cloudflare D1 (binding name: DB).
//   Tables are created automatically on the first request.
//
// API
//   POST /api/score
//     { playerId, nickname, day, level, levelPlayed, played, gamiq, rankScore }
//     -> saves today's best score for that player
//   GET  /api/ranking?type=daily[&day=YYYY-MM-DD][&playerId=...]
//   GET  /api/ranking?type=alltime[&playerId=...]
//     -> top 50 (+ your own rank if playerId is given)
//
// Days are UTC (reset at 0:00 UTC = 9:00 Japan).
// RANKING SCORE = GAMIQ x (1 + 0.15 x (level - 1))

const GAMES_PER_LEVEL = 25;
const MAX_LEVEL = 10;
const LEVEL_BONUS = 0.15;

const MIN_GAMES_FOR_RANK = 5;
const TOP_LIMIT = 50;

// Fastest realistic pace: a game (with rule screen) takes 15s+.
const MIN_SECONDS_PER_GAME = 15;

// One player can send at most one score every few seconds.
const MIN_SUBMIT_INTERVAL_MS = 4000;

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 12;
const NICKNAME_ALLOWED = /^[\p{L}\p{N} _.\-]+$/u;

const BLOCKED_WORDS = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot",
  "nazi", "hitler", "porn",
  "admin", "gamiq", "official", "crazygames",
  "死ね", "殺す", "ちんこ", "まんこ", "セックス"
];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS daily_scores (
     day TEXT NOT NULL,
     player_id TEXT NOT NULL,
     nickname TEXT NOT NULL,
     rank_score INTEGER NOT NULL,
     gamiq INTEGER NOT NULL,
     level INTEGER NOT NULL,
     played INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (day, player_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_daily_rank
     ON daily_scores (day, rank_score DESC)`,
  `CREATE TABLE IF NOT EXISTS player_best (
     player_id TEXT PRIMARY KEY,
     nickname TEXT NOT NULL,
     best_score INTEGER NOT NULL,
     best_day TEXT NOT NULL,
     gamiq INTEGER NOT NULL,
     level INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_best_rank
     ON player_best (best_score DESC)`
];

let schemaReady = false;


export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    // Anything else: normal static files (or their 404).
    return env.ASSETS.fetch(request);
  }
};


/* ==========================================
API ROUTER
========================================== */

async function handleApi(request, env, url) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (!env.DB) {
    return json({ ok: false, error: "db_not_configured" }, 503);
  }

  try {
    await ensureSchema(env.DB);

    if (url.pathname === "/api/score" && request.method === "POST") {
      return await postScore(request, env.DB);
    }

    if (url.pathname === "/api/ranking" && request.method === "GET") {
      return await getRanking(url, env.DB);
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, day: todayKey() });
    }

    return json({ ok: false, error: "not_found" }, 404);

  } catch (error) {
    console.error("API error", error);
    return json({ ok: false, error: "server_error" }, 500);
  }
}

async function ensureSchema(db) {
  if (schemaReady) {
    return;
  }

  await db.batch(SCHEMA.map(sql => db.prepare(sql)));

  schemaReady = true;
}


/* ==========================================
POST /api/score
========================================== */

async function postScore(request, db) {
  let body;

  try {
    body = await request.json();
  } catch (error) {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  const check = validateScore(body);

  if (!check.ok) {
    return json({ ok: false, error: check.error }, 400);
  }

  const s = check.value;
  const now = Date.now();

  // Rate limit + keep only the best score of the day
  const existing = await db
    .prepare(
      `SELECT rank_score, updated_at FROM daily_scores
       WHERE day = ? AND player_id = ?`
    )
    .bind(s.day, s.playerId)
    .first();

  if (existing && now - existing.updated_at < MIN_SUBMIT_INTERVAL_MS) {
    return json({ ok: false, error: "too_fast" }, 429);
  }

  await db.batch([
    // Today's best (nickname always updated to the latest)
    db.prepare(
      `INSERT INTO daily_scores
         (day, player_id, nickname, rank_score, gamiq, level, played, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (day, player_id) DO UPDATE SET
         nickname = excluded.nickname,
         played = MAX(daily_scores.played, excluded.played),
         updated_at = excluded.updated_at,
         gamiq = CASE WHEN excluded.rank_score > daily_scores.rank_score
                      THEN excluded.gamiq ELSE daily_scores.gamiq END,
         level = CASE WHEN excluded.rank_score > daily_scores.rank_score
                      THEN excluded.level ELSE daily_scores.level END,
         rank_score = MAX(daily_scores.rank_score, excluded.rank_score)`
    ).bind(
      s.day, s.playerId, s.nickname, s.rankScore,
      s.gamiq, s.level, s.played, now
    ),

    // All-time: best single day
    db.prepare(
      `INSERT INTO player_best
         (player_id, nickname, best_score, best_day, gamiq, level, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (player_id) DO UPDATE SET
         nickname = excluded.nickname,
         updated_at = excluded.updated_at,
         best_day = CASE WHEN excluded.best_score > player_best.best_score
                         THEN excluded.best_day ELSE player_best.best_day END,
         gamiq = CASE WHEN excluded.best_score > player_best.best_score
                      THEN excluded.gamiq ELSE player_best.gamiq END,
         level = CASE WHEN excluded.best_score > player_best.best_score
                      THEN excluded.level ELSE player_best.level END,
         best_score = MAX(player_best.best_score, excluded.best_score)`
    ).bind(
      s.playerId, s.nickname, s.rankScore, s.day,
      s.gamiq, s.level, now
    )
  ]);

  const dailyRank = await rankOf(db, "daily", s.playerId, s.day);
  const allTimeRank = await rankOf(db, "alltime", s.playerId);

  return json({
    ok: true,
    day: s.day,
    dailyRank,
    allTimeRank
  });
}

function validateScore(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "bad_body" };
  }

  const playerId = String(body.playerId ?? "");

  if (!/^[A-Za-z0-9-]{8,64}$/.test(playerId)) {
    return { ok: false, error: "bad_player" };
  }

  const nick = validateNickname(body.nickname);

  if (!nick.ok) {
    return { ok: false, error: nick.error };
  }

  const day = String(body.day ?? "");

  if (day !== todayKey()) {
    return { ok: false, error: "wrong_day" };
  }

  const level = toInt(body.level);
  const levelPlayed = toInt(body.levelPlayed);
  const played = toInt(body.played);
  const gamiq = toInt(body.gamiq);
  const rankScore = toInt(body.rankScore);

  if (
    level === null || level < 1 || level > MAX_LEVEL ||
    levelPlayed === null || levelPlayed < 0 || levelPlayed > GAMES_PER_LEVEL ||
    played === null || played < MIN_GAMES_FOR_RANK || played > 2000 ||
    gamiq === null || gamiq < 300 || gamiq > 1000 ||
    rankScore === null
  ) {
    return { ok: false, error: "bad_numbers" };
  }

  // Ranking score must match the formula.
  const expected = Math.round(gamiq * (1 + LEVEL_BONUS * (level - 1)));

  if (Math.abs(expected - rankScore) > 1) {
    return { ok: false, error: "bad_rank_score" };
  }

  // Level must match the number of games played today.
  // (A finished level counts: level L needs (L-1)*25 games before it.)
  const neededBefore = (level - 1) * GAMES_PER_LEVEL;

  if (played < neededBefore) {
    return { ok: false, error: "bad_level" };
  }

  // Not more games than possible since 0:00 UTC.
  const secondsToday = secondsSinceUtcMidnight();

  if (played * MIN_SECONDS_PER_GAME > secondsToday + 120) {
    return { ok: false, error: "too_many_games" };
  }

  return {
    ok: true,
    value: {
      playerId,
      nickname: nick.value,
      day,
      level,
      levelPlayed,
      played,
      gamiq,
      rankScore
    }
  };
}


/* ==========================================
GET /api/ranking
========================================== */

async function getRanking(url, db) {
  const type =
    url.searchParams.get("type") === "alltime" ? "alltime" : "daily";

  const day =
    /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("day") || "")
      ? url.searchParams.get("day")
      : todayKey();

  const playerId = url.searchParams.get("playerId") || "";

  let rows;

  if (type === "daily") {
    rows = await db
      .prepare(
        `SELECT player_id, nickname, rank_score, gamiq, level
         FROM daily_scores
         WHERE day = ?
         ORDER BY rank_score DESC, updated_at ASC
         LIMIT ?`
      )
      .bind(day, TOP_LIMIT)
      .all();
  } else {
    rows = await db
      .prepare(
        `SELECT player_id, nickname, best_score AS rank_score, gamiq, level, best_day
         FROM player_best
         ORDER BY best_score DESC, updated_at ASC
         LIMIT ?`
      )
      .bind(TOP_LIMIT)
      .all();
  }

  const list = (rows.results || []).map((row, index) => ({
    rank: index + 1,
    nickname: row.nickname,
    rankScore: row.rank_score,
    gamiq: row.gamiq,
    level: row.level,
    day: row.best_day ?? day,
    // Never send other players' IDs. Only mark your own row.
    isMe: Boolean(playerId) && row.player_id === playerId
  }));

  let me = null;

  if (/^[A-Za-z0-9-]{8,64}$/.test(playerId)) {
    me = await myEntry(db, type, playerId, day);
  }

  return json(
    { ok: true, type, day, list, me },
    200,
    { "Cache-Control": "no-store" }
  );
}

async function myEntry(db, type, playerId, day) {
  const row =
    type === "daily"
      ? await db
          .prepare(
            `SELECT nickname, rank_score, gamiq, level
             FROM daily_scores WHERE day = ? AND player_id = ?`
          )
          .bind(day, playerId)
          .first()
      : await db
          .prepare(
            `SELECT nickname, best_score AS rank_score, gamiq, level, best_day
             FROM player_best WHERE player_id = ?`
          )
          .bind(playerId)
          .first();

  if (!row) {
    return null;
  }

  return {
    rank: await rankOf(db, type, playerId, day),
    nickname: row.nickname,
    rankScore: row.rank_score,
    gamiq: row.gamiq,
    level: row.level,
    day: row.best_day ?? day
  };
}

async function rankOf(db, type, playerId, day = todayKey()) {
  const row =
    type === "daily"
      ? await db
          .prepare(
            `SELECT 1 + COUNT(*) AS rank FROM daily_scores
             WHERE day = ?1 AND rank_score > (
               SELECT rank_score FROM daily_scores
               WHERE day = ?1 AND player_id = ?2
             )`
          )
          .bind(day, playerId)
          .first()
      : await db
          .prepare(
            `SELECT 1 + COUNT(*) AS rank FROM player_best
             WHERE best_score > (
               SELECT best_score FROM player_best WHERE player_id = ?1
             )`
          )
          .bind(playerId)
          .first();

  return row ? row.rank : null;
}


/* ==========================================
UTIL
========================================== */

function validateNickname(raw) {
  const value =
    String(raw ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();

  const length = [...value].length;

  if (length < NICKNAME_MIN || length > NICKNAME_MAX) {
    return { ok: false, error: "bad_nickname" };
  }

  if (!NICKNAME_ALLOWED.test(value)) {
    return { ok: false, error: "bad_nickname" };
  }

  const lower = value.toLowerCase().replace(/[ _.\-]/g, "");

  if (BLOCKED_WORDS.some(word => lower.includes(word))) {
    return { ok: false, error: "blocked_nickname" };
  }

  return { ok: true, value };
}

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function secondsSinceUtcMidnight(now = new Date()) {
  return (
    now.getUTCHours() * 3600 +
    now.getUTCMinutes() * 60 +
    now.getUTCSeconds()
  );
}

function toInt(value) {
  const number = Number(value);

  return Number.isFinite(number) ? Math.round(number) : null;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...extraHeaders
    }
  });
}
