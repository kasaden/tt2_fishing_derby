# TT2 Fishing Derby Optimizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-only tool that tells a Tap Titans 2 player which Fishing Derby upgrade to buy next, and the whole purchase plan to the end of the event, to finish with the largest total length of fish.

**Architecture:** Everything the page serves lives in `site/`, the only published folder. The game's CSV files (`site/data/*.csv`) and a rules file (`site/data/rules.json`, every game rule marked verified or assumed) feed a DOM-free engine in `site/lib/`: a model with precomputed tables, a visit-by-visit simulation in expected values, and a portfolio of searches (lookahead, beam, local improvement) that keeps the best purchase order found within a deadline. The page sends the player's input to a Web Worker (`site/worker.js`) that runs the engine and posts improving plans back.

**Tech Stack:** Plain HTML, CSS and JavaScript (ES modules), no framework, no build, no dependency, no server-side code. Node ≥ 22.7 for `node --test` and the local server. Cloudflare Pages (Git integration, build output directory `site`).

**Spec:** `docs/superpowers/specs/2026-10-14-fishing-derby-optimizer-design.md` (in French; read §5 to §8 before any engine task).

## Global Constraints

- Node ≥ 22.7 (ES module syntax detection, `node --test`). No `package.json`, no dependency, no build step.
- Code, UI copy, README and code comments in English.
- **`site/` is published as a whole**, even while the repository is private: only files the page serves go in it (spec §10). Specs, `docs/`, `tests/`, READMEs, `model_check.py`, `.github/`, `scripts/` and `server.js` stay outside.
- **Relative links only inside `site/`**: no `src`, `href`, `import`, `fetch`, `Worker` or CSS `url()` path starts with `/`.
- `server.js` serves `site/` and nothing else; tests import `../site/lib/…` and read `../site/data/…`.
- The CSV files in `site/data/` are the source of truth, read at runtime. No game value is copied into code or into `site/data/rules.json`.
- No invented game value: an unknown base (`dailyCap.base`, `tacklebox.baseCapacity`) stays `null` in `site/data/rules.json`, and the UI asks the player for the value the game shows.
- Every rule is shown in the UI with its status, `Verified` or `Assumed`.
- Lengths are shown without a unit while `sizeUnit` is `null`.
- Engine constants in `site/lib/search.js`: `LOOKAHEAD_DEPTH = 3`, `BEAM_WIDTH = 30`, `DEADLINE_MS = 2000`, `EPS = 1e-9`. Quality threshold in tests: the engine's plan reaches at least `0.99` of the best exhaustive order.
- Plan comparison order, everywhere: higher final length (difference > `EPS`), then more coins left, then lower cost of the first purchase, then the first purchase's index in `UPGRADE_IDS`.
- A visit is, in order: collect lures (not at visit 0), buy, fish, buy. Visits are `24 / visitsPerDay` hours apart; visit 0 is now; the last visit is at `floor(hoursLeft / interval)` intervals. The daily limit counts catches in 24-hour blocks from now (`day = floor(hour / 24)`).
- Storage key `tt2-fishing-derby:input:v1`; every `localStorage` access is in `try`/`catch` and the page works without storage.
- Footer text, exact: "Unofficial. Tap Titans 2 is a trademark of Game Hive Corp. This site is not affiliated with or endorsed by Game Hive." Licence MIT, © 2026 kasaden.
- Visual base from `../tt2_hub/DESIGN.md` (night ground, gold primary, Outfit / Geist / Geist Mono, radii 12 / 8 / 6 px, easing `cubic-bezier(0.16, 1, 0.3, 1)`). Sibling repositories are read-only.
- Commit messages carry no Claude attribution line.

## Review Focus

1. **A typed level outside the upgrade's range** (`12` on an 11-level upgrade, `-2`, `2.7`, text): clamped into range, the plan still computed. Test: Task 7, "falls back field by field".
2. **A required player value missing** (hours left, prestiges per day, visits per day, a shown base the rules need): no plan, one message naming each missing value. Tests: Task 7 `missingFields`, Task 8 "posts the missing fields".
3. **Saved data from another version, corrupt, or naming an unknown upgrade**: valid fields kept, invalid ones reset, never a full wipe of valid data. Test: Task 7.
4. **A cheap purchase that adds no length, tied with the useful one**: never recommended, never in the plan. Test: Task 5, "saves up for the hook".
5. **Fewer hours left than one visit interval**: only the current visit counts; a purchase is recommended only if it adds length before the end. Test: Task 5, "with less than one visit left".

---

## File map

| File | Responsibility |
| --- | --- |
| `site/data/MinigameFishingDerby*.csv` | the 6 game CSVs, moved with `git mv` from `fishing_derby_data/` |
| `site/lib/csv.js` | `parseCsv`, `parseNumber` (copied from `../tt2_monuments/scripts/csv.js`, same author, MIT) |
| `site/lib/gameData.js` | CSV texts → validated `GameData` |
| `site/data/rules.json`, `site/lib/rules.js` | the 12 rules; validation; level indexing; shown values → bases |
| `site/lib/model.js` | per-level tables: catch size, coins per catch, lures per visit, daily limit; reward tiers |
| `site/lib/simulate.js` | visit-by-visit simulation in expected values, resumable snapshots |
| `site/lib/search.js` | evaluation, rollout policy, lookahead, beam, improvement, portfolio, plan description |
| `site/lib/input.js` | player input: defaults, tolerant reading, saving, missing fields |
| `site/lib/load.js`, `site/lib/planRequest.js`, `site/worker.js` | fetching the data; one plan request; the Web Worker |
| `site/lib/format.js` | display strings (lengths, times, labels, the "why" line) |
| `site/index.html`, `site/style.css`, `site/index.js`, `site/favicon.svg` | the page |
| `server.js` | local server for `site/` only |
| `fishing_derby_data/README.md`, `fishing_derby_data/model_check.py` | provenance of the CSVs; reads `../site/data/` |
| `scripts/bench.js` | method and timing measurements on real data |
| `tests/*.test.js`, `tests/fixtures.js` | tests and shared fixtures; `tests/site.test.js` guards the published folder |

---

### Task 1: Project base, published folder and game data

