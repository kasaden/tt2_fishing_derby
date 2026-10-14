// Reads data/rules.json: the game rules the engine relies on, each one verified or assumed, and how displayed levels map to the CSV lists.
import { UPGRADE_IDS } from "./gameData.js";

export const RULE_IDS = ["score", "luresPerCatch", "prestigeLures", "tacklebox", "dailyCap", "species", "size", "rarity", "coins", "levels", "unusedLures", "upgradeNames"];

const STATUSES = ["verified", "assumed"];

/** A problem in rules.json, or a value that contradicts it; the message names the rule. */
export class RulesError extends Error {
  constructor(message) {
    super(message);
    this.name = "RulesError";
  }
}

function problem(id, text) {
  return new RulesError(id ? `rules.json: rule ${id}: ${text}` : `rules.json: ${text}`);
}

function oneOf(rule, field, allowed) {
  if (!allowed.includes(rule[field])) throw problem(rule.id, `${field} must be one of ${allowed.join(", ")} (found ${JSON.stringify(rule[field])})`);
  return rule[field];
}

function finite(rule, field) {
  if (typeof rule[field] !== "number" || !Number.isFinite(rule[field])) throw problem(rule.id, `${field} must be a number`);
  return rule[field];
}

function integer(rule, field) {
  if (!Number.isInteger(rule[field])) throw problem(rule.id, `${field} must be a whole number`);
  return rule[field];
}

function base(rule, field) {
  if (rule[field] === null) return null;
  if (finite(rule, field) < 0) throw problem(rule.id, `${field} must be null or at least 0`);
  return rule[field];
}

/** The level range of an upgrade under the rules' level indexing. */
export function levelRange(game, rules, id) {
  const upgrade = game.upgrades[id];
  return { min: rules.minLevel, max: Math.min(upgrade.maxLevel, upgrade.values.length - 1 - rules.valueOffset) };
}

function checkLevel(game, rules, id, level) {
  const { min, max } = levelRange(game, rules, id);
  if (!Number.isInteger(level) || level < min || level > max) throw new RangeError(`${id}: level ${level} is outside ${min}..${max}`);
}

/** The upgrade's value at a level: values[level + valueOffset]. */
export function upgradeValue(game, rules, id, level) {
  checkLevel(game, rules, id, level);
  return game.upgrades[id].values[level + rules.valueOffset];
}

/** The cost of going from `level` to `level + 1`: costs[level + costOffset]; null at the maximum level. */
export function upgradeCost(game, rules, id, level) {
  checkLevel(game, rules, id, level);
  if (level === levelRange(game, rules, id).max) return null;
  return game.upgrades[id].costs[level + rules.costOffset];
}

/** Checks that every index the level range needs exists, for every upgrade. */
function checkIndexing(game, rules) {
  for (const id of UPGRADE_IDS) {
    const { costs, values } = game.upgrades[id];
    const { min, max } = levelRange(game, rules, id);
    if (min > max) throw problem("levels", `${id} has no valid level (min ${min}, max ${max})`);
    for (let level = min; level <= max; level++) {
      const v = level + rules.valueOffset;
      if (v < 0 || v >= values.length) throw problem("levels", `${id} level ${level} points to value ${v}, outside its ${values.length} values`);
      if (level < max) {
        const c = level + rules.costOffset;
        if (c < 0 || c >= costs.length) throw problem("levels", `${id} level ${level} points to cost ${c}, outside its ${costs.length} costs`);
      }
    }
  }
}

