// The game model for one player's settings: what a catch is worth, how many lures a visit brings, the daily limit.
// Every per-level quantity is precomputed into a table, because the searches ask for them millions of times.
import { UPGRADE_IDS } from "./gameData.js";
import { RulesError, levelRange, upgradeValue, upgradeCost, missingBases } from "./rules.js";

/** One table entry per level of an upgrade, indexed by level − min. */
function perLevel(game, rules, id, fn) {
  const { min, max } = levelRange(game, rules, id);
  const table = [];
  for (let level = min; level <= max; level++) table.push(fn(level));
  return { min, table };
}

/**
 * Builds the model. settings = { prestigesPerDay ≥ 0, visitsPerDay > 0 }.
 * Throws a RulesError when a base the engine needs is still unknown.
 */
export function createModel(game, rules, settings) {
  const { prestigesPerDay, visitsPerDay } = settings;
  if (!(Number.isFinite(prestigesPerDay) && prestigesPerDay >= 0)) throw new RangeError(`prestigesPerDay must be a number of at least 0 (found ${prestigesPerDay})`);
  if (!(Number.isFinite(visitsPerDay) && visitsPerDay > 0)) throw new RangeError(`visitsPerDay must be a number above 0 (found ${visitsPerDay})`);
  const missing = missingBases(rules);
  if (missing.length) throw new RulesError(`rules.json: missing base: ${missing[0]}`);

  const interval = 24 / visitsPerDay;
  const value = (id, level) => upgradeValue(game, rules, id, level);
  const at = ({ min, table }, level) => table[level - min];

  // Catch size: one row per Fishing Skill level, one column per Fishing Hook level.
  const hookLevels = perLevel(game, rules, "FishingHook", (level) => value("FishingHook", level));
  const sizeTable = perLevel(game, rules, "FishingSkill", (skillLevel) => {
    const skill = value("FishingSkill", skillLevel);
    const unlocked = game.fish.filter((f) => (rules.speciesUnlock === "levelBelowSkill" ? f.levelToCatch < skill : f.levelToCatch <= skill));
    const mean = unlocked.length ? unlocked.reduce((sum, f) => sum + (f.minSize + f.maxSize) / 2, 0) / unlocked.length : 0;
    return hookLevels.table.map((hook) => hook * mean);
  });

  const coinsTable = perLevel(game, rules, rules.rarityLevelFrom, (level) => {
    const rarityLevel = value(rules.rarityLevelFrom, level) + rules.rarityLevelOffset;
    const row = game.rarityLevels.find((r) => r.level === rarityLevel);
    if (!row) throw new RangeError(`rarity level ${rarityLevel} (from ${rules.rarityLevelFrom} level ${level}) is not in the rarity table`);
    return row.probabilities.reduce((sum, p, r) => sum + p * game.xpByRarity[r], 0);
  });

  const prestigeTable = perLevel(game, rules, "LuresPerPrestige", (level) => (prestigesPerDay * interval / 24) * value("LuresPerPrestige", level));
  const capacityTable = perLevel(game, rules, "TackleBoxSize", (level) => rules.tackleboxBaseCapacity + value("TackleBoxSize", level));
  const minutesTable = perLevel(game, rules, "TackleBoxSpeed", (level) => value("TackleBoxSpeed", level) * rules.tackleboxUnitMinutes);
  const capTable = perLevel(game, rules, "LuresPerDay", (level) => rules.dailyCapBase + value("LuresPerDay", level));

  return {
    game,
    rules,
    settings: { prestigesPerDay, visitsPerDay },
    ids: UPGRADE_IDS.filter((id) => !rules.hidden.includes(id)),
    interval,
    range: (id) => levelRange(game, rules, id),
    value,
    cost: (id, level) => upgradeCost(game, rules, id, level),
    catchSize: (levels) => at(sizeTable, levels.FishingSkill)[levels.FishingHook - hookLevels.min],
    catchCoins: (levels) => at(coinsTable, levels[rules.rarityLevelFrom]),
    luresPerVisit: (levels) => {
      const capacity = at(capacityTable, levels.TackleBoxSize);
      const minutes = at(minutesTable, levels.TackleBoxSpeed);
      const tacklebox = minutes > 0 ? Math.min(capacity, (interval * 60) / minutes) : capacity;
      return at(prestigeTable, levels.LuresPerPrestige) + tacklebox;
    },
    dailyCap: (levels) => at(capTable, levels.LuresPerDay)
  };
}

/** The solo reward tiers a total length reaches, and the next one (null when all are reached). */
export function tiersReached(soloTiers, length) {
  const reached = soloTiers.filter((t) => t.sizeRequired <= length);
  return { reached, next: soloTiers.find((t) => t.sizeRequired > length) ?? null };
}
