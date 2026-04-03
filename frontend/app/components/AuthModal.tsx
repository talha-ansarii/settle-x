"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { X, Loader2 } from "lucide-react";
import { parseApiError } from "@/lib/api";

export default function AuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1"}/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile_number: mobile })
      });
      const data = await res.json();
      if (res.ok) {
        setStep(2);
      } else {
        setError(parseApiError(data, "Failed to send OTP"));
      }
    } catch (err) {
      setError("Network Error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        mobile_number: mobile,
        otp_code: otp,
        name: name,
        redirect: false
      });
      if (res?.error) {
        setError("Invalid or expired OTP");
      } else {
        onClose();
        // Router will reactively re-render Navbar due to Session context update
      }
    } catch (err) {
      setError("Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="bg-[#002970] p-6 text-white flex justify-between items-start relative">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Login with Paytm</h2>
                <p className="text-[#00baf2] text-sm mt-1 font-medium">SettleX Intelligence Portal</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
        </div>
        <div className="p-8">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-6 border border-red-100 font-medium flex items-center gap-2">⚠️ {error}</div>}
          
          {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile Number</label>
                <div className="flex shadow-sm rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#00baf2] focus-within:border-[#00baf2] border border-gray-300">
                    <span className="inline-flex items-center px-4 border-r border-gray-300 bg-gray-50 text-gray-600 font-semibold text-lg hover:bg-gray-100 transition-colors cursor-default">+91</span>
                    <input 
                      type="tel" 
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="9876543210"
                      className="flex-1 block w-full px-4 py-3 text-lg font-medium text-gray-900 border-0 focus:ring-0 outline-none placeholder:text-gray-400 placeholder:font-normal"
                      maxLength={10}
                      autoFocus
                      required
                    />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name / Business Name (Optional)</label>
                <div className="flex shadow-sm rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#00baf2] focus-within:border-[#00baf2] border border-gray-300">
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="flex-1 block w-full px-4 py-3 text-lg font-medium text-gray-900 border-0 focus:ring-0 outline-none placeholder:text-gray-400 placeholder:font-normal"
                    />
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={loading || mobile.length < 10}
                className="w-full bg-[#00baf2] hover:bg-[#00a3d4] text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:hover:bg-[#00baf2] shadow-md shadow-[#00baf2]/20 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : "Proceed Securely"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Enter 6-digit OTP sent to +91 {mobile}</label>
                <input 
                  type="text" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="block w-full border border-gray-300 rounded-xl px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] text-gray-900 focus:ring-2 focus:ring-[#00baf2] focus:border-[#00baf2] outline-none shadow-sm transition-all"
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || otp.length < 6}
                className="w-full bg-[#00baf2] hover:bg-[#00a3d4] text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:hover:bg-[#00baf2] shadow-md shadow-[#00baf2]/20 active:scale-[0.98]"
              >
                 {loading ? <Loader2 className="animate-spin" size={24} /> : "Verify & Login"}
              </button>
              <button type="button" onClick={() => setStep(1)} className="w-full text-center text-sm text-[#00baf2] hover:text-[#002970] font-semibold transition-colors mt-2">Change Mobile Number</button>
            </form>
          )}
        </div>
        <div className="bg-gray-50 flex justify-center py-4 text-xs font-medium text-gray-400 border-t border-gray-100">
            Protected by Twilio Verify Infrastructure
        </div>
      </div>
    </div>
  );
}
