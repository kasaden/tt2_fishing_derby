// Run with: node --test   (Node's built-in test runner, no dependencies)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildGameData, DATA_FILES } from "../site/lib/gameData.js";
import { loadRules, levelRange, upgradeValue, upgradeCost, missingBases, withShownValues, hoursUntilReset, RulesError } from "../site/lib/rules.js";

const game = buildGameData(Object.fromEntries(Object.entries(DATA_FILES).map(([k, f]) => [k, fs.readFileSync(new URL(`../site/data/${f}`, import.meta.url), "utf8")])));
const json = () => JSON.parse(fs.readFileSync(new URL("../site/data/rules.json", import.meta.url), "utf8"));
const withRule = (id, patch) => { const j = json(); Object.assign(j.rules.find((r) => r.id === id), patch); return j; };
const levelsAt = (n) => Object.fromEntries(Object.keys(game.upgrades).map((id) => [id, n]));

describe("loadRules on the shipped file", () => {
  const rules = loadRules(json(), game);
  const status = (id) => rules.list.find((r) => r.id === id).status;
  it("keeps every rule with its status, and the bases read in game", () => {
    assert.equal(rules.list.length, 12);
    for (const id of ["score", "luresPerCatch", "prestigeLures", "tacklebox", "dailyCap", "levels", "unusedLures", "upgradeNames"]) assert.equal(status(id), "verified", id);
    assert.equal(rules.dailyCapBase, 100);
    assert.equal(rules.tackleboxBaseCapacity, 5);
    assert.deepEqual(missingBases(rules), []);
    assert.equal(rules.names.FishingBait, "Bait");
  });
  it("reads the prestige, Tacklebox and daily reset values the game shows", () => {
    assert.equal(rules.prestigeLuresBase, 1);
    assert.equal(rules.tackleboxBaseSeconds, 30);
    assert.equal(rules.tackleboxUnitSeconds, 1);
    assert.equal(rules.dailyResetHourUtc, 0);
  });
  it("indexes levels 1 to 10 as the game shows them: the L-th value, the next cost", () => {
    assert.deepEqual(levelRange(game, rules, "TackleBoxSize"), { min: 1, max: 10 });
    assert.equal(upgradeCost(game, rules, "LuresPerPrestige", 1), 5);
    assert.equal(upgradeCost(game, rules, "FishingHook", 1), 200);
    assert.equal(upgradeCost(game, rules, "TackleBoxSize", 9), 2000);
    assert.equal(upgradeCost(game, rules, "TackleBoxSize", 10), null);
    assert.equal(upgradeValue(game, rules, "FishingHook", 2), 1.052);
    assert.equal(upgradeValue(game, rules, "TackleBoxSpeed", 1), 30);
    assert.throws(() => upgradeValue(game, rules, "FishingHook", 11), RangeError);
    assert.throws(() => upgradeCost(game, rules, "FishingHook", 0), RangeError);
  });
});

describe("level indexing variants", () => {
  it("costs from the same position, with no level cap", () => {
    const rules = loadRules(withRule("levels", { costOffset: -1, maxLevel: null }), game);
    assert.deepEqual(levelRange(game, rules, "TackleBoxSize"), { min: 1, max: 11 });
    assert.equal(upgradeCost(game, rules, "TackleBoxSize", 1), 1);
    assert.equal(upgradeCost(game, rules, "TackleBoxSize", 10), 2000);
  });
  it("levels from 0", () => {
    const rules = loadRules(withRule("levels", { minLevel: 0, valueOffset: 0, costOffset: 0 }), game);
    assert.deepEqual(levelRange(game, rules, "FishingHook"), { min: 0, max: 10 });
    assert.equal(upgradeValue(game, rules, "FishingHook", 0), 1);
    assert.equal(upgradeCost(game, rules, "FishingHook", 0), 100);
    assert.equal(upgradeCost(game, rules, "FishingHook", 10), null);
  });
});

describe("loadRules errors", () => {
  it("names a missing rule", () => { const j = json(); j.rules = j.rules.filter((r) => r.id !== "coins"); assert.throws(() => loadRules(j, game), /rule coins: missing/); });
  it("refuses an unknown status", () => assert.throws(() => loadRules(withRule("size", { status: "maybe" }), game), /rule size: status/));
  it("refuses an unknown option", () => assert.throws(() => loadRules(withRule("species", { unlock: "levelNearSkill" }), game), /rule species: unlock/));
  it("refuses a negative base", () => assert.throws(() => loadRules(withRule("dailyCap", { base: -1 }), game), /rule dailyCap: base/));
  it("refuses a daily limit on anything but prestige lures", () => assert.throws(() => loadRules(withRule("dailyCap", { appliesTo: "catches" }), game), /rule dailyCap: appliesTo/));
  it("refuses a reset hour outside 0..23", () => assert.throws(() => loadRules(withRule("dailyCap", { resetHourUtc: 24 }), game), /rule dailyCap: resetHourUtc/));
  it("refuses offsets that point before the list", () => assert.throws(() => loadRules(withRule("levels", { minLevel: 0, valueOffset: -1 }), game), (e) => e instanceof RulesError && /rule levels:/.test(e.message)));
});

describe("withShownValues", () => {
  const rules = { ...loadRules(json(), game), dailyCapBase: null, tackleboxBaseCapacity: null };
  it("derives each base from the value shown at the level it was read at", () => {
    const r = withShownValues(rules, game, { dailyCap: { value: 140, level: 2 }, tackleboxCapacity: { value: 25, level: 1 } });
    assert.equal(r.dailyCapBase, 40);
    assert.equal(r.tackleboxBaseCapacity, 25);
  });
  it("keeps a base the rules already know", () =>
    assert.equal(withShownValues(loadRules(json(), game), game, { dailyCap: { value: 140, level: 2 }, tackleboxCapacity: null }).dailyCapBase, 100));
  it("keeps the base when the upgrade is raised after the reading", () => {
    // read at Bucket level 1; the player then buys levels 2 and 3: the reading still says level 1
    const r = withShownValues(rules, game, { dailyCap: { value: 100, level: 1 }, tackleboxCapacity: { value: 10, level: 1 } });
    assert.equal(r.dailyCapBase, 100);
  });
  it("refuses a shown value below the level's bonus, naming the upgrade as the game does", () =>
    assert.throws(() => withShownValues(rules, game, { dailyCap: { value: 150, level: 3 }, tackleboxCapacity: null }), /shown daily limit \(150\) is lower than the Bucket bonus at level 3 \(200\)/));
});

describe("hoursUntilReset", () => {
  it("counts the hours to the next daily reset in UTC", () => {
    assert.equal(hoursUntilReset(new Date("2026-10-15T00:00:00Z"), 0), 24);
    assert.equal(hoursUntilReset(new Date("2026-10-15T18:30:00Z"), 0), 5.5);
    assert.equal(hoursUntilReset(new Date("2026-10-15T23:00:00Z"), 2), 3);
  });
});
