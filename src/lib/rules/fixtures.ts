import type { Jurisdiction, Rule, RuleAction, RuleConditionGroup, RuleSeverity, RuleStatus } from "@/api/types";

const now = "2026-05-02T12:00:00Z";
let n = 0;
const id = () => { n++; return `${n.toString(16).padStart(8, "0")}-rule-bbbb-cccc-${n.toString(16).padStart(12, "0")}`; };

// Currency thresholds — minor units (cents/fils/paise/halalas)
const M = (units: number) => units * 100;

interface RuleSeed {
  name: string;
  description: string;
  scope: "transaction" | "account_holder";
  status: RuleStatus;
  severity: RuleSeverity;
  action: RuleAction;
  threshold: number;
  jurisdictions: Jurisdiction[];
  regulation: string;
  tags: string[];
  when: RuleConditionGroup;
}

const g = (children: RuleConditionGroup["children"], combinator: "AND" | "OR" = "AND"): RuleConditionGroup => ({
  id: `g-${Math.random().toString(36).slice(2, 8)}`,
  kind: "group",
  combinator,
  children,
});
const c = (field: string, operator: any, value: unknown, weight = 10) => ({
  id: `c-${Math.random().toString(36).slice(2, 8)}`,
  kind: "condition" as const,
  field, operator, value, weight,
});

