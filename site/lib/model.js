// The game model for one player's settings: what a catch is worth, how many lures a visit brings, the daily limit.
// Every per-level quantity is precomputed into a table, because the searches ask for them millions of times.
import { UPGRADE_IDS } from "./gameData.js";
import { RulesError, levelRange, upgradeValue, upgradeCost, missingBases } from "./rules.js";

/** The most decision steps a day the simulation takes; more visits are grouped into steps. */
export const MAX_STEPS_PER_DAY = 12;

/** One table entry per level of an upgrade, indexed by level − min. */
function perLevel(game, rules, id, fn) {
  const { min, max } = levelRange(game, rules, id);
  const table = [];
  for (let level = min; level <= max; level++) table.push(fn(level));
  return { min, table };
}

/**
 * Builds the model. Lures come per decision step: prestige lures (limited per day by the simulation) and Tacklebox lures. settings = { prestigesPerDay ≥ 0, visitsPerDay > 0 }.
 * Throws a RulesError when a base the engine needs is still unknown.
 */
export function createModel(game, rules, settings) {
  const { prestigesPerDay, visitsPerDay } = settings;
  if (!(Number.isFinite(prestigesPerDay) && prestigesPerDay >= 0)) throw new RangeError(`prestigesPerDay must be a number of at least 0 (found ${prestigesPerDay})`);
  if (!(Number.isFinite(visitsPerDay) && visitsPerDay > 0)) throw new RangeError(`visitsPerDay must be a number above 0 (found ${visitsPerDay})`);
  const missing = missingBases(rules);
  if (missing.length) throw new RulesError(`rules.json: missing base: ${missing[0]}`);

  // Beyond MAX_STEPS_PER_DAY visits, purchases and catches are decided in steps of several visits (each step's
  // Tacklebox still fills visit by visit): a simulation's cost grows with its steps, and 48 visits a day left the
  // 2-second search with a third of the length a plan could reach.
  const steps = Math.min(visitsPerDay, MAX_STEPS_PER_DAY);
  const interval = 24 / steps;
  const visitInterval = 24 / visitsPerDay;
  const visitsPerStep = visitsPerDay / steps;
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

  const prestigeTable = perLevel(game, rules, "LuresPerPrestige", (level) => (prestigesPerDay * interval / 24) * (rules.prestigeLuresBase + value("LuresPerPrestige", level)));
  const capacityTable = perLevel(game, rules, "TackleBoxSize", (level) => rules.tackleboxBaseCapacity + value("TackleBoxSize", level));
  const secondsTable = perLevel(game, rules, "TackleBoxSpeed", (level) => rules.tackleboxBaseSeconds + value("TackleBoxSpeed", level) * rules.tackleboxUnitSeconds);
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
    prestigeLuresPerStep: (levels) => at(prestigeTable, levels.LuresPerPrestige),
    tackleboxLuresPerStep: (levels) => {
      const capacity = at(capacityTable, levels.TackleBoxSize);
      const seconds = at(secondsTable, levels.TackleBoxSpeed);
      const perVisit = seconds > 0 ? Math.min(capacity, (visitInterval * 3600) / seconds) : capacity;
      return visitsPerStep * perVisit;
    },
    dailyCap: (levels) => at(capTable, levels.LuresPerDay)
  };
}

/** The solo reward tiers a total length reaches, and the next one (null when all are reached). */
export function tiersReached(soloTiers, length) {
  const reached = soloTiers.filter((t) => t.sizeRequired <= length);
  return { reached, next: soloTiers.find((t) => t.sizeRequired > length) ?? null };
}
