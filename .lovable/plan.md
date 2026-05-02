
# Alvera AtomicFi Ops — v1 (Shell + Transactions 360°)

Build the app shell and the first Compliance screen end-to-end against mock data, with field names and operationIds taken directly from your `openapi_1.yaml`. Visual system mirrors the **Website and Reputation Management** project (AlignUI / Preline Pro: white surfaces, AlignUI orange `--primary: 18 89% 54%`, neutral grays, `--radius: 0.5rem`, full light + dark palette). Light is default; a sun/moon toggle lives in the top bar. Screens 2–7 are scaffolded as routes that render a "Coming next" placeholder.

## Layout shell

- **Collapsible left sidebar** (shadcn `Sidebar`, `collapsible="icon"`):
  - **Compliance**: Transactions 360°, Onboarding queue, Review queue, Talk to data, Recommendations
  - **Engineer**: Integrations, Health
  - Active route highlighted; collapses to icon strip; group containing the active route stays expanded.
- **Role switcher** at top of sidebar — segmented Compliance / Engineer that controls which group expands by default. All routes remain accessible.
- **Top bar**: tenant selector (mock dropdown), global search (cosmetic), notifications bell with mock badge, avatar menu, theme toggle.
- **Floating Copilot button** (bottom-right, primary orange) opens a right-side drawer from any screen. The drawer is shared with screen 5 later; on screen 1 it's pre-scoped to the transactions table.

## Screen 1 — Transactions 360°

```text
+-------------------------------------------------------------+
| Filters: [status ▾] [type ▾] [date range] [amount] [Reset]  |
| NL prompt:  [ Ask in plain English…              ] [Run]    |
+-------------------------------------------------------------+
| Transactions table  (TanStack)                              |
|  id | type | status | amount | currency | settlement_date   |
|  | account_holder | creditor_counterparty                   |
|  …row click → opens right detail pane                       |
+--------------------------------------------+----------------+
                                             | Detail pane    |
                                             | (tabs)         |
                                             +----------------+
```

**Table columns** (TanStack Table, all from `TransactionResponse`): `id` (truncated + copy), `transaction_type` pill, `status` pill, `amount` formatted from minor units using `currency`, `settlement_date`, account holder name, creditor counterparty name, `uetr` (truncated). Sortable, paginated, row-select highlights and opens detail pane.

**Filter bar** (client-side over mock data): `status` multi-select (the 6 enum values), `transaction_type` multi-select (the 6 enum values), date range over `settlement_date`, amount range, free-text search across `id`, `end_to_end_id`, `instruction_id`, `uetr`, `transaction_external_id`.

**NL filter**: typing a prompt and pressing Run opens the Copilot drawer pre-populated with the prompt, streams the four tool steps (`search_tables` → `get_schema` → `get_related_tables` → `execute_query`), and on completion replaces the table contents with the returned rows. A "Clear NL filter" chip appears above the table.

**Detail pane** (right side, ~40% width, tabs):
- **Overview** — all `TransactionResponse` fields. Inline action: status `Select` that fires a mock `updateTransaction` (operationId `AtomicFiApi.TransactionController.update`, `PUT /api/transactions/{id}`) with optimistic update + toast.
- **Account Holder** — linked `AccountHolder` card (`kyc_status`, `risk_level`, country) with a "View in Onboarding" link.
- **Counterparties** — debtor + creditor cards (status pill); if a beneficial-owner chain exists, render as a vertical list with ownership %.
- **KYC & Documents** — list of `KycRequirement` rows (status pills) + linked `Document` rows (filename, type, uploaded_at). Read-only in v1.
- **Screening** — latest `ComplianceScreening` (via `compliance_screening_id`) plus any `SanctionsMatch` rows (name, list, score, `false_positive_qualifier`).
- **Ledger** — `LedgerEntry` (via `ledger_entry_id`) and current `LedgerAccountBalance` for the affected accounts.

All tabs read from the same in-memory mock fixture so a selected row immediately populates everything.

## Copilot drawer (shared)

Right-side `Sheet`, full-height, ~480px wide:

