// Finds a good order of purchases. Every candidate order is judged by the same simulation, and the best one found is kept:
// a lookahead (try every short sequence of next purchases), a beam search (keep the best partial orders at each step),
// then an improvement pass (remove, insert or move one purchase while it helps). The result is the best found, not a proof.
import { UPGRADE_IDS } from "./gameData.js";
import { simulate, followOrder, advance } from "./simulate.js";

export const LOOKAHEAD_DEPTH = 3;
export const BEAM_WIDTH = 30;
export const DEADLINE_MS = 2000;
export const EPS = 1e-9;

const nothing = () => null;

/** The result of buying `order` in sequence from `state`, each item as soon as the coins allow, and nothing else. */
export function evaluate(model, state, order) {
  return simulate(model, state, followOrder(order, null, state.levels));
}

/**
 * Positive when result `a` is better than `b`: longer final length, then fewer purchases (a purchase that adds no
 * length is never worth recommending, even when it leaves more coins), then more coins left, then a cheaper first
 * purchase, then the first purchase earlier in UPGRADE_IDS (no purchase: cost 0, index −1).
 */
export function compareResults(a, b) {
  const length = a.finalLength - b.finalLength;
  if (Math.abs(length) > EPS) return length;
  if (a.purchases.length !== b.purchases.length) return b.purchases.length - a.purchases.length;
  const coins = a.coinsLeft - b.coinsLeft;
  if (Math.abs(coins) > EPS) return coins;
  const fa = a.purchases[0];
  const fb = b.purchases[0];
  const costA = fa ? fa.cost : 0;
  const costB = fb ? fb.cost : 0;
  if (costA !== costB) return costB - costA;
  return (fb ? UPGRADE_IDS.indexOf(fb.upgradeId) : -1) - (fa ? UPGRADE_IDS.indexOf(fa.upgradeId) : -1);
}

/** Expected length caught per hour at these levels, in the steady state. */
function lengthPerHour(model, levels) {
  const lures = Math.min(model.prestigeLuresPerStep(levels) / model.interval, model.dailyCap(levels) / 24) + model.tackleboxLuresPerStep(levels) / model.interval;
  return (lures / model.rules.luresPerCatch) * model.catchSize(levels);
}

/** The simple policy: buy the affordable next level with the best gain in length per hour per coin; never one that adds nothing. */
export function rolloutPolicy(model) {
  return (view) => {
    const levels = view.levels;
    const base = lengthPerHour(model, levels);
    let best = null;
    let bestScore = 0;
    let bestCost = Infinity;
    for (const id of model.ids) {
      const cost = model.cost(id, levels[id]);
      if (cost === null || cost > view.coins) continue;
      // Raise the level in place and put it back: this runs millions of times, a copy per try costs most of the search.
      levels[id] += 1;
      const gain = lengthPerHour(model, levels) - base;
      levels[id] -= 1;
      if (gain <= EPS) continue;
      const score = cost === 0 ? Infinity : gain / cost;
      if (score > bestScore || (score === bestScore && cost < bestCost)) {
        best = id;
        bestScore = score;
        bestCost = cost;
      }
    }
    return best;
  };
}

/** Every sequence of 1 to `depth` next purchases from these levels (each item: the next level of an upgrade not at its maximum). */
function sequences(model, levels, depth) {
  const out = [];
  const walk = (prefix, lv) => {
    if (prefix.length) out.push(prefix);
    if (prefix.length === depth) return;
    for (const id of model.ids) {
      if (model.cost(id, lv[id]) === null) continue;
      walk([...prefix, id], { ...lv, [id]: lv[id] + 1 });
    }
  };
  walk([], levels);
  return out;
}

