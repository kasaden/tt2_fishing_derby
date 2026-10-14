// Loading the data through a fake fetch that reads site/ from disk.
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
  assert.rejects(loadData(fakeFetch("MinigameFishingDerbyXPInfo.csv")), /\bdata\/MinigameFishingDerbyXPInfo\.csv: HTTP 404/));
