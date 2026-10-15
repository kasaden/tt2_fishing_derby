# TT2 Fishing Derby Optimizer

Which Fishing Derby upgrade to buy next in Tap Titans 2, and the whole purchase plan to the end of the event, for the largest total length of fish caught.

**Status:** in development. The first version works on the TT2 family look; its event look comes once the owner's in-game screenshots are in. The lure, level and cost rules were checked in game on 2026-10-15; how catches are drawn is still assumed (see below).

100 % client-side, plain HTML, CSS and JavaScript: no framework, no build step, no dependency, no server code. Your input stays in your browser (`localStorage`).

## How it works

You enter what the game shows: each upgrade's level, your Fishing Coins, the lures in stock, the prestige lures received today (the Daily Limit counter), the time left, the length caught so far, and how you play (prestiges and visits per day). The tool then:

1. simulates the rest of the event visit by visit, in expected values (average catches, sizes and coins); above 12 visits a day, purchases and catches are decided in 2-hour steps while the Tacklebox still fills visit by visit;
2. searches purchase orders with three methods (a three-purchase lookahead, a beam of 30 partial plans, and an improvement pass that removes, inserts or moves one purchase) in a Web Worker for about two seconds, and keeps the best plan found;
3. shows the next purchase ("Buy now" or "Save up"), why, the estimated final length with the solo reward tiers it reaches, and the plan to the end.

Between two plans of the same length it prefers fewer purchases, then more coins left: a purchase that adds no length is never recommended. The plan is the best found, not a proof, and the estimate rests on the rules below.

## Rules

Some Fishing Derby rules are not published. `site/data/rules.json` holds each rule the engine relies on, marked `verified` or `assumed`, and the page lists them. Verified: the score (rewards follow the total length caught, Game Hive's DevUpdate #142); and, from the owner's in-game reading on 2026-10-15, one lure per catch; 1 lure plus the Fishing Line bonus per prestige (5 at level 1); the Tacklebox makes one lure every 30 seconds plus its Speed value (60 s at level 1) and holds 5 plus its Size value; at most 100 prestige lures a day plus the Bucket bonus, Tacklebox lures not counted, reset at 00:00 UTC; levels 1 to 10, level L giving the L-th value of its list and the next level costing the next cost; unused lures kept; the in-game names of the seven upgrades. Assumed: how Fishing Skill unlocks species and how a species is drawn; how a catch's length is drawn and multiplied by Fishing Hook; which upgrade sets the rarity table's level; coins per catch from the rarity table. A corrected rule is a data change in `rules.json`, not a code change.

## Run locally

```
node server.js     # http://127.0.0.1:4192/ (serves site/ only, like the host)
node --test        # unit tests, Node's built-in test runner
node scripts/bench.js   # search methods measured on the real data
```

Node.js 22.7 or newer. Nothing to install.

## Files

- `site/`: everything the page serves, and nothing else (it is the published folder): `index.html`, `style.css`, `index.js`, `worker.js`, `favicon.svg`, the engine in `site/lib/`, the game CSVs and `rules.json` in `site/data/`.
- `fishing_derby_data/`: where the CSVs come from and how they were checked (`README.md`, in French), and `model_check.py`.
- `tests/`: the tests; `tests/site.test.js` fails if `site/` holds a file the page does not serve or a path that starts with `/`.
- `docs/superpowers/`: the design spec and the implementation plan (in French).

## Game data

The six `MinigameFishingDerby*.csv` files in `site/data/` are copies of [rawrzcookie/TT2_CSV](https://github.com/rawrzcookie/TT2_CSV), identical to its commit `b4e9f1df` of 2026-10-13 apart from line endings. The page reads them at startup; no game value is copied into the code.

## Measurements

Measured on 2026-10-15 on the development PC with `node scripts/bench.js`, under the rules of `rules.json` (bases read in game). Lengths are the estimated final total length; times are wall-clock.

Start: every upgrade at its minimum level, 0 coins, 20 lures, 0 length. Portfolio deadline: 2000 ms.

| Case | First plan (lookahead 1) | Lookahead 3 | Beam 30 | Improved lookahead 3 | Portfolio within deadline |
| --- | --- | --- | --- | --- | --- |
| 72 h, 10 prestiges and 6 visits a day | 28,562 in 52 ms | 31,884 in 1,016 ms | 31,982 in 555 ms | 32,440 in 457 ms | 32,494 in 2,006 ms |
| 168 h, 10 prestiges and 6 visits a day | 105,337 in 62 ms | 105,150 in 1,948 ms | 106,062 in 1,235 ms | 109,042 in 434 ms | 109,622 in 2,055 ms |
| 168 h, 20 prestiges and 12 visits a day | 135,959 in 60 ms | 134,958 in 3,218 ms | 137,131 in 1,974 ms | 139,569 in 1,484 ms | 137,131 in 2,002 ms |

The single-method columns run without a deadline. When the deadline cuts a method short, where it stops varies from run to run, so the portfolio column moves by about 1 % between runs; methods given more than 2 seconds still find up to 3 % more on the 168-hour cases.

In the page (headless Chrome, the 72-hour case, measured on 2026-10-14): the first plan is on screen about 140 ms after navigation and the best plan after about 2 s.

**Slower devices.** Chrome's 4× CPU throttling left the page's result unchanged, but it very likely does not slow the Web Worker that runs the search, so it says nothing about a phone. Measured on 2026-10-14, before the rules were read in game: the same search given a quarter of the time (500 ms, a device about four times slower) reached 8,426 instead of 13,609 on the 72-hour case: on a slow phone the 2-second search can stop at a clearly weaker plan. Searching longer on such devices is an open decision.

## Publishing

For now, GitHub Pages: `.github/workflows/pages.yml` runs the tests and publishes `site/` only, on every push to `main` (repository settings: Pages, source "GitHub Actions"). Expected address: https://kasaden.github.io/tt2_fishing_derby/. Planned next: Cloudflare Pages connected to this repository, with no framework preset, an empty build command, build output directory `site` and production branch `main`.

## Licence

MIT, © 2026 kasaden. Unofficial. Tap Titans 2 is a trademark of Game Hive Corp. This site is not affiliated with or endorsed by Game Hive.