/** Validates rules.json against the game data and flattens it for the engine. */
export function loadRules(json, game) {
  if (!json || json.version !== 1 || !Array.isArray(json.rules)) throw problem(null, "expected { version: 1, rules: [...] }");
  if (json.sizeUnit !== null && typeof json.sizeUnit !== "string") throw problem(null, "sizeUnit must be null or a text");

  const byId = {};
  for (const rule of json.rules) {
    if (!RULE_IDS.includes(rule.id)) throw problem(null, `unknown rule ${rule.id}`);
    if (byId[rule.id]) throw problem(rule.id, "appears twice");
    if (!STATUSES.includes(rule.status)) throw problem(rule.id, `status must be verified or assumed (found ${JSON.stringify(rule.status)})`);
    if (typeof rule.text !== "string" || rule.text === "") throw problem(rule.id, "text is missing");
    if (rule.source !== null && typeof rule.source !== "string") throw problem(rule.id, "source must be null or a text");
    byId[rule.id] = rule;
  }
  for (const id of RULE_IDS) {
    if (!byId[id]) throw problem(id, "missing");
  }

  const { tacklebox, dailyCap, species, size, rarity, levels, upgradeNames } = byId;
  oneOf(tacklebox, "zeroSpeed", ["fullEachVisit"]);
  oneOf(dailyCap, "appliesTo", ["catches"]);
  oneOf(dailyCap, "window", ["24hFromNow"]);
  oneOf(species, "weights", ["equal"]);
  oneOf(size, "model", ["uniformTimesHook"]);

  const names = upgradeNames.names ?? {};
  for (const id of UPGRADE_IDS) {
    if (names[id] !== null && typeof names[id] !== "string") throw problem("upgradeNames", `names.${id} must be null or a text`);
  }
  const hidden = upgradeNames.hidden ?? [];
  if (!Array.isArray(hidden) || hidden.some((id) => !UPGRADE_IDS.includes(id))) throw problem("upgradeNames", "hidden must list known upgrades only");

  const luresPerCatch = finite(byId.luresPerCatch, "value");
  if (luresPerCatch <= 0) throw problem("luresPerCatch", "value must be above 0");
  const tackleboxUnitMinutes = finite(tacklebox, "unitMinutes");
  if (tackleboxUnitMinutes < 0) throw problem("tacklebox", "unitMinutes must be at least 0");

  const rules = {
    sizeUnit: json.sizeUnit,
    luresPerCatch,
    tackleboxUnitMinutes,
    tackleboxBaseCapacity: base(tacklebox, "baseCapacity"),
    tackleboxZeroSpeed: tacklebox.zeroSpeed,
    dailyCapBase: base(dailyCap, "base"),
    speciesUnlock: oneOf(species, "unlock", ["levelBelowSkill", "levelAtMostSkill"]),
    rarityLevelFrom: oneOf(rarity, "levelFrom", UPGRADE_IDS),
    rarityLevelOffset: integer(rarity, "levelOffset"),
    minLevel: integer(levels, "minLevel"),
    valueOffset: integer(levels, "valueOffset"),
    costOffset: integer(levels, "costOffset"),
    names: Object.fromEntries(UPGRADE_IDS.map((id) => [id, names[id]])),
    hidden: [...hidden],
    list: json.rules.map(({ id, status, source, text }) => ({ id, status, source, text }))
  };
  checkIndexing(game, rules);
  return rules;
}

/** The bases rules.json does not know yet, which the player must read in game. */
export function missingBases(rules) {
  return ["dailyCapBase", "tackleboxBaseCapacity"].filter((key) => rules[key] === null);
}

/**
 * Fills each unknown base from a value the game showed and the level it was read at:
 * base = shown − the upgrade's bonus at that level. A reading stays right after the upgrade is raised.
 * shown = { dailyCap: { value, level } | null, tackleboxCapacity: { value, level } | null }. Known bases are kept.
 */
export function withShownValues(rules, game, shown) {
  const out = { ...rules };
  const derive = (key, upgradeId, reading, label) => {
    if (out[key] !== null || !reading) return;
    const bonus = upgradeValue(game, rules, upgradeId, reading.level);
    const name = rules.names[upgradeId] ?? upgradeId;
    if (reading.value < bonus) throw new RulesError(`shown ${label} (${reading.value}) is lower than the ${name} bonus at level ${reading.level} (${bonus})`);
    out[key] = reading.value - bonus;
  };
  derive("dailyCapBase", "LuresPerDay", shown?.dailyCap, "daily limit");
  derive("tackleboxBaseCapacity", "TackleBoxSize", shown?.tackleboxCapacity, "Tacklebox capacity");
  return out;
}
