// Simulates the rest of the event visit by visit, in expected values (fractional catches, mean sizes, mean coins).
// A visit is: collect the lures earned since the last visit (not at visit 0), buy, fish, buy.

const PHASES = ["collect", "buyBefore", "fish", "buyAfter"];

/**
 * The state at the start of visit 0 (now). input = { levels, coins, lures, hoursLeft, lengthSoFar, hoursToReset?, prestigeLuresToday? }:
 * hoursToReset, the hours to the next daily reset (24 when not given); prestigeLuresToday, the prestige lures already received today.
 */
export function initialState(model, input) {
  return {
    visit: 0,
    phase: "collect",
    lastVisit: Math.floor(input.hoursLeft / model.interval + 1e-9),
    levels: { ...input.levels },
    coins: input.coins,
    lures: input.lures,
    length: input.lengthSoFar,
    hoursToReset: input.hoursToReset ?? 24,
    prestigeToday: input.prestigeLuresToday ?? 0,
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
 * given, from the levels of the first view the policy sees. The policy can serve several runs.
 */
export function followOrder(order, then = null, base = null) {
  let targets = base ? targetsFrom(order, base) : null;
  let reached = 0; // within one run levels only grow, so the scan resumes where it stopped
  let lastRun = null;
  return (view) => {
    if (!targets) targets = targetsFrom(order, view.levels);
    // a new run (or a view built outside a run) starts the scan again
    if (view.run === undefined || view.run !== lastRun) {
      reached = 0;
      lastRun = view.run;
    }
    while (reached < targets.length && view.levels[targets[reached][0]] >= targets[reached][1]) reached += 1;
    if (reached < targets.length) return targets[reached][0];
    return then ? then(view) : null;
  };
}

/** Runs from `start` until the event ends, or until `stopAfter` purchases have been made (then stopped is true). */
function run(model, start, policy, stopAfter = Infinity) {
  const s = { ...start, levels: { ...start.levels } };
  const purchases = [];
  const runToken = {}; // tells a policy that serves several runs which run it is in
  const { luresPerCatch } = model.rules;

  // Returns true when the run must stop right here, after its last allowed purchase.
  const buy = () => {
    const hour = s.visit * model.interval;
    for (;;) {
      if (purchases.length >= stopAfter) return true;
      const id = policy({ levels: s.levels, coins: s.coins, hour, run: runToken });
      if (!id) return false;
      const cost = model.cost(id, s.levels[id]);
      if (cost === null || cost > s.coins) return false;
      s.coins -= cost;
      purchases.push({ upgradeId: id, fromLevel: s.levels[id], toLevel: s.levels[id] + 1, cost, hour, lengthAtPurchase: s.length });
      s.levels = { ...s.levels, [id]: s.levels[id] + 1 };
    }
  };

  // Lures received since the last visit: prestige lures up to what is left of the daily limit, and the Tacklebox's.
  const collect = () => {
    const hour = s.visit * model.interval;
    const day = hour < s.hoursToReset - 1e-9 ? 0 : 1 + Math.floor((hour - s.hoursToReset) / 24 + 1e-9);
    if (day !== s.day) {
      s.day = day;
      s.prestigeToday = 0;
    }
    const prestige = Math.min(model.prestigeLuresPerStep(s.levels), Math.max(0, model.dailyCap(s.levels) - s.prestigeToday));
    s.prestigeToday += prestige;
    s.lures += prestige + model.tackleboxLuresPerStep(s.levels);
  };

  const fish = () => {
    const catches = s.lures / luresPerCatch;
    if (catches <= 0) return;
    s.lures -= catches * luresPerCatch;
    s.length += catches * model.catchSize(s.levels);
    s.coins += catches * model.catchCoins(s.levels);
  };

  while (s.visit <= s.lastVisit) {
    if (s.phase === "collect") {
      if (s.visit > 0) collect();
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