**Files:**
- Create: `.editorconfig`, `.gitattributes`, `.github/workflows/test.yml` (copies of `../tt2_monuments/` files of the same name)
- Create: `.gitignore` (lines: `node_modules`, `.DS_Store`, `.claude/`, `.impeccable/review/`, `.impeccable/config.local.json`)
- Move: `fishing_derby_data/MinigameFishingDerby*.csv` → `site/data/` with `git mv` (6 files)
- Modify: `fishing_derby_data/model_check.py` (`BASE` becomes `Path(__file__).resolve().parent.parent / "site" / "data"`), `fishing_derby_data/README.md` (says the CSVs now live in `site/data/`)
- Create: `site/lib/csv.js` (copy of `../tt2_monuments/scripts/csv.js`; first comment line says where it comes from)
- Create: `site/lib/gameData.js`
- Test: `tests/csv.test.js` (copy of `../tt2_monuments/tests/csv.test.js`, import path `../site/lib/csv.js`), `tests/gameData.test.js`, `tests/site.test.js`

**Interfaces:**
- Produces:
  - `UPGRADE_IDS = ["LuresPerPrestige", "LuresPerDay", "FishingHook", "FishingSkill", "FishingBait", "TackleBoxSpeed", "TackleBoxSize"]`
  - `DATA_FILES = { upgrades: "MinigameFishingDerbyUpgradeInfo.csv", rarity: "MinigameFishingDerbyRarityInfo.csv", xp: "MinigameFishingDerbyXPInfo.csv", fish: "MinigameFishingDerbyFishInfo.csv", solo: "MinigameFishingDerbySoloContributionRewards.csv" }`
  - `class DataError extends Error`; messages `"<file>: row <n>, column <col>: <problem>"` (n = 1-based data row, header excluded) or `"<file>: <problem>"`.
  - `buildGameData(texts: Record<keyof DATA_FILES, string>) → GameData` where `GameData = { upgrades: Record<UpgradeId, { id, bonusType, maxLevel: number, costs: number[], values: number[] }>, rarityLevels: { level: number, probabilities: number[5] }[] (ascending), xpByRarity: number[5], fish: { id, levelToCatch, baseSize, minSize, maxSize, raritySize }[], soloTiers: { id, sizeRequired, reward: string }[] (ascending) }`.
- Validation (each failure is a `DataError`; unknown upgrade ids are reported before missing ones): required columns per file (upgrades: `FishingDerbyUpgradeID, BonusType, MaxLevel, XPCost, BonusValue`; rarity: `Level, Rarity0..Rarity4, Rarity0%..Rarity4%`; xp: `FishingDerbyRarity, XP`; fish: `FishID, FishingLevelToCatch, BaseSize, MinSize, MaxSize, RaritySize`; solo: `RewardID, TotalCollectionSizeRequired, RewardString`); every number through `parseNumber` (NaN → error naming file, row, column), lists split on `,` with every item strict; exactly the 7 `UPGRADE_IDS` (unknown → `unknown upgrade <id>`, absent → `missing upgrade <id>`); `MaxLevel` an integer ≥ 1; rarity levels contiguous from 1; probabilities = weights / sum of weights, and each `RarityN%` column within `1e-6` of it; XP rows exactly `Rarity0..Rarity4`; fish ids unique; solo thresholds strictly ascending. Counts are not hard-coded in the code (a future derby may have more fish); the tests check today's counts.

- [ ] **Step 1: Write the failing tests** (`tests/gameData.test.js`)

```js
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
```

Also write `tests/site.test.js`, the guard of the published folder (spec §10, §12). It walks `site/` recursively and holds for every later task:

