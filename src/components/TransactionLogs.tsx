import React, { useState, useMemo } from "react";
import { TransactionLog } from "../types";
import { 
  FileText, Search, Filter, Calendar, DollarSign, CheckCircle2, User, 
  Home, Wrench, ShieldAlert, Trash2, Download, Printer, RefreshCw, 
  Clock, ArrowUpRight, ArrowDownRight, Activity, Layers, Building2, 
  SlidersHorizontal, ChevronDown, Tag
} from "lucide-react";

interface TransactionLogsProps {
  logs: TransactionLog[];
  onRefresh: () => void;
  onClearLogs?: () => Promise<void>;
}

export const TransactionLogs: React.FC<TransactionLogsProps> = ({ logs = [], onRefresh, onClearLogs }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline");
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Filter logs logic
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // Search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((log) => 
        log.title.toLowerCase().includes(term) ||
        log.details.toLowerCase().includes(term) ||
        (log.tenant_name && log.tenant_name.toLowerCase().includes(term)) ||
        (log.room_number && log.room_number.toLowerCase().includes(term)) ||
        (log.performed_by && log.performed_by.toLowerCase().includes(term)) ||
        log.id.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      result = result.filter((log) => log.category === selectedCategory);
    }

    // Action filter
    if (selectedAction !== "all") {
      result = result.filter((log) => log.action === selectedAction);
    }

    // Time filter
    if (timeFilter !== "all") {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

      result = result.filter((log) => {
        const logTime = new Date(log.timestamp).getTime();
        if (timeFilter === "today") return logTime >= todayStart;
        if (timeFilter === "7days") return logTime >= sevenDaysAgo;
        if (timeFilter === "30days") return logTime >= thirtyDaysAgo;
        return true;
      });
    }

    // Sort descending by timestamp
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, searchTerm, selectedCategory, selectedAction, timeFilter]);

  // Statistics
  const paymentCount = useMemo(() => {
    return filteredLogs.filter(l => l.category === 'payment' || l.action === 'payment').length;
  }, [filteredLogs]);

  const maintenanceCount = useMemo(() => {
    return filteredLogs.filter(l => l.category === 'maintenance').length;
  }, [filteredLogs]);

  // Format category badge
  const getCategoryBadge = (category: TransactionLog['category']) => {
    switch (category) {
      case 'payment':
        return {
          label: 'Payment',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <DollarSign className="w-3.5 h-3.5" />
        };
      case 'billing':
        return {
          label: 'Billing Invoice',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <FileText className="w-3.5 h-3.5" />
        };
      case 'deposit':
        return {
          label: 'Deposit/Advance',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <Layers className="w-3.5 h-3.5" />
        };
      case 'tenant':
        return {
          label: 'Tenant Mgmt',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: <User className="w-3.5 h-3.5" />
        };
      case 'room':
        return {
          label: 'Room Unit',
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: <Home className="w-3.5 h-3.5" />
        };
      case 'apartment':
        return {
          label: 'Building',
          bg: 'bg-sky-50 text-sky-700 border-sky-200',
          icon: <Building2 className="w-3.5 h-3.5" />
        };
      case 'maintenance':
        return {
          label: 'Maintenance',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <Wrench className="w-3.5 h-3.5" />
        };
      default:
        return {
          label: 'System Audit',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: <Activity className="w-3.5 h-3.5" />
        };
    }
  };

  // Action tag color
  const getActionPill = (action?: TransactionLog['action']) => {
    switch (action) {
      case 'payment':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">SETTLED</span>;
      case 'move_in':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-800">MOVE IN</span>;
      case 'move_out':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-100 text-rose-800">MOVE OUT</span>;
      case 'create':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800">CREATED</span>;
      case 'update':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800">UPDATED</span>;
      case 'delete':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-800">DELETED</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-100 text-gray-700">LOGGED</span>;
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["Log ID", "Date & Time", "Category", "Action", "Title", "Details", "Amount (PHP)", "Tenant Name", "Room Number", "Performed By"];
    const rows = filteredLogs.map((log) => [
      log.id,
      new Date(log.timestamp).toLocaleString(),
      log.category,
      log.action || "N/A",
      `"${log.title.replace(/"/g, '""')}"`,
      `"${log.details.replace(/"/g, '""')}"`,
      log.amount ? log.amount : "0",
      `"${(log.tenant_name || 'N/A').replace(/"/g, '""')}"`,
      log.room_number || "N/A",
      log.performed_by || "Admin"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Transaction_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print audit report
  const handlePrint = () => {
    window.print();
  };

  // Confirm Clear Logs
  const handleConfirmClear = async () => {
    if (!onClearLogs) return;
    try {
      setIsClearing(true);
      await onClearLogs();
      setShowClearModal(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to clear logs:", err);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Transaction Audit Logs</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Real-time recording and audit trail of financial payments, tenant movements, billing invoices, and maintenance operations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRefresh}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Report</span>
          </button>

          {onClearLogs && (
            <button
              onClick={() => setShowClearModal(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Clear Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Audit Records</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{filteredLogs.length}</h3>
            <p className="text-xs text-slate-500 mt-1">Logged system events</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Payment Transactions</p>
            <h3 className="text-2xl font-bold text-indigo-600 mt-1">{paymentCount}</h3>
            <p className="text-xs text-slate-500 mt-1">Settled invoices & deposits</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Maintenance & Operations</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{maintenanceCount}</h3>
            <p className="text-xs text-slate-500 mt-1">Dispatched work orders</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Wrench className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, tenant name, room number, or performed by..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === "timeline" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Timeline View
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Table View
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="payment">Payments Settled</option>
              <option value="billing">Billing Statements</option>
              <option value="deposit">Deposit & Advance</option>
              <option value="tenant">Tenant Management</option>
              <option value="room">Room Units</option>
              <option value="apartment">Building Properties</option>
              <option value="maintenance">Maintenance Requests</option>
              <option value="system">System Events</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Action Type</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Action Types</option>
              <option value="payment">Payment Settled</option>
              <option value="move_in">Move-In</option>
              <option value="move_out">Move-Out</option>
              <option value="create">Created / Generated</option>
              <option value="update">Updated / Modified</option>
              <option value="delete">Deleted / Removed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Timeframe</label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No transaction logs match your criteria</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            Try adjusting your search keywords, category filters, or timeframe options to view historical transaction records.
          </p>
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("all");
              setSelectedAction("all");
              setTimeFilter("all");
            }}
            className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-semibold hover:bg-blue-100 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === "timeline" ? (
        /* Timeline View */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="relative border-l-2 border-slate-100 ml-4 space-y-6">
            {filteredLogs.map((log) => {
              const badge = getCategoryBadge(log.category);
              const dateStr = new Date(log.timestamp).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true
              });

              return (
                <div key={log.id} className="relative pl-6 group">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[17px] top-1.5 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${badge.bg}`}>
                    {badge.icon}
                  </div>

                  {/* Card Container */}
                  <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 hover:bg-white hover:border-slate-300 hover:shadow-md transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.bg}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>

                        {getActionPill(log.action)}

                        {log.room_number && (
                          <span className="inline-flex items-center text-xs text-slate-600 font-medium bg-slate-200/60 px-2 py-0.5 rounded">
                            <Home className="w-3 h-3 mr-1 text-slate-500" /> Room {log.room_number}
                          </span>
                        )}

                        {log.tenant_name && (
                          <span className="inline-flex items-center text-xs text-slate-600 font-medium bg-slate-200/60 px-2 py-0.5 rounded">
                            <User className="w-3 h-3 mr-1 text-slate-500" /> {log.tenant_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center text-xs text-slate-400 space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{dateStr}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col md:flex-row md:items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <h4 className="text-sm font-semibold text-slate-900">{log.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">{log.details}</p>
                      </div>

                      {log.amount !== undefined && log.amount !== null && log.amount > 0 && (
                        <div className="text-right whitespace-nowrap bg-emerald-50/80 border border-emerald-100 px-3 py-1.5 rounded-lg self-start">
                          <span className="text-[10px] font-semibold tracking-wider text-emerald-600 uppercase block">Amount</span>
                          <span className="text-sm font-bold text-emerald-700">
                            ₱{log.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Log ID: <code className="font-mono bg-slate-200/50 px-1 rounded">{log.id}</code></span>
                      <span>By: <strong className="font-medium text-slate-600">{log.performed_by || "Property Admin"}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">Date & Time</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Title & Description</th>
                  <th className="px-4 py-3.5">Tenant / Room</th>
                  <th className="px-4 py-3.5 text-right">Amount</th>
                  <th className="px-4 py-3.5">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.map((log) => {
                  const badge = getCategoryBadge(log.category);
                  const dateStr = new Date(log.timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {dateStr}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${badge.bg}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getActionPill(log.action)}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-semibold text-slate-900 text-xs truncate">{log.title}</div>
                        <div className="text-[11px] text-slate-500 truncate" title={log.details}>{log.details}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.tenant_name ? (
                          <div>
                            <div className="font-medium text-slate-900">{log.tenant_name}</div>
                            {log.room_number && <div className="text-[11px] text-slate-500">Room {log.room_number}</div>}
                          </div>
                        ) : log.room_number ? (
                          <div className="font-medium text-slate-700">Room {log.room_number}</div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {log.amount ? (
                          <span className="text-emerald-700 font-semibold">
                            ₱{log.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                        {log.performed_by || "Admin"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Clear All Audit Logs?</h3>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete all historical transaction logs? This action will reset the audit trail.
            </p>

            <div className="pt-3 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                disabled={isClearing}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {isClearing ? "Clearing..." : "Yes, Clear Logs"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
