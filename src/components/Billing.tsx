import React, { useState } from "react";
import { DBState, api } from "../lib/api";
import { BillingRecord, Tenant, Room } from "../types";
import { FileText, CheckCircle2, AlertTriangle, Clock, Search, Plus, Calendar, Download, Eye, X, FileSpreadsheet, Wand2, Building, ChevronDown, ChevronUp, DollarSign, History, Calculator, Zap, Droplet, Send, MessageCircle, Share2, Copy, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BillingProps {
  db: DBState;
  onRefresh: () => void;
}

export default function Billing({ db, onRefresh }: BillingProps) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"billing_statements" | "utility_calculator" | "advance_deposit_ledger">("billing_statements");
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);

  // Dialog States
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [editingBill, setEditingBill] = useState<BillingRecord | null>(null); // null = Add mode

  // Form States
  const [formTenantId, setFormTenantId] = useState("");
  const [formRentAmount, setFormRentAmount] = useState(0);
  const [formElectricityAmount, setFormElectricityAmount] = useState(0);
  const [formElectricityUsage, setFormElectricityUsage] = useState(0);
  const [formWaterAmount, setFormWaterAmount] = useState(0);
  const [formWaterUsage, setFormWaterUsage] = useState(0);
  const [formBillingMonth, setFormBillingMonth] = useState("June 2026");
  const [formDueDate, setFormDueDate] = useState("");
  const [formPaymentStatus, setFormPaymentStatus] = useState<"unpaid" | "paid" | "overdue" | "partial">("unpaid");
  const [formNotes, setFormNotes] = useState("");
  const [formBillImageUrl, setFormBillImageUrl] = useState("");

  // Utility Calculator States
  const [calcTenantId, setCalcTenantId] = useState("");
  const [calcRentPortion, setCalcRentPortion] = useState(0);
  const [calcIncludeRent, setCalcIncludeRent] = useState(true);
  const [calcBillingMonth, setCalcBillingMonth] = useState("July 2026");
  const [calcDueDate, setCalcDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  
  const [calcElectricityPrev, setCalcElectricityPrev] = useState(0);
  const [calcElectricityCurr, setCalcElectricityCurr] = useState(0);
  const [calcElectricityRate, setCalcElectricityRate] = useState(12.5); // PHP per kWh
  
  const [calcWaterPrev, setCalcWaterPrev] = useState(0);
  const [calcWaterCurr, setCalcWaterCurr] = useState(0);
  const [calcWaterRate, setCalcWaterRate] = useState(35.0); // PHP per m³
  
  const [calcSendInApp, setCalcSendInApp] = useState(true);
  const [calcSendSMS, setCalcSendSMS] = useState(true);
  const [calcSendEmail, setCalcSendEmail] = useState(true);
  const [calcSendMessenger, setCalcSendMessenger] = useState(true);
  const [calcNotes, setCalcNotes] = useState("");
  const [calcSuccessMessage, setCalcSuccessMessage] = useState("");

  // Messenger Dialog States
  const [showMessengerModal, setShowMessengerModal] = useState(false);
  const [messengerSummaryText, setMessengerSummaryText] = useState("");
  const [messengerTenantName, setMessengerTenantName] = useState("");
  const [messengerCopySuccess, setMessengerCopySuccess] = useState(false);
  const [messengerUrl, setMessengerUrl] = useState("https://www.messenger.com");

  // Ledger Posting States
  const [showPostLedgerModal, setShowPostLedgerModal] = useState(false);
  const [postLedgerTenantId, setPostLedgerTenantId] = useState("");
  const [postLedgerType, setPostLedgerType] = useState<"deposit_payment" | "deposit_refund" | "deposit_deduction" | "advance_payment" | "advance_use" | "advance_refund">("deposit_payment");
  const [postLedgerAmount, setPostLedgerAmount] = useState("");
  const [postLedgerDescription, setPostLedgerDescription] = useState("");
  const [ledgerPostingLoading, setLedgerPostingLoading] = useState(false);

  const handleOpenPostLedger = (tenantId?: string) => {
    const targetTenant = tenantId ? db.tenants.find(t => t.id === tenantId) : db.tenants.find(t => t.status === "active");
    setPostLedgerTenantId(targetTenant ? targetTenant.id : (db.tenants[0]?.id || ""));
    setPostLedgerType("deposit_payment");
    setPostLedgerAmount("");
    setPostLedgerDescription("");
    setShowPostLedgerModal(true);
  };

  const handlePostLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postLedgerTenantId || !postLedgerAmount || isNaN(Number(postLedgerAmount)) || Number(postLedgerAmount) <= 0) {
      alert("Please select a tenant and enter a valid positive amount.");
      return;
    }

    setLedgerPostingLoading(true);
    try {
      const res = await api.recordTenantLedger(postLedgerTenantId, {
        type: postLedgerType,
        amount: Number(postLedgerAmount),
        description: postLedgerDescription,
      });

      setShowPostLedgerModal(false);
      setPostLedgerAmount("");
      setPostLedgerDescription("");
      onRefresh();

      if (res.messenger_text) {
        setMessengerSummaryText(res.messenger_text);
        setMessengerTenantName(res.tenant?.name || "Tenant");
        setMessengerUrl(res.messenger_url || "https://www.messenger.com");
        setShowMessengerModal(true);
        setMessengerCopySuccess(false);
        try {
          navigator.clipboard.writeText(res.messenger_text);
          setMessengerCopySuccess(true);
        } catch (err) {
          console.error(err);
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to post ledger transaction.");
    } finally {
      setLedgerPostingLoading(false);
    }
  };

  const handleShareLedgerToMessenger = (entry: any, tenant: Tenant) => {
    const room = db.rooms.find(r => r.id === tenant.room_id);
    const apt = db.apartments.find(a => a.id === tenant.apartment_id);
    const roomNum = room ? room.room_number : "N/A";
    const aptName = apt ? apt.name : "ApartmentPro Plaza";
    
    const typeLabels: Record<string, string> = {
      deposit_payment: "Security Deposit Payment (Added)",
      deposit_refund: "Security Deposit Refund (Released)",
      deposit_deduction: "Security Deposit Deduction",
      advance_payment: "Advance Rent Payment (Added)",
      advance_use: "Advance Rent Applied to Stay / Bill",
      advance_refund: "Advance Rent Refund (Released)"
    };
    const typeLabel = typeLabels[entry.type] || entry.type.replace(/_/g, ' ').toUpperCase();
    const depBal = tenant.deposit_balance !== undefined ? tenant.deposit_balance : tenant.deposit;
    const advBal = tenant.advance_balance !== undefined ? tenant.advance_balance : (tenant.advance_payment || tenant.rent_amount || 0);

    const formattedDate = new Date(entry.created_at || Date.now()).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const text = `📜 APARTMENT LEDGER & ESCROW RECEIPT\n` +
      `🏢 ${aptName}\n` +
      `👤 Tenant: ${tenant.name} (Room ${roomNum})\n` +
      `📅 Transaction Date: ${formattedDate}\n\n` +
      `-----------------------------------\n` +
      `📌 Transaction: ${typeLabel}\n` +
      `💵 Amount: ₱${Number(entry.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      (entry.description ? `📝 Remarks / Reason: ${entry.description}\n` : '') +
      `-----------------------------------\n` +
      `📊 UPDATED ACCOUNT BALANCES:\n` +
      `🛡️ Security Deposit Balance: ₱${Number(depBal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `💳 Advance Rent Balance: ₱${Number(advBal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
      `This transaction has been officially recorded in your property ledger. Please retain this receipt for your reference. Thank you!`;

    setMessengerSummaryText(text);
    setMessengerTenantName(tenant.name);
    const mUrl = tenant.messenger_psid 
      ? (tenant.messenger_psid.startsWith("http") ? tenant.messenger_psid : `https://www.messenger.com/t/${tenant.messenger_psid}`)
      : "https://www.messenger.com";
    setMessengerUrl(mUrl);
    setShowMessengerModal(true);
    setMessengerCopySuccess(false);

    try {
      navigator.clipboard.writeText(text);
      setMessengerCopySuccess(true);
    } catch (err) {
      console.error(err);
    }
  };

  const generateMessengerBillText = (
    tenantName: string,
    roomNumber: string,
    billingMonth: string,
    dueDate: string,
    rentAmt: number,
    elecUsage: number,
    elecAmt: number,
    elecRate: number,
    waterUsage: number,
    waterAmt: number,
    waterRate: number,
    grandTotal: number,
    notes?: string
  ) => {
    return `📋 UTILITY & RENT BILL STATEMENT\n` +
      `👤 Tenant: ${tenantName} (Room ${roomNumber})\n` +
      `📅 Billing Cycle: ${billingMonth}\n` +
      `⏰ Payment Due Date: ${dueDate}\n\n` +
      `-----------------------------------\n` +
      (rentAmt > 0 ? `🏠 Monthly Room Rent: ₱${rentAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` : '') +
      `⚡ Electricity (${elecUsage} kWh @ ₱${elecRate}/kWh): ₱${elecAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `💧 Water (${waterUsage} m³ @ ₱${waterRate}/m³): ₱${waterAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `-----------------------------------\n` +
      `💰 TOTAL AMOUNT DUE: ₱${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
      (notes ? `📝 Note: ${notes}\n\n` : '') +
      `Kindly reply with your payment receipt once remitted. Thank you!`;
  };

  const handleShareBillToMessenger = (bill: BillingRecord) => {
    const text = `📋 UTILITY & RENT STATEMENT\n` +
      `👤 Tenant: ${bill.tenant_name} (Room ${bill.room_number})\n` +
      `📅 Billing Cycle: ${bill.billing_month}\n` +
      `⏰ Payment Due Date: ${bill.due_date}\n\n` +
      `-----------------------------------\n` +
      `🏠 Base Rent: ₱${bill.rent_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
      `⚡ Power (${bill.electricity_usage || 0} kWh): ₱${bill.electricity_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
      `💧 Water (${bill.water_usage || 0} m³): ₱${(bill.water_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
      `-----------------------------------\n` +
      `💰 TOTAL DUE: ₱${bill.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
      `Status: ${bill.payment_status.toUpperCase()}\n\n` +
      `Kindly reply with your receipt when paid. Thank you!`;

    setMessengerSummaryText(text);
    setMessengerTenantName(bill.tenant_name);
    setShowMessengerModal(true);
    setMessengerCopySuccess(false);

    try {
      navigator.clipboard.writeText(text);
      setMessengerCopySuccess(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyMessengerText = () => {
    try {
      navigator.clipboard.writeText(messengerSummaryText);
      setMessengerCopySuccess(true);
      setTimeout(() => setMessengerCopySuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenMessengerApp = () => {
    window.open(messengerUrl || "https://www.messenger.com", "_blank", "noopener,noreferrer");
  };

  const getLatestTenantUtilityReadings = (tenantId: string) => {
    const tenantBills = db.billingRecords
      .filter((b) => b.tenant_id === tenantId)
      .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
    
    if (tenantBills.length > 0) {
      const latest = tenantBills[0];
      return {
        electricity_prev: latest.electricity_usage || 0,
        water_prev: latest.water_usage || 0,
      };
    }
    return { electricity_prev: 0, water_prev: 0 };
  };

  // Auto-init calculator tenant and read latest readings
  const handleCalcTenantSelect = (tenantId: string) => {
    setCalcTenantId(tenantId);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (tenant) {
      setCalcRentPortion(tenant.rent_amount);
      const prevReadings = getLatestTenantUtilityReadings(tenantId);
      setCalcElectricityPrev(prevReadings.electricity_prev);
      setCalcWaterPrev(prevReadings.water_prev);
      setCalcElectricityCurr(prevReadings.electricity_prev + 120);
      setCalcWaterCurr(prevReadings.water_prev + 8);
    }
  };

  React.useEffect(() => {
    if (activeSubTab === "utility_calculator" && !calcTenantId) {
      const activeTenants = db.tenants.filter((t) => t.status === "active");
      if (activeTenants.length > 0) {
        handleCalcTenantSelect(activeTenants[0].id);
      }
    }
  }, [activeSubTab, db.tenants]);

  const handleCalcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCalcSuccessMessage("");

    const tenant = db.tenants.find((t) => t.id === calcTenantId);
    if (!tenant) {
      setLoading(false);
      return;
    }
    const room = db.rooms.find((r) => r.id === tenant.room_id);

    const rentAmt = calcIncludeRent ? Number(calcRentPortion) : 0;
    
    const elecUsage = Math.max(0, Number(calcElectricityCurr) - Number(calcElectricityPrev));
    const elecAmt = elecUsage * Number(calcElectricityRate);
    
    const waterUsage = Math.max(0, Number(calcWaterCurr) - Number(calcWaterPrev));
    const waterAmt = waterUsage * Number(calcWaterRate);
    
    const grandTotal = rentAmt + elecAmt + waterAmt;

    const baseNotes = calcNotes || `Monthly utility breakdown and rent statement.`;
    const fullNotes = `${baseNotes} [Electricity: ${Number(calcElectricityPrev)} to ${Number(calcElectricityCurr)} kWh, ₱${calcElectricityRate}/kWh] [Water: ${Number(calcWaterPrev)} to ${Number(calcWaterCurr)} m³, ₱${calcWaterRate}/m³]`;

    const payload = {
      tenant_id: calcTenantId,
      tenant_name: tenant.name,
      room_id: tenant.room_id,
      room_number: room?.room_number || "N/A",
      apartment_id: tenant.apartment_id,
      rent_amount: rentAmt,
      electricity_amount: elecAmt,
      electricity_usage: elecUsage,
      water_amount: waterAmt,
      water_usage: waterUsage,
      total_amount: grandTotal,
      billing_month: calcBillingMonth,
      due_date: calcDueDate,
      payment_status: "unpaid" as const,
      notes: fullNotes,
    };

    try {
      await api.createBilling(payload);
      
      const channels = [];
      if (calcSendInApp) channels.push("In-App Notification");
      if (calcSendSMS) channels.push(`SMS Notification to ${tenant.contact}`);
      if (calcSendEmail) channels.push(`Email Invoice to ${tenant.email}`);
      if (calcSendMessenger) channels.push(`Facebook Messenger`);

      const messengerMsg = generateMessengerBillText(
        tenant.name,
        room?.room_number || "N/A",
        calcBillingMonth,
        calcDueDate,
        rentAmt,
        elecUsage,
        elecAmt,
        calcElectricityRate,
        waterUsage,
        waterAmt,
        calcWaterRate,
        grandTotal,
        calcNotes
      );

      if (calcSendMessenger) {
        setMessengerSummaryText(messengerMsg);
        setMessengerTenantName(tenant.name);
        setShowMessengerModal(true);
        setMessengerCopySuccess(false);
        try {
          await navigator.clipboard.writeText(messengerMsg);
          setMessengerCopySuccess(true);
        } catch (e) {
          console.error(e);
        }
      }

      setCalcSuccessMessage(`Billing created & dispatched successfully! Total: ₱${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Outlets used: ${channels.join(", ")}`);
      onRefresh();

      if (!calcSendMessenger) {
        setTimeout(() => {
          setCalcSuccessMessage("");
          setActiveSubTab("billing_statements");
        }, 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const paidBills = db.billingRecords.filter((b) => b.payment_status === "paid");
  const unpaidBills = db.billingRecords.filter((b) => b.payment_status === "unpaid" || !b.payment_status);
  const overdueBills = db.billingRecords.filter((b) => b.payment_status === "overdue");
  const partialBills = db.billingRecords.filter((b) => b.payment_status === "partial");

  const sumAmount = (list: BillingRecord[]) => list.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

  // Tenant selection handler: pre-fill standard rent from active contract
  const handleTenantSelect = (tenantId: string) => {
    setFormTenantId(tenantId);
    const tenant = db.tenants.find((t) => t.id === tenantId);
    if (tenant) {
      setFormRentAmount(tenant.rent_amount);
    }
  };

  const handleOpenAdd = () => {
    setEditingBill(null);
    const activeTenants = db.tenants.filter((t) => t.status === "active");
    if (activeTenants.length > 0) {
      setFormTenantId(activeTenants[0].id);
      setFormRentAmount(activeTenants[0].rent_amount);
    } else {
      setFormTenantId("");
      setFormRentAmount(0);
    }
    setFormElectricityAmount(0);
    setFormElectricityUsage(0);
    setFormWaterAmount(0);
    setFormWaterUsage(0);
    setFormBillingMonth("June 2026");
    setFormDueDate(new Date().toISOString().split("T")[0]);
    setFormPaymentStatus("unpaid");
    setFormNotes("");
    setFormBillImageUrl("");
    setShowBillDialog(true);
  };

  const handleOpenEdit = (bill: BillingRecord) => {
    setEditingBill(bill);
    setFormTenantId(bill.tenant_id);
    setFormRentAmount(bill.rent_amount);
    setFormElectricityAmount(bill.electricity_amount);
    setFormElectricityUsage(bill.electricity_usage);
    setFormWaterAmount(bill.water_amount || 0);
    setFormWaterUsage(bill.water_usage || 0);
    setFormBillingMonth(bill.billing_month);
    setFormDueDate(bill.due_date);
    setFormPaymentStatus(bill.payment_status);
    setFormNotes(bill.notes);
    setFormBillImageUrl(bill.bill_image_url || "");
    setShowBillDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const tenant = db.tenants.find((t) => t.id === formTenantId);
    const room = db.rooms.find((r) => r.id === tenant?.room_id);

    const totalCalculated = Number(formRentAmount) + Number(formElectricityAmount) + Number(formWaterAmount);

    const payload = {
      tenant_id: formTenantId,
      tenant_name: tenant?.name || "Unknown Tenant",
      room_id: tenant?.room_id || "",
      room_number: room?.room_number || "N/A",
      apartment_id: tenant?.apartment_id || "",
      rent_amount: Number(formRentAmount),
      electricity_amount: Number(formElectricityAmount),
      electricity_usage: Number(formElectricityUsage),
      water_amount: Number(formWaterAmount),
      water_usage: Number(formWaterUsage),
      total_amount: totalCalculated,
      billing_month: formBillingMonth,
      due_date: formDueDate,
      payment_status: formPaymentStatus,
      bill_image_url: formBillImageUrl,
      notes: formNotes,
    };

    try {
      if (editingBill) {
        await api.updateBilling(editingBill.id, payload);
      } else {
        await api.createBilling(payload);
      }
      setShowBillDialog(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (billId: string) => {
    if (!window.confirm("Mark this invoice statement as Paid in Full?")) return;
    setLoading(true);
    try {
      await api.payBilling(billId);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // CSV Export
  const handleCSVExport = () => {
    const headers = [
      "Invoice ID",
      "Tenant Name",
      "Room Number",
      "Billing Month",
      "Base Rent",
      "Electricity Bill",
      "Power Usage (kWh)",
      "Total Invoiced",
      "Due Date",
      "Payment Status",
      "Notes"
    ];

    const rows = db.billingRecords.map((b) => [
      b.id,
      b.tenant_name,
      `Room ${b.room_number}`,
      b.billing_month,
      b.rent_amount,
      b.electricity_amount,
      b.electricity_usage,
      b.total_amount,
      b.due_date,
      b.payment_status.toUpperCase(),
      b.notes.replace(/[\n\r]+/g, " ")
    ]);

    const csvContent = [headers.join(","), ...rows.map((e) => e.map(val => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ApartmentPro_Billing_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getApartmentName = (id: string) => {
    return db.apartments.find((a) => a.id === id)?.name || "ApartmentPro Plaza";
  };

  // Filtering list
  const filteredBills = db.billingRecords.filter((b) => {
    const aptName = getApartmentName(b.apartment_id);
    const tName = b.tenant_name || "";
    const rNum = b.room_number || "";
    const bMonth = b.billing_month || "";
    const matchesQuery =
      tName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rNum.includes(searchQuery) ||
      aptName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bMonth.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate = !dueDateFilter || b.due_date === dueDateFilter;

    return matchesQuery && matchesDate;
  });

  // Group by Apartment
  const billsByApartment = db.apartments.reduce((acc, apt) => {
    const list = filteredBills.filter((b) => b.apartment_id === apt.id);
    if (list.length > 0) {
      acc[apt.name] = list;
    }
    return acc;
  }, {} as Record<string, BillingRecord[]>);

  // Collect unmapped bills if any
  const unmappedBills = filteredBills.filter(b => !db.apartments.some(a => a.id === b.apartment_id));
  if (unmappedBills.length > 0) {
    billsByApartment["Other Listings"] = unmappedBills;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Billing & Ledger</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Review tenant invoice sheets, manage billing details, and export ledgers.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleCSVExport}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex border-b border-slate-200 gap-6 mt-2 mb-4 overflow-x-auto scrollbar-none whitespace-nowrap">
        <button
          onClick={() => setActiveSubTab("billing_statements")}
          className={`pb-3 text-sm font-bold transition-all relative shrink-0 ${
            activeSubTab === "billing_statements"
              ? "text-brand-orange font-extrabold border-b-2 border-brand-orange"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Statements & Invoices
        </button>
        <button
          onClick={() => setActiveSubTab("utility_calculator")}
          className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 shrink-0 ${
            activeSubTab === "utility_calculator"
              ? "text-brand-orange font-extrabold border-b-2 border-brand-orange"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calculator className="w-4 h-4 text-brand-orange" />
          <span>Calculate & Send Utilities</span>
        </button>
        <button
          onClick={() => setActiveSubTab("advance_deposit_ledger")}
          className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 shrink-0 ${
            activeSubTab === "advance_deposit_ledger"
              ? "text-brand-orange font-extrabold border-b-2 border-brand-orange"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <DollarSign className="w-4 h-4 text-brand-orange" />
          <span>Security Deposits & Advance Rent Ledger</span>
        </button>
      </div>

      {activeSubTab === "billing_statements" ? (
        <>
          {/* Summary Matrix Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Paid */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Receipted Paid</span>
                <span className="text-2xl font-bold text-emerald-600 block mt-1">₱{sumAmount(paidBills).toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 font-medium block mt-1">{paidBills.length} settled statements</span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* Unpaid */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Outstanding Unpaid</span>
                <span className="text-2xl font-bold text-blue-600 block mt-1">₱{sumAmount(unpaidBills).toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 font-medium block mt-1">{unpaidBills.length} pending statements</span>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            {/* Overdue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Overdue Incurred</span>
                <span className="text-2xl font-bold text-rose-600 block mt-1">₱{sumAmount(overdueBills).toLocaleString()}</span>
                <span className="text-[10px] text-rose-500 font-bold block mt-1">{overdueBills.length} breach limits</span>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* Partial */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Partial Collected</span>
                <span className="text-2xl font-bold text-amber-500 block mt-1">₱{sumAmount(partialBills).toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 font-medium block mt-1">{partialBills.length} custom adjustments</span>
              </div>
              <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Table Filters bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
              <input
                type="text"
                placeholder="Search tenant, room, month, building..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange focus:bg-white transition-all text-sm font-medium text-slate-800"
              />
            </div>
            <div className="w-full sm:w-auto flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-slate-400" />
              <input
                type="date"
                value={dueDateFilter}
                onChange={(e) => setDueDateFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs font-semibold focus:outline-none text-slate-700 focus:ring-2 focus:ring-brand-orange focus:bg-white transition-all"
              />
              {dueDateFilter && (
                <button onClick={() => setDueDateFilter("")} className="text-xs text-rose-500 font-bold hover:underline">
                  Clear Date
                </button>
              )}
            </div>
          </div>

          {/* Billing groups lists */}
          <div className="space-y-8">
            {Object.keys(billsByApartment).length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-2xl py-16 text-center text-slate-400">
                <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="font-bold">No Billing Statements Tracked</p>
                <p className="text-xs mt-1 text-slate-400 font-light">Modify query criteria or add statements.</p>
              </div>
            ) : (
              Object.entries(billsByApartment).map(([aptName, bills]) => (
                <div key={aptName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-slate-400" />
                      <h3 className="font-extrabold text-slate-800">{aptName}</h3>
                    </div>
                    <span className="px-2.5 py-0.5 bg-brand-orange/10 text-brand-orange text-xs font-bold rounded-lg font-mono">
                      {bills.length} Invoices
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-50/20">
                          <th className="py-3 px-6">Tenant & Room</th>
                          <th className="py-3 px-6">Period / Cycle</th>
                          <th className="py-3 px-6">Rent portion</th>
                          <th className="py-3 px-6">Power (usage kwh)</th>
                          <th className="py-3 px-6">Water (usage m³)</th>
                          <th className="py-3 px-6 font-black text-slate-900">Total Statement</th>
                          <th className="py-3 px-6">Due Date</th>
                          <th className="py-3 px-6">Status</th>
                          <th className="py-3 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {bills.map((bill) => {
                          const isExpanded = expandedTenantId === bill.tenant_id;
                          const tenantObj = db.tenants.find((t) => t.id === bill.tenant_id);
                          const ledgerEntries = (db.depositLedger || []).filter((e) => e.tenant_id === bill.tenant_id);

                          return (
                            <React.Fragment key={bill.id}>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3.5 px-6">
                                  <div className="flex items-center gap-2">
                                    {ledgerEntries.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedTenantId(isExpanded ? null : bill.tenant_id)}
                                        className="p-1 rounded-lg transition-all flex items-center gap-1 text-xs font-bold bg-amber-50 text-brand-orange hover:bg-amber-100/80 border border-amber-200/50 px-1.5"
                                        title={`View ${ledgerEntries.length} Advance & Deposit Ledger Transactions`}
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="w-4 h-4 shrink-0" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 shrink-0" />
                                        )}
                                        <span className="text-[10px] px-1 bg-brand-orange text-white rounded font-black font-mono leading-none py-0.5 min-w-[14px] text-center">
                                          {ledgerEntries.length}
                                        </span>
                                      </button>
                                    )}
                                    <div>
                                      <div className="font-bold text-slate-900">{bill.tenant_name || "Unassigned"}</div>
                                      <div className="text-[10px] font-bold text-slate-500 mt-0.5">Room {bill.room_number || "N/A"}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-6 font-semibold text-slate-700">{bill.billing_month || "Current Cycle"}</td>
                                <td className="py-3.5 px-6 font-medium text-slate-600">₱{(Number(bill.rent_amount) || 0).toLocaleString()}</td>
                                <td className="py-3.5 px-6 text-slate-600">
                                  <div className="font-medium">₱{(Number(bill.electricity_amount) || 0).toLocaleString()}</div>
                                  <div className="text-[9px] text-slate-400 font-mono font-bold">{bill.electricity_usage ?? 0} kWh consumed</div>
                                </td>
                                <td className="py-3.5 px-6 text-slate-600">
                                  <div className="font-medium">₱{(Number(bill.water_amount) || 0).toLocaleString()}</div>
                                  <div className="text-[9px] text-slate-400 font-mono font-bold">{(bill.water_usage ?? 0)} m³ consumed</div>
                                </td>
                                <td className="py-3.5 px-6 font-extrabold text-slate-900 text-sm">
                                  ₱{(Number(bill.total_amount) || 0).toLocaleString()}
                                </td>
                                <td className="py-3.5 px-6 font-mono text-slate-600 font-semibold">{bill.due_date || "N/A"}</td>
                                <td className="py-3.5 px-6">
                                  {bill.payment_status === "paid" ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                                      PAID
                                    </span>
                                  ) : bill.payment_status === "unpaid" ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md">
                                      UNPAID
                                    </span>
                                  ) : bill.payment_status === "partial" ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md">
                                      PARTIAL
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-md animate-pulse">
                                      OVERDUE
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-6 text-right">
                                  <div className="flex gap-2 justify-end">
                                    {bill.payment_status !== "paid" && (
                                      <button
                                        onClick={() => handleMarkAsPaid(bill.id)}
                                        className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] rounded-lg shadow-sm transition-all"
                                        title="Collect payment"
                                      >
                                        Collect Paid
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleOpenEdit(bill)}
                                      className="p-1.5 text-slate-500 hover:text-brand-orange hover:bg-slate-100 rounded-lg"
                                      title="Edit Details"
                                    >
                                      <Wand2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr className="bg-slate-50/40">
                                  <td colSpan={9} className="p-4 pl-12 border-b border-slate-150">
                                    <div className="space-y-4">
                                      {/* Balance Header Summary */}
                                      <div className="flex flex-wrap gap-4 items-center justify-between border-b border-slate-200/60 pb-3">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                            <DollarSign className="w-4 h-4 text-brand-orange" />
                                            Advance & Deposit Ledger Summary for <span className="text-slate-900 font-extrabold">{bill.tenant_name}</span>
                                          </span>
                                        </div>
                                        <div className="flex gap-4">
                                          <div className="bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-sm text-xs">
                                            <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] block">Deposit Balance</span>
                                            <span className="font-extrabold text-emerald-600">
                                              ₱{Number(tenantObj?.deposit_balance !== undefined ? tenantObj.deposit_balance : tenantObj?.deposit).toLocaleString()}
                                            </span>
                                          </div>
                                          <div className="bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-sm text-xs">
                                            <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] block">Advance Rent Balance</span>
                                            <span className="font-extrabold text-blue-600">
                                              ₱{Number(tenantObj?.advance_balance !== undefined ? tenantObj.advance_balance : (tenantObj?.advance_payment || tenantObj?.rent_amount)).toLocaleString()}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* List of Ledger Transactions */}
                                      <div className="space-y-2">
                                        {ledgerEntries.length === 0 ? (
                                          <div className="py-4 text-center text-xs text-slate-400 font-medium">
                                            No advance/deposit transactions recorded for this tenant yet.
                                          </div>
                                        ) : (
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                                            {ledgerEntries.slice().reverse().map((entry) => {
                                              const isNegative = ["deposit_deduction", "advance_use", "deposit_refund", "advance_refund"].includes(entry.type);
                                              return (
                                                <div
                                                  key={entry.id}
                                                  className="bg-white border border-slate-100 p-2.5 rounded-xl shadow-sm flex items-start justify-between gap-3 text-xs"
                                                >
                                                  <div className="space-y-0.5">
                                                    <span className={`inline-block px-1.5 py-0.5 text-[8px] font-bold rounded uppercase tracking-wider ${
                                                      entry.type.startsWith("deposit") ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                                                    }`}>
                                                      {entry.type.replace("_", " ")}
                                                    </span>
                                                    <p className="font-semibold text-slate-700 leading-tight mt-1">{entry.description}</p>
                                                    <span className="text-[9px] text-slate-400 block font-medium">
                                                      {new Date(entry.created_at).toLocaleString()}
                                                    </span>
                                                  </div>
                                                  <div className={`font-mono font-black text-xs shrink-0 ${isNegative ? "text-rose-600" : "text-emerald-600"}`}>
                                                    {isNegative ? "-" : "+"} ₱{entry.amount.toLocaleString()}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : activeSubTab === "utility_calculator" ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-150 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-brand-orange" />
                Interactive Utility Usage Bill Calculator
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically calculate and verify power and water usage against custom rates, bundle standard monthly rent, and dispatch a comprehensive invoice.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-brand-orange border border-amber-200/50 rounded-xl text-xs font-bold font-mono">
                <Zap className="w-3.5 h-3.5" /> Rate: ₱12.50/kWh
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200/50 rounded-xl text-xs font-bold font-mono">
                <Droplet className="w-3.5 h-3.5" /> Rate: ₱35.00/m³
              </span>
            </div>
          </div>

          {calcSuccessMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold"
            >
              {calcSuccessMessage}
            </motion.div>
          )}

          <form onSubmit={handleCalcSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tenant Selection & Basic Info */}
              <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Leaseholder & Cycle</h3>
                
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">Target Leaseholder</label>
                  <select
                    required
                    value={calcTenantId}
                    onChange={(e) => handleCalcTenantSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Select Occupant --</option>
                    {db.tenants.filter(t => t.status === "active").map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Room {db.rooms.find(r => r.id === t.room_id)?.room_number || "N/A"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">Statement Billing Cycle</label>
                  <input
                    type="text"
                    required
                    value={calcBillingMonth}
                    onChange={(e) => setCalcBillingMonth(e.target.value)}
                    placeholder="e.g. July 2026"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">Invoice Due Date</label>
                  <input
                    type="date"
                    required
                    value={calcDueDate}
                    onChange={(e) => setCalcDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs font-semibold text-slate-800"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200/60">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={calcIncludeRent}
                      onChange={(e) => setCalcIncludeRent(e.target.checked)}
                      className="rounded text-brand-orange focus:ring-brand-orange"
                    />
                    <span className="text-xs font-bold text-slate-700">Include Standard Rent Portion</span>
                  </label>
                  {calcIncludeRent && (
                    <div className="mt-2 text-xs font-bold text-slate-500 bg-white p-2 rounded border border-slate-100 flex justify-between">
                      <span>Room Rent:</span>
                      <span className="text-slate-800 font-mono">₱{Number(calcRentPortion).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Power / Electricity Calculation */}
              <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 space-y-4">
                <h3 className="text-xs font-black uppercase text-amber-600 tracking-wider flex items-center gap-1">
                  <Zap className="w-4 h-4 text-brand-orange" /> Power Usage (kWh)
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-xs">Previous Reading</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={calcElectricityPrev || 0}
                      onChange={(e) => setCalcElectricityPrev(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs font-mono font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-xs">Current Reading</label>
                    <input
                      type="number"
                      required
                      min={calcElectricityPrev}
                      value={calcElectricityCurr || 0}
                      onChange={(e) => setCalcElectricityCurr(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs font-mono font-semibold text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">Power Rate (₱ / kWh)</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min={0}
                    value={calcElectricityRate || 0}
                    onChange={(e) => setCalcElectricityRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs font-mono font-semibold text-slate-800"
                  />
                </div>

                <div className="bg-amber-50/50 border border-amber-200/50 p-3 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between font-medium text-slate-600">
                    <span>Power Usage:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {Math.max(0, calcElectricityCurr - calcElectricityPrev)} kWh
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-brand-orange pt-1 border-t border-amber-200/40">
                    <span>Electricity Cost:</span>
                    <span className="font-mono">
                      ₱{(Math.max(0, calcElectricityCurr - calcElectricityPrev) * calcElectricityRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Water Consumption Calculation */}
              <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 space-y-4">
                <h3 className="text-xs font-black uppercase text-blue-600 tracking-wider flex items-center gap-1 flex-row">
                  <Droplet className="w-4 h-4 text-blue-500" /> Water Usage (m³)
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-xs">Previous Reading</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={calcWaterPrev || 0}
                      onChange={(e) => setCalcWaterPrev(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs font-mono font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-xs">Current Reading</label>
                    <input
                      type="number"
                      required
                      min={calcWaterPrev}
                      value={calcWaterCurr || 0}
                      onChange={(e) => setCalcWaterCurr(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs font-mono font-semibold text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">Water Rate (₱ / m³)</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min={0}
                    value={calcWaterRate || 0}
                    onChange={(e) => setCalcWaterRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs font-mono font-semibold text-slate-800"
                  />
                </div>

                <div className="bg-blue-50/30 border border-blue-200/40 p-3 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between font-medium text-slate-600">
                    <span>Water Usage:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {Math.max(0, calcWaterCurr - calcWaterPrev)} m³
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-blue-600 pt-1 border-t border-blue-200/20">
                    <span>Water Cost:</span>
                    <span className="font-mono">
                      ₱{(Math.max(0, calcWaterCurr - calcWaterPrev) * calcWaterRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Dispatch Channels & Final Calculations Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="bg-slate-50/40 p-5 rounded-xl border border-slate-100 space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 flex-row">
                  <Send className="w-4 h-4 text-brand-orange" />
                  Instant Bill Notification & Delivery
                </h3>
                
                <p className="text-[11px] text-slate-400">
                  Select the delivery and messaging channels to dispatch the utility calculation breakdown instantly to the tenant.
                </p>

                <div className="space-y-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={calcSendInApp}
                      onChange={(e) => setCalcSendInApp(e.target.checked)}
                      className="rounded text-brand-orange focus:ring-brand-orange"
                    />
                    <div className="text-xs font-semibold text-slate-700">
                      <span>In-App Tenant Notification Hub</span>
                      <span className="block text-[10px] text-slate-400 font-normal">Saves statement immediately to tenant dashboard portal</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={calcSendSMS}
                      onChange={(e) => setCalcSendSMS(e.target.checked)}
                      className="rounded text-brand-orange focus:ring-brand-orange"
                    />
                    <div className="text-xs font-semibold text-slate-700">
                      <span>Instant SMS Dispatch</span>
                      <span className="block text-[10px] text-slate-400 font-normal">Sends complete text breakdown of rent, water, and power units</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={calcSendEmail}
                      onChange={(e) => setCalcSendEmail(e.target.checked)}
                      className="rounded text-brand-orange focus:ring-brand-orange"
                    />
                    <div className="text-xs font-semibold text-slate-700">
                      <span>Email PDF Invoice</span>
                      <span className="block text-[10px] text-slate-400 font-normal">Dispatches printable official receipt breakdown to tenant email inbox</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer bg-blue-50/60 p-2 rounded-xl border border-blue-200/50">
                    <input
                      type="checkbox"
                      checked={calcSendMessenger}
                      onChange={(e) => setCalcSendMessenger(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-xs font-semibold text-slate-800">
                      <span className="flex items-center gap-1.5 text-blue-600 font-bold">
                        <MessageCircle className="w-3.5 h-3.5 fill-blue-600 text-white" />
                        Facebook Messenger Direct Dispatch
                      </span>
                      <span className="block text-[10px] text-slate-500 font-normal">Formats and copies utility statement ready to send on Facebook Messenger</span>
                    </div>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200/60">
                  <label className="block text-slate-700 font-bold mb-1 text-xs">Ledger / Dispatch Notes</label>
                  <textarea
                    rows={2}
                    value={calcNotes}
                    onChange={(e) => setCalcNotes(e.target.value)}
                    placeholder="E.g. Thanks for being a wonderful tenant! Let us know if you have any questions."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs text-slate-700"
                  />
                </div>
              </div>

              {/* Real-time calculated statement panel */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden">
                {/* Visual decoration overlay */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/10 rounded-full blur-2xl pointer-events-none" />
                
                <div>
                  <h3 className="text-xs font-black uppercase text-brand-orange tracking-widest mb-4">Statement Invoice Summary</h3>
                  
                  <div className="space-y-2.5 text-xs">
                    {calcIncludeRent && (
                      <div className="flex justify-between text-slate-300">
                        <span>Base Rent:</span>
                        <span className="font-mono font-bold">₱{Number(calcRentPortion).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-300">
                      <span>Power ({(Math.max(0, calcElectricityCurr - calcElectricityPrev))} kWh):</span>
                      <span className="font-mono font-bold">₱{(Math.max(0, calcElectricityCurr - calcElectricityPrev) * calcElectricityRate).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Water ({(Math.max(0, calcWaterCurr - calcWaterPrev))} m³):</span>
                      <span className="font-mono font-bold">₱{(Math.max(0, calcWaterCurr - calcWaterPrev) * calcWaterRate).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400 font-bold">GRAND TOTAL INVOICED:</span>
                    <span className="text-3xl font-black text-brand-orange font-mono">
                      ₱{(
                        (calcIncludeRent ? Number(calcRentPortion) : 0) +
                        (Math.max(0, calcElectricityCurr - calcElectricityPrev) * calcElectricityRate) +
                        (Math.max(0, calcWaterCurr - calcWaterPrev) * calcWaterRate)
                      ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !calcTenantId}
                    className="w-full py-3 bg-brand-orange hover:bg-brand-orange/95 text-white font-black text-sm rounded-xl shadow-md shadow-brand-orange/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Send className="w-4 h-4" />
                    <span>{loading ? "Calculating & Dispatching..." : "Approve & Dispatch Statement"}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Security Deposits Held</span>
                <span className="text-2xl font-bold text-emerald-600 block mt-1">
                  ₱{db.tenants.filter(t => t.status === "active").reduce((sum, t) => sum + (t.deposit_balance !== undefined ? Number(t.deposit_balance) : Number(t.deposit || 0)), 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 font-medium block mt-1">Total escrowed safety deposits</span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Advance Rent Balance</span>
                <span className="text-2xl font-bold text-blue-600 block mt-1">
                  ₱{db.tenants.filter(t => t.status === "active").reduce((sum, t) => sum + (t.advance_balance !== undefined ? Number(t.advance_balance) : Number(t.advance_payment || t.rent_amount || 0)), 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 font-medium block mt-1">Total advance payments available</span>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Calendar className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Recorded Transactions</span>
                <span className="text-2xl font-bold text-slate-800 block mt-1">
                  {db.depositLedger ? db.depositLedger.length : 0}
                </span>
                <span className="text-[10px] text-slate-500 font-medium block mt-1">Ledger modifications processed</span>
              </div>
              <div className="p-3 bg-slate-50 text-slate-600 border border-slate-100 rounded-xl">
                <History className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Tenants Ledger List */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Tenant Deposit & Advance Rent Accounts</h3>
                <p className="text-[11px] text-slate-500">Manage security escrow and advance rentals with automatic Messenger dispatch</p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenPostLedger()}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-98"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Post Ledger Transaction</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-50/20">
                    <th className="py-3 px-6">Tenant & Room</th>
                    <th className="py-3 px-6">Base Rent / Contract</th>
                    <th className="py-3 px-6">Initial Sec Deposit</th>
                    <th className="py-3 px-6 text-emerald-600 font-bold">Current Deposit Bal</th>
                    <th className="py-3 px-6">Initial Advance Pay</th>
                    <th className="py-3 px-6 text-blue-600 font-bold">Current Advance Bal</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {db.tenants.filter(t => t.status === "active").map((tenant) => {
                    const matchedRoom = db.rooms.find(r => r.id === tenant.room_id);
                    const matchedApt = db.apartments.find(a => a.id === tenant.apartment_id);
                    const ledgerEntries = (db.depositLedger || []).filter(e => e.tenant_id === tenant.id);
                    const isExpanded = expandedTenantId === tenant.id;

                    const depBal = tenant.deposit_balance !== undefined ? tenant.deposit_balance : tenant.deposit;
                    const advBal = tenant.advance_balance !== undefined ? tenant.advance_balance : (tenant.advance_payment || tenant.rent_amount);

                    return (
                      <React.Fragment key={tenant.id}>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-6">
                            <div className="font-bold text-slate-900">{tenant.name}</div>
                            <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                              Room {matchedRoom?.room_number || "N/A"} ({matchedApt?.name || "ApartmentPro Plaza"})
                            </div>
                          </td>
                          <td className="py-3.5 px-6 font-semibold text-slate-700">₱{Number(tenant.rent_amount).toLocaleString()}</td>
                          <td className="py-3.5 px-6 text-slate-550 font-medium">₱{Number(tenant.deposit).toLocaleString()}</td>
                          <td className="py-3.5 px-6 font-extrabold text-emerald-700 bg-emerald-50/20">₱{Number(depBal).toLocaleString()}</td>
                          <td className="py-3.5 px-6 text-slate-550 font-medium">₱{Number(tenant.advance_payment !== undefined ? tenant.advance_payment : tenant.rent_amount).toLocaleString()}</td>
                          <td className="py-3.5 px-6 font-extrabold text-blue-700 bg-blue-50/20">₱{Number(advBal).toLocaleString()}</td>
                          <td className="py-3.5 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenPostLedger(tenant.id)}
                                className="px-2.5 py-1.5 font-bold rounded-lg text-[11px] transition-all flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95"
                                title="Record a deposit/advance adjustment"
                              >
                                <Plus className="w-3 h-3 text-slate-600" />
                                <span>Adjust</span>
                              </button>

                              {ledgerEntries.length > 0 && (
                                <button
                                  onClick={() => setExpandedTenantId(isExpanded ? null : tenant.id)}
                                  className="px-2.5 py-1.5 font-bold rounded-lg text-[11px] transition-all flex items-center gap-1 bg-amber-50 hover:bg-amber-100/80 text-brand-orange border border-amber-200/50 shadow-xs active:scale-95"
                                  title={`View ${ledgerEntries.length} Advance & Deposit Ledger Transactions`}
                                >
                                  <History className="w-3.5 h-3.5 text-brand-orange" />
                                  <span>{isExpanded ? "Hide" : `History (${ledgerEntries.length})`}</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/40">
                            <td colSpan={7} className="p-4 pl-12 border-b border-slate-100">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <History className="w-4 h-4 text-brand-orange" />
                                    <span>Ledger Transaction History for {tenant.name}</span>
                                  </h4>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPostLedger(tenant.id)}
                                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-xs active:scale-95"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Post Transaction for {tenant.name.split(' ')[0]}</span>
                                  </button>
                                </div>
                                {ledgerEntries.length === 0 ? (
                                  <p className="text-xs text-slate-400 font-medium py-2">
                                    No ledger adjustments or manual refunds have been posted yet.
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-2">
                                    {ledgerEntries.slice().reverse().map((entry) => {
                                      const isNegative = ["deposit_deduction", "advance_use", "deposit_refund", "advance_refund"].includes(entry.type);
                                      return (
                                        <div
                                          key={entry.id}
                                          className="bg-white border border-slate-200/60 p-3 rounded-xl shadow-xs flex items-start justify-between gap-3 text-xs"
                                        >
                                          <div className="space-y-0.5">
                                            <span className={`inline-block px-1.5 py-0.5 text-[8px] font-bold rounded uppercase tracking-wider ${
                                              entry.type.startsWith("deposit") ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                                            }`}>
                                              {entry.type.replace("_", " ")}
                                            </span>
                                            <p className="font-semibold text-slate-700 leading-tight mt-1">{entry.description}</p>
                                            <span className="text-[9px] text-slate-400 block font-medium">
                                              {new Date(entry.created_at).toLocaleString()}
                                            </span>
                                          </div>
                                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <div className={`font-mono font-black text-xs ${isNegative ? "text-rose-600" : "text-emerald-600"}`}>
                                              {isNegative ? "-" : "+"} ₱{entry.amount.toLocaleString()}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleShareLedgerToMessenger(entry, tenant)}
                                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all active:scale-95 border border-blue-200/50 shadow-2xs"
                                              title="Send Transaction Receipt to Tenant's Messenger"
                                            >
                                              <MessageCircle className="w-3 h-3 fill-blue-600 text-white" />
                                              <span>Messenger</span>
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bill Dialog */}
      <AnimatePresence>
        {showBillDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBillDialog(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 z-10 text-sm overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {editingBill ? "Edit Billing Invoice" : "Create Statement of Account"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Rent + power billing utilities statement.</p>
                </div>
                <button onClick={() => setShowBillDialog(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>


              <form onSubmit={handleSubmit} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Select Tenant</label>
                  <select
                    required
                    disabled={!!editingBill}
                    value={formTenantId}
                    onChange={(e) => handleTenantSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800 disabled:opacity-50"
                  >
                    <option value="">-- Choose Leaseholder --</option>
                    {db.tenants.filter(t => t.status === "active" || (editingBill && t.id === formTenantId)).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Room {db.rooms.find(r => r.id === t.room_id)?.room_number || "N/A"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Contract Rent portion (₱)</label>
                    <input
                      type="number"
                      required
                      value={formRentAmount || ""}
                      onChange={(e) => setFormRentAmount(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Billing Month/Period</label>
                    <input
                      type="text"
                      required
                      value={formBillingMonth}
                      onChange={(e) => setFormBillingMonth(e.target.value)}
                      placeholder="e.g. June 2026"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Electricity Amount (₱)</label>
                    <input
                      type="number"
                      required
                      value={formElectricityAmount || ""}
                      onChange={(e) => setFormElectricityAmount(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Electricity Usage (kWh)</label>
                    <input
                      type="number"
                      required
                      value={formElectricityUsage || ""}
                      onChange={(e) => setFormElectricityUsage(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Water Amount (₱)</label>
                    <input
                      type="number"
                      required
                      value={formWaterAmount || ""}
                      onChange={(e) => setFormWaterAmount(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Water Usage (m³)</label>
                    <input
                      type="number"
                      required
                      value={formWaterUsage || ""}
                      onChange={(e) => setFormWaterUsage(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Due Date</label>
                    <input
                      type="date"
                      required
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Payment Status</label>
                    <select
                      value={formPaymentStatus}
                      onChange={(e) => setFormPaymentStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    >
                      <option value="unpaid">Unpaid Statement</option>
                      <option value="paid">Settled Paid</option>
                      <option value="overdue">Overdue Outstanding</option>
                      <option value="partial">Partial Collected</option>
                    </select>
                  </div>
                </div>

                {formBillImageUrl && (
                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono truncate max-w-[250px]">
                      Attached: {formBillImageUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormBillImageUrl("")}
                      className="text-xs text-rose-500 font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Total Calculated: </label>
                  <div className="text-2xl font-black text-slate-900 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
                    ₱{(Number(formRentAmount) + Number(formElectricityAmount) + Number(formWaterAmount)).toLocaleString()}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Ledger Notes</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="E.g. Statement breakdown details."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBillDialog(false)}
                    className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all active:scale-98"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50"
                  >
                    {loading ? "Creating..." : editingBill ? "Save Changes" : "Create Statement"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* Post Ledger Transaction Modal */}
        {showPostLedgerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 text-brand-orange rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Post Ledger Transaction</h3>
                    <p className="text-xs text-slate-500">Record advance/deposit adjustments with instant Messenger receipt</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPostLedgerModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePostLedgerSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">Select Tenant</label>
                  <select
                    value={postLedgerTenantId}
                    onChange={(e) => setPostLedgerTenantId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  >
                    {db.tenants.filter(t => t.status === "active").map((t) => {
                      const room = db.rooms.find(r => r.id === t.room_id);
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} — Room {room?.room_number || "N/A"}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">Transaction Category</label>
                  <select
                    value={postLedgerType}
                    onChange={(e) => setPostLedgerType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  >
                    <optgroup label="Security Deposit">
                      <option value="deposit_payment">Deposit Payment (Add to Escrow)</option>
                      <option value="deposit_deduction">Deposit Deduction (Damages / Penalty)</option>
                      <option value="deposit_refund">Deposit Refund (Returned to Tenant)</option>
                    </optgroup>
                    <optgroup label="Advance Rent">
                      <option value="advance_payment">Advance Payment (Add to Balance)</option>
                      <option value="advance_use">Advance Used (Applied to Bill / Rent)</option>
                      <option value="advance_refund">Advance Refund (Returned to Tenant)</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">Amount (₱)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="e.g. 5000"
                    value={postLedgerAmount}
                    onChange={(e) => setPostLedgerAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">Reason / Description</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Detail the purpose of this transaction (e.g. 1 month advance payment for move-in, security deposit top-up...)"
                    value={postLedgerDescription}
                    onChange={(e) => setPostLedgerDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-2 text-[11px] text-blue-800 font-medium">
                  <MessageCircle className="w-4 h-4 fill-blue-600 text-white shrink-0 mt-0.5" />
                  <span>Posting this will automatically update balances and prepare an official receipt ready to send directly to the tenant's Messenger.</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPostLedgerModal(false)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={ledgerPostingLoading || !postLedgerAmount}
                    className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {ledgerPostingLoading ? "Posting..." : "Post & Send to Messenger"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Messenger Share Modal */}
        {showMessengerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <MessageCircle className="w-5 h-5 fill-blue-600 text-white" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Send via Facebook Messenger</h3>
                    <p className="text-xs text-slate-500">Statement invoice for {messengerTenantName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMessengerModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {messengerCopySuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Statement formatted & copied to clipboard! Paste directly into Messenger chat.</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1">Prepared Statement Message</label>
                <textarea
                  readOnly
                  rows={9}
                  value={messengerSummaryText}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyMessengerText}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>{messengerCopySuccess ? "Copied Again!" : "Copy Text"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenMessengerApp}
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Launch Messenger</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