```js
import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("../site/", import.meta.url));
const ALLOWED = [/^index\.html$/, /^style\.css$/, /^index\.js$/, /^favicon\.svg$/, /^worker\.js$/, /^lib\/[A-Za-z]+\.js$/, /^data\/rules\.json$/, /^data\/MinigameFishingDerby[A-Za-z]+\.csv$/];
const files = (dir, rel = "") => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? files(path.join(dir, e.name), `${rel}${e.name}/`) : [`${rel}${e.name}`]);
const ROOT_PATH = /(?:src|href)\s*=\s*["']\/|from\s+["']\/|import\(\s*["']\/|fetch\(\s*["'`]\/|new\s+Worker\(\s*["'`]\/|url\(\s*["']?\//;

it("publishes only the files the page serves", () => {
  const extra = files(SITE).filter((f) => !ALLOWED.some((re) => re.test(f)));
  assert.deepEqual(extra, []);
});
it("uses no path that starts with a slash", () => {
  const bad = files(SITE).filter((f) => /\.(html|js|css)$/.test(f) && ROOT_PATH.test(fs.readFileSync(path.join(SITE, f), "utf8")));
  assert.deepEqual(bad, []);
});
it("refuses a stray file", () => {
  assert.ok(!ALLOWED.some((re) => re.test("data/README.md")) && !ALLOWED.some((re) => re.test(".env")) && !ALLOWED.some((re) => re.test("lib/model_check.py")));
});
```

- [ ] **Step 2: Run** `node --test tests/gameData.test.js` — Expected: FAIL, `Cannot find module '../site/lib/gameData.js'`.
- [ ] **Step 3: Move and copy.** `git mv fishing_derby_data/MinigameFishingDerby*.csv site/data/` (6 files); update `fishing_derby_data/model_check.py` and `fishing_derby_data/README.md` as listed; copy `.editorconfig`, `.gitattributes`, `.github/workflows/test.yml`, `site/lib/csv.js`, `tests/csv.test.js`; create `.gitignore`.
- [ ] **Step 4: Run** `python fishing_derby_data/model_check.py` — Expected: the same output as before the move (12 rarity lines, 7 upgrade lines, one `ATTENTION` line for TackleBoxSize).
- [ ] **Step 5: Implement** `buildGameData` and the exports above in `site/lib/gameData.js`.
- [ ] **Step 6: Run** `node --test` — Expected: PASS (csv, gameData and site suites).
- [ ] **Step 7: Commit**

```bash
git add .editorconfig .gitattributes .gitignore .github site fishing_derby_data tests/csv.test.js tests/gameData.test.js tests/site.test.js
git commit -m "feat(data): move the CSVs to the published folder, read and validate them"
```

---

### Task 2: Rules file and level indexing

**Files:**
- Create: `site/data/rules.json`, `site/lib/rules.js`
- Test: `tests/rules.test.js`

**Interfaces:**
- Consumes: `buildGameData`, `UPGRADE_IDS` (Task 1).
- Produces:
  - `RULE_IDS = ["score", "luresPerCatch", "prestigeLures", "tacklebox", "dailyCap", "species", "size", "rarity", "coins", "levels", "unusedLures", "upgradeNames"]`
  - `class RulesError extends Error`; messages `"rules.json: rule <id>: <problem>"`, or `"rules.json: <problem>"`.
  - `loadRules(json, game) → Rules`, `Rules = { sizeUnit: string|null, luresPerCatch, tackleboxUnitMinutes, tackleboxBaseCapacity: number|null, tackleboxZeroSpeed: "fullEachVisit", dailyCapBase: number|null, speciesUnlock: "levelBelowSkill"|"levelAtMostSkill", rarityLevelFrom: UpgradeId, rarityLevelOffset, minLevel, valueOffset, costOffset, names: Record<UpgradeId, string|null>, hidden: UpgradeId[], list: { id, status: "verified"|"assumed", source: string|null, text }[] }` (`list` in file order).
  - `levelRange(game, rules, id) → { min, max }` with `min = rules.minLevel`, `max = min(maxLevel, values.length − 1 − valueOffset)`.
  - `upgradeValue(game, rules, id, level) → number` = `values[level + valueOffset]`; `RangeError` outside the range.
  - `upgradeCost(game, rules, id, level) → number|null` = cost of going from `level` to `level + 1` = `costs[level + costOffset]`; `null` at `max`; `RangeError` outside the range.
  - `missingBases(rules) → ("dailyCapBase"|"tackleboxBaseCapacity")[]` in that order, the ones that are `null`.
  - `withShownValues(rules, game, levels, shown: { dailyCap: number|null, tackleboxCapacity: number|null }) → Rules`: for a `null` base with a shown value, base = shown − value at the player's level (`LuresPerDay`, `TackleBoxSize`); a shown value below the level's bonus → `RulesError` (`shown daily limit … is lower than`); known bases are kept.
- Validation: each id of `RULE_IDS` exactly once (absent → `rule <id>: missing`, unknown id → `unknown rule <id>`); `status` ∈ {`verified`, `assumed`}; enum parameters (`zeroSpeed`: `fullEachVisit`; `appliesTo`: `catches`; `window`: `24hFromNow`; `unlock`: `levelBelowSkill`/`levelAtMostSkill`; `weights`: `equal`; `model`: `uniformTimesHook`; `levelFrom` ∈ `UPGRADE_IDS`); numbers finite, bases `null` or ≥ 0; `minLevel`, offsets integers; every index the level range needs exists for every upgrade, else `rule levels: …`; `hidden` ⊆ `UPGRADE_IDS`.

`site/data/rules.json` (statements are the UI copy; `source` is `null` unless stated):

```json
{
  "version": 1,
  "sizeUnit": null,
  "rules": [
    { "id": "score", "status": "verified", "source": "Game Hive, DevUpdate #142 (2025-07-04)", "text": "Rewards follow the total length of all the fish you catch during the event." },
    { "id": "luresPerCatch", "status": "assumed", "source": null, "text": "Each catch uses one lure.", "value": 1 },
    { "id": "prestigeLures", "status": "assumed", "source": null, "text": "Each prestige gives as many lures as your Fishing Line value." },
    { "id": "tacklebox", "status": "assumed", "source": null, "text": "The Tacklebox makes one lure every N minutes, N being its Speed value, and holds a base capacity plus its Size value. At Speed 0 it is full at every visit.", "unitMinutes": 1, "baseCapacity": null, "zeroSpeed": "fullEachVisit" },
    { "id": "dailyCap", "status": "assumed", "source": null, "text": "You can catch at most a base daily limit plus your Bucket value per day, counted in 24-hour blocks from now.", "base": null, "appliesTo": "catches", "window": "24hFromNow" },
    { "id": "species", "status": "assumed", "source": null, "text": "Fishing Skill unlocks the species whose required level is below its value; every unlocked species is equally likely.", "unlock": "levelBelowSkill", "weights": "equal" },
    { "id": "size", "status": "assumed", "source": null, "text": "A catch's length is drawn evenly between the species' smallest and largest length, then multiplied by the Fishing Hook value.", "model": "uniformTimesHook" },
    { "id": "rarity", "status": "assumed", "source": null, "text": "Rarity is drawn from the rarity table at your bait value plus one.", "levelFrom": "FishingBait", "levelOffset": 1 },
    { "id": "coins", "status": "assumed", "source": null, "text": "A catch gives the coins its rarity is worth in the game's XP table." },
    { "id": "levels", "status": "assumed", "source": null, "text": "Levels start at 1; level L gives the L-th value of its list, and going from L to L+1 costs the L-th cost.", "minLevel": 1, "valueOffset": -1, "costOffset": -1 },
    { "id": "unusedLures", "status": "assumed", "source": null, "text": "Lures you do not use stay in stock, with no limit." },
    { "id": "upgradeNames", "status": "assumed", "source": "Game Hive, DevUpdate #142 (2025-07-04)", "text": "In-game names are matched to the game data from the descriptions in Game Hive's post.", "names": { "LuresPerPrestige": "Fishing Line", "LuresPerDay": "Bucket", "FishingHook": "Fishing Hook", "FishingSkill": "Fishing Skill", "FishingBait": null, "TackleBoxSpeed": "Tacklebox Speed", "TackleBoxSize": "Tacklebox Size" }, "hidden": [] }
  ]
}
```

- [ ] **Step 1: Write the failing tests** (`tests/rules.test.js`)

```js
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
```

- [ ] **Step 2: Run** `node --test tests/rules.test.js` — Expected: FAIL, module not found.
- [ ] **Step 3: Create** `site/data/rules.json` exactly as above, and implement `site/lib/rules.js`.
- [ ] **Step 4: Run** `node --test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add site/data/rules.json site/lib/rules.js tests/rules.test.js` then `git commit -m "feat(rules): add the game rules file and level indexing"`.

---

### Task 3: Model tables and reward tiers

**Files:**
- Create: `site/lib/model.js`, `tests/fixtures.js`
- Test: `tests/model.test.js`

**Interfaces:**
- Consumes: `GameData` (Task 1), `Rules`, `levelRange`, `upgradeValue`, `upgradeCost`, `RulesError` (Task 2).
- Produces:
  - `createModel(game, rules, settings: { prestigesPerDay: number ≥ 0, visitsPerDay: number > 0 }) → Model` (`RangeError` on a bad setting; `RulesError("rules.json: missing base: <name>")` when `dailyCapBase` or `tackleboxBaseCapacity` is `null`).
  - `Model = { game, rules, settings, ids: UpgradeId[] (UPGRADE_IDS minus rules.hidden), interval: number (hours), range(id), value(id, level), cost(id, level), catchSize(levels), catchCoins(levels), luresPerVisit(levels), dailyCap(levels) }`.
  - `catchSize` = Fishing Hook value × mean over unlocked species of `(minSize + maxSize) / 2` (0 when none is unlocked); unlocked = `levelToCatch < skill` (`levelBelowSkill`) or `≤ skill` (`levelAtMostSkill`), skill = Fishing Skill value. Precomputed for every (Fishing Skill level, Fishing Hook level) pair.
  - `catchCoins` = Σ probabilities × `xpByRarity` at rarity level `value(rarityLevelFrom) + rarityLevelOffset` (`RangeError` if that level is not in the table). Precomputed per level of `rarityLevelFrom`.
  - `luresPerVisit` = `prestigesPerDay × interval / 24 × value(LuresPerPrestige)` + Tacklebox lures over one interval: `min(capacity, interval × 60 / minutesPerLure)` with `minutesPerLure = value(TackleBoxSpeed) × tackleboxUnitMinutes`, or `capacity` when `minutesPerLure` is 0; `capacity = tackleboxBaseCapacity + value(TackleBoxSize)`.
  - `dailyCap` = `dailyCapBase + value(LuresPerDay)`.
  - `tiersReached(soloTiers, length) → { reached: Tier[], next: Tier|null }`.
  - Fixtures, exactly:

```js
// tests/fixtures.js — small hand-made data for engine tests (not game values), and the real files.
import fs from "node:fs";
import { buildGameData, DATA_FILES, UPGRADE_IDS } from "../site/lib/gameData.js";
import { loadRules } from "../site/lib/rules.js";

export const allAt = (level) => Object.fromEntries(UPGRADE_IDS.map((id) => [id, level]));

export function tinyGame(costs = {}) {
  const up = (id, values) => ({ id, bonusType: id, maxLevel: 3, costs: costs[id] ?? [10, 20, 40], values });
  return {
    upgrades: {
      LuresPerPrestige: up("LuresPerPrestige", [2, 4, 6]), LuresPerDay: up("LuresPerDay", [0, 10, 20]),
      FishingHook: up("FishingHook", [1, 1.5, 2]), FishingSkill: up("FishingSkill", [1, 2, 3]),
      FishingBait: up("FishingBait", [0, 1, 2]), TackleBoxSpeed: up("TackleBoxSpeed", [60, 30, 15]),
      TackleBoxSize: up("TackleBoxSize", [0, 2, 4])
    },
    rarityLevels: [{ level: 1, probabilities: [1, 0, 0, 0, 0] }, { level: 2, probabilities: [0.5, 0.5, 0, 0, 0] }, { level: 3, probabilities: [0, 0, 1, 0, 0] }],
    xpByRarity: [1, 2, 5, 25, 25],
    fish: [
      { id: 0, levelToCatch: 0, baseSize: 0, minSize: 1, maxSize: 3, raritySize: 0 },
      { id: 1, levelToCatch: 1, baseSize: 1, minSize: 3, maxSize: 5, raritySize: 0 },
      { id: 2, levelToCatch: 2, baseSize: 2, minSize: 5, maxSize: 9, raritySize: 0 }
    ],
    soloTiers: [{ id: 0, sizeRequired: 5, reward: "Diamonds:50" }, { id: 1, sizeRequired: 25, reward: "SkillPoint:1" }, { id: 2, sizeRequired: 100, reward: "PetsLvl5:1" }]
  };
}

export function tinyRules(overrides = {}) {
  return {
    sizeUnit: null, luresPerCatch: 1, tackleboxUnitMinutes: 1, tackleboxBaseCapacity: 4, tackleboxZeroSpeed: "fullEachVisit",
    dailyCapBase: 100, speciesUnlock: "levelBelowSkill", rarityLevelFrom: "FishingBait", rarityLevelOffset: 1,
    minLevel: 1, valueOffset: -1, costOffset: -1,
    names: Object.fromEntries(UPGRADE_IDS.map((id) => [id, id])), hidden: [], list: [], ...overrides
  };
}

export const realGame = () => buildGameData(Object.fromEntries(Object.entries(DATA_FILES).map(([k, f]) => [k, fs.readFileSync(new URL(`../site/data/${f}`, import.meta.url), "utf8")])));
export const realRules = (game) => loadRules(JSON.parse(fs.readFileSync(new URL("../site/data/rules.json", import.meta.url), "utf8")), game);
// Test-only bases: invented to exercise the engine on real data, never shipped as game values.
export const TEST_BASES = { dailyCapBase: 100, tackleboxBaseCapacity: 10 };
```

- [ ] **Step 1: Write the failing tests** (`tests/model.test.js`)

```js
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
```

- [ ] **Step 2: Run** `node --test tests/model.test.js` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `createModel` and `tiersReached` in `site/lib/model.js`; create `tests/fixtures.js` as above.
- [ ] **Step 4: Run** `node --test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add site/lib/model.js tests/fixtures.js tests/model.test.js` then `git commit -m "feat(engine): add the model tables and reward tiers"`.

---

### Task 4: Simulation

**Files:**
- Create: `site/lib/simulate.js`
- Test: `tests/simulate.test.js`

**Interfaces:**
- Consumes: `Model` (Task 3).
- Produces:
  - `initialState(model, input: { levels, coins, lures, hoursLeft, lengthSoFar }) → SimState`, `SimState = { visit: 0, phase: "collect", lastVisit: floor(hoursLeft / interval + 1e-9), levels, coins, lures, length: lengthSoFar, caughtToday: 0, day: 0 }`. Phases in order: `"collect" → "buyBefore" → "fish" → "buyAfter"`, then the next visit's `"collect"`.
  - `simulate(model, state, policy) → Result`, `Result = { finalLength, coinsLeft, luresLeft, purchases: Purchase[] }`, `Purchase = { upgradeId, fromLevel, toLevel, cost, hour, lengthAtPurchase }`. Resumes from the state's phase.
  - `Policy = (view: { levels, coins, hour }) → UpgradeId | null`, called repeatedly at a buy point: an affordable id (cost ≤ coins, not at max) is bought and the policy is asked again; `null`, an unaffordable id or an id at max ends the buy point.
  - `followOrder(order: UpgradeId[], then: Policy | null = null) → Policy`: returns the first item of `order` not yet reached (each item is the next level of that id, so `["FishingHook", "FishingHook"]` means levels +1 then +2), waiting while it is unaffordable; once all are reached, delegates to `then`. Stateless: it decides from `view.levels` and the levels `order` implies, so it can be reused across runs.
  - `advance(model, state, order) → { state: SimState, purchases: Purchase[] } | null`: runs `followOrder(order)` from `state` until every item of `order` is bought, and returns the snapshot right after the last purchase (same buy point, so resuming continues there); `null` when the event ends first or an item is at max. `simulate(model, advance(...).state, p)` gives the same final length as running the whole order then `p` from the start.

- [ ] **Step 1: Write the failing tests** (`tests/simulate.test.js`)

```js
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
  it("returns null when the order cannot be completed", () => {
    const m = model();
    assert.equal(advance(m, start(m, { hoursLeft: 0 }), ["FishingHook"]), null);
    assert.equal(advance(m, start(m, { coins: 1000 }), ["FishingHook", "FishingHook", "FishingHook"]), null);
  });
});
```

- [ ] **Step 2: Run** `node --test tests/simulate.test.js` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `site/lib/simulate.js` per the interfaces and the Global Constraints' visit order and daily window.
- [ ] **Step 4: Run** `node --test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add site/lib/simulate.js tests/simulate.test.js` then `git commit -m "feat(engine): simulate the event visit by visit in expected values"`.

---

### Task 5: Searches and the plan

**Files:**
- Create: `site/lib/search.js`
- Test: `tests/search.test.js`

**Interfaces:**
- Consumes: `Model` (Task 3); `initialState`, `simulate`, `followOrder`, `advance` (Task 4); `UPGRADE_IDS` (Task 1).
- Produces:
  - Constants `LOOKAHEAD_DEPTH`, `BEAM_WIDTH`, `DEADLINE_MS`, `EPS` (values in Global Constraints).
  - `evaluate(model, state, order) → Result` = `simulate(model, state, followOrder(order))`.
  - `compareResults(a, b) → number` (> 0 when `a` is better), per the Global Constraints' comparison order (first purchase = `purchases[0]`; no purchase counts as cost 0 and index −1).
  - `rolloutPolicy(model) → Policy`: among affordable next levels of `model.ids`, buys the one with the largest gain in length per hour per coin, where length per hour = `min(luresPerVisit / interval, dailyCap / 24) / luresPerCatch × catchSize`; a gain ≤ `EPS` is never bought; cost 0 with a gain ranks first; ties go to the lower cost, then `UPGRADE_IDS` order.
  - `lookaheadOrder(model, state, { depth = LOOKAHEAD_DEPTH, deadline = Infinity, now = Date.now }) → UpgradeId[]`: per spec §8.2 method 1; sequences start from the `advance` snapshot of the committed order; a sequence counts only if its first item is bought before the end; stops when the best first item does not beat "buy nothing more" by more than `EPS`, or at the deadline.
  - `beamOrder(model, state, { width = BEAM_WIDTH, deadline, now }) → UpgradeId[]`: per spec §8.2 method 2; nodes carry `advance` snapshots; children are scored by `simulate(snapshot, rolloutPolicy)`, ranked by `compareResults`; children with the same level vector keep the best only; returns the best order by `evaluate`.
  - `improveOrder(model, state, order, { deadline, now }) → UpgradeId[]`: per spec §8.2 method 3; moves tried in this order: remove one item, insert any id of `model.ids` at any position, move one item to any other position; the first strictly better order (by `compareResults`) is kept and the pass restarts; an order whose items exceed a max level is skipped. Approach: cache the `advance` snapshot after each prefix of the current order, and evaluate a move from the snapshot before its first changed position.
  - `describePlan(model, state, order) → Plan`, `Plan = { order, purchases, finalLength, coinsLeft, next: Next | null }`, `Next = Purchase & { affordable: cost ≤ state.coins, missingCoins: max(0, cost − state.coins), alternative: { upgradeId: UpgradeId | null, finalLength } }`. The alternative: for each id of `model.ids` other than the next one, the order `[id, ...order without its first occurrence of id]`, kept only if `id` is really the first purchase; the best by `compareResults`; if none, `{ upgradeId: null, finalLength: evaluate(model, state, []).finalLength }`. `order` lists only the purchases actually made.
  - `findBestPlan(model, state, { deadline = Infinity, now = Date.now, onProgress = () => {} }) → Plan`: runs `lookaheadOrder` with depth 1 to completion (ignoring the deadline) and publishes it; then lookahead with `LOOKAHEAD_DEPTH`, `beamOrder`, and `improveOrder` on the best so far, each within the deadline; calls `onProgress(plan)` each time a strictly better plan appears; returns the best. Deterministic.

- [ ] **Step 1: Write the failing tests** (`tests/search.test.js`)

```js
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
```

- [ ] **Step 2: Run** `node --test tests/search.test.js` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `site/lib/search.js` per the interfaces.
- [ ] **Step 4: Run** `node --test` — Expected: PASS. If a quality case fails, do not lower the threshold: stop and report the measured ratio.
- [ ] **Step 5: Commit** — `git add site/lib/search.js tests/search.test.js` then `git commit -m "feat(engine): search purchase orders and describe the best plan"`.

---

### Task 6: Measurements on real data

**Files:**
- Create: `scripts/bench.js`
- Modify: `README.md` (rewritten in English in Task 12; this task adds only a "Measurements" section)

**Interfaces:**
- Consumes: `realGame`-style loading (read `site/data/` with `fs`, as `tests/fixtures.js` does), `loadRules`, `createModel`, `initialState`, `lookaheadOrder`, `beamOrder`, `improveOrder`, `findBestPlan`, `evaluate`, `DEADLINE_MS`.
- Produces: `node scripts/bench.js` prints, for each case, the time of the first plan (lookahead depth 1), the final length and time of lookahead (depth 3), beam, improvement of the lookahead plan, and the portfolio within `DEADLINE_MS`. First line printed: `Test-only bases (not game values): daily limit base 100, Tacklebox base capacity 10`. Cases (all levels at the minimum, 0 coins, 20 lures, 0 length): 72 h with 10 prestiges and 6 visits a day; 168 h with 10 and 6; 168 h with 20 and 12.

- [ ] **Step 1: Write** `scripts/bench.js`.
- [ ] **Step 2: Run** `node scripts/bench.js` — Expected: a table for the three cases. The first plan should take at most 300 ms per case on the development PC, and the portfolio's final length must be ≥ each single method's. If the first plan takes longer, stop and report the timings before continuing.
- [ ] **Step 3: Record** the printed table in `README.md` under "Measurements", with the date, the machine ("development PC"), and the test-only bases line.
- [ ] **Step 4: Commit** — `git add scripts/bench.js README.md` then `git commit -m "chore(engine): measure the search methods on the real data"`.

---

### Task 7: Player input

**Files:**
- Create: `site/lib/input.js`
- Test: `tests/input.test.js`

**Interfaces:**
- Consumes: `UPGRADE_IDS` (Task 1); `levelRange` (Task 2).
- Produces:
  - `STORAGE_KEY = "tt2-fishing-derby:input:v1"`.
  - `Input = { levels: Record<UpgradeId, number>, coins, lures, hoursLeft: number|null, lengthSoFar, prestigesPerDay: number|null, visitsPerDay: number|null, shown: { dailyCap: number|null, tackleboxCapacity: number|null } }`.
  - `defaultInput(game, rules) → Input`: every level at its minimum, `coins`, `lures`, `lengthSoFar` 0, every other field `null`.
  - `readInput(raw: string|null, game, rules) → Input`: `null`, invalid JSON or `version !== 1` → defaults; otherwise field by field: a finite number ≥ 0 is kept, anything else takes the default; levels are floored and clamped into `levelRange`; unknown upgrade ids are ignored; absent ids take the minimum.
  - `serializeInput(input) → string` (`{ version: 1, ...input }`).
  - `loadInput(storage, game, rules) → Input` and `writeInput(storage, input) → boolean`: wrap `getItem`/`setItem` in `try`/`catch` (failure → defaults / `false`).
  - `missingFields(input, rules) → string[]`, in this order: `"hoursLeft"`, `"prestigesPerDay"`, `"visitsPerDay"` (also when 0), `"shown.dailyCap"` (only when `rules.dailyCapBase` is `null`), `"shown.tackleboxCapacity"` (only when `rules.tackleboxBaseCapacity` is `null`).

- [ ] **Step 1: Write the failing tests** (`tests/input.test.js`)

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultInput, readInput, serializeInput, loadInput, writeInput, missingFields, STORAGE_KEY } from "../site/lib/input.js";
import { realGame, realRules, allAt, TEST_BASES } from "./fixtures.js";

const game = realGame();
const rules = realRules(game);
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

describe("input", () => {
  it("starts from the minimum levels and empty values", () =>
    assert.deepEqual(defaultInput(game, rules), { levels: allAt(1), coins: 0, lures: 0, hoursLeft: null, lengthSoFar: 0,
      prestigesPerDay: null, visitsPerDay: null, shown: { dailyCap: null, tackleboxCapacity: null } }));
  it("falls back to the defaults for nothing, broken JSON or another version", () => {
    for (const raw of [null, "{not json", JSON.stringify({ version: 2, coins: 5 })]) assert.deepEqual(readInput(raw, game, rules), defaultInput(game, rules));
  });
  it("falls back field by field and clamps levels", () => {
    const got = readInput(JSON.stringify({ version: 1, coins: "abc", lures: 12, hoursLeft: 30,
      levels: { FishingHook: 99, FishingNet: 3, FishingSkill: -2, LuresPerDay: 2.7 } }), game, rules);
    assert.equal(got.coins, 0);
    assert.equal(got.lures, 12);
    assert.equal(got.hoursLeft, 30);
    assert.deepEqual(got.levels, { ...allAt(1), FishingHook: 11, FishingSkill: 1, LuresPerDay: 2 });
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
    assert.deepEqual(missingFields(defaultInput(game, rules), rules),
      ["hoursLeft", "prestigesPerDay", "visitsPerDay", "shown.dailyCap", "shown.tackleboxCapacity"]);
    assert.deepEqual(missingFields({ ...defaultInput(game, rules), hoursLeft: 10, prestigesPerDay: 5, visitsPerDay: 0 }, { ...rules, ...TEST_BASES }), ["visitsPerDay"]);
  });
});
```

