"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Verified, TrendingUp, PiggyBank, RefreshCw, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { parseApiError } from "@/lib/api";

type Recommendation = {
    recommendation_id: string;
    policy_version: string;
    bond: {
        id: string;
        name: string;
        apy: number;
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
    principal_inr: number;
    accrued_interest_inr: number;
    apy: number;
    fraction_ticking: number;
    status: string;
    purchased_at: string;
};

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [amount, setAmount] = useState("");
    const [loadingTx, setLoadingTx] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [txMsg, setTxMsg] = useState({ text: "", type: "" });
    const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
    const [recommendationAudit, setRecommendationAudit] = useState<RecommendationAudit | null>(null);
    const [loadingRecommendation, setLoadingRecommendation] = useState(false);
    const [loadingAudit, setLoadingAudit] = useState(false);
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

    const fetchPortfolio = async (silent = false) => {
        if (!session?.user?.api_token) return;
        if (silent) setIsRefreshing(true);
        try {
            const res = await fetch(`${apiBase}/bonds/portfolio`, {
                headers: { "Authorization": `Bearer ${session.user.api_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHoldings(data.holdings);
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto refresh every second to watch interest tick live!
    useEffect(() => {
        if (status === "authenticated") fetchPortfolio();
        const interval = setInterval(() => {
             if (status === "authenticated") fetchPortfolio(true);
        }, 1000);
        return () => clearInterval(interval);
    }, [status, session]);

    const handleBuy = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingTx(true);
        setTxMsg({ text: "", type: "" });
        try {
            const res = await fetch(`${apiBase}/bonds/buy`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session!.user.api_token}` 
                },
                body: JSON.stringify({ amount_paise: Math.floor(parseFloat(amount) * 100) })
            });
            const data = await res.json();
            if (res.ok) {
                setTxMsg({ text: data.message, type: "success" });
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
        const parsedAmount = Math.floor(parseFloat(amount) * 100);
        if (!parsedAmount || parsedAmount <= 0) {
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
                    "Authorization": `Bearer ${session!.user.api_token}`
                },
                body: JSON.stringify({ amount_paise: parsedAmount })
            });
            const data = await res.json();
            if (res.ok) {
                setRecommendation(data);
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
                headers: { "Authorization": `Bearer ${session!.user.api_token}` }
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

    if (status === "loading") return <div className="flex justify-center py-40"><Loader2 className="animate-spin text-[#00baf2]" size={40}/></div>;
    if (status === "unauthenticated") return <div className="py-40 text-center font-bold">Please sign in to access Treasury Portfolio.</div>;

    return (
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6">
            
            {/* Header Profiler */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-[#002970] text-white rounded-full flex justify-center items-center font-bold text-2xl shadow-md">
                        {session?.user?.business_name?.charAt(0) || session?.user?.mobile_number?.charAt(0)}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                           {session?.user?.business_name || "MSME Merchant"} <Verified className="text-[#00baf2]" size={20} />
                        </h1>
                        <p className="text-gray-500 font-medium">+91 {session?.user?.mobile_number}</p>
                    </div>
                </div>
                <Link href="/payments" className="bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors font-bold px-6 py-3 rounded-full text-[#002970]">
                    View Cash Wallet
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Buy Bond Interfacer */}
                <div className="lg:col-span-1">
                    <form onSubmit={handleBuy} className="bg-gradient-to-br from-[#002970] to-[#001740] rounded-3xl p-8 shadow-xl text-white relative overflow-hidden mb-6">
                         <div className="absolute top-[-10%] right-[-10%] opacity-10 pointer-events-none text-[#00baf2]">
                            <TrendingUp size={200} />
                         </div>
                         <h2 className="text-xl font-bold mb-2 relative z-10 flex items-center gap-2 text-[#00baf2]">
                             <PiggyBank size={20} /> Allocate to Treasury
                         </h2>
                         <p className="text-white/80 text-sm font-medium mb-6 relative z-10">Automatically procure fractional optimal yield bonds directly from your cash wallet.</p>
                         
                         {txMsg.text && (
                             <div className={`p-3 rounded-xl mb-6 text-sm font-bold relative z-10 ${txMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                                 {txMsg.text}
                             </div>
                         )}

                         <div className="relative z-10 mb-6">
                            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Investment Principal (₹)</label>
                            <input 
                                type="number" 
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00" 
                                step="0.01"
                                min="1"
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#00baf2] outline-none font-bold text-xl text-white placeholder:text-white/30 transition-all"
                                required
                            />
                         </div>
                         <button 
                            type="submit" 
                            disabled={loadingTx || !amount}
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
                            {loadingRecommendation ? "Generating..." : "Get Bond Recommendation"}
                         </button>
                    </form>

                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
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
                                        APY {recommendation.bond.apy}% • Safety {recommendation.bond.safety_score} • Liquidity {recommendation.bond.liquidity_score}
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
                                    {loadingAudit ? "Loading Audit..." : "View Audit Trail"}
                                </button>
                                {recommendationAudit && (
                                    <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 text-xs text-gray-700 space-y-1">
                                        <p><span className="font-semibold">Policy:</span> {recommendationAudit.policy_version}</p>
                                        <p><span className="font-semibold">Recommended ID:</span> {recommendationAudit.recommendation_id}</p>
                                        <p><span className="font-semibold">Audit Time:</span> {new Date(recommendationAudit.created_at).toLocaleString()}</p>
                                        <p className="pt-1"><span className="font-semibold">Decision:</span> {String(recommendationAudit.decision_snapshot?.selected_bond_name || "N/A")}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Portfolio Tracker */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 min-h-full">
                         <div className="flex justify-between items-center mb-8 border-b border-gray-50 pb-6">
                             <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                 <div className="bg-emerald-50 text-emerald-500 p-2.5 rounded-xl"><TrendingUp size={24} /></div>
                                 Active Bond Portfolio
                             </h2>
                             <div className={`p-2 rounded-full ${isRefreshing ? 'bg-gray-100 text-[#00baf2]' : 'text-gray-300'}`}>
                                 <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                             </div>
                         </div>

                         {holdings.length === 0 ? (
                             <div className="text-center py-20 text-gray-400 font-bold border-2 border-dashed border-gray-100 rounded-2xl">No treasury bonds procured. Initialize allocation.</div>
                         ) : (
                             <div className="space-y-4">
                                 {holdings.map((h) => (
                                     <div key={h.id} className="border border-gray-100 rounded-2xl p-5 hover:border-[#00baf2]/30 transition-colors bg-gray-50/30">
                                         <div className="flex justify-between items-start mb-4">
                                             <div>
                                                 <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                    {h.bond_name} <span className="bg-[#f0fbff] text-[#00baf2] px-2 py-0.5 rounded text-xs font-black">{h.apy}% APY</span>
                                                 </h3>
                                                 <p className="text-xs text-gray-400 mt-1 font-medium">Acquired: {new Date(h.purchased_at).toLocaleString()}</p>
                                             </div>
                                             <span className={`px-2.5 py-1 rounded-md text-xs font-black tracking-widest ${h.status.includes('ACTIVE') ? 'bg-[#002970] text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                                                 {h.status}
                                             </span>
                                         </div>
                                         
                                         <div className="grid grid-cols-2 gap-4">
                                             <div className="bg-white p-3 rounded-xl border border-gray-100">
                                                 <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-widest">Principal</p>
                                                 <p className="font-black text-gray-900">₹{h.principal_inr.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
                                             </div>
                                             <div className="bg-[#002970] p-3 rounded-xl shadow-inner relative overflow-hidden">
                                                 <div className="absolute right-0 top-0 h-full bg-[#00baf2]/20 transition-all duration-1000 ease-linear" style={{ width: `${(h.fraction_ticking * 100)}%` }}></div>
                                                 <p className="text-xs text-[#00baf2] font-semibold mb-1 uppercase tracking-widest relative z-10">Live Interest Accrued</p>
                                                 <p className="font-black text-emerald-400 relative z-10">₹{h.accrued_interest_inr.toLocaleString('en-IN', {minimumFractionDigits: 4})}</p>
                                             </div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
}
