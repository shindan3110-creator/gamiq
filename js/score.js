// GAMIQ（ゲーミック） v2 - Score Engine
//
// LEVEL SYSTEM (Step 19)
// - Every level measures your GAMIQ from 25 games
//   (5 genres x 5 games as the baseline; games are fully random,
//   so some genres may come more often - that is fine).
// - CONFIDENCE goes up evenly: 25 games = 100%.
// - At 100%: the level's GAMIQ is fixed, you level up,
//   and measuring starts again from 0% at the next level.
// - Max level is 10. After Lv10 you keep re-measuring at Lv10.
// - Records last ONE DAY. Everything resets at 0:00 UTC
//   (9:00 in Japan).
//
// RANKING SCORE = GAMIQ x (1 + 0.15 x (level - 1))

const STORAGE_KEY = "gamiq_v2_record";
const STORAGE_VERSION = 2;

export const GAMES_PER_LEVEL = 25;
export const MAX_LEVEL = 10;

const LEVEL_BONUS = 0.15;

// The ranking score is only counted after this many games
// in a level (too few games = too much luck).
const MIN_GAMES_FOR_RANK = 5;

const SKILLS = [
  "REFLEX",
  "SPEED",
  "AIM",
  "LOGIC",
  "MEMORY"
];


/* ==========================================
DAY (UTC)
========================================== */

export function todayKey(now = new Date()) {
  // "2026-10-17" in UTC
  return now.toISOString().slice(0, 10);
}

export function msUntilReset(now = new Date()) {
  const next = new Date(now);

  next.setUTCHours(24, 0, 0, 0);

  return next.getTime() - now.getTime();
}

export function rankScoreFor(gamiq, level) {
  if (!Number.isFinite(gamiq)) {
    return null;
  }

  return Math.round(
    gamiq * (1 + LEVEL_BONUS * (level - 1))
  );
}


export class GamiqScore {
  constructor() {
    this.resetState();
    this.load();
  }

  resetState() {
    this.day = todayKey();

    // Scores of the CURRENT level only (reset on level up).
    this.skills = {
      REFLEX: [],
      SPEED: [],
      AIM: [],
      LOGIC: [],
      MEMORY: [],
      ADAPT: []
    };

    this.level = 1;
    this.levelPlayed = 0;

    // Finished levels today: { level, gamiq, rankScore, at }
    this.levelHistory = [];

    // Today's totals (all levels)
    this.played = 0;

    this.cleared = 0;
    this.failed = 0;

    this.currentStreak = 0;
    this.bestStreak = 0;

    this.totalPlayMs = 0;

    // Best ranking score today: { score, gamiq, level }
    // (gamiq + level are kept so the server can check the score)
    this.bestRank = null;
  }

  resetLevelMeasurement() {
    for (const skill of Object.keys(this.skills)) {
      this.skills[skill] = [];
    }

    this.levelPlayed = 0;
  }


  /* ==========================================
  NEW DAY CHECK
  Returns true if the record was reset.
  ========================================== */

  checkDay() {
    if (this.day === todayKey()) {
      return false;
    }

    this.resetState();
    this.save();

    return true;
  }


  /* ==========================================
  SAVE / LOAD (localStorage)
  ========================================== */

  load() {
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return;
      }

      const data = JSON.parse(raw);

      // Old format or another day: start fresh.
      if (
        !data ||
        data.version !== STORAGE_VERSION ||
        data.day !== todayKey() ||
        typeof data.skills !== "object"
      ) {
        return;
      }

      for (const skill of Object.keys(this.skills)) {
        const values = data.skills[skill];

        if (Array.isArray(values)) {
          this.skills[skill] = values
            .map(Number)
            .filter(Number.isFinite)
            .slice(-GAMES_PER_LEVEL);
        }
      }

      this.level =
        clampInt(data.level, 1, MAX_LEVEL, 1);

      this.levelPlayed =
        clampInt(data.levelPlayed, 0, GAMES_PER_LEVEL - 1, 0);