- [ ] **Step 2: Run** `node --test tests/input.test.js` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `site/lib/input.js`.
- [ ] **Step 4: Run** `node --test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add site/lib/input.js tests/input.test.js` then `git commit -m "feat(input): read, save and check the player's input"`.

---

### Task 8: Loading and the plan request

**Files:**
- Create: `site/lib/load.js`, `site/lib/planRequest.js`, `site/worker.js`
- Test: `tests/load.test.js`, `tests/planRequest.test.js`

**Interfaces:**
- Consumes: `buildGameData`, `DATA_FILES` (Task 1); `loadRules`, `withShownValues` (Task 2); `createModel` (Task 3); `initialState` (Task 4); `findBestPlan`, `DEADLINE_MS` (Task 5); `missingFields` (Task 7).
- Produces:
  - `class LoadError extends Error` (message `"<url>: HTTP <status>"`).
  - `loadData(fetchFn, baseUrl = "") → Promise<{ game, rules }>`: fetches `${baseUrl}data/<file>` for every `DATA_FILES` entry and `${baseUrl}data/rules.json` (URLs relative to the page, no leading slash); `DataError` and `RulesError` propagate unchanged.
  - `runPlanRequest({ game, rules, input }, { post, now }) → void`: posts `{ type: "missing", fields }` and stops when `missingFields` is not empty; otherwise applies `withShownValues`, builds the model and state, runs `findBestPlan` with `deadline: now() + DEADLINE_MS`, posts `{ type: "progress", plan }` on each improvement and `{ type: "done", plan }` at the end; any error posts `{ type: "error", message }`.
  - `site/worker.js` (imports `./lib/planRequest.js`): `onmessage = (e) => runPlanRequest(e.data, { post: (m) => postMessage({ id: e.data.id, ...m }), now: () => performance.now() })`. The page terminates and recreates the worker when a new request arrives during a run (Task 11).

