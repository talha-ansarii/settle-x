"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Smartphone,
  Tv,
  CarFront,
  Zap,
  CalendarCheck,
  LayoutGrid,
  Plane,
  Bus,
  Train,
  Globe,
  ArrowRight,
  X,
} from "lucide-react";

type TravelMode = "flights" | "bus" | "trains" | "intl";

export default function Home() {
  const router = useRouter();
  const [travelModalOpen, setTravelModalOpen] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode | null>(null);
  const [tripType, setTripType] = useState<"one-way" | "round-trip">("one-way");

  const openTravelModal = useCallback(() => {
    setTravelMode(null);
    setTravelModalOpen(true);
  }, []);

  const closeTravelModal = useCallback(() => {
    setTravelModalOpen(false);
  }, []);

  useEffect(() => {
    if (!travelModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTravelModal();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [travelModalOpen, closeTravelModal]);

  const handleAction = (feature: string) => {
    alert(`Mock integration: ${feature} initiated.`);
  };

  return (
    <div className="w-full bg-paytm-bg min-h-screen pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        
        {/* Top Section - Recharges & Bill Payments AND Right Banner */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Main Services Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-paytm-border lg:w-[65%] flex-shrink-0">
            <h2 className="text-xl flex items-center gap-2 font-bold text-gray-900 mb-6 sm:mb-8 tracking-tight">
              Recharges & Bill Payments
            </h2>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-y-8 gap-x-2">
              <ServiceIcon onClick={() => router.push("/recharge")} icon={<Smartphone className="text-paytm-cyan w-8 h-8" strokeWidth={1.5} />} label="Mobile Recharge" />
              <ServiceIcon onClick={() => router.push("/dth-recharge")} icon={<Tv className="text-paytm-cyan w-8 h-8" strokeWidth={1.5} />} label="DTH Recharge" />
              <ServiceIcon onClick={() => router.push("/fastag-recharge")} icon={<CarFront className="text-paytm-cyan w-8 h-8" strokeWidth={1.5} />} label="FasTag Recharge" />
              <ServiceIcon onClick={() => router.push("/electricity-bill-payment")} icon={<Zap className="text-paytm-cyan w-8 h-8" strokeWidth={1.5} />} label="Electricity Bill" />
              <ServiceIcon onClick={() => router.push("/loan-emi-payment")} icon={<CalendarCheck className="text-paytm-cyan w-8 h-8" strokeWidth={1.5} />} label="Loan EMI Payment" />
              <ServiceIcon onClick={() => router.push("/all-products")} icon={<LayoutGrid className="text-paytm-cyan w-8 h-8" strokeWidth={1.5} />} label="View All Products" />
            </div>
          </div>

          {/* Right UPI Statement Banner */}
          <div className="bg-gradient-to-br from-[#c3edff] to-[#eaf7ff] rounded-3xl p-6 sm:p-8 relative overflow-hidden lg:w-[35%] flex-shrink-0 shadow-sm border border-paytm-border flex flex-col justify-center">
            <h3 className="text-xl sm:text-2xl font-bold text-paytm-navy mb-2 leading-tight">Get UPI Statement<br/>in Excel/ PDF</h3>
            <p className="text-paytm-navy font-medium mb-6 mt-1 opacity-80 text-sm sm:text-base">Track all your<br/>expenses.<br/>Only on Paytm.</p>
            <div 
              onClick={() => handleAction("Download App Banner")}
              className="bg-black text-white text-xs font-semibold rounded-full px-4 py-2 w-max cursor-pointer hover:bg-gray-800 transition-transform active:scale-95"
            >
              Download Paytm App ⬇
            </div>
            
            {/* Mock phone in background */}
            <div className="absolute -bottom-10 -right-4 w-32 sm:w-40 bg-white rounded-[2rem] border-[6px] border-paytm-navy shadow-xl h-56 sm:h-64 p-3 rotate-[-5deg] opacity-80 sm:opacity-100">
              <div className="w-full h-full border border-gray-100 rounded-xl bg-gray-50 flex flex-col items-center pt-4 opacity-50">
                <div className="w-16 h-4 bg-gray-200 rounded-full mb-4"></div>
                <div className="w-full h-12 bg-white rounded-lg mb-2 shadow-sm border border-gray-100"></div>
                <div className="w-full h-12 bg-white rounded-lg shadow-sm border border-gray-100"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Small Promo Banners */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between shadow-sm border border-paytm-border cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 w-full mb-4 sm:mb-0">
              <div className="bg-[#EBF7FF] p-3 rounded-xl text-paytm-navy flex-shrink-0">
                <TagIcon />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 leading-tight">Do Mobile Recharge <span className="font-medium text-gray-600 sm:inline block">and Win ₹100</span></h4>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">cashback. Promo: TAKEITALL</p>
              </div>
            </div>
            <button 
              onClick={() => handleAction("Promo: Mobile Recharge")}
              className="text-paytm-navy font-semibold text-sm border border-paytm-navy hover:bg-paytm-navy hover:text-white transition-colors rounded-full px-4 py-1.5 flex items-center justify-center whitespace-nowrap w-full sm:w-auto"
            >
              Recharge Now <ArrowRight size={14} className="ml-1" />
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between shadow-sm border border-paytm-border cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 w-full mb-4 sm:mb-0">
              <div className="bg-[#EBF7FF] p-3 rounded-xl text-paytm-navy flex-shrink-0">
                <WifiRouterIcon />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 leading-tight">Broadband Recharge</h4>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Bill due? Pay now & get rewarded</p>
              </div>
            </div>
            <button 
              onClick={() => handleAction("Promo: Broadband")}
              className="text-paytm-navy font-semibold text-sm border border-paytm-navy hover:bg-paytm-navy hover:text-white transition-colors rounded-full px-4 py-1.5 flex items-center justify-center whitespace-nowrap w-full sm:w-auto"
            >
              Pay Now <ArrowRight size={14} className="ml-1" />
            </button>
          </div>
        </div>

        {/* Travel — opens full UI in a modal */}
        <button
          type="button"
          onClick={openTravelModal}
          className="w-full text-left bg-white rounded-3xl p-4 sm:p-8 shadow-sm border border-paytm-border hover:shadow-md hover:border-paytm-cyan/30 transition-all group"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-1">
                Book travel
              </h2>
              <p className="text-sm text-gray-500">
                Flights, bus, trains &amp; international flights — tap to open
              </p>
            </div>
            <div className="flex items-center gap-2 text-paytm-cyan shrink-0">
              <Plane className="w-8 h-8 opacity-90 group-hover:scale-105 transition-transform" strokeWidth={1.5} />
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-paytm-cyan transition-colors" />
            </div>
          </div>
        </button>

        {travelModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center sm:items-center p-4 sm:p-6"
            role="presentation"
          >
            <button
              type="button"
              aria-label="Close travel booking"
              className="absolute inset-0 bg-black/45 backdrop-blur-[2px] cursor-default"
              onClick={closeTravelModal}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="travel-modal-title"
              className="relative w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-y-auto bg-white rounded-3xl p-4 sm:p-8 shadow-xl border border-paytm-border mt-4 sm:mt-0 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start gap-4 mb-4">
                <h2 id="travel-modal-title" className="sr-only">
                  Book travel
                </h2>
                <div className="flex overflow-x-auto w-full min-w-0 hide-scrollbar gap-2 sm:gap-8 border-b border-gray-100 pb-2 pr-2">
                  <TabButton
                    active={travelMode === "flights"}
                    onClick={() => setTravelMode("flights")}
                    label="Flights"
                    icon={
                      <Plane
                        size={24}
                        className={travelMode === "flights" ? "text-paytm-cyan" : "text-gray-400"}
                        fill={travelMode === "flights" ? "currentColor" : "none"}
                      />
                    }
                  />
                  <TabButton
                    active={travelMode === "bus"}
                    onClick={() => setTravelMode("bus")}
                    label="Bus"
                    icon={<Bus size={24} className={travelMode === "bus" ? "text-paytm-cyan" : "text-gray-400"} />}
                  />
                  <TabButton
                    active={travelMode === "trains"}
                    onClick={() => setTravelMode("trains")}
                    label="Trains"
                    icon={<Train size={24} className={travelMode === "trains" ? "text-paytm-cyan" : "text-gray-400"} />}
                  />
                  <TabButton
                    active={travelMode === "intl"}
                    onClick={() => setTravelMode("intl")}
                    label="Intl. Flights"
                    icon={<Globe size={24} className={travelMode === "intl" ? "text-paytm-cyan" : "text-gray-400"} />}
                  />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:flex text-xl font-bold tracking-tight">
                    <span className="text-paytm-navy">paytm</span>
                    <span className="text-black">travel</span>
                  </div>
                  <button
                    type="button"
                    onClick={closeTravelModal}
                    className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    aria-label="Close"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              {travelMode === null && (
                <p className="text-center text-gray-500 text-sm py-10 px-4">
                  Choose Flights, Bus, Trains, or Intl. Flights above to continue.
                </p>
              )}

              {travelMode !== null && (
                <div className="border border-paytm-border rounded-xl p-4 sm:p-5 shadow-sm bg-white pt-6">
                  <div className="flex gap-6 mb-6">
                    <label
                      className={`flex items-center gap-2 text-sm sm:text-base font-medium cursor-pointer transition-colors ${tripType === "one-way" ? "text-gray-900" : "text-gray-500"}`}
                      onClick={() => setTripType("one-way")}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${tripType === "one-way" ? "border-paytm-cyan" : "border-gray-300"}`}
                      >
                        {tripType === "one-way" && (
                          <div className="w-2.5 h-2.5 bg-paytm-cyan rounded-full animate-in zoom-in" />
                        )}
                      </div>
                      One Way
                    </label>
                    <label
                      className={`flex items-center gap-2 text-sm sm:text-base font-medium cursor-pointer transition-colors ${tripType === "round-trip" ? "text-gray-900" : "text-gray-500"}`}
                      onClick={() => setTripType("round-trip")}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${tripType === "round-trip" ? "border-paytm-cyan" : "border-gray-300"}`}
                      >
                        {tripType === "round-trip" && (
                          <div className="w-2.5 h-2.5 bg-paytm-cyan rounded-full animate-in zoom-in" />
                        )}
                      </div>
                      Round Trip
                    </label>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end w-full">
                    <div className="relative border border-gray-200 md:border-t-0 md:border-b-0 md:border-l-0 md:border-r flex-1 px-4 py-2 md:pl-0 rounded-lg md:rounded-none">
                      <div className="flex-1">
                        <div className="text-[11px] text-gray-400 uppercase font-semibold mb-1 tracking-wider">
                          From
                        </div>
                        <input
                          type="text"
                          defaultValue="Delhi (DEL)"
                          className="text-lg sm:text-xl font-bold text-gray-900 w-full outline-none bg-transparent"
                        />
                      </div>
                      <div className="absolute top-1/2 md:top-[60%] -right-4 transform -translate-y-1/2 bg-white rounded-full p-1.5 border border-gray-200 z-10 shadow-sm cursor-pointer hover:rotate-180 transition-transform hidden md:block">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16"
                            stroke="#00B9F1"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="border border-gray-200 md:border-t-0 md:border-b-0 md:border-l-0 md:border-r flex-1 px-4 py-2 md:pl-4 rounded-lg md:rounded-none">
                      <div className="text-[11px] text-gray-400 uppercase font-semibold mb-1 tracking-wider">
                        To
                      </div>
                      <input
                        type="text"
                        defaultValue="Mumbai (BOM)"
                        className="text-lg sm:text-xl font-bold text-gray-900 w-full outline-none bg-transparent"
                      />
                    </div>

                    <div className="border border-gray-200 md:border-t-0 md:border-b-0 md:border-l-0 md:border-r flex-1 px-4 py-2 md:pl-4 rounded-lg md:rounded-none">
                      <div className="text-[11px] text-gray-400 uppercase font-semibold mb-1 tracking-wider">
                        Depart
                      </div>
                      <input
                        type="text"
                        defaultValue="Tue, 07 Apr 26"
                        className="text-base sm:text-lg font-bold text-gray-900 cursor-pointer hover:text-paytm-cyan transition-colors outline-none bg-transparent w-full"
                      />
                    </div>

                    {tripType === "round-trip" && (
                      <div className="border border-gray-200 md:border-t-0 md:border-b-0 md:border-l-0 md:border-r flex-1 px-4 py-2 md:pl-4 rounded-lg md:rounded-none animate-in fade-in slide-in-from-left-4">
                        <div className="text-[11px] text-gray-500 uppercase font-bold mb-1 tracking-wider">Return</div>
                        <input
                          type="text"
                          placeholder="Add Return"
                          className="text-base sm:text-lg font-bold text-paytm-cyan cursor-pointer transition-colors outline-none bg-transparent w-full"
                        />
                      </div>
                    )}

                    <div className="border border-gray-200 md:border-transparent flex-1 px-4 py-2 md:pl-4 rounded-lg md:rounded-none mb-0 md:mb-0">
                      <div className="flex-1">
                        <div className="text-[11px] text-gray-400 uppercase font-semibold mb-1 tracking-wider">
                          Passenger
                        </div>
                        <div className="text-base sm:text-lg font-bold text-gray-900 truncate">1 Traveller</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        closeTravelModal();
                        router.push(travelMode === "intl" ? "/intl-flights" : `/${travelMode}`);
                      }}
                      className="bg-[#00baec] hover:bg-[#00a8d6] transition-colors text-white font-bold py-3.5 px-6 rounded-xl flex-shrink-0 w-full md:w-auto shadow-md text-base sm:text-lg mt-4 md:mt-0 active:scale-95"
                    >
                      Search{" "}
                      {travelMode === "intl"
                        ? "International Flights"
                        : travelMode.charAt(0).toUpperCase() + travelMode.slice(1)}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Subcomponents
function TabButton({ active, label, icon, onClick }: { active: boolean, label: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center flex-shrink-0 font-medium pb-2 px-2 sm:px-4 border-b-2 transition-colors ${active ? 'text-paytm-cyan border-paytm-cyan font-bold' : 'text-gray-500 border-transparent hover:text-paytm-navy'}`}
    >
       <div className={`p-2 sm:p-2.5 rounded-full mb-1 transition-colors ${active ? 'bg-[#EBF7FF]' : 'bg-gray-50'}`}>
         {icon}
       </div>
       <span className="text-xs sm:text-sm">{label}</span>
    </button>
  )
}

function ServiceIcon({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex flex-col items-center cursor-pointer group active:scale-95 transition-transform">
      <div className="mb-2 sm:mb-3 transition-transform group-hover:scale-110">
        {icon}
      </div>
      <span className="text-[11px] sm:text-[13px] font-semibold text-gray-800 text-center leading-tight sm:px-2 px-0">
        {label}
      </span>
    </div>
  );
}

// Icons
function TagIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
       <path d="M12 2L4 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-8-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
       <path d="M12 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
       <circle cx="12" cy="16" r="1" fill="currentColor"/>
    </svg>
  );
}

function WifiRouterIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="14" width="18" height="6" rx="2" stroke="currentColor" strokeWidth="2"/>
      <path d="M7 14v-2c0-2.76 2.24-5 5-5s5 2.24 5 5v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 7V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="17" r="1.5" fill="currentColor"/>
    </svg>
  );
}
