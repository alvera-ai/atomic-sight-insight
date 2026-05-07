import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Building2, FileText, Flag, Landmark, Mail, ShieldCheck, User } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import {
  getAccountHolder,
  getComplianceScreening,
  getCounterparty,
  getLedgerEntry,
  listBeneficialOwners,
  listDocuments,
  listKycRequirements,
  listLedgerAccountBalances,
  listSanctionsMatches,
  updateTransaction,
} from "@/api";
import type {
  AccountHolderResponse,
  BeneficialOwnerResponse,
  ComplianceScreeningResponse,
  CounterpartyResponse,
  DocumentResponse,
  KycRequirementResponse,
  LedgerAccountBalanceResponse,
  LedgerEntryResponse,
  SanctionsMatchResponse,
  TransactionResponse,
  TransactionStatus,
} from "@/api/types";
import { formatAmount, shortId } from "@/lib/money";
import { StatusPill } from "@/components/status-pill";
import { useRuleHits } from "@/hooks/use-rule-hits";
import { RuleHitBanner } from "@/components/rules/rule-hit-banner";
import { RuleHitsTab } from "@/components/rules/rule-hits-tab";
import { usePermission } from "@/hooks/use-permission";
import { CreateFlagDialog } from "@/components/cases/create-flag-dialog";
import { CasesSection } from "@/components/cases/cases-section";

const STATUSES: TransactionStatus[] = ["pending", "accepted", "settled", "rejected", "reversed", "cancelled"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-2 py-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="break-all text-xs font-medium text-foreground">{children}</div>
    </div>
  );
}

