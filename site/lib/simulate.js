// Simulates the rest of the event visit by visit, in expected values (fractional catches, mean sizes, mean coins).
// A visit is: collect the lures earned since the last visit (not at visit 0), buy, fish, buy.

const PHASES = ["collect", "buyBefore", "fish", "buyAfter"];

/** The state at the start of visit 0 (now). input = { levels, coins, lures, hoursLeft, lengthSoFar }. */
export function initialState(model, input) {
  return {
    visit: 0,
    phase: "collect",
    lastVisit: Math.floor(input.hoursLeft / model.interval + 1e-9),
    levels: { ...input.levels },
    coins: input.coins,
    lures: input.lures,
    length: input.lengthSoFar,
    caughtToday: 0,
    day: 0
  };
}

/** For each item of `order`, the [id, level] it reaches, counting from `base`. */
function targetsFrom(order, base) {
  const next = { ...base };
  return order.map((id) => [id, ++next[id]]);
}

/**
 * A policy that buys the items of `order` in sequence (each item is the next level of that id), waiting while
 * the next one is unaffordable, then hands over to `then`. The items count from `base`, or, when `base` is not
 * given, from the levels of the first view the policy sees; build one policy per starting state.
 */
export function followOrder(order, then = null, base = null) {
  let targets = base ? targetsFrom(order, base) : null;
  let reached = 0; // targets are reached in order, so the scan resumes where it stopped
  return (view) => {
    if (!targets) targets = targetsFrom(order, view.levels);
    // A view below an already reached target means a new run from an earlier state: scan from the start again.
    if (reached > 0 && view.levels[targets[reached - 1][0]] < targets[reached - 1][1]) reached = 0;
    while (reached < targets.length && view.levels[targets[reached][0]] >= targets[reached][1]) reached += 1;
    if (reached < targets.length) return targets[reached][0];
    return then ? then(view) : null;
  };
}

/** Runs from `start` until the event ends, or until `stopAfter` purchases have been made (then stopped is true). */
function run(model, start, policy, stopAfter = Infinity) {
  const s = { ...start, levels: { ...start.levels } };
  const purchases = [];
  const { luresPerCatch } = model.rules;

  // Returns true when the run must stop right here, after its last allowed purchase.
  const buy = () => {
    const hour = s.visit * model.interval;
    for (;;) {
      if (purchases.length >= stopAfter) return true;
      const id = policy({ levels: s.levels, coins: s.coins, hour });
      if (!id) return false;
      const cost = model.cost(id, s.levels[id]);
      if (cost === null || cost > s.coins) return false;
      s.coins -= cost;
      purchases.push({ upgradeId: id, fromLevel: s.levels[id], toLevel: s.levels[id] + 1, cost, hour, lengthAtPurchase: s.length });
      s.levels = { ...s.levels, [id]: s.levels[id] + 1 };
    }
  };

  const fish = () => {
    const day = Math.floor((s.visit * model.interval) / 24 + 1e-9);
    if (day !== s.day) {
      s.day = day;
      s.caughtToday = 0;
    }
    const allowed = Math.max(0, model.dailyCap(s.levels) - s.caughtToday);
    const catches = Math.min(s.lures / luresPerCatch, allowed);
    if (catches <= 0) return;
    s.lures -= catches * luresPerCatch;
    s.caughtToday += catches;
    s.length += catches * model.catchSize(s.levels);
    s.coins += catches * model.catchCoins(s.levels);
  };

  while (s.visit <= s.lastVisit) {
    if (s.phase === "collect") {
      if (s.visit > 0) s.lures += model.luresPerVisit(s.levels);
      s.phase = "buyBefore";
    }
    if (s.phase === "buyBefore") {
      if (buy()) return { stopped: true, state: s, purchases };
      s.phase = "fish";
    }
    if (s.phase === "fish") {
      fish();
      s.phase = "buyAfter";
    }
    if (s.phase === "buyAfter") {
      if (buy()) return { stopped: true, state: s, purchases };
      s.phase = "collect";
      s.visit += 1;
    }
    if (!PHASES.includes(s.phase)) throw new Error(`unknown phase ${s.phase}`);
  }
  return { stopped: false, state: s, purchases };
}

/** Simulates from `state` to the end of the event with `policy`. */
export function simulate(model, state, policy) {
  const { state: end, purchases } = run(model, state, policy);
  return { finalLength: end.length, coinsLeft: end.coins, luresLeft: end.lures, purchases };
}

/**
 * Follows `order` from `state` until all of it is bought, and returns the state right after the last purchase
 * (same buy point: resuming continues there), with the purchases made. Null when the event ends first or an item is at its maximum.
 */
export function advance(model, state, order) {
  if (order.length === 0) return { state: { ...state, levels: { ...state.levels } }, purchases: [] };
  const result = run(model, state, followOrder(order, null, state.levels), order.length);
  return result.stopped ? { state: result.state, purchases: result.purchases } : null;
}
