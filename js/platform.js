// GAMIQ（ゲーミック） v2 - Platform
//
// The same code runs in two places:
//   "web"        our own website (Cloudflare)
//   "crazygames" the CrazyGames build (zip uploaded to CrazyGames)
//
// On CrazyGames (their rules):
//   - no links to other websites that have the game (About / Contact)
//   - no share links to our own website
//   - no Google Analytics (personal data)
//   - API calls must use a full URL (the game is not on our server there)
//
// The CrazyGames zip sets window.GAMIQ_PLATFORM = "crazygames" in index.html.
// As a safety net, CrazyGames addresses are also detected.

const OUR_SITE = "https://gamiq.shindan3110.workers.dev";

function detectPlatform() {
  try {
    if (window.GAMIQ_PLATFORM === "crazygames") return "crazygames";

    const params = new URLSearchParams(location.search);
    if (params.get("platform") === "crazygames") return "crazygames";

    if (/crazygames/i.test(location.hostname)) return "crazygames";

    if (/crazygames/i.test(document.referrer || "")) return "crazygames";
  } catch (error) {
    // ignore
  }

  return "web";
}

export const PLATFORM = detectPlatform();

export const IS_CRAZYGAMES = PLATFORM === "crazygames";

// Where the ranking server is.
// - On our own servers (production, previews, our domain): this server.
//   (So "?platform=crazygames" tests on a preview still use the preview's
//    own ranking.)
// - Anywhere else (the real CrazyGames build): our production server.
function onOurServer() {
  try {
    const host = location.hostname;
    return (
      host === "localhost" ||
      host.endsWith(".shindan3110.workers.dev") ||
      host === "playgamiq.com" ||
      host.endsWith(".playgamiq.com")
    );
  } catch (error) {
    return false;
  }
}

export const API_BASE = onOurServer() ? "/api" : `${OUR_SITE}/api`;

// For CSS: <html class="platform-crazygames">
try {
  document.documentElement.classList.add(`platform-${PLATFORM}`);
} catch (error) {
  // ignore
}
