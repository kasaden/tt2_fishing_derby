// One plan request, as the worker runs it: check the input, build the model, search, and post the plans as they improve.
import { withShownValues } from "./rules.js";
import { createModel } from "./model.js";
import { initialState } from "./simulate.js";
import { findBestPlan, DEADLINE_MS } from "./search.js";
import { missingFields } from "./input.js";

/**
 * Posts { type: "missing", fields } when the input is incomplete; otherwise { type: "progress", plan } for each
 * improvement and { type: "done", plan } at the end. Any error posts { type: "error", message }.
 */
export function runPlanRequest({ game, rules, input }, { post, now }) {
  try {
    const fields = missingFields(input, rules);
    if (fields.length) {
      post({ type: "missing", fields });
      return;
    }
    const effective = withShownValues(rules, game, input.levels, input.shown);
    const model = createModel(game, effective, { prestigesPerDay: input.prestigesPerDay, visitsPerDay: input.visitsPerDay });
    const state = initialState(model, {
      levels: input.levels,
      coins: input.coins,
      lures: input.lures,
      hoursLeft: input.hoursLeft,
      lengthSoFar: input.lengthSoFar
    });
    const plan = findBestPlan(model, state, {
      deadline: now() + DEADLINE_MS,
      now,
      onProgress: (progress) => post({ type: "progress", plan: progress })
    });
    post({ type: "done", plan });
  } catch (error) {
    post({ type: "error", message: error.message });
  }
}