/** Method 1: at each decision, simulate every sequence of up to `depth` purchases followed by the simple policy; keep the best first purchase. */
export function lookaheadOrder(model, state, { depth = LOOKAHEAD_DEPTH, deadline = Infinity, now = Date.now } = {}) {
  const rollout = rolloutPolicy(model);
  const order = [];
  let snap = advance(model, state, []);
  while (snap && now() <= deadline) {
    const from = snap.state;
    const stop = simulate(model, from, nothing);
    let bestId = null;
    let bestResult = null;
    for (const seq of sequences(model, from.levels, depth)) {
      const result = simulate(model, from, followOrder(seq, rollout, from.levels));
      if (result.purchases.length === 0 || result.purchases[0].upgradeId !== seq[0]) continue; // first item never bought
      if (!bestResult || compareResults(result, bestResult) > 0) {
        bestResult = result;
        bestId = seq[0];
      }
    }
    if (!bestResult || bestResult.finalLength <= stop.finalLength + EPS) break;
    order.push(bestId);
    snap = advance(model, from, [bestId]);
  }
  return order;
}

const levelKey = (model, levels) => model.ids.map((id) => levels[id]).join(",");

/** Method 2: keep the `width` best partial orders at each step (judged by the simple policy after them), extend each by every purchase. */
export function beamOrder(model, state, { width = BEAM_WIDTH, deadline = Infinity, now = Date.now } = {}) {
  const rollout = rolloutPolicy(model);
  let best = { order: [], result: evaluate(model, state, []) };
  let frontier = [{ order: [], state: advance(model, state, []).state, purchases: [] }];
  while (frontier.length && now() <= deadline) {
    const children = [];
    for (const node of frontier) {
      for (const id of model.ids) {
        if (model.cost(id, node.state.levels[id]) === null) continue;
        const next = advance(model, node.state, [id]);
        if (!next) continue;
        const order = [...node.order, id];
        const purchases = [...node.purchases, ...next.purchases];
        const scored = simulate(model, next.state, rollout);
        const plain = simulate(model, next.state, nothing);
        const result = { finalLength: plain.finalLength, coinsLeft: plain.coinsLeft, purchases };
        if (compareResults(result, best.result) > 0) best = { order, result };
        children.push({ order, state: next.state, purchases, score: { finalLength: scored.finalLength, coinsLeft: scored.coinsLeft, purchases } });
      }
      if (now() > deadline) break;
    }
    children.sort((a, b) => compareResults(b.score, a.score));
    const seen = new Set();
    frontier = [];
    for (const child of children) {
      const key = levelKey(model, child.state.levels);
      if (seen.has(key)) continue;
      seen.add(key);
      frontier.push(child);
      if (frontier.length === width) break;
    }
  }
  return best.order;
}

/** True when no item of `order` goes beyond its upgrade's maximum level. */
function withinMax(model, levels, order) {
  const lv = { ...levels };
  for (const id of order) {
    if (model.cost(id, lv[id]) === null) return false;
    lv[id] += 1;
  }
  return true;
}

/** Method 3: remove, insert or move one purchase while it improves the result; restart after each improvement. */
export function improveOrder(model, state, order, { deadline = Infinity, now = Date.now } = {}) {
  let current = [...order];
  let currentResult = evaluate(model, state, current);
  for (;;) {
    // Snapshot after each prefix of the current order (null once a prefix cannot be bought before the end).
    const snaps = [{ state: advance(model, state, []).state, purchases: [] }];
    for (let i = 0; i < current.length; i++) {
      const prev = snaps[i];
      const next = prev && advance(model, prev.state, [current[i]]);
      snaps.push(next ? { state: next.state, purchases: [...prev.purchases, ...next.purchases] } : null);
    }
    const judge = (candidate, firstChanged) => {
      const base = snaps[firstChanged];
      if (!base) return evaluate(model, state, candidate);
      const rest = simulate(model, base.state, followOrder(candidate.slice(firstChanged), null, base.state.levels));
      return { finalLength: rest.finalLength, coinsLeft: rest.coinsLeft, purchases: [...base.purchases, ...rest.purchases] };
    };
    const moves = function* () {
      for (let i = 0; i < current.length; i++) yield [current.filter((_, k) => k !== i), i];
      for (let j = 0; j <= current.length; j++) {
        for (const id of model.ids) yield [[...current.slice(0, j), id, ...current.slice(j)], j];
      }
      for (let i = 0; i < current.length; i++) {
        for (let j = 0; j < current.length; j++) {
          if (i === j) continue;
          const moved = [...current];
          const [item] = moved.splice(i, 1);
          moved.splice(j, 0, item);
          yield [moved, Math.min(i, j)];
        }
      }
    };
    let improved = false;
    for (const [candidate, firstChanged] of moves()) {
      if (now() > deadline) return current;
      if (!withinMax(model, state.levels, candidate)) continue;
      const result = judge(candidate, firstChanged);
      if (compareResults(result, currentResult) > 0) {
        current = candidate;
        currentResult = result;
        improved = true;
        break;
      }
    }
    if (!improved) return current;
  }
}

