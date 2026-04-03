"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import PinModal from "../../components/PinModal";
import Link from "next/link";
import { parseApiError } from "@/lib/api";

export default function CheckoutPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session, status } = useSession();
    
    const [intent, setIntent] = useState<any>(null);
    const [error, setError] = useState("");
    const [pinModalOpen, setPinModalOpen] = useState(false);
    const [loadingTx, setLoadingTx] = useState(false);
    const [success, setSuccess] = useState(false);
    
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

    useEffect(() => {
        if (!params.token || status !== "authenticated") return;
        
        fetch(`${apiBase}/checkout/intent/${params.token}`, {
            headers: { "Authorization": `Bearer ${session?.user?.api_token}` }
        })
        .then(res => res.json().then(data => ({ status: res.status, data })))
        .then(({ status, data }) => {
            if (status !== 200) setError(parseApiError(data, "Intent verification failed."));
            else setIntent(data);
        })
        .catch(() => setError("Network error resolving Intent token."));
    }, [params.token, status]);

    const executePayment = async (pinCode: string) => {
        setLoadingTx(true);
        try {
            const res = await fetch(`${apiBase}/checkout/execute-intent`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session!.user.api_token}` 
                },
                body: JSON.stringify({ token: params.token, pin: pinCode })
            });
            const data = await res.json();
            
            if (res.ok) {
                setSuccess(true);
                setPinModalOpen(false);
            } else {
                setError(parseApiError(data, "Failed to execute intent payment."));
                setPinModalOpen(false);
            }
        } catch (e) {
            setError("Fatal network execution block.");
        } finally {
            setLoadingTx(false);
        }
    };

    if (error) {
        return <div className="max-w-md mx-auto py-20 text-center"><div className="bg-red-50 text-red-600 p-6 rounded-3xl border border-red-100 font-bold shadow-sm">{error}</div></div>;
    }

    if (success) {
        return (
            <div className="max-w-xl mx-auto py-20 px-4 animate-in zoom-in-95 duration-500">
                <div className="bg-white rounded-3xl p-10 text-center shadow-xl border border-gray-100">
                    <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={48} />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 mb-2">Payment Complete!</h1>
                    <p className="text-gray-500 font-medium mb-8 text-lg">₹{intent?.amount_inr} settled seamlessly via SettleX Network.</p>
                    <Link href="/payments" className="bg-gray-50 hover:bg-gray-100 text-[#002970] font-bold py-3.5 px-6 rounded-xl transition-colors block border border-gray-200">Return to Dashboard</Link>
                </div>
            </div>
        )
    }

    if (!intent) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[#00baf2]" size={40}/></div>;

    return (
        <div className="max-w-xl mx-auto py-16 px-4">
            <div className={`bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 transition-all ${pinModalOpen ? 'opacity-50 scale-[0.98]' : ''}`}>
                <div className="bg-[#002970] p-8 text-center text-white relative overflow-hidden">
                    <div className="absolute top-[-20%] left-[-10%] opacity-10">
                        <ShieldCheck size={200} />
                    </div>
                    <div className="relative z-10">
                        <ShieldCheck size={32} className="mx-auto mb-4 text-[#00baf2]" />
                        <h2 className="text-sm font-semibold tracking-wider text-[#00baf2] uppercase mb-1">Secure Checkout</h2>
                        <h1 className="text-4xl font-black mb-2">₹{intent.amount_inr.toLocaleString('en-IN', {minimumFractionDigits:2})}</h1>
                        <p className="text-white/80 font-medium">To: {intent.target_type} Processing</p>
                    </div>
                </div>
                
                <div className="p-8">
                    <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
                        <p className="text-sm text-gray-500 font-semibold mb-1">Billing Description</p>
                        <p className="text-lg font-bold text-gray-900">{intent.description}</p>
                        
                        {intent.metadata && Object.keys(intent.metadata).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200 gap-y-2 flex flex-col">
                                {Object.entries(intent.metadata).map(([key, val]) => (
                                    <div key={key} className="flex justify-between text-sm">
                                        <span className="text-gray-500 font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <span className="font-semibold text-gray-900">{String(val)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => setPinModalOpen(true)}
                        className="w-full bg-[#00baf2] text-white font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#00a6d9] active:scale-[0.98] transition-all shadow-lg shadow-[#00baf2]/20"
                    >
                        <ShieldCheck size={20} /> Authorize Double-Entry Payment
                    </button>
                    <p className="text-center text-xs text-gray-400 mt-4 font-medium flex items-center justify-center gap-1">
                        <ShieldCheck size={12} /> Protected by SettleX Local API
                    </p>
                </div>
            </div>
            
            <PinModal 
                isOpen={pinModalOpen} 
                onClose={() => setPinModalOpen(false)}
                onConfirm={executePayment}
                loading={loadingTx}
                title="Verify Intent Payment"
            />
        </div>
    );
}
