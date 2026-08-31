import React, { useEffect, useState } from "react";
import { DBState, api } from "../lib/api";
import { Users, Building, DollarSign, FileText, AlertTriangle, Bell, MessageSquare, ArrowRight, Check, Eye, HelpCircle, TrendingUp, Sparkles, Activity, Clock } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { motion } from "motion/react";

interface DashboardProps {
  db: DBState;
  onRefresh: () => void;
}

export default function Dashboard({ db, onRefresh }: DashboardProps) {
  const [loading, setLoading] = useState(false);

  // Stats calculation
  const totalRooms = db.rooms.length;
  const occupiedRooms = db.rooms.filter((r) => r.status === "occupied").length;
  const vacantRooms = db.rooms.filter((r) => r.status === "vacant").length;
  const maintenanceRooms = db.rooms.filter((r) => r.status === "maintenance").length;
  
  const activeTenantsCount = db.tenants.filter((t) => t.status === "active").length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  
  // Monthly Revenue: Sum of rent amount for all currently occupied rooms
  const monthlyRevenue = db.rooms
    .filter((r) => r.status === "occupied")
    .reduce((sum, r) => sum + r.rent_amount, 0);

  // Pending Bills
  const pendingBills = db.billingRecords.filter(
    (b) => b.payment_status === "unpaid" || b.payment_status === "overdue"
  );
  const pendingBillsCount = pendingBills.length;

  // Overdue Bills
  const overdueBills = db.billingRecords.filter((b) => b.payment_status === "overdue");

  // Room status data for Pie Chart
  const roomStatusData = [
    { name: "Occupied", value: occupiedRooms, color: "#f97316" }, // Brand Orange
    { name: "Vacant", value: vacantRooms, color: "#10b981" },     // Emerald
    { name: "Maintenance", value: maintenanceRooms, color: "#ef4444" } // Rose
  ].filter(item => item.value > 0);

  // Billing status data for Bar Chart
  const paidCount = db.billingRecords.filter((b) => b.payment_status === "paid").length;
  const unpaidCount = db.billingRecords.filter((b) => b.payment_status === "unpaid").length;
  const partialCount = db.billingRecords.filter((b) => b.payment_status === "partial").length;
  const overdueCount = db.billingRecords.filter((b) => b.payment_status === "overdue").length;

  const billingOverviewData = [
    { name: "Paid", count: paidCount, color: "#10b981" },
    { name: "Unpaid", count: unpaidCount, color: "#3b82f6" },
    { name: "Partial", count: partialCount, color: "#f59e0b" },
    { name: "Overdue", count: overdueCount, color: "#ef4444" }
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

  const handleSendReminder = async (billId: string) => {
    try {
      setLoading(true);
      const bill = db.billingRecords.find((b) => b.id === billId);
      if (bill) {
        // Create custom reminder notification
        await api.createBilling({
          ...bill,
          notes: `${bill.notes}\n[System Reminder Sent: ${new Date().toLocaleDateString()}]`
        });
        alert(`Friendly reminder generated in-app for tenant ${bill.tenant_name}`);
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Upper Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-8 rounded-2xl shadow-sm relative overflow-hidden">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Management Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Welcome back, Property Administrator. Here is the operational health of your portfolio.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800 px-4 py-2.5 rounded-xl font-mono text-xs">
          <Sparkles className="w-4 h-4 text-brand-orange" />
          <span>PORTFOLIO STATUS: <span className="text-emerald-400 font-bold">OPTIMAL</span></span>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stat Card 1: Active Tenants */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Active Tenants</span>
            <span className="text-3xl font-bold text-slate-900 block mt-1">{activeTenantsCount}</span>
            <span className="text-xs text-slate-500 font-medium block mt-1">In Good Standing</span>
          </div>
          <div className="p-4 bg-brand-orange/10 text-brand-orange rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Stat Card 2: Occupancy Rate */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Occupancy Rate</span>
            <span className="text-3xl font-bold text-slate-900 block mt-1">{occupancyRate}%</span>
            <span className="text-xs text-slate-500 font-medium block mt-1">
              {occupiedRooms} / {totalRooms} rooms let
            </span>
          </div>
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Building className="w-6 h-6" />
          </div>
        </div>

        {/* Stat Card 3: Pending Bills */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Pending Bills</span>
            <span className="text-3xl font-bold text-slate-900 block mt-1">{pendingBillsCount}</span>
            <span className="text-xs text-slate-500 font-medium block mt-1">Unpaid or Overdue</span>
          </div>
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Room Status Breakdown (Pie Chart) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Room Allocation</h3>
            <p className="text-xs text-slate-400 mt-0.5">Real-time status of lease catalog.</p>
          </div>
          
          <div className="h-56 relative my-4 flex items-center justify-center">
            {roomStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roomStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
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
              <div className="text-slate-300 font-medium text-xs font-mono">No Room Data Available</div>
            )}
            <div className="absolute text-center">
              <span className="block text-2xl font-bold text-slate-800">{totalRooms}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Rooms</span>
            </div>
          </div>

          <div className="flex justify-around border-t border-slate-100 pt-4 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-orange block" />
              <span>Occupied ({occupiedRooms})</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block" />
              <span>Vacant ({vacantRooms})</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block" />
              <span>Maint. ({maintenanceRooms})</span>
            </div>
          </div>
        </div>

        {/* Invoices Breakdown (Bar Chart) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Billing Matrix</h3>
            <p className="text-xs text-slate-400 mt-0.5">Categorization of rent and utility statements.</p>
          </div>

          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={billingOverviewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(249, 115, 22, 0.05)' }} formatter={(value) => [`${value} Invoices`, 'Count']} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {billingOverviewData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-around border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
            <span>Paid: {paidCount}</span>
            <span>Unpaid: {unpaidCount}</span>
            <span>Partial: {partialCount}</span>
            <span className="text-rose-600">Overdue: {overdueCount}</span>
          </div>
        </div>
      </div>

      {/* inquiries Panel */}
      <div className="grid grid-cols-1 gap-6">
        {/* inquiries panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Leasing inquiries</h3>
              <p className="text-xs text-slate-400 mt-0.5">Prospective tenant viewing schedulers.</p>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg font-mono">
              {db.inquiries.length} Total
            </span>
          </div>

          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
            {db.inquiries.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                No tenant inquiries currently logged.
              </div>
            ) : (
              db.inquiries.map((inq) => (
                <div key={inq.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900">{inq.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Rm {inq.room_number} • {inq.apartment_name}
                      </p>
                    </div>
                    <div>
                      {inq.status === "new" ? (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md uppercase">
                          New Inquiry
                        </span>
                      ) : inq.status === "contacted" ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md uppercase">
                          Contacted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-md uppercase">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-600 text-xs leading-relaxed font-light italic">"{inq.message}"</p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 border-t border-slate-200/50 pt-2 font-mono">
                    <span>📞 {inq.phone}</span>
                    <span>✉️ {inq.email}</span>
                    <span className="text-brand-orange font-semibold">📅 Visit: {inq.preferred_visit_date}</span>
                  </div>

                  {inq.status !== "closed" && (
                    <div className="flex gap-2 justify-end pt-1">
                      {inq.status === "new" && (
                        <button
                           onClick={() => handleInquiryAction(inq.id, "contacted")}
                           className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg transition-colors shadow-sm"
                        >
                          Mark Contacted
                        </button>
                      )}
                      <button
                        onClick={() => handleInquiryAction(inq.id, "closed")}
                        className="px-3 py-1 bg-slate-950 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg transition-colors shadow-sm"
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
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Recent Transaction Audit Trail</h3>
                <p className="text-xs text-slate-400 mt-0.5">Live recording of financial payments, room leases, and operations.</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg font-mono">
              {(db.transactionLogs || []).length} Recorded
            </span>
          </div>

          <div className="space-y-3">
            {(!db.transactionLogs || db.transactionLogs.length === 0) ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                No transaction logs recorded yet.
              </div>
            ) : (
              db.transactionLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-100/70 transition">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{log.title}</span>
                      {log.room_number && (
                        <span className="bg-slate-200/60 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
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

                  <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/50">
                    {log.amount && log.amount > 0 && (
                      <span className="text-emerald-700 font-bold text-xs font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        ₱{log.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 flex items-center space-x-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-300" />
                      <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
