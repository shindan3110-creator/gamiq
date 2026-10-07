// GAMIQ（ゲーミック） v2 - Analytics

export class GamiqAnalytics {
  constructor() {
    this.enabled =
      typeof window.gtag === "function";
  }

  send(
    eventName,
    params = {}
  ) {
    if (!this.enabled) {
      return;
    }

    try {
      window.gtag(
        "event",
        eventName,
        params
      );
    } catch (error) {
      // Analytics failures should never stop the game.
    }
  }

  gameStart({
    source = "start_screen"
  } = {}) {
    this.send(
      "game_start",
      {
        source
      }
    );
  }

  miniGameStart(game) {
    if (!game) {
      return;
    }

    this.send(
      "mini_game_start",
      {
        game_id:
          game.id ?? "",

        game_title:
          game.title ?? "",

        game_type:
          game.type ?? "",

        game_skill:
          game.skill ?? "",

        game_theme:
          game.theme ?? ""
      }
    );
  }

  miniGameComplete({
    game,
    score,
    adapt,
    summary
  }) {
    if (!game) {
      return;
    }

    this.send(
      "game_complete",
      {
        game_id:
          game.id ?? "",

        game_title:
          game.title ?? "",

        game_type:
          game.type ?? "",

        game_skill:
          game.skill ?? "",

        game_theme:
          game.theme ?? "",

        game_score:
          score ?? 0,

        adapt_score:
          adapt ?? 50,

        games_played:
          summary?.played ?? 0,

        gamiq_score:
          summary?.gamiq ?? 0,

        measurement_confidence:
          summary?.confidence ?? 0
      }
    );
  }

  resultsOpen(summary) {
    this.send(
      "results_open",
      {
        games_played:
          summary?.played ?? 0,

        gamiq_score:
          summary?.gamiq ?? 0,

        measurement_confidence:
          summary?.confidence ?? 0
      }
    );
  }

  resultsContinue(summary) {
    this.send(
      "results_continue",
      {
        games_played:
          summary?.played ?? 0,

        gamiq_score:
          summary?.gamiq ?? 0
      }
    );
  }

  feedAdvance({
    fromGame,
    toGame,
    played
  }) {
    this.send(
      "feed_advance",
      {
        from_game:
          fromGame?.id ?? "",

        to_game:
          toGame?.id ?? "",

        games_played:
          played ?? 0
      }
    );
  }

  error({
    area,
    message
  }) {
    this.send(
      "gamiq_error",
      {
        error_area:
          area ?? "unknown",

        error_message:
          String(
            message ?? ""
          ).slice(0, 120)
      }
    );
  }
}
