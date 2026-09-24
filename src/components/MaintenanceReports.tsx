import React, { useMemo, useState } from "react";
import { DBState, api } from "../lib/api";
import { MaintenanceRequest } from "../types";
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  BarChart3,
  Calendar,
  Filter,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Tag,
  Trash2,
  X
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

interface MaintenanceReportsProps {
  db: DBState;
  onRefresh: () => void;
  standalone?: boolean;
}

type TimeFilter = "all" | "this_month" | "last_month" | "this_year";
type StatusFilter = "all" | "pending" | "in_progress" | "completed";

// Professional curated color palette using Color Hunt: #e73f1e #fb6c00 #f9b637 #ffdd9c
const CATEGORY_COLORS: Record<string, string> = {
  "Air Conditioning": "#fb6c00", // Brand Orange
  "Plumbing": "#e73f1e",         // Brand Crimson
  "Electrical": "#f9b637",       // Brand Amber
  "Internet": "#d97706",         // Dark Amber
  "Furniture": "#b45309",        // Cinnamon
  "Cleaning": "#15803d",         // Warm Emerald
  "Security": "#c2410c",         // Burnt Orange
  "Other": "#8c6753"             // Warm Mocha
};

const COLOR_WHEEL = [
  "#e73f1e", // Brand Crimson
  "#fb6c00", // Brand Orange
  "#f9b637", // Brand Amber
  "#d97706", // Dark Amber
  "#b45309", // Cinnamon
  "#15803d", // Warm Forest
  "#c2410c", // Burnt Orange
  "#8c6753", // Mocha
  "#e58e26", // Warm Ochre
  "#fa983a"  // Warm Peach
];

function getCategoryColor(category: string, index: number): string {
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  return COLOR_WHEEL[index % COLOR_WHEEL.length];
}

