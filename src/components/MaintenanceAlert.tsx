import React from "react";
import { MaintenanceRequest } from "../types";
import { CheckCircle2, ArrowRight, ShieldAlert } from "lucide-react";

interface MaintenanceAlertProps {
  tickets: MaintenanceRequest[];
  onNavigateToMaintenance: () => void;
  onViewReport: (ticket: MaintenanceRequest) => void;
}

export default function MaintenanceAlert({
  tickets,
  onNavigateToMaintenance,
  onViewReport
}: MaintenanceAlertProps) {
  // Only look at pending (new) reports requiring attention
  const pendingTickets = (tickets || []).filter((t) => t.status === "pending");

  // If there are no new/pending maintenance reports, show a clean, small normal status:
  if (pendingTickets.length === 0) {
    return (
      <div className="neu-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 neu-pressed rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900">✓ No new maintenance reports</span>
            <span className="text-[11px] text-slate-500 block sm:inline sm:ml-2">
              All maintenance requests have been processed or resolved.
            </span>
          </div>
        </div>
        <button
          onClick={onNavigateToMaintenance}
          className="text-xs font-bold neu-btn text-emerald-800 hover:text-emerald-950 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0"
        >
          <span>View Maintenance Center</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Count by priority
  const criticalTickets = pendingTickets.filter((t) => (t.priority || "").toLowerCase() === "critical");
  const highTickets = pendingTickets.filter((t) => (t.priority || "").toLowerCase() === "high");
  const mediumTickets = pendingTickets.filter((t) => (t.priority || "").toLowerCase() === "medium");
  const lowTickets = pendingTickets.filter((t) => (t.priority || "").toLowerCase() === "low");

  const totalPending = pendingTickets.length;

  return (
    <div className="space-y-3">
      {/* Critical Alert Banners */}
      {criticalTickets.map((crit) => (
        <div 
          key={`critical-${crit.id}`}
          className="p-5 neu-card border border-[#e73f1e]/40 text-[#2c1a11] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div className="flex items-start gap-3.5">
            <span className="text-2xl shrink-0 leading-none mt-0.5">🚨</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-[11px] tracking-wider uppercase neu-pressed text-[#e73f1e] px-2.5 py-0.5 rounded-md">
                  CRITICAL MAINTENANCE
                </span>
                <span className="text-xs text-[#e73f1e] font-bold">
                  Immediate attention required
                </span>
              </div>
              <p className="text-sm sm:text-base font-extrabold text-[#2c1a11] mt-1 leading-snug">
                {crit.issue_description} reported in Room {crit.room_number ? crit.room_number.replace(/^room\s*/i, "") : "N/A"}
              </p>
              <div className="text-[11px] text-[#8c6753] font-mono mt-0.5">
                Ticket: {crit.id} • Reported by: {crit.tenant_name || "Guest"}
              </div>
            </div>
          </div>

          <button
            onClick={() => onViewReport(crit)}
            className="px-4 py-2 bg-gradient-to-r from-[#e73f1e] to-[#fb6c00] hover:from-[#f04e2f] hover:to-[#fc7917] text-white font-black text-xs rounded-xl shadow-md shrink-0 flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <span>[VIEW REPORT]</span>
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      ))}

      {/* Main Priority-Based Maintenance Alert Card */}
      <div className="neu-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <h2 className="text-xs font-black uppercase tracking-wider text-[#2c1a11]">
                MAINTENANCE ALERT
              </h2>
            </div>
            <p className="text-sm sm:text-base font-extrabold text-[#2c1a11] mt-1">
              {totalPending} {totalPending === 1 ? "maintenance report requires" : "maintenance reports require"} attention.
            </p>
          </div>

          <button
            onClick={onNavigateToMaintenance}
            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-[#e73f1e] to-[#fb6c00] hover:from-[#f04e2f] hover:to-[#fc7917] text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <span>[ View Maintenance Reports ]</span>
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        {/* Priority breakdown badges */}
        <div className="flex flex-wrap gap-2.5 pt-3 border-t border-[#e5d1bd]">
          {criticalTickets.length > 0 && (
            <div className="neu-pressed px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-[#e73f1e]">
              <span className="text-sm">🚨</span>
              <span>{criticalTickets.length} Critical</span>
            </div>
          )}

          {highTickets.length > 0 && (
            <div className="neu-pressed px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-[#fb6c00]">
              <span className="text-sm">🔴</span>
              <span>{highTickets.length} High Priority</span>
            </div>
          )}

          {mediumTickets.length > 0 && (
            <div className="neu-pressed px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-[#d97706]">
              <span className="text-sm">🟠</span>
              <span>{mediumTickets.length} Medium Priority</span>
            </div>
          )}

          {lowTickets.length > 0 && (
            <div className="neu-pressed px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-[#65a30d]">
              <span className="text-sm">🟢</span>
              <span>{lowTickets.length} Low Priority</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
