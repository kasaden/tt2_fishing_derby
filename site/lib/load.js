// Fetches the game CSVs and the rules file, relative to the page, and builds them.
import { buildGameData, DATA_FILES } from "./gameData.js";
import { loadRules } from "./rules.js";

/** A file that could not be fetched; the message names its URL and the HTTP status. */
export class LoadError extends Error {
  constructor(message) {
    super(message);
    this.name = "LoadError";
  }
}

async function text(fetchFn, url) {
  const response = await fetchFn(url);
  if (!response.ok) throw new LoadError(`${url}: HTTP ${response.status}`);
  return response.text();
}

/** Loads { game, rules }. URLs are relative (`data/…`), so the site works under any path. */
export async function loadData(fetchFn, baseUrl = "") {
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, file]) => [key, await text(fetchFn, `${baseUrl}data/${file}`)])
  );
  const rulesText = await text(fetchFn, `${baseUrl}data/rules.json`);
  const game = buildGameData(Object.fromEntries(entries));
  let json;
  try {
    json = JSON.parse(rulesText);
  } catch (error) {
    throw new LoadError(`${baseUrl}data/rules.json: not valid JSON (${error.message})`);
  }
  return { game, rules: loadRules(json, game) };
}
