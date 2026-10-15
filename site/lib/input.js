// The player's input: defaults, tolerant reading of what was saved, saving, and the values still missing before a plan.
import { UPGRADE_IDS } from "./gameData.js";
import { levelRange } from "./rules.js";

export const STORAGE_KEY = "tt2-fishing-derby:input:v1";

/** Every level at its minimum, nothing owned, and the values only the player knows left empty. */
export function defaultInput(game, rules) {
  return {
    levels: Object.fromEntries(UPGRADE_IDS.map((id) => [id, levelRange(game, rules, id).min])),
    coins: 0,
    lures: 0,
    prestigeLuresToday: 0,
    hoursLeft: null,
    lengthSoFar: 0,
    prestigesPerDay: null,
    visitsPerDay: null,
    shown: { dailyCap: null, tackleboxCapacity: null }
  };
}

const amount = (value, fallback) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback);

/** A level as the player typed it, floored and clamped into the upgrade's range; anything that is not a number gives the minimum. */
function level(game, rules, id, value) {
  const { min, max } = levelRange(game, rules, id);
  if (typeof value !== "number" || !Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/** A value the game showed, with the level of its upgrade when it was read; anything else is no reading. */
function reading(game, rules, upgradeId, saved) {
  if (!saved || typeof saved !== "object") return null;
  const { min, max } = levelRange(game, rules, upgradeId);
  const value = amount(saved.value, null);
  if (value === null || !Number.isInteger(saved.level) || saved.level < min || saved.level > max) return null;
  return { value, level: saved.level };
}

/**
 * Reads saved input field by field: a bad field takes its default, the others are kept.
 * Nothing saved, unreadable JSON or another version: all defaults.
 */
export function readInput(raw, game, rules) {
  const defaults = defaultInput(game, rules);
  let saved;
  try {
    saved = raw === null || raw === undefined ? null : JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!saved || typeof saved !== "object" || saved.version !== 1) return defaults;
  const savedLevels = saved.levels && typeof saved.levels === "object" ? saved.levels : {};
  const shown = saved.shown && typeof saved.shown === "object" ? saved.shown : {};
  return {
    levels: Object.fromEntries(UPGRADE_IDS.map((id) => [id, id in savedLevels ? level(game, rules, id, savedLevels[id]) : defaults.levels[id]])),
    coins: amount(saved.coins, defaults.coins),
    lures: amount(saved.lures, defaults.lures),
    prestigeLuresToday: amount(saved.prestigeLuresToday, defaults.prestigeLuresToday),
    hoursLeft: amount(saved.hoursLeft, defaults.hoursLeft),
    lengthSoFar: amount(saved.lengthSoFar, defaults.lengthSoFar),
    prestigesPerDay: amount(saved.prestigesPerDay, defaults.prestigesPerDay),
    visitsPerDay: amount(saved.visitsPerDay, defaults.visitsPerDay),
    shown: { dailyCap: reading(game, rules, "LuresPerDay", shown.dailyCap), tackleboxCapacity: reading(game, rules, "TackleBoxSize", shown.tackleboxCapacity) }
  };
}

export function serializeInput(input) {
  return JSON.stringify({ version: 1, ...input });
}

/** Reads the saved input; a storage that refuses access gives the defaults. */
export function loadInput(storage, game, rules) {
  try {
    return readInput(storage.getItem(STORAGE_KEY), game, rules);
  } catch {
    return defaultInput(game, rules);
  }
}

/** Saves the input; false when the storage refuses it (private mode, full, blocked). */
export function writeInput(storage, input) {
  try {
    storage.setItem(STORAGE_KEY, serializeInput(input));
    return true;
  } catch {
    return false;
  }
}

/** The values the player still has to enter before a plan can be computed, in display order. */
export function missingFields(input, rules) {
  const missing = [];
  if (input.hoursLeft === null) missing.push("hoursLeft");
  if (input.prestigesPerDay === null) missing.push("prestigesPerDay");
  if (input.visitsPerDay === null || input.visitsPerDay === 0) missing.push("visitsPerDay");
  if (rules.dailyCapBase === null && input.shown.dailyCap === null) missing.push("shown.dailyCap");
  if (rules.tackleboxBaseCapacity === null && input.shown.tackleboxCapacity === null) missing.push("shown.tackleboxCapacity");
  return missing;
}
