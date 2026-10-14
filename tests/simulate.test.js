import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createModel } from "../site/lib/model.js";
import { initialState, simulate, followOrder, advance } from "../site/lib/simulate.js";
import { tinyGame, tinyRules, allAt } from "./fixtures.js";

const settings = { prestigesPerDay: 4, visitsPerDay: 4 };
const model = (r = {}) => createModel(tinyGame(), tinyRules(r), settings);
const start = (m, over = {}) => initialState(m, { levels: allAt(1), coins: 0, lures: 10, hoursLeft: 12, lengthSoFar: 0, ...over });
const none = () => null;
const hook = () => "FishingHook";

describe("simulate", () => {
  it("fishes at every visit with no purchase", () =>
    assert.deepEqual(simulate(model(), start(model()), none), { finalLength: 44, coinsLeft: 22, luresLeft: 0, purchases: [] }));
  it("stops at the daily limit and keeps the lures", () => {
    const m = model({ dailyCapBase: 8 });
    assert.deepEqual(simulate(m, start(m), none), { finalLength: 16, coinsLeft: 8, luresLeft: 14, purchases: [] });
  });
  it("resets the daily limit every 24 hours", () => {
    const m = model({ dailyCapBase: 8 });
    const r = simulate(m, start(m, { hoursLeft: 30 }), none);
    assert.deepEqual([r.finalLength, r.coinsLeft, r.luresLeft], [32, 16, 24]);
  });
  it("buys before fishing and after, and records each purchase", () => {
    const m = model();
    const r = simulate(m, start(m, { coins: 10 }), hook);
    assert.equal(r.finalLength, 66);
    assert.equal(r.coinsLeft, 2);
    assert.deepEqual(r.purchases, [
      { upgradeId: "FishingHook", fromLevel: 1, toLevel: 2, cost: 10, hour: 0, lengthAtPurchase: 0 },
      { upgradeId: "FishingHook", fromLevel: 2, toLevel: 3, cost: 20, hour: 12, lengthAtPurchase: 66 }
    ]);
  });
  it("adds the length already caught", () => assert.equal(simulate(model(), start(model(), { lengthSoFar: 100 }), none).finalLength, 144));
  it("with less than one visit left, only fishes now", () => {
    const r = simulate(model(), start(model(), { hoursLeft: 3 }), none);
    assert.deepEqual([r.finalLength, r.coinsLeft], [20, 10]);
  });
});

describe("followOrder and advance", () => {
  it("follows an order then delegates", () =>
    assert.equal(simulate(model(), start(model(), { coins: 10 }), followOrder([], hook)).finalLength, 66));
  it("resumes from a snapshot with the same result", () => {
    const m = model();
    const a = advance(m, start(m, { coins: 10 }), ["FishingHook", "FishingHook"]);
    assert.equal(a.purchases.length, 2);
    assert.equal(a.state.levels.FishingHook, 3);
    assert.equal(a.state.coins, 2);
    assert.equal(simulate(m, a.state, none).finalLength, 66);
  });
  it("can be reused for runs from different starting levels", () => {
    const m = model();
    const policy = followOrder(["FishingHook", "FishingSkill"], null, allAt(1));
    simulate(m, start(m, { coins: 100 }), policy);
    // second run: the Skill target is already reached at the start, the Hook one is not
    const second = simulate(m, start(m, { coins: 100, levels: { ...allAt(1), FishingSkill: 2 } }), policy);
    assert.deepEqual(second.purchases.map((p) => `${p.upgradeId} ${p.fromLevel}→${p.toLevel}`), ["FishingHook 1→2"]);
  });
  it("returns null when the order cannot be completed", () => {
    const m = model();
    assert.equal(advance(m, start(m, { hoursLeft: 0, lures: 0 }), ["FishingHook"]), null);
    assert.equal(advance(m, start(m, { coins: 1000 }), ["FishingHook", "FishingHook", "FishingHook"]), null);
  });
});
