// One plan request, as the worker runs it.
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
it("passes the daily reset and the prestige lures already received to the simulation", () => {
  const rules = tinyRules({ dailyCapBase: 3 });
  const pricey = tinyGame(Object.fromEntries(Object.keys(tinyGame().upgrades).map((id) => [id, [1000, 1000, 1000]])));
  assert.equal(collect({ game: pricey, rules, input: { ...complete, prestigeLuresToday: 3 } }).at(-1).plan.finalLength, 36);
  assert.equal(collect({ game: pricey, rules, input: { ...complete, hoursToReset: 12 } }).at(-1).plan.finalLength, 44);
});
it("uses the shown values when the rules have no base", () => {
  const game = realGame();
  const out = collect({ game, rules: { ...realRules(game), dailyCapBase: null, tackleboxBaseCapacity: null }, input: { ...complete, shown: { dailyCap: { value: 100, level: 1 }, tackleboxCapacity: { value: 10, level: 1 } } } });
  assert.equal(out.at(-1).type, "done");
  const { finalLength } = out.at(-1).plan;
  assert.ok(Number.isFinite(finalLength) && finalLength > 0, `final length ${finalLength}`);
});
it("reports an engine error as a message", () => {
  const out = collect({ game: tinyGame(), rules: tinyRules(), input: { ...complete, visitsPerDay: -1 } });
  assert.equal(out.at(-1).type, "error");
});
