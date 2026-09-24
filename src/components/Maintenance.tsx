import React, { useState, useMemo } from "react";
import { DBState, api } from "../lib/api";
import { MaintenanceRequest } from "../types";
import { 
  Wrench, Clock, Trash2, BarChart3,
  Eye, Image as ImageIcon, Search, ArrowRight, User, Building, X, Plus, CheckCircle2, Tag, RefreshCw
} from "lucide-react";
import MaintenanceReports from "./MaintenanceReports";
import MaintenanceReportViewer, { 
  formatSubmittedDate,
  getPriorityDisplay, 
  getStatusDisplay 
} from "./MaintenanceReportViewer";

interface MaintenanceProps {
  db: DBState;
  onRefresh: () => void;
}

export default function Maintenance({ db, onRefresh }: MaintenanceProps) {
  // Show Reports and Graphs first by default
  const [activeSubTab, setActiveSubTab] = useState<"reports" | "tickets">("reports");
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [maintFilter, setMaintFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selected Ticket for Full Report Modal
  const [selectedTicketForViewer, setSelectedTicketForViewer] = useState<MaintenanceRequest | null>(null);

  // Quick Add Report Modal inside Maintenance Center
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [recentlyCreatedId, setRecentlyCreatedId] = useState<string | null>(null);

  // New report form states
  const [newCategory, setNewCategory] = useState("Plumbing");
  const [customTagInput, setCustomTagInput] = useState("");
  const [newPriority, setNewPriority] = useState<"Critical" | "High" | "Medium" | "Low">("Medium");
  const [newRoom, setNewRoom] = useState("101");
  const [newTenantName, setNewTenantName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOccurredAt, setNewOccurredAt] = useState("Today");

  // Sorted tickets list - Newest first so freshly added tickets always appear at the top
  const tickets = useMemo(() => {
    const list = [...(db.maintenanceRequests || [])];
    return list.sort((a, b) => {
      const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
      const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [db.maintenanceRequests]);

  // Active selected ticket for viewer kept in sync with DB
  const activeSelectedTicket = selectedTicketForViewer 
    ? (tickets.find((t) => (t.id === selectedTicketForViewer.id || (t.ticketId && t.ticketId === selectedTicketForViewer.id))) || selectedTicketForViewer)
    : null;

  // Filtered maintenance requests with Search & Priority filter (supports both snake_case and camelCase aliases)
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // Status filter
      if (maintFilter !== "all" && t.status !== maintFilter) {
        return false;
      }
      // Priority filter
      if (priorityFilter !== "all") {
        const p = (t.priority || t.severity || "Medium").toLowerCase();
        if (p !== priorityFilter) return false;
      }
      // Search query filter (Tenant name, Room number, Ticket ID, Category, Description)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (t.tenant_name || t.tenantName || "").toLowerCase().includes(q);
        const matchRoom = (t.room_number || t.roomNumber || "").toLowerCase().includes(q);
        const matchId = (t.id || t.ticketId || "").toLowerCase().includes(q);
        const matchCategory = (t.category || "").toLowerCase().includes(q);
        const matchDesc = (t.issue_description || t.description || "").toLowerCase().includes(q);
        if (!matchName && !matchRoom && !matchId && !matchCategory && !matchDesc) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, maintFilter, priorityFilter, searchQuery]);

  // Ticket counts for filter buttons
  const pendingCount = tickets.filter(t => t.status === "pending").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const completedCount = tickets.filter(t => t.status === "completed").length;

  const handleTicketCreatedSuccess = (ticketId: string) => {
    setActiveSubTab("tickets");
    setMaintFilter("all");
    setPriorityFilter("all");
    setSearchQuery("");
    setRecentlyCreatedId(ticketId);
    setTimeout(() => setRecentlyCreatedId(null), 8000);
  };

  const handleCreateReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = newCategory === "CUSTOM"
      ? (customTagInput.trim() || "Custom Issue")
      : newCategory;

    if (!newDescription.trim()) return;

    try {
      setSavingReport(true);
      const cleanRoom = newRoom.trim() || "101";
      const matchedRoom = (db.rooms || []).find(r => r.room_number === cleanRoom);
      const matchedTenant = (db.tenants || []).find(t => 
        (newTenantName.trim() && t.name.toLowerCase() === newTenantName.toLowerCase().trim()) || 
        (matchedRoom?.id && t.room_id === matchedRoom.id)
      );
      const finalTenantName = newTenantName.trim() || matchedTenant?.name || "Apartment Tenant";

      const created = await api.createMaintenanceRequest({
        category: finalCategory,
        issue_description: newDescription.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        severity: newPriority,
        room_number: cleanRoom,
        roomNumber: cleanRoom,
        room_id: matchedRoom?.id || "",
        tenant_name: finalTenantName,
        tenantName: finalTenantName,
        tenant_id: matchedTenant?.id || "",
        occurred_at: newOccurredAt.trim() || "Today",
        occurredAt: newOccurredAt.trim() || "Today",
        when: newOccurredAt.trim() || "Today",
        location: `Room ${cleanRoom}`,
        where: `Room ${cleanRoom}`,
        status: "pending"
      });

      setNewDescription("");
      setCustomTagInput("");
      setNewCategory("Plumbing");
      setIsAddModalOpen(false);
      await onRefresh();

      if (created?.id) {
        handleTicketCreatedSuccess(created.id);
      }
    } catch (err) {
      console.error("Failed to create maintenance report:", err);
      alert("Failed to submit maintenance report.");
    } finally {
      setSavingReport(false);
    }
  };

  const handleUpdateMaintStatus = async (id: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
    try {
      setLoading(true);
      await api.updateMaintenanceRequest(id, { status: newStatus });
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Failed to update ticket status.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTicket = async (id: string) => {
    if (!confirm(`Are you sure you want to delete maintenance ticket ${id}?`)) return;
    try {
      setLoading(true);
      await api.deleteMaintenanceRequest(id);
      if (selectedTicketForViewer?.id === id) {
        setSelectedTicketForViewer(null);
      }
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Failed to delete ticket.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 text-sm">
      {/* Upper Navigation Header - Neumorphic Style */}
      <div className="neu-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 neu-pressed rounded-xl flex items-center justify-center text-[#fb6c00]">
              <Wrench className="w-5 h-5 text-[#fb6c00]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Maintenance Center
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm font-normal mt-0.5">
                Review and manage repair requests submitted by tenants, monitor maintenance metrics, and analyze trends.
              </p>
            </div>
          </div>

          {/* Quick pending badge if any */}
          {pendingCount > 0 && (
            <div className="neu-pressed text-[#e73f1e] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 border border-[#e73f1e]/30">
              <span className="text-sm">🚨</span>
              <span>{pendingCount} Need Attention</span>
            </div>
          )}
        </div>

        {/* Navigation Tabs - Neumorphic Style (Reports First) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-300/50">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveSubTab("reports")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                activeSubTab === "reports" 
                  ? "neu-pressed text-[#fb6c00] font-extrabold border border-[#fb6c00]/30" 
                  : "neu-btn text-slate-700"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-[#fb6c00]" />
              <span>Reports & Graphs</span>
            </button>

            <button
              onClick={() => setActiveSubTab("tickets")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                activeSubTab === "tickets" 
                  ? "neu-pressed text-[#fb6c00] font-extrabold border border-[#fb6c00]/30" 
                  : "neu-btn text-slate-700"
              }`}
            >
              <Wrench className="w-4 h-4 text-[#fb6c00]" />
              <span>Maintenance Tickets ({tickets.length})</span>
            </button>
          </div>

          {/* Direct Add Maintenance Report Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 neu-btn-primary font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Maintenance Report</span>
          </button>
        </div>
      </div>

      {/* Reports & Graphs Tab (Default / Shown First) */}
      {activeSubTab === "reports" && (
        <MaintenanceReports 
          db={db} 
          onRefresh={onRefresh} 
          standalone={true} 
          onTicketCreated={handleTicketCreatedSuccess} 
        />
      )}

      {/* Tickets Section */}
      {activeSubTab === "tickets" && (
        <div className="space-y-5">
          {/* Recently Created Ticket Success Banner */}
          {recentlyCreatedId && (
            <div className="neu-card p-4 bg-emerald-50/80 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 animate-in fade-in slide-in-from-top-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    Maintenance Report Successfully Recorded!
                  </h4>
                  <p className="text-xs text-emerald-800">
                    Ticket <span className="font-mono font-bold bg-emerald-100 px-1.5 py-0.5 rounded">{recentlyCreatedId}</span> has been logged and is displayed at the top of your tickets list.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRecentlyCreatedId(null)}
                className="w-7 h-7 neu-btn rounded-lg flex items-center justify-center text-emerald-700 hover:text-emerald-950"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Controls Card: Search & Filters */}
          <div className="neu-card p-5 space-y-4">
            
            {/* 1. Search Input & Add Button */}
            <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center justify-between">
              <div className="space-y-1.5 w-full">
                <label htmlFor="maint-search" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  🔍 Search Maintenance Reports
                </label>
                <div className="relative">
                  <input
                    id="maint-search"
                    type="text"
                    placeholder="Search by Tenant Name, Room, Ticket ID, or Category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full neu-input rounded-xl py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 neu-btn rounded-full"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="shrink-0 px-4 py-2.5 neu-btn-primary font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Report</span>
              </button>
            </div>

            {/* 2. Status Filters & Priority Filter */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pt-3 border-t border-slate-300/50">
              {/* Status Filter Buttons */}
              <div className="space-y-1.5 w-full lg:w-auto">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Filter by Status:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setMaintFilter("all")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                      maintFilter === "all"
                        ? "neu-pressed text-[#fb6c00] font-extrabold border border-[#fb6c00]/30"
                        : "neu-btn text-slate-700"
                    }`}
                  >
                    ALL ({tickets.length})
                  </button>

                  <button
                    onClick={() => setMaintFilter("pending")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                      maintFilter === "pending"
                        ? "neu-pressed text-[#fb6c00] font-extrabold border border-[#fb6c00]/30"
                        : "neu-btn text-[#fb6c00]"
                    }`}
                  >
                    <span>⏳ PENDING</span>
                    <span className="neu-badge-inset text-[#fb6c00] px-1.5 py-0.2 text-[10px] font-bold">
                      {pendingCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setMaintFilter("in_progress")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                      maintFilter === "in_progress"
                        ? "neu-pressed text-[#d97706] font-extrabold border border-[#d97706]/30"
                        : "neu-btn text-[#d97706]"
                    }`}
                  >
                    <span>🔧 IN PROGRESS</span>
                    <span className="neu-badge-inset text-[#d97706] px-1.5 py-0.2 text-[10px] font-bold">
                      {inProgressCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setMaintFilter("completed")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                      maintFilter === "completed"
                        ? "neu-pressed text-emerald-600 font-extrabold border border-emerald-600/30"
                        : "neu-btn text-emerald-800"
                    }`}
                  >
                    <span>✅ COMPLETED</span>
                    <span className="neu-badge-inset text-emerald-900 px-1.5 py-0.2 text-[10px] font-bold">
                      {completedCount}
                    </span>
                  </button>
                </div>
              </div>

              {/* Priority Filter Dropdown */}
              <div className="space-y-1.5 w-full lg:w-auto">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Filter by Priority:
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as any)}
                    className="w-full sm:w-auto neu-input text-slate-900 text-xs font-bold rounded-xl py-2 px-3 cursor-pointer"
                  >
                    <option value="all">Priority: ALL PRIORITIES ▼</option>
                    <option value="critical">🚨 Critical Only</option>
                    <option value="high">🔴 High Priority Only</option>
                    <option value="medium">🟠 Medium Priority Only</option>
                    <option value="low">🟢 Low Priority Only</option>
                  </select>

                  {(maintFilter !== "all" || priorityFilter !== "all" || searchQuery !== "") && (
                    <button
                      onClick={() => {
                        setMaintFilter("all");
                        setPriorityFilter("all");
                        setSearchQuery("");
                      }}
                      className="px-3 py-2 neu-btn text-slate-700 text-xs font-medium rounded-xl whitespace-nowrap"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Results Summary Info */}
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-medium text-slate-600">
              Showing <strong>{filteredTickets.length}</strong> {filteredTickets.length === 1 ? "report" : "reports"}
              {searchQuery ? ` matching "${searchQuery}"` : ""}
            </span>
          </div>

          {/* Report Cards Grid - Neumorphic Style */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredTickets.length === 0 ? (
              <div className="col-span-full neu-pressed text-center py-14 px-5 rounded-2xl text-slate-500 space-y-2.5">
                <Wrench className="w-10 h-10 mx-auto text-slate-400" />
                <h3 className="text-base font-bold text-slate-800">No maintenance reports found</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Try changing your search keywords or resetting the status and priority filters above.
                </p>
                <button
                  onClick={() => {
                    setMaintFilter("all");
                    setPriorityFilter("all");
                    setSearchQuery("");
                  }}
                  className="mt-1 px-4 py-2 neu-btn text-brand-orange font-bold text-xs rounded-xl"
                >
                  Show All Reports
                </button>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const prio = getPriorityDisplay(ticket.priority || ticket.severity);
                const stat = getStatusDisplay(ticket.status);
                const isCritical = ((ticket.priority || ticket.severity || "").toLowerCase() === "critical");
                const rawRoom = ticket.room_number || ticket.roomNumber;
                const roomFormatted = rawRoom 
                  ? (String(rawRoom).toLowerCase().includes("room") ? String(rawRoom).replace(/^room\s*/i, "") : String(rawRoom)) 
                  : "N/A";
                const dateDisplay = formatSubmittedDate(ticket.created_at || ticket.createdAt);
                const tenantDisplayName = ticket.tenant_name || ticket.tenantName || "Guest Visitor";
                const descDisplay = ticket.issue_description || ticket.description || "No description provided.";
                const photoUrl = ticket.photo_url || ticket.photoUrl || ticket.photo;
                const ticketIdDisplay = ticket.id || ticket.ticketId;
                const isNewlyCreated = (recentlyCreatedId && (ticket.id === recentlyCreatedId || ticket.ticketId === recentlyCreatedId));

                return (
                  <div 
                    key={ticket.id} 
                    className={`neu-card p-5 transition-all flex flex-col justify-between gap-4 ${
                      isNewlyCreated 
                        ? "border-2 border-[#fb6c00] ring-4 ring-[#fb6c00]/20 shadow-lg scale-[1.01]" 
                        : isCritical 
                          ? "border-rose-400/80 shadow-[0_0_15px_rgba(244,63,94,0.3)]" 
                          : ""
                    }`}
                  >
                    <div className="space-y-3.5">
                      
                      {/* 1. Priority Banner at Top of Card */}
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${prio.badgeClass}`}>
                          <span>{prio.icon}</span>
                          <span>{prio.label}</span>
                        </div>

                        {/* Current Status Badge */}
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 ${stat.badgeClass}`}>
                          <span>{stat.label}</span>
                        </div>
                      </div>

                      {/* 2. Ticket ID & Category */}
                      <div className="border-b border-slate-300/50 pb-2.5 space-y-0.5">
                        <span className="font-mono text-xs font-bold text-slate-500 block">
                          {ticketIdDisplay}
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                          {ticket.category || "General Maintenance"}
                        </h2>
                      </div>

                      {/* 3. Tenant Name & Room Number */}
                      <div className="neu-pressed p-3 rounded-xl space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs sm:text-sm">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-brand-orange" />
                            Tenant:
                          </span>
                          <strong className="text-slate-900 font-bold truncate" title={tenantDisplayName}>
                            {tenantDisplayName}
                          </strong>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs sm:text-sm border-t border-slate-300/40 pt-1.5">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-brand-orange" />
                            Room:
                          </span>
                          <strong className="text-slate-900 font-bold">
                            {roomFormatted}
                          </strong>
                        </div>
                      </div>

                      {/* 4. Status & Reported Date */}
                      <div className="space-y-1 text-xs sm:text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 font-medium">Status:</span>
                          <span className="text-slate-900 font-bold uppercase">
                            {ticket.status === "pending" && "⏳ PENDING"}
                            {ticket.status === "in_progress" && "🔧 IN PROGRESS"}
                            {ticket.status === "completed" && "✅ COMPLETED"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 font-medium">Reported:</span>
                          <span className="text-slate-800 font-medium">
                            {dateDisplay}
                          </span>
                        </div>
                      </div>

                      {/* 5. Description Preview */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Problem Description:
                        </span>
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal neu-pressed p-2.5 rounded-xl line-clamp-2">
                          {descDisplay}
                        </p>
                      </div>

                      {/* Photo indicator if attached */}
                      {photoUrl && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-orange neu-pressed p-2 rounded-lg">
                          <ImageIcon className="w-4 h-4" />
                          <span>📷 Tenant Attached A Photo</span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions: "VIEW FULL REPORT" & Status Controls */}
                    <div className="border-t border-slate-300/50 pt-3.5 space-y-2.5">
                      
                      {/* Main Action Button */}
                      <button
                        onClick={() => setSelectedTicketForViewer(ticket)}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-[#e73f1e] to-[#fb6c00] hover:from-[#f04e2f] hover:to-[#fc7917] text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                      >
                        <Eye className="w-4 h-4 text-white" />
                        <span>[ VIEW FULL REPORT ]</span>
                        <ArrowRight className="w-3.5 h-3.5 text-white" />
                      </button>

                      {/* Status Quick Changer */}
                      <div className="neu-pressed p-2.5 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            Quick Change Status:
                          </span>
                          <button
                            onClick={() => handleDeleteTicket(ticket.id)}
                            className="text-[11px] font-medium text-rose-500 hover:text-rose-700 flex items-center gap-1 transition-colors p-0.5"
                            title="Delete Ticket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            disabled={loading || ticket.status === "pending"}
                            onClick={() => handleUpdateMaintStatus(ticket.id, "pending")}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              ticket.status === "pending"
                                ? "bg-blue-600 text-white shadow-sm font-extrabold"
                                : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                            }`}
                          >
                            <span>Pending</span>
                            {ticket.status === "pending" && <span>✓</span>}
                          </button>

                          <button
                            type="button"
                            disabled={loading || ticket.status === "in_progress"}
                            onClick={() => handleUpdateMaintStatus(ticket.id, "in_progress")}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              ticket.status === "in_progress"
                                ? "bg-amber-600 text-white shadow-sm font-extrabold"
                                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                            }`}
                          >
                            <span>In Progress</span>
                            {ticket.status === "in_progress" && <span>✓</span>}
                          </button>

                          <button
                            type="button"
                            disabled={loading || ticket.status === "completed"}
                            onClick={() => handleUpdateMaintStatus(ticket.id, "completed")}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              ticket.status === "completed"
                                ? "bg-emerald-600 text-white shadow-sm font-extrabold"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            }`}
                          >
                            <span>Completed</span>
                            {ticket.status === "completed" && <span>✓</span>}
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Full Maintenance Report Modal Viewer */}
      {activeSelectedTicket && (
        <MaintenanceReportViewer
          ticket={activeSelectedTicket}
          onClose={() => setSelectedTicketForViewer(null)}
          onUpdateStatus={handleUpdateMaintStatus}
          onDelete={handleDeleteTicket}
        />
      )}

      {/* Quick Add Maintenance Report Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="neu-floating max-w-lg w-full p-6 text-slate-800 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-300/50 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 neu-pressed rounded-lg flex items-center justify-center text-[#fb6c00]">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Maintenance Report</h3>
                  <p className="text-[11px] text-slate-500">Record a new ticket directly into Maintenance Tickets</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 neu-btn rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReportSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Category Tag
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full neu-input rounded-xl p-2.5 font-medium"
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
                    className="w-full neu-input rounded-xl p-2.5 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Priority Severity
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full neu-input rounded-xl p-2.5 font-medium"
                  >
                    <option value="Low">🟢 Low</option>
                    <option value="Medium">🟡 Medium</option>
                    <option value="High">🔴 High</option>
                    <option value="Critical">🚨 Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Tenant Name / Reporter
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maria Santos (or blank for Guest)"
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    className="w-full neu-input rounded-xl p-2.5 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    When Did It Occur?
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Today, Yesterday morning"
                    value={newOccurredAt}
                    onChange={(e) => setNewOccurredAt(e.target.value)}
                    className="w-full neu-input rounded-xl p-2.5 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Problem Description
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail the maintenance problem encountered..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full neu-input rounded-xl p-2.5 font-normal"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-300/50">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 neu-btn text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReport || !newDescription.trim()}
                  className="px-4 py-2 neu-btn-primary font-bold rounded-xl flex items-center gap-1.5"
                >
                  {savingReport ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Save & Record Ticket
                </button>
              </div>
              <p className="text-[11px] text-slate-500 text-right pt-0.5 font-medium">
                ✅ Immediately logs this ticket into Maintenance Tickets and updates metrics.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
