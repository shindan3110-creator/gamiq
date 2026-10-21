// GAMIQ（ゲーミック） v2 - Player Profile (nickname)
//
// - No login. The player only types a nickname.
// - A random player ID is made once per browser, so two people
//   with the same nickname are still different players
//   (used by the ranking later).
// - Saved in this browser only (localStorage).
//   The nickname is NOT reset every day (only the score is).

const PROFILE_KEY = "gamiq_v2_profile";

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;

// Letters (any language), numbers, space, _ - .
const ALLOWED = /^[\p{L}\p{N} _.\-]+$/u;

// Very small client-side filter. The server will check again later.
// (Short words like "sex" are left out on purpose: they would also
//  block normal names such as "Essex".)
const BLOCKED_WORDS = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot",
  "nazi", "hitler", "porn",
  "admin", "gamiq", "official", "crazygames",
  "死ね", "殺す", "ちんこ", "まんこ", "セックス"
];

const SUGGEST_WORDS = [
  "Ninja", "Falcon", "Comet", "Tiger", "Pixel", "Rocket",
  "Shadow", "Blaze", "Nova", "Viper", "Echo", "Raven"
];


export function getProfile() {
  let data = null;

  try {
    data = JSON.parse(
      window.localStorage.getItem(PROFILE_KEY) || "null"
    );
  } catch (error) {
    data = null;
  }

  const profile = {
    playerId:
      typeof data?.playerId === "string" && data.playerId.length >= 8
        ? data.playerId
        : makePlayerId(),

    nickname:
      typeof data?.nickname === "string" &&
      validateNickname(data.nickname).ok
        ? data.nickname
        : ""
  };

  // Make sure the player ID is stored right away.
  if (!data || data.playerId !== profile.playerId) {
    writeProfile(profile);
  }

  return profile;
}


/**
 * Check a nickname.
 * @returns {{ok: true, value: string} | {ok: false, error: string}}
 *   error is an i18n key.
 */
export function validateNickname(raw) {
  const value =
    String(raw ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();

  const length = [...value].length;

  if (length < NICKNAME_MIN) {
    return { ok: false, error: "nick.errorShort" };
  }

  if (length > NICKNAME_MAX) {
    return { ok: false, error: "nick.errorLong" };
  }

  if (!ALLOWED.test(value)) {
    return { ok: false, error: "nick.errorChars" };
  }

  const lower =
    value.toLowerCase().replace(/[ _.\-]/g, "");

  if (BLOCKED_WORDS.some(word => lower.includes(word))) {
    return { ok: false, error: "nick.errorBlocked" };
  }

  return { ok: true, value };
}


export function saveNickname(raw) {
  const result = validateNickname(raw);

  if (!result.ok) {
    return result;
  }

  const profile = getProfile();

  profile.nickname = result.value;

  writeProfile(profile);

  return result;
}


export function suggestNickname() {
  const word =
    SUGGEST_WORDS[
      Math.floor(Math.random() * SUGGEST_WORDS.length)
    ];

  const number =
    Math.floor(100 + Math.random() * 900);

  return `${word}${number}`;
}


/* ==========================================
INTERNAL
========================================== */

function writeProfile(profile) {
  try {
    window.localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        playerId: profile.playerId,
        nickname: profile.nickname,
        savedAt: Date.now()
      })
    );
  } catch (error) {
    // Private mode etc. The game still works.
  }
}

function makePlayerId() {
  try {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
  } catch (error) {
    // fall through
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12)
  );
}
