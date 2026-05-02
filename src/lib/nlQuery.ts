import type { TransactionResponse, TransactionStatus, TransactionType } from "@/api/types";
import { transactions } from "@/data/fixtures";

export type CopilotToolStep = {
  tool: "search_tables" | "get_schema" | "get_related_tables" | "execute_query";
  args: Record<string, unknown>;
  resultPreview: string;
};

export type CopilotResolution = {
  steps: CopilotToolStep[];
  rows: TransactionResponse[];
  sql: string;
  explanation: string;
};

const all = () => transactions;

function matchAny(prompt: string, ...needles: string[]) {
  const p = prompt.toLowerCase();
  return needles.some((n) => p.includes(n));
}

// Resolves a free-text prompt to a filtered subset of transactions + a fake SQL trace.
export function resolveNlQuery(prompt: string): CopilotResolution {
  const p = prompt.trim();
  const lower = p.toLowerCase();

  // Pattern 1: sanctioned / blocked counterparties
  if (matchAny(lower, "sanction", "blocked counterparty", "blocked counterparties", "ofac")) {
    const blocked = new Set(["blocked", "under_review", "suspended"]);
    const cpIds = new Set(
      // dynamic import shape: re-derive at call time
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/data/fixtures").counterparties
        .filter((c: { status: string; id: string }) => blocked.has(c.status))
        .map((c: { id: string }) => c.id),
    );
    const rows = all().filter((t) => t.creditor_counterparty_id && cpIds.has(t.creditor_counterparty_id));
    return mkResolution({
      prompt: p,
      tables: ["transactions", "counterparties"],
      sql:
        "SELECT t.* FROM transactions t\n" +
        "JOIN counterparties c ON c.id = t.creditor_counterparty_id\n" +
        "WHERE c.status IN ('blocked','under_review','suspended');",
      rows,
      explanation: "Joined transactions to counterparties and filtered to blocked / under-review / suspended.",
    });
  }

  // Pattern 2: rejected card payments
  if (matchAny(lower, "rejected card", "card payment fail", "card declined")) {
    const rows = all().filter((t) => t.transaction_type === "card_payment" && t.status === "rejected");
    return mkResolution({
      prompt: p,
      tables: ["transactions"],
      sql: "SELECT * FROM transactions WHERE transaction_type = 'card_payment' AND status = 'rejected';",
      rows,
      explanation: "Filtered transactions table by type and status.",
    });
  }

  // Pattern 3: pending transactions over $10k (in USD minor units = 1_000_000)
  if (matchAny(lower, "pending", "stuck", "in flight") && matchAny(lower, "10k", "10,000", "10000", "large")) {
    const rows = all().filter((t) => t.status === "pending" && t.currency === "USD" && t.amount >= 1_000_000);
    return mkResolution({
      prompt: p,
      tables: ["transactions"],
      sql: "SELECT * FROM transactions WHERE status = 'pending' AND currency = 'USD' AND amount >= 1000000;",
      rows,
      explanation: "Pending USD transactions ≥ $10,000.",
    });
  }

  // Pattern 4: status filter
  const statuses: TransactionStatus[] = ["pending", "accepted", "settled", "rejected", "reversed", "cancelled"];
  const matchedStatus = statuses.find((s) => lower.includes(s));
  if (matchedStatus) {
    const rows = all().filter((t) => t.status === matchedStatus);
    return mkResolution({
      prompt: p,
      tables: ["transactions"],
      sql: `SELECT * FROM transactions WHERE status = '${matchedStatus}';`,
      rows,
      explanation: `Filtered by status = ${matchedStatus}.`,
    });
  }

  // Pattern 5: type filter
  const types: TransactionType[] = ["credit_transfer", "direct_debit", "card_payment", "refund", "reversal", "internal_transfer"];
  const matchedType = types.find((t) => lower.includes(t.replace("_", " ")) || lower.includes(t));
  if (matchedType) {
    const rows = all().filter((t) => t.transaction_type === matchedType);
    return mkResolution({
      prompt: p,
      tables: ["transactions"],
      sql: `SELECT * FROM transactions WHERE transaction_type = '${matchedType}';`,
      rows,
      explanation: `Filtered by transaction_type = ${matchedType}.`,
    });
  }

  // Fallback: substring search across id-like fields
  const rows = all().filter((t) =>
    [t.id, t.end_to_end_id, t.uetr, t.instruction_id, t.transaction_external_id]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(lower)),
  );
  return mkResolution({
    prompt: p,
    tables: ["transactions"],
    sql: `SELECT * FROM transactions WHERE id ILIKE '%${p}%' OR uetr ILIKE '%${p}%' OR end_to_end_id ILIKE '%${p}%';`,
    rows,
    explanation: "Substring search across id, UETR, and EndToEndId.",
  });
}

function mkResolution(args: {
  prompt: string;
  tables: string[];
  sql: string;
  rows: TransactionResponse[];
  explanation: string;
}): CopilotResolution {
  const steps: CopilotToolStep[] = [
    {
      tool: "search_tables",
      args: { query: args.prompt },
      resultPreview: `Found ${args.tables.length} candidate table(s): ${args.tables.join(", ")}`,
    },
    {
      tool: "get_schema",
      args: { tables: args.tables },
      resultPreview: `Loaded ${args.tables.length} schema(s) (${args.tables.join(", ")})`,
    },
    {
      tool: "get_related_tables",
      args: { tables: args.tables },
      resultPreview:
        args.tables.length > 1
          ? `Discovered FK ${args.tables[0]}.creditor_counterparty_id → ${args.tables[1]}.id`
          : "No additional joins required.",
    },
    {
      tool: "execute_query",
      args: { sql: args.sql },
      resultPreview: `${args.rows.length} row(s) returned.`,
    },
  ];
  return { steps, rows: args.rows, sql: args.sql, explanation: args.explanation };
}
