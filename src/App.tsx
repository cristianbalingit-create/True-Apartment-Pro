import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { api, DBState } from "./lib/api";
import LandingPage from "./components/LandingPage";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import Chatbot from "./components/Chatbot";
import Apartments from "./components/Apartments";
import Tenants from "./components/Tenants";
import Billing from "./components/Billing";
import Maintenance from "./components/Maintenance";
import { TransactionLogs } from "./components/TransactionLogs";
import { 
  Building, LayoutDashboard, Users, FileText, Sparkles, LogOut, Menu, X, Bell, RefreshCw, Globe, ArrowRight, UserCheck, Wrench, Activity 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

function AdminPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(localStorage.getItem("apartmentpro_token"));
  const [db, setDb] = useState<DBState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dashboard panel tab state
  const [activeTab, setActiveTab] = useState<"dashboard" | "apartments" | "tenants" | "billing" | "maintenance" | "logs">("dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDB();
    }
  }, [token]);

  const fetchDB = async () => {
    try {
      setRefreshing(true);
      const data = await api.getDB();
      setDb(data);
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
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-400">
        <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-mono text-xs tracking-widest uppercase font-bold text-slate-300">Initializing ApartmentPro Suite...</p>
      </div>
    );
  }

  interface SidebarNav {
    id: "dashboard" | "apartments" | "tenants" | "billing" | "maintenance" | "logs";
    label: string;
    icon: React.ComponentType<any>;
    badge?: string;
  }

  const sidebarItems: SidebarNav[] = [
    { id: "dashboard", label: "Operations Panel", icon: LayoutDashboard },
    { id: "apartments", label: "Buildings & Rooms", icon: Building },
    { id: "tenants", label: "Tenant Directory", icon: Users },
    { id: "billing", label: "Financial Ledgers", icon: FileText },
    { id: "maintenance", label: "Service & Rules", icon: Wrench },
    { id: "logs", label: "Transaction Logs", icon: Activity },
  ];

  const currentTabLabel = sidebarItems.find(item => item.id === activeTab)?.label || "Administration";

  const renderActiveTabContent = () => {
    if (!db) return null;
    switch (activeTab) {
      case "dashboard":
        return <Dashboard db={db} onRefresh={fetchDB} />;
      case "apartments":
        return <Apartments db={db} onRefresh={fetchDB} />;
      case "tenants":
        return <Tenants db={db} onRefresh={fetchDB} />;
      case "billing":
        return <Billing db={db} onRefresh={fetchDB} />;
      case "maintenance":
        return <Maintenance db={db} onRefresh={fetchDB} />;
      case "logs":
        return <TransactionLogs logs={db.transactionLogs || []} onRefresh={fetchDB} onClearLogs={handleClearLogs} />;
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex">
      
      {/* Desktop Sidebar (Fixed Dark Navy) */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-300 shrink-0 border-r border-slate-850 relative z-30">
        {/* Brand Header */}
        <div className="flex items-center gap-3 p-6 text-brand-orange font-bold text-xl border-b border-slate-850">
          <Building className="w-8 h-8" />
          <span className="text-white">Apartment<span className="text-brand-orange">Pro</span></span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all duration-150 relative group ${
                  isActive
                    ? "bg-brand-orange text-white shadow-md shadow-orange-950/20"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
                  <span className={isActive ? "text-white font-bold" : ""}>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-1.5 py-0.5 text-[9px] font-black rounded tracking-widest uppercase ${
                    isActive ? "bg-white/25 text-white" : "bg-brand-orange/20 text-brand-orange"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Manager Account Profile Foot */}
        <div className="mt-auto p-6 border-t border-slate-850">
          <div className="bg-slate-800 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center font-bold text-xs text-white">
                AU
              </div>
              <div className="text-xs">
                <div className="font-semibold text-white">Admin User</div>
                <div className="opacity-50 text-slate-400">Property Manager</div>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-950 hover:bg-slate-850 hover:text-white text-slate-400 font-medium text-xs rounded-xl border border-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative flex flex-col w-72 max-w-xs bg-brand-navy text-slate-300 h-full relative z-10"
            >
              <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-brand-orange text-white rounded-lg">
                    <Building className="w-5 h-5" />
                  </div>
                  <span className="font-extrabold text-white text-lg">ApartmentPro</span>
                </div>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-4 space-y-1.5">
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
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                        isActive
                          ? "bg-brand-orange text-white font-bold shadow-md"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                        <span className={isActive ? "text-white font-bold" : ""}>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 text-[8px] font-black rounded uppercase ${
                          isActive ? "bg-white/25 text-white" : "bg-brand-orange/20 text-brand-orange"
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-slate-800 bg-slate-950/35 space-y-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 hover:bg-rose-950 hover:text-rose-200 text-slate-400 font-bold text-xs rounded-xl border border-slate-800 transition-colors"
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
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Hamburger for mobile screens */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-950 lg:hidden rounded-lg hover:bg-slate-50"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <h1 className="text-lg font-semibold text-slate-800">{currentTabLabel}</h1>
          </div>

          <div className="flex items-center gap-6">
            {/* Manual Database Refresh */}
            <button
              onClick={fetchDB}
              disabled={refreshing}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all relative"
              title="Synchronize Database ledger"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-brand-orange" : ""}`} />
            </button>

            {/* Notification indicators */}
            <div className="relative">
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                <Bell className="w-5 h-5" />
              </button>
              {db && db.notifications.length > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full" />
              )}
            </div>

            <div className="w-px h-6 bg-slate-200" />

            <Link
              to="/"
              className="text-sm font-medium text-brand-orange border border-brand-orange px-4 py-1.5 rounded-lg hover:bg-brand-orange hover:text-white transition-all"
            >
              View Public Site
            </Link>
          </div>
        </header>

        {/* Content body layout with layout-shift support */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
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
