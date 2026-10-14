import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createModel } from "../site/lib/model.js";
import { initialState, simulate, followOrder } from "../site/lib/simulate.js";
import { findBestPlan, rolloutPolicy, evaluate } from "../site/lib/search.js";
import { tinyGame, tinyRules, allAt } from "./fixtures.js";

const settings = { prestigesPerDay: 4, visitsPerDay: 4 };
const big = [1000, 1000, 1000];
const costsOnly = (special) => Object.fromEntries(Object.keys(tinyGame().upgrades).map((id) => [id, special[id] ?? big]));
const setup = (costs, input, rules = {}) => {
  const m = createModel(tinyGame(costs), tinyRules(rules), settings);
  return [m, initialState(m, { levels: allAt(1), coins: 0, lures: 10, hoursLeft: 12, lengthSoFar: 0, ...input })];
};

describe("findBestPlan", () => {
  it("takes a free hook first", () => {
    const [m, s] = setup(costsOnly({ FishingHook: [0, 1000, 1000] }));
    const plan = findBestPlan(m, s);
    assert.equal(plan.finalLength, 66);
    assert.deepEqual(plan.next, { upgradeId: "FishingHook", fromLevel: 1, toLevel: 2, cost: 0, hour: 0, lengthAtPurchase: 0,
      affordable: true, missingCoins: 0, alternative: { upgradeId: null, finalLength: 44 } });
  });
  it("saves up for the hook and never recommends a purchase that adds no length", () => {
    const [m, s] = setup(costsOnly({ FishingHook: [30, 1000, 1000], LuresPerDay: [1, 1, 1] }), { coins: 10, hoursLeft: 24 });
    const plan = findBestPlan(m, s);
    assert.equal(plan.finalLength, 80);
    assert.deepEqual(plan.order, ["FishingHook"]);
    assert.deepEqual(plan.next, { upgradeId: "FishingHook", fromLevel: 1, toLevel: 2, cost: 30, hour: 12, lengthAtPurchase: 44,
      affordable: false, missingCoins: 20, alternative: { upgradeId: "LuresPerDay", finalLength: 80 } });
  });
  it("recommends nothing when the event is over", () => {
    const [m, s] = setup({}, { coins: 100, lures: 0, hoursLeft: 0, lengthSoFar: 7 });
    const plan = findBestPlan(m, s);
    assert.deepEqual([plan.next, plan.finalLength, plan.order], [null, 7, []]);
  });
  it("with less than one visit left, buys only what adds length now", () => {
    const [m, s] = setup({}, { coins: 10, hoursLeft: 3 });
    const plan = findBestPlan(m, s);
    assert.equal(plan.next.upgradeId, "FishingHook"); // ties with Fishing Skill at 30; UPGRADE_IDS order decides
    assert.equal(plan.next.hour, 0);
    assert.equal(plan.finalLength, 30);
  });
  it("starts from the level the player entered", () => {
    const [m, s] = setup({}, { coins: 10, levels: { ...allAt(1), FishingHook: 2 } });
    const plan = findBestPlan(m, s);
    assert.equal(plan.next.fromLevel, s.levels[plan.next.upgradeId]);
  });
  it("is deterministic, publishes improving plans, and always returns one", () => {
    const [m, s] = setup({}, { lures: 20, hoursLeft: 48 });
    const seen = [];
    const a = findBestPlan(m, s, { onProgress: (p) => seen.push(p.finalLength) });
    assert.deepEqual(findBestPlan(m, s), a);
    assert.ok(seen.length >= 1);
    seen.forEach((v, i) => i && assert.ok(v > seen[i - 1]));
    let t = 0;
    const late = findBestPlan(m, s, { deadline: 0, now: () => ++t });
    assert.ok(late.finalLength >= evaluate(m, s, []).finalLength);
  });
});

describe("rolloutPolicy", () => {
  it("does not buy an upgrade that adds no length", () => {
    const [m] = setup(costsOnly({ LuresPerDay: [1, 1, 1] }));
    assert.equal(rolloutPolicy(m)({ levels: allAt(1), coins: 5, hour: 0 }), null);
  });
});

// Quality check (spec §8.3): every order is tried on small cases.
function exhaustiveBest(m, s) {
  let best = evaluate(m, s, []);
  const walk = (order, levels) => {
    for (const id of m.ids) {
      if (m.cost(id, levels[id]) === null) continue;
      const next = [...order, id];
      const r = simulate(m, s, followOrder(next));
      if (r.purchases.length < next.length) continue;
      if (r.finalLength > best.finalLength) best = r;
      walk(next, { ...levels, [id]: levels[id] + 1 });
    }
  };
  walk([], { ...s.levels });
  return best.finalLength;
}
describe("quality against every order", () => {
  for (const [name, input, sets, hidden] of [
    ["four upgrades, 48 h", { lures: 20, hoursLeft: 48 }, settings, ["LuresPerDay", "TackleBoxSize", "TackleBoxSpeed"]],
    ["bait, hook and skill, 72 h", { coins: 5, lures: 10, hoursLeft: 72 }, { prestigesPerDay: 6, visitsPerDay: 3 }, ["LuresPerDay", "TackleBoxSize", "TackleBoxSpeed", "LuresPerPrestige"]]
  ]) {
    it(`reaches 99 % of the best order: ${name}`, () => {
      const m = createModel(tinyGame(), tinyRules({ hidden }), sets);
      const s = initialState(m, { levels: allAt(1), coins: 0, lengthSoFar: 0, ...input });
      assert.ok(findBestPlan(m, s).finalLength >= 0.99 * exhaustiveBest(m, s));
    });
  }
});
