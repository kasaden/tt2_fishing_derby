// The page: loads the data, keeps the player's input, asks the worker for a plan and shows it.
import { UPGRADE_IDS } from "./lib/gameData.js";
import { levelRange, missingBases } from "./lib/rules.js";
import { tiersReached } from "./lib/model.js";
import { loadData } from "./lib/load.js";
import { loadInput, writeInput, missingFields } from "./lib/input.js";
import { formatLength, formatPurchaseTime, upgradeLabel, whyLine, formatReward, formatCoins } from "./lib/format.js";

const $ = (id) => document.getElementById(id);
const RECALC_DELAY_MS = 150;
const MAX_HOURS_LEFT = 30 * 24; // input sanity bounds, not game values: they keep a typo from freezing the search
const ZERO_WHEN_EMPTY = new Set(["coins", "lures", "lengthSoFar"]);
const PLAN_ROWS_SHOWN = 10;

const FIELD_LABELS = {
  hoursLeft: ["Time left in the event", "daysLeft"],
  prestigesPerDay: ["Prestiges per day", "prestigesPerDay"],
  visitsPerDay: ["Visits per day (more than 0)", "visitsPerDay"],
  "shown.dailyCap": ["Daily lure limit shown in game", "shownDailyCap"],
  "shown.tackleboxCapacity": ["Tacklebox capacity shown in game", "shownTackleboxCapacity"]
};

// Storage can be missing or refuse access (private mode, blocked site data): the page works without it.
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
})();

let game = null;
let rules = null;
let input = null;
let worker = null;
let running = false;
let requestId = 0;
let recalcTimer = 0;
let planExpanded = false;

const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const ICON_MINUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/* ---------- reading the form ---------- */

// empty, unreadable or negative: no value (a negative count means nothing in the game)
const numberOrNull = (el) => (el.value.trim() === "" || Number.isNaN(el.valueAsNumber) || el.valueAsNumber < 0 ? null : el.valueAsNumber);
const numberOrZero = (el) => Math.max(0, numberOrNull(el) ?? 0);

// a number within the field's max (when it has one)
const bounded = (el) => {
  const value = numberOrNull(el);
  return value === null || el.max === "" ? value : Math.min(value, Number(el.max));
};

function readTimeLeft() {
  const days = numberOrNull($("daysLeft"));
  const hours = numberOrNull($("hoursPart"));
  if (days === null && hours === null) return null;
  return Math.min(MAX_HOURS_LEFT, (days ?? 0) * 24 + (hours ?? 0));
}

// A value the game shows is kept with the level it was read at; only a new value takes the current level.
function reading(previous, el, upgradeId) {
  const value = numberOrNull(el);
  if (value === null) return null;
  if (previous && previous.value === value) return previous;
  return { value, level: input.levels[upgradeId] };
}

function readForm() {
  for (const id of UPGRADE_IDS) {
    const el = $(`level-${id}`);
    if (!el) continue;
    const { min, max } = levelRange(game, rules, id);
    const typed = numberOrNull(el);
    input.levels[id] = typed === null ? min : Math.min(max, Math.max(min, Math.floor(typed)));
  }
  input = {
    ...input,
    coins: numberOrZero($("coins")),
    lures: numberOrZero($("lures")),
    lengthSoFar: numberOrZero($("lengthSoFar")),
    hoursLeft: readTimeLeft(),
    prestigesPerDay: numberOrNull($("prestigesPerDay")),
    visitsPerDay: bounded($("visitsPerDay")),
    shown: {
      dailyCap: reading(input.shown.dailyCap, $("shownDailyCap"), "LuresPerDay"),
      tackleboxCapacity: reading(input.shown.tackleboxCapacity, $("shownTackleboxCapacity"), "TackleBoxSize")
    }
  };
  showReadingLevels();
}

