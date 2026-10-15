// Measures the search methods on the real game data: time and final length of each method, and of the portfolio within its deadline.
// Usage: node scripts/bench.js
// The rules are those of data/rules.json, bases included (read in game on 2026-10-15).
import fs from "node:fs";
import { buildGameData, DATA_FILES, UPGRADE_IDS } from "../site/lib/gameData.js";
import { loadRules } from "../site/lib/rules.js";
import { createModel } from "../site/lib/model.js";
import { initialState } from "../site/lib/simulate.js";
import { lookaheadOrder, beamOrder, improveOrder, findBestPlan, evaluate, DEADLINE_MS } from "../site/lib/search.js";

const read = (file) => fs.readFileSync(new URL(`../site/data/${file}`, import.meta.url), "utf8");
const game = buildGameData(Object.fromEntries(Object.entries(DATA_FILES).map(([k, f]) => [k, read(f)])));
const rules = loadRules(JSON.parse(read("rules.json")), game);

const CASES = [
  { hoursLeft: 72, prestigesPerDay: 10, visitsPerDay: 6 },
  { hoursLeft: 168, prestigesPerDay: 10, visitsPerDay: 6 },
  { hoursLeft: 168, prestigesPerDay: 20, visitsPerDay: 12 }
];

const timed = (fn) => {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
};
const fmt = (n) => Math.round(n).toLocaleString("en-US");

console.log(`Start: every upgrade at its minimum level, 0 coins, 20 lures, 0 length. Portfolio deadline: ${DEADLINE_MS} ms.`);
console.log("");
console.log("| Case | First plan (lookahead 1) | Lookahead 3 | Beam 30 | Improved lookahead 3 | Portfolio within deadline |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const c of CASES) {
  const model = createModel(game, rules, { prestigesPerDay: c.prestigesPerDay, visitsPerDay: c.visitsPerDay });
  const levels = Object.fromEntries(UPGRADE_IDS.map((id) => [id, model.range(id).min]));
  const state = initialState(model, { levels, coins: 0, lures: 20, hoursLeft: c.hoursLeft, lengthSoFar: 0 });
  const length = (order) => evaluate(model, state, order).finalLength;

  const first = timed(() => lookaheadOrder(model, state, { depth: 1 }));
  const look = timed(() => lookaheadOrder(model, state));
  const beam = timed(() => beamOrder(model, state));
  const improved = timed(() => improveOrder(model, state, look.value));
  const portfolio = timed(() => findBestPlan(model, state, { deadline: performance.now() + DEADLINE_MS, now: () => performance.now() }));

  const cell = (t) => `${fmt(length(t.value))} in ${fmt(t.ms)} ms`;
  console.log(`| ${c.hoursLeft} h, ${c.prestigesPerDay} prestiges and ${c.visitsPerDay} visits a day | ${cell(first)} | ${cell(look)} | ${cell(beam)} | ${cell(improved)} | ${fmt(portfolio.value.finalLength)} in ${fmt(portfolio.ms)} ms |`);
}
