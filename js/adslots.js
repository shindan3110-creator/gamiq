// GAMIQ（ゲーミック） v2 - Ad boxes (AdSense banners)
// (Ad breaks between games are a separate file: ads.js, unused for now.)
//
// Where ads go (decided with the owner):
//   - the results screen (one banner at the bottom)
//   - the empty space left and right of the game on wide PC screens
// No ads between games and no ads while playing.
//
// Ads are OFF until AdSense is approved.
// After approval, fill in ADS_CONFIG below (client + slot numbers).
// That is the only change needed.
//
// Test view: add ?adtest=1 to the URL to see where the ad boxes are.
// Ads never show on CrazyGames or other sites (only on our own site).

import { IS_CRAZYGAMES, ON_OUR_SERVER } from "./platform.js";
import { LANG } from "./i18n.js";

export const ADS_CONFIG = {
  // "ca-pub-xxxxxxxxxxxxxxxx" (from AdSense)
  client: "",

  // Ad unit numbers (AdSense > Ads > By ad unit)
  slots: {
    results: "",
    rail: ""
  }
};

let testMode = false;

try {
  testMode = new URLSearchParams(location.search).get("adtest") === "1";
} catch (error) {
  // ignore
}

const REAL = Boolean(ADS_CONFIG.client);

export const ADS_ON = !IS_CRAZYGAMES && ON_OUR_SERVER && (REAL || testMode);

const LABEL = LANG === "ja" ? "広告" : "Advertisement";

let scriptAdded = false;

function addScript() {
  if (scriptAdded || !REAL) return;

  scriptAdded = true;

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CONFIG.client}`;
  document.head.appendChild(script);
}

/**
 * An empty ad box. It is filled later by fillAds()
 * (an ad needs to be visible to know its size).
 * @param {"results"|"rail"} name
 */
export function adBox(name) {
  if (!ADS_ON) return document.createElement("span");

  const box = document.createElement("div");
  box.className = `gq-ad gq-ad-${name}`;
  box.dataset.adName = name;
  box.innerHTML = `<small class="gq-ad-label">${LABEL}</small><div class="gq-ad-body"></div>`;
  return box;
}

/** Fill the ad boxes inside root that are visible and not filled yet. */
export function fillAds(root = document) {
  if (!ADS_ON) return;

  root.querySelectorAll(".gq-ad:not([data-filled])").forEach(box => {
    if (!box.offsetWidth) return;

    box.dataset.filled = "1";

    const body = box.querySelector(".gq-ad-body");
    const name = box.dataset.adName;
    const slot = ADS_CONFIG.slots[name];

    if (!REAL || !slot) {
      // Test view: just show the size of the box
      body.innerHTML = `<span class="gq-ad-test">AD ${name}<br>${body.offsetWidth} × ${body.offsetHeight || "auto"}</span>`;
      return;
    }

    addScript();

    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.dataset.adClient = ADS_CONFIG.client;
    ins.dataset.adSlot = slot;

    if (name === "results") {
      ins.dataset.adFormat = "auto";
      ins.dataset.fullWidthResponsive = "true";
    } else {
      // Rails have a fixed size (set in CSS)
      ins.style.width = "100%";
      ins.style.height = "100%";
    }

    body.appendChild(ins);

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      // Never break the game because of ads.
    }
  });
}

/**
 * Ads in the empty space left and right of the game (wide PC screens only).
 * CSS hides them on smaller screens; they are filled only when shown.
 */
export function initRails() {
  if (!ADS_ON) return;

  ["left", "right"].forEach(side => {
    const box = adBox("rail");
    box.classList.add(`gq-ad-rail-${side}`);
    document.body.appendChild(box);
  });

  const fill = () => fillAds(document.body);

  fill();

  window.addEventListener("resize", () => {
    clearTimeout(initRails.timer);
    initRails.timer = setTimeout(fill, 300);
  });
}
