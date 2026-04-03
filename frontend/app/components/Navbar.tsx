"use client";

import Link from "next/link";
import { ChevronDown, Download, UserRound, Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import AuthModal from "./AuthModal";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { data: session, status } = useSession();

  return (
    <nav className="bg-white sticky top-0 z-50 border-b border-paytm-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center gap-1 text-2xl font-bold">
              <span className="text-paytm-navy tracking-tight">Paytm</span>
              <span className="text-paytm-cyan text-sm align-top mt-1">SettleX</span>
            </Link>
          </div>

          {/* Navigation Links - Hidden on Mobile */}
          <div className="hidden lg:flex flex-1 justify-center space-x-8">
            <NavItem text="Recharge & Bills" href="/" />
            <NavItem text="Treasury" href="/treasury" />
            <NavItem text="Payments" href="/payments" />
            <NavItem text="Compliance & OCR" href="/compliance" />
            <NavItem text="Merchants" href="/merchants" />
          </div>

            <div className="flex items-center space-x-2 md:space-x-4">
              <button className="hidden md:flex items-center text-sm font-medium hover:bg-gray-50 px-3 py-2 rounded-full transition-colors border border-transparent hover:border-gray-200">
                <Download size={16} className="mr-2" />
                Download App
              </button>
              
              {status === "loading" ? (
                <div className="h-10 w-24 bg-gray-100 animate-pulse rounded-full"></div>
              ) : session ? (
                <div className="relative">
                  <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="bg-gray-50 border border-gray-200 hover:bg-gray-100 text-paytm-navy px-2 py-2 sm:px-4 sm:py-2 rounded-full flex items-center transition-colors shadow-sm max-w-[160px] sm:max-w-[220px]">
                    <div className="bg-paytm-navy w-7 h-7 flex items-center justify-center rounded-full text-white font-bold text-sm mr-2 shrink-0">
                      {session.user?.business_name ? session.user.business_name.charAt(0).toUpperCase() : session.user?.mobile_number?.charAt(0) || <UserRound size={14} />}
                    </div>
                    <span className="font-semibold text-sm truncate">
                      {session.user?.business_name || `+91 ${session.user?.mobile_number?.substring(0,5)}...`}
                    </span>
                  </button>
                  
                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-3 border-b border-gray-50 mb-1 bg-gray-50/50">
                        <p className="text-sm font-semibold truncate text-gray-900">{session.user?.business_name || "Merchant User"}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">+91 {session.user?.mobile_number}</p>
                      </div>
                      <Link href="/profile" onClick={() => setIsProfileOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Profile Settings</Link>
                      <Link href="/treasury" onClick={() => setIsProfileOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-1">My Dashboard</Link>
                      <button 
                        onClick={() => {
                            setIsProfileOpen(false);
                            if (window.confirm("Are you sure you want to securely log out?")) {
                                signOut();
                            }
                        }} 
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium flex items-center border-t border-gray-50"
                      >
                        <LogOut size={16} className="mr-2" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => setIsAuthOpen(true)} className="bg-paytm-navy hover:bg-blue-900 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-full flex items-center transition-colors shadow-sm">
                  <span className="font-semibold text-sm mr-2">Sign In</span>
                  <div className="bg-white/20 p-1 rounded-full hidden sm:block">
                    <UserRound size={16} />
                  </div>
                </button>
              )}
            
            {/* Mobile menu button */}
            <div className="flex items-center lg:hidden ml-2">
              <button 
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-500 hover:text-gray-900 focus:outline-none p-2 rounded-md transition-colors hover:bg-gray-50"
              >
                {isOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg absolute w-full">
          <div className="px-4 pt-2 pb-6 space-y-1 overflow-y-auto max-h-[80vh]">
            <MobileNavItem text="Recharge & Bills" href="/" onClick={() => setIsOpen(false)} />
            <MobileNavItem text="Treasury" href="/treasury" onClick={() => setIsOpen(false)} />
            <MobileNavItem text="Payments" href="/payments" onClick={() => setIsOpen(false)} />
            <MobileNavItem text="Compliance & OCR" href="/compliance" onClick={() => setIsOpen(false)} />
            <MobileNavItem text="Merchants" href="/merchants" onClick={() => setIsOpen(false)} />
            
            <div className="pt-4 mt-2 border-t border-gray-100 md:hidden">
               <button className="flex items-center w-full text-base font-medium text-gray-700 py-3 rounded-md hover:bg-gray-50 transition-colors">
                 <Download size={18} className="mr-3" />
                 Download App
               </button>
            </div>
          </div>
        </div>
      )}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </nav>
  );
}

function NavItem({ text, href }: { text: string; href?: string }) {
  const content = (
    <div className="flex items-center cursor-pointer group py-2">
      <span className="text-[15px] font-medium text-gray-800 group-hover:text-black">{text}</span>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function MobileNavItem({ text, href, onClick }: { text: string; href: string; onClick: () => void }) {
  return (
    <Link 
      href={href} 
      onClick={onClick}
      className="block px-3 py-4 text-base font-medium text-gray-800 hover:text-paytm-cyan hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-50"
    >
      {text}
    </Link>
  );
}
