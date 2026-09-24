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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-slate-700">
        <div className="w-16 h-16 neu-pressed rounded-full flex items-center justify-center mb-4">
          <div className="w-8 h-8 border-3 border-[#fb6c00] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="font-mono text-xs tracking-widest uppercase font-bold text-[#e73f1e]">Loading ApartmentPro Suite...</p>
      </div>
    );
  }

  interface SidebarNav {
    id: "dashboard" | "apartments" | "tenants" | "billing" | "maintenance" | "logs";
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
    { id: "logs", label: "Transaction Logs", icon: Activity },
  ];

  const currentTabLabel = sidebarItems.find(item => item.id === activeTab)?.label || "Administration";

  const renderActiveTabContent = () => {
    if (!db) return null;
    switch (activeTab) {
      case "dashboard":
        return <Dashboard db={db} onRefresh={fetchDB} onNavigateToMaintenance={() => setActiveTab("maintenance")} />;
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
    <div className="h-screen overflow-hidden bg-white flex text-slate-900">
      
      {/* Desktop Sidebar (White Neumorphic) */}
      <aside className="hidden lg:flex flex-col w-64 bg-white text-slate-900 shrink-0 border-r border-slate-200/80 shadow-[4px_0_16px_rgba(0,0,0,0.03)] relative z-30">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 neu-flat flex items-center justify-center text-[#e73f1e] rounded-xl">
              <Building className="w-5 h-5 text-[#e73f1e]" />
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900">
              Apartment<span className="text-[#fb6c00]">Pro</span>
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-2.5 overflow-y-auto">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all duration-150 ${
                  isActive
                    ? "neu-pressed text-[#e73f1e] font-extrabold border border-[#e73f1e]/30 bg-[#fff5f2]"
                    : "neu-btn text-slate-700 hover:text-[#fb6c00]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#e73f1e]" : "text-[#fb6c00]"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`min-w-5 h-5 px-1.5 flex items-center justify-center text-[10px] font-black rounded-full ${
                    isActive ? "bg-[#e73f1e] text-white" : "bg-[#fb6c00] text-white"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Manager Account Profile Foot */}
        <div className="mt-auto p-4 border-t border-slate-200/80">
          <div className="neu-pressed rounded-xl p-3 mb-3 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 neu-flat rounded-full flex items-center justify-center font-bold text-xs text-[#e73f1e]">
                AU
              </div>
              <div className="text-xs truncate">
                <div className="font-bold text-slate-900 truncate">Admin User</div>
                <div className="text-[11px] text-slate-500 truncate">Property Manager</div>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 neu-btn-danger text-xs font-bold rounded-xl"
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
                  <div className="w-8 h-8 neu-flat rounded-xl flex items-center justify-center text-[#e73f1e]">
                    <Building className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-slate-900 text-base">Apartment<span className="text-[#fb6c00]">Pro</span></span>
                </div>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="w-8 h-8 neu-btn flex items-center justify-center rounded-lg text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
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
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                        isActive
                          ? "neu-pressed text-[#e73f1e] font-extrabold border border-[#e73f1e]/30 bg-[#fff5f2]"
                          : "neu-btn text-slate-700 hover:text-[#fb6c00]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? "text-[#e73f1e]" : "text-[#fb6c00]"}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`min-w-4 h-4 px-1 flex items-center justify-center text-[9px] font-black rounded-full ${
                          isActive ? "bg-[#e73f1e] text-white" : "bg-[#fb6c00] text-white"
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
                  className="w-full flex items-center justify-center gap-2 py-2 neu-btn-danger text-xs font-bold rounded-xl"
                >
                  <LogOut className="w-3.5 h-3.5" />
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
        <header className="h-16 bg-white border-b border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center justify-between px-6 sm:px-8 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Hamburger for mobile screens */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-950 lg:hidden rounded-lg neu-btn"
            >
              <Menu className="w-4 h-4" />
            </button>
            
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{currentTabLabel}</h1>
          </div>

          <div className="flex items-center gap-4 sm:gap-5">
            {/* Manual Database Refresh */}
            <button
              onClick={fetchDB}
              disabled={refreshing}
              className="w-9 h-9 neu-btn rounded-xl flex items-center justify-center text-[#fb6c00] hover:text-[#e73f1e] transition-all"
              title="Synchronize Database ledger"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#e73f1e]" : ""}`} />
            </button>

            {/* Notification indicators */}
            <div className="relative">
              <button className="w-9 h-9 neu-btn rounded-xl flex items-center justify-center text-[#fb6c00] hover:text-[#e73f1e] transition-all">
                <Bell className="w-4 h-4" />
              </button>
              {db && db.notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#e73f1e] rounded-full shadow-[0_0_6px_rgba(231,63,30,0.6)]" />
              )}
            </div>

            <div className="w-px h-6 bg-slate-200" />

            <Link
              to="/"
              className="text-xs font-bold text-[#fb6c00] neu-btn px-3 py-1.5 rounded-xl hover:text-[#e73f1e] transition-all flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5 text-[#fb6c00]" />
              <span>Public Site</span>
            </Link>
          </div>
        </header>

        {/* Content body layout with layout-shift support */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto bg-white">
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
