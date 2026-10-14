---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: []
---

## Scope

The tool's single page (`site/index.html`), Operate mode. Order fixed by the spec (§ 6, § 9): the player's input, then the result (next purchase, why, estimated final length and solo rewards, the full plan), the rules used, and a footer with the unofficial notice. Phone and computer; on a phone the result follows the input.

## Audience and job

A Tap Titans 2 player during a Fishing Derby, after a fishing session, often on a phone next to the game: update a few numbers, read the next purchase, buy it in the game. Owner's anti-goals (2026-10-14, same as Monuments): a spreadsheet, a cold dashboard (greys and blues, gauges), a glittery game screen (loot effects, neon, motion everywhere). Motion intensity 3 at most.

## Constraints

- Owner, 2026-10-14: the final look is "as close to the game as possible", like Monuments with the Transcendence screens, from the owner's screenshots of the Fishing Derby screens (expected the night of 2026-10-15); no official art or logo.
- Owner, 2026-10-14: "usable first": this version ships now on the family base of `../tt2_hub/DESIGN.md`, and the game look replaces its material after the screenshots, through a mock-up gate. Structure and behaviour carry over; only the world changes.
- Everything the page serves lives in `site/`; relative links only. English copy. No invented game value: unknown values are asked or labelled.

## Chosen direction

Pinned by the owner, no roll: family base now (night, gold, Outfit / Geist / Geist Mono, 12 / 8 / 6 px corners, the hub's easing), game look later.

## Unresolved

- The game look (palette, materials, marks) waits for the screenshots and its own mock-up gate.
- Whether the repository becomes public (spec § 15): until then, no source-code link in the footer.

## Direction contract

THESIS: The page answers one question before anything else, what to buy next in the Fishing Derby, and backs it with the plan and the rules it rests on. It refuses the category default (a form, an Optimize button, then a results table) by recomputing as the player types and putting the next purchase first in the result.

OWN-WORLD: The TT2 family base: night ground with grain and the two ambient washes, tonal surfaces stepping up (surface, raised, high), gold as the one voice for the action and the next purchase, bone text, mist secondary text, Geist Mono for every count and cost, 12 px panels, 8 px controls, 6 px status tags.

STORY: The player fills in what the game shows (levels, coins, lures, time left, length so far, how they play), sees which value is still missing, then reads the next purchase, "Buy now" or "Save up", and why; below it, the estimated final length with the rewards it reaches, and the plan to the end with approximate times. The rules used, verified or assumed, sit in a disclosure.

FIRST VIEWPORT: Title and one line of purpose; on a computer two columns, the input panel on the left and the result on the right, the next-purchase card at the top of the result in gold-rimmed night-raised, upgrade name at headline size, level step and cost in mono, the verdict as the strongest text on the page. On a phone, the input first, the result after it.

FORM: Pinned by the owner (family base, usable first); no concept-seed roll ran for this version.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
