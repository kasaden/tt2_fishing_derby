# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Same as the owner's other TT2 tools (confirmed 2026-10-14): plain HTML, CSS and JavaScript, no framework, no build step, no dependency, no server-side code. Everything runs in the browser; the plan search runs in a Web Worker. Published on GitHub Pages for now (owner, 2026-10-14), by a GitHub Actions workflow that runs the tests and publishes `site/` only; Cloudflare Pages (Git integration, production branch `main`, build output directory `site`) is planned next. Either way, only the files in `site/` are published.

## Users

Tap Titans 2 players during a Fishing Derby event, the whole community, in English. After each fishing session, on a phone while playing or on a computer, they update a few numbers (upgrade levels, coins, lures, time left, length so far) and read which upgrade to buy next. They want an answer they can act on in seconds, not a spreadsheet.

## Product Purpose

TT2 Fishing Derby Optimizer tells the player which Fishing Derby upgrade to buy next, and the whole purchase plan to the end of the event, so they finish with the largest total length of fish caught. Game Hive's DevUpdate #142 (2025-07-04) says the event's rewards, both the collection tiers and the final leaderboard, follow that total length.

The first version is for the event that starts on 2026-10-15; it is then adapted from the owner's experience for the following derbies.

Success: the next purchase is shown first and is right under the rules the tool states; every rule it relies on says whether it was verified in game or assumed.

## Positioning

An optimizer built from the game's own data tables, not a ranking: it simulates the rest of the event in expected values and searches purchase orders, keeping the best plan found within about two seconds. It says plainly that the plan is the best found, not proven, and that its estimate rests on rules marked verified or assumed.

## Operating Context

- The Fishing Derby is a temporary event that comes back periodically. Upgrades (Fishing Line, Bucket, Fishing Hook, Fishing Skill, Tacklebox Speed, Tacklebox Size, and a bait upgrade whose in-game existence is unverified) are bought with Fishing Coins earned from catches; lures come from prestiges and from the Tacklebox.
- Game data: the `MinigameFishingDerby*.csv` files mirrored at github.com/rawrzcookie/TT2_CSV, copied into `site/data/`; provenance and checks in `fishing_derby_data/README.md`.
- Several game rules are unknown (how a catch's size and species are drawn, what raises the rarity level, the base daily lure limit and Tacklebox capacity, the Tacklebox Speed unit). They live in `site/data/rules.json`, each marked verified or assumed, and the owner's in-game readings update them.
- The account export the game offers did not contain Fishing Derby data in exports made outside the event; input is typed by hand.
- Browser storage is tied to the site's address: input saved under the `*.pages.dev` address will not follow a later custom domain (accepted by the owner).
- Sibling repositories, read-only from here: `../tt2_hub` (the hub that will list this tool), `../tt2_alchemy_lab`, `../tt2_dungeon_eggsplorer`, `../tt2_monuments`.

## Capabilities and Constraints

- Browser only, no backend, no server-side storage; the player's input stays on their device.
- Inputs: each upgrade's level as the game shows it, coins, lures in stock, time left, length caught so far, prestiges per day, visits per day; and, while the rules do not know them, the daily lure limit and Tacklebox capacity the game shows.
- Outputs: the next purchase ("Buy now" or "Save up: N more coins") and why, the full plan with approximate times, the estimated final length with the solo reward tiers it reaches, and the rules used with their status.
- No game value is invented: an unknown value is asked from the player or labelled assumed.
- English interface.
- The repository is public (owner, 2026-10-14, for GitHub Pages); the page links to its source code. Undecided: the exact `*.pages.dev` address once Cloudflare Pages is set up.

## Brand Commitments

- Name: **TT2 Fishing Derby Optimizer** (owner, 2026-10-14).
- Unofficial fan project, with the notice the sibling tools carry: "Unofficial. Tap Titans 2 is a trademark of Game Hive Corp. This site is not affiliated with or endorsed by Game Hive."
- MIT licence, © 2026 kasaden.
- Community data is credited: TT2_CSV by rawrzcookie; Game Hive's DevUpdate #142 for the event's mechanics.
- No official Tap Titans 2 art or logo is cleared for use.

## Evidence on Hand

- The six game CSV files (`site/data/`), checked byte for byte against TT2_CSV on 2026-10-14.
- Game Hive, DevUpdate #142 (2025-07-04): the upgrades and the reward principle, without numbers.
- Engine measurements on the real data with test-only base values (README, "Measurements").
- No in-game readings yet (the owner's first readings are planned for 2026-10-15). No usage numbers, testimonials, player counts or press: none may be invented.

## Product Principles

1. **Verified, or labelled.** Every rule the plan rests on says whether it was checked in game.
2. **The next purchase first.** The player acts on one purchase at a time; the plan explains it.
3. **Best found, honestly.** The tool shows its estimate and never calls a plan the best possible.
4. **Derbies are data.** A new derby or a corrected rule is a data change, not new code.
5. **Credit and disclaim.** Sources and the unofficial status stay visible.

## Accessibility & Inclusion

WCAG 2.1 AA (owner's standing rule): full keyboard use with visible focus, labelled fields, 4.5:1 text contrast, no information carried by colour alone, reduced motion respected.
