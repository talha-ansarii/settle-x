"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Wallet, SendHorizontal, History, Loader2, ArrowRightLeft, Landmark, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
import PinModal from "../components/PinModal";
import Link from "next/link";
import { parseApiError } from "@/lib/api";

export default function PaymentsPage() {
  const { data: session, status } = useSession();
  
  const [balance, setBalance] = useState<number | null>(null);
  const [pinSet, setPinSet] = useState(true);
  const [loadingObj, setLoadingObj] = useState(true);
  
  const [recipient, setRecipient] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [paymentMsg, setPaymentMsg] = useState({ text: "", type: "" });
  
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false); // setup pin vs transfer pin
  const [txLoading, setTxLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

  const fetchBalance = async (silent = false) => {
    if (!session?.user?.api_token) return;
    if (!silent) setLoadingObj(true);
    else setIsRefreshing(true);
    
    try {
      const res = await fetch(`${apiBase}/payments/balance`, {
        headers: { "Authorization": `Bearer ${session.user.api_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance_inr);
        setPinSet(data.pin_set);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoadingObj(false);
      else setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchBalance();
    else if (status === "unauthenticated") setLoadingObj(false);
  }, [status, session]);

  const handleTransferInit = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentMsg({ text: "", type: "" });
    if (!pinSet) {
        setIsSetupMode(true);
        setIsPinModalOpen(true);
        return;
    }
    setIsSetupMode(false);
    setIsPinModalOpen(true);
  };

  const executeAction = async (pinCode: string) => {
    setTxLoading(true);
    setPaymentMsg({ text: "", type: "" });
    try {
        if (isSetupMode) {
            const res = await fetch(`${apiBase}/payments/setup-pin`, {
               method: "POST",
               headers: { 
                   "Content-Type": "application/json",
                   "Authorization": `Bearer ${session!.user.api_token}` 
               },
               body: JSON.stringify({ pin: pinCode })
            });
            if (res.ok) {
                setPinSet(true);
                setIsPinModalOpen(false);
                setPaymentMsg({ text: "PIN successfully setup! You can now make secure transfers.", type: "success" });
            } else {
                const data = await res.json().catch(() => ({}));
                setPaymentMsg({ text: parseApiError(data, "Failed to setup PIN."), type: "error" });
            }
        } else {
            // Setup robust idempotency key to stop double tapping
            const idemKey = `idem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const amtPaise = Math.floor(parseFloat(amountStr) * 100);
            
            const res = await fetch(`${apiBase}/payments/transfer`, {
               method: "POST",
               headers: { 
                   "Content-Type": "application/json",
                   "Authorization": `Bearer ${session!.user.api_token}` 
               },
               body: JSON.stringify({ 
                   recipient_mobile: recipient,
                   amount_paise: amtPaise,
                   pin: pinCode,
                   idempotency_key: idemKey
               })
            });
            const data = await res.json();
            
            if (res.ok) {
                setPaymentMsg({ text: `Success! Transferred ₹${data.amount_inr} securely to +91 ${recipient}.`, type: "success" });
                setRecipient("");
                setAmountStr("");
                setIsPinModalOpen(false);
                fetchBalance(true); // Refresh balance silently
            } else {
                setPaymentMsg({ text: parseApiError(data, "Transaction failed."), type: "error" });
                setIsPinModalOpen(false);
            }
        }
    } catch {
        setPaymentMsg({ text: "Network error occurred. The transaction might have halted.", type: "error" });
        setIsPinModalOpen(false);
    } finally {
        setTxLoading(false);
    }
  };

  if (status === "loading" || loadingObj) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[#00baf2]" size={40}/></div>;

  if (status === "unauthenticated") {
      return (
          <div className="max-w-7xl mx-auto px-4 py-20 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
                <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                  <ShieldCheck size={40} />
                </div>
                <h1 className="text-3xl font-bold mb-4 text-gray-900">Secure Network Access Required</h1>
                <p className="text-gray-500 mb-8">Please authorize via the SettleX portal in the header to access the internal banking ledger.</p>
              </div>
          </div>
      )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-300">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Local Payments Ledger</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Wallet Dashboard */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-gradient-to-br from-[#002970] to-[#001740] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10 pointer-events-none">
                        <Wallet size={200} />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                        <p className="text-[#00baf2] font-semibold text-sm mb-4 flex items-center gap-2"><Landmark size={16}/> SettleX Main Wallet</p>
                        <button onClick={() => fetchBalance(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors group">
                           <RefreshCw size={16} className={`text-white/60 group-hover:text-white ${isRefreshing ? 'animate-spin text-white' : ''}`} />
                        </button>
                    </div>
                    
                    <div className="relative z-10">
                        <h2 className="text-5xl font-black mb-1 tracking-tight">
                          <span className="text-3xl font-medium mr-1 opacity-70">₹</span>
                          {balance !== null ? balance.toLocaleString('en-IN', {minimumFractionDigits: 2}) : "0.00"}
                        </h2>
                        <p className="text-sm opacity-80 mb-8 font-medium">Available Clear Balance</p>
                        
                        {!pinSet ? (
                            <button onClick={() => { setIsSetupMode(true); setIsPinModalOpen(true); }} className="w-full bg-[#00baf2] hover:bg-[#00a3d4] transition-colors text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#00baf2]/20">
                                <ShieldCheck size={18} /> Setup Transaction PIN
                            </button>
                        ) : (
                             <div className="flex items-center gap-2 text-emerald-400 bg-black/20 w-max px-4 py-2 rounded-full text-sm font-semibold tracking-wide shadow-inner border border-emerald-400/20">
                                 <CheckCircle2 size={16}/> Vault PIN Active
                             </div>
                        )}
                    </div>
                </div>
                
                <Link href="/history" className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between group hover:border-[#00baf2]/30 transition-colors cursor-pointer block">
                   <div className="flex items-center gap-4">
                      <div className="bg-blue-50 p-3 rounded-2xl text-[#002970] group-hover:bg-[#00baf2] group-hover:text-white transition-colors">
                         <History size={24} />
                      </div>
                      <div>
                         <h4 className="font-bold text-gray-900">Ledger History</h4>
                         <p className="text-sm font-medium text-gray-500">View statement</p>
                      </div>
                   </div>
                   <div className="text-gray-300 group-hover:text-[#00baf2] transition-colors">
                      <ArrowRightLeft size={20} />
                   </div>
                </Link>
            </div>

            {/* Transfer Interface */}
            <div className="lg:col-span-2">
                <div className="bg-white rounded-3xl p-8 lg:p-10 shadow-sm border border-gray-100 h-full">
                    <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                        <div className="bg-[#f0fbff] p-2.5 rounded-2xl text-[#00baf2] shadow-sm"><SendHorizontal size={24}/></div>
                        Make a Direct Transfer
                    </h3>
                    
                    {paymentMsg.text && (
                        <div className={`p-4 rounded-xl mb-8 font-medium border flex items-center gap-3 ${paymentMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {paymentMsg.type === 'success' ? <CheckCircle2 size={20}/> : <ShieldCheck size={20}/>}
                            {paymentMsg.text}
                        </div>
                    )}
                    
                    <form onSubmit={handleTransferInit} className="space-y-6 max-w-lg">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Recipient Mobile Number</label>
                            <div className="flex shadow-sm rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#00baf2] focus-within:border-[#00baf2] border border-gray-300 transition-all">
                                <span className="inline-flex items-center px-4 border-r border-gray-300 bg-gray-50 text-gray-500 font-semibold text-lg hover:bg-gray-100 transition-colors pointer-events-none">+91</span>
                                <input 
                                  type="tel" 
                                  value={recipient}
                                  onChange={(e) => setRecipient(e.target.value.replace(/\D/g, ''))}
                                  placeholder="9876543210"
                                  className="flex-1 block w-full px-4 py-3.5 text-lg font-medium text-gray-900 border-0 focus:ring-0 outline-none placeholder:text-gray-300"
                                  maxLength={10}
                                  required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Transfer Amount</label>
                            <div className="relative shadow-sm rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#00baf2] focus-within:border-[#00baf2] border border-gray-300 transition-all">
                                <span className="absolute left-5 top-3.5 text-gray-500 font-bold text-lg">₹</span>
                                <input 
                                    type="number"
                                    value={amountStr}
                                    onChange={(e) => setAmountStr(e.target.value)}
                                    placeholder="0.00"
                                    step="0.01"
                                    min="1"
                                    className="block w-full pl-10 pr-4 py-3.5 font-bold text-xl text-gray-900 border-0 focus:ring-0 outline-none placeholder:text-gray-300 placeholder:font-normal"
                                    required
                                />
                            </div>
                        </div>
                        
                        <div className="pt-2">
                            <button 
                                type="submit"
                                disabled={!recipient || recipient.length < 10 || !amountStr || parseFloat(amountStr) <= 0}
                                className="bg-[#002970] hover:bg-blue-900 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center w-full transition-all disabled:opacity-50 disabled:hover:bg-[#002970] shadow-lg shadow-[#002970]/20 active:scale-[0.98]"
                            >
                                Send Securely <ArrowRightLeft size={18} className="ml-2"/>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        
        <PinModal 
            isOpen={isPinModalOpen} 
            onClose={() => { setIsPinModalOpen(false); setTxLoading(false); }}
            onConfirm={executeAction}
            loading={txLoading}
            title={isSetupMode ? "Setup Security PIN" : "Confirm Payment PIN"}
        />
    </div>
  );
}
