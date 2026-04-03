"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { History, ArrowDownLeft, ArrowUpRight, Loader2, Landmark } from "lucide-react";
import Link from "next/link";
import { formatTransactionType, getMetadataRows, type TransactionRecord } from "@/lib/transactionTypes";

export default function HistoryPage() {
    const { data: session, status } = useSession();
    const [txs, setTxs] = useState<TransactionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState("ALL");

    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

    useEffect(() => {
        if (status !== "authenticated") return;
        fetch(`${apiBase}/payments/transactions`, {
            headers: { "Authorization": `Bearer ${session?.user?.api_token}` }
        })
        .then(r => r.json())
        .then(data => { setTxs(data.transactions); setLoading(false); })
        .catch(e => { console.error(e); setLoading(false); });
    }, [status, session]);

    if (status === "loading" || loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[#00baf2]" size={40}/></div>;

    const availableTypes = Array.from(new Set(txs.map(tx => tx.transaction_type || "GENERIC")));
    const visibleTxs =
      typeFilter === "ALL"
        ? txs
        : txs.filter((tx) => (tx.transaction_type || "GENERIC") === typeFilter);

    const sortedVisible = [...visibleTxs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const groupOrder: string[] = [];
    const groups = new Map<string, TransactionRecord[]>();
    for (const tx of sortedVisible) {
      if (!groups.has(tx.id)) {
        groupOrder.push(tx.id);
        groups.set(tx.id, []);
      }
      groups.get(tx.id)!.push(tx);
    }
    const legRank = (a: TransactionRecord) => (a.ledger_account === "BOND_PORTFOLIO" ? 1 : 0);

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                   <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                       <div className="bg-[#002970] text-white p-2.5 rounded-xl"><History size={26} /></div> 
                       Ledger History
                   </h1>
                   <p className="text-gray-500 font-medium mt-2">Immutable double-entry log — cash and bond portfolio legs</p>
                </div>
                <Link href="/payments" className="bg-[#f0fbff] text-[#00baf2] hover:bg-[#dff5ff] transition-colors font-bold px-6 py-3 rounded-full flex items-center gap-2">
                    <Landmark size={18}/> Available balance
                </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Filter by Transaction Type</label>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full sm:w-80 border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-[#00baf2] outline-none"
                >
                    <option value="ALL">All Types</option>
                    {availableTypes.map((type) => (
                        <option key={type} value={type}>
                            {formatTransactionType(type)}
                        </option>
                    ))}
                </select>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                {groupOrder.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 font-bold border-gray-100">No transaction records found inside the ledger.</div>
                ) : (
                    <div>
                        {groupOrder.map((gid, gi) => {
                            const legs = (groups.get(gid) || []).slice().sort((a, b) => legRank(a) - legRank(b));
                            const head = legs[0];
                            if (!head) return null;
                            return (
                                <div
                                    key={gid}
                                    className={`p-6 ${gi !== groupOrder.length - 1 ? "border-b border-gray-100" : ""} hover:bg-gray-50 transition-colors`}
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex items-start gap-5 min-w-0">
                                            <div className="p-3 rounded-2xl shadow-sm bg-slate-100 text-slate-600 shrink-0">
                                                <History size={22} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 text-lg mb-0.5">{head.description}</p>
                                                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                                    <span>{new Date(head.date).toLocaleString()}</span>
                                                    <span>•</span>
                                                    <span
                                                        className={`px-2 py-0.5 rounded ${
                                                            head.status === "COMPLETED"
                                                                ? "bg-emerald-100 text-emerald-700"
                                                                : "bg-gray-200 text-gray-600"
                                                        }`}
                                                    >
                                                        {head.status}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="px-2 py-0.5 rounded bg-blue-50 text-[#007aa3]">
                                                        {formatTransactionType(head.transaction_type || "GENERIC")}
                                                    </span>
                                                </div>
                                                {head.transaction_type === "P2P_TRANSFER" && head.metadata && (
                                                    <p className="text-xs text-gray-600 font-medium mt-2 normal-case tracking-normal">
                                                        {head.direction === "CREDIT"
                                                            ? <>To +91 {String(head.metadata.recipient_mobile ?? "")}</>
                                                            : <>From +91 {String(head.metadata.sender_mobile ?? "")}</>}
                                                    </p>
                                                )}
                                                {head.metadata &&
                                                    head.transaction_type &&
                                                    head.transaction_type !== "P2P_TRANSFER" && (
                                                        <ul className="mt-2 text-xs text-gray-500 space-y-0.5 normal-case tracking-normal">
                                                            {getMetadataRows(head.transaction_type, head.metadata)
                                                                .slice(0, 6)
                                                                .map((row) => (
                                                                    <li key={row.key}>
                                                                        <span className="font-semibold text-gray-600">{row.label}:</span>{" "}
                                                                        {row.value}
                                                                    </li>
                                                                ))}
                                                        </ul>
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-3 pl-0 sm:pl-[4.25rem]">
                                        {legs.map((tx) => {
                                            const isReceived = tx.direction === "DEBIT";
                                            const acct = tx.ledger_account === "BOND_PORTFOLIO" ? "Bonds" : "Cash";
                                            const rowKey = tx.ledger_entry_id || `${tx.id}-${acct}-${tx.direction}-${tx.amount_inr}`;
                                            return (
                                                <div
                                                    key={rowKey}
                                                    className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white/80 px-4 py-3"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div
                                                            className={`p-2 rounded-xl shrink-0 ${
                                                                isReceived
                                                                    ? "bg-emerald-50 text-emerald-600"
                                                                    : "bg-rose-50 text-rose-600"
                                                            }`}
                                                        >
                                                            {isReceived ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-800">{acct} leg</p>
                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                                                {tx.direction} · {acct.toUpperCase()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <p
                                                        className={`font-black text-lg shrink-0 ${isReceived ? "text-emerald-500" : "text-gray-900"}`}
                                                    >
                                                        {isReceived ? "+" : "-"}₹
                                                        {tx.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
