import React, { useState, useMemo, useRef, useEffect } from "react";
import { DBState } from "../lib/api";
import { MaintenanceRequest } from "../types";
import {
  Bell,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Filter,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export type NotificationCategory =
  | "all"
  | "critical"
  | "payment"
  | "overdue"
  | "maintenance"
  | "inquiry"
  | "billing"
  | "system";

export interface NotificationItem {
  id: string;
  category: "critical" | "payment" | "overdue" | "maintenance" | "inquiry" | "billing" | "system";
  badgeLabel: string;
  title: string;
  description: string;
  metadata?: string;
  timestamp: string;
  targetTab: "dashboard" | "apartments" | "tenants" | "billing" | "maintenance" | "payments" | "logs";
  actionLabel: string;
}

export const CATEGORY_STYLES: Record<
  NotificationItem["category"],
  {
    borderLeft: string;
    cardBg: string;
    cardBorder: string;
    badgeBg: string;
    badgeText: string;
    iconBg: string;
    iconText: string;
    iconEmoji: string;
    tabPillActive: string;
    tabPillInactive: string;
    label: string;
  }
> = {
  critical: {
    borderLeft: "border-l-4 border-l-[#8B2626]",
    cardBg: "bg-rose-50/90 hover:bg-rose-50",
    cardBorder: "border-rose-200",
    badgeBg: "bg-rose-100 border border-rose-300",
    badgeText: "text-[#8B2626]",
    iconBg: "bg-rose-200/70 text-[#8B2626]",
    iconText: "text-[#8B2626]",
    iconEmoji: "🚨",
    tabPillActive: "bg-[#8B2626] text-white border-[#8B2626]",
    tabPillInactive: "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100",
    label: "Critical"
  },
  payment: {
    borderLeft: "border-l-4 border-l-emerald-600",
    cardBg: "bg-emerald-50/90 hover:bg-emerald-50",
    cardBorder: "border-emerald-200",
    badgeBg: "bg-emerald-100 border border-emerald-300",
    badgeText: "text-emerald-900",
    iconBg: "bg-emerald-200/70 text-emerald-700",
    iconText: "text-emerald-700",
    iconEmoji: "💳",
    tabPillActive: "bg-emerald-700 text-white border-emerald-700",
    tabPillInactive: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
    label: "Payments"
  },
  overdue: {
    borderLeft: "border-l-4 border-l-[#EF6905]",
    cardBg: "bg-amber-50/90 hover:bg-amber-50",
    cardBorder: "border-amber-200",
    badgeBg: "bg-amber-100 border border-amber-300",
    badgeText: "text-amber-900",
    iconBg: "bg-amber-200/70 text-amber-700",
    iconText: "text-amber-700",
    iconEmoji: "⚠️",
    tabPillActive: "bg-[#EF6905] text-white border-[#EF6905]",
    tabPillInactive: "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100",
    label: "Overdue"
  },
  maintenance: {
    borderLeft: "border-l-4 border-l-sky-500",
    cardBg: "bg-sky-50/90 hover:bg-sky-50",
    cardBorder: "border-sky-200",
    badgeBg: "bg-sky-100 border border-sky-300",
    badgeText: "text-sky-900",
    iconBg: "bg-sky-200/70 text-sky-700",
    iconText: "text-sky-700",
    iconEmoji: "🔧",
    tabPillActive: "bg-sky-600 text-white border-sky-600",
    tabPillInactive: "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100",
    label: "Repairs"
  },
  inquiry: {
    borderLeft: "border-l-4 border-l-purple-500",
    cardBg: "bg-purple-50/90 hover:bg-purple-50",
    cardBorder: "border-purple-200",
    badgeBg: "bg-purple-100 border border-purple-300",
    badgeText: "text-purple-900",
    iconBg: "bg-purple-200/70 text-purple-700",
    iconText: "text-purple-700",
    iconEmoji: "📩",
    tabPillActive: "bg-purple-600 text-white border-purple-600",
    tabPillInactive: "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100",
    label: "Inquiries"
  },
  billing: {
    borderLeft: "border-l-4 border-l-teal-500",
    cardBg: "bg-teal-50/90 hover:bg-teal-50",
    cardBorder: "border-teal-200",
    badgeBg: "bg-teal-100 border border-teal-300",
    badgeText: "text-teal-900",
    iconBg: "bg-teal-200/70 text-teal-700",
    iconText: "text-teal-700",
    iconEmoji: "📄",
    tabPillActive: "bg-teal-700 text-white border-teal-700",
    tabPillInactive: "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100",
    label: "Billing"
  },
  system: {
    borderLeft: "border-l-4 border-l-slate-400",
    cardBg: "bg-slate-50/90 hover:bg-slate-50",
    cardBorder: "border-slate-200",
    badgeBg: "bg-slate-100 border border-slate-300",
    badgeText: "text-slate-800",
    iconBg: "bg-slate-200/70 text-slate-700",
    iconText: "text-slate-700",
    iconEmoji: "📢",
    tabPillActive: "bg-slate-800 text-white border-slate-800",
    tabPillInactive: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
    label: "System"
  }
};

export interface NotificationCenterProps {
  db: DBState | null;
  pendingPaymentCount: number;
  onNavigateTab: (tab: "dashboard" | "apartments" | "tenants" | "billing" | "maintenance" | "payments" | "logs") => void;
}

export default function NotificationCenter({
  db,
  pendingPaymentCount,
  onNavigateTab
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>("all");
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("rentflow_read_notifications");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Assemble all notifications from DB state
  const notifications: NotificationItem[] = useMemo(() => {
    if (!db) return [];

    const items: NotificationItem[] = [];

    // 1. Pending Payments (EMERALD)
    if (pendingPaymentCount > 0) {
      items.push({
        id: "payment-pending",
        category: "payment",
        badgeLabel: "PAYMENT VERIFICATION",
        title: `${pendingPaymentCount} Payment Submission${pendingPaymentCount > 1 ? "s" : ""} Pending Approval`,
        description: `Resident proofs submitted via Messenger / portal awaiting admin verification.`,
        metadata: "Channel: GCash / Maya / Bank",
        timestamp: "Awaiting Action",
        targetTab: "payments",
        actionLabel: "Verify Now"
      });
    }

    // 2. Critical & Routine Maintenance Tickets (ROSE & SKY)
    const tickets = db.maintenanceRequests || [];
    const openTickets = tickets.filter((t) => t.status === "pending" || t.status === "in_progress");

    openTickets.forEach((ticket) => {
      const isCritical =
        (ticket.priority || "").toLowerCase() === "critical" ||
        (ticket.priority || "").toLowerCase() === "high";

      const roomLabel = ticket.room_number ? `Room ${ticket.room_number.replace(/^room\s*/i, "")}` : "Unit";

      items.push({
        id: `ticket-${ticket.id}`,
        category: isCritical ? "critical" : "maintenance",
        badgeLabel: isCritical ? "CRITICAL REPAIR" : "MAINTENANCE TICKET",
        title: `${ticket.category || "Repair"} in ${roomLabel} • ${(ticket.priority || "Normal").toUpperCase()}`,
        description: ticket.issue_description || "Maintenance reported by resident.",
        metadata: `Tenant: ${ticket.tenant_name || "Resident"} • #${ticket.id}`,
        timestamp: ticket.created_at ? new Date(ticket.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "Recent",
        targetTab: "maintenance",
        actionLabel: "View Ticket"
      });
    });

    // 3. Overdue Billing Statements (AMBER)
    const overdueBills = (db.billingRecords || []).filter((b) => b.payment_status === "overdue");
    overdueBills.forEach((bill) => {
      items.push({
        id: `bill-overdue-${bill.id}`,
        category: "overdue",
        badgeLabel: "OVERDUE ACCOUNT",
        title: `Overdue Rent: ${bill.tenant_name} (${bill.room_number ? `Room ${bill.room_number}` : "Unit"})`,
        description: `Statement for ${bill.billing_month || "Period"} past due. Balance: ₱${Number(bill.total_amount || 0).toLocaleString()}.`,
        metadata: `Due: ${bill.due_date || "Overdue"}`,
        timestamp: "Overdue",
        targetTab: "billing",
        actionLabel: "View Ledger"
      });
    });

    // 4. Prospective Tenant Inquiries (VIOLET)
    const newInquiries = (db.inquiries || []).filter((i) => i.status === "new");
    newInquiries.forEach((inq) => {
      items.push({
        id: `inq-${inq.id}`,
        category: "inquiry",
        badgeLabel: "TENANT INQUIRY",
        title: `Viewing Request: ${inq.name} (${inq.room_number ? `Room ${inq.room_number}` : inq.apartment_name || "Unit"})`,
        description: inq.message || "Prospective resident requested unit availability or tour.",
        metadata: `Contact: ${inq.phone || inq.email || "Online"}`,
        timestamp: inq.created_at ? new Date(inq.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "New",
        targetTab: "dashboard",
        actionLabel: "View Lead"
      });
    });

    // 5. System Notifications (`db.notifications`) (TEAL & SLATE)
    (db.notifications || []).forEach((notif) => {
      if (notif.type === "overdue" && overdueBills.length > 0) return;

      const isBilling = notif.type === "billing";
      const category = isBilling ? "billing" : "system";

      items.push({
        id: `db-notif-${notif.id}`,
        category,
        badgeLabel: isBilling ? "BILLING NOTICE" : "SYSTEM NOTICE",
        title: `${notif.tenant_name ? `${notif.tenant_name}: ` : ""}${isBilling ? "Rental Invoice Issued" : "Notice"}`,
        description: notif.message,
        metadata: `Channel: ${(notif.channel || "in-app").toUpperCase()}`,
        timestamp: notif.created_at ? new Date(notif.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "Recent",
        targetTab: isBilling ? "billing" : "logs",
        actionLabel: isBilling ? "View Billing" : "View Logs"
      });
    });

    // Priority order
    const priorityRank: Record<NotificationItem["category"], number> = {
      critical: 0,
      payment: 1,
      overdue: 2,
      maintenance: 3,
      inquiry: 4,
      billing: 5,
      system: 6
    };

    return items.sort((a, b) => priorityRank[a.category] - priorityRank[b.category]);
  }, [db, pendingPaymentCount]);

  // Only unread notifications contribute to the bell badge/counts. Read notifications remain visible.
  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !readNotificationIds.has(n.id)),
    [notifications, readNotificationIds]
  );

  const counts = useMemo(() => {
    return {
      all: unreadNotifications.length,
      critical: unreadNotifications.filter((n) => n.category === "critical").length,
      payment: unreadNotifications.filter((n) => n.category === "payment").length,
      overdue: unreadNotifications.filter((n) => n.category === "overdue").length,
      maintenance: unreadNotifications.filter((n) => n.category === "maintenance").length,
      inquiry: unreadNotifications.filter((n) => n.category === "inquiry").length,
      billing: unreadNotifications.filter((n) => n.category === "billing").length,
      system: unreadNotifications.filter((n) => n.category === "system").length
    };
  }, [unreadNotifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (activeCategory === "all") return notifications;
    return notifications.filter((n) => n.category === activeCategory);
  }, [notifications, activeCategory]);

  const handleItemClick = (item: NotificationItem) => {
    if (!readNotificationIds.has(item.id)) {
      const next = new Set(readNotificationIds);
      next.add(item.id);
      setReadNotificationIds(next);
      try {
        localStorage.setItem("rentflow_read_notifications", JSON.stringify(Array.from(next)));
      } catch {
        // Keep the in-memory read state even if browser storage is unavailable.
      }
    }
    onNavigateTab(item.targetTab);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 neu-btn rounded-lg flex items-center justify-center transition-all ${
          isOpen ? "bg-[#EF6905] text-white shadow-xs" : "text-[#EF6905] hover:text-[#8B2626]"
        }`}
        title="Notifications Center"
        aria-label="Toggle notifications center"
      >
        <Bell className="w-3.5 h-3.5" />
      </button>

      {/* Unread Count Badge: only unread notifications are counted. */}
      {unreadNotifications.length > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#8B2626] text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-[0_0_6px_rgba(231,63,30,0.6)] animate-pulse">
          {unreadNotifications.length}
        </span>
      )}

      {/* Dropdown Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-10 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[480px]"
          >
            {/* Popover Header */}
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#EF6905]" />
                <span className="font-extrabold text-xs tracking-tight">Notifications Center</span>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-black">
                  {unreadNotifications.length} Unread
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold p-1"
                aria-label="Close notifications popover"
              >
                ✕
              </button>
            </div>

            {/* Category Filter Tabs with Colors */}
            <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 overflow-x-auto text-[11px] no-scrollbar">
              <button
                onClick={() => setActiveCategory("all")}
                className={`px-2 py-1 rounded-lg font-bold transition-all shrink-0 ${
                  activeCategory === "all" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({counts.all})
              </button>

              {counts.critical > 0 && (
                <button
                  onClick={() => setActiveCategory("critical")}
                  className={`px-2 py-1 rounded-lg font-bold transition-all shrink-0 border ${
                    activeCategory === "critical"
                      ? CATEGORY_STYLES.critical.tabPillActive
                      : CATEGORY_STYLES.critical.tabPillInactive
                  }`}
                >
                  <span>🚨 Critical ({counts.critical})</span>
                </button>
              )}

              {counts.payment > 0 && (
                <button
                  onClick={() => setActiveCategory("payment")}
                  className={`px-2 py-1 rounded-lg font-bold transition-all shrink-0 border ${
                    activeCategory === "payment"
                      ? CATEGORY_STYLES.payment.tabPillActive
                      : CATEGORY_STYLES.payment.tabPillInactive
                  }`}
                >
                  <span>💳 Payments ({counts.payment})</span>
                </button>
              )}

              {counts.overdue > 0 && (
                <button
                  onClick={() => setActiveCategory("overdue")}
                  className={`px-2 py-1 rounded-lg font-bold transition-all shrink-0 border ${
                    activeCategory === "overdue"
                      ? CATEGORY_STYLES.overdue.tabPillActive
                      : CATEGORY_STYLES.overdue.tabPillInactive
                  }`}
                >
                  <span>⚠️ Overdue ({counts.overdue})</span>
                </button>
              )}

              {counts.maintenance > 0 && (
                <button
                  onClick={() => setActiveCategory("maintenance")}
                  className={`px-2 py-1 rounded-lg font-bold transition-all shrink-0 border ${
                    activeCategory === "maintenance"
                      ? CATEGORY_STYLES.maintenance.tabPillActive
                      : CATEGORY_STYLES.maintenance.tabPillInactive
                  }`}
                >
                  <span>🔧 Repairs ({counts.maintenance})</span>
                </button>
              )}

              {counts.inquiry > 0 && (
                <button
                  onClick={() => setActiveCategory("inquiry")}
                  className={`px-2 py-1 rounded-lg font-bold transition-all shrink-0 border ${
                    activeCategory === "inquiry"
                      ? CATEGORY_STYLES.inquiry.tabPillActive
                      : CATEGORY_STYLES.inquiry.tabPillInactive
                  }`}
                >
                  <span>📩 Inquiries ({counts.inquiry})</span>
                </button>
              )}

              {(counts.billing > 0 || counts.system > 0) && (
                <button
                  onClick={() => setActiveCategory("billing")}
                  className={`px-2 py-1 rounded-lg font-bold transition-all shrink-0 border ${
                    activeCategory === "billing"
                      ? CATEGORY_STYLES.billing.tabPillActive
                      : CATEGORY_STYLES.billing.tabPillInactive
                  }`}
                >
                  <span>📄 Billing ({counts.billing + counts.system})</span>
                </button>
              )}
            </div>

            {/* Notification Items List with Color Differentiation */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 max-h-[310px]">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <span className="font-bold text-slate-700">All clear!</span>
                  <span className="text-[11px] text-slate-400">No active notifications in this category.</span>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const style = CATEGORY_STYLES[notif.category] || CATEGORY_STYLES.system;
                  const isRead = readNotificationIds.has(notif.id);

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleItemClick(notif)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                        isRead
                          ? "bg-slate-50 border-slate-200 opacity-70"
                          : `${style.borderLeft} ${style.cardBorder} ${style.cardBg} hover:shadow-xs`
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-7 h-7 rounded-lg ${style.iconBg} flex items-center justify-center shrink-0 font-bold mt-0.5`}>
                          <span className="text-xs leading-none">{style.iconEmoji}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${style.badgeBg} ${style.badgeText}`}>
                              {notif.badgeLabel}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                              isRead ? "bg-slate-200 text-slate-500" : style.badgeBg + " " + style.badgeText
                            }`}>
                              {isRead ? "READ" : "NEW"}
                            </span>
                            {notif.metadata && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                • {notif.metadata}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              • {notif.timestamp}
                            </span>
                          </div>

                          <h5 className="text-xs font-bold text-slate-900 mt-1 leading-snug">
                            {notif.title}
                          </h5>

                          <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                            {notif.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-1">
                        <span className="text-[10px] font-black text-[#EF6905] hover:text-[#8B2626] flex items-center gap-1">
                          <span>{notif.actionLabel}</span>
                          <ArrowRight className="w-3 h-3 text-[#EF6905]" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Popover Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 font-medium">
                Unread notifications are highlighted. Click one to mark it as read.
              </span>
              <button
                onClick={() => {
                  onNavigateTab("dashboard");
                  setIsOpen(false);
                }}
                className="font-bold text-[#EF6905] hover:text-[#8B2626] transition-colors flex items-center gap-1"
              >
                <span>Operations Panel</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
