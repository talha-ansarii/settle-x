"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { BarChart3, Clock3, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { parseApiError } from "@/lib/api";

type MerchantKpis = {
  window_days: number;
  transaction_count: number;
  inflow_inr: number;
  outflow_inr: number;
  net_inr: number;
  avg_ticket_inr: number;
  top_counterparties: Array<{ name: string; amount_inr: number; share_percent: number }>;
};

type PeakWindows = {
  window_days: number;
  top_hours: Array<{ hour: number; count: number; volume_inr: number }>;
  top_days: Array<{ day: string; count: number; volume_inr: number }>;
};

type SecurityScore = {
  window_days: number;
  score: number;
  risk_band: string;
  reasons: string[];
  signals: {
    failed_ratio: number;
    odd_hour_ratio: number;
    high_value_ratio: number;
    top_counterparty_share: number;
  };
};

export default function MerchantsPage() {
  const { data: session, status } = useSession();
  const [kpis, setKpis] = useState<MerchantKpis | null>(null);
  const [peak, setPeak] = useState<PeakWindows | null>(null);
  const [security, setSecurity] = useState<SecurityScore | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";
  const apiToken = session?.user?.api_token;

  const loadAnalytics = useCallback(async () => {
    if (!apiToken) return;
    setLoading(true);
    setMessage("");
    try {
      const [kpiRes, peakRes, secRes] = await Promise.all([
        fetch(`${apiBase}/analytics/merchant-kpis?days=30`, { headers: { Authorization: `Bearer ${apiToken}` } }),
        fetch(`${apiBase}/analytics/peak-windows?days=30`, { headers: { Authorization: `Bearer ${apiToken}` } }),
        fetch(`${apiBase}/analytics/security-score?days=30`, { headers: { Authorization: `Bearer ${apiToken}` } }),
      ]);
      const kpiData = await kpiRes.json();
      const peakData = await peakRes.json();
      const secData = await secRes.json();

      if (!kpiRes.ok) {
        setMessage(parseApiError(kpiData, "Failed to load merchant KPIs."));
        return;
      }
      if (!peakRes.ok) {
        setMessage(parseApiError(peakData, "Failed to load peak windows."));
        return;
      }
      if (!secRes.ok) {
        setMessage(parseApiError(secData, "Failed to load security score."));
        return;
      }

      setKpis(kpiData);
      setPeak(peakData);
      setSecurity(secData);
    } catch {
      setMessage("Failed to load merchant analytics.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, apiToken]);

  useEffect(() => {
    if (status !== "authenticated" || !apiToken) return;
    loadAnalytics();
  }, [status, apiToken, loadAnalytics]);

  if (status === "loading" || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#00baf2]" size={40} />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <div className="py-40 text-center font-bold">Please sign in to view merchant analytics.</div>;
  }

  const riskHigh = security?.risk_band === "HIGH_RISK";
  const riskMedium = security?.risk_band === "MEDIUM_RISK";

  return (
    <div className="w-full bg-paytm-bg min-h-screen pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Merchant Analytics Intelligence</h1>
          <button
            onClick={loadAnalytics}
            className="bg-[#002970] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-900"
          >
            Refresh
          </button>
        </div>

        {message && (
          <div className="text-sm font-medium bg-blue-50 border border-blue-100 text-blue-700 px-4 py-3 rounded-xl">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Transactions" value={kpis?.transaction_count ?? 0} />
          <StatCard label="Inflow (30d)" value={`₹${(kpis?.inflow_inr ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
          <StatCard label="Outflow (30d)" value={`₹${(kpis?.outflow_inr ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
          <StatCard label="Avg Ticket" value={`₹${(kpis?.avg_ticket_inr ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-paytm-border">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-paytm-cyan" />
                Top Counterparties by Outflow
              </h3>
              {kpis?.top_counterparties?.length ? (
                <div className="space-y-3">
                  {kpis.top_counterparties.map((cp) => (
                    <div key={cp.name} className="flex justify-between items-center bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-900">{cp.name}</p>
                        <p className="text-xs text-gray-500">{cp.share_percent}% share</p>
                      </div>
                      <p className="font-black text-gray-900">
                        ₹{cp.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No outgoing counterparty data available yet.</p>
              )}
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-paytm-border">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock3 size={18} className="text-paytm-cyan" />
                Peak Transaction Windows
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Top Hours</p>
                  <div className="space-y-2">
                    {(peak?.top_hours || []).map((h) => (
                      <div key={h.hour} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm flex justify-between">
                        <span className="font-medium text-gray-800">{`${h.hour.toString().padStart(2, "0")}:00`}</span>
                        <span className="font-semibold text-gray-900">{h.count} txns</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Top Days</p>
                  <div className="space-y-2">
                    {(peak?.top_days || []).map((d) => (
                      <div key={d.day} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm flex justify-between">
                        <span className="font-medium text-gray-800">{d.day}</span>
                        <span className="font-semibold text-gray-900">{d.count} txns</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`rounded-3xl p-6 text-white shadow-sm ${riskHigh ? "bg-red-700" : riskMedium ? "bg-yellow-600" : "bg-[#002970]"}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm uppercase tracking-wider font-semibold opacity-90">Security Rating</h3>
                {riskHigh ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
              </div>
              <p className="text-4xl font-black mb-1">{security?.score ?? 0}</p>
              <p className="text-sm font-semibold opacity-90">{security?.risk_band || "UNKNOWN"}</p>
              <div className="mt-4 text-xs space-y-1 opacity-95">
                <p>Failed Ratio: {((security?.signals.failed_ratio ?? 0) * 100).toFixed(1)}%</p>
                <p>Odd-Hour Ratio: {((security?.signals.odd_hour_ratio ?? 0) * 100).toFixed(1)}%</p>
                <p>High-Value Ratio: {((security?.signals.high_value_ratio ?? 0) * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-paytm-border">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">Risk Reasons</h3>
              <div className="space-y-2">
                {(security?.reasons || []).map((reason) => (
                  <div key={reason} className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-3">
                    {reason}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-paytm-cyan to-[#00a8d6] rounded-3xl p-6 text-white shadow-sm">
              <h3 className="font-bold mb-2">Operational Suggestion</h3>
              <p className="text-sm opacity-95">
                Concentrate settlements in your top low-risk windows and monitor failed ratio weekly to improve trust score.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-paytm-border p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">{label}</p>
      <p className="text-2xl font-black text-gray-900">{value}</p>
    </div>
  );
}
