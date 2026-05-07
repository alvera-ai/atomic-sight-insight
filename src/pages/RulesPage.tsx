import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Rule, RuleStatus } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/status-pill";
import { listRules, getAllLiveHits, subscribe } from "@/api/rules";
import { RuleEditorDrawer } from "@/components/rules/rule-editor-drawer";

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [tab, setTab] = useState<RuleStatus>("live");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  const refresh = () => listRules().then(setRules);
  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, []);

  const counts = useMemo(() => ({
    live: rules.filter((r) => r.status === "live").length,
    sandbox: rules.filter((r) => r.status === "sandbox").length,
    archived: rules.filter((r) => r.status === "archived").length,
  }), [rules]);

  const hitsByRule = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of getAllLiveHits()) m.set(h.rule_id, (m.get(h.rule_id) ?? 0) + 1);
    return m;
  }, [rules]);

  const filtered = rules
    .filter((r) => r.status === tab)
    .filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.tags.some((t) => t.includes(search.toLowerCase())));

  const openEdit = (r: Rule) => { setCreating(false); setEditing(r); setOpen(true); };
  const openNew = () => { setCreating(true); setEditing(null); setOpen(true); };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="flex items-start gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Rules</h1>
            <p className="text-xs text-muted-foreground">
              Every transaction and account holder is evaluated. Sandbox rules don't affect production.
            </p>
          </div>
          <Button onClick={openNew} size="sm" className="ml-auto gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New rule
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as RuleStatus)}>
            <TabsList>
              <TabsTrigger value="live">Live · {counts.live}</TabsTrigger>
              <TabsTrigger value="sandbox">Sandbox · {counts.sandbox}</TabsTrigger>
              <TabsTrigger value="archived">Archived · {counts.archived}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input placeholder="Search rules…" value={search} onChange={(e) => setSearch(e.target.value)} className="ml-auto h-8 max-w-xs" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card className="p-0">
          <div className="grid grid-cols-[1.6fr_120px_110px_100px_90px_140px] border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <div>Name</div>
            <div>Scope</div>
            <div>Severity</div>
            <div>Action</div>
            <div>Hits</div>
            <div>Updated</div>
          </div>
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => openEdit(r)}
              className="grid w-full grid-cols-[1.6fr_120px_110px_100px_90px_140px] items-center border-b px-3 py-2.5 text-left text-xs transition last:border-b-0 hover:bg-muted/30"
            >
              <div>
                <div className="font-medium">{r.name}</div>
                {r.description && <div className="truncate text-[11px] text-muted-foreground">{r.description}</div>}
                {r.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.tags.map((t) => <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>)}
                  </div>
                )}
              </div>
              <div className="capitalize">{r.scope.replace(/_/g, " ")}</div>
              <div><StatusPill value={r.severity} /></div>
              <div><StatusPill value={r.action} /></div>
              <div className="font-mono">{r.status === "live" ? (hitsByRule.get(r.id) ?? 0) : "—"}</div>
              <div className="text-muted-foreground">{new Date(r.updated_at).toLocaleDateString()}</div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">No rules in this state.</div>
          )}
        </Card>
      </div>

      <RuleEditorDrawer
        rule={editing}
        isNew={creating}
        open={open}
        onOpenChange={setOpen}
        onChanged={refresh}
      />
    </div>
  );
}
