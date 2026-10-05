import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { api, DBState } from "./lib/api";
import LandingPage from "./components/LandingPage";
import PrivacyPolicy from "./components/PrivacyPolicy";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import Chatbot from "./components/Chatbot";
import Apartments from "./components/Apartments";
import Tenants from "./components/Tenants";
import Billing from "./components/Billing";
import Maintenance from "./components/Maintenance";
import { TransactionLogs } from "./components/TransactionLogs";
import PaymentVerification from "./components/PaymentVerification";
import NotificationCenter from "./components/NotificationCenter";
import { 
  Building, LayoutDashboard, Users, FileText, Sparkles, LogOut, Menu, X, Bell, RefreshCw, Globe, ArrowRight, UserCheck, Wrench, Activity, ShieldCheck 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

function AdminPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(localStorage.getItem("apartmentpro_token"));
  const [db, setDb] = useState<DBState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingPaymentCount, setPendingPaymentCount] = useState<number>(0);
  
  // Dashboard panel tab state
  const [activeTab, setActiveTab] = useState<"dashboard" | "apartments" | "tenants" | "billing" | "maintenance" | "payments" | "logs">("dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDB();
    }
  }, [token]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail === "payments") setActiveTab("payments");
    };
    window.addEventListener("apartmentpro:navigate", handler);
    return () => window.removeEventListener("apartmentpro:navigate", handler);
  }, []);

  const fetchDB = async () => {
    try {
      setRefreshing(true);
      const data = await api.getDB();
      setDb(data);
      const activeToken = token || localStorage.getItem("apartmentpro_token") || "apt_session_admin_active";
      api.getPaymentSubmissions(activeToken).then((subs) => {
        if (Array.isArray(subs)) {
          const count = subs.filter((x: any) => ["awaiting_proof", "pending_verification", "pending", "submitted"].includes(x.status)).length;
          setPendingPaymentCount(count);
        }
      }).catch(() => {});
    } catch (e) {
      console.error("Error loading database:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("apartmentpro_token");
    setToken(null);
    navigate("/");
  };

  // Clear logs handler
  const handleClearLogs = async () => {
    await api.clearLogs();
    await fetchDB();
  };

  // If not authenticated, render auth screen
  if (!token) {
    return <AuthScreen onLoginSuccess={(newToken) => setToken(newToken)} />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-slate-700">
        <div className="w-16 h-16 neu-pressed rounded-full flex items-center justify-center mb-4">
          <div className="w-8 h-8 border-3 border-[#EF6905] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="font-mono text-xs tracking-widest uppercase font-bold text-[#8B2626]">Loading RentFlow Suite...</p>
      </div>
    );
  }

  interface SidebarNav {
    id: "dashboard" | "apartments" | "tenants" | "billing" | "maintenance" | "payments" | "logs";
    label: string;
    icon: React.ComponentType<any>;
    badge?: string;
  }

  const pendingMaintenanceCount = (db?.maintenanceRequests || []).filter(
    (t) => t.status === "pending"
  ).length;

  const sidebarItems: SidebarNav[] = [
    { id: "dashboard", label: "Operations Panel", icon: LayoutDashboard },
    { id: "apartments", label: "Buildings & Rooms", icon: Building },
    { id: "tenants", label: "Tenant Directory", icon: Users },
    { id: "billing", label: "Financial Ledgers", icon: FileText },
    { 
      id: "maintenance", 
      label: "Maintenance", 
      icon: Wrench,
      badge: pendingMaintenanceCount > 0 ? String(pendingMaintenanceCount) : undefined
    },
    { 
      id: "payments", 
      label: "Payment Verification", 
      icon: ShieldCheck,
      badge: pendingPaymentCount > 0 ? String(pendingPaymentCount) : undefined 
    },
    { id: "logs", label: "Transaction Logs", icon: Activity },
  ];

  const currentTabLabel = sidebarItems.find(item => item.id === activeTab)?.label || "Administration";

  const renderActiveTabContent = () => {
    if (!db) return null;
    switch (activeTab) {
      case "dashboard":
        return <Dashboard db={db} onRefresh={fetchDB} pendingPaymentCount={pendingPaymentCount} onNavigateToMaintenance={() => setActiveTab("maintenance")} />;
      case "apartments":
        return <Apartments db={db} onRefresh={fetchDB} />;
      case "tenants":
        return <Tenants db={db} onRefresh={fetchDB} />;
      case "billing":
        return <Billing db={db} onRefresh={fetchDB} />;
      case "maintenance":
        return <Maintenance db={db} onRefresh={fetchDB} />;
      case "payments":
        return <PaymentVerification token={token} onRefresh={fetchDB} />;
      case "logs":
        return <TransactionLogs logs={db.transactionLogs || []} onRefresh={fetchDB} onClearLogs={handleClearLogs} />;
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-white flex text-slate-900">
      
      {/* Desktop Sidebar (White Neumorphic - Compact) */}
      <aside className="hidden lg:flex flex-col w-56 bg-white text-slate-900 shrink-0 border-r border-slate-200/80 shadow-[4px_0_16px_rgba(0,0,0,0.03)] relative z-30">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 neu-flat flex items-center justify-center text-[#8B2626] rounded-lg">
              <Building className="w-4 h-4 text-[#8B2626]" />
            </div>
            <span className="text-base font-black tracking-tight text-slate-900">
              Apartment<span className="text-[#EF6905]">Pro</span>
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-lg transition-all duration-150 ${
                  isActive
                    ? "active !bg-[#EF6905] !text-white !border-[#c2410c] shadow-xs font-extrabold"
                    : "neu-btn text-slate-900 hover:text-[#EF6905]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "!text-white" : "text-slate-800"}`} />
                  <span className="text-xs">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`min-w-4.5 h-4.5 px-1 flex items-center justify-center text-[10px] font-black rounded-full ${
                    isActive ? "bg-white text-[#EF6905]" : "bg-[#EF6905] text-white"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Manager Account Profile Foot */}
        <div className="mt-auto p-3 border-t border-slate-200/80">
          <div className="neu-pressed rounded-lg p-2.5 mb-2 bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 neu-flat rounded-full flex items-center justify-center font-bold text-xs text-[#EF6905]">
                AU
              </div>
              <div className="text-xs truncate">
                <div className="font-bold text-slate-950 truncate">Admin User</div>
                <div className="text-[10px] text-slate-600 font-medium truncate">Property Manager</div>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 neu-btn text-xs font-bold rounded-lg"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout Portal</span>
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay navigation */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative flex flex-col w-72 max-w-xs bg-white text-slate-900 h-full z-10 shadow-2xl"
            >
              <div className="p-5 border-b border-slate-200/80 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 neu-flat rounded-xl flex items-center justify-center text-[#8B2626]">
                    <Building className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-slate-900 text-base">Apartment<span className="text-[#EF6905]">Pro</span></span>
                </div>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="w-8 h-8 neu-btn flex items-center justify-center rounded-lg text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-4 space-y-2.5 overflow-y-auto">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                        isActive
                          ? "active !bg-[#EF6905] !text-white !border-[#c2410c] shadow-md font-extrabold"
                          : "neu-btn text-slate-900 hover:text-[#EF6905]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${isActive ? "!text-white" : "text-slate-800"}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`min-w-5 h-5 px-1.5 flex items-center justify-center text-xs font-black rounded-full ${
                          isActive ? "bg-white text-[#EF6905]" : "bg-[#EF6905] text-white"
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-slate-200/80">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 neu-btn text-sm font-bold rounded-xl"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout Portal</span>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Workspace Frame container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
        {/* Top Header */}
        <header className="h-13 bg-white border-b border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            {/* Hamburger for mobile screens */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 -ml-1 text-slate-600 hover:text-slate-950 lg:hidden rounded-lg neu-btn"
            >
              <Menu className="w-4 h-4" />
            </button>
            
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">{currentTabLabel}</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Manual Database Refresh */}
            <button
              onClick={fetchDB}
              disabled={refreshing}
              className="w-8 h-8 neu-btn rounded-lg flex items-center justify-center text-[#EF6905] hover:text-[#8B2626] transition-all"
              title="Synchronize Database ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#8B2626]" : ""}`} />
            </button>

            {/* Notification Bell Icon & Combined Notification Popover */}
            <NotificationCenter
              db={db}
              pendingPaymentCount={pendingPaymentCount}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />

            <div className="w-px h-5 bg-slate-200" />

            <Link
              to="/"
              className="text-xs font-bold text-[#EF6905] neu-btn px-2.5 py-1.5 rounded-lg hover:text-[#8B2626] transition-all flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5 text-[#EF6905]" />
              <span>Public Site</span>
            </Link>
          </div>
        </header>

        {/* Content body layout with layout-shift support */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 max-w-7xl w-full mx-auto bg-white">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {renderActiveTabContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public view */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        
        {/* Admin portal (handles /dashboard & /admin checks) */}
        <Route path="/dashboard" element={<AdminPortal />} />
        <Route path="/admin" element={<AdminPortal />} />

        {/* Fallback redirect to public landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Chatbot />
    </BrowserRouter>
  );
}
