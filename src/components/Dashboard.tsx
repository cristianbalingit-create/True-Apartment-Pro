import React, { useEffect, useState } from "react";
import { DBState, api } from "../lib/api";
import { MaintenanceRequest } from "../types";
import { Users, Building, DollarSign, FileText, AlertTriangle, Bell, MessageSquare, ArrowRight, Check, Eye, HelpCircle, TrendingUp, Sparkles, Activity, Clock, ChevronDown, ShieldCheck } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { motion } from "motion/react";
import MaintenanceReportViewer from "./MaintenanceReportViewer";

interface DashboardProps {
  db: DBState;
  onRefresh: () => void;
  onNavigateToMaintenance?: () => void;
  pendingPaymentCount?: number;
}

export default function Dashboard({ db, onRefresh, onNavigateToMaintenance, pendingPaymentCount = 0 }: DashboardProps) {
  const [loading, setLoading] = useState(false);
  const [selectedTicketForViewer, setSelectedTicketForViewer] = useState<MaintenanceRequest | null>(null);
  const [selectedApartmentId, setSelectedApartmentId] = useState<string>("all");

  // Operations Panel filter: every metric/chart/list below is scoped to the selected apartment.
  const apartmentRoomIds = selectedApartmentId === "all"
    ? new Set(db.rooms.map((r) => r.id))
    : new Set(db.rooms.filter((r) => r.apartment_id === selectedApartmentId).map((r) => r.id));
  const filteredRooms = selectedApartmentId === "all"
    ? db.rooms
    : db.rooms.filter((r) => r.apartment_id === selectedApartmentId);
  const filteredTenants = selectedApartmentId === "all"
    ? db.tenants
    : db.tenants.filter((t) => t.apartment_id === selectedApartmentId || apartmentRoomIds.has(t.room_id));
  const filteredBillingRecords = selectedApartmentId === "all"
    ? db.billingRecords
    : db.billingRecords.filter((b) => b.apartment_id === selectedApartmentId || apartmentRoomIds.has(b.room_id));
  const filteredMaintenanceRequests = selectedApartmentId === "all"
    ? (db.maintenanceRequests || [])
    : (db.maintenanceRequests || []).filter((ticket) => {
        if (ticket.room_id && apartmentRoomIds.has(ticket.room_id)) return true;
        const tenant = ticket.tenant_id ? db.tenants.find((t) => t.id === ticket.tenant_id) : null;
        return !!tenant && (tenant.apartment_id === selectedApartmentId || apartmentRoomIds.has(tenant.room_id));
      });
  const filteredInquiries = selectedApartmentId === "all"
    ? (db.inquiries || [])
    : (db.inquiries || []).filter((inq) => apartmentRoomIds.has(inq.room_id));
  const filteredTransactionLogs = selectedApartmentId === "all"
    ? (db.transactionLogs || [])
    : (db.transactionLogs || []).filter((log) =>
        (log.tenant_id && filteredTenants.some((t) => t.id === log.tenant_id)) ||
        (log.room_number && filteredRooms.some((r) => r.room_number === log.room_number))
      );

  useEffect(() => {
    if (selectedApartmentId !== "all" && !db.apartments.some((a) => a.id === selectedApartmentId && a.status === "active")) {
      setSelectedApartmentId("all");
    }
  }, [db.apartments, selectedApartmentId]);

  // Keep selected ticket fresh if database changes
  const activeSelectedTicket = selectedTicketForViewer 
    ? (filteredMaintenanceRequests || []).find((t) => t.id === selectedTicketForViewer.id) || selectedTicketForViewer 
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

  // Stats calculation (scoped to the selected apartment)
  const totalRooms = filteredRooms.length;
  const occupiedRooms = filteredRooms.filter((r) => r.status === "occupied").length;
  const vacantRooms = filteredRooms.filter((r) => r.status === "vacant").length;
  const maintenanceRooms = filteredRooms.filter((r) => r.status === "maintenance").length;

  const activeTenantsCount = filteredTenants.filter((t) => t.status === "active").length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // Monthly Revenue: Sum of rent amount for occupied rooms in the selected scope.
  const monthlyRevenue = filteredRooms
    .filter((r) => r.status === "occupied")
    .reduce((sum, r) => sum + (Number(r.rent_amount) || 0), 0);

  // Pending Bills
  const pendingBills = filteredBillingRecords.filter(
    (b) => b.payment_status === "unpaid" || b.payment_status === "overdue"
  );
  const pendingBillsCount = pendingBills.length;

  // Room status data for Pie Chart
  const roomStatusData = [
    { name: "Occupied", value: occupiedRooms, color: "#8B2626" },
    { name: "Vacant", value: vacantRooms, color: "#EF6905" },
    { name: "Maintenance", value: maintenanceRooms, color: "#F1E5A1" }
  ].filter(item => item.value > 0);

  // Billing status data for Bar Chart
  const paidCount = filteredBillingRecords.filter((b) => b.payment_status === "paid").length;
  const unpaidCount = filteredBillingRecords.filter((b) => b.payment_status === "unpaid").length;
  const partialCount = filteredBillingRecords.filter((b) => b.payment_status === "partial").length;
  const overdueCount = filteredBillingRecords.filter((b) => b.payment_status === "overdue").length;

  const billingOverviewData = [
    { name: "Paid", count: paidCount, color: "#EF6905" },
    { name: "Unpaid", count: unpaidCount, color: "#F1E5A1" },
    { name: "Partial", count: partialCount, color: "#F1E5A1" },
    { name: "Overdue", count: overdueCount, color: "#8B2626" }
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
    <div className="space-y-4">
      {/* Context header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">Operations Panel</h1>
          <p className="text-slate-500 text-xs mt-0.5">Monitor property activity, tenants, billing, and incoming requests.</p>
        </div>
        <div className="flex items-center gap-2 lg:ml-auto">
          <label htmlFor="operations-apartment-filter" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Apartment</label>
          <div className="relative min-w-[220px] sm:min-w-[260px]">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-orange pointer-events-none" />
            <select
              id="operations-apartment-filter"
              value={selectedApartmentId}
              onChange={(e) => setSelectedApartmentId(e.target.value)}
              className="w-full appearance-none pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
              aria-label="Filter Operations Panel by apartment"
            >
              <option value="all">All Apartments</option>
              {db.apartments.filter((apt) => apt.status === "active").map((apt) => (
                <option key={apt.id} value={apt.id}>{apt.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Stats Bento Grid - Neumorphic Cards (Compact) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Stat Card 1: Active Tenants */}
        <div className="neu-card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Active Tenants</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 block mt-0.5">{activeTenantsCount}</span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">In Good Standing</span>
          </div>
          <div className="w-9 h-9 neu-pressed flex items-center justify-center text-brand-orange rounded-xl">
            <Users className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Stat Card 2: Occupancy Rate */}
        <div className="neu-card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Occupancy Rate</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 block mt-0.5">{occupancyRate}%</span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              {occupiedRooms} / {totalRooms} rooms let
            </span>
          </div>
          <div className="w-9 h-9 neu-pressed flex items-center justify-center text-emerald-600 rounded-xl">
            <Building className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Stat Card 3: Pending Bills */}
        <div className="neu-card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Pending Bills</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 block mt-0.5">{pendingBillsCount}</span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">Unpaid or Overdue</span>
          </div>
          <div className="w-9 h-9 neu-pressed flex items-center justify-center text-amber-600 rounded-xl">
            <FileText className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>

      {/* Visual Charts Section (Compact) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Room Status Breakdown (Pie Chart) */}
        <div className="neu-card p-3.5 lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">Room Allocation</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Real-time status of lease catalog.</p>
          </div>
          
          <div className="h-40 relative my-2 flex items-center justify-center">
            {roomStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roomStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
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
              <span className="text-lg font-black text-slate-900">{totalRooms}</span>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Total Rooms</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-200">
            <div className="neu-pressed p-1.5 rounded-lg text-center">
              <div className="w-2 h-2 rounded-full bg-brand-orange mx-auto mb-0.5" />
              <div className="text-xs font-bold text-slate-900">{occupiedRooms}</div>
              <div className="text-[9px] text-slate-500 font-medium">Occupied</div>
            </div>
            <div className="neu-pressed p-1.5 rounded-lg text-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mx-auto mb-0.5" />
              <div className="text-xs font-bold text-slate-900">{vacantRooms}</div>
              <div className="text-[9px] text-slate-500 font-medium">Vacant</div>
            </div>
            <div className="neu-pressed p-1.5 rounded-lg text-center">
              <div className="w-2 h-2 rounded-full bg-rose-500 mx-auto mb-0.5" />
              <div className="text-xs font-bold text-slate-900">{maintenanceRooms}</div>
              <div className="text-[9px] text-slate-500 font-medium">Repairs</div>
            </div>
          </div>
        </div>

        {/* Financial Billing Status (Bar Chart) */}
        <div className="neu-card p-3.5 lg:col-span-2 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Billing & Receivables Status</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Real-time compilation of accounts receivable invoices.</p>
            </div>
            <div className="neu-pressed px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold text-emerald-700">
              Est. Monthly Rent: ₱{monthlyRevenue.toLocaleString()}
            </div>
          </div>

          <div className="h-44 my-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={billingOverviewData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} stroke="#cbd5e1" />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                <Tooltip formatter={(value) => [`${value} Invoices`, 'Count']} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {billingOverviewData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
            <span className="text-slate-500 text-[11px]">Total Invoices Logged: <strong>{filteredBillingRecords.length}</strong></span>
            <div className="flex gap-1.5">
              <span className="neu-pressed px-2 py-0.5 rounded-md text-emerald-700 font-bold text-[10px]">Paid: {paidCount}</span>
              <span className="neu-pressed px-2 py-0.5 rounded-md text-rose-700 font-bold text-[10px]">Overdue: {overdueCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inquiries & Audit Log Grid (Compact) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Customer Inquiries Card */}
        <div id="dashboard-inquiries" className="neu-card p-3.5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 neu-pressed rounded-lg flex items-center justify-center text-brand-orange">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">Guest & Prospective Inquiries</h3>
                <p className="text-[11px] text-slate-500">Inbound inquiries from visitors and public portal.</p>
              </div>
            </div>
            <span className="neu-pressed px-2 py-0.5 text-slate-700 text-[11px] font-bold rounded-md font-mono">
              {filteredInquiries.length} Total
            </span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(filteredInquiries.length === 0) ? (
              <div className="text-center py-6 text-slate-400 text-xs neu-pressed rounded-xl">
                <MessageSquare className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                No inquiries submitted yet.
              </div>
            ) : (
              filteredInquiries.slice(0, 5).map((inq) => (
                <div key={inq.id} className="p-2.5 neu-pressed rounded-lg space-y-1.5 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-900 text-xs">{inq.name}</span>
                      <p className="text-[10px] text-slate-500">
                        Rm {inq.room_number} • {inq.apartment_name}
                      </p>
                    </div>
                    <div>
                      {inq.status === "new" ? (
                        <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-bold rounded uppercase">
                          New
                        </span>
                      ) : inq.status === "contacted" ? (
                        <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded uppercase">
                          Contacted
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-slate-400 text-white text-[9px] font-bold rounded uppercase">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-700 text-[11px] leading-snug italic">"{inq.message}"</p>

                  <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-slate-600 border-t border-slate-200 pt-1.5 font-mono">
                    <span>📞 {inq.phone}</span>
                    <span>✉️ {inq.email}</span>
                    <span className="text-brand-orange font-semibold">📅 {inq.preferred_visit_date}</span>
                  </div>

                  {inq.status !== "closed" && (
                    <div className="flex gap-1.5 justify-end pt-1">
                      {inq.status === "new" && (
                        <button
                          onClick={() => handleInquiryAction(inq.id, "contacted")}
                          className="px-2.5 py-1 neu-btn text-slate-900 font-bold text-[11px] rounded-lg shadow-xs transition-all"
                        >
                          Mark Contacted
                        </button>
                      )}
                      <button
                        onClick={() => handleInquiryAction(inq.id, "closed")}
                        className="px-2.5 py-1 neu-btn text-slate-900 font-bold text-[11px] rounded-lg shadow-xs transition-all"
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
        <div className="neu-card p-3.5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 neu-pressed rounded-lg flex items-center justify-center text-blue-600">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">Recent Transaction Audit Trail</h3>
                <p className="text-[11px] text-slate-500">Live ledger of payments, room leases, and operations.</p>
              </div>
            </div>
            <span className="neu-pressed px-2 py-0.5 text-slate-700 text-[11px] font-bold rounded-md font-mono">
              {filteredTransactionLogs.length} Recorded
            </span>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {(filteredTransactionLogs.length === 0) ? (
              <div className="text-center py-8 text-slate-400 text-xs neu-pressed rounded-xl">
                <Activity className="w-7 h-7 mx-auto text-slate-400 mb-2" />
                No transaction logs recorded yet.
              </div>
            ) : (
              filteredTransactionLogs.slice(0, 6).map((log) => (
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
