import React, { useEffect, useState } from "react";
import { DBState, api } from "../lib/api";
import { MaintenanceRequest } from "../types";
import { Users, Building, DollarSign, FileText, AlertTriangle, Bell, MessageSquare, ArrowRight, Check, Eye, HelpCircle, TrendingUp, Sparkles, Activity, Clock } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { motion } from "motion/react";
import MaintenanceAlert from "./MaintenanceAlert";
import MaintenanceReportViewer from "./MaintenanceReportViewer";

interface DashboardProps {
  db: DBState;
  onRefresh: () => void;
  onNavigateToMaintenance?: () => void;
}

export default function Dashboard({ db, onRefresh, onNavigateToMaintenance }: DashboardProps) {
  const [loading, setLoading] = useState(false);
  const [selectedTicketForViewer, setSelectedTicketForViewer] = useState<MaintenanceRequest | null>(null);

  // Keep selected ticket fresh if database changes
  const activeSelectedTicket = selectedTicketForViewer 
    ? (db.maintenanceRequests || []).find((t) => t.id === selectedTicketForViewer.id) || selectedTicketForViewer 
    : null;

  const handleUpdateMaintStatus = async (ticketId: string, newStatus: "pending" | "in_progress" | "completed") => {
    try {
      setLoading(true);
      await api.updateMaintenanceRequest(ticketId, { status: newStatus });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaintTicket = async (ticketId: string) => {
    try {
      setLoading(true);
      await api.deleteMaintenanceRequest(ticketId);
      setSelectedTicketForViewer(null);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Stats calculation
  const totalRooms = db.rooms.length;
  const occupiedRooms = db.rooms.filter((r) => r.status === "occupied").length;
  const vacantRooms = db.rooms.filter((r) => r.status === "vacant").length;
  const maintenanceRooms = db.rooms.filter((r) => r.status === "maintenance").length;
  
  const activeTenantsCount = db.tenants.filter((t) => t.status === "active").length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  
  // Monthly Revenue: Sum of rent amount for all currently occupied rooms
  const monthlyRevenue = (db.rooms || [])
    .filter((r) => r.status === "occupied")
    .reduce((sum, r) => sum + (Number(r.rent_amount) || 0), 0);

  // Pending Bills
  const pendingBills = db.billingRecords.filter(
    (b) => b.payment_status === "unpaid" || b.payment_status === "overdue"
  );
  const pendingBillsCount = pendingBills.length;

  // Room status data for Pie Chart
  const roomStatusData = [
    { name: "Occupied", value: occupiedRooms, color: "#e73f1e" }, // Brand Crimson
    { name: "Vacant", value: vacantRooms, color: "#fb6c00" },     // Brand Orange
    { name: "Maintenance", value: maintenanceRooms, color: "#f9b637" } // Brand Amber
  ].filter(item => item.value > 0);

  // Billing status data for Bar Chart
  const paidCount = db.billingRecords.filter((b) => b.payment_status === "paid").length;
  const unpaidCount = db.billingRecords.filter((b) => b.payment_status === "unpaid").length;
  const partialCount = db.billingRecords.filter((b) => b.payment_status === "partial").length;
  const overdueCount = db.billingRecords.filter((b) => b.payment_status === "overdue").length;

  const billingOverviewData = [
    { name: "Paid", count: paidCount, color: "#fb6c00" },
    { name: "Unpaid", count: unpaidCount, color: "#f9b637" },
    { name: "Partial", count: partialCount, color: "#ffdd9c" },
    { name: "Overdue", count: overdueCount, color: "#e73f1e" }
  ];

  const handleInquiryAction = async (id: string, newStatus: "contacted" | "closed") => {
    try {
      setLoading(true);
      await api.updateInquiry(id, { status: newStatus });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Maintenance Alert Above the Dashboard */}
      <MaintenanceAlert
        tickets={db.maintenanceRequests || []}
        onNavigateToMaintenance={() => onNavigateToMaintenance && onNavigateToMaintenance()}
        onViewReport={(ticket) => setSelectedTicketForViewer(ticket)}
      />

      {/* Upper Welcome Header - Neumorphic Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 neu-card p-6 sm:p-7 relative overflow-hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">Operations Command Center</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Real-time telemetry and management controls for your properties and residents.
          </p>
        </div>
        <div className="flex items-center gap-2 neu-pressed px-3.5 py-2 rounded-xl font-mono text-xs text-slate-700">
          <Sparkles className="w-4 h-4 text-brand-orange" />
          <span>PORTFOLIO STATUS: <span className="text-emerald-600 font-bold">OPTIMAL</span></span>
        </div>
      </div>

      {/* Stats Bento Grid - Neumorphic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Stat Card 1: Active Tenants */}
        <div className="neu-card p-5 flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Active Tenants</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1">{activeTenantsCount}</span>
            <span className="text-xs text-slate-500 font-medium block mt-1">In Good Standing</span>
          </div>
          <div className="w-12 h-12 neu-pressed flex items-center justify-center text-brand-orange rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Stat Card 2: Occupancy Rate */}
        <div className="neu-card p-5 flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Occupancy Rate</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1">{occupancyRate}%</span>
            <span className="text-xs text-slate-500 font-medium block mt-1">
              {occupiedRooms} / {totalRooms} rooms let
            </span>
          </div>
          <div className="w-12 h-12 neu-pressed flex items-center justify-center text-emerald-600 rounded-xl">
            <Building className="w-6 h-6" />
          </div>
        </div>

        {/* Stat Card 3: Pending Bills */}
        <div className="neu-card p-5 flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Pending Bills</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1">{pendingBillsCount}</span>
            <span className="text-xs text-slate-500 font-medium block mt-1">Unpaid or Overdue</span>
          </div>
          <div className="w-12 h-12 neu-pressed flex items-center justify-center text-amber-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Room Status Breakdown (Pie Chart) */}
        <div className="neu-card p-5 lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Room Allocation</h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time status of lease catalog.</p>
          </div>
          
          <div className="h-52 relative my-3 flex items-center justify-center">
            {roomStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roomStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {roomStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Rooms`, 'Status']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 font-medium text-xs font-mono">No Room Data Available</div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-slate-900">{totalRooms}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Rooms</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-300/50">
            <div className="neu-pressed p-2 rounded-xl text-center">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-orange mx-auto mb-1" />
              <div className="text-xs font-bold text-slate-900">{occupiedRooms}</div>
              <div className="text-[10px] text-slate-500 font-medium">Occupied</div>
            </div>
            <div className="neu-pressed p-2 rounded-xl text-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mx-auto mb-1" />
              <div className="text-xs font-bold text-slate-900">{vacantRooms}</div>
              <div className="text-[10px] text-slate-500 font-medium">Vacant</div>
            </div>
            <div className="neu-pressed p-2 rounded-xl text-center">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mx-auto mb-1" />
              <div className="text-xs font-bold text-slate-900">{maintenanceRooms}</div>
              <div className="text-[10px] text-slate-500 font-medium">Repairs</div>
            </div>
          </div>
        </div>

        {/* Financial Billing Status (Bar Chart) */}
        <div className="neu-card p-5 lg:col-span-2 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Billing & Receivables Status</h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time compilation of accounts receivable invoices.</p>
            </div>
            <div className="neu-pressed px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-emerald-700">
              Est. Monthly Rent: ₱{monthlyRevenue.toLocaleString()}
            </div>
          </div>

          <div className="h-56 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={billingOverviewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} stroke="#cbd5e1" />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} stroke="#cbd5e1" />
                <Tooltip formatter={(value) => [`${value} Invoices`, 'Count']} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {billingOverviewData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-300/50 text-xs">
            <span className="text-slate-500 font-medium">Total Invoices Logged: <strong>{db.billingRecords.length}</strong></span>
            <div className="flex gap-2">
              <span className="neu-pressed px-2.5 py-1 rounded-lg text-emerald-700 font-bold text-[11px]">Paid: {paidCount}</span>
              <span className="neu-pressed px-2.5 py-1 rounded-lg text-rose-700 font-bold text-[11px]">Overdue: {overdueCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inquiries & Audit Log Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Customer Inquiries Card */}
        <div className="neu-card p-5">
          <div className="flex justify-between items-center border-b border-slate-300/50 pb-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 neu-pressed rounded-xl flex items-center justify-center text-brand-orange">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Guest & Prospective Inquiries</h3>
                <p className="text-xs text-slate-500">Inbound inquiries from visitors and public portal.</p>
              </div>
            </div>
            <span className="neu-pressed px-2.5 py-1 text-slate-700 text-xs font-bold rounded-lg font-mono">
              {(db.inquiries || []).length} Total
            </span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {(!db.inquiries || db.inquiries.length === 0) ? (
              <div className="text-center py-8 text-slate-400 text-xs neu-pressed rounded-xl">
                <MessageSquare className="w-7 h-7 mx-auto text-slate-400 mb-2" />
                No inquiries submitted yet.
              </div>
            ) : (
              db.inquiries.slice(0, 5).map((inq) => (
                <div key={inq.id} className="p-3.5 neu-pressed rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">{inq.name}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Rm {inq.room_number} • {inq.apartment_name}
                      </p>
                    </div>
                    <div>
                      {inq.status === "new" ? (
                        <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-md uppercase">
                          New
                        </span>
                      ) : inq.status === "contacted" ? (
                        <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-md uppercase">
                          Contacted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-400 text-white text-[10px] font-bold rounded-md uppercase">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-700 text-xs leading-relaxed italic">"{inq.message}"</p>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 border-t border-slate-300/50 pt-2 font-mono">
                    <span>📞 {inq.phone}</span>
                    <span>✉️ {inq.email}</span>
                    <span className="text-brand-orange font-semibold">📅 {inq.preferred_visit_date}</span>
                  </div>

                  {inq.status !== "closed" && (
                    <div className="flex gap-2 justify-end pt-1">
                      {inq.status === "new" && (
                        <button
                          onClick={() => handleInquiryAction(inq.id, "contacted")}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg shadow-sm transition-all active:scale-95"
                        >
                          Mark Contacted
                        </button>
                      )}
                      <button
                        onClick={() => handleInquiryAction(inq.id, "closed")}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg shadow-sm transition-all active:scale-95"
                      >
                        Close Inquiry
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Transaction Activity Audit Card */}
        <div className="neu-card p-5">
          <div className="flex justify-between items-center border-b border-slate-300/50 pb-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 neu-pressed rounded-xl flex items-center justify-center text-blue-600">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Recent Transaction Audit Trail</h3>
                <p className="text-xs text-slate-500">Live ledger of payments, room leases, and operations.</p>
              </div>
            </div>
            <span className="neu-pressed px-2.5 py-1 text-slate-700 text-xs font-bold rounded-lg font-mono">
              {(db.transactionLogs || []).length} Recorded
            </span>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {(!db.transactionLogs || db.transactionLogs.length === 0) ? (
              <div className="text-center py-8 text-slate-400 text-xs neu-pressed rounded-xl">
                <Activity className="w-7 h-7 mx-auto text-slate-400 mb-2" />
                No transaction logs recorded yet.
              </div>
            ) : (
              db.transactionLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="p-3 neu-pressed rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900">{log.title}</span>
                      {log.room_number && (
                        <span className="bg-slate-300/70 text-slate-800 px-1.5 py-0.2 rounded text-[10px] font-mono">
                          Rm {log.room_number}
                        </span>
                      )}
                      {log.tenant_name && (
                        <span className="text-slate-500 font-medium">
                          • {log.tenant_name}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-[11px]">{log.details}</p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-300/40">
                    {log.amount && log.amount > 0 && (
                      <span className="text-emerald-700 font-bold text-xs font-mono bg-emerald-100/60 px-2 py-0.5 rounded">
                        ₱{log.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Full Maintenance Report Modal Viewer */}
      {activeSelectedTicket && (
        <MaintenanceReportViewer
          ticket={activeSelectedTicket}
          onClose={() => setSelectedTicketForViewer(null)}
          onUpdateStatus={handleUpdateMaintStatus}
          onDelete={handleDeleteMaintTicket}
        />
      )}
    </div>
  );
}