- [ ] **Step 1: Write the failing tests**

```js
// tests/load.test.js
import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadData } from "../site/lib/load.js";

const fakeFetch = (missing = "") => async (url) => url.endsWith(missing) && missing
  ? { ok: false, status: 404, text: async () => "" }
  : { ok: true, status: 200, text: async () => fs.readFileSync(new URL(`../site/${url}`, import.meta.url), "utf8") };

it("loads the game data and the rules", async () => {
  const { game, rules } = await loadData(fakeFetch());
  assert.equal(game.fish.length, 50);
  assert.equal(rules.list.length, 12);
});
it("names the file that could not be fetched", async () =>
  assert.rejects(loadData(fakeFetch("MinigameFishingDerbyXPInfo.csv")), /fishing_derby_data\/MinigameFishingDerbyXPInfo\.csv: HTTP 404/));
```

```js
// tests/planRequest.test.js
import { it } from "node:test";
import assert from "node:assert/strict";
import { runPlanRequest } from "../site/lib/planRequest.js";
import { tinyGame, tinyRules, allAt, realGame, realRules } from "./fixtures.js";

const collect = (data) => { const out = []; let t = 0; runPlanRequest(data, { post: (m) => out.push(m), now: () => ++t }); return out; };
const complete = { levels: allAt(1), coins: 0, lures: 10, hoursLeft: 12, lengthSoFar: 0, prestigesPerDay: 4, visitsPerDay: 4, shown: { dailyCap: null, tackleboxCapacity: null } };
const free = tinyGame(Object.fromEntries(Object.keys(tinyGame().upgrades).map((id) => [id, id === "FishingHook" ? [0, 1000, 1000] : [1000, 1000, 1000]])));

it("posts the missing fields and nothing else", () =>
  assert.deepEqual(collect({ game: tinyGame(), rules: tinyRules(), input: { ...complete, hoursLeft: null } }), [{ type: "missing", fields: ["hoursLeft"] }]));
it("posts progress then the final plan", () => {
  const out = collect({ game: free, rules: tinyRules(), input: complete });
  assert.equal(out.at(-1).type, "done");
  assert.equal(out.at(-1).plan.finalLength, 66);
  assert.ok(out.slice(0, -1).every((m) => m.type === "progress"));
});
it("uses the shown values when the rules have no base", () => {
  const game = realGame();
  const out = collect({ game, rules: realRules(game), input: { ...complete, shown: { dailyCap: 100, tackleboxCapacity: 10 } } });
  assert.equal(out.at(-1).type, "done");
});
it("reports an engine error as a message", () => {
  const out = collect({ game: tinyGame(), rules: tinyRules(), input: { ...complete, visitsPerDay: -1 } });
  assert.equal(out.at(-1).type, "error");
});
```

