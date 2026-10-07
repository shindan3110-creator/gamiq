// GAMIQ（ゲーミック） v2 - Randomizer

export class GamiqRandomizer {
  constructor() {
    this.history = [];
    this.maxHistory = 6;
  }

  pick(gamePool, abilityCounts = {}) {
    if (!Array.isArray(gamePool) || gamePool.length === 0) {
      throw new Error("gamePool is empty");
    }

    const recent = this.history.slice(-3);

    let candidates = gamePool.filter(game => {
      const sameGameRecently =
        recent.some(item => item.id === game.id);

      const sameTypeRecently =
        recent.length >= 2 &&
        recent.slice(-2).every(
          item => item.type === game.type
        );

      const sameThemeRecently =
        recent.length >= 2 &&
        recent.slice(-2).every(
          item => item.theme === game.theme
        );

      return (
        !sameGameRecently &&
        !sameTypeRecently &&
        !sameThemeRecently
      );
    });

    if (candidates.length === 0) {
      candidates = [...gamePool];
    }

    const lowestAbilityCount =
      Math.min(
        ...Object.values(abilityCounts).length
          ? Object.values(abilityCounts)
          : [0]
      );

    const weightedPool = [];

    candidates.forEach(game => {
      const playedCount =
        abilityCounts[game.skill] ?? 0;

      let weight = 10;

      if (playedCount === lowestAbilityCount) {
        weight += 5;
      }

      if (
        this.history.length &&
        this.history.at(-1)?.skill === game.skill
      ) {
        weight -= 2;
      }

      weight = Math.max(1, weight);

      for (let i = 0; i < weight; i++) {
        weightedPool.push(game);
      }
    });

    const selected =
      weightedPool[
        Math.floor(
          Math.random() * weightedPool.length
        )
      ];

    this.history.push({
      id: selected.id,
      type: selected.type,
      theme: selected.theme,
      skill: selected.skill
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return selected;
  }

  reset() {
    this.history = [];
  }
}
