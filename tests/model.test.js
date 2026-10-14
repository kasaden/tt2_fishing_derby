import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createModel, tiersReached } from "../site/lib/model.js";
import { tinyGame, tinyRules, allAt, realGame, realRules, TEST_BASES } from "./fixtures.js";

const settings = { prestigesPerDay: 4, visitsPerDay: 4 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

describe("createModel on the tiny data", () => {
  const m = createModel(tinyGame(), tinyRules(), settings);
  it("averages the unlocked species and applies the hook", () => {
    assert.equal(m.catchSize(allAt(1)), 2);
    assert.equal(m.catchSize({ ...allAt(1), FishingSkill: 2, FishingHook: 3 }), 6);
  });
  it("prices a catch from the rarity table at the bait value plus one", () => {
    assert.equal(m.catchCoins(allAt(1)), 1);
    assert.equal(m.catchCoins({ ...allAt(1), FishingBait: 2 }), 1.5);
    assert.equal(m.catchCoins({ ...allAt(1), FishingBait: 3 }), 5);
  });
  it("adds prestige lures and a capped Tacklebox per visit, and the daily limit", () => {
    assert.equal(m.interval, 6);
    assert.equal(m.luresPerVisit(allAt(1)), 6);
    assert.equal(m.dailyCap(allAt(1)), 100);
  });
  it("groups many visits into at most 12 steps a day, keeping each visit's Tacklebox", () => {
    const m = createModel(tinyGame(), tinyRules(), { prestigesPerDay: 4, visitsPerDay: 48 });
    assert.equal(m.interval, 2);
    // a 2-hour step holds 4 visits of 30 minutes: prestige lures 4 × 2/24 × 2, Tacklebox 4 × min(4, 30 / 60)
    assert.ok(Math.abs(m.luresPerVisit(allAt(1)) - (2 / 3 + 2)) < 1e-12, String(m.luresPerVisit(allAt(1))));
  });
  it("fills the Tacklebox at every visit when its speed is 0", () => {
    const g = tinyGame(); g.upgrades.TackleBoxSpeed.values = [60, 30, 0];
    const z = createModel(g, tinyRules(), settings);
    assert.equal(z.luresPerVisit({ ...allAt(1), TackleBoxSize: 3, TackleBoxSpeed: 3 }), 10);
    assert.equal(z.luresPerVisit({ ...allAt(1), TackleBoxSize: 3 }), 8);
  });
  it("can unlock species up to the skill value", () =>
    assert.equal(createModel(tinyGame(), tinyRules({ speciesUnlock: "levelAtMostSkill" }), settings).catchSize(allAt(1)), 3));
  it("leaves hidden upgrades out", () =>
    assert.ok(!createModel(tinyGame(), tinyRules({ hidden: ["FishingBait"] }), settings).ids.includes("FishingBait")));
});

describe("createModel on the real files", () => {
  const game = realGame();
  it("refuses to run with an unknown base", () =>
    assert.throws(() => createModel(game, realRules(game), settings), /missing base: dailyCapBase/));
  it("matches the averages of the real tables", () => {
    const m = createModel(game, { ...realRules(game), ...TEST_BASES }, settings);
    close(m.catchSize(allAt(1)), 1.2333333333333332);
    close(m.catchCoins(allAt(1)), 1.184782608695652);
    close(m.catchSize({ ...allAt(1), FishingSkill: 11, FishingHook: 11 }), 6.3114244);
  });
});

describe("tiersReached", () => {
  const tiers = tinyGame().soloTiers;
  it("lists the tiers reached and the next one", () => {
    assert.deepEqual(tiersReached(tiers, 25).reached.map((t) => t.id), [0, 1]);
    assert.equal(tiersReached(tiers, 25).next.id, 2);
    assert.deepEqual(tiersReached(tiers, 0), { reached: [], next: tiers[0] });
    assert.equal(tiersReached(tiers, 1000).next, null);
  });
});