- [ ] **Step 2: Run** `node --test tests/load.test.js tests/planRequest.test.js` — Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** `site/lib/load.js`, `site/lib/planRequest.js`, `site/worker.js`. (`visitsPerDay: -1` must not be reported as missing: `missingFields` lists 0 and `null`; a negative value reaches `createModel`, which throws `RangeError`.)
- [ ] **Step 4: Run** `node --test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add site/lib/load.js site/lib/planRequest.js site/worker.js tests/load.test.js tests/planRequest.test.js` then `git commit -m "feat(engine): load the data and run plan requests in a worker"`.

---

### Task 9: Apply the in-game readings (owner's readings of 2026-10-15)

**Files:**
- Modify: `site/data/rules.json`, `fishing_derby_data/README.md` (validation status), tests whose expected values depend on a changed default (`tests/rules.test.js`).

- [ ] **Step 1: Collect** the owner's filled reading template (reminder of 2026-10-15, checks 1 to 6).
- [ ] **Step 2: For each rule a reading settles**, set its parameters, `status: "verified"` and `source: "In-game reading by kasaden, 2026-10-15"`. A reading that only partly confirms a rule keeps `assumed` and the text says what was seen. If `FishingBait` does not exist in game, add it to `hidden` and set `rarity.levelFrom` to what the readings show; if they show nothing, keep the rule `assumed` and say so in its text.
- [ ] **Step 3: If a reading needs an option the engine does not have** (for example the daily limit counting lures earned, or a Tacklebox unit in seconds that the `unitMinutes` factor cannot express), stop: report to the owner and re-plan that change before going on.
- [ ] **Step 4: Run** `node --test` — Expected: PASS after updating only the expected values that follow from the changed defaults (name each one in the commit message).
- [ ] **Step 5: Commit** — `git add site/data/rules.json fishing_derby_data/README.md tests/rules.test.js` then `git commit -m "data(rules): apply the in-game readings of 2026-10-15"`.