function showReadingLevels() {
  const line = (entry, upgradeId) =>
    entry ? `Read at ${upgradeLabel(rules, upgradeId)} level ${entry.level}.` : `Read it at your current ${upgradeLabel(rules, upgradeId)} level (${input.levels[upgradeId]}).`;
  $("shownDailyCapAt").textContent = line(input.shown.dailyCap, "LuresPerDay");
  $("shownTackleboxAt").textContent = line(input.shown.tackleboxCapacity, "TackleBoxSize");
}

/* ---------- filling the form ---------- */

const setValue = (id, value) => {
  $(id).value = value === null || value === undefined ? "" : String(value);
};

function fillForm() {
  setValue("coins", input.coins);
  setValue("lures", input.lures);
  setValue("lengthSoFar", input.lengthSoFar);
  if (input.hoursLeft === null) {
    setValue("daysLeft", null);
    setValue("hoursPart", null);
  } else {
    setValue("daysLeft", Math.floor(input.hoursLeft / 24));
    setValue("hoursPart", Math.round((input.hoursLeft % 24) * 100) / 100);
  }
  setValue("prestigesPerDay", input.prestigesPerDay);
  setValue("visitsPerDay", input.visitsPerDay);
  setValue("shownDailyCap", input.shown.dailyCap?.value);
  setValue("shownTackleboxCapacity", input.shown.tackleboxCapacity?.value);
  showReadingLevels();
}

function buildLevels() {
  const box = $("levels");
  box.replaceChildren();
  for (const id of UPGRADE_IDS) {
    if (rules.hidden.includes(id)) continue;
    const { min, max } = levelRange(game, rules, id);
    const label = escapeHtml(upgradeLabel(rules, id));
    const row = document.createElement("div");
    row.className = "level-row";
    row.innerHTML = `
      <label class="level-name" for="level-${id}">${label}<small>Level ${min} to ${max}</small></label>
      <div class="stepper">
        <button type="button" data-step="-1" aria-label="Lower ${label}">${ICON_MINUS}</button>
        <input id="level-${id}" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" autocomplete="off" />
        <button type="button" data-step="1" aria-label="Raise ${label}">${ICON_PLUS}</button>
      </div>`;
    const field = row.querySelector("input");
    field.value = String(input.levels[id]);
    const [down, up] = row.querySelectorAll("button");
    const sync = () => {
      down.disabled = input.levels[id] <= min;
      up.disabled = input.levels[id] >= max;
    };
    row.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-step]");
      if (!button || button.disabled) return;
      input.levels[id] = Math.min(max, Math.max(min, input.levels[id] + Number(button.dataset.step)));
      field.value = String(input.levels[id]);
      sync();
      // a button that just reached its limit is disabled: keep the keyboard focus in the row
      if (button.disabled) field.focus();
      changed();
    });
    // clamp what was typed once the player leaves the field
    field.addEventListener("change", () => {
      readForm();
      field.value = String(input.levels[id]);
      sync();
    });
    field.addEventListener("input", () => {
      readForm();
      sync();
      changed();
    });
    sync();
    box.append(row);
  }
}

/* ---------- showing the result ---------- */

function show(id, visible) {
  $(id).hidden = !visible;
}

function setProgress(text, working) {
  const el = $("progress");
  el.textContent = text;
  if (working) el.dataset.state = "working";
  else delete el.dataset.state;
}

// A short result (a message, no plan) stays in view on wide screens while the player fills the form.
function setCompact(compact) {
  if (compact) $("result").dataset.compact = "";
  else delete $("result").dataset.compact;
}

function clearResult() {
  show("missing", false);
  show("ended", false);
  show("planError", false);
  setCompact(true);
}

function showMissing(fields) {
  clearResult();
  show("planView", false);
  setProgress("", false);
  const list = $("missingList");
  list.replaceChildren(
    ...fields.map((field) => {
      const [label, target] = FIELD_LABELS[field];
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#${target}`;
      a.textContent = label;
      a.addEventListener("click", (event) => {
        event.preventDefault();
        $(target).focus();
      });
      li.append(a);
      return li;
    })
  );
  show("missing", true);
}

