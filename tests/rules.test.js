// Run with: node --test   (Node's built-in test runner, no dependencies)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildGameData, DATA_FILES } from "../site/lib/gameData.js";
import { loadRules, levelRange, upgradeValue, upgradeCost, missingBases, withShownValues, RulesError } from "../site/lib/rules.js";

const game = buildGameData(Object.fromEntries(Object.entries(DATA_FILES).map(([k, f]) => [k, fs.readFileSync(new URL(`../site/data/${f}`, import.meta.url), "utf8")])));
const json = () => JSON.parse(fs.readFileSync(new URL("../site/data/rules.json", import.meta.url), "utf8"));
const withRule = (id, patch) => { const j = json(); Object.assign(j.rules.find((r) => r.id === id), patch); return j; };
const levelsAt = (n) => Object.fromEntries(Object.keys(game.upgrades).map((id) => [id, n]));

describe("loadRules on the shipped file", () => {
  const rules = loadRules(json(), game);
  it("keeps every rule with its status, and the unknown bases as null", () => {
    assert.equal(rules.list.length, 12);
    assert.equal(rules.list.find((r) => r.id === "score").status, "verified");
    assert.equal(rules.dailyCapBase, null);
    assert.equal(rules.tackleboxBaseCapacity, null);
    assert.deepEqual(missingBases(rules), ["dailyCapBase", "tackleboxBaseCapacity"]);
    assert.equal(rules.names.FishingBait, null);
  });
  it("indexes levels from 1, the L-th value and the L-th cost", () => {
    assert.deepEqual(levelRange(game, rules, "TackleBoxSize"), { min: 1, max: 11 });
    assert.equal(upgradeCost(game, rules, "FishingHook", 1), 100);
    assert.equal(upgradeCost(game, rules, "TackleBoxSize", 10), 2000);
    assert.equal(upgradeCost(game, rules, "TackleBoxSize", 11), null);
    assert.equal(upgradeValue(game, rules, "FishingHook", 11), 1.7522);
    assert.equal(upgradeValue(game, rules, "TackleBoxSpeed", 1), 30);
    assert.throws(() => upgradeValue(game, rules, "FishingHook", 12), RangeError);
    assert.throws(() => upgradeCost(game, rules, "FishingHook", 0), RangeError);
  });
});

describe("level indexing variants", () => {
  it("costs from the next position", () => {
    const rules = loadRules(withRule("levels", { costOffset: 0 }), game);
    assert.equal(upgradeCost(game, rules, "TackleBoxSize", 1), 5);
    assert.equal(upgradeCost(game, rules, "TackleBoxSize", 10), 4000);
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
  it("refuses offsets that point before the list", () => assert.throws(() => loadRules(withRule("levels", { minLevel: 0, valueOffset: -1 }), game), (e) => e instanceof RulesError && /rule levels:/.test(e.message)));
});

describe("withShownValues", () => {
  const rules = loadRules(json(), game);
  it("derives each base from the value shown at the player's level", () => {
    const r = withShownValues(rules, game, { ...levelsAt(1), LuresPerDay: 2 }, { dailyCap: 140, tackleboxCapacity: 25 });
    assert.equal(r.dailyCapBase, 40);
    assert.equal(r.tackleboxBaseCapacity, 25);
  });
  it("refuses a shown value below the level's bonus", () =>
    assert.throws(() => withShownValues(rules, game, { ...levelsAt(1), LuresPerDay: 3 }, { dailyCap: 150, tackleboxCapacity: 25 }), /shown daily limit .* lower than/));
});
