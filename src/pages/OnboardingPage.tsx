import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Briefcase, CalendarIcon, CheckCircle2, FileUp, PauseCircle, Plus, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  createDocument,
  listAccountHolders, listDocuments, listKycRequirements,
  updateAccountHolder, updateKycRequirement,
} from "@/api";
import type {
  AccountHolderResponse, DocumentResponse, KycRequirementResponse, KycRequirementStatus, KycStatus, RiskLevel,
} from "@/api/types";
import { StatusPill } from "@/components/status-pill";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";
import { shortId } from "@/lib/money";
import { useRuleHits } from "@/hooks/use-rule-hits";
import { RuleHitBanner } from "@/components/rules/rule-hit-banner";
import { RuleHitsTab } from "@/components/rules/rule-hits-tab";
import { CasesSection } from "@/components/cases/cases-section";
import { createCase, type CasePriority } from "@/api/cases";
import { usePermission } from "@/hooks/use-permission";
import { OutreachTab } from "@/components/outreach/outreach-tab";
import { useAuditLogger } from "@/hooks/use-audit-logger";

const KYC_FILTERS: Array<KycStatus | "all"> = ["all", "not_started", "in_progress", "approved", "rejected", "on_hold"];
const KYC_REQ_STATUSES: KycRequirementStatus[] = ["pending", "submitted", "approved", "rejected", "waived"];
const ONBOARDING_ASSIGNEES = ["Unassigned", "Ana Martins", "James Osei", "Priya Nair"];