---

### Task 10: Visual direction gate (owner)

**Files:**
- Create: `PRODUCT.md` (written by `/impeccable init` from the spec), the direction contract and mock-ups in Impeccable's own locations.

- [ ] **Step 1: Run** the Impeccable skill's init flow; `PRODUCT.md` takes users, purpose, stack, constraints and brand commitments from the spec (§1 to §5, §9, §14) and from `../tt2_hub/PRODUCT.md` (brand commitments), without inventing usage numbers or testimonials.
- [ ] **Step 2: Produce mock-ups**, at 375 px and 1440 px, of: the input panel with level controls; the next-purchase card in both states ("Buy now", "Save up: N more coins") and the "nothing worth buying" state; the plan list; the final estimate with rewards reached; the rules section; the missing-values message; the data-error banner. Each mock uses the hub base tokens; two or three candidates for the tool's accent colour (≥ 3:1 on `night`) and emblem.
- [ ] **Step 3: Gate with the owner.** Open with one open question on the whole look before any narrow choice; then accent, emblem, card look. Record the choices in the direction contract.
- [ ] **Step 4: Re-plan Task 11.** Update its brief with the chosen structure, control names and texts; until then its tests name roles and behaviours only.
- [ ] **Step 5: Commit** — `git add PRODUCT.md` (and the direction files Impeccable keeps in the repository) then `git commit -m "docs(design): record the product brief and the chosen direction"`.

---

### Task 11: The page

**Files:**
- Create: `site/index.html`, `site/style.css`, `site/index.js`, `site/favicon.svg`, `site/lib/format.js`, `server.js` (copy of `../tt2_monuments/server.js` with `ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "site")`, port `4192`, and the log line naming "TT2 Fishing Derby Optimizer")
- Test: `tests/format.test.js`

