// Centralised mock API. Function names mirror operationIds in atomicfi-openapi.yaml.
// Swap each function body for the @atomic-fi/sdk equivalent at rewire time.
import {
  accountHolders,
  beneficialOwners,
  complianceScreenings,
  counterparties,
  documents,
  kycRequirements,
  ledgerAccountBalances,
  ledgerEntries,
  sanctionsMatches,
  transactions as fixtureTransactions,
} from "@/data/fixtures";
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
} from "@/api/types";

const delay = <T,>(value: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(value), ms));

// In-memory store (mutable so updates survive across calls within a session).
let txStore: TransactionResponse[] = [...fixtureTransactions];

// AtomicFiApi.TransactionController.index
export const listTransactions = (): Promise<TransactionResponse[]> => delay([...txStore]);

// AtomicFiApi.TransactionController.show
export const getTransaction = (id: string): Promise<TransactionResponse | undefined> =>
  delay(txStore.find((t) => t.id === id));

// AtomicFiApi.TransactionController.update — PUT /api/transactions/{id}
export const updateTransaction = (
  id: string,
  patch: Partial<TransactionResponse>,
): Promise<TransactionResponse> => {
  txStore = txStore.map((t) => (t.id === id ? { ...t, ...patch, updated_at: new Date().toISOString() } : t));
  const updated = txStore.find((t) => t.id === id)!;
  return delay(updated, 350);
};

// AtomicFiApi.AccountHolderController.*
export const listAccountHolders = (): Promise<AccountHolderResponse[]> => delay(accountHolders);
export const getAccountHolder = (id: string) => delay(accountHolders.find((a) => a.id === id));

// AtomicFiApi.CounterpartyController.*
export const listCounterparties = (): Promise<CounterpartyResponse[]> => delay(counterparties);
export const getCounterparty = (id: string) => delay(counterparties.find((c) => c.id === id));

// AtomicFiApi.BeneficialOwnerController.index
export const listBeneficialOwners = (counterpartyId?: string): Promise<BeneficialOwnerResponse[]> =>
  delay(counterpartyId ? beneficialOwners.filter((b) => b.counterparty_id === counterpartyId) : beneficialOwners);

// AtomicFiApi.KycRequirementController.index
export const listKycRequirements = (accountHolderId?: string): Promise<KycRequirementResponse[]> =>
  delay(accountHolderId ? kycRequirements.filter((k) => k.account_holder_id === accountHolderId) : kycRequirements);

// AtomicFiApi.DocumentController.index
export const listDocuments = (accountHolderId?: string): Promise<DocumentResponse[]> =>
  delay(accountHolderId ? documents.filter((d) => d.account_holder_id === accountHolderId) : documents);

// AtomicFiApi.ComplianceScreeningController.show
export const getComplianceScreening = (id: string): Promise<ComplianceScreeningResponse | undefined> =>
  delay(complianceScreenings.find((s) => s.id === id));

export const listSanctionsMatches = (screeningId: string): Promise<SanctionsMatchResponse[]> =>
  delay(sanctionsMatches.filter((m) => m.compliance_screening_id === screeningId));

// AtomicFiApi.LedgerEntryController.show
export const getLedgerEntry = (id: string): Promise<LedgerEntryResponse | undefined> =>
  delay(ledgerEntries.find((l) => l.id === id));

// AtomicFiApi.LedgerAccountBalanceController.index
export const listLedgerAccountBalances = (): Promise<LedgerAccountBalanceResponse[]> =>
  delay(ledgerAccountBalances);