export default function OnboardingPage() {
  const [holders, setHolders] = useState<AccountHolderResponse[]>([]);
  const [filter, setFilter] = useState<KycStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kycs, setKycs] = useState<KycRequirementResponse[]>([]);
  const [docs, setDocs] = useState<DocumentResponse[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [openCaseDialog, setOpenCaseDialog] = useState(false);
  const canReassign = usePermission("onboarding.approve"); // officer + analyst

  useEffect(() => {
    listAccountHolders().then((all) => {
      setHolders(all);
      if (!selectedId && all[0]) setSelectedId(all[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    listKycRequirements(selectedId).then(setKycs);
    listDocuments(selectedId).then(setDocs);
  }, [selectedId]);

  const filtered = useMemo(() => {
    return holders.filter((h) => {
      if (filter !== "all" && h.kyc_status !== filter) return false;
      if (search && !h.display_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [holders, filter, search]);

  const selected = holders.find((h) => h.id === selectedId);

  const handleHolderUpdate = async (patch: Partial<AccountHolderResponse>) => {
    if (!selected) return;
    const next = await updateAccountHolder(selected.id, patch);
    setHolders((prev) => prev.map((h) => (h.id === next.id ? next : h)));
    toast({ title: "Account holder updated", description: `PUT /api/account-holders/${shortId(next.id, 6)}` });
  };

  const handleKycUpdate = async (id: string, status: KycRequirementStatus) => {
    const next = await updateKycRequirement(id, { status });
    setKycs((prev) => prev.map((k) => (k.id === id ? next : k)));
    toast({ title: "KYC requirement updated", description: `PUT /api/kyc-requirements/${shortId(id, 6)}` });
  };

  return (
    <div className="flex h-full">
      <div className="flex w-[340px] shrink-0 flex-col border-r bg-background">
        <div className="border-b p-3">
          <h1 className="text-lg font-semibold tracking-tight">Onboarding queue</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} of {holders.length} account holders</p>
          <div className="mt-2 flex gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8" />
            <Select value={filter} onValueChange={(v) => setFilter(v as KycStatus | "all")}>
              <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KYC_FILTERS.map((f) => <SelectItem key={f} value={f}>{f === "all" ? "All KYC" : f.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((h) => (
            <button
              key={h.id}
              onClick={() => setSelectedId(h.id)}
              className={cn(
                "flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left transition hover:bg-muted/50",
                selectedId === h.id && "bg-primary/5",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{h.display_name}</span>
                <span className="ml-auto"><StatusPill value={h.kyc_status} /></span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{h.country}</span>
                <span>·</span>
                <span>{h.entity_type}</span>
                <StatusPill value={h.risk_level} />
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">No matching holders.</div>
          )}
        </div>
      </div>

      {selected ? (
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <HolderHits holderId={selected.id} />
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div>
                <div className="text-lg font-semibold">{selected.display_name}</div>
                <div className="text-xs text-muted-foreground">{selected.legal_name} · {selected.country} · {selected.entity_type}</div>
              </div>
              <div className="ml-auto flex flex-col items-end gap-1.5">
                <StatusPill value={selected.kyc_status} />
                <StatusPill value={selected.risk_level} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
              <Label className="text-[11px] text-muted-foreground">Assigned to</Label>
              {canReassign ? (
                <Select
                  value={assignments[selected.id] ?? "Unassigned"}
                  onValueChange={(v) => {
                    setAssignments((prev) => ({ ...prev, [selected.id]: v }));
                    sonnerToast.success("Reassigned", { description: v });
                  }}
                >
                  <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ONBOARDING_ASSIGNEES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm font-medium">{assignments[selected.id] ?? "Unassigned"}</span>
              )}
              <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => setOpenCaseDialog(true)}>
                <Briefcase className="h-3.5 w-3.5" /> Open case
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">KYC status</Label>
                <Select value={selected.kyc_status} onValueChange={(v) => handleHolderUpdate({ kyc_status: v as KycStatus })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["not_started", "in_progress", "approved", "rejected", "on_hold"] as KycStatus[]).map((s) =>
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Risk level</Label>
                <Select value={selected.risk_level} onValueChange={(v) => handleHolderUpdate({ risk_level: v as RiskLevel })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["low", "medium", "high", "prohibited"] as RiskLevel[]).map((s) =>
                      <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleHolderUpdate({ kyc_status: "approved" })}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleHolderUpdate({ kyc_status: "on_hold" })}>
                <PauseCircle className="h-3.5 w-3.5" /> Hold
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleHolderUpdate({ kyc_status: "rejected" })}>
                <ShieldX className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          </Card>

          <CasesSection sourceId={selected.id} title="Cases for this holder" />

          <Card className="p-4">
            <div className="mb-3 text-sm font-medium">Outreach</div>
            <OutreachTab
              subjectType="account_holder"
              subjectId={selected.id}
              customerName={selected.display_name}
              customerEmail={selected.email ?? ""}
            />
          </Card>

          <OpenOnboardingCaseDialog
            open={openCaseDialog}
            onOpenChange={setOpenCaseDialog}
            holder={selected}
            assignedTo={assignments[selected.id] ?? "Unassigned"}
          />

          <Card className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <div className="text-sm font-medium">KYC requirements</div>
              <span className="text-xs text-muted-foreground">{kycs.length} items</span>
            </div>
            {kycs.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">No KYC requirements.</div>
            ) : (
              <ul>
                {kycs.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium capitalize">{k.requirement_type.replace(/_/g, " ")}</div>
                      {k.notes && <div className="text-[11px] text-muted-foreground">{k.notes}</div>}
                    </div>
                    <Select value={k.status} onValueChange={(v) => handleKycUpdate(k.id, v as KycRequirementStatus)}>
                      <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KYC_REQ_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <div className="text-sm font-medium">Documents</div>
              <AttachDocumentDialog
                accountHolderId={selected.id}
                onUploaded={(d, requirementId) => {
                  setDocs((prev) => [d, ...prev]);
                  if (requirementId) {
                    updateKycRequirement(requirementId, { document_id: d.id, status: "submitted" })
                      .then((next) => setKycs((prev) => prev.map((k) => (k.id === next.id ? next : k))));
                  }
                  toast({ title: "Document attached", description: `POST /api/documents` });
                }}
                requirements={kycs}
              />
            </div>
            {docs.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">No documents.</div>
            ) : (
              <ul>
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0 text-xs">
                    <span className="font-medium">{d.filename}</span>
                    <span className="text-muted-foreground">· {d.document_type}</span>
                    <span className="ml-auto text-muted-foreground">{format(new Date(d.uploaded_at), "yyyy-MM-dd HH:mm")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Select an account holder.
        </div>
      )}
    </div>
  );
}

function AttachDocumentDialog({
  accountHolderId, onUploaded, requirements,
}: {
  accountHolderId: string;
  onUploaded: (d: DocumentResponse, requirementId?: string) => void;
  requirements: KycRequirementResponse[];
}) {
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState("");
  const [docType, setDocType] = useState("proof_of_address");
  const [requirementId, setRequirementId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!filename.trim()) return;
    setSubmitting(true);
    try {
      const created = await createDocument({
        filename: filename.trim(),
        document_type: docType,
        account_holder_id: accountHolderId,
        size_bytes: Math.floor(50_000 + Math.random() * 1_500_000),
        mime_type: filename.endsWith(".png") ? "image/png" : "application/pdf",
      });
      onUploaded(created, requirementId === "none" ? undefined : requirementId);
      setOpen(false);
      setFilename("");
      setRequirementId("none");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Attach document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach document</DialogTitle>
          <DialogDescription>POST /api/documents, then optionally link via PUT /api/kyc-requirements/&#123;id&#125;.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Filename</Label>
            <Input value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="e.g. articles_2026.pdf" className="mt-1" />
          </div>
          <div>
            <Label>Document type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["proof_of_address", "id_document", "incorporation", "ownership_chart", "bank_statement", "tax_id"].map((t) =>
                  <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Link to KYC requirement (optional)</Label>
            <Select value={requirementId} onValueChange={setRequirementId}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Don't link</SelectItem>
                {requirements.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.requirement_type.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!filename.trim() || submitting} className="gap-1.5">
            <FileUp className="h-3.5 w-3.5" /> {submitting ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HolderHits({ holderId }: { holderId: string }) {
  const hits = useRuleHits("account_holder", holderId);
  if (hits.length === 0) return null;
  return (
    <>
      <RuleHitBanner hits={hits} />
      <Card className="p-4">
        <div className="mb-2 text-sm font-medium">Rule breaches ({hits.length})</div>
        <RuleHitsTab hits={hits} />
      </Card>
    </>
  );
}

function OpenOnboardingCaseDialog({
  open, onOpenChange, holder, assignedTo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  holder: AccountHolderResponse;
  assignedTo: string;
}) {
  const [priority, setPriority] = useState<CasePriority>("medium");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState<Date | undefined>(() => new Date(Date.now() + 5 * 86_400_000));
  const [assignee, setAssignee] = useState(assignedTo);

  useEffect(() => { setAssignee(assignedTo); }, [assignedTo, open]);

  const submit = async () => {
    if (!description.trim() || !due) return;
    await createCase({
      type: "onboarding_review",
      status: "open",
      priority,
      title: `Onboarding review · ${holder.display_name}`,
      description: description.trim(),
      source_id: holder.id,
      source_type: "account_holder",
      assigned_to: assignee,
      due_date: due.toISOString(),
    });
    sonnerToast.success("Case opened", { description: `Onboarding review · ${holder.display_name}` });
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open onboarding case</DialogTitle>
          <DialogDescription>Create a case linked to {holder.display_name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as CasePriority)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["critical", "high", "medium", "low"] as CasePriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assign to</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ONBOARDING_ASSIGNEES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What needs review?" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Due date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-9 w-full justify-start text-left font-normal", !due && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {due ? format(due, "yyyy-MM-dd") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={due} onSelect={setDue} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!description.trim() || !due}>Open case</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