1. **Prompt input** (textarea + Run + recent prompts).
2. **Tool-call stream** — each step is a collapsible card with tool name, JSON arguments, spinner → check, then result preview. Steps appear with ~400ms staggered fake latency (per your "streamed step list" choice).
3. **Result table** — same TanStack table component, columns inferred from the mock `execute_query` payload.
4. **Apply to view** button (screen 1 only) — pushes results into the main transactions table.

No persistence; closing the drawer keeps the last run in memory until route change.

## Mock data (`src/data/fixtures.ts`)

Built directly from spec schemas so the rewire is a one-line swap:
- ~40 `TransactionResponse` rows covering every `status` × `transaction_type` combination of interest, amounts in minor units, mixed currencies (USD/EUR/GBP), realistic UETRs/EndToEndIds.
- ~15 `AccountHolder` (mixed `kyc_status`, `risk_level`).
- ~10 `Counterparty` (some `blocked`, some with beneficial-owner chains).
- ~5 `BeneficialOwner` chains.
- A handful of `KycRequirement`, `Document`, `ComplianceScreening` + `SanctionsMatch`, `LedgerEntry`, `LedgerAccountBalance` rows linked to specific transactions so several rows demo every tab richly.

A small NL→filter resolver in `src/lib/nlQuery.ts` recognises a few canned patterns ("blocked transactions over 10k last week", "transactions linked to sanctioned counterparties", "rejected card payments today") and returns a filtered subset; anything else falls back to substring match. Keeps the demo believable without an LLM call.

## Routes

- `/` → redirect to `/transactions`
- `/transactions` (screen 1, implemented)
- `/onboarding`, `/review`, `/talk-to-data`, `/recommendations`, `/integrations`, `/health` — placeholder "Coming next" panel describing the screen's intent.

## Technical details

- **Stack**: React + Vite + TS, Tailwind, shadcn/ui, react-router, lucide. Add **`@tanstack/react-table`** and **`recharts`** (recharts unused in v1 but installed to avoid a second build later).
- **Theme tokens**: copy AlignUI HSL palette from the reference project into `src/index.css` for both `:root` and `.dark`. `tailwind.config.ts` already wires `hsl(var(--…))` semantics — no changes needed.
- **Theme toggle**: tiny `useTheme` hook toggles the `dark` class on `<html>`. No persistence (per "no localStorage" rule); resets to light on reload.
- **API layer** (`src/api/*.ts`), one file per resource, function names matching spec operationIds:
  - `transactions.ts`: `listTransactions`, `getTransaction`, `updateTransaction` (→ `TransactionController.index|show|update`).
  - `accountHolders.ts`, `counterparties.ts`, `beneficialOwners.ts`, `kycRequirements.ts`, `documents.ts`, `complianceScreenings.ts` (incl. `screenAccountHolder`, `screenCounterparty`, `screenBeneficialOwner`), `ledgerEntries.ts`, `ledgerAccountBalances.ts`, `apiInfo.ts`, `tenants.ts`, `apiKeys.ts`, `blocklistEntries.ts`. Most are stubs returning `[]` for v1; only the transaction/holder/counterparty/screening/document/ledger functions return real fixtures.
  - Each returns a Promise with a small artificial delay so loading states render.
  - The Claude rewire later swaps these to `@atomic-fi/sdk`.
- **Types** (`src/api/types.ts`): mirror the spec schemas (`TransactionResponse`, `AccountHolderResponse`, `CounterpartyResponse`, `BeneficialOwnerResponse`, `KycRequirementResponse`, `DocumentResponse`, `ComplianceScreeningResponse`, `SanctionsMatchResponse`, `LedgerEntryResponse`, `LedgerAccountBalanceResponse`) with exact field names and enums from the YAML.
- **Money formatting**: `formatAmount(minor: number, currency: string)` divides by the right number of fractional digits per ISO 4217 (USD/EUR/GBP = 2, JPY = 0). Lives in `src/lib/money.ts`.
- **State**: component state + URL search params (selected transaction id, active filters). No global store. Copilot state in a `CopilotProvider` context so the floating button and screens share it.

## Out of scope (this pass)

Screens 2–7 (placeholders only), real LLM calls, real SDK wiring, auth, persistence, payments, integrations agent runs, health metrics charts.
