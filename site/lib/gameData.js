// Reads the game's Fishing Derby CSV files into one validated object. No DOM, no Node API: runs in the page, the worker and the tests.
import { parseCsv, parseNumber } from "./csv.js";

/** The seven upgrades the engine knows, in the order used for ties and display. */
export const UPGRADE_IDS = ["LuresPerPrestige", "LuresPerDay", "FishingHook", "FishingSkill", "FishingBait", "TackleBoxSpeed", "TackleBoxSize"];

/** The CSV files the tool reads, by role. */
export const DATA_FILES = {
  upgrades: "MinigameFishingDerbyUpgradeInfo.csv",
  rarity: "MinigameFishingDerbyRarityInfo.csv",
  xp: "MinigameFishingDerbyXPInfo.csv",
  fish: "MinigameFishingDerbyFishInfo.csv",
  solo: "MinigameFishingDerbySoloContributionRewards.csv"
};

const RARITIES = [0, 1, 2, 3, 4];

const COLUMNS = {
  upgrades: ["FishingDerbyUpgradeID", "BonusType", "MaxLevel", "XPCost", "BonusValue"],
  rarity: ["Level", ...RARITIES.map((r) => `Rarity${r}`), ...RARITIES.map((r) => `Rarity${r}%`)],
  xp: ["FishingDerbyRarity", "XP"],
  fish: ["FishID", "FishingLevelToCatch", "BaseSize", "MinSize", "MaxSize", "RaritySize"],
  solo: ["RewardID", "TotalCollectionSizeRequired", "RewardString"]
};

/** A problem in the game data; the message names the file, and the row and column when there is one. */
export class DataError extends Error {
  constructor(message) {
    super(message);
    this.name = "DataError";
  }
}

/** Parses one file and checks its columns; returns records with their 1-based data row. */
function records(key, text) {
  const file = DATA_FILES[key];
  const rows = parseCsv(text);
  if (rows.length === 0) throw new DataError(`${file}: no data`);
  for (const column of COLUMNS[key]) {
    if (!(column in rows[0])) throw new DataError(`${file}: missing column ${column}`);
  }
  return rows.map((cells, i) => ({ cells, row: i + 1, file }));
}

function fail(rec, column, problem) {
  return new DataError(`${rec.file}: row ${rec.row}, column ${column}: ${problem}`);
}

function number(rec, column) {
  const value = parseNumber(rec.cells[column]);
  if (Number.isNaN(value)) throw fail(rec, column, `not a number (${JSON.stringify(rec.cells[column])})`);
  return value;
}

function numberList(rec, column) {
  return rec.cells[column].split(",").map((item, i) => {
    const value = parseNumber(item.trim());
    if (Number.isNaN(value)) throw fail(rec, column, `item ${i + 1} is not a number (${JSON.stringify(item)})`);
    return value;
  });
}

function readUpgrades(text) {
  const recs = records("upgrades", text);
  const upgrades = {};
  for (const rec of recs) {
    const id = rec.cells.FishingDerbyUpgradeID;
    if (!UPGRADE_IDS.includes(id)) throw fail(rec, "FishingDerbyUpgradeID", `unknown upgrade ${id}`);
    if (upgrades[id]) throw fail(rec, "FishingDerbyUpgradeID", `duplicate upgrade ${id}`);
    const maxLevel = number(rec, "MaxLevel");
    if (!Number.isInteger(maxLevel) || maxLevel < 1) throw fail(rec, "MaxLevel", "must be a whole number of at least 1");
    upgrades[id] = { id, bonusType: rec.cells.BonusType, maxLevel, costs: numberList(rec, "XPCost"), values: numberList(rec, "BonusValue") };
  }
  for (const id of UPGRADE_IDS) {
    if (!upgrades[id]) throw new DataError(`${DATA_FILES.upgrades}: missing upgrade ${id}`);
  }
  return upgrades;
}

function readRarity(text) {
  const recs = records("rarity", text);
  return recs.map((rec, i) => {
    const level = number(rec, "Level");
    if (level !== i + 1) throw fail(rec, "Level", `expected level ${i + 1}, levels must run from 1 without gaps`);
    const weights = RARITIES.map((r) => number(rec, `Rarity${r}`));
    const total = weights.reduce((a, b) => a + b, 0);
    if (!(total > 0)) throw fail(rec, "Rarity0", "the weights add up to 0");
    const probabilities = weights.map((w) => w / total);
    RARITIES.forEach((r) => {
      const column = `Rarity${r}%`;
      if (Math.abs(number(rec, column) - probabilities[r]) > 1e-6) throw fail(rec, column, `disagrees with the weights (${probabilities[r]})`);
    });
    return { level, probabilities };
  });
}

function readXp(text) {
  const recs = records("xp", text);
  const names = recs.map((rec) => rec.cells.FishingDerbyRarity);
  const expected = RARITIES.map((r) => `Rarity${r}`);
  if (names.join() !== expected.join()) throw new DataError(`${DATA_FILES.xp}: expected the rows ${expected.join(", ")}, found ${names.join(", ")}`);
  return recs.map((rec) => number(rec, "XP"));
}

function readFish(text) {
  const seen = new Set();
  return records("fish", text).map((rec) => {
    const id = number(rec, "FishID");
    if (seen.has(id)) throw fail(rec, "FishID", `duplicate fish ${id}`);
    seen.add(id);
    return {
      id,
      levelToCatch: number(rec, "FishingLevelToCatch"),
      baseSize: number(rec, "BaseSize"),
      minSize: number(rec, "MinSize"),
      maxSize: number(rec, "MaxSize"),
      raritySize: number(rec, "RaritySize")
    };
  });
}

function readSolo(text) {
  let previous = -Infinity;
  return records("solo", text).map((rec) => {
    const sizeRequired = number(rec, "TotalCollectionSizeRequired");
    if (!(sizeRequired > previous)) throw fail(rec, "TotalCollectionSizeRequired", "thresholds must go strictly up");
    previous = sizeRequired;
    return { id: number(rec, "RewardID"), sizeRequired, reward: rec.cells.RewardString };
  });
}

/**
 * Builds the game data from the texts of the DATA_FILES, keyed like DATA_FILES.
 * Throws a DataError naming the file (and the row and column) of the first problem found.
 */
export function buildGameData(texts) {
  for (const key of Object.keys(DATA_FILES)) {
    if (typeof texts[key] !== "string") throw new DataError(`${DATA_FILES[key]}: not loaded`);
  }
  return {
    upgrades: readUpgrades(texts.upgrades),
    rarityLevels: readRarity(texts.rarity),
    xpByRarity: readXp(texts.xp),
    fish: readFish(texts.fish),
    soloTiers: readSolo(texts.solo)
  };
}