      this.levelHistory =
        Array.isArray(data.levelHistory)
          ? data.levelHistory
              .filter(item => item && Number.isFinite(item.gamiq))
              .slice(-50)
          : [];

      this.played = safeCount(data.played);
      this.cleared = safeCount(data.cleared);
      this.failed = safeCount(data.failed);
      this.currentStreak = safeCount(data.currentStreak);
      this.bestStreak = safeCount(data.bestStreak);
      this.totalPlayMs = safeCount(data.totalPlayMs);

      this.bestRank =
        data.bestRank &&
        Number.isFinite(data.bestRank.score) &&
        Number.isFinite(data.bestRank.gamiq) &&
        Number.isFinite(data.bestRank.level)
          ? {
              score: data.bestRank.score,
              gamiq: data.bestRank.gamiq,
              level: data.bestRank.level
            }
          : null;

    } catch (error) {
      // Broken or blocked storage: start fresh.
      this.resetState();
    }
  }

  save() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: STORAGE_VERSION,
          day: this.day,
          skills: this.skills,
          level: this.level,
          levelPlayed: this.levelPlayed,
          levelHistory: this.levelHistory,
          played: this.played,
          cleared: this.cleared,
          failed: this.failed,
          currentStreak: this.currentStreak,
          bestStreak: this.bestStreak,
          totalPlayMs: this.totalPlayMs,
          bestRank: this.bestRank,
          savedAt: Date.now()
        })
      );
    } catch (error) {
      // Private mode etc. The game keeps working without saving.
    }
  }

  clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }

  average(values) {
    if (!values.length) return null;

    return (
      values.reduce((sum, value) => sum + value, 0) /
      values.length
    );
  }


  /* ==========================================
  ADD RESULT
  Returns level-up info when a level was just finished,
  otherwise null.
  ========================================== */

  addResult({
    skill,
    score,
    adapt = 50,
    success = null,
    durationMs = 0
  }) {
    if (!this.skills[skill]) {
      return null;
    }

    // Played past 0:00 UTC: today's record starts fresh.
    this.checkDay();

    const safeScore = this.clamp(
      Math.round(score)
    );

    const safeAdapt = this.clamp(
      Math.round(adapt)
    );

    this.skills[skill].push(safeScore);
    this.skills.ADAPT.push(safeAdapt);

    this.played++;
    this.levelPlayed++;

    if (success === true) {
      this.cleared++;
      this.currentStreak++;

      this.bestStreak = Math.max(
        this.bestStreak,
        this.currentStreak
      );
    } else if (success === false) {
      this.failed++;
      this.currentStreak = 0;
    }

    this.totalPlayMs += Math.max(
      0,
      Math.round(Number(durationMs) || 0)
    );

    // Live ranking score (after a few games in this level)
    if (this.levelPlayed >= MIN_GAMES_FOR_RANK) {
      this.updateBestRank(
        this.getLiveRankScore(),
        this.getLevelGamiq(),
        this.level
      );
    }

    let levelUp = null;

    if (this.levelPlayed >= GAMES_PER_LEVEL) {
      levelUp = this.finishLevel();
    }

    this.save();

    return levelUp;
  }

  finishLevel() {
    const gamiq = this.getLevelGamiq();
    const finishedLevel = this.level;
    const rankScore = rankScoreFor(gamiq, finishedLevel);

    this.levelHistory.push({
      level: finishedLevel,
      gamiq,
      rankScore,
      // Skill scores of this level (for the share image after a level up)
      abilities: {
        REFLEX: this.getSkillScore("REFLEX"),
        SPEED: this.getSkillScore("SPEED"),
        AIM: this.getSkillScore("AIM"),
        LOGIC: this.getSkillScore("LOGIC"),
        MEMORY: this.getSkillScore("MEMORY")
      },
      at: Date.now()
    });

    this.updateBestRank(rankScore, gamiq, finishedLevel);

    const maxed = finishedLevel >= MAX_LEVEL;

    if (!maxed) {
      this.level++;
    }

    this.resetLevelMeasurement();

    return {
      level: finishedLevel,
      gamiq,
      rankScore,
      nextLevel: this.level,
      maxed
    };
  }

  updateBestRank(score, gamiq, level) {
    if (
      !Number.isFinite(score) ||
      !Number.isFinite(gamiq)
    ) {
      return;
    }

    if (
      this.bestRank === null ||
      score > this.bestRank.score
    ) {
      this.bestRank = { score, gamiq, level };
    }
  }


  /* ==========================================
  NUMBERS
  ========================================== */

  getSkillScore(skill) {
    const value =
      this.average(this.skills[skill] || []);

    return value === null
      ? null
      : Math.round(value);
  }

  getAbilityCounts() {
    return {
      REFLEX: this.skills.REFLEX.length,
      SPEED: this.skills.SPEED.length,
      AIM: this.skills.AIM.length,
      LOGIC: this.skills.LOGIC.length,
      MEMORY: this.skills.MEMORY.length
    };
  }

  // GAMIQ of the level being measured now.
  getLevelGamiq() {
    const measuredScores =
      SKILLS
        .map(skill =>
          this.average(this.skills[skill])
        )
        .filter(value => value !== null);

    if (!measuredScores.length) {
      return null;
    }

    const base =
      this.average(measuredScores);

    const adapt =
      this.average(this.skills.ADAPT);

    const combined =
      adapt === null
        ? base
        : base * 0.85 + adapt * 0.15;

    return Math.round(
      300 + combined * 7
    );
  }

  getLastFinishedLevel() {
    return this.levelHistory.at(-1) ?? null;
  }

  // What the header shows: the level being measured,
  // or the last fixed GAMIQ right after a level up.
  getGamiq() {
    return (
      this.getLevelGamiq() ??
      this.getLastFinishedLevel()?.gamiq ??
      null
    );
  }

  getLiveRankScore() {
    if (this.levelPlayed < MIN_GAMES_FOR_RANK) {
      return null;
    }

    return rankScoreFor(
      this.getLevelGamiq(),
      this.level
    );
  }

  // Even steps: 25 games = 100%.
  getConfidence() {
    return Math.min(
      100,
      Math.round(
        (this.levelPlayed / GAMES_PER_LEVEL) * 100
      )
    );
  }

  getSummary() {
    this.checkDay();

    return {
      day: this.day,

      played: this.played,

      level: this.level,
      maxLevel: MAX_LEVEL,
      levelPlayed: this.levelPlayed,
      gamesPerLevel: GAMES_PER_LEVEL,
      gamesToLevelUp: GAMES_PER_LEVEL - this.levelPlayed,

      levelHistory: [...this.levelHistory],

      gamiq:
        this.getGamiq(),

      levelGamiq:
        this.getLevelGamiq(),

      confidence:
        this.getConfidence(),

      bestRank:
        this.bestRank ? { ...this.bestRank } : null,

      bestRankScore:
        this.bestRank?.score ?? null,

      abilities: {
        REFLEX:
          this.getSkillScore("REFLEX"),

        SPEED:
          this.getSkillScore("SPEED"),

        AIM:
          this.getSkillScore("AIM"),

        LOGIC:
          this.getSkillScore("LOGIC"),

        MEMORY:
          this.getSkillScore("MEMORY"),

        ADAPT:
          this.getSkillScore("ADAPT")
      },

      counts:
        this.getAbilityCounts(),

      cleared:
        this.cleared,

      failed:
        this.failed,

      clearRate:
        this.cleared + this.failed > 0
          ? Math.round(
              100 * this.cleared /
              (this.cleared + this.failed)
            )
          : null,

      currentStreak:
        this.currentStreak,

      bestStreak:
        this.bestStreak,

      totalPlaySeconds:
        Math.round(this.totalPlayMs / 1000)
    };
  }

  reset() {
    this.resetState();

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Ignore.
    }
  }
}


function safeCount(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? Math.floor(number)
    : 0;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.floor(number)));
}
