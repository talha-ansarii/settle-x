"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Verified,
  TrendingUp,
  PiggyBank,
  RefreshCw,
  Loader2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  SendHorizontal,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { parseApiError } from "@/lib/api";
import PinModal from "../components/PinModal";

type CatalogBond = {
  id: string;
  name: string;
  isin: string;
  credit_rating: string;
  ytm_rate: number;
  apy_rate: number;
  maturity_seconds: number;
  face_value_inr: number;
};

type Recommendation = {
  recommendation_id: string;
  policy_version: string;
  bond: {
    id: string;
    name: string;
    apy: number;
    ytm?: number;
    isin?: string;
    credit_rating?: string;
    maturity_seconds: number;
    safety_score: number;
    liquidity_score: number;
    risk_tier: string;
    ranking_score: number;
  };
  allocation_inr: number;
  rationale: string[];
};

type RecommendationAudit = {
  recommendation_id: string;
  policy_version: string;
  input_snapshot: Record<string, unknown>;
  candidate_snapshot: Record<string, unknown>;
  decision_snapshot: Record<string, unknown>;
  created_at: string;
};

type Holding = {
  id: string;
  bond_name: string;
  isin: string;
  ytm_rate: number;
  credit_rating: string;
  units: number;
  principal_inr: number;
  accrued_interest_inr: number;
  apy: number;
  fraction_ticking: number;
  status: string;
  purchased_at: string;
  maturity_at: string;
};

type HoldingDetail = {
  summary: {
    total_investment_inr: number;
    paid_interest_inr: number;
    accrued_interest_inr: number;
    current_value_inr: number;
    gain_inr: number;
  };
  investment: {
    holding_id: string;
    bond_id: string;
    bond_name: string;
    isin: string;
    credit_rating: string;
    ytm_rate: number;
    apy_rate: number;
    units: number;
    principal_inr: number;
    acquired_at: string;
    maturity_at: string;
    origin_holding_id: string | null;
    status: string;
  };
};

type TransferReceipt = {
  transaction_id: string;
  posted_at: string;
  bond: { name: string; isin: string; ytm_rate: number; credit_rating: string };
  principal_inr: number;
  units: number | null;
  sender_mobile_masked: string;
  recipient_mobile_masked: string;
  kind: string;
};

type PortfolioSummary = {
  total_principal_inr: number;
  total_accrued_interest_inr: number;
  total_position_value_inr: number;
  active_holdings_count: number;
};

