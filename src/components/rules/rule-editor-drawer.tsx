import { useEffect, useState } from "react";
import { Archive, Copy, Rocket, RotateCcw, Save, Trash2 } from "lucide-react";
import type { Rule, RuleAction, RuleScope, RuleSeverity } from "@/api/types";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/status-pill";
import { ConditionBuilder } from "@/components/rules/condition-builder";
import { SandboxRunner } from "@/components/rules/sandbox-runner";
import { newGroup } from "@/lib/rules/engine";
import { archiveRule, createRule, deleteRule, promoteRule, restoreRule, saveRule } from "@/api/rules";
import { toast } from "@/hooks/use-toast";

const emptyRule = (): Rule => ({
  id: crypto.randomUUID(),
  name: "New rule",
  description: "",
  scope: "transaction",
  status: "sandbox",
  severity: "medium",
  action: "flag",
  threshold: 0.5,
  when: newGroup("AND"),
  tags: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: "you@alvera.ai",
  version: 1,
});

interface Props {
  rule: Rule | null;
  isNew?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function RuleEditorDrawer({ rule, isNew, open, onOpenChange, onChanged }: Props) {
  const [draft, setDraft] = useState<Rule>(rule ?? emptyRule());
  const [showJson, setShowJson] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rule) setDraft(rule);
    else if (isNew) setDraft(emptyRule());
  }, [rule, isNew, open]);

  const update = (patch: Partial<Rule>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await createRule({ ...draft });
        toast({ title: "Rule created", description: `POST /rules · status: ${draft.status}` });
      } else {
        await saveRule(draft);
        toast({ title: "Rule saved", description: `PUT /rules/${draft.id.slice(0, 6)}` });
      }
      onChanged(); onOpenChange(false);
    } finally { setSaving(false); }
  };

  const promote = async () => { await promoteRule(draft.id); toast({ title: "Promoted to live" }); onChanged(); onOpenChange(false); };
  const archive = async () => { await archiveRule(draft.id); toast({ title: "Archived" }); onChanged(); onOpenChange(false); };
  const restore = async () => { await restoreRule(draft.id); toast({ title: "Restored to sandbox" }); onChanged(); onOpenChange(false); };
  const remove = async () => {
    if (!confirm("Delete this rule? This cannot be undone.")) return;
    await deleteRule(draft.id); toast({ title: "Deleted" }); onChanged(); onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[640px]">
        <SheetHeader className="space-y-2 border-b p-4">
          <div className="flex items-start gap-2">
            <Input
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              className="h-8 flex-1 text-base font-semibold"
            />
            <StatusPill value={draft.status} />
          </div>
          <SheetTitle className="sr-only">Edit rule</SheetTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            {!isNew && draft.status === "sandbox" && (
              <Button size="sm" onClick={promote} className="gap-1.5"><Rocket className="h-3.5 w-3.5" /> Promote to live</Button>
            )}
            {!isNew && draft.status === "live" && (
              <Button size="sm" variant="outline" onClick={archive} className="gap-1.5"><Archive className="h-3.5 w-3.5" /> Archive</Button>
            )}
            {!isNew && draft.status === "archived" && (
              <Button size="sm" variant="outline" onClick={restore} className="gap-1.5"><RotateCcw className="h-3.5 w-3.5" /> Restore to sandbox</Button>
            )}
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </Button>
            {!isNew && (
              <Button size="sm" variant="ghost" onClick={remove} className="ml-auto gap-1.5 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="definition" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-4 mt-3 grid w-auto grid-cols-3">
            <TabsTrigger value="definition">Definition</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <TabsContent value="definition" className="m-0 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px]">Scope</Label>
                  <Select value={draft.scope} onValueChange={(v) => update({ scope: v as RuleScope, when: newGroup("AND") })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transaction">Transaction</SelectItem>
                      <SelectItem value="account_holder">Account holder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end justify-end gap-2">
                  <Label className="text-[11px]">JSON view</Label>
                  <Switch checked={showJson} onCheckedChange={setShowJson} />
                </div>
              </div>

              {showJson ? (
                <div className="space-y-2">
                  <Textarea
                    readOnly
                    value={JSON.stringify(draft.when, null, 2)}
                    className="min-h-[280px] font-mono text-[11px]"
                  />
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigator.clipboard.writeText(JSON.stringify(draft.when, null, 2))}>
                    <Copy className="h-3.5 w-3.5" /> Copy JSON
                  </Button>
                </div>
              ) : (
                <ConditionBuilder
                  scope={draft.scope}
                  group={draft.when}
                  onChange={(g) => update({ when: g })}
                />
              )}
            </TabsContent>

            <TabsContent value="settings" className="m-0 space-y-3">
              <div>
                <Label className="text-[11px]">Description</Label>
                <Textarea value={draft.description} onChange={(e) => update({ description: e.target.value })} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px]">Severity</Label>
                  <Select value={draft.severity} onValueChange={(v) => update({ severity: v as RuleSeverity })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["low", "medium", "high", "critical"] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">Action</Label>
                  <Select value={draft.action} onValueChange={(v) => update({ action: v as RuleAction })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["flag", "review", "block"] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Threshold ({Math.round(draft.threshold * 100)}%)</Label>
                <Slider value={[draft.threshold * 100]} min={0} max={100} step={5} onValueChange={(v) => update({ threshold: v[0] / 100 })} className="mt-2" />
                <div className="mt-1 text-[11px] text-muted-foreground">Hit fires only when matched-weight ratio ≥ threshold.</div>
              </div>
              <div>
                <Label className="text-[11px]">Tags (comma-separated)</Label>
                <Input value={draft.tags.join(", ")} onChange={(e) => update({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} className="h-8" />
              </div>
            </TabsContent>

            <TabsContent value="sandbox" className="m-0">
              <SandboxRunner rule={draft} />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
