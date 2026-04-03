"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, Landmark, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { parseApiError } from "@/lib/api";

type EventAccount = { name: string; type: string; balance_inr: number };
type ReconRun = {
  run_id: string;
  provider: string;
  status: string;
  total_records: number;
  matched_records: number;
  mismatched_records: number;
  started_at: string;
  completed_at: string | null;
};
type ReconMismatch = {
  id: string;
  run_id: string;
  provider_order_id: string;
  local_status: string;
  provider_status: string;
  local_amount_inr: number;
  provider_amount_inr: number;
  reason: string;
  resolved: boolean;
  created_at: string;
};

export default function AdminPanel() {
  const { status } = useSession();
  const [accounts, setAccounts] = useState<EventAccount[]>([]);
  const [runs, setRuns] = useState<ReconRun[]>([]);
  const [mismatches, setMismatches] = useState<ReconMismatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningRecon, setRunningRecon] = useState(false);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [accountsRes, runsRes, mismatchesRes] = await Promise.all([
        fetch(`${apiBase}/admin/event-accounts`),
        fetch(`${apiBase}/gateway/reconcile-runs?provider=DEMO_PAY`),
        fetch(`${apiBase}/gateway/mismatches?provider=DEMO_PAY&unresolved_only=true`),
      ]);

      const accountsData = await accountsRes.json();
      const runsData = await runsRes.json();
      const mismatchesData = await mismatchesRes.json();

      if (!accountsRes.ok) {
        setMessage(parseApiError(accountsData, "Failed to load event accounts."));
      } else {
        setAccounts(accountsData || []);
      }

      if (!runsRes.ok) {
        setMessage((prev) => prev || parseApiError(runsData, "Failed to load reconciliation runs."));
      } else {
        setRuns(runsData.runs || []);
      }

      if (!mismatchesRes.ok) {
        setMessage((prev) => prev || parseApiError(mismatchesData, "Failed to load mismatches."));
      } else {
        setMismatches(mismatchesData.mismatches || []);
      }
    } catch {
      setMessage("Failed to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const runReconciliation = async () => {
    setRunningRecon(true);
    setMessage("");
    try {
      const res = await fetch(`${apiBase}/gateway/reconcile-run?provider=DEMO_PAY`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(parseApiError(data, "Failed to run reconciliation."));
      } else {
        setMessage(`Reconciliation completed: ${data.matched_records} matched, ${data.mismatched_records} mismatched.`);
        await loadDashboard();
      }
    } catch {
      setMessage("Failed to run reconciliation.");
    } finally {
      setRunningRecon(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#00baf2]" size={40} />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <div className="py-40 text-center font-bold">Please sign in to view admin controls.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Landmark className="text-[#00baf2]" size={24} />
          Payments Reconciliation Admin
        </h1>
        <div className="flex gap-2">
          <button
            onClick={loadDashboard}
            className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={runReconciliation}
            disabled={runningRecon}
            className="bg-[#002970] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
          >
            {runningRecon ? "Running..." : "Run Reconciliation"}
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded-xl px-4 py-3 text-sm font-medium">
          {message}
        </div>
      )}

      <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">System Event Accounts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <div key={`${acc.name}-${acc.type}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{acc.type}</p>
              <p className="font-bold text-gray-900 mt-1">{acc.name}</p>
              <p className="text-2xl font-black text-[#002970] mt-2">
                ₹{acc.balance_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
          {accounts.length === 0 && <p className="text-sm text-gray-500">No event accounts available.</p>}
        </div>
      </section>

      <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Reconciliation Runs</h2>
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.run_id} className="border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-gray-900">{run.provider} • {run.status}</p>
                <p className="text-xs text-gray-500">
                  {new Date(run.started_at).toLocaleString()} {run.completed_at ? `→ ${new Date(run.completed_at).toLocaleString()}` : ""}
                </p>
              </div>
              <div className="text-sm text-gray-700 font-semibold">
                {run.matched_records}/{run.total_records} matched, {run.mismatched_records} mismatched
              </div>
            </div>
          ))}
          {runs.length === 0 && <p className="text-sm text-gray-500">No reconciliation runs found.</p>}
        </div>
      </section>

      <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-yellow-500" />
          Open Mismatches
        </h2>
        <div className="space-y-3">
          {mismatches.map((m) => (
            <div key={m.id} className="border border-yellow-100 bg-yellow-50/40 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-gray-900">{m.provider_order_id}</p>
                  <p className="text-xs text-gray-600">
                    Local {m.local_status} / Provider {m.provider_status}
                  </p>
                </div>
                <div className="text-sm font-semibold text-gray-700">
                  ₹{m.local_amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })} vs ₹
                  {m.provider_amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <p className="text-xs text-red-700 font-semibold mt-2">Reason: {m.reason}</p>
            </div>
          ))}
          {mismatches.length === 0 && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3 font-semibold flex items-center gap-2">
              <ShieldCheck size={16} />
              No open mismatches.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