export function TransactionDetail({
  tx,
  onUpdated,
}: {
  tx: TransactionResponse;
  onUpdated: (next: TransactionResponse) => void;
}) {
  const [holder, setHolder] = useState<AccountHolderResponse | undefined>();
  const [debtorCp, setDebtorCp] = useState<CounterpartyResponse | undefined>();
  const [creditorCp, setCreditorCp] = useState<CounterpartyResponse | undefined>();
  const [ubos, setUbos] = useState<BeneficialOwnerResponse[]>([]);
  const [kycs, setKycs] = useState<KycRequirementResponse[]>([]);
  const [docs, setDocs] = useState<DocumentResponse[]>([]);
  const [screening, setScreening] = useState<ComplianceScreeningResponse | undefined>();
  const [matches, setMatches] = useState<SanctionsMatchResponse[]>([]);
  const [entry, setEntry] = useState<LedgerEntryResponse | undefined>();
  const [balances, setBalances] = useState<LedgerAccountBalanceResponse[]>([]);
  const [statusDraft, setStatusDraft] = useState<TransactionStatus>(tx.status ?? "pending");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const ruleHits = useRuleHits("transaction", tx.id);
  const canUpdateStatus = usePermission("transaction.update_status");
  const canCreateFlag = usePermission("transaction.create_flag");
  const canOutreach = usePermission("transaction.outreach");
  const isReadOnly = !canUpdateStatus && !canCreateFlag && !canOutreach;
  const [flagOpen, setFlagOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachSubject, setOutreachSubject] = useState("");
  const [outreachBody, setOutreachBody] = useState("");

  useEffect(() => {
    setStatusDraft(tx.status ?? "pending");
  }, [tx.id, tx.status]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [h, dCp, cCp, ks, ds, sc, le, bal] = await Promise.all([
        getAccountHolder(tx.account_holder_id),
        tx.debtor_counterparty_id ? getCounterparty(tx.debtor_counterparty_id) : Promise.resolve(undefined),
        tx.creditor_counterparty_id ? getCounterparty(tx.creditor_counterparty_id) : Promise.resolve(undefined),
        listKycRequirements(tx.account_holder_id),
        listDocuments(tx.account_holder_id),
        tx.compliance_screening_id ? getComplianceScreening(tx.compliance_screening_id) : Promise.resolve(undefined),
        tx.ledger_entry_id ? getLedgerEntry(tx.ledger_entry_id) : Promise.resolve(undefined),
        listLedgerAccountBalances(),
      ]);
      if (!alive) return;
      setHolder(h); setDebtorCp(dCp); setCreditorCp(cCp);
      setKycs(ks); setDocs(ds); setScreening(sc); setEntry(le); setBalances(bal);
      const cpForUbo = cCp ?? dCp;
      if (cpForUbo) {
        const u = await listBeneficialOwners(cpForUbo.id);
        if (alive) setUbos(u);
      } else setUbos([]);
      if (sc) {
        const m = await listSanctionsMatches(sc.id);
        if (alive) setMatches(m);
      } else setMatches([]);
    })();
    return () => { alive = false; };
  }, [tx.id, tx.account_holder_id, tx.debtor_counterparty_id, tx.creditor_counterparty_id, tx.compliance_screening_id, tx.ledger_entry_id]);

  const handleSave = async () => {
    if (statusDraft === tx.status) return;
    setSaving(true);
    try {
      const next = await updateTransaction(tx.id, { status: statusDraft });
      onUpdated(next);
      toast({ title: "Transaction updated", description: `Status set to ${statusDraft}.` });
    } catch (e) {
      toast({ title: "Update failed", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const matchedBalances = useMemo(
    () => balances.filter((b) => b.currency === tx.currency).slice(0, 3),
    [balances, tx.currency],
  );


  const handleSendOutreach = () => {
    sonnerToast.success("Information request sent", {
      description: holder?.email ? `To ${holder.email}` : "Email queued",
    });
    setOutreachSubject("");
    setOutreachBody("");
    setOutreachOpen(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b p-4">
        <div className="text-[11px] font-mono text-muted-foreground">{shortId(tx.id, 14)}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{formatAmount(tx.amount, tx.currency)}</span>
          <StatusPill value={tx.status} />
          <div className="ml-auto flex items-center gap-1.5">
            {canCreateFlag && (
              <Button size="sm" variant="outline" onClick={() => setFlagOpen(true)}>
                <Flag className="mr-1.5 h-3.5 w-3.5" /> Create flag
              </Button>
            )}
            {canOutreach && (
              <Button size="sm" variant="outline" onClick={() => setOutreachOpen(true)}>
                <Mail className="mr-1.5 h-3.5 w-3.5" /> Request info
              </Button>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground capitalize">
          {tx.transaction_type.replace(/_/g, " ")} · {tx.settlement_date ?? tx.requested_execution_date ?? "—"}
        </div>
        {isReadOnly && (
          <div className="rounded-md border border-dashed bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            You have read-only access to this record.
          </div>
        )}
        <RuleHitBanner hits={ruleHits} onView={() => setActiveTab("rules")} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-3 grid grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="holder">Holder</TabsTrigger>
          <TabsTrigger value="counterparty">Parties</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="screening">Screen</TabsTrigger>
          <TabsTrigger value="rules" className="relative">
            Rules{ruleHits.length > 0 && <span className="ml-1 rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">{ruleHits.length}</span>}
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsContent value="overview" className="m-0 space-y-3">
            <div className="rounded-md border bg-card p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {canUpdateStatus ? "Update status" : "Current status"}
              </div>
              {canUpdateStatus ? (
                <>
                  <div className="flex items-center gap-2">
                    <Select value={statusDraft} onValueChange={(v) => setStatusDraft(v as TransactionStatus)}>
                      <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleSave} disabled={saving || statusDraft === tx.status}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                  <div className="mt-1.5 text-[10px] text-muted-foreground">
                    PUT /api/transactions/{shortId(tx.id, 6)}
                  </div>
                </>
              ) : (
                <StatusPill value={tx.status} />
              )}
            </div>

            <div className="rounded-md border bg-card p-3">
              <Field label="id">{tx.id}</Field>
              <Field label="type">{tx.transaction_type}</Field>
              <Field label="status_reason_code">{tx.status_reason_code ?? "—"}</Field>
              <Field label="amount">{formatAmount(tx.amount, tx.currency)} ({tx.amount} minor)</Field>
              <Field label="currency">{tx.currency}</Field>
              <Field label="end_to_end_id">{tx.end_to_end_id ?? "—"}</Field>
              <Field label="uetr">{tx.uetr ?? "—"}</Field>
              <Field label="instruction_id">{tx.instruction_id ?? "—"}</Field>
              <Field label="requested_execution_date">{tx.requested_execution_date ?? "—"}</Field>
              <Field label="settlement_date">{tx.settlement_date ?? "—"}</Field>
              <Field label="transaction_external_id">{tx.transaction_external_id ?? "—"}</Field>
              <Field label="inserted_at">{format(new Date(tx.inserted_at), "yyyy-MM-dd HH:mm")}</Field>
              <Field label="updated_at">{format(new Date(tx.updated_at), "yyyy-MM-dd HH:mm")}</Field>
            </div>
          </TabsContent>

          <TabsContent value="holder" className="m-0">
            {holder ? (
              <div className="rounded-md border bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="font-medium">{holder.display_name}</div>
                </div>
                <Field label="legal_name">{holder.legal_name}</Field>
                <Field label="entity_type">{holder.entity_type}</Field>
                <Field label="country">{holder.country}</Field>
                <Field label="kyc_status"><StatusPill value={holder.kyc_status} /></Field>
                <Field label="risk_level"><StatusPill value={holder.risk_level} /></Field>
                <Field label="email">{holder.email ?? "—"}</Field>
              </div>
            ) : <div className="text-sm text-muted-foreground">Loading…</div>}
          </TabsContent>

          <TabsContent value="counterparty" className="m-0 space-y-3">
            {[debtorCp, creditorCp].map((cp, i) => cp ? (
              <div key={cp.id} className="rounded-md border bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div className="font-medium">{cp.display_name}</div>
                  <span className="ml-auto"><StatusPill value={cp.status} /></span>
                </div>
                <Field label="role">{i === 0 ? "debtor" : "creditor"}</Field>
                <Field label="legal_name">{cp.legal_name}</Field>
                <Field label="country">{cp.country}</Field>
                <Field label="external_reference">{cp.external_reference ?? "—"}</Field>
              </div>
            ) : null)}
            {ubos.length > 0 && (
              <div className="rounded-md border bg-card p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Beneficial owner chain
                </div>
                <ul className="space-y-1.5">
                  {ubos.map((u) => (
                    <li key={u.id} className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{u.full_name}</span>
                      <span className="text-muted-foreground">· {u.country}</span>
                      <span className="ml-auto font-mono">{u.ownership_percentage}%</span>
                      {u.is_pep && <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground">PEP</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!debtorCp && !creditorCp && <div className="text-sm text-muted-foreground">No counterparties linked.</div>}
          </TabsContent>

          <TabsContent value="kyc" className="m-0 space-y-3">
            <div className="rounded-md border bg-card">
              <div className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                KYC requirements
              </div>
              {kycs.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground">No KYC requirements.</div>
              ) : (
                <ul>
                  {kycs.map((k) => (
                    <li key={k.id} className="flex items-center gap-2 border-b px-3 py-2 text-xs last:border-b-0">
                      <span className="font-medium capitalize">{k.requirement_type.replace(/_/g, " ")}</span>
                      <span className="ml-auto"><StatusPill value={k.status} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-md border bg-card">
              <div className="flex items-center gap-2 border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Documents
              </div>
              {docs.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground">No documents.</div>
              ) : (
                <ul>
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 border-b px-3 py-2 text-xs last:border-b-0">
                      <span className="font-medium">{d.filename}</span>
                      <span className="text-muted-foreground">· {d.document_type}</span>
                      <span className="ml-auto text-muted-foreground">{format(new Date(d.uploaded_at), "yyyy-MM-dd")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="screening" className="m-0 space-y-3">
            {screening ? (
              <div className="rounded-md border bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <div className="font-medium">Latest screening</div>
                  <span className="ml-auto"><StatusPill value={screening.status} /></span>
                </div>
                <Field label="provider">{screening.provider}</Field>
                <Field label="screened_at">{format(new Date(screening.screened_at), "yyyy-MM-dd HH:mm")}</Field>
                <Field label="reviewer">{screening.reviewer ?? "—"}</Field>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No screening linked.</div>
            )}
            {matches.length > 0 && (
              <div className="rounded-md border bg-card">
                <div className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sanctions matches
                </div>
                <ul>
                  {matches.map((m) => (
                    <li key={m.id} className="border-b px-3 py-2 text-xs last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.matched_name}</span>
                        <span className="text-muted-foreground">· {m.list_name}</span>
                        <span className="ml-auto font-mono">{m.score}</span>
                      </div>
                      {m.false_positive_qualifier && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          False positive: <span className="font-medium">{m.false_positive_qualifier}</span> — {m.justification}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-md border bg-card">
              <div className="flex items-center gap-2 border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Landmark className="h-3.5 w-3.5" /> Ledger
              </div>
              <div className="px-3 py-2 text-xs">
                {entry ? (
                  <Field label={`${entry.direction}`}>{formatAmount(entry.amount, entry.currency)} · posted {format(new Date(entry.posted_at), "yyyy-MM-dd")}</Field>
                ) : (
                  <div className="text-muted-foreground">No ledger entry.</div>
                )}
                {matchedBalances.map((b) => (
                  <Field key={b.id} label={b.account_label}>{formatAmount(b.balance, b.currency)}</Field>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rules" className="m-0">
            <RuleHitsTab hits={ruleHits} />
          </TabsContent>
        </div>
      </Tabs>

      <div className="border-t p-4">
        <CasesSection sourceId={tx.id} />
      </div>

      <CreateFlagDialog
        open={flagOpen}
        onOpenChange={setFlagOpen}
        transactionId={tx.id}
        defaultTitle={`Transaction ${tx.id.slice(0, 8)} flagged`}
      />

      <Dialog open={outreachOpen} onOpenChange={setOutreachOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request information</DialogTitle>
            <DialogDescription>Send an outreach email to the account holder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="outreach-to">To</Label>
              <Input id="outreach-to" value={holder?.email ?? ""} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outreach-subject">Subject</Label>
              <Input
                id="outreach-subject"
                value={outreachSubject}
                onChange={(e) => setOutreachSubject(e.target.value)}
                placeholder="Additional information needed"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outreach-body">Message</Label>
              <Textarea
                id="outreach-body"
                value={outreachBody}
                onChange={(e) => setOutreachBody(e.target.value)}
                rows={5}
                placeholder="Hello, we'd like to confirm a few details about a recent transaction…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOutreachOpen(false)}>Cancel</Button>
            <Button onClick={handleSendOutreach} disabled={!outreachSubject.trim() || !outreachBody.trim() || !holder?.email}>
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

