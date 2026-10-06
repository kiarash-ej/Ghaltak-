import { RULES } from "./rules";
import type { Insight, InsightFacts } from "./types";

export type { Insight, InsightFacts, InsightTone } from "./types";

// Which advice comes first (spec §6.5): missing costs is pinned on top when it
// fires, because every profit figure depends on it; then the ones worth the
// most tomans (where that can be said); then warnings before tips before good
// news; then the rule's number.

const TONE_ORDER = { warn: 0, tip: 1, good: 2 } as const;
const PINNED = "missing-costs";

export function rankInsights(insights: Insight[]): Insight[] {
  return [...insights].sort((a, b) => {
    const pinned = Number(b.id === PINNED) - Number(a.id === PINNED);
    if (pinned !== 0) return pinned;
    if (a.impactToman !== undefined || b.impactToman !== undefined) {
      if (a.impactToman === undefined) return 1;
      if (b.impactToman === undefined) return -1;
      if (a.impactToman !== b.impactToman) return b.impactToman - a.impactToman;
    }
    return TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || a.rule - b.rule;
  });
}

/** Every rule that has something to say about these facts, best first. */
export function advise(facts: InsightFacts): Insight[] {
  return rankInsights(RULES.map((rule) => rule(facts)).filter((i): i is Insight => i !== null));
}
