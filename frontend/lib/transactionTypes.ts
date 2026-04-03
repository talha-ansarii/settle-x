export type TransactionRecord = {
  id: string;
  description: string;
  transaction_type?: string;
  direction: "DEBIT" | "CREDIT";
  amount_inr: number;
  status: string;
  date: string;
  metadata?: Record<string, unknown>;
  ledger_account?: "CASH" | "BOND_PORTFOLIO";
  ledger_entry_id?: string;
};

const TYPE_LABELS: Record<string, string> = {
  WELCOME_BONUS: "Welcome Bonus",
  P2P_TRANSFER: "P2P Transfer",
  MOBILE_RECHARGE: "Mobile Recharge",
  DTH_RECHARGE: "DTH Recharge",
  FASTAG_RECHARGE: "FASTag Recharge",
  ELECTRICITY_BILL_PAYMENT: "Electricity Bill",
  UTILITY_PAYMENT: "Utility Payment",
  BOND_PURCHASE: "Bond Purchase",
  BOND_TRANSFER: "Bond Transfer",
  BOND_REDEMPTION: "Bond sale / redemption",
  BOND_MATURITY_SETTLEMENT: "Maturity Settlement",
  GENERIC: "Generic",
};

const METADATA_LABELS: Record<string, string> = {
  operator: "Operator",
  mobileNumber: "Mobile Number",
  type: "Plan Type",
  provider: "Provider",
  dthNumber: "Subscriber ID",
  bank: "Issuing Bank",
  vehicleNumber: "Vehicle Number",
  state: "State",
  board: "Electricity Board",
  consumerNumber: "Consumer Number",
  recipient_mobile: "Recipient Mobile",
  amount_paise: "Amount (Paise)",
  target_type: "Target Type",
  bond_id: "Bond ID",
  bond_name: "Bond",
  holding_id: "Holding ID",
  principal_paise: "Principal",
  interest_paise: "Interest",
  payout_total_paise: "Total payout",
  units: "Units",
  accrued_interest_credited_paise: "Accrued interest (credited to sender)",
};

const METADATA_ORDER: Record<string, string[]> = {
  MOBILE_RECHARGE: ["operator", "mobileNumber", "type"],
  DTH_RECHARGE: ["provider", "dthNumber"],
  FASTAG_RECHARGE: ["bank", "vehicleNumber"],
  ELECTRICITY_BILL_PAYMENT: ["state", "board", "consumerNumber"],
  P2P_TRANSFER: [
    "sender_mobile",
    "recipient_mobile",
    "sender_user_id",
    "recipient_user_id",
    "amount_paise",
  ],
  BOND_PURCHASE: ["bond_name", "bond_id", "units", "amount_paise"],
  BOND_REDEMPTION: ["bond_name", "bond_id", "holding_id", "principal_paise", "interest_paise", "payout_total_paise"],
  BOND_TRANSFER: [
    "recipient_mobile",
    "amount_paise",
    "accrued_interest_credited_paise",
    "recipient_holding_id",
    "bond_id",
  ],
};

function formatMetadataScalar(key: string, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (key.endsWith("_paise")) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) {
      return `₹${(n / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }
  return String(raw);
}

export function formatTransactionType(type?: string): string {
  if (!type) return "Generic";
  return TYPE_LABELS[type] || type.replace(/_/g, " ");
}

export function getMetadataRows(
  targetType: string | undefined,
  metadata: Record<string, unknown> | undefined
): Array<{ key: string; label: string; value: string }> {
  if (!metadata) return [];
  const keys = Object.keys(metadata);
  if (keys.length === 0) return [];

  const orderedKeys = METADATA_ORDER[targetType || ""] || keys;
  const remaining = keys.filter((k) => !orderedKeys.includes(k));
  const finalKeys = [...orderedKeys.filter((k) => keys.includes(k)), ...remaining];

  return finalKeys.map((key) => ({
    key,
    label: METADATA_LABELS[key] || key.replace(/([A-Z])/g, " $1").trim(),
    value: formatMetadataScalar(key, metadata[key]),
  }));
}