**Interfaces:**
- Consumes: `loadData` (Task 8), `defaultInput`, `loadInput`, `writeInput`, `missingFields` (Task 7), `levelRange` (Task 2), `tiersReached` (Task 3), `site/worker.js` messages (Task 8), created in the page with `new Worker("worker.js", { type: "module" })`.
- Produces (`site/lib/format.js`, DOM-free):
  - `formatLength(value, unit) → string`: rounded to a whole number with thousands separators (`en-US`), followed by `" " + unit` when `unit` is not `null`.
  - `formatPurchaseTime(nowMs, hour, locale = "en-GB") → string`: weekday and hour of `nowMs + hour × 3600000`, e.g. `"Thu 14:00"`; `"now"` when `hour` is 0.
  - `upgradeLabel(rules, id) → string`: `rules.names[id]`, or `` `${id} (name not verified)` `` when it is `null`.
  - `whyLine(next, rules, unit) → string`: `"Estimated final length with this purchase: <A>. Best other first purchase, <name>: <B>."`, or `"… Buying nothing: <B>."` when `alternative.upgradeId` is `null`.
- Page behaviours (structure and texts follow the gate of Task 10; the tests of this task cover `site/lib/format.js` only, the page is verified in Task 12):
  - Load data at start; on failure, an alert names the file and the error and no form is shown.
  - Inputs: each upgrade of `model.ids` by its label, bounded by `levelRange`, with decrement / increment and typing; coins, lures, time left in days and hours, length so far, prestiges per day, visits per day; the two shown-value fields appear only when `missingFields` can list them, labelled "Daily lure limit shown in game" and "Tacklebox capacity shown in game".
  - Every change is saved (`writeInput`) and starts a new plan request after 150 ms without changes; a request in progress is terminated (new worker); while it runs, "Improving the plan…" is shown next to the latest plan.
  - Missing values: one message naming each field by its label; no plan. Zero hours left: "The event has ended."
  - Next purchase: label, "level L → L+1", cost, then "Buy now" or "Save up: N more coins"; the why line; `next` null: "Nothing worth buying before the event ends."
  - Plan: one row per purchase, in order: label, levels, cost, `formatPurchaseTime`, length at that time.
  - Final estimate: "Best plan found", the estimated final length, the rewards reached (`tiersReached`) and the next tier.
  - Rules: a disclosure listing each rule's text with a "Verified" or "Assumed" badge and its source when there is one.
  - Footer: the exact notice, the MIT licence, links to TT2_CSV by rawrzcookie and to Game Hive's DevUpdate #142, and a link to the source code only if the owner has decided to make the repository public (spec §15); otherwise no source link.

- [ ] **Step 1: Write the failing tests** (`tests/format.test.js`)

```js
import { it } from "node:test";
import assert from "node:assert/strict";
import { formatLength, formatPurchaseTime, upgradeLabel, whyLine } from "../site/lib/format.js";

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
  const next = { upgradeId: "FishingHook", alternative: { upgradeId: "LuresPerDay", finalLength: 80 } };
  assert.equal(whyLine({ ...next, finalLength: 80 }, rules, null), "Estimated final length with this purchase: 80. Best other first purchase, Bucket: 80.");
  assert.equal(whyLine({ ...next, finalLength: 66, alternative: { upgradeId: null, finalLength: 44 } }, rules, null), "Estimated final length with this purchase: 66. Buying nothing: 44.");
});
```

`whyLine` reads the plan's final length from `next.finalLength`; `index.js` passes `{ ...plan.next, finalLength: plan.finalLength }`. `formatPurchaseTime` takes an optional fourth argument `timeZone` (default: the browser's), used by the test for a fixed result.

- [ ] **Step 2: Run** `node --test tests/format.test.js` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `site/lib/format.js`.
- [ ] **Step 4: Run** `node --test` — Expected: PASS.
- [ ] **Step 5: Build** `site/index.html`, `site/style.css`, `site/index.js`, `site/favicon.svg`, `server.js` per the behaviours above and the Task 10 brief.
- [ ] **Step 6: Run** `node server.js` and open `http://127.0.0.1:4192/` — Expected: the page loads with no console error and shows the missing-values message on first visit.
- [ ] **Step 7: Commit** — `git add site server.js tests/format.test.js` then `git commit -m "feat(ui): add the optimizer page"`.

---

### Task 12: Verification, documentation, publication

**Files:**
- Create: `DESIGN.md` (written from the built page, with Impeccable's documenter)
- Modify: `README.md` (rewritten in English)

- [ ] **Step 1: Render checks.** With `node server.js` running, fill a complete input (levels at the minimum, 20 lures, 72 hours, 10 prestiges and 6 visits a day, shown limit 100 and capacity 10) and take captures at 375 px and 1440 px of: the first visit (missing values), the plan computed, a data error (rename one CSV in a scratch copy served on another port). Look at each capture.
- [ ] **Step 2: Run** `npx impeccable detect` on `http://127.0.0.1:4192/` — Expected: no new finding, or each one fixed or explained.
- [ ] **Step 3: Keyboard and motion.** Tab through the whole page (every control reachable, focus visible, order logical); repeat with reduced motion emulated.
- [ ] **Step 4: Timing in the browser.** Measure the time to the first plan and to the final plan with the input of Step 1; record it next to the Task 6 table.
- [ ] **Step 5: Documentation.** `DESIGN.md` from the built page; `README.md` in English: what the tool does, how to run it (`node server.js`, `node --test`), the data and its source (TT2_CSV by rawrzcookie, the pinned commit the CSVs come from: `b4e9f1df` of 2026-10-13), every assumed rule, the measurements, the licence and the notice.
- [ ] **Step 6: Commit** — `git add DESIGN.md README.md` then `git commit -m "docs: document the optimizer, its rules and its measurements"`.
- [ ] **Step 7: Publication (owner's go required).** The owner creates the Cloudflare account and the Pages project connected to the GitHub repository, with: framework preset none, build command empty, build output directory `site`, production branch `main` (spec §14). Nothing is pushed or published without the owner's explicit go. After the first deployment, open the `*.pages.dev` address the dashboard shows and check that the page loads, the plan computes, and that `/docs/`, `/tests/` and `/fishing_derby_data/` are not served. Adding the tool to `../tt2_hub` is a separate task in the hub's repository.
