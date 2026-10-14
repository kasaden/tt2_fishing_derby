# TT2 Fishing Derby Optimizer

Which Fishing Derby upgrade to buy next in Tap Titans 2, and the whole purchase plan to the end of the event, for the largest total length of fish caught.

**Status:** in development. The first version works on the TT2 family look; its event look comes once the owner's in-game screenshots are in. Several game rules are still assumed (see below).

100 % client-side, plain HTML, CSS and JavaScript: no framework, no build step, no dependency, no server code. Your input stays in your browser (`localStorage`).

## How it works

You enter what the game shows: each upgrade's level, your Fishing Coins, the lures in stock, the time left, the length caught so far, and how you play (prestiges and visits per day). The tool then:

1. simulates the rest of the event visit by visit, in expected values (average catches, sizes and coins); above 12 visits a day, purchases and catches are decided in 2-hour steps while the Tacklebox still fills visit by visit;
2. searches purchase orders with three methods (a three-purchase lookahead, a beam of 30 partial plans, and an improvement pass that removes, inserts or moves one purchase) in a Web Worker for about two seconds, and keeps the best plan found;
3. shows the next purchase ("Buy now" or "Save up"), why, the estimated final length with the solo reward tiers it reaches, and the plan to the end.

Between two plans of the same length it prefers fewer purchases, then more coins left: a purchase that adds no length is never recommended. The plan is the best found, not a proof, and the estimate rests on the rules below.

## Rules

Some Fishing Derby rules are not published. `site/data/rules.json` holds each rule the engine relies on, marked `verified` or `assumed`, and the page lists them. Today only the score (rewards follow the total length caught, Game Hive's DevUpdate #142) is verified. Assumed: one lure per catch; lures per prestige from Fishing Line; the Tacklebox's rate and capacity; the daily catch limit; how Fishing Skill unlocks species and how a species is drawn; how a catch's length is drawn and multiplied by Fishing Hook; which upgrade sets the rarity table's level; coins per catch from the rarity table; how displayed levels map to the cost and value lists; unused lures kept; the in-game names of the upgrades. Two base values (the daily lure limit and the Tacklebox capacity) are not known at all: the page asks for the values the game shows. A corrected rule is a data change in `rules.json`, not a code change.

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

Measured on 2026-10-14 on the development PC (Node v22.20.0) with `node scripts/bench.js`. Lengths are the estimated final total length; times are wall-clock.

Test-only bases (not game values): daily limit base 100, Tacklebox base capacity 10.
Start: every upgrade at its minimum level, 0 coins, 20 lures, 0 length. Portfolio deadline: 2000 ms.

| Case | First plan (lookahead 1) | Lookahead 3 | Beam 30 | Improved lookahead 3 | Portfolio within deadline |
| --- | --- | --- | --- | --- | --- |
| 72 h, 10 prestiges and 6 visits a day | 8,426 in 38 ms | 8,873 in 758 ms | 13,310 in 475 ms | 9,049 in 249 ms | 13,609 in 1,776 ms |
| 168 h, 10 prestiges and 6 visits a day | 44,217 in 120 ms | 45,933 in 2,170 ms | 46,105 in 1,169 ms | 47,439 in 2,022 ms | 46,837 in 2,002 ms |
| 168 h, 20 prestiges and 12 visits a day | 58,890 in 72 ms | 61,189 in 3,399 ms | 60,567 in 1,963 ms | 62,464 in 2,078 ms | 60,567 in 2,001 ms |

The single-method columns run without a deadline. When the deadline cuts a method short, where it stops varies from run to run, so the portfolio column moves by about 1 % between runs; methods given more than 2 seconds still find up to 3 % more on the 168-hour cases.

In the page (headless Chrome, the 72-hour case): the first plan is on screen about 140 ms after navigation and the best plan after about 2 s.

**Slower devices.** Chrome's 4× CPU throttling left the page's result unchanged, but it very likely does not slow the Web Worker that runs the search, so it says nothing about a phone. The same search given a quarter of the time (500 ms, a device about four times slower) reaches 8,426 instead of 13,609 on the 72-hour case: on a slow phone the 2-second search can stop at a clearly weaker plan. Searching longer on such devices is an open decision.

## Publishing

Cloudflare Pages, connected to this repository: no framework preset, an empty build command, build output directory `site`, production branch `main`.

## Licence

MIT, © 2026 kasaden. Unofficial. Tap Titans 2 is a trademark of Game Hive Corp. This site is not affiliated with or endorsed by Game Hive.
