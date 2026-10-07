// GAMIQ（ゲーミック） v2 - Randomizer

export class GamiqRandomizer {
  constructor() {
    this.history = [];

    // 直近履歴として保持する件数
    this.maxHistory = 8;
  }


  pick(
    gamePool,
    abilityCounts = {}
  ) {
    if (
      !Array.isArray(gamePool) ||
      gamePool.length === 0
    ) {
      throw new Error(
        "gamePool is empty"
      );
    }


    /* ==========================================
    RECENT HISTORY
    ========================================== */

    const recentGames =
      this.history.slice(-3);

    const recentTwo =
      this.history.slice(-2);


    /* ==========================================
    PRIMARY FILTER
    ========================================== */

    let candidates =
      gamePool.filter(
        game => {

          // 同一ゲームの連続感を防止
          const sameGameRecently =
            recentGames.some(
              item =>
                item.id ===
                game.id
            );


          // 同じゲームTYPEが3連続しない
          const sameTypeRecently =
            recentTwo.length >= 2 &&
            recentTwo.every(
              item =>
                item.type ===
                game.type
            );


          // 同じテーマが3連続しない
          const sameThemeRecently =
            recentTwo.length >= 2 &&
            recentTwo.every(
              item =>
                item.theme ===
                game.theme
            );


          return (
            !sameGameRecently &&
            !sameTypeRecently &&
            !sameThemeRecently
          );
        }
      );


    /* ==========================================
    FALLBACK
    ========================================== */

    // 条件が厳しすぎて候補ゼロなら
    // 同一ゲームだけ避ける
    if (
      candidates.length === 0
    ) {
      const lastGame =
        this.history.at(-1);


      candidates =
        gamePool.filter(
          game =>
            game.id !==
            lastGame?.id
        );
    }


    // それでもゼロなら全ゲームを許可
    if (
      candidates.length === 0
    ) {
      candidates =
        [...gamePool];
    }


    /* ==========================================
    ABILITY BALANCING
    ========================================== */

    const counts =
      Object.values(
        abilityCounts
      );


    const lowestAbilityCount =
      counts.length
        ? Math.min(
            ...counts
          )
        : 0;


    const weightedPool = [];


    candidates.forEach(
      game => {

        const playedCount =
          abilityCounts[
            game.skill
          ] ?? 0;


        let weight = 10;


        // 測定回数が一番少ない能力を
        // 少しだけ優先
        if (
          playedCount ===
          lowestAbilityCount
        ) {
          weight += 5;
        }


        const previous =
          this.history.at(-1);


        // 同じ能力が連続する確率を軽く下げる
        if (
          previous?.skill ===
          game.skill
        ) {
          weight -= 3;
        }


        // 同じテーマも軽く下げる
        if (
          previous?.theme ===
          game.theme
        ) {
          weight -= 2;
        }


        // 同じタイプも軽く下げる
        if (
          previous?.type ===
          game.type
        ) {
          weight -= 3;
        }


        weight =
          Math.max(
            1,
            weight
          );


        for (
          let i = 0;
          i < weight;
          i++
        ) {
          weightedPool.push(
            game
          );
        }
      }
    );


    /* ==========================================
    RANDOM PICK
    ========================================== */

    const selected =
      weightedPool[
        Math.floor(
          Math.random() *
          weightedPool.length
        )
      ];


    /* ==========================================
    HISTORY
    ========================================== */

    this.history.push({
      id:
        selected.id,

      type:
        selected.type,

      theme:
        selected.theme,

      skill:
        selected.skill
    });


    if (
      this.history.length >
      this.maxHistory
    ) {
      this.history.shift();
    }


    return selected;
  }


  /* ==========================================
  RESET
  ========================================== */

  reset() {
    this.history = [];
  }


  /* ==========================================
  DEBUG
  ========================================== */

  getHistory() {
    return [
      ...this.history
    ];
  }
}
