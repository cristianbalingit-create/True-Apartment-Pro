import React, { useState } from "react";
import { MaintenanceRequest } from "../types";
import { 
  Wrench, AlertTriangle, CheckCircle2, Clock, Calendar, MapPin, 
  User, Building, Tag, ShieldAlert, Image as ImageIcon, ExternalLink, 
  X, Check, Trash2, ZoomIn, ArrowRight, Layers
} from "lucide-react";

interface MaintenanceReportViewerProps {
  ticket: MaintenanceRequest | null;
  onClose: () => void;
  onUpdateStatus: (ticketId: string, newStatus: "pending" | "in_progress" | "completed") => Promise<void>;
  onDelete?: (ticketId: string) => Promise<void>;
}

export function formatSubmittedDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    const timeFormatted = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    return `${dateFormatted} — ${timeFormatted}`;
  } catch {
    return dateStr;
  }
}

export function formatSubmittedDateShort(dateStr?: string): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

export function getPriorityDisplay(priority?: string) {
  const p = (priority || "Medium").toLowerCase();
  switch (p) {
    case "critical":
      return {
        label: "CRITICAL",
        icon: "🚨",
        badgeClass: "neu-pressed text-rose-600 font-bold",
        textClass: "text-rose-600 font-bold",
        bgClass: "neu-pressed"
      };
    case "high":
      return {
        label: "HIGH",
        icon: "🔴",
        badgeClass: "neu-pressed text-red-600 font-bold",
        textClass: "text-red-600 font-bold",
        bgClass: "neu-pressed"
      };
    case "medium":
      return {
        label: "MEDIUM",
        icon: "🟠",
        badgeClass: "neu-pressed text-amber-600 font-bold",
        textClass: "text-amber-600 font-bold",
        bgClass: "neu-pressed"
      };
    case "low":
    default:
      return {
        label: "LOW",
        icon: "🟢",
        badgeClass: "neu-pressed text-emerald-600 font-bold",
        textClass: "text-emerald-600 font-bold",
        bgClass: "neu-pressed"
      };
  }
}

export function getStatusDisplay(status?: string) {
  switch (status) {
    case "pending":
      return {
        label: "PENDING",
        badgeClass: "neu-pressed text-blue-700 font-bold",
        icon: Clock
      };
    case "in_progress":
      return {
        label: "IN PROGRESS",
        badgeClass: "neu-pressed text-amber-700 font-bold",
        icon: Wrench
      };
    case "completed":
      return {
        label: "COMPLETED",
        badgeClass: "neu-pressed text-emerald-700 font-bold",
        icon: CheckCircle2
      };
    default:
      return {
        label: "PENDING",
        badgeClass: "neu-pressed text-slate-700 font-bold",
        icon: Clock
      };
  }
}

