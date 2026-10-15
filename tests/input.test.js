import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultInput, readInput, serializeInput, loadInput, writeInput, missingFields, STORAGE_KEY } from "../site/lib/input.js";
import { realGame, realRules, allAt } from "./fixtures.js";

const game = realGame();
const rules = realRules(game);
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

describe("input", () => {
  it("starts from the minimum levels and empty values", () =>
    assert.deepEqual(defaultInput(game, rules), { levels: allAt(1), coins: 0, lures: 0, prestigeLuresToday: 0, hoursLeft: null, lengthSoFar: 0,
      prestigesPerDay: null, visitsPerDay: null, shown: { dailyCap: null, tackleboxCapacity: null } }));
  it("falls back to the defaults for nothing, broken JSON or another version", () => {
    for (const raw of [null, "{not json", JSON.stringify({ version: 2, coins: 5 })]) assert.deepEqual(readInput(raw, game, rules), defaultInput(game, rules));
  });
  it("falls back field by field and clamps levels", () => {
    const got = readInput(JSON.stringify({ version: 1, coins: "abc", lures: 12, prestigeLuresToday: 5, hoursLeft: 30,
      levels: { FishingHook: 99, FishingNet: 3, FishingSkill: -2, LuresPerDay: 2.7 } }), game, rules);
    assert.equal(got.coins, 0);
    assert.equal(got.lures, 12);
    assert.equal(got.prestigeLuresToday, 5);
    assert.equal(got.hoursLeft, 30);
    assert.deepEqual(got.levels, { ...allAt(1), FishingHook: 10, FishingSkill: 1, LuresPerDay: 2 });
  });
  it("keeps a shown value with the level it was read at, and drops a malformed one", () => {
    const got = readInput(JSON.stringify({ version: 1, shown: { dailyCap: { value: 100, level: 2 }, tackleboxCapacity: 10 } }), game, rules);
    assert.deepEqual(got.shown, { dailyCap: { value: 100, level: 2 }, tackleboxCapacity: null });
    const outOfRange = readInput(JSON.stringify({ version: 1, shown: { dailyCap: { value: 100, level: 40 }, tackleboxCapacity: { value: -3, level: 1 } } }), game, rules);
    assert.deepEqual(outOfRange.shown, { dailyCap: null, tackleboxCapacity: null });
  });
  it("round-trips through storage and survives a storage that throws", () => {
    const s = memory();
    const input = { ...defaultInput(game, rules), coins: 42, hoursLeft: 50, prestigesPerDay: 8, visitsPerDay: 5 };
    assert.equal(writeInput(s, input), true);
    assert.equal(s.getItem(STORAGE_KEY), serializeInput(input));
    assert.deepEqual(loadInput(s, game, rules), input);
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    assert.equal(writeInput(broken, input), false);
    assert.deepEqual(loadInput(broken, game, rules), defaultInput(game, rules));
  });
  it("names the missing values, the shown bases only when the rules need them", () => {
    assert.deepEqual(missingFields(defaultInput(game, rules), rules), ["hoursLeft", "prestigesPerDay", "visitsPerDay"]);
    assert.deepEqual(missingFields(defaultInput(game, rules), { ...rules, dailyCapBase: null, tackleboxBaseCapacity: null }),
      ["hoursLeft", "prestigesPerDay", "visitsPerDay", "shown.dailyCap", "shown.tackleboxCapacity"]);
    assert.deepEqual(missingFields({ ...defaultInput(game, rules), hoursLeft: 10, prestigesPerDay: 5, visitsPerDay: 0 }, rules), ["visitsPerDay"]);
  });
});
