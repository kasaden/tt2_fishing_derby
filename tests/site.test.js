// Guards the published folder: Cloudflare Pages serves everything under site/, so only the files the page serves may live there.
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