export default function TreasuryPage() {
  const { data: session, status } = useSession();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [catalog, setCatalog] = useState<CatalogBond[]>([]);
  const [selectedBondId, setSelectedBondId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [loadingTx, setLoadingTx] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [txMsg, setTxMsg] = useState({ text: "", type: "" });
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommendationAudit, setRecommendationAudit] = useState<RecommendationAudit | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [expandedHoldingId, setExpandedHoldingId] = useState<string | null>(null);
  const [holdingDetail, setHoldingDetail] = useState<HoldingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [transferHoldingId, setTransferHoldingId] = useState<string | null>(null);
  const [transferMobile, setTransferMobile] = useState("");
  const [transferPin, setTransferPin] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [lastTransferTxId, setLastTransferTxId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    total_principal_inr: 0,
    total_accrued_interest_inr: 0,
    total_position_value_inr: 0,
    active_holdings_count: 0,
  });
  const [sellHoldingId, setSellHoldingId] = useState<string | null>(null);
  const [sellLoading, setSellLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

  const fetchPortfolio = async (silent = false) => {
    if (!session?.user?.api_token) return;
    if (silent) setIsRefreshing(true);
    try {
      const res = await fetch(`${apiBase}/bonds/portfolio`, {
        headers: { Authorization: `Bearer ${session.user.api_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHoldings(data.holdings || []);
        const s = data.summary;
        if (s && typeof s.total_position_value_inr === "number") {
          setPortfolioSummary({
            total_principal_inr: s.total_principal_inr ?? 0,
            total_accrued_interest_inr: s.total_accrued_interest_inr ?? 0,
            total_position_value_inr: s.total_position_value_inr ?? 0,
            active_holdings_count: s.active_holdings_count ?? 0,
          });
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchCatalog = async () => {
    if (!session?.user?.api_token) return;
    try {
      const res = await fetch(`${apiBase}/bonds/catalog`, {
        headers: { Authorization: `Bearer ${session.user.api_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.bonds || []);
        if (data.bonds?.length && !selectedBondId) {
          setSelectedBondId(data.bonds[0].id);
        }
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchPortfolio();
      fetchCatalog();
    }
    const interval = setInterval(() => {
      if (status === "authenticated") fetchPortfolio(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [status, session?.user?.api_token]);

  useEffect(() => {
    if (!expandedHoldingId || !session?.user?.api_token) {
      setHoldingDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    fetch(`${apiBase}/bonds/holdings/${expandedHoldingId}/detail`, {
      headers: { Authorization: `Bearer ${session.user.api_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setHoldingDetail(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expandedHoldingId, session?.user?.api_token, apiBase]);

  const loadReceipt = async (transactionId: string) => {
    if (!session?.user?.api_token) return;
    setReceiptLoading(true);
    setReceipt(null);
    try {
      const res = await fetch(`${apiBase}/bonds/transfers/${transactionId}/receipt`, {
        headers: { Authorization: `Bearer ${session.user.api_token}` },
      });
      const data = await res.json();
      if (res.ok) setReceipt(data);
      else setTxMsg({ text: parseApiError(data, "Could not load receipt."), type: "error" });
    } catch {
      setTxMsg({ text: "Receipt request failed.", type: "error" });
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleBuy = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingTx(true);
    setTxMsg({ text: "", type: "" });
    try {
      const num = Number(amount.replace(/,/g, "").trim());
      const paise = Math.round(num * 100);
      if (!Number.isFinite(paise) || paise <= 0) {
        setTxMsg({ text: "Enter a valid amount in rupees.", type: "error" });
        setLoadingTx(false);
        return;
      }
      const body: { amount_paise: number; bond_id?: string } = {
        amount_paise: paise,
      };
      if (selectedBondId) body.bond_id = selectedBondId;
      const res = await fetch(`${apiBase}/bonds/buy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.user.api_token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setTxMsg({ text: data.message || "Purchase complete.", type: "success" });
        setAmount("");
        fetchPortfolio(true);
      } else {
        setTxMsg({ text: parseApiError(data, "Transaction failed."), type: "error" });
      }
    } catch {
      setTxMsg({ text: "Network synchronization failed.", type: "error" });
    } finally {
      setLoadingTx(false);
    }
  };

  const handleRecommend = async () => {
    const parsedAmount = Math.round(Number(amount.replace(/,/g, "").trim()) * 100);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setTxMsg({ text: "Enter an amount to get recommendation.", type: "error" });
      return;
    }
    setLoadingRecommendation(true);
    setRecommendationAudit(null);
    setTxMsg({ text: "", type: "" });
    try {
      const res = await fetch(`${apiBase}/bonds/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.user.api_token}`,
        },
        body: JSON.stringify({ amount_paise: parsedAmount }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecommendation(data);
        if (data.bond?.id) setSelectedBondId(data.bond.id);
        setTxMsg({ text: "Safety-first recommendation generated.", type: "success" });
      } else {
        setTxMsg({ text: parseApiError(data, "Failed to generate recommendation."), type: "error" });
      }
    } catch {
      setTxMsg({ text: "Recommendation service unavailable.", type: "error" });
    } finally {
      setLoadingRecommendation(false);
    }
  };

  const handleLoadAudit = async () => {
    if (!recommendation?.recommendation_id) return;
    setLoadingAudit(true);
    try {
      const res = await fetch(`${apiBase}/bonds/recommend/${recommendation.recommendation_id}/audit`, {
        headers: { Authorization: `Bearer ${session!.user.api_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRecommendationAudit(data);
      } else {
        setTxMsg({ text: parseApiError(data, "Failed to load recommendation audit."), type: "error" });
      }
    } catch {
      setTxMsg({ text: "Failed to load recommendation audit.", type: "error" });
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleOffMarketTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferHoldingId || !session?.user?.api_token) return;
    setTransferLoading(true);
    setTxMsg({ text: "", type: "" });
    try {
      const res = await fetch(`${apiBase}/bonds/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.api_token}`,
        },
        body: JSON.stringify({
          holding_id: transferHoldingId,
          recipient_mobile: transferMobile.replace(/\s/g, ""),
          pin: transferPin,
          idempotency_key: `omt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTxMsg({ text: data.message || "Transfer complete.", type: "success" });
        setLastTransferTxId(data.transaction_id);
        setTransferPin("");
        setTransferMobile("");
        setTransferHoldingId(null);
        fetchPortfolio(true);
        if (data.transaction_id) loadReceipt(data.transaction_id);
      } else {
        setTxMsg({ text: parseApiError(data, "Transfer failed."), type: "error" });
      }
    } catch {
      setTxMsg({ text: "Transfer request failed.", type: "error" });
    } finally {
      setTransferLoading(false);
    }
  };

  const handleSellConfirm = async (pin: string) => {
    if (!sellHoldingId || !session?.user?.api_token) return;
    setSellLoading(true);
    setTxMsg({ text: "", type: "" });
    try {
      const res = await fetch(`${apiBase}/bonds/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.api_token}`,
        },
        body: JSON.stringify({
          holding_id: sellHoldingId,
          pin,
          idempotency_key: `redeem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTxMsg({
          text: data.message || "Sale complete. Open History to see cash and bond legs.",
          type: "success",
        });
        setSellHoldingId(null);
        fetchPortfolio(true);
      } else {
        setTxMsg({ text: parseApiError(data, "Sale failed."), type: "error" });
      }
    } catch {
      setTxMsg({ text: "Network error.", type: "error" });
    } finally {
      setSellLoading(false);
    }
  };

  if (status === "loading")
    return (
      <div className="flex justify-center py-40">
        <Loader2 className="animate-spin text-[#00baf2]" size={40} />
      </div>
    );
  if (status === "unauthenticated")
    return <div className="py-40 text-center font-bold">Please sign in to access Treasury Portfolio.</div>;

  const selectedFv = catalog.find((b) => b.id === selectedBondId)?.face_value_inr;

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-[#002970] text-white rounded-full flex justify-center items-center font-bold text-2xl shadow-md">
            {session?.user?.business_name?.charAt(0) || session?.user?.mobile_number?.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              {session?.user?.business_name || "MSME Merchant"}{" "}
              <Verified className="text-[#00baf2]" size={20} />
            </h1>
            <p className="text-gray-500 font-medium">+91 {session?.user?.mobile_number}</p>
          </div>
        </div>
        <Link
          href="/payments"
          className="bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors font-bold px-6 py-3 rounded-full text-[#002970]"
        >
          Payments & available balance
        </Link>
      </div>

      <div className="mb-8 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/90 to-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-900/70">Total bond holdings value</p>
        <p className="mt-1 text-3xl font-black text-gray-900 tabular-nums">
          ₹
          {portfolioSummary.total_position_value_inr.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })}
        </p>
        <p className="mt-2 text-sm text-gray-600 font-medium">
          Principal ₹
          {portfolioSummary.total_principal_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })} · Accrued ₹
          {portfolioSummary.total_accrued_interest_inr.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })}{" "}
          · {portfolioSummary.active_holdings_count} active holding
          {portfolioSummary.active_holdings_count === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form
            onSubmit={handleBuy}
            className="bg-gradient-to-br from-[#002970] to-[#001740] rounded-3xl p-8 shadow-xl text-white relative overflow-hidden mb-6"
          >
            <div className="absolute top-[-10%] right-[-10%] opacity-10 pointer-events-none text-[#00baf2]">
              <TrendingUp size={200} />
            </div>
            <h2 className="text-xl font-bold mb-2 relative z-10 flex items-center gap-2 text-[#00baf2]">
              <PiggyBank size={20} /> Allocate to Treasury
            </h2>
            <p className="text-white/80 text-sm font-medium mb-6 relative z-10">
              Choose a bond from the catalog. Amount must be a whole number of face-value units (off-market
              simulation).
            </p>

            {txMsg.text && (
              <div
                className={`p-3 rounded-xl mb-6 text-sm font-bold relative z-10 ${
                  txMsg.type === "success" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                }`}
              >
                {txMsg.text}
              </div>
            )}

            <div className="relative z-10 mb-4">
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">
                Bond (catalog)
              </label>
              <select
                value={selectedBondId}
                onChange={(e) => setSelectedBondId(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 font-semibold text-white outline-none focus:ring-2 focus:ring-[#00baf2]"
              >
                {catalog.length === 0 ? (
                  <option value="">Loading bonds…</option>
                ) : (
                  catalog.map((b) => (
                    <option key={b.id} value={b.id} className="text-gray-900">
                      {b.name} · YTM {b.ytm_rate}% · {b.isin}
                    </option>
                  ))
                )}
              </select>
              {selectedFv != null && (
                <p className="text-xs text-white/50 mt-2">Face value per unit: ₹{selectedFv.toFixed(2)}</p>
              )}
            </div>

            <div className="relative z-10 mb-6">
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">
                Investment Principal (₹)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="1"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#00baf2] outline-none font-bold text-xl text-white placeholder:text-white/30 transition-all"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loadingTx || !amount || !selectedBondId}
              className="relative z-10 w-full bg-[#00baf2] hover:bg-[#00a3d4] text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 shadow-lg shadow-[#00baf2]/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loadingTx ? <Loader2 className="animate-spin" /> : "Purchase Bond"}
            </button>
            <button
              type="button"
              onClick={handleRecommend}
              disabled={loadingRecommendation}
              className="relative z-10 mt-3 w-full bg-white/15 hover:bg-white/20 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 border border-white/20 transition-all disabled:opacity-50"
            >
              {loadingRecommendation ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
              {loadingRecommendation ? "Generating…" : "Get Bond Recommendation"}
            </button>
          </form>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Bond Intelligence (v1)</h3>
            {!recommendation ? (
              <p className="text-sm text-gray-500">
                Generate a safety-first recommendation to see policy-compliant bond selection with auditability.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-sm font-bold text-gray-900">{recommendation.bond.name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    ISIN {recommendation.bond.isin ?? "—"} · YTM {recommendation.bond.ytm ?? "—"}% · APY{" "}
                    {recommendation.bond.apy}% · {recommendation.bond.credit_rating ?? ""}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Risk Tier: {recommendation.bond.risk_tier}</p>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  {recommendation.rationale.map((r) => (
                    <p key={r}>• {r}</p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleLoadAudit}
                  disabled={loadingAudit}
                  className="w-full bg-[#002970] hover:bg-blue-900 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50"
                >
                  {loadingAudit ? "Loading Audit…" : "View Audit Trail"}
                </button>
                {recommendationAudit && (
                  <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 text-xs text-gray-700 space-y-1">
                    <p>
                      <span className="font-semibold">Policy:</span> {recommendationAudit.policy_version}
                    </p>
                    <p>
                      <span className="font-semibold">Recommended ID:</span> {recommendationAudit.recommendation_id}
                    </p>
                    <p>
                      <span className="font-semibold">Audit Time:</span>{" "}
                      {new Date(recommendationAudit.created_at).toLocaleString()}
                    </p>
                    <p className="pt-1">
                      <span className="font-semibold">Decision:</span>{" "}
                      {String(recommendationAudit.decision_snapshot?.selected_bond_name || "N/A")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {(lastTransferTxId || receiptLoading) && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Receipt size={18} /> Transfer receipt (counterparty)
              </h3>
              {receiptLoading && (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="animate-spin size-4" /> Loading…
                </p>
              )}
              {receipt && !receiptLoading && (
                <div className="text-sm text-gray-700 space-y-2">
                  <p>
                    <span className="font-semibold">Txn:</span> {receipt.transaction_id}
                  </p>
                  <p>
                    {receipt.bond.name} · {receipt.bond.isin} · YTM {receipt.bond.ytm_rate}%
                  </p>
                  <p>
                    Principal ₹{receipt.principal_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })} · Units{" "}
                    {receipt.units ?? "—"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {receipt.sender_mobile_masked} → {receipt.recipient_mobile_masked}
                  </p>
                </div>
              )}
              {lastTransferTxId && !receipt && !receiptLoading && (
                <button
                  type="button"
                  onClick={() => loadReceipt(lastTransferTxId)}
                  className="text-sm font-semibold text-[#002970]"
                >
                  Load receipt
                </button>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 min-h-full">
            <div className="flex justify-between items-center mb-8 border-b border-gray-50 pb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="bg-emerald-50 text-emerald-500 p-2.5 rounded-xl">
                  <TrendingUp size={24} />
                </div>
                Active Bond Portfolio
              </h2>
              <div className={`p-2 rounded-full ${isRefreshing ? "bg-gray-100 text-[#00baf2]" : "text-gray-300"}`}>
                <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
              </div>
            </div>

            {holdings.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-bold border-2 border-dashed border-gray-100 rounded-2xl">
                No treasury bonds procured. Initialize allocation.
              </div>
            ) : (
              <div className="space-y-4">
                {holdings.map((h) => (
                  <div key={h.id}>
                    <div className="border border-gray-100 rounded-2xl p-5 hover:border-[#00baf2]/30 transition-colors bg-gray-50/30">
                      <div className="flex justify-between items-start mb-4 gap-2 flex-wrap">
                        <div>
                          <h3 className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                            {h.bond_name}{" "}
                            <span className="bg-[#f0fbff] text-[#00baf2] px-2 py-0.5 rounded text-xs font-black">
                              {h.apy}% APY
                            </span>
                            <span className="text-xs font-semibold text-gray-500">YTM {h.ytm_rate}%</span>
                          </h3>
                          <p className="text-xs text-gray-500 mt-1 font-medium">
                            {h.isin} · {h.credit_rating} · {h.units} units
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Acquired: {new Date(h.purchased_at).toLocaleString()} · Maturity:{" "}
                            {new Date(h.maturity_at).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-black tracking-widest shrink-0 ${
                            h.status.includes("ACTIVE")
                              ? "bg-[#002970] text-emerald-400"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {h.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                          <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-widest">
                            Principal
                          </p>
                          <p className="font-black text-gray-900">
                            ₹{h.principal_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="bg-[#002970] p-3 rounded-xl shadow-inner relative overflow-hidden">
                          <div
                            className="absolute right-0 top-0 h-full bg-[#00baf2]/20 transition-all duration-1000 ease-linear"
                            style={{ width: `${h.fraction_ticking * 100}%` }}
                          />
                          <p className="text-xs text-[#00baf2] font-semibold mb-1 uppercase tracking-widest relative z-10">
                            Live Interest Accrued
                          </p>
                          <p className="font-black text-emerald-400 relative z-10">
                            ₹{h.accrued_interest_inr.toLocaleString("en-IN", { minimumFractionDigits: 4 })}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedHoldingId(expandedHoldingId === h.id ? null : h.id)
                          }
                          className="text-sm font-bold text-[#002970] flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                        >
                          {expandedHoldingId === h.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          Investment detail
                        </button>
                        {h.status === "ACTIVE" && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setTransferHoldingId(h.id);
                                setTransferPin("");
                                setTxMsg({ text: "", type: "" });
                              }}
                              className="text-sm font-bold text-white bg-[#002970] flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-blue-900"
                            >
                              <SendHorizontal size={16} />
                              Off-market transfer (simulated)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSellHoldingId(h.id);
                                setTxMsg({ text: "", type: "" });
                              }}
                              className="text-sm font-bold text-[#002970] bg-white border border-[#002970] flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-50"
                            >
                              Sell for cash
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {expandedHoldingId === h.id && (
                      <div className="mt-2 ml-2 border-l-2 border-[#00baf2] pl-4 py-3 text-sm text-gray-700">
                        {loadingDetail && (
                          <p className="flex items-center gap-2 text-gray-500">
                            <Loader2 className="animate-spin size-4" /> Loading detail…
                          </p>
                        )}
                        {holdingDetail && holdingDetail.investment.holding_id === h.id && (
                          <div className="space-y-3">
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-xs font-bold text-gray-500 uppercase">Summary</p>
                                <ul className="mt-2 space-y-1 text-xs">
                                  <li>Total investment: ₹{holdingDetail.summary.total_investment_inr.toFixed(2)}</li>
                                  <li>Paid interest: ₹{holdingDetail.summary.paid_interest_inr.toFixed(2)}</li>
                                  <li>Accrued: ₹{holdingDetail.summary.accrued_interest_inr.toFixed(4)}</li>
                                  <li>Current value: ₹{holdingDetail.summary.current_value_inr.toFixed(4)}</li>
                                  <li>Gain: ₹{holdingDetail.summary.gain_inr.toFixed(4)}</li>
                                </ul>
                              </div>
                              <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-xs font-bold text-gray-500 uppercase">Identifiers</p>
                                <ul className="mt-2 space-y-1 text-xs">
                                  <li>ISIN: {holdingDetail.investment.isin}</li>
                                  <li>Rating: {holdingDetail.investment.credit_rating}</li>
                                  <li>Units: {holdingDetail.investment.units}</li>
                                  <li>Origin holding: {holdingDetail.investment.origin_holding_id ?? "—"}</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <PinModal
        isOpen={!!sellHoldingId}
        onClose={() => {
          if (!sellLoading) setSellHoldingId(null);
        }}
        onConfirm={handleSellConfirm}
        loading={sellLoading}
        title="Confirm sale — enter PIN"
      />

      {transferHoldingId && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Off-market transfer (simulated)</h3>
            <p className="text-xs text-gray-500 mb-4">
              Same bond position moves to another SettleX user. Requires your transaction PIN.
            </p>
            <form onSubmit={handleOffMarketTransfer} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Recipient mobile</label>
                <input
                  type="tel"
                  value={transferMobile}
                  onChange={(e) => setTransferMobile(e.target.value)}
                  placeholder="10-digit mobile"
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 font-medium"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Transaction PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={transferPin}
                  onChange={(e) => setTransferPin(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 font-medium"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setTransferHoldingId(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 font-semibold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="px-4 py-2 rounded-xl bg-[#00baf2] text-white font-bold disabled:opacity-50"
                >
                  {transferLoading ? <Loader2 className="animate-spin" size={18} /> : "Confirm transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
