// GAMIQ（ゲーミック） v2 - Score Engine

export class GamiqScore {
  constructor() {
    this.skills = {
      REFLEX: [],
      SPEED: [],
      AIM: [],
      LOGIC: [],
      MEMORY: [],
      ADAPT: []
    };

    this.played = 0;
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
    adapt = 50
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

    this.played++;
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
        this.getAbilityCounts()
    };
  }

  reset() {
    this.skills = {
      REFLEX: [],
      SPEED: [],
      AIM: [],
      LOGIC: [],
      MEMORY: [],
      ADAPT: []
    };

    this.played = 0;
  }
}
