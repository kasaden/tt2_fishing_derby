import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createModel, tiersReached } from "../site/lib/model.js";
import { tinyGame, tinyRules, allAt, realGame, realRules } from "./fixtures.js";

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
  it("counts prestige lures and a capped Tacklebox per step, and the daily limit", () => {
    assert.equal(m.interval, 6);
    assert.equal(m.prestigeLuresPerStep(allAt(1)), 2);
    assert.equal(m.tackleboxLuresPerStep(allAt(1)), 4);
    assert.equal(m.dailyCap(allAt(1)), 100);
  });
  it("groups many visits into at most 12 steps a day, keeping each visit's Tacklebox", () => {
    const m = createModel(tinyGame(), tinyRules(), { prestigesPerDay: 4, visitsPerDay: 48 });
    assert.equal(m.interval, 2);
    // a 2-hour step holds 4 visits of 30 minutes: prestige lures 4 × 2/24 × 2, Tacklebox 4 × min(4, 30 / 60)
    close(m.prestigeLuresPerStep(allAt(1)), 2 / 3);
    close(m.tackleboxLuresPerStep(allAt(1)), 2);
  });
  it("fills the Tacklebox at every visit when its speed is 0", () => {
    const g = tinyGame(); g.upgrades.TackleBoxSpeed.values = [60, 30, 0];
    const z = createModel(g, tinyRules(), settings);
    assert.equal(z.tackleboxLuresPerStep({ ...allAt(1), TackleBoxSize: 3, TackleBoxSpeed: 3 }), 8);
    assert.equal(z.tackleboxLuresPerStep({ ...allAt(1), TackleBoxSize: 3 }), 6);
  });
  it("can unlock species up to the skill value", () =>
    assert.equal(createModel(tinyGame(), tinyRules({ speciesUnlock: "levelAtMostSkill" }), settings).catchSize(allAt(1)), 3));
  it("leaves hidden upgrades out", () =>
    assert.ok(!createModel(tinyGame(), tinyRules({ hidden: ["FishingBait"] }), settings).ids.includes("FishingBait")));
});

describe("createModel on the real files", () => {
  const game = realGame();
  it("refuses to run with an unknown base", () =>
    assert.throws(() => createModel(game, { ...realRules(game), dailyCapBase: null }, settings), /missing base: dailyCapBase/));
  it("gives the lures the game shows at level 1: 5 a prestige, one every 60 s up to 5 in the Tacklebox, 100 a day", () => {
    const m = createModel(game, realRules(game), { prestigesPerDay: 4, visitsPerDay: 96 });
    // a step of 2 hours holds 1/3 prestige and 8 visits of 15 minutes, each filling the Tacklebox (5 lures)
    close(m.prestigeLuresPerStep(allAt(1)), 5 / 3);
    close(m.tackleboxLuresPerStep(allAt(1)), 40);
    assert.equal(m.dailyCap(allAt(1)), 100);
    // Tacklebox Speed 10 (33 s) with Size 1 (5 lures), visits of 2 minutes: 120 / 33 lures a visit
    const fast = createModel(game, realRules(game), { prestigesPerDay: 0, visitsPerDay: 720 });
    close(fast.tackleboxLuresPerStep({ ...allAt(1), TackleBoxSpeed: 10 }), 60 * 120 / 33);
  });
  it("matches the averages of the real tables", () => {
    const m = createModel(game, realRules(game), settings);
    close(m.catchSize(allAt(1)), 1.2333333333333332);
    close(m.catchCoins(allAt(1)), 1.184782608695652);
    close(m.catchSize({ ...allAt(1), FishingSkill: 10, FishingHook: 10 }), 1.581 * 3.602);
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
