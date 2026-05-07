import { useEffect, useState } from "react";
import type { RuleHit, RuleScope } from "@/api/types";
import { getLiveHits, subscribe } from "@/lib/rules/store";

export function useRuleHits(scope: RuleScope, subjectId: string | undefined): RuleHit[] {
  const [hits, setHits] = useState<RuleHit[]>(() => (subjectId ? getLiveHits(scope, subjectId) : []));
  useEffect(() => {
    if (!subjectId) { setHits([]); return; }
    setHits(getLiveHits(scope, subjectId));
    const unsub = subscribe(() => setHits(getLiveHits(scope, subjectId)));
    return () => { unsub; };
  }, [scope, subjectId]);
  return hits;
}