export default function MaintenanceReports({ db, onRefresh, standalone = false }: MaintenanceReportsProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Quick ticket creation form states
  const [newCategory, setNewCategory] = useState("Plumbing");
  const [customTagInput, setCustomTagInput] = useState("");
  const [newPriority, setNewPriority] = useState<"Critical" | "High" | "Medium" | "Low">("Medium");
  const [newRoom, setNewRoom] = useState("101");
  const [newTenantName, setNewTenantName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOccurredAt, setNewOccurredAt] = useState("Today");

  const rawTickets = db.maintenanceRequests || [];

  // Filtered maintenance requests based on time and status
  const filteredTickets = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return rawTickets.filter((ticket) => {
      // 1. Status Filter
      if (statusFilter !== "all" && ticket.status !== statusFilter) {
        return false;
      }

      // 2. Time Filter
      if (timeFilter !== "all" && ticket.created_at) {
        const ticketDate = new Date(ticket.created_at);
        if (isNaN(ticketDate.getTime())) return true;

        if (timeFilter === "this_month") {
          return (
            ticketDate.getFullYear() === currentYear &&
            ticketDate.getMonth() === currentMonth
          );
        }
        if (timeFilter === "last_month") {
          const targetMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const targetYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          return (
            ticketDate.getFullYear() === targetYear &&
            ticketDate.getMonth() === targetMonth
          );
        }
        if (timeFilter === "this_year") {
          return ticketDate.getFullYear() === currentYear;
        }
      }

      return true;
    });
  }, [rawTickets, timeFilter, statusFilter]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const total = filteredTickets.length;
    const pending = filteredTickets.filter(t => t.status === "pending").length;
    const inProgress = filteredTickets.filter(t => t.status === "in_progress").length;
    const completed = filteredTickets.filter(t => t.status === "completed").length;
    const critical = filteredTickets.filter(t => (t.priority || "").toLowerCase() === "critical").length;

    return { total, pending, inProgress, completed, critical };
  }, [filteredTickets]);

  // Dynamic distribution by Category / Tag
  const dynamicChartData = useMemo(() => {
    const countsMap = new Map<string, { count: number; openCount: number }>();

    filteredTickets.forEach((t) => {
      const cat = (t.category || "General").trim();
      const existing = countsMap.get(cat) || { count: 0, openCount: 0 };
      existing.count += 1;
      if (t.status === "pending" || t.status === "in_progress") {
        existing.openCount += 1;
      }
      countsMap.set(cat, existing);
    });

    const total = filteredTickets.length;

    return Array.from(countsMap.entries())
      .map(([category, { count, openCount }], index) => ({
        category,
        count,
        openCount,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        fillColor: getCategoryColor(category, index)
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredTickets]);

  // Handle Quick Create Maintenance Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = newCategory === "CUSTOM"
      ? (customTagInput.trim() || "Custom Issue")
      : newCategory;

    if (!newDescription.trim()) return;

    try {
      setSaving(true);
      const matchedRoom = (db.rooms || []).find(r => r.room_number === newRoom);
      const matchedTenant = (db.tenants || []).find(t => t.name.toLowerCase() === newTenantName.toLowerCase() || t.room_id === matchedRoom?.id);

      await api.createMaintenanceRequest({
        category: finalCategory,
        issue_description: newDescription.trim(),
        priority: newPriority,
        room_number: newRoom.trim() || "101",
        room_id: matchedRoom?.id || "",
        tenant_name: newTenantName.trim() || matchedTenant?.name || "Apartment Tenant",
        tenant_id: matchedTenant?.id || "",
        occurred_at: newOccurredAt.trim() || "Today",
        location: `Room ${newRoom.trim() || "101"}`,
        status: "pending"
      });

      setNewDescription("");
      setCustomTagInput("");
      setNewCategory("Plumbing");
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to create maintenance report:", err);
      alert("Failed to submit maintenance report.");
    } finally {
      setSaving(false);
    }
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="neu-card p-3 shadow-lg text-xs space-y-1 bg-[#e2e8f0]">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: data.fillColor }}
            />
            <span>{data.category}</span>
          </div>
          <div className="text-slate-600 font-medium">
            Reports: <span className="font-bold text-slate-900">{data.count}</span> ({data.percentage}%)
          </div>
          <div className="text-slate-500 text-[11px]">
            Active/Open: <span className="text-amber-600 font-semibold">{data.openCount}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header and Filter Controls */}
      <div className="neu-card p-5 sm:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 neu-pressed rounded-xl flex items-center justify-center text-brand-orange">
              <BarChart3 className="w-5 h-5 text-brand-orange" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Maintenance Reports by Category
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dynamic distribution analysis grouped by report tags across all logged issues.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Time Filter Buttons */}
          <div className="flex items-center neu-pressed p-1 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
            {(
              [
                { id: "all", label: "All Time" },
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
                { id: "this_year", label: "This Year" }
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeFilter(t.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  timeFilter === t.id
                    ? "neu-btn text-brand-orange font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center neu-pressed p-1 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
            {(
              [
                { id: "all", label: "All" },
                { id: "pending", label: "Pending" },
                { id: "in_progress", label: "In Progress" },
                { id: "completed", label: "Completed" }
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === s.id
                    ? "neu-btn text-brand-orange font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Add Ticket / Custom Tag Modal Trigger */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-[#e73f1e] to-[#fb6c00] hover:from-[#f04e2f] hover:to-[#fc7917] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 ml-auto lg:ml-0 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            Add Report / Custom Tag
          </button>
        </div>
      </div>

      {/* Real Statistics Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="neu-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Total Reports
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 block mt-1">
            {stats.total}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Database records
          </span>
        </div>

        <div className="neu-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-500" />
            Open Reports
          </span>
          <span className="text-xl sm:text-2xl font-black text-blue-900 block mt-1">
            {stats.pending}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Awaiting action
          </span>
        </div>

        <div className="neu-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block flex items-center gap-1">
            <Wrench className="w-3 h-3 text-amber-500" />
            In Progress
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-900 block mt-1">
            {stats.inProgress}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Under repair
          </span>
        </div>

        <div className="neu-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Completed
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-900 block mt-1">
            {stats.completed}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Resolved issues
          </span>
        </div>

        <div className="neu-card p-4 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            Critical Reports
          </span>
          <span className="text-xl sm:text-2xl font-black text-rose-700 block mt-1">
            {stats.critical}
          </span>
          <span className="text-[11px] text-rose-600/80 block mt-0.5">
            High emergency hazards
          </span>
        </div>
      </div>

      {/* Main Dynamic Graph & Category Breakdown Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Dynamic Bar Chart */}
        <div className="lg:col-span-2 neu-card p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Distribution by Category / Report Tag</span>
                <span className="text-[11px] font-normal text-slate-500">
                  ({dynamicChartData.length} unique {dynamicChartData.length === 1 ? "category" : "categories"})
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically adapts as new report tags are introduced or tickets are filed.
              </p>
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-600 neu-pressed px-2.5 py-1 rounded-md">
              Count
            </span>
          </div>

          {/* Graph Visual Area */}
          <div className="w-full h-72">
            {dynamicChartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs neu-pressed rounded-xl">
                <BarChart3 className="w-10 h-10 text-slate-400 mb-2" />
                <p className="font-semibold text-slate-600">No maintenance reports match the selected filters.</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Try clearing filters or adding a maintenance ticket.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dynamicChartData}
                  margin={{ top: 12, right: 12, left: -20, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis
                    dataKey="category"
                    tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                    interval={0}
                    angle={dynamicChartData.length > 5 ? -25 : 0}
                    textAnchor={dynamicChartData.length > 5 ? "end" : "middle"}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {dynamicChartData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fillColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="pt-3 border-t border-slate-300/50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Dynamic tags auto-rendered from tenant inputs and administrator tickets.</span>
            <span className="font-mono font-bold text-slate-700">Total Filtered: {filteredTickets.length}</span>
          </div>
        </div>

        {/* Category Breakdown Ranked List */}
        <div className="neu-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-300/50 pb-3 mb-3">
              <Tag className="w-4 h-4 text-brand-orange" />
              <h3 className="text-sm font-bold text-slate-900">Ranked Breakdown</h3>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {dynamicChartData.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs neu-pressed rounded-xl">
                  No data to display.
                </div>
              ) : (
                dynamicChartData.map((item, idx) => (
                  <div key={item.category} className="neu-pressed p-2.5 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.fillColor }}
                        />
                        <span className="font-bold text-slate-900">{item.category}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-700">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-300/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.fillColor
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full mt-4 py-2.5 neu-btn text-brand-orange font-bold text-xs rounded-xl flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Report Tag</span>
          </button>
        </div>
      </div>

      {/* Modal: Add Maintenance Report / Custom Tag */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="neu-floating max-w-lg w-full p-6 text-slate-800 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-300/50 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 neu-pressed rounded-lg flex items-center justify-center text-brand-orange">
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Add Maintenance Report</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 neu-btn rounded-lg flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Category Tag
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full neu-input rounded-xl p-2.5"
                >
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Air Conditioning">Air Conditioning</option>
                  <option value="Internet">Internet</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Security">Security</option>
                  <option value="Other">Other</option>
                  <option value="CUSTOM">✨ + Create New Custom Tag</option>
                </select>
              </div>

              {newCategory === "CUSTOM" && (
                <div className="p-3 neu-pressed rounded-xl space-y-1">
                  <label className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    Custom Report Tag Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pest Control, Elevator, Landscaping"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    className="w-full neu-input rounded-lg p-2 font-semibold"
                  />
                  <p className="text-[10px] text-amber-800">
                    This new tag will immediately render as its own bar on the dynamic chart.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Room Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 101, 204"
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    className="w-full neu-input rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Priority Severity
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full neu-input rounded-xl p-2.5"
                  >
                    <option value="Low">🟢 Low</option>
                    <option value="Medium">🟡 Medium</option>
                    <option value="High">🔴 High</option>
                    <option value="Critical">🚨 Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Tenant Name / Reporter
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maria Santos (or leave blank for Guest)"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  className="w-full neu-input rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Issue Description
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail the maintenance problem encountered..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full neu-input rounded-xl p-2.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-300/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 neu-btn text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newDescription.trim()}
                  className="px-4 py-2 neu-btn-primary font-bold rounded-xl flex items-center gap-1.5"
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Save & Update Chart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
