// tests/fixtures.js — small hand-made data for engine tests (not game values), and the real files.
import fs from "node:fs";
import { buildGameData, DATA_FILES, UPGRADE_IDS } from "../site/lib/gameData.js";
import { loadRules } from "../site/lib/rules.js";

export const allAt = (level) => Object.fromEntries(UPGRADE_IDS.map((id) => [id, level]));

export function tinyGame(costs = {}) {
  const up = (id, values) => ({ id, bonusType: id, maxLevel: 3, costs: costs[id] ?? [10, 20, 40], values });
  return {
    upgrades: {
      LuresPerPrestige: up("LuresPerPrestige", [2, 4, 6]), LuresPerDay: up("LuresPerDay", [0, 10, 20]),
      FishingHook: up("FishingHook", [1, 1.5, 2]), FishingSkill: up("FishingSkill", [1, 2, 3]),
      FishingBait: up("FishingBait", [0, 1, 2]), TackleBoxSpeed: up("TackleBoxSpeed", [60, 30, 15]),
      TackleBoxSize: up("TackleBoxSize", [0, 2, 4])
    },
    rarityLevels: [{ level: 1, probabilities: [1, 0, 0, 0, 0] }, { level: 2, probabilities: [0.5, 0.5, 0, 0, 0] }, { level: 3, probabilities: [0, 0, 1, 0, 0] }],
    xpByRarity: [1, 2, 5, 25, 25],
    fish: [
      { id: 0, levelToCatch: 0, baseSize: 0, minSize: 1, maxSize: 3, raritySize: 0 },
      { id: 1, levelToCatch: 1, baseSize: 1, minSize: 3, maxSize: 5, raritySize: 0 },
      { id: 2, levelToCatch: 2, baseSize: 2, minSize: 5, maxSize: 9, raritySize: 0 }
    ],
    soloTiers: [{ id: 0, sizeRequired: 5, reward: "Diamonds:50" }, { id: 1, sizeRequired: 25, reward: "SkillPoint:1" }, { id: 2, sizeRequired: 100, reward: "PetsLvl5:1" }]
  };
}

export function tinyRules(overrides = {}) {
  return {
    sizeUnit: null, luresPerCatch: 1, tackleboxUnitMinutes: 1, tackleboxBaseCapacity: 4, tackleboxZeroSpeed: "fullEachVisit",
    dailyCapBase: 100, speciesUnlock: "levelBelowSkill", rarityLevelFrom: "FishingBait", rarityLevelOffset: 1,
    minLevel: 1, valueOffset: -1, costOffset: -1,
    names: Object.fromEntries(UPGRADE_IDS.map((id) => [id, id])), hidden: [], list: [], ...overrides
  };
}

export const realGame = () => buildGameData(Object.fromEntries(Object.entries(DATA_FILES).map(([k, f]) => [k, fs.readFileSync(new URL(`../site/data/${f}`, import.meta.url), "utf8")])));
export const realRules = (game) => loadRules(JSON.parse(fs.readFileSync(new URL("../site/data/rules.json", import.meta.url), "utf8")), game);
// Test-only bases: invented to exercise the engine on real data, never shipped as game values.
export const TEST_BASES = { dailyCapBase: 100, tackleboxBaseCapacity: 10 };
