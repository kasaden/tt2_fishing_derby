// Display strings, tested without a page.
import { it } from "node:test";
import assert from "node:assert/strict";
import { formatLength, formatPurchaseTime, upgradeLabel, whyLine, formatReward, formatCoins } from "../site/lib/format.js";

const rules = { names: { FishingHook: "Fishing Hook", LuresPerDay: "Bucket", FishingBait: null } };
it("formats lengths with or without a unit", () => {
  assert.equal(formatLength(45933.12, null), "45,933");
  assert.equal(formatLength(80, "cm"), "80 cm");
});
it("formats purchase times from now", () => {
  const thursdayNoonUtc = Date.UTC(2026, 9, 15, 12, 0);
  assert.equal(formatPurchaseTime(thursdayNoonUtc, 0), "now");
  assert.equal(formatPurchaseTime(thursdayNoonUtc, 26, "en-GB", "UTC"), "Fri 14:00");
});
it("labels upgrades, flagging a name not verified", () => {
  assert.equal(upgradeLabel(rules, "LuresPerDay"), "Bucket");
  assert.equal(upgradeLabel(rules, "FishingBait"), "FishingBait (name not verified)");
});
it("explains the next purchase against the best alternative", () => {
  const next = { upgradeId: "FishingHook", finalLength: 90, coinsLeft: 10, purchaseCount: 1, alternative: { upgradeId: "LuresPerDay", finalLength: 80, coinsLeft: 9, purchaseCount: 2, firstCost: 1 } };
  assert.equal(whyLine(next, rules, null), "Estimated final length with this purchase: 90. Best other first purchase, Bucket: 80.");
  assert.equal(whyLine({ ...next, finalLength: 66, alternative: { upgradeId: null, finalLength: 44, coinsLeft: 22, purchaseCount: 0, firstCost: 0 } }, rules, null), "Estimated final length with this purchase: 66. Buying nothing: 44.");
});
it("says what decides between two first purchases that end at the same length", () => {
  const tie = { upgradeId: "FishingHook", cost: 30, finalLength: 80, coinsLeft: 10, purchaseCount: 1 };
  const alt = { upgradeId: "LuresPerDay", finalLength: 80, coinsLeft: 9, purchaseCount: 2, firstCost: 1 };
  assert.equal(whyLine({ ...tie, alternative: alt }, rules, null), "Estimated final length with this purchase: 80, the same as starting with Bucket. This one needs 1 purchase fewer.");
  assert.equal(whyLine({ ...tie, alternative: { ...alt, purchaseCount: 1, coinsLeft: 8 } }, rules, null), "Estimated final length with this purchase: 80, the same as starting with Bucket. This one leaves 2 more coins at the end.");
  assert.equal(whyLine({ ...tie, cost: 1, alternative: { ...alt, purchaseCount: 1, coinsLeft: 10, firstCost: 5 } }, rules, null), "Estimated final length with this purchase: 80, the same as starting with Bucket. Its first purchase costs less.");
  assert.equal(whyLine({ ...tie, cost: 5, alternative: { ...alt, purchaseCount: 1, coinsLeft: 10, firstCost: 5 } }, rules, null), "Estimated final length with this purchase: 80, the same as starting with Bucket. Either order works.");
  assert.equal(whyLine({ ...tie, finalLength: 80.3, alternative: { ...alt, finalLength: 79.9 } }, rules, null), "Estimated final length with this purchase: 80, the same as starting with Bucket. It is slightly longer before rounding.");
});
it("writes a reward string from the game data as name and quantity", () => {
  assert.equal(formatReward("Diamonds:200"), "Diamonds × 200");
  assert.equal(formatReward("SkillPoint:5"), "Skill Point × 5");
  assert.equal(formatReward("PetsLvl5:1"), "Pets Lvl5 × 1");
});
it("counts coins in the singular and the plural", () => {
  assert.equal(formatCoins(1), "1 coin");
  assert.equal(formatCoins(5), "5 coins");
  assert.equal(formatCoins(10000), "10,000 coins");
  assert.equal(formatCoins(0.4), "1 coin"); // a fraction of a coin still has to be earned
});
