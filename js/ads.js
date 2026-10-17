// GAMIQ（ゲーミック） v2 - Ad Break Hook
//
// Right now this does NOTHING (no ads are shown).
// It is the one place to plug in an ad SDK later
// (for example the CrazyGames SDK at Full Launch).
//
// Rules we will follow when ads are added
// (from the CrazyGames ad requirements):
// - Only at natural breaks: level up / after a game is finished.
// - Never during gameplay.
// - Block input while the ad runs, mute sound only while it plays.
// - If the ad fails or is blocked, the game simply continues.
// - The SDK limits midgame ads (max 1 every 3 minutes),
//   so we can ask at every break and let the SDK decide.
//
// Usage:
//   await requestBreakAd("level_up");

let adRunning = false;

export function isAdRunning() {
  return adRunning;
}

/**
 * Ask for an ad at a natural break.
 * Always resolves (never throws), so the game can continue.
 *
 * @param {"level_up"|"game_end"} reason
 * @returns {Promise<boolean>} true if an ad was shown
 */
export async function requestBreakAd(reason = "game_end") {
  if (adRunning) {
    return false;
  }

  try {
    adRunning = true;

    // === Plug the ad SDK in here later. ===
    // Example only (CrazyGames SDK v3, at Full Launch).
    // Check the official SDK docs before using it:
    //
    //   await new Promise(resolve => {
    //     window.CrazyGames.SDK.ad.requestAd("midgame", {
    //       adStarted: () => { /* mute */ },
    //       adFinished: () => resolve(),
    //       adError: () => resolve()
    //     });
    //   });
    //
    // Until then: no ad.

    void reason;

    return false;

  } catch (error) {
    return false;

  } finally {
    adRunning = false;
  }
}