function renderPlan(plan) {
  clearResult();
  setCompact(false);
  const unit = rules.sizeUnit;
  const now = Date.now();
  show("planView", true);

  const next = plan.next;
  show("nextCard", Boolean(next));
  show("nothing", !next);
  if (next) {
    const card = $("nextCard");
    $("nextName").textContent = upgradeLabel(rules, next.upgradeId);
    $("nextLevels").textContent = `Level ${next.fromLevel} → ${next.toLevel}`;
    $("nextCost").textContent = formatCoins(next.cost);
    const verdict = $("nextVerdict");
    if (next.affordable) {
      verdict.textContent = "Buy now";
      verdict.dataset.verdict = "buy";
      $("nextWhen").textContent = "";
    } else {
      const [count, noun] = formatCoins(next.missingCoins).split(" ");
      verdict.textContent = `Save up: ${count} more ${noun}`;
      verdict.dataset.verdict = "save";
      $("nextWhen").textContent =
        next.hour === 0
          ? "Fish the lures you have now first: they bring the coins it needs."
          : `At your pace you will have them around ${formatPurchaseTime(now, next.hour)}.`;
    }
    $("nextWhy").textContent = whyLine({ ...next, finalLength: plan.finalLength, coinsLeft: plan.coinsLeft, purchaseCount: plan.purchases.length }, rules, unit);
    card.classList.remove("is-updated");
    void card.offsetWidth; // restart the settle animation
    card.classList.add("is-updated");
  }

  $("finalLength").textContent = formatLength(plan.finalLength, unit);
  const { reached, next: nextTier } = tiersReached(game.soloTiers, plan.finalLength);
  const tiers = $("tiers");
  tiers.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = `${reached.length} of ${game.soloTiers.length}`;
  tiers.append("Solo reward tiers reached by the end: ", strong, ".");
  if (nextTier) {
    tiers.append(` Next tier at ${formatLength(nextTier.sizeRequired, unit)}: ${formatReward(nextTier.reward)}.`);
  }

  const rows = plan.purchases.map((p, i) => {
    const tr = document.createElement("tr");
    if (i === 0) tr.className = "is-next";
    const name = document.createElement("td");
    name.textContent = upgradeLabel(rules, p.upgradeId);
    const step = document.createElement("span");
    step.className = "step";
    step.textContent = `${p.fromLevel} → ${p.toLevel}`;
    name.append(step);
    const cost = document.createElement("td");
    cost.className = "num";
    cost.textContent = p.cost.toLocaleString("en-US");
    const when = document.createElement("td");
    when.textContent = formatPurchaseTime(now, p.hour);
    const length = document.createElement("td");
    length.className = "num";
    length.textContent = formatLength(p.lengthAtPurchase, unit);
    tr.append(name, cost, when, length);
    return tr;
  });
  $("planRows").replaceChildren(...rows);
  show("planTable", rows.length > 0);
  showPlanRows();
}

// The player acts on the next purchase: the first rows stay in view, the rest of the plan on request.
function showPlanRows() {
  const rows = [...$("planRows").children];
  rows.forEach((row, i) => {
    row.hidden = !planExpanded && i >= PLAN_ROWS_SHOWN;
  });
  const toggle = $("planToggle");
  show("planToggle", rows.length > PLAN_ROWS_SHOWN);
  toggle.setAttribute("aria-expanded", String(planExpanded));
  toggle.textContent = planExpanded ? "Show the first purchases only" : `Show the whole plan (${rows.length} purchases)`;
}

function showPlanError(message) {
  clearResult();
  show("planView", false);
  setProgress("", false);
  $("planErrorText").textContent = message;
  show("planError", true);
}

/* ---------- asking for a plan ---------- */