export default function MaintenanceReportViewer({
  ticket,
  onClose,
  onUpdateStatus,
  onDelete
}: MaintenanceReportViewerProps) {
  const [updating, setUpdating] = useState(false);
  const [isPhotoLightboxOpen, setIsPhotoLightboxOpen] = useState(false);

  if (!ticket) return null;

  const prio = getPriorityDisplay(ticket.priority || ticket.severity);
  const stat = getStatusDisplay(ticket.status);
  const isCritical = ((ticket.priority || ticket.severity || "").toLowerCase() === "critical");
  const rawRoom = ticket.room_number || ticket.roomNumber;
  const roomClean = rawRoom 
    ? (String(rawRoom).toLowerCase().includes("room") ? String(rawRoom) : `Room ${rawRoom}`) 
    : "Room N/A";
  const tenantDisplayName = ticket.tenant_name || ticket.tenantName || "Guest Visitor";
  const descDisplay = ticket.issue_description || ticket.description || "No description provided.";
  const occurredAtDisplay = ticket.occurred_at || ticket.occurredAt || ticket.when || formatSubmittedDate(ticket.created_at || ticket.createdAt);
  const locationDisplay = ticket.location || ticket.where || (rawRoom ? `Room ${rawRoom}` : "Not specified");
  const submittedTimestampDisplay = formatSubmittedDate(ticket.created_at || ticket.createdAt);
  const ticketIdDisplay = ticket.id || ticket.ticketId || "N/A";

  const handleStatusChange = async (newStatus: "pending" | "in_progress" | "completed") => {
    try {
      setUpdating(true);
      await onUpdateStatus(ticket.id, newStatus);
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update maintenance status.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm(`Are you sure you want to delete maintenance ticket ${ticket.id}?`)) return;
    try {
      setUpdating(true);
      await onDelete(ticket.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete ticket:", err);
      alert("Failed to delete ticket.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto text-xs sm:text-sm">
      <div 
        className="neu-floating max-w-2xl w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 text-slate-800"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Banner - Neumorphic Style */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 neu-btn-primary text-xs font-bold tracking-wide uppercase">
                  MAINTENANCE REPORT
                </span>
                <span className="font-mono text-xs font-bold text-slate-800 neu-pressed px-2 py-1 rounded-lg">
                  {ticket.id}
                </span>
                {isCritical && (
                  <span className="px-2.5 py-1 neu-pressed text-[#e73f1e] font-bold animate-pulse flex items-center gap-1 rounded-lg">
                    <span>🚨</span> CRITICAL URGENCY
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 tracking-tight">
                {ticket.category || "General Maintenance"} • {roomClean}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 neu-btn flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 shrink-0"
              title="Close report"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Critical Safety Notice if applicable */}
        {isCritical && (
          <div className="neu-pressed m-4 p-3 sm:p-4 flex items-start gap-2.5 rounded-xl border border-[#e73f1e]/40">
            <span className="text-xl shrink-0">🚨</span>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-[#e73f1e]">
                CRITICAL MAINTENANCE NOTICE
              </div>
              <p className="text-xs sm:text-sm text-[#e73f1e] font-medium mt-0.5 leading-snug">
                This issue is flagged as <strong>CRITICAL</strong> urgency. Please alert maintenance personnel or emergency service immediately.
              </p>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[72vh] overflow-y-auto">
          
          {/* 1. REPORT INFORMATION */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300/50 pb-1.5 mb-3 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-brand-orange" />
              <span>REPORT INFORMATION</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Ticket ID */}
              <div className="neu-pressed p-3 rounded-xl">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-0.5">
                  Ticket ID
                </span>
                <span className="text-base font-mono font-bold text-slate-900 block">
                  {ticketIdDisplay}
                </span>
              </div>

              {/* Priority */}
              <div className={`p-3 rounded-xl ${prio.bgClass}`}>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-0.5">
                  Priority
                </span>
                <span className={`inline-flex items-center gap-1.5 text-sm ${prio.textClass}`}>
                  <span className="text-base">{prio.icon}</span>
                  <span>{prio.label}</span>
                </span>
              </div>

              {/* Status */}
              <div className="neu-pressed p-3 rounded-xl">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-0.5">
                  Current Status
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold uppercase ${stat.badgeClass}`}>
                  {stat.label}
                </span>
              </div>
            </div>
          </div>

          {/* 2. TENANT INFORMATION */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300/50 pb-1.5 mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-brand-orange" />
              <span>TENANT INFORMATION</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tenant Name */}
              <div className="neu-pressed p-3 rounded-xl">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-0.5">
                  Tenant Name
                </span>
                <span className="text-base font-bold text-slate-900 block truncate">
                  {tenantDisplayName}
                </span>
              </div>

              {/* Room */}
              <div className="neu-pressed p-3 rounded-xl">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-0.5">
                  Room
                </span>
                <span className="text-base font-bold text-slate-900 block">
                  {roomClean}
                </span>
              </div>
            </div>
          </div>

          {/* 3. PROBLEM DETAILS */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300/50 pb-1.5 mb-3 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-brand-orange" />
              <span>PROBLEM DETAILS</span>
            </div>

            <div className="space-y-3">
              {/* Category */}
              <div className="neu-pressed p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Category:
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {ticket.category || "General Maintenance"}
                </span>
              </div>

              {/* When & Where */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="neu-pressed p-3 rounded-xl space-y-0.5">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-brand-orange" /> When It Occurred
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {occurredAtDisplay}
                  </p>
                </div>

                <div className="neu-pressed p-3 rounded-xl space-y-0.5">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-brand-orange" /> Where In The Unit
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {locationDisplay}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Description (Original Report from Tenant):
                </span>
                <div className="neu-pressed p-3.5 rounded-xl text-slate-800 text-xs sm:text-sm leading-relaxed font-normal whitespace-pre-wrap">
                  {descDisplay}
                </div>
              </div>

              {/* Submitted timestamp */}
              <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5 pt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date & Time Submitted: </span>
                <strong className="text-slate-800 font-semibold">{submittedTimestampDisplay}</strong>
              </div>
            </div>
          </div>

          {/* 4. PHOTO */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300/50 pb-1.5 mb-3 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-brand-orange" />
              <span>📷 Attached Photo</span>
            </div>

            {(ticket.photo_url || (ticket as any).photoUrl) ? (
              <div className="neu-pressed p-3.5 rounded-xl space-y-3">
                <div 
                  onClick={() => setIsPhotoLightboxOpen(true)}
                  className="relative group rounded-xl overflow-hidden cursor-pointer max-h-72 bg-slate-900 flex items-center justify-center border border-slate-300 shadow-inner"
                >
                  <img
                    src={ticket.photo_url || (ticket as any).photoUrl}
                    alt="Tenant uploaded maintenance issue proof"
                    className="max-h-72 w-full object-contain group-hover:scale-105 transition-transform duration-200"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                    <ZoomIn className="w-4 h-4" /> Click to View Full Size
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">
                    Uploaded by tenant via Messenger
                  </span>
                  <button
                    onClick={() => setIsPhotoLightboxOpen(true)}
                    className="px-3 py-1.5 bg-[#fb6c00] hover:bg-[#e73f1e] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-white" />
                    <span>[ VIEW PHOTO FULL SIZE ]</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 neu-pressed rounded-xl text-center text-slate-600 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2">
                <span className="text-xl">📷</span>
                <span>No photo attached</span>
              </div>
            )}
          </div>

          {/* 5. UPDATE STATUS */}
          <div className="neu-card p-4 space-y-2.5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#2c1a11] block">
                Update Status
              </span>
              <span className="text-[11px] text-[#8c6753] block mt-0.5">
                Click any status button below to update the ticket:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={updating || ticket.status === "pending"}
                onClick={() => handleStatusChange("pending")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  ticket.status === "pending"
                    ? "bg-blue-600 text-white font-extrabold shadow-sm"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>PENDING</span>
                {ticket.status === "pending" && <span className="ml-1">✓</span>}
              </button>

              <button
                type="button"
                disabled={updating || ticket.status === "in_progress"}
                onClick={() => handleStatusChange("in_progress")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  ticket.status === "in_progress"
                    ? "bg-amber-600 text-white font-extrabold shadow-sm"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>IN PROGRESS</span>
                {ticket.status === "in_progress" && <span className="ml-1">✓</span>}
              </button>

              <button
                type="button"
                disabled={updating || ticket.status === "completed"}
                onClick={() => handleStatusChange("completed")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  ticket.status === "completed"
                    ? "bg-emerald-600 text-white font-extrabold shadow-sm"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>COMPLETED</span>
                {ticket.status === "completed" && <span className="ml-1">✓</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white">
          {onDelete ? (
            <button
              onClick={handleDelete}
              disabled={updating}
              className="text-xs font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 transition-colors p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete This Ticket</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <X className="w-4 h-4" />
            <span>CLOSE REPORT</span>
          </button>
        </div>
      </div>

      {/* Photo Lightbox Modal */}
      {isPhotoLightboxOpen && (ticket.photo_url || (ticket as any).photoUrl) && (
        <div 
          onClick={() => setIsPhotoLightboxOpen(false)}
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md cursor-zoom-out"
        >
          <div className="max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center relative">
            <button
              onClick={() => setIsPhotoLightboxOpen(false)}
              className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
            >
              <X className="w-4 h-4" /> CLOSE PHOTO
            </button>
            <img
              src={ticket.photo_url || (ticket as any).photoUrl}
              alt="Full size maintenance issue proof"
              className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/20"
              referrerPolicy="no-referrer"
            />
            <p className="text-white text-xs mt-3 font-mono font-medium bg-slate-900/80 px-3 py-1.5 rounded-lg">
              Ticket {ticket.id} • {roomClean}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