const seeds: RuleSeed[] = [
  // ───────────────────────── GLOBAL / FATF
  {
    name: "OFAC / UN sanctioned counterparty",
    description: "Block any transfer to a counterparty flagged on global sanctions lists.",
    scope: "transaction", status: "live", severity: "critical", action: "block", threshold: 0.5,
    jurisdictions: ["GLOBAL"], regulation: "UN Security Council Consolidated List · OFAC SDN",
    tags: ["sanctions", "blocklist"],
    when: g([c("creditor_counterparty.status", "eq", "blocked")]),
  },
  {
    name: "Sanctioned jurisdiction (RU/KP/IR/SY/CU)",
    description: "Counterparty country is on the FATF call-for-action / comprehensive-sanctions list.",
    scope: "transaction", status: "live", severity: "high", action: "review", threshold: 0.5,
    jurisdictions: ["GLOBAL"], regulation: "FATF Public Statement · OFAC 31 CFR 560/510/515",
    tags: ["sanctions", "geography"],
    when: g([c("creditor_counterparty.country", "in", ["RU", "KP", "IR", "SY", "CU"])]),
  },
  {
    name: "Screening match present (PEP / sanctions)",
    description: "Latest compliance screening returned match or potential match.",
    scope: "transaction", status: "live", severity: "high", action: "review", threshold: 0.5,
    jurisdictions: ["GLOBAL"], regulation: "FATF Recommendation 12 (PEPs) · Recommendation 6 (sanctions)",
    tags: ["screening", "pep"],
    when: g([c("latest_screening.status", "in", ["match", "potential_match"])]),
  },
  {
    name: "Travel Rule — missing originator info",
    description: "Wire transfer lacks complete originator identification (FATF R.16).",
    scope: "transaction", status: "sandbox", severity: "high", action: "review", threshold: 0.5,
    jurisdictions: ["GLOBAL"], regulation: "FATF Recommendation 16 (Travel Rule)",
    tags: ["travel-rule", "wire"],
    when: g([
      c("transaction_type", "eq", "credit_transfer", 4),
      c("end_to_end_id", "exists", false, 8),
    ]),
  },

  // ───────────────────────── UNITED STATES
  {
    name: "US — Currency Transaction Report (CTR ≥ $10,000)",
    description: "Cash transaction at or above USD 10,000 requires CTR filing within 15 days.",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["US"], regulation: "31 CFR 1010.311 (Bank Secrecy Act)",
    tags: ["ctr", "bsa", "cash"],
    when: g([
      c("currency", "eq", "USD", 3),
      c("amount", "gte", M(10_000), 8),
    ]),
  },
  {
    name: "US — SAR threshold ($5,000 suspicious)",
    description: "Suspicious activity at or above USD 5,000 must be reported to FinCEN within 30 days.",
    scope: "transaction", status: "live", severity: "high", action: "review", threshold: 0.6,
    jurisdictions: ["US"], regulation: "31 CFR 1020.320 (SAR)",
    tags: ["sar", "fincen"],
    when: g([
      c("currency", "eq", "USD", 3),
      c("amount", "gte", M(5_000), 4),
      c("account_holder.risk_level", "in", ["high", "critical", "prohibited"], 7),
    ]),
  },
  {
    name: "US — High-risk holder over $1M USD",
    description: "USD transfer ≥ 1,000,000 by a high or prohibited-risk holder.",
    scope: "transaction", status: "live", severity: "high", action: "review", threshold: 0.6,
    jurisdictions: ["US"], regulation: "FinCEN EDD guidance · 31 CFR 1020.210",
    tags: ["aml", "high-value"],
    when: g([
      c("currency", "eq", "USD", 3),
      c("amount", "gte", M(1_000_000), 5),
      c("account_holder.risk_level", "in", ["high", "prohibited"], 8),
    ]),
  },
  {
    name: "US — OFAC SDN match",
    description: "Counterparty appears on the OFAC Specially Designated Nationals list.",
    scope: "transaction", status: "live", severity: "critical", action: "block", threshold: 0.5,
    jurisdictions: ["US"], regulation: "Executive Order 13224 · 31 CFR 501",
    tags: ["ofac", "sdn"],
    when: g([c("latest_screening.status", "eq", "match")]),
  },
  {
    name: "US — Structuring pattern (under-$10k)",
    description: "Multiple transfers between $9,000 and $9,999 may indicate CTR avoidance.",
    scope: "transaction", status: "sandbox", severity: "high", action: "review", threshold: 0.6,
    jurisdictions: ["US"], regulation: "31 USC 5324 (anti-structuring)",
    tags: ["structuring", "bsa"],
    when: g([
      c("currency", "eq", "USD", 3),
      c("amount", "between", [M(9_000), M(9_999)], 10),
    ]),
  },

  // ───────────────────────── UNITED KINGDOM
  {
    name: "UK — Cash transaction ≥ £10,000",
    description: "MLR 2017 occasional-transaction threshold for cash businesses.",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["UK"], regulation: "Money Laundering Regulations 2017, reg. 27",
    tags: ["mlr", "cash"],
    when: g([
      c("currency", "eq", "GBP", 3),
      c("amount", "gte", M(10_000), 8),
    ]),
  },
  {
    name: "UK — OFSI consolidated sanctions match",
    description: "Counterparty matches the UK OFSI consolidated sanctions list.",
    scope: "transaction", status: "live", severity: "critical", action: "block", threshold: 0.5,
    jurisdictions: ["UK"], regulation: "Sanctions and Anti-Money Laundering Act 2018",
    tags: ["ofsi", "sanctions"],
    when: g([c("creditor_counterparty.status", "eq", "blocked")]),
  },
  {
    name: "UK — EDD for high-risk third country",
    description: "Enhanced Due Diligence required for counterparties in HMT high-risk jurisdictions.",
    scope: "transaction", status: "live", severity: "high", action: "review", threshold: 0.5,
    jurisdictions: ["UK"], regulation: "MLR 2017 reg. 33 · Schedule 3ZA",
    tags: ["edd", "third-country"],
    when: g([c("creditor_counterparty.country", "in", ["AF", "MM", "KP", "IR", "YE"])]),
  },

  // ───────────────────────── EUROPEAN UNION
  {
    name: "EU — Occasional transaction ≥ €10,000",
    description: "Triggers full CDD under AMLD6 for occasional transactions.",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["EU"], regulation: "Directive (EU) 2018/1673 (AMLD6) · Art. 11",
    tags: ["cdd", "amld"],
    when: g([
      c("currency", "eq", "EUR", 3),
      c("amount", "gte", M(10_000), 8),
    ]),
  },
  {
    name: "EU — Transfer of Funds Regulation (€1,000)",
    description: "Wire transfers ≥ €1,000 require complete payer + payee information.",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.5,
    jurisdictions: ["EU"], regulation: "Regulation (EU) 2015/847 (TFR)",
    tags: ["tfr", "wire"],
    when: g([
      c("currency", "eq", "EUR", 3),
      c("amount", "gte", M(1_000), 4),
      c("transaction_type", "eq", "credit_transfer", 3),
    ]),
  },
  {
    name: "EU — High-risk third country counterparty",
    description: "Counterparty domiciled in EU Commission high-risk third country list.",
    scope: "transaction", status: "live", severity: "high", action: "review", threshold: 0.5,
    jurisdictions: ["EU"], regulation: "Commission Delegated Regulation (EU) 2016/1675",
    tags: ["edd", "high-risk"],
    when: g([c("creditor_counterparty.country", "in", ["AF", "BB", "BF", "KH", "JM", "ML", "MZ", "MM", "NI", "PK", "PA", "SN", "SS", "SY", "UG", "VU", "YE"])]),
  },

  // ───────────────────────── CANADA
  {
    name: "CA — Large Cash Transaction Report ($10,000 CAD)",
    description: "FINTRAC LCTR for cash transactions ≥ CAD 10,000 (or aggregated within 24h).",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["CA"], regulation: "PCMLTFA · FINTRAC LCTR",
    tags: ["lctr", "fintrac"],
    when: g([
      c("currency", "eq", "CAD", 3),
      c("amount", "gte", M(10_000), 8),
    ]),
  },
  {
    name: "CA — Electronic Funds Transfer Report ($10,000)",
    description: "Cross-border EFT ≥ CAD 10,000 must be reported to FINTRAC.",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.5,
    jurisdictions: ["CA"], regulation: "PCMLTFA · FINTRAC EFTR",
    tags: ["eftr", "fintrac", "wire"],
    when: g([
      c("currency", "eq", "CAD", 3),
      c("amount", "gte", M(10_000), 6),
      c("transaction_type", "eq", "credit_transfer", 3),
    ]),
  },
  {
    name: "CA — PEP / HIO screening match",
    description: "Politically Exposed Person or Head of International Organisation match.",
    scope: "account_holder", status: "sandbox", severity: "high", action: "review", threshold: 0.5,
    jurisdictions: ["CA"], regulation: "PCMLTFR ss. 15.1 (PEP/HIO)",
    tags: ["pep", "hio"],
    when: g([c("risk_level", "in", ["high", "prohibited"])]),
  },

  // ───────────────────────── UAE
  {
    name: "UAE — Cash transaction ≥ AED 55,000",
    description: "CBUAE threshold for cash transaction reporting.",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["UAE"], regulation: "CBUAE AML/CFT Decision No. 20 of 2018",
    tags: ["cbuae", "cash"],
    when: g([
      c("currency", "eq", "AED", 3),
      c("amount", "gte", M(55_000), 8),
    ]),
  },
  {
    name: "UAE — Local terrorist list match",
    description: "Counterparty appears on the UAE Local Terrorist List or UNSC consolidated list.",
    scope: "transaction", status: "live", severity: "critical", action: "block", threshold: 0.5,
    jurisdictions: ["UAE"], regulation: "Cabinet Decision No. 74 of 2020",
    tags: ["sanctions", "local-list"],
    when: g([c("creditor_counterparty.status", "eq", "blocked")]),
  },
  {
    name: "UAE — High-risk free-zone activity",
    description: "Counterparty is a DNFBP in a high-risk free zone (gold, real estate, precious metals).",
    scope: "account_holder", status: "sandbox", severity: "high", action: "review", threshold: 0.5,
    jurisdictions: ["UAE"], regulation: "CBUAE Guidance for DNFBPs 2021",
    tags: ["dnfbp", "free-zone"],
    when: g([c("risk_level", "in", ["high", "prohibited"])]),
  },

  // ───────────────────────── SAUDI ARABIA
  {
    name: "SA — Cash transaction ≥ SAR 60,000",
    description: "SAMA threshold for currency transaction reporting.",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["SA"], regulation: "SAMA AML Rules 2018 · SAFIU",
    tags: ["sama", "cash"],
    when: g([
      c("currency", "eq", "SAR", 3),
      c("amount", "gte", M(60_000), 8),
    ]),
  },
  {
    name: "SA — Cross-border transfer to high-risk country",
    description: "Outbound transfer to a SAMA-designated high-risk jurisdiction.",
    scope: "transaction", status: "live", severity: "high", action: "review", threshold: 0.5,
    jurisdictions: ["SA"], regulation: "AML Law Royal Decree M/20 (2017)",
    tags: ["cross-border"],
    when: g([
      c("transaction_type", "eq", "credit_transfer", 3),
      c("creditor_counterparty.country", "in", ["IR", "KP", "SY", "YE", "AF"], 8),
    ]),
  },

  // ───────────────────────── QATAR / BAHRAIN / KUWAIT / OMAN
  {
    name: "QA — Cash transaction ≥ QAR 50,000",
    description: "QCB threshold for STR consideration on cash deposits/withdrawals.",
    scope: "transaction", status: "sandbox", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["QA"], regulation: "QCB AML/CFT Instructions 2019 · QFIU",
    tags: ["qcb", "cash"],
    when: g([
      c("currency", "eq", "QAR", 3),
      c("amount", "gte", M(50_000), 8),
    ]),
  },
  {
    name: "BH — Wire transfer ≥ BHD 6,000",
    description: "CBB requires complete originator info for transfers ≥ BHD 6,000.",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.5,
    jurisdictions: ["BH"], regulation: "CBB Rulebook Vol. 1 — FC-1 AML",
    tags: ["cbb", "wire"],
    when: g([
      c("currency", "eq", "BHD", 3),
      c("amount", "gte", M(6_000), 6),
      c("transaction_type", "eq", "credit_transfer", 3),
    ]),
  },
  {
    name: "KW — Cash transaction ≥ KWD 3,000",
    description: "CBK threshold for enhanced monitoring of cash transactions.",
    scope: "transaction", status: "sandbox", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["KW"], regulation: "CBK AML/CFT Instructions 2013 (as amended)",
    tags: ["cbk", "cash"],
    when: g([
      c("currency", "eq", "KWD", 3),
      c("amount", "gte", M(3_000), 8),
    ]),
  },
  {
    name: "OM — Cash transaction ≥ OMR 6,000",
    description: "CBO threshold for currency transaction reporting to NCFI.",
    scope: "transaction", status: "sandbox", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["OM"], regulation: "CBO Circular BM-1149 · NCFI",
    tags: ["cbo", "cash"],
    when: g([
      c("currency", "eq", "OMR", 3),
      c("amount", "gte", M(6_000), 8),
    ]),
  },

  // ───────────────────────── INDIA
  {
    name: "IN — Cash transaction ≥ ₹10 lakh (CTR)",
    description: "PMLA cash transaction report for amounts ≥ INR 1,000,000.",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["IN"], regulation: "PMLA 2002 · PMLR Rule 3 · FIU-IND",
    tags: ["ctr", "pmla"],
    when: g([
      c("currency", "eq", "INR", 3),
      c("amount", "gte", M(1_000_000), 8),
    ]),
  },
  {
    name: "IN — Cross-border wire ≥ ₹5 lakh",
    description: "RBI LRS / cross-border remittance monitoring threshold.",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.5,
    jurisdictions: ["IN"], regulation: "RBI A.P. (DIR Series) Circular · FEMA 1999",
    tags: ["rbi", "lrs", "cross-border"],
    when: g([
      c("currency", "eq", "INR", 3),
      c("amount", "gte", M(500_000), 6),
      c("transaction_type", "eq", "credit_transfer", 3),
    ]),
  },
  {
    name: "IN — UAPA designated entity",
    description: "Counterparty matches MHA Unlawful Activities (Prevention) Act schedule.",
    scope: "transaction", status: "live", severity: "critical", action: "block", threshold: 0.5,
    jurisdictions: ["IN"], regulation: "UAPA 1967 · MHA 1st & 4th Schedules",
    tags: ["uapa", "sanctions"],
    when: g([c("creditor_counterparty.status", "eq", "blocked")]),
  },

  // ───────────────────────── SINGAPORE
  {
    name: "SG — Cash transaction ≥ S$20,000",
    description: "MAS threshold for CDD on occasional transactions.",
    scope: "transaction", status: "live", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["SG"], regulation: "MAS Notice 626 · CDTOFA",
    tags: ["mas", "cash"],
    when: g([
      c("currency", "eq", "SGD", 3),
      c("amount", "gte", M(20_000), 8),
    ]),
  },
  {
    name: "SG — Wire transfer information (S$1,500)",
    description: "Wire transfers ≥ S$1,500 require complete originator + beneficiary info.",
    scope: "transaction", status: "sandbox", severity: "medium", action: "flag", threshold: 0.5,
    jurisdictions: ["SG"], regulation: "MAS Notice 626 para 14 (Wire Transfers)",
    tags: ["mas", "wire"],
    when: g([
      c("currency", "eq", "SGD", 3),
      c("amount", "gte", M(1_500), 4),
      c("transaction_type", "eq", "credit_transfer", 3),
    ]),
  },

  // ───────────────────────── AUSTRALIA
  {
    name: "AU — Threshold Transaction Report (A$10,000)",
    description: "AUSTRAC TTR for cash or e-currency transactions ≥ AUD 10,000.",
    scope: "transaction", status: "sandbox", severity: "medium", action: "flag", threshold: 0.6,
    jurisdictions: ["AU"], regulation: "AML/CTF Act 2006 s.43 · AUSTRAC TTR",
    tags: ["austrac", "ttr"],
    when: g([
      c("currency", "eq", "AUD", 3),
      c("amount", "gte", M(10_000), 8),
    ]),
  },

  // ───────────────────────── ACCOUNT-HOLDER (cross-cutting)
  {
    name: "Holder KYC not approved",
    description: "Account holder has not completed KYC.",
    scope: "account_holder", status: "live", severity: "medium", action: "flag", threshold: 0.5,
    jurisdictions: ["GLOBAL"], regulation: "FATF Recommendation 10 (CDD)",
    tags: ["kyc"],
    when: g([c("kyc_status", "in", ["not_started", "in_progress", "on_hold", "rejected"])]),
  },
  {
    name: "EDD required for high-risk holder",
    description: "High-risk holder with open KYC requirements or rejected document.",
    scope: "account_holder", status: "live", severity: "high", action: "review", threshold: 0.6,
    jurisdictions: ["GLOBAL", "EU", "UK"], regulation: "FATF Recommendation 10 (EDD)",
    tags: ["edd", "kyc"],
    when: g([
      c("risk_level", "in", ["high", "prohibited"], 6),
      g([
        c("open_kyc_requirements_count", "gt", 0, 4),
        c("rejected_kyc_requirements_count", "gt", 0, 4),
      ], "OR") as any,
    ]),
  },

  // ───────────────────────── ARCHIVED (legacy / superseded)
  {
    name: "Legacy: any transfer over $100k (USD)",
    description: "Superseded by the jurisdiction-specific CTR/SAR rules.",
    scope: "transaction", status: "archived", severity: "low", action: "flag", threshold: 0.5,
    jurisdictions: ["US"], regulation: "Internal — superseded",
    tags: ["legacy"],
    when: g([c("amount", "gt", M(100_000), 10)]),
  },
  {
    name: "Legacy: any cash transfer over €15,000",
    description: "Replaced by AMLD6 €10,000 occasional-transaction trigger.",
    scope: "transaction", status: "archived", severity: "low", action: "flag", threshold: 0.5,
    jurisdictions: ["EU"], regulation: "Pre-AMLD6 — superseded",
    tags: ["legacy"],
    when: g([
      c("currency", "eq", "EUR", 3),
      c("amount", "gt", M(15_000), 10),
    ]),
  },
];

export const seedRules: Rule[] = seeds.map((s, i) => ({
  id: id(),
  name: s.name,
  description: s.description,
  scope: s.scope,
  status: s.status,
  severity: s.severity,
  action: s.action,
  threshold: s.threshold,
  when: s.when,
  jurisdictions: s.jurisdictions,
  regulation: s.regulation,
  tags: s.tags,
  created_at: now,
  updated_at: now,
  created_by: "system",
  version: 1,
}));
