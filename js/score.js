// GAMIQ（ゲーミック） v2 - Score Engine

// Saved in this browser so GAMIQ continues after a reload.
const STORAGE_KEY = "gamiq_v2_record";
const STORAGE_VERSION = 1;

// Keep the newest scores only, so storage never grows forever.
const MAX_SCORES_PER_SKILL = 300;

export class GamiqScore {
  constructor() {
    this.resetState();
    this.load();
  }

  resetState() {
    this.skills = {
      REFLEX: [],
      SPEED: [],
      AIM: [],
      LOGIC: [],
      MEMORY: [],
      ADAPT: []
    };

    this.played = 0;

    this.cleared = 0;
    this.failed = 0;

    this.currentStreak = 0;
    this.bestStreak = 0;

    this.totalPlayMs = 0;
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

      if (
        !data ||
        data.version !== STORAGE_VERSION ||
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
            .slice(-MAX_SCORES_PER_SKILL);
        }
      }

      this.played = safeCount(data.played);
      this.cleared = safeCount(data.cleared);
      this.failed = safeCount(data.failed);
      this.currentStreak = safeCount(data.currentStreak);
      this.bestStreak = safeCount(data.bestStreak);
      this.totalPlayMs = safeCount(data.totalPlayMs);

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
          skills: this.skills,
          played: this.played,
          cleared: this.cleared,
          failed: this.failed,
          currentStreak: this.currentStreak,
          bestStreak: this.bestStreak,
          totalPlayMs: this.totalPlayMs,
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

  addResult({
    skill,
    score,
    adapt = 50,
    success = null,
    durationMs = 0
  }) {
    if (!this.skills[skill]) {
      return;
    }

    const safeScore = this.clamp(
      Math.round(score)
    );

    const safeAdapt = this.clamp(
      Math.round(adapt)
    );

    this.skills[skill].push(safeScore);
    this.skills.ADAPT.push(safeAdapt);

    this.skills[skill] =
      this.skills[skill].slice(-MAX_SCORES_PER_SKILL);

    this.skills.ADAPT =
      this.skills.ADAPT.slice(-MAX_SCORES_PER_SKILL);

    this.played++;

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

    this.save();
  }

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

  getGamiq() {
    const mainSkills = [
      "REFLEX",
      "SPEED",
      "AIM",
      "LOGIC",
      "MEMORY"
    ];

    const measuredScores =
      mainSkills
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

  getCoverage() {
    const counts =
      Object.values(
        this.getAbilityCounts()
      );

    const measured =
      counts.filter(
        count => count > 0
      ).length;

    return measured / 5;
  }

  getSampleStrength() {
    const counts =
      Object.values(
        this.getAbilityCounts()
      );

    const normalized =
      counts.map(count =>
        Math.min(1, count / 5)
      );

    return (
      normalized.reduce(
        (sum, value) => sum + value,
        0
      ) / 5
    );
  }

  getConfidence() {
    if (this.played === 0) {
      return 0;
    }

    const volume =
      1 - Math.exp(
        -this.played / 18
      );

    const coverage =
      this.getCoverage();

    const sampleStrength =
      this.getSampleStrength();

    const confidence =
      100 * (
        volume * 0.4 +
        coverage * 0.35 +
        sampleStrength * 0.25
      );

    return Math.min(
      99,
      Math.round(confidence)
    );
  }

  getNextConfidenceTarget() {
    const current =
      this.getConfidence();

    const targets = [
      50,
      60,
      70,
      75,
      80,
      85,
      90,
      95
    ];

    const nextTarget =
      targets.find(
        target => target > current
      );

    if (!nextTarget) {
      return null;
    }

    return nextTarget;
  }

  estimateGamesToTarget(target) {
    if (!target) {
      return null;
    }

    const currentPlayed =
      this.played;

    const originalSkills =
      JSON.parse(
        JSON.stringify(this.skills)
      );

    const originalPlayed =
      this.played;

    let simulatedGames = 0;

    while (
      this.getConfidence() < target &&
      simulatedGames < 100
    ) {
      const counts =
        this.getAbilityCounts();

      const nextSkill =
        Object.entries(counts)
          .sort(
            (a, b) => a[1] - b[1]
          )[0][0];

      this.skills[nextSkill].push(70);
      this.skills.ADAPT.push(70);

      this.played++;
      simulatedGames++;
    }

    this.skills = originalSkills;
    this.played = originalPlayed;

    return simulatedGames;
  }

  getSummary() {
    const target =
      this.getNextConfidenceTarget();

    return {
      played: this.played,

      gamiq:
        this.getGamiq(),

      confidence:
        this.getConfidence(),

      nextConfidenceTarget:
        target,

      gamesToNextTarget:
        this.estimateGamesToTarget(
          target
        ),

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
