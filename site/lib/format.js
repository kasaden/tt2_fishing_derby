// Display strings for the page. No DOM: tested in Node.

/** A length rounded to a whole number with thousands separators, with its unit when the rules know it. */
export function formatLength(value, unit) {
  const text = Math.round(value).toLocaleString("en-US");
  return unit ? `${text} ${unit}` : text;
}

/** When a purchase falls, as a weekday and an hour of the player's clock: "Thu 14:00", or "now". */
export function formatPurchaseTime(nowMs, hour, locale = "en-GB", timeZone = undefined) {
  if (hour === 0) return "now";
  return new Intl.DateTimeFormat(locale, { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone })
    .format(new Date(nowMs + hour * 3600000))
    .replace(",", "");
}

/** The upgrade's in-game name, or its data id flagged as unverified when the game name is unknown. */
export function upgradeLabel(rules, id) {
  return rules.names[id] ?? `${id} (name not verified)`;
}

/** Why the next purchase: its estimated final length against the best plan that starts otherwise. */
export function whyLine(next, rules, unit) {
  const mine = `Estimated final length with this purchase: ${formatLength(next.finalLength, unit)}.`;
  const { upgradeId, finalLength } = next.alternative;
  return upgradeId
    ? `${mine} Best other first purchase, ${upgradeLabel(rules, upgradeId)}: ${formatLength(finalLength, unit)}.`
    : `${mine} Buying nothing: ${formatLength(finalLength, unit)}.`;
}

/** A whole number of coins, rounded up (a fraction still has to be earned), in the singular or the plural. */
export function formatCoins(amount) {
  const whole = Math.ceil(amount);
  return `${whole.toLocaleString("en-US")} ${whole === 1 ? "coin" : "coins"}`;
}

/** A reward string from the game data ("SkillPoint:5") as "Skill Point × 5". */
export function formatReward(reward) {
  const [name, quantity] = reward.split(":");
  const spaced = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  return quantity === undefined ? spaced : `${spaced} × ${quantity}`;
}
