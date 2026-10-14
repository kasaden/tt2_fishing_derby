// Run with: node --test   (Node's built-in test runner, no dependencies)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildGameData, DATA_FILES, UPGRADE_IDS, DataError } from "../site/lib/gameData.js";

const read = () => Object.fromEntries(Object.entries(DATA_FILES).map(([k, f]) => [k, fs.readFileSync(new URL(`../site/data/${f}`, import.meta.url), "utf8")]));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

describe("buildGameData on the real files", () => {
  const game = buildGameData(read());
  it("reads today's counts", () => {
    assert.deepEqual(Object.keys(game.upgrades).sort(), [...UPGRADE_IDS].sort());
    assert.equal(game.fish.length, 50);
    assert.equal(game.rarityLevels.length, 12);
    assert.deepEqual(game.xpByRarity, [1, 2, 5, 25, 25]);
    assert.equal(game.soloTiers.length, 41);
    assert.deepEqual(game.soloTiers[40], { id: 40, sizeRequired: 150000, reward: "Diamonds:1000" });
  });
  it("keeps the lists as the files write them", () => {
    assert.equal(game.upgrades.FishingHook.values[10], 1.7522);
    assert.equal(game.upgrades.TackleBoxSize.costs.length, 12);
    assert.equal(game.upgrades.TackleBoxSize.values.length, 11);
    assert.equal(game.upgrades.TackleBoxSize.maxLevel, 11);
    assert.deepEqual(game.fish[3], { id: 3, levelToCatch: 2, baseSize: 2, minSize: 1, maxSize: 3.4, raritySize: 3.31 });
  });
  it("derives rarity probabilities from the weights", () => {
    close(game.rarityLevels[0].probabilities[0], 750000 / 920000);
    close(game.rarityLevels[0].probabilities[1], 170000 / 920000);
    [0.323828, 0.43, 0.19, 0.056, 0.000172].forEach((p, i) => close(game.rarityLevels[11].probabilities[i], p));
  });
});

describe("buildGameData errors", () => {
  const edit = (key, from, to) => { const t = read(); assert.ok(t[key].includes(from)); t[key] = t[key].replace(from, to); return t; };
  it("names file, row and column of a bad number", () =>
    assert.throws(() => buildGameData(edit("fish", "0,0,0,0,1.80", "0,0,0,abc,1.80")), (e) => e instanceof DataError && /MinigameFishingDerbyFishInfo\.csv: row 1, column MinSize/.test(e.message)));
  it("names a missing column", () =>
    assert.throws(() => buildGameData(edit("xp", "FishingDerbyRarity,XP", "FishingDerbyRarity,Coins")), /MinigameFishingDerbyXPInfo\.csv: missing column XP/));
  it("refuses an unknown upgrade", () =>
    assert.throws(() => buildGameData(edit("upgrades", "FishingBait,FishingBaitLevel", "FishingNet,FishingBaitLevel")), /unknown upgrade FishingNet/));
  it("refuses a missing upgrade", () => {
    const t = read(); t.upgrades = t.upgrades.split(/\r?\n/).filter((l) => !l.startsWith("FishingBait")).join("\n");
    assert.throws(() => buildGameData(t), /missing upgrade FishingBait/);
  });
  it("refuses a percentage that disagrees with the weights", () =>
    assert.throws(() => buildGameData(edit("rarity", "0.81521739", "0.50000000")), /row 1, column Rarity0%/));
  it("refuses an empty item in a cost list", () =>
    assert.throws(() => buildGameData(edit("upgrades", '"1,5,10,20,25,50', '"1,,10,20,25,50')), /column XPCost/));
});