function onWorkerMessage(event) {
  const message = event.data;
  if (message.id !== requestId) return;
  if (message.type === "missing") {
    running = false;
    showMissing(message.fields);
  } else if (message.type === "progress") {
    renderPlan(message.plan);
    setProgress("Improving the plan…", true);
  } else if (message.type === "done") {
    running = false;
    renderPlan(message.plan);
    setProgress("Best plan found.", false);
  } else if (message.type === "error") {
    running = false;
    showPlanError(message.message);
  }
}

function startWorker() {
  worker = new Worker("worker.js", { type: "module" });
  worker.onmessage = onWorkerMessage;
  worker.onerror = (event) => {
    running = false;
    worker = null; // a worker that failed to load is not reused: the next request starts a fresh one
    showPlanError(event.message || "The planning worker stopped.");
  };
}

function requestPlan() {
  const missing = missingFields(input, rules);
  if (missing.length) {
    showMissing(missing);
    return;
  }
  if (input.hoursLeft === 0) {
    clearResult();
    show("planView", false);
    setProgress("", false);
    show("ended", true);
    return;
  }
  // a search still running is for older numbers: stop it rather than wait
  if (running && worker) {
    worker.terminate();
    worker = null;
  }
  if (!worker) startWorker();
  requestId += 1;
  running = true;
  setProgress("Working out the plan…", true);
  worker.postMessage({ id: requestId, game, rules, input });
}

function changed() {
  showReadingLevels();
  writeInput(storage, input);
  clearTimeout(recalcTimer);
  recalcTimer = setTimeout(requestPlan, RECALC_DELAY_MS);
}

/* ---------- rules ---------- */

function renderRules() {
  $("rulesList").replaceChildren(
    ...rules.list.map((rule) => {
      const li = document.createElement("li");
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.dataset.status = rule.status;
      tag.textContent = rule.status === "verified" ? "Verified" : "Assumed";
      const text = document.createElement("p");
      text.textContent = rule.text;
      li.append(tag, text);
      if (rule.source) {
        const source = document.createElement("p");
        source.className = "rule-source";
        source.textContent = `Source: ${rule.source}`;
        li.append(source);
      }
      return li;
    })
  );
}

/* ---------- start ---------- */

async function start() {
  try {
    ({ game, rules } = await loadData(fetch.bind(window)));
  } catch (error) {
    $("loadErrorText").textContent = error.message;
    show("loading", false);
    show("loadError", true);
    return;
  }
  input = loadInput(storage, game, rules);

  const needed = missingBases(rules);
  show("shownGroup", needed.length > 0);
  show("shownDailyCapField", needed.includes("dailyCapBase"));
  show("shownTackleboxField", needed.includes("tackleboxBaseCapacity"));

  buildLevels();
  fillForm();
  renderRules();

  $("inputs").addEventListener("input", (event) => {
    if (event.target.id.startsWith("level-")) return; // handled by its row
    readForm();
    changed();
  });
  // once the player leaves a field, show the value the tool uses: no negative counts, nothing over the field's max
  $("inputs").addEventListener("change", (event) => {
    const el = event.target;
    if (!(el instanceof HTMLInputElement) || el.type !== "number" || el.id.startsWith("level-")) return;
    if (el.value.trim() === "" || Number.isNaN(el.valueAsNumber)) return;
    if (el.valueAsNumber < 0) el.value = ZERO_WHEN_EMPTY.has(el.id) ? "0" : "";
    else if (el.max !== "" && el.valueAsNumber > Number(el.max)) el.value = el.max;
    else return;
    readForm();
    changed();
  });
  $("inputs").addEventListener("submit", (event) => event.preventDefault());

  show("loading", false);
  show("app", true);
  show("rulesSection", true);
  requestPlan();
}

$("reload").addEventListener("click", () => window.location.reload());
$("planToggle").addEventListener("click", () => {
  planExpanded = !planExpanded;
  showPlanRows();
});
start();