/** What the page needs to compare the next purchase with its alternative (length, then what breaks a tie). */
function summary(upgradeId, result) {
  return {
    upgradeId,
    finalLength: result.finalLength,
    coinsLeft: result.coinsLeft,
    purchaseCount: result.purchases.length,
    firstCost: result.purchases.length ? result.purchases[0].cost : 0
  };
}

/** Describes the plan an order gives: the purchases actually made, the final result, and the next purchase with its best alternative. */
export function describePlan(model, state, order) {
  const result = evaluate(model, state, order);
  const made = result.purchases.map((p) => p.upgradeId);
  const first = result.purchases[0];
  let next = null;
  if (first) {
    let alternative = null;
    for (const id of model.ids) {
      if (id === first.upgradeId || model.cost(id, state.levels[id]) === null) continue;
      const k = made.indexOf(id);
      const other = evaluate(model, state, [id, ...made.filter((_, j) => j !== k)]);
      if (other.purchases.length === 0 || other.purchases[0].upgradeId !== id) continue;
      if (!alternative || compareResults(other, alternative.result) > 0) alternative = { upgradeId: id, result: other };
    }
    next = {
      ...first,
      affordable: first.cost <= state.coins,
      missingCoins: Math.max(0, first.cost - state.coins),
      alternative: summary(alternative ? alternative.upgradeId : null, alternative ? alternative.result : evaluate(model, state, []))
    };
  }
  return { order: made, purchases: result.purchases, finalLength: result.finalLength, coinsLeft: result.coinsLeft, next };
}

/**
 * Runs the methods in turn and keeps the best order found. The first plan (lookahead of one purchase) always completes
 * and is published; then the beam, the improvement of the best so far, and the lookahead stop at the deadline
 * (measured on the real data: in this order the beam, the fastest good method, always gets its time).
 * Each order a method returns is also tried completed by the simple policy, so a method cut short still counts.
 * onProgress receives a plan each time the final length improves.
 */
export function findBestPlan(model, state, { deadline = Infinity, now = Date.now, onProgress = () => {} } = {}) {
  const rollout = rolloutPolicy(model);
  let best = null;
  const tryOrder = (order) => {
    const result = evaluate(model, state, order);
    if (best && compareResults(result, best.result) <= 0) return;
    const lengthImproved = !best || result.finalLength > best.result.finalLength + EPS;
    best = { order: result.purchases.map((p) => p.upgradeId), result };
    if (lengthImproved) onProgress(describePlan(model, state, best.order));
  };
  const consider = (order) => {
    tryOrder(order);
    tryOrder(simulate(model, state, followOrder(order, rollout, state.levels)).purchases.map((p) => p.upgradeId));
  };
  consider(lookaheadOrder(model, state, { depth: 1 }));
  if (now() <= deadline) consider(beamOrder(model, state, { width: BEAM_WIDTH, deadline, now }));
  if (now() <= deadline) consider(improveOrder(model, state, best.order, { deadline, now }));
  if (now() <= deadline) consider(lookaheadOrder(model, state, { depth: LOOKAHEAD_DEPTH, deadline, now }));
  return describePlan(model, state, best.order);
}
