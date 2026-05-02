// Types mirror AtomicFi OpenAPI schemas (atomicfi-openapi.yaml).
// Field names + enums are kept exact so the rewire to @atomic-fi/sdk is a one-line swap.

export type UUID = string;

export type TransactionStatus =
  | "pending"
  | "accepted"
  | "settled"
  | "rejected"
  | "reversed"
  | "cancelled";

export type TransactionType =
  | "credit_transfer"
  | "direct_debit"
  | "card_payment"
  | "refund"
  | "reversal"
  | "internal_transfer";

export interface TransactionResponse {
  id: UUID;
  transaction_type: TransactionType;
  status: TransactionStatus | null;
  amount: number; // minor units
  currency: string; // ISO 4217
  end_to_end_id: string | null;
  uetr: string | null;
  instruction_id: string | null;
  status_reason_code: string | null;
  requested_execution_date: string | null;
  settlement_date: string | null;
  transaction_external_id: string | null;
  account_holder_id: UUID;
  debtor_payment_account_id: UUID | null;
  creditor_payment_account_id: UUID | null;
  debtor_counterparty_id: UUID | null;
  creditor_counterparty_id: UUID | null;
  ledger_entry_id: UUID | null;
  compliance_screening_id: UUID | null;
  tenant_id: UUID;
  inserted_at: string;
  updated_at: string;
}

export type KycStatus = "not_started" | "in_progress" | "approved" | "rejected" | "on_hold";
export type RiskLevel = "low" | "medium" | "high" | "prohibited";

export interface AccountHolderResponse {
  id: UUID;
  display_name: string;
  legal_name: string;
  entity_type: "individual" | "business";
  country: string;
  kyc_status: KycStatus;
  risk_level: RiskLevel;
  email: string | null;
  inserted_at: string;
  updated_at: string;
  tenant_id: UUID;
}

export type CounterpartyStatus = "active" | "blocked" | "under_review" | "suspended";

export interface CounterpartyResponse {
  id: UUID;
  display_name: string;
  legal_name: string;
  country: string;
  status: CounterpartyStatus;
  external_reference: string | null;
  tenant_id: UUID;
  inserted_at: string;
  updated_at: string;
}

export interface BeneficialOwnerResponse {
  id: UUID;
  counterparty_id: UUID;
  full_name: string;
  ownership_percentage: number;
  country: string;
  is_pep: boolean;
  tenant_id: UUID;
  inserted_at: string;
}

export type KycRequirementStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "waived";

export interface KycRequirementResponse {
  id: UUID;
  account_holder_id: UUID;
  requirement_type: string; // e.g. proof_of_address, id_document
  status: KycRequirementStatus;
  document_id: UUID | null;
  notes: string | null;
  inserted_at: string;
  updated_at: string;
}

export interface DocumentResponse {
  id: UUID;
  filename: string;
  document_type: string;
  account_holder_id: UUID | null;
  uploaded_at: string;
  size_bytes: number;
  mime_type: string;
}

export type ScreeningStatus = "clear" | "potential_match" | "match" | "review";

export interface ComplianceScreeningResponse {
  id: UUID;
  subject_type: "account_holder" | "counterparty" | "beneficial_owner";
  subject_id: UUID;
  status: ScreeningStatus;
  provider: string;
  screened_at: string;
  reviewer: string | null;
}

export interface SanctionsMatchResponse {
  id: UUID;
  compliance_screening_id: UUID;
  matched_name: string;
  list_name: string; // OFAC SDN, EU CFSP, UN, …
  score: number; // 0–100
  false_positive_qualifier: string | null;
  reviewer: string | null;
  justification: string | null;
}

export interface LedgerEntryResponse {
  id: UUID;
  transaction_id: UUID;
  ledger_account_id: UUID;
  direction: "debit" | "credit";
  amount: number;
  currency: string;
  posted_at: string;
}

export interface LedgerAccountBalanceResponse {
  id: UUID;
  ledger_account_id: UUID;
  account_label: string;
  balance: number;
  currency: string;
  as_of: string;
}
