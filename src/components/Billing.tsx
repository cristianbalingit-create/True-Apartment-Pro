import React, { useState, useRef } from "react";
import { DBState, api } from "../lib/api";
import { BillingRecord, Tenant, Room } from "../types";
import { FileText, CheckCircle2, Check, AlertTriangle, AlertCircle, Clock, Search, Plus, Calendar, Download, Eye, X, FileSpreadsheet, Wand2, Building, ChevronDown, ChevronUp, DollarSign, History, Calculator, Zap, Droplet, Send, MessageCircle, Share2, Copy, ExternalLink, TrendingUp, Receipt, Printer } from "lucide-react";
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
  const [expandedApartmentName, setExpandedApartmentName] = useState<string | null>(null);

  // Second Confirmation States for Marking Statement as Paid / Partial Payment Modal
  const [billToConfirmPaid, setBillToConfirmPaid] = useState<BillingRecord | null>(null);
  const [confirmPaidBillId, setConfirmPaidBillId] = useState<string | null>(null);
  const [isConfirmingPaid, setIsConfirmingPaid] = useState(false);
  const [receiptModalBill, setReceiptModalBill] = useState<BillingRecord | null>(null);
  const [receiptCopied, setReceiptCopied] = useState(false);

  // Partial Payment & Security Deposit Deduction Modal States
  const [payModalStatus, setPayModalStatus] = useState<"paid" | "partial" | "unpaid">("paid");
  const [payModalActualAmount, setPayModalActualAmount] = useState<string>("");
  const [payModalDeductDeposit, setPayModalDeductDeposit] = useState<boolean>(false);
  const [payModalDepositAmount, setPayModalDepositAmount] = useState<string>("");
  const [payModalMethod, setPayModalMethod] = useState<string>("CASH");
  const [payModalReference, setPayModalReference] = useState<string>("");
  const [payModalError, setPayModalError] = useState<string | null>(null);
  const [showPayConfirmationSummary, setShowPayConfirmationSummary] = useState<boolean>(false);

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
  
  const [calcNotes, setCalcNotes] = useState("");
  const [calcSuccessMessage, setCalcSuccessMessage] = useState("");

  // Deploy Statement & Feedback States
  const isDeployingRef = useRef(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployingBillId, setDeployingBillId] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<{
    status: "sent" | "unlinked" | "failed";
    message: string;
    bill_image_url?: string;
    details?: string;
  } | null>(null);

  // Messenger Dialog States (Used for internal receipt/statement text copying)
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
    const aptName = apt ? apt.name : "RentFlow Plaza";
    
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

  // Deploy statement for an existing billing statement record directly via Facebook Messenger Send API
  const handleDeployExistingStatement = async (bill: BillingRecord) => {
    if (deployingBillId === bill.id || isDeployingRef.current) return;
    isDeployingRef.current = true;
    setDeployingBillId(bill.id);
    setDeployResult(null);

    try {
      const res = await api.deployStatement({
        tenant_id: bill.tenant_id,
        billing_id: bill.id
      });

      if (res.status === "sent") {
        setDeployResult({
          status: "sent",
          message: res.message || `✅ Statement sent successfully to ${bill.tenant_name} via Messenger.`,
          bill_image_url: res.bill_image_url
        });
      } else if (res.status === "unlinked") {
        setDeployResult({
          status: "unlinked",
          message: res.warning || res.message || `⚠️ Statement deployed, but this tenant has no linked Messenger account.`,
          bill_image_url: res.bill_image_url
        });
      } else {
        setDeployResult({
          status: "failed",
          message: res.error || res.message || `❌ Failed to send statement to ${bill.tenant_name}. Please try again.`
        });
      }
      onRefresh();
    } catch (err: any) {
      console.error("handleDeployExistingStatement error:", err);
      setDeployResult({
        status: "failed",
        message: err.message || "❌ Unexpected error while deploying statement."
      });
    } finally {
      setDeployingBillId(null);
      isDeployingRef.current = false;
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
    if (isDeployingRef.current || loading) return;
    isDeployingRef.current = true;
    setIsDeploying(true);
    setLoading(true);
    setCalcSuccessMessage("");
    setDeployResult(null);

    const tenant = db.tenants.find((t) => t.id === calcTenantId);
    if (!tenant) {
      setLoading(false);
      setIsDeploying(false);
      isDeployingRef.current = false;
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
      const createdBill = await api.createBilling(payload);

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

      // Deploy statement automatically through the existing Facebook Messenger Send API/backend integration
      const deployRes = await api.deployStatement({
        tenant_id: tenant.id,
        billing_id: createdBill?.id
      });

      if (deployRes.status === "sent") {
        const msg = deployRes.message || `✅ Statement sent successfully to ${tenant.name} via Messenger.`;
        setDeployResult({ status: "sent", message: msg, bill_image_url: deployRes.bill_image_url });
        setCalcSuccessMessage(msg);
      } else if (deployRes.status === "unlinked") {
        const msg = deployRes.warning || deployRes.message || `⚠️ Statement deployed, but this tenant has no linked Messenger account.`;
        setDeployResult({ status: "unlinked", message: msg, bill_image_url: deployRes.bill_image_url });
        setCalcSuccessMessage(msg);
      } else {
        const msg = deployRes.error || deployRes.message || `❌ Failed to send statement to ${tenant.name}. Please try again.`;
        setDeployResult({ status: "failed", message: msg });
        setCalcSuccessMessage(msg);
      }

      onRefresh();
    } catch (err: any) {
      console.error("handleCalcSubmit error:", err);
      const errMsg = err?.message || "Error creating and deploying statement.";
      setDeployResult({ status: "failed", message: `❌ ${errMsg}` });
      setCalcSuccessMessage(`❌ ${errMsg}`);
    } finally {
      setLoading(false);
      setIsDeploying(false);
      isDeployingRef.current = false;
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

  // Open Payment & Deposit Deduction Modal
  const handleOpenPayModal = (bill: BillingRecord) => {
    setBillToConfirmPaid(bill);
    setConfirmPaidBillId(null);
    setPayModalError(null);
    setShowPayConfirmationSummary(false);

    // Calculate current outstanding balance
    const billTotal = Number(bill.total_amount || 0);
    const paidSoFar = Number(bill.paid_amount || 0);
    const depositAppliedSoFar = Number(bill.deposit_applied || 0);
    const outstanding = Math.max(0, Number((billTotal - paidSoFar - depositAppliedSoFar).toFixed(2)));

    // Defaults
    if (bill.payment_status === "partial") {
      setPayModalStatus("partial");
      setPayModalActualAmount(outstanding > 0 ? outstanding.toString() : "");
    } else {
      setPayModalStatus("paid");
      setPayModalActualAmount(outstanding > 0 ? outstanding.toString() : "");
    }

    setPayModalDeductDeposit(false);
    setPayModalDepositAmount("");
    setPayModalMethod(bill.last_payment_method || "CASH");
    setPayModalReference("");
  };

  const handleSaveInvoicePayment = async () => {
    if (!billToConfirmPaid) return;
    setPayModalError(null);

    const bill = billToConfirmPaid;
    const billTotal = Number(bill.total_amount || 0);
    const prevPaid = Number(bill.paid_amount || 0);
    const prevDepositApplied = Number(bill.deposit_applied || 0);
    const outstandingBefore = Math.max(0, Number((billTotal - prevPaid - prevDepositApplied).toFixed(2)));

    // Tenant info & available deposit
    const tenant = db.tenants.find((t) => t.id === bill.tenant_id);
    const availableDeposit = tenant
      ? (tenant.deposit_balance !== undefined ? Number(tenant.deposit_balance) : Number(tenant.deposit || 0))
      : 0;

    let actualAmt = 0;
    let depositAmt = 0;

    if (payModalStatus === "unpaid") {
      // Reverting to unpaid
      actualAmt = 0;
      depositAmt = 0;
    } else if (payModalStatus === "paid") {
      // Admin desires to fully settle the invoice
      if (payModalDeductDeposit) {
        actualAmt = Number(payModalActualAmount || 0);
        depositAmt = Number(payModalDepositAmount || 0);
      } else {
        actualAmt = outstandingBefore;
        depositAmt = 0;
      }
    } else {
      // Partially Paid
      actualAmt = Number(payModalActualAmount || 0);
      if (payModalDeductDeposit) {
        depositAmt = Number(payModalDepositAmount || 0);
      } else {
        depositAmt = 0;
      }
    }

    // Validation rules
    if (payModalStatus !== "unpaid") {
      if (actualAmt < 0 || isNaN(actualAmt)) {
        setPayModalError("Amount received must be greater than ₱0.");
        return;
      }
      if (payModalStatus === "partial" && actualAmt <= 0 && depositAmt <= 0) {
        setPayModalError("For Partially Paid invoices, enter an actual amount received greater than ₱0.");
        return;
      }
      if (actualAmt > outstandingBefore) {
        setPayModalError(`Amount received (₱${actualAmt.toLocaleString()}) cannot exceed the outstanding balance (₱${outstandingBefore.toLocaleString()}).`);
        return;
      }

      if (payModalDeductDeposit) {
        if (depositAmt < 0 || isNaN(depositAmt)) {
          setPayModalError("Deposit deduction amount cannot be negative.");
          return;
        }
        const remainingAfterCash = Math.max(0, Number((outstandingBefore - actualAmt).toFixed(2)));
        if (depositAmt > remainingAfterCash) {
          setPayModalError(`Deposit deduction (₱${depositAmt.toLocaleString()}) cannot exceed remaining balance after payment (₱${remainingAfterCash.toLocaleString()}).`);
          return;
        }
        if (depositAmt > availableDeposit) {
          setPayModalError(`Deposit deduction (₱${depositAmt.toLocaleString()}) cannot exceed available security deposit (₱${availableDeposit.toLocaleString()}).`);
          return;
        }
      }

      // Check for Paid status validation rule:
      // "Do not allow the admin to mark an invoice as Paid while an outstanding amount remains unless that amount is covered by an authorized security deposit deduction."
      const calculatedRemaining = Math.max(0, Number((outstandingBefore - actualAmt - depositAmt).toFixed(2)));
      if (payModalStatus === "paid" && calculatedRemaining > 0) {
        setPayModalError(`Cannot mark as Paid while ₱${calculatedRemaining.toLocaleString()} remains outstanding. Select Partially Paid or cover the remaining balance with a security deposit deduction.`);
        return;
      }
    }

    // Submit to server
    setIsConfirmingPaid(true);
    setLoading(true);
    try {
      const res = await api.payBilling(bill.id, {
        actual_payment: actualAmt,
        deposit_deduction: depositAmt,
        status: payModalStatus,
        payment_method: payModalMethod,
        payment_reference: payModalReference
      });

      const updatedBill = res.bill || {
        ...bill,
        payment_status: res.finalStatus || (outstandingBefore - actualAmt - depositAmt <= 0 ? "paid" : "partial"),
        paid_amount: prevPaid + actualAmt,
        deposit_applied: prevDepositApplied + depositAmt,
        remaining_balance: Math.max(0, outstandingBefore - actualAmt - depositAmt),
        paid_at: new Date().toISOString()
      };

      setBillToConfirmPaid(null);
      setShowPayConfirmationSummary(false);
      setReceiptModalBill(updatedBill);
      onRefresh();
    } catch (err: any) {
      console.error("handleSaveInvoicePayment error:", err);
      setPayModalError(err.message || "Failed to save invoice payment transaction.");
    } finally {
      setIsConfirmingPaid(false);
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
    link.setAttribute("download", `RentFlow_Billing_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getApartmentName = (id: string) => {
    return db.apartments.find((a) => a.id === id)?.name || "RentFlow Plaza";
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
            className="neu-btn flex items-center justify-center gap-2 px-4 py-2.5 text-slate-900 font-bold text-sm rounded-xl shadow-xs transition-all"
          >
            <FileSpreadsheet className="w-4.5 h-4.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex gap-3 mt-2 mb-4 overflow-x-auto scrollbar-none whitespace-nowrap p-1">
        <button
          onClick={() => setActiveSubTab("billing_statements")}
          className={`px-4 py-2.5 text-sm font-bold transition-all rounded-xl shrink-0 ${
            activeSubTab === "billing_statements"
              ? "active !bg-[#EF6905] !text-white !border-[#c2410c] shadow-md font-black"
              : "neu-btn text-slate-900 hover:text-[#EF6905]"
          }`}
        >
          Statements & Invoices
        </button>
        <button
          onClick={() => setActiveSubTab("utility_calculator")}
          className={`px-4 py-2.5 text-sm font-bold transition-all rounded-xl flex items-center gap-2 shrink-0 ${
            activeSubTab === "utility_calculator"
              ? "active !bg-[#EF6905] !text-white !border-[#c2410c] shadow-md font-black"
              : "neu-btn text-slate-900 hover:text-[#EF6905]"
          }`}
        >
          <Calculator className={`w-4 h-4 ${activeSubTab === "utility_calculator" ? "!text-white" : ""}`} />
          <span>Calculate & Send Utilities</span>
        </button>
        <button
          onClick={() => setActiveSubTab("advance_deposit_ledger")}
          className={`px-4 py-2.5 text-sm font-bold transition-all rounded-xl flex items-center gap-2 shrink-0 ${
            activeSubTab === "advance_deposit_ledger"
              ? "active !bg-[#EF6905] !text-white !border-[#c2410c] shadow-md font-black"
              : "neu-btn text-slate-900 hover:text-[#EF6905]"
          }`}
        >
          <History className={`w-4 h-4 ${activeSubTab === "advance_deposit_ledger" ? "!text-white" : ""}`} />
          <span>Advance & Deposit Ledger</span>
        </button>
      </div>

      {activeSubTab === "billing_statements" ? (
        <>
          {/* Summary Matrix Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Paid */}
            <div className="neu-card p-5 flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Receipted Paid</span>
                <span className="text-xl font-black text-emerald-700 block mt-1">₱{sumAmount(paidBills).toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 font-medium block mt-1">{paidBills.length} settled statements</span>
              </div>
              <div className="w-11 h-11 neu-pressed flex items-center justify-center text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            {/* Unpaid */}
            <div className="neu-card p-5 flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Outstanding Unpaid</span>
                <span className="text-xl font-black text-[#EF6905] block mt-1">₱{sumAmount(unpaidBills).toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 font-medium block mt-1">{unpaidBills.length} pending statements</span>
              </div>
              <div className="w-11 h-11 neu-pressed flex items-center justify-center text-[#EF6905] rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* Overdue */}
            <div className="neu-card p-5 flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Overdue Incurred</span>
                <span className="text-xl font-black text-[#8B2626] block mt-1">₱{sumAmount(overdueBills).toLocaleString()}</span>
                <span className="text-[10px] text-[#8B2626] font-bold block mt-1">{overdueBills.length} breach limits</span>
              </div>
              <div className="w-11 h-11 neu-pressed flex items-center justify-center text-[#8B2626] rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            {/* Total Receivables & Collection Rate - Making use of the space at the end */}
            <div className="neu-card p-5 flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Total Receivables</span>
                <span className="text-xl font-black text-slate-900 block mt-1">₱{sumAmount(db.billingRecords).toLocaleString()}</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-slate-500 font-medium">{db.billingRecords.length} statements</span>
                  {db.billingRecords.length > 0 && (
                    <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {Math.round((paidBills.length / db.billingRecords.length) * 100)}% paid
                    </span>
                  )}
                </div>
              </div>
              <div className="w-11 h-11 neu-pressed flex items-center justify-center text-brand-orange rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

          </div>

          {/* Deployment Feedback Banner */}
          {deployResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                deployResult.status === "sent"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : deployResult.status === "unlinked"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                {deployResult.status === "sent" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />}
                {deployResult.status === "unlinked" && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />}
                {deployResult.status === "failed" && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />}
                <div>
                  {deployResult.status === "sent" ? (
                    <div>
                      <div className="font-bold text-sm text-emerald-950 flex flex-wrap items-center gap-2">
                        <span className="text-emerald-700">Bill image generated ✓</span>
                        <span className="text-emerald-400">•</span>
                        <span className="text-emerald-700">Messenger delivery sent ✓</span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-0.5">{deployResult.message}</p>
                    </div>
                  ) : deployResult.status === "unlinked" ? (
                    <div>
                      <div className="font-bold text-sm text-amber-950">
                        <span className="text-amber-800">Bill image generated ✓</span>
                      </div>
                      <p className="text-xs text-amber-800 mt-0.5">{deployResult.message}</p>
                    </div>
                  ) : (
                    <div>
                      <div className="font-bold text-sm text-rose-950">Bill generation failed ✕</div>
                      <p className="text-xs text-rose-800 mt-0.5">{deployResult.message}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {deployResult.bill_image_url && (
                  <a
                    href={deployResult.bill_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center gap-1"
                  >
                    <span>View Bill Image</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setDeployResult(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Table Filters bar */}
          <div className="neu-card p-4 flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tenant, room, month, building..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 neu-input rounded-xl text-xs font-medium text-slate-800"
              />
            </div>
            <div className="w-full sm:w-auto flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dueDateFilter}
                onChange={(e) => setDueDateFilter(e.target.value)}
                className="px-3 py-2 neu-input rounded-xl text-xs font-semibold text-slate-700"
              />
              {dueDateFilter && (
                <button onClick={() => setDueDateFilter("")} className="text-xs text-[#8B2626] font-bold hover:underline">
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
              Object.entries(billsByApartment).map(([aptName, bills]) => {
                const isExpanded = expandedApartmentName === aptName;
                const apartment = db.apartments.find((a) => a.name === aptName);
                return (
                <div key={aptName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Apartment selector / dropdown */}
                  <button
                    type="button"
                    onClick={() => setExpandedApartmentName(isExpanded ? null : aptName)}
                    className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-left transition-colors border-b border-slate-100"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
                        <Building className="w-3.5 h-3.5 text-brand-orange" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-800 truncate">{aptName}</h3>
                        {apartment?.address && (
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{apartment.address}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-2 py-0.5 bg-brand-orange/10 text-brand-orange text-[10px] font-bold rounded-md font-mono">
                        {bills.length} Invoices
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {/* Invoice dropdown */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-50/20">
                          <th className="py-2 px-4">Tenant & Room</th>
                          <th className="py-2 px-4">Rent portion</th>
                          <th className="py-2 px-4">Power (usage kwh)</th>
                          <th className="py-2 px-4">Water (usage m³)</th>
                          <th className="py-2 px-4 font-black text-slate-900">Total Statement</th>
                          <th className="py-2 px-4">Paid / Deposit Applied</th>
                          <th className="py-2 px-4 font-black text-slate-900">Remaining Balance</th>
                          <th className="py-2 px-4">Due Date</th>
                          <th className="py-2 px-4">Status & Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {bills.map((bill) => (
                          <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2.5 px-4">
                              <div>
                                <div className="font-bold text-slate-900">{bill.tenant_name || "Unassigned"}</div>
                                <div className="text-[10px] font-bold text-slate-500 mt-0.5">Room {bill.room_number || "N/A"}</div>
                              </div>
                            </td>
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
                            <td className="py-3.5 px-6 text-slate-700">
                              <div className="font-semibold text-emerald-800">
                                ₱{(Number(bill.paid_amount) || (bill.payment_status === "paid" ? Number(bill.total_amount) : 0)).toLocaleString()}
                              </div>
                              {Number(bill.deposit_applied || 0) > 0 && (
                                <div className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 inline-flex items-center gap-1 mt-0.5">
                                  <span>🛡️ ₱{Number(bill.deposit_applied).toLocaleString()} deposit</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-6 font-mono font-extrabold text-sm">
                              {(() => {
                                const total = Number(bill.total_amount || 0);
                                const paid = Number(bill.paid_amount || (bill.payment_status === "paid" ? total : 0));
                                const dep = Number(bill.deposit_applied || 0);
                                const rem = bill.remaining_balance !== undefined
                                  ? Number(bill.remaining_balance)
                                  : Math.max(0, total - paid - dep);
                                return (
                                  <span className={rem > 0 ? "text-rose-600 font-black" : "text-emerald-600 font-bold"}>
                                    ₱{rem.toLocaleString()}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-3.5 px-6 font-mono text-slate-600 font-semibold">{bill.due_date || "N/A"}</td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {bill.payment_status === "paid" ? (
                                  <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                                    Paid
                                  </span>
                                ) : bill.payment_status === "partial" ? (
                                  <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>Partially Paid</span>
                                  </span>
                                ) : bill.payment_status === "overdue" ? (
                                  <span className="font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-xs">
                                    Overdue
                                  </span>
                                ) : (
                                  <span className="font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs">
                                    Unpaid
                                  </span>
                                )}

                                {bill.payment_status === "paid" ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setReceiptModalBill(bill)}
                                      className="neu-btn px-2 py-1 text-[11px] font-bold rounded-lg shadow-xs transition-all hover:text-[#EF6905] flex items-center gap-1"
                                      title="View Official Receipt"
                                    >
                                      <Receipt className="w-3 h-3 text-[#EF6905]" />
                                      <span>Receipt</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPayModal(bill)}
                                      className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                                      title="Adjust or record additional settlement"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPayModal(bill)}
                                    className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg shadow-xs transition-all flex items-center gap-1"
                                    title="Record payment or deduct security deposit"
                                  >
                                    <DollarSign className="w-3 h-3" />
                                    <span>{bill.payment_status === "partial" ? "Add Payment" : "Record Payment"}</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                );
              })
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

          {deployResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                deployResult.status === "sent"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : deployResult.status === "unlinked"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                {deployResult.status === "sent" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />}
                {deployResult.status === "unlinked" && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />}
                {deployResult.status === "failed" && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />}
                <div>
                  {deployResult.status === "sent" ? (
                    <div>
                      <div className="font-bold text-sm text-emerald-950 flex flex-wrap items-center gap-2">
                        <span className="text-emerald-700">Bill image generated ✓</span>
                        <span className="text-emerald-400">•</span>
                        <span className="text-emerald-700">Messenger delivery sent ✓</span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-0.5">{deployResult.message}</p>
                    </div>
                  ) : deployResult.status === "unlinked" ? (
                    <div>
                      <div className="font-bold text-sm text-amber-950">
                        <span className="text-amber-800">Bill image generated ✓</span>
                      </div>
                      <p className="text-xs text-amber-800 mt-0.5">{deployResult.message}</p>
                    </div>
                  ) : (
                    <div>
                      <div className="font-bold text-sm text-rose-950">Bill generation failed ✕</div>
                      <p className="text-xs text-rose-800 mt-0.5">{deployResult.message}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {deployResult.bill_image_url && (
                  <a
                    href={deployResult.bill_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center gap-1"
                  >
                    <span>View Bill Image</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setDeployResult(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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

            {/* Final Statement Summary & Approval */}
            <div className="pt-2 max-w-2xl mx-auto space-y-4">
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <label className="block text-slate-700 font-bold mb-1.5 text-xs">Statement Notes / Memo (Optional)</label>
                <input
                  type="text"
                  value={calcNotes}
                  onChange={(e) => setCalcNotes(e.target.value)}
                  placeholder="e.g. Regular monthly rent and utility reading breakdown"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs text-slate-800"
                />
              </div>

              {/* Real-time calculated statement panel */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
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
                    disabled={loading || isDeploying || !calcTenantId}
                    className="w-full py-3 neu-btn text-slate-900 font-black text-sm rounded-xl shadow-xs transition-all flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-4.5 h-4.5 text-slate-800" />
                      <span>{loading || isDeploying ? "Generating statement..." : "Generate & Record Statement"}</span>
                    </div>
                    <span className="text-[10px] text-slate-600 font-semibold">Approve & Record Statement to Financial Ledgers</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            <div className="bg-white p-5 rounded-2xl h-full min-h-[132px] border border-slate-100 shadow-sm flex items-center justify-between">
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

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between h-full min-h-[132px]">
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

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between h-full min-h-[132px]">
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
                    <th className="py-2 px-4">Tenant & Room</th>
                    <th className="py-2 px-4">Base Rent / Contract</th>
                    <th className="py-2 px-4">Initial Sec Deposit</th>
                    <th className="py-3 px-6 text-emerald-600 font-bold">Current Deposit Bal</th>
                    <th className="py-2 px-4">Initial Advance Pay</th>
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
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900">{tenant.name}</div>
                            <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                              Room {matchedRoom?.room_number || "N/A"} ({matchedApt?.name || "RentFlow Plaza"})
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

                              <button
                                type="button"
                                onClick={() => setExpandedTenantId(isExpanded ? null : tenant.id)}
                                className="px-2.5 py-1.5 font-bold rounded-lg text-[11px] transition-all flex items-center gap-1 bg-amber-50 hover:bg-amber-100/80 text-brand-orange border border-amber-200/50 shadow-xs active:scale-95"
                                title={`View Advance & Deposit Ledger Summary for ${tenant.name}`}
                              >
                                <DollarSign className="w-3.5 h-3.5 text-brand-orange" />
                                <span>{isExpanded ? "Hide Summary" : `Ledger Summary (${ledgerEntries.length})`}</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/40">
                            <td colSpan={7} className="p-4 pl-12 border-b border-slate-100">
                              <div className="space-y-4">
                                {/* Balance Header Summary */}
                                <div className="flex flex-wrap gap-4 items-center justify-between border-b border-slate-200/60 pb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                      <DollarSign className="w-4 h-4 text-brand-orange" />
                                      Advance & Deposit Ledger Summary for <span className="text-slate-900 font-extrabold">{tenant.name}</span>
                                    </span>
                                  </div>
                                  <div className="flex gap-4">
                                    <div className="bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-sm text-xs">
                                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] block">Deposit Balance</span>
                                      <span className="font-extrabold text-emerald-600">
                                        ₱{Number(depBal).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-sm text-xs">
                                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] block">Advance Rent Balance</span>
                                      <span className="font-extrabold text-blue-600">
                                        ₱{Number(advBal).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <History className="w-4 h-4 text-brand-orange" />
                                    <span>Ledger Transaction History for {tenant.name}</span>
                                  </h4>

                                </div>
                                {ledgerEntries.length === 0 ? (
                                  <p className="text-xs text-slate-400 font-medium py-2">
                                    No ledger adjustments or manual refunds have been posted yet for {tenant.name}.
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
                    <h3 className="font-extrabold text-slate-900 text-base">Prepared Statement & Receipt Record</h3>
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
                  <span>Statement formatted & copied to clipboard!</span>
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

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCopyMessengerText}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    <Copy className="w-4 h-4 text-slate-600" />
                    <span>{messengerCopySuccess ? "Copied to Clipboard!" : "Copy Statement Text"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMessengerModal(false)}
                    className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    <X className="w-4 h-4" />
                    <span>Close</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 text-center">
                  Statements and receipts are automatically dispatched to tenants via Facebook Messenger when deployed.
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {/* Invoice Payment & Security Deposit Deduction Modal */}
        {billToConfirmPaid && (() => {
          const bill = billToConfirmPaid;
          const billTotal = Number(bill.total_amount || 0);
          const prevPaid = Number(bill.paid_amount || 0);
          const prevDepositApplied = Number(bill.deposit_applied || 0);
          const outstandingBefore = Math.max(0, Number((billTotal - prevPaid - prevDepositApplied).toFixed(2)));

          const tenant = db.tenants.find((t) => t.id === bill.tenant_id);
          const availableDeposit = tenant
            ? (tenant.deposit_balance !== undefined ? Number(tenant.deposit_balance) : Number(tenant.deposit || 0))
            : 0;

          // Parse current user inputs
          const actualVal = payModalStatus === "unpaid" ? 0 : Number(payModalActualAmount || 0);
          const depositVal = (payModalStatus !== "unpaid" && payModalDeductDeposit) ? Number(payModalDepositAmount || 0) : 0;

          // Calculations
          const remainingAfterCash = Math.max(0, Number((outstandingBefore - actualVal).toFixed(2)));
          const depositBalanceAfter = Math.max(0, Number((availableDeposit - depositVal).toFixed(2)));
          const finalInvoiceBalance = Math.max(0, Number((outstandingBefore - actualVal - depositVal).toFixed(2)));
          const calculatedStatus = finalInvoiceBalance === 0 ? "Paid" : (actualVal > 0 || depositVal > 0 || prevPaid > 0 || prevDepositApplied > 0 ? "Partially Paid" : "Unpaid");

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (!isConfirmingPaid) {
                    setBillToConfirmPaid(null);
                    setShowPayConfirmationSummary(false);
                  }
                }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 z-10 border border-slate-200 space-y-4 my-8"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Record Invoice Payment
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        {bill.tenant_name} &bull; Room {bill.room_number} &bull; {bill.invoice_number || bill.id}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBillToConfirmPaid(null);
                      setShowPayConfirmationSummary(false);
                    }}
                    disabled={isConfirmingPaid}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {payModalError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">{payModalError}</div>
                  </motion.div>
                )}

                {!showPayConfirmationSummary ? (
                  /* Form View */
                  <div className="space-y-4 text-xs">
                    {/* Invoice Financial Summary Box */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-slate-700">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-600">Total Invoice Amount:</span>
                        <span className="font-mono font-black text-slate-900 text-sm">₱{billTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-600">
                        <span>Current Amount Paid (Cash/Bank):</span>
                        <span className="font-mono font-bold text-emerald-700">₱{prevPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {prevDepositApplied > 0 && (
                        <div className="flex justify-between items-center text-xs text-amber-700">
                          <span>Previous Deposit Deductions Applied:</span>
                          <span className="font-mono font-bold">₱{prevDepositApplied.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs border-t border-slate-200/80 pt-1.5 font-bold">
                        <span className="text-slate-800">Outstanding Balance:</span>
                        <span className="font-mono text-base font-black text-[#EF6905]">₱{outstandingBefore.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Section 1: Payment Status Selector */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Payment Status</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPayModalStatus("unpaid");
                            setPayModalActualAmount("");
                            setPayModalDeductDeposit(false);
                            setPayModalDepositAmount("");
                            setPayModalError(null);
                          }}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                            payModalStatus === "unpaid"
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          Unpaid
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPayModalStatus("partial");
                            // Default actual amount to half or prompt
                            if (!payModalActualAmount || Number(payModalActualAmount) >= outstandingBefore) {
                              setPayModalActualAmount((Math.round(outstandingBefore * 0.75)).toString());
                            }
                            setPayModalError(null);
                          }}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                            payModalStatus === "partial"
                              ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          Partially Paid
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPayModalStatus("paid");
                            setPayModalActualAmount(outstandingBefore.toString());
                            setPayModalDeductDeposit(false);
                            setPayModalDepositAmount("");
                            setPayModalError(null);
                          }}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                            payModalStatus === "paid"
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          Paid
                        </button>
                      </div>
                    </div>

                    {/* Section 2: Actual Payment Received Input */}
                    {payModalStatus !== "unpaid" && (
                      <div className="space-y-3 bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-800">
                            Actual Payment Received (Cash/Bank/GCash)
                          </label>
                          <span className="text-[10px] text-slate-500 font-medium">Max: ₱{outstandingBefore.toLocaleString()}</span>
                        </div>

                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">₱</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={outstandingBefore}
                            value={payModalActualAmount}
                            onChange={(e) => {
                              setPayModalActualAmount(e.target.value);
                              setPayModalError(null);
                            }}
                            placeholder="0.00"
                            className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                          />
                        </div>

                        {/* Payment Method & Reference */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payment Method</label>
                            <select
                              value={payModalMethod}
                              onChange={(e) => setPayModalMethod(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 bg-white"
                            >
                              <option value="CASH">Cash</option>
                              <option value="GCASH">GCash</option>
                              <option value="BANK">Bank Transfer</option>
                              <option value="CHECK">Check</option>
                              <option value="OTHER">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Reference / Note (Optional)</label>
                            <input
                              type="text"
                              value={payModalReference}
                              onChange={(e) => setPayModalReference(e.target.value)}
                              placeholder="e.g. Ref #12345"
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                            />
                          </div>
                        </div>

                        {/* Remaining balance after cash payment */}
                        <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-100 font-semibold text-slate-600">
                          <span>Invoice Balance After Cash Payment:</span>
                          <span className="font-mono font-bold text-slate-900">₱{remainingAfterCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}

                    {/* Section 3: Deduct Remaining Balance From Security Deposit Option */}
                    {payModalStatus !== "unpaid" && remainingAfterCash > 0 && (
                      <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>🛡️ Deduct Remaining Balance From Security Deposit?</span>
                            </label>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              Available Security Deposit: <strong className="font-mono font-bold text-emerald-800">₱{availableDeposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPayModalDeductDeposit(false);
                                setPayModalDepositAmount("");
                                setPayModalError(null);
                              }}
                              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                !payModalDeductDeposit
                                  ? "bg-slate-800 text-white shadow-xs"
                                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              No
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPayModalDeductDeposit(true);
                                // Pre-fill with the minimum of remaining invoice balance and available security deposit
                                const autoDeduct = Math.min(remainingAfterCash, availableDeposit);
                                setPayModalDepositAmount(autoDeduct.toString());
                                setPayModalError(null);
                              }}
                              disabled={availableDeposit <= 0}
                              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                payModalDeductDeposit
                                  ? "bg-[#EF6905] text-white shadow-xs"
                                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                              Yes
                            </button>
                          </div>
                        </div>

                        {availableDeposit <= 0 && (
                          <p className="text-[11px] text-amber-800 bg-amber-100/70 p-2 rounded-lg">
                            ⚠️ This tenant has ₱0.00 available security deposit balance.
                          </p>
                        )}

                        {payModalDeductDeposit && availableDeposit > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-2.5 pt-1 border-t border-amber-200/70"
                          >
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-slate-700">Amount to Deduct from Deposit:</span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                Max allowable: ₱{Math.min(remainingAfterCash, availableDeposit).toLocaleString()}
                              </span>
                            </div>

                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">₱</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={Math.min(remainingAfterCash, availableDeposit)}
                                value={payModalDepositAmount}
                                onChange={(e) => {
                                  setPayModalDepositAmount(e.target.value);
                                  setPayModalError(null);
                                }}
                                placeholder="0.00"
                                className="w-full pl-8 pr-4 py-2 border border-amber-300 bg-white rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EF6905]"
                              />
                            </div>

                            {/* Live calculation breakdown */}
                            <div className="bg-white/80 rounded-lg p-2.5 border border-amber-200/60 space-y-1 text-[11px] text-slate-700">
                              <div className="flex justify-between">
                                <span>Current Available Security Deposit:</span>
                                <span className="font-mono font-bold text-slate-900">₱{availableDeposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between text-amber-800">
                                <span>Deposit Deduction to Apply:</span>
                                <span className="font-mono font-bold">-₱{depositVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between font-bold text-emerald-800 border-t border-amber-100 pt-1">
                                <span>Deposit Balance After Deduction:</span>
                                <span className="font-mono">₱{depositBalanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}

                    {/* Section 4: Live Calculated Remaining Balance & Final Invoice Status */}
                    <div className="bg-slate-100 border border-slate-200/90 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Calculated Remaining Invoice Balance:</span>
                        <span className={`font-mono text-base font-black ${finalInvoiceBalance === 0 ? "text-emerald-700" : "text-[#EF6905]"}`}>
                          ₱{finalInvoiceBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Final Invoice Status:</span>
                        <span className={`px-2.5 py-0.5 rounded font-bold text-xs uppercase ${
                          finalInvoiceBalance === 0
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : (actualVal > 0 || depositVal > 0 || prevPaid > 0)
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-slate-200 text-slate-800"
                        }`}>
                          {calculatedStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Confirmation Summary View */
                  <div className="space-y-4 text-xs">
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-slate-800 space-y-3">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span>Confirm Transaction Breakdown</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        Please review the financial settlement details below before committing this transaction:
                      </p>

                      <div className="space-y-1.5 bg-white p-3 rounded-lg border border-amber-200/70 text-slate-700">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tenant / Invoice:</span>
                          <strong className="text-slate-900">{bill.tenant_name} ({bill.billing_month})</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total Invoice Amount:</span>
                          <span className="font-mono font-bold">₱{billTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-emerald-800 font-semibold border-t border-slate-100 pt-1">
                          <span>Actual Cash/Bank Payment Received:</span>
                          <span className="font-mono font-bold">₱{actualVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {depositVal > 0 && (
                          <div className="flex justify-between text-amber-800 font-semibold">
                            <span>Security Deposit Deduction Applied:</span>
                            <span className="font-mono font-bold">₱{depositVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1">
                          <span>Total Amount Settled in this Transaction:</span>
                          <span className="font-mono text-emerald-700 font-black">₱{(actualVal + depositVal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>Remaining Invoice Balance:</span>
                          <span className={`font-mono font-black ${finalInvoiceBalance === 0 ? "text-emerald-700" : "text-[#EF6905]"}`}>
                            ₱{finalInvoiceBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {depositVal > 0 && (
                          <div className="flex justify-between text-slate-600 text-[11px] pt-1 border-t border-slate-100">
                            <span>Remaining Security Deposit Balance:</span>
                            <span className="font-mono font-bold text-slate-900">₱{depositBalanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center font-bold text-slate-900 pt-1">
                          <span>Resulting Invoice Status:</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                            finalInvoiceBalance === 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                          }`}>
                            {calculatedStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal Footer Actions */}
                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-150">
                  <button
                    type="button"
                    onClick={() => {
                      if (showPayConfirmationSummary) {
                        setShowPayConfirmationSummary(false);
                      } else {
                        setBillToConfirmPaid(null);
                      }
                    }}
                    disabled={isConfirmingPaid}
                    className="neu-btn px-4 py-2 text-slate-700 font-bold text-xs rounded-xl transition-all"
                  >
                    {showPayConfirmationSummary ? "Back to Edit" : "Cancel"}
                  </button>

                  {!showPayConfirmationSummary ? (
                    <button
                      type="button"
                      onClick={() => {
                        // Pre-validate before summary
                        if (payModalStatus !== "unpaid") {
                          if (actualVal < 0 || isNaN(actualVal)) {
                            setPayModalError("Amount received must be greater than ₱0.");
                            return;
                          }
                          if (payModalStatus === "partial" && actualVal <= 0 && depositVal <= 0) {
                            setPayModalError("For Partially Paid invoices, enter an actual amount received greater than ₱0.");
                            return;
                          }
                          if (actualVal > outstandingBefore) {
                            setPayModalError(`Amount received (₱${actualVal.toLocaleString()}) cannot exceed outstanding balance (₱${outstandingBefore.toLocaleString()}).`);
                            return;
                          }
                          if (payModalDeductDeposit && depositVal > availableDeposit) {
                            setPayModalError(`Deposit deduction (₱${depositVal.toLocaleString()}) cannot exceed available deposit (₱${availableDeposit.toLocaleString()}).`);
                            return;
                          }
                          if (payModalStatus === "paid" && finalInvoiceBalance > 0) {
                            setPayModalError(`Cannot mark as Paid while ₱${finalInvoiceBalance.toLocaleString()} remains outstanding. Select Partially Paid or cover with deposit deduction.`);
                            return;
                          }
                        }
                        setPayModalError(null);
                        setShowPayConfirmationSummary(true);
                      }}
                      className="px-5 py-2 font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                    >
                      <span>Review Confirmation</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveInvoicePayment}
                      disabled={isConfirmingPaid}
                      className="px-5 py-2 font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isConfirmingPaid ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          <span>Saving Transaction...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Confirm & Save Transaction</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })()}

        {/* Official Payment Receipt Modal */}
        {receiptModalBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReceiptModalBill(null)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full relative z-10 shadow-2xl border border-slate-200 overflow-hidden text-xs"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#8B2626] to-[#EF6905] text-white p-4 sm:p-5 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    <span className="font-mono text-xs uppercase tracking-widest text-amber-200 font-bold">Official Payment Receipt</span>
                  </div>
                  <h3 className="text-lg font-black mt-1">Receipt #{receiptModalBill.id.replace("bill-", "").slice(0, 8).toUpperCase()}</h3>
                  <p className="text-[11px] text-orange-100">Issued to {receiptModalBill.tenant_name} • Room {receiptModalBill.room_number}</p>
                </div>
                <button
                  onClick={() => setReceiptModalBill(null)}
                  className="p-1 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Sent notification banner */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-extrabold block text-xs">Receipt Dispatched to Tenant</span>
                    <span className="text-[11px] text-emerald-700">This official electronic receipt has been recorded in the tenant's ledger and sent to their account notifications.</span>
                  </div>
                </div>

                {/* Receipt Details Card */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/60 font-mono">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-sans font-bold">Billing Period:</span>
                    <strong className="text-slate-900">{receiptModalBill.billing_month}</strong>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-sans font-bold">Payment Status:</span>
                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded font-bold text-[10px] uppercase">
                      SETTLED & PAID
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-sans font-bold">Date Settled:</span>
                    <span className="text-slate-800">{receiptModalBill.paid_at ? new Date(receiptModalBill.paid_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : new Date().toLocaleDateString("en-PH")}</span>
                  </div>

                  {/* Breakdown */}
                  <div className="pt-1 space-y-1 text-slate-700">
                    <div className="flex justify-between">
                      <span className="font-sans">Base Room Rent:</span>
                      <span>₱{(Number(receiptModalBill.rent_amount) || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans">Electricity ({receiptModalBill.electricity_usage || 0} kWh):</span>
                      <span>₱{(Number(receiptModalBill.electricity_amount) || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans">Water ({receiptModalBill.water_usage || 0} m³):</span>
                      <span>₱{(Number(receiptModalBill.water_amount) || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Grand Total */}
                  <div className="flex justify-between items-center pt-2 border-t-2 border-slate-300 font-bold text-sm text-slate-900">
                    <span className="font-sans">Total Paid:</span>
                    <span className="text-emerald-700 text-base">₱{(Number(receiptModalBill.total_amount) || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const text = `🧾 OFFICIAL PAYMENT RECEIPT\nReceipt #: ${receiptModalBill.id}\nTenant: ${receiptModalBill.tenant_name} (Rm ${receiptModalBill.room_number})\nBilling Month: ${receiptModalBill.billing_month}\nTotal Settled: ₱${Number(receiptModalBill.total_amount).toLocaleString()}\nStatus: PAID & SETTLED\nThank you!`;
                      navigator.clipboard.writeText(text);
                      setReceiptCopied(true);
                      setTimeout(() => setReceiptCopied(false), 2500);
                    }}
                    className="neu-btn px-3 py-2 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{receiptCopied ? "Copied!" : "Copy Receipt Text"}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="neu-btn px-3 py-2 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptModalBill(null)}
                      className="px-4 py-2 bg-slate-900 hover:bg-[#EF6905] text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
