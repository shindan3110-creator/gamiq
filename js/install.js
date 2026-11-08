// GAMIQ（ゲーミック） v2 - Add to Home Screen
//
// Phones only. After a few games, a small card at the bottom says
// "Add GAMIQ to your home screen". Then GAMIQ opens like an app (full screen).
//
//   Android Chrome: the real install dialog (beforeinstallprompt)
//   iPhone Safari:   steps (Share button -> "Add to Home Screen")
//   other browsers / in-app browsers (X, TikTok, LINE...): how to open it first
//
// Shown at most 3 times, at least 3 days apart. Never again after adding.
// Not used on CrazyGames.

import { IS_CRAZYGAMES } from "./platform.js";
import { t } from "./i18n.js";

const STORE_KEY = "gamiq_install";
const SHOW_AFTER_GAMES = 4;
const MAX_TIMES = 3;
const GAP_MS = 3 * 24 * 60 * 60 * 1000;

let deferredPrompt = null;
let shownThisSession = false;
let cardEl = null;
let hideTimer = null;

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
  } catch (error) {
    return {};
  }
}

function writeState(next) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...readState(), ...next }));
  } catch (error) {
    // ignore (private mode etc.)
  }
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function isPhone() {
  return window.matchMedia?.("(pointer: coarse)")?.matches && Math.min(screen.width, screen.height) < 820;
}

function browserKind() {
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const inApp = /Line\/|FBAN|FBAV|Instagram|Twitter|TikTok|musical_ly|Bytedance|BytedanceWebview|KAKAOTALK|; wv\)/i.test(ua);
  if (ios) {
    if (inApp) return "iosInApp";
    if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return "iosOther";
    return "iosSafari";
  }
  if (inApp) return "androidInApp";
  return "android";
}


/* ---------- START ---------- */

export function initInstall() {
  if (IS_CRAZYGAMES) return;

  // The service worker is needed for "install". It never serves old files
  // when online (network first), so new uploads show up right away.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
  });

  window.addEventListener("appinstalled", () => {
    writeState({ done: true });
    deferredPrompt = null;
    hideCard();
  });

  if (isStandalone()) writeState({ done: true });
}


/* ---------- OFFER ---------- */

export function maybeOfferInstall(gamesThisSession) {
  if (IS_CRAZYGAMES || shownThisSession) return;
  if (gamesThisSession < SHOW_AFTER_GAMES) return;
  if (isStandalone() || !isPhone()) return;

  const state = readState();
  if (state.done) return;
  if ((state.times || 0) >= MAX_TIMES) return;
  if (state.last && Date.now() - state.last < GAP_MS) return;

  shownThisSession = true;
  writeState({ times: (state.times || 0) + 1, last: Date.now() });
  showCard();
}

function showCard() {
  hideCard();

  cardEl = document.createElement("div");
  cardEl.className = "gq-install";
  cardEl.innerHTML = `
    <img src="/icon-192.png" alt="" width="44" height="44">
    <div class="gq-install-text">
      <b>${t("pwa.title")}</b>
      <span>${t("pwa.sub")}</span>
    </div>
    <button type="button" class="gq-install-add" data-add>${t("pwa.add")}</button>
    <button type="button" class="gq-install-close" data-close aria-label="close">×</button>
  `;
  document.body.appendChild(cardEl);
  requestAnimationFrame(() => cardEl?.classList.add("show"));

  cardEl.querySelector("[data-add]").addEventListener("click", onAdd);
  cardEl.querySelector("[data-close]").addEventListener("click", hideCard);

  // Don't stay in the way of the next game.
  hideTimer = setTimeout(hideCard, 15000);
}

function hideCard() {
  clearTimeout(hideTimer);
  if (!cardEl) return;
  const el = cardEl;
  cardEl = null;
  el.classList.remove("show");
  setTimeout(() => el.remove(), 300);
}

async function onAdd() {
  clearTimeout(hideTimer);

  if (deferredPrompt) {
    const prompt = deferredPrompt;
    deferredPrompt = null;
    try {
      prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === "accepted") writeState({ done: true });
    } catch (error) {
      // ignore
    }
    hideCard();
    return;
  }

  showHowTo();
}

function showHowTo() {
  if (!cardEl) return;
  const kind = browserKind();
  const steps = t(`pwa.how.${kind}`).split("|");

  cardEl.classList.add("howto");
  cardEl.innerHTML = `
    <div class="gq-install-how">
      <b>${t("pwa.howTitle")}</b>
      <ol>${steps.map(s => `<li>${s}</li>`).join("")}</ol>
      <button type="button" class="gq-install-add" data-close>${t("pwa.ok")}</button>
    </div>
    ${kind === "iosSafari" ? '<i class="gq-install-arrow"></i>' : ""}
  `;
  cardEl.querySelector("[data-close]").addEventListener("click", hideCard);
}
