import React, { useEffect, useMemo, useState } from "react";
import { 
  CheckCircle2, Clock3, ExternalLink, Image as ImageIcon, RefreshCw, 
  Search, XCircle, ShieldCheck, AlertCircle, Filter, FileText, Check, Plus, Upload, X 
} from "lucide-react";
import { api } from "../lib/api";

interface Props { 
  token: string; 
  onRefresh?: () => Promise<void> | void; 
}

export default function PaymentVerification({ token, onRefresh }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [receiptSrc, setReceiptSrc] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "all" | "confirmed" | "rejected">("pending");
  const [confirmationNotice, setConfirmationNotice] = useState<{ title: string; desc: string } | null>(null);

  // Manual payment submission modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newMethod, setNewMethod] = useState<"GCASH" | "BANK">("GCASH");
  const [newReference, setNewReference] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newReceiptBase64, setNewReceiptBase64] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);

  const authToken = token || localStorage.getItem("apartmentpro_token") || "apt_session_admin_active";

  const load = async () => {
    setLoading(true);
    setMessage("");
    try { 
      const data = await api.getPaymentSubmissions(authToken);
      setItems(Array.isArray(data) ? data : []); 
    } catch (e: any) { 
      setMessage(e?.message || "Unable to load payment submissions."); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(), 10000);
    return () => window.clearInterval(timer);
  }, [authToken]);

  const pendingCount = useMemo(() => {
    return items.filter(x => ["awaiting_proof", "pending_verification", "pending", "submitted"].includes(x.status)).length;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(x => {
      // 1. Status Filter
      if (statusFilter === "pending") {
        const isPending = ["awaiting_proof", "pending_verification", "pending", "submitted"].includes(x.status);
        if (!isPending) return false;
      } else if (statusFilter === "confirmed") {
        if (x.status !== "confirmed") return false;
      } else if (statusFilter === "rejected") {
        if (x.status !== "rejected") return false;
      }

      // 2. Search Query
      if (query.trim()) {
        const q = query.toLowerCase();
        const str = `${x.tenant_name || ""} ${x.room_number || ""} ${x.reference || ""} ${x.method || ""} ${x.id || ""} ${x.status || ""}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [items, statusFilter, query]);

  const openItem = async (item: any) => {
    setSelected(item); 
    setAmount(String(item.amount_due || "")); 
    setNote(""); 
    setMessage(""); 
    setReceiptSrc("");

    if (item.receipt_url) {
      const url = String(item.receipt_url).trim();
      if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
        setReceiptSrc(url);
      } else {
        try {
          const res = await fetch(url, { headers: { Authorization: `Bearer ${authToken}` } });
          if (res.ok) { 
            const blob = await res.blob(); 
            setReceiptSrc(URL.createObjectURL(blob)); 
          } else {
            setReceiptSrc(`${url}?token=${encodeURIComponent(authToken)}`);
          }
        } catch { 
          setReceiptSrc(`${url}?token=${encodeURIComponent(authToken)}`);
        }
      }
    }
  };

  const verify = async (action: "confirm" | "reject") => {
    if (!selected) return;
    if (selected.status === "awaiting_proof") { 
      setMessage("This payment is waiting for the tenant to submit a reference number or receipt before it can be verified."); 
      return; 
    }
    const parsed = Number(amount);
    if (action === "confirm" && (!Number.isFinite(parsed) || parsed <= 0)) { 
      setMessage("Please enter a valid received amount before confirming."); 
      return; 
    }
    setBusy(true); 
    setMessage("");
    try {
      const res = await api.verifyPayment(authToken, selected.id, action === "confirm" ? parsed : 0, action, note);
      if (receiptSrc && receiptSrc.startsWith("blob:")) {
        URL.revokeObjectURL(receiptSrc);
      }
      setSelected(null);
      setReceiptSrc("");

      if (action === "confirm") {
        if (res.notificationStatus === "FAILED_WINDOW_EXPIRED") {
          setConfirmationNotice({
            title: "✅ Payment Confirmed Successfully",
            desc: "⚠️ Messenger notification was not sent because the Messenger messaging window has expired."
          });
        } else if (res.notificationSent) {
          setConfirmationNotice({
            title: "✅ Payment Confirmed Successfully",
            desc: "📨 Tenant notification: Sent via Messenger."
          });
        } else if (res.notificationStatus === "NOT_APPLICABLE") {
          setConfirmationNotice({
            title: "✅ Payment Confirmed Successfully",
            desc: "Tenant notification: Not applicable (Tenant is not linked to Facebook Messenger)."
          });
        } else {
          setConfirmationNotice({
            title: "✅ Payment Confirmed Successfully",
            desc: "⚠️ Tenant notification: Could not be delivered via Messenger."
          });
        }
      } else {
        setConfirmationNotice({
          title: "❌ Payment Submission Rejected",
          desc: "The payment submission has been rejected."
        });
      }

      await load();
      if (onRefresh) await onRefresh();
    } catch (e: any) { 
      setMessage(e?.message || "Verification failed."); 
    } finally { 
      setBusy(false); 
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName || !newAmount) {
      alert("Please provide tenant name and amount.");
      return;
    }
    setSubmittingManual(true);
    try {
      await api.submitPayment({
        tenant_name: newTenantName,
        room_number: newRoomNumber,
        method: newMethod,
        reference: newReference,
        amount: Number(newAmount),
        amount_due: Number(newAmount),
        receipt_base64: newReceiptBase64 || undefined,
        source: "admin_manual"
      });
      setIsSubmitModalOpen(false);
      setNewTenantName("");
      setNewRoomNumber("");
      setNewReference("");
      setNewAmount("");
      setNewReceiptBase64("");
      await load();
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to submit payment");
    } finally {
      setSubmittingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Payment Verification</h2>
          <p className="text-sm text-slate-600 mt-1">Review tenant payment references and receipts before posting payments to the ledger.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsSubmitModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white shadow-sm font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition"
          >
            <Plus className="w-4 h-4"/>
            <span>Record Payment Submission</span>
          </button>

          <button 
            onClick={load} 
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm font-bold text-sm flex items-center gap-2 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}/>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-2xs">
        <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0"/>
        <span className="text-sm font-semibold text-amber-900">
          Payment submissions appear here automatically when tenants submit via Facebook Messenger or web chat. Verify the payment reference or attached receipt to credit the tenant's ledger.
        </span>
        <span className="md:ml-auto font-black text-amber-800 whitespace-nowrap bg-amber-100 px-3 py-1 rounded-xl text-xs">
          {pendingCount} Pending Review
        </span>
      </div>

      {/* Status Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
              statusFilter === "pending"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ⏳ Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
              statusFilter === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📋 All ({items.length})
          </button>
          <button
            onClick={() => setStatusFilter("confirmed")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
              statusFilter === "confirmed"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ✅ Confirmed ({items.filter(x => x.status === "confirmed").length})
          </button>
          <button
            onClick={() => setStatusFilter("rejected")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
              statusFilter === "rejected"
                ? "bg-white text-red-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ❌ Rejected ({items.filter(x => x.status === "rejected").length})
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400"/>
          <input 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
            placeholder="Search tenant, room, reference, or method..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#8B2626]"
          />
        </div>
      </div>

      {/* Confirmation & Action Notification Banner */}
      {confirmationNotice && (
        <div className="p-4 rounded-2xl bg-white border-2 border-emerald-500 shadow-md flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5"/>
            </div>
            <div>
              <h4 className="font-black text-slate-950 text-base">{confirmationNotice.title}</h4>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">{confirmationNotice.desc}</p>
            </div>
          </div>
          <button 
            onClick={() => setConfirmationNotice(null)} 
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <XCircle className="w-5 h-5"/>
          </button>
        </div>
      )}

      {message && !selected && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600"/>
          <span>{message}</span>
        </div>
      )}

      {/* List Content */}
      {loading && items.length === 0 ? (
        <div className="py-16 text-center text-slate-500 font-semibold flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-[#8B2626]"/>
          <span>Loading payment submissions…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2"/>
          <p className="font-bold text-slate-900 text-base">No payment submissions found</p>
          <p className="text-xs text-slate-500 mt-1">
            {statusFilter === "pending" 
              ? "All submitted payments have been verified. Switch to 'All' to view history." 
              : "No records match the current filter or search criteria."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(item => {
            const isPendingProof = item.status === "awaiting_proof";
            const isConfirmed = item.status === "confirmed";
            const isRejected = item.status === "rejected";
            const isPendingReview = item.status === "pending_verification" || item.status === "pending" || item.status === "submitted";

            const cardBorder = isConfirmed 
              ? "border-emerald-300 border-l-[8px] border-l-emerald-600 bg-emerald-50/10"
              : isRejected 
                ? "border-red-300 border-l-[8px] border-l-red-600 bg-red-50/10"
                : isPendingProof 
                  ? "border-amber-300 border-l-[8px] border-l-amber-500 bg-amber-50/10"
                  : "border-blue-300 border-l-[8px] border-l-blue-600 bg-blue-50/10";

            return (
              <div 
                key={item.id} 
                className={`bg-white border-2 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center gap-4 transition hover:shadow-md ${cardBorder}`}
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                  <Clock3 className={`w-7 h-7 ${isConfirmed ? "text-emerald-600" : isRejected ? "text-red-600" : "text-amber-600"}`}/>
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap gap-2 items-center">
                    <h3 className="font-black text-slate-950 text-base">{item.tenant_name || "Tenant"}</h3>
                    <span className="px-2.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-800 font-bold border border-slate-200">
                      Room {item.room_number || "—"}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                      {item.method === "GCASH" ? "📱 GCash" : "🏦 Bank Transfer"}
                    </span>
                    <span className={`px-2.5 py-0.5 text-xs rounded-full font-black uppercase border ${
                      isConfirmed 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                        : isRejected 
                          ? "bg-red-50 text-red-800 border-red-200"
                          : isPendingProof 
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-blue-50 text-blue-800 border-blue-200"
                    }`}>
                      {isConfirmed ? "✅ Payment Confirmed" : isRejected ? "❌ Rejected" : isPendingProof ? "⏳ Awaiting Proof" : "⏳ Pending Verification"}
                    </span>
                  </div>

                  {isConfirmed && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {item.notification_status === "SENT" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          📨 Tenant Notification: Sent
                        </span>
                      )}
                      {item.notification_status === "FAILED_WINDOW_EXPIRED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
                          ⚠️ Tenant Notification: Not sent — Messenger window expired
                        </span>
                      )}
                      {item.notification_status === "FAILED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-red-50 text-red-800 border border-red-200">
                          ⚠️ Tenant Notification: Not sent — Delivery failed
                        </span>
                      )}
                      {item.notification_status === "NOT_APPLICABLE" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          ℹ️ Tenant Notification: Not applicable (No Messenger)
                        </span>
                      )}
                      {(!item.notification_status || item.notification_status === "NOT_SENT") && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          ⏳ Tenant Notification: Not sent
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-sm text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>Reference: <b className="text-slate-950">{item.reference || (item.receipt_url ? "See Screenshot" : "Not provided")}</b></span>
                    <span>Amount Due/Claimed: <b className="text-[#8B2626]">₱{Number(item.amount_due || 0).toLocaleString()}</b></span>
                    {item.verified_amount !== undefined && (
                      <span>Verified Amount: <b className="text-emerald-700">₱{Number(item.verified_amount).toLocaleString()}</b></span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 font-medium">
                    Submitted: {item.submitted_at ? new Date(item.submitted_at).toLocaleString("en-PH") : "Recently"}
                    {item.id && <span className="ml-2 font-mono text-[11px] text-slate-400">({item.id})</span>}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {item.receipt_url && (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                      <ImageIcon className="w-4 h-4"/> 
                      <span>Receipt Attached</span>
                    </span>
                  )}
                  <button 
                    onClick={() => openItem(item)} 
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B2626] to-[#EF6905] text-white font-black text-xs sm:text-sm hover:opacity-95 shadow-xs transition"
                  >
                    Review Payment
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selected && (
        <div 
          className="fixed inset-0 z-[100] bg-black/60 p-4 flex items-center justify-center backdrop-blur-xs" 
          onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-white w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-center justify-between z-10">
              <div>
                <h3 className="text-xl font-black text-slate-950">Review Payment Verification</h3>
                <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-0.5">
                  Tenant: <span className="text-slate-900 font-bold">{selected.tenant_name}</span> · Room <span className="text-slate-900 font-bold">{selected.room_number}</span> · ID: <span className="font-mono text-slate-600">{selected.id}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
              >
                <XCircle className="w-7 h-7"/>
              </button>
            </div>

            <div className="p-6 grid lg:grid-cols-2 gap-6">
              {/* Left Column: Submission Details & Receipt Image */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Payment Method</span>
                    <strong className="text-slate-900 text-base mt-0.5 block">{selected.method === "GCASH" ? "📱 GCash" : "🏦 Bank Transfer"}</strong>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Reference Number</span>
                    <strong className="text-slate-900 text-base mt-0.5 block font-mono">{selected.reference || "None provided"}</strong>
                  </div>
                </div>

                {selected.receipt_url ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tenant Payment Receipt:</span>
                      <a 
                        href={receiptSrc || `${selected.receipt_url}?token=${encodeURIComponent(authToken)}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-1 text-xs font-black text-[#8B2626] hover:underline"
                      >
                        <span>Open full size</span>
                        <ExternalLink className="w-3.5 h-3.5"/>
                      </a>
                    </div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-2 flex items-center justify-center max-h-[460px]">
                      <img 
                        src={receiptSrc || `${selected.receipt_url}?token=${encodeURIComponent(authToken)}`} 
                        alt="Tenant payment receipt" 
                        className="w-full max-h-[440px] object-contain rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-8 bg-slate-50 rounded-xl text-center text-slate-500 border border-dashed border-slate-200">
                    <FileText className="w-8 h-8 mx-auto text-slate-400 mb-1.5"/>
                    <p className="font-bold text-sm">No receipt image was attached</p>
                    <p className="text-xs text-slate-400 mt-1">Tenant submitted a reference number instead.</p>
                  </div>
                )}
              </div>

              {/* Right Column: Verification Action Form */}
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="font-black text-blue-950 text-sm flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-700"/>
                    <span>Property Manager Verification Checklist</span>
                  </p>
                  <ul className="text-xs text-blue-900 mt-2 list-disc ml-5 space-y-1 font-medium">
                    <li>Log into your property GCash or Merchant bank account.</li>
                    <li>Verify the transaction reference matches the received funds.</li>
                    <li>Ensure the money has fully cleared before clicking Confirm.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-900">
                    Verified Received Amount (₱)
                    <input 
                      value={amount} 
                      onChange={e => setAmount(e.target.value)} 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      placeholder="e.g. 13450"
                      className="mt-1 w-full border border-slate-200 rounded-xl px-3.5 py-3 text-slate-950 font-bold focus:outline-none focus:ring-2 focus:ring-[#8B2626]"
                    />
                  </label>

                  <label className="block text-sm font-bold text-slate-900">
                    Admin Verification Note (Optional)
                    <textarea 
                      value={note} 
                      onChange={e => setNote(e.target.value.slice(0, 300))} 
                      className="mt-1 w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8B2626]" 
                      rows={3} 
                      placeholder="e.g. Cleared via GCash Merchant account ref 9089293497"
                    />
                  </label>
                </div>

                {message && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0"/>
                    <span>{message}</span>
                  </div>
                )}

                {selected.status === "confirmed" ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 space-y-2.5">
                    <div className="flex items-center gap-2 text-emerald-950 font-black text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600"/>
                      <span>✅ Payment Confirmed</span>
                    </div>
                    <div className="text-xs text-slate-700 space-y-1.5">
                      <p>Verified Amount: <b className="text-emerald-800 font-black text-sm">₱{Number(selected.verified_amount || selected.amount_due || 0).toLocaleString()}</b></p>
                      {selected.verified_at && (
                        <p className="text-slate-500">Confirmed At: {new Date(selected.verified_at).toLocaleString("en-PH")}</p>
                      )}
                      <div className="pt-1">
                        {selected.notification_status === "SENT" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                            📨 Tenant Notification: Sent
                          </span>
                        )}
                        {selected.notification_status === "FAILED_WINDOW_EXPIRED" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-950 border border-amber-300">
                            ⚠️ Tenant Notification: Not sent — Messenger window expired
                          </span>
                        )}
                        {selected.notification_status === "FAILED" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black bg-red-100 text-red-900 border border-red-300">
                            ⚠️ Tenant Notification: Not sent — Messenger error
                          </span>
                        )}
                        {selected.notification_status === "NOT_APPLICABLE" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-800 border border-slate-300">
                            ℹ️ Tenant Notification: Not applicable (No Messenger)
                          </span>
                        )}
                        {(!selected.notification_status || selected.notification_status === "NOT_SENT") && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-800 border border-slate-300">
                            ⏳ Tenant Notification: Not sent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 pt-3 border-t border-slate-200">
                    <button 
                      disabled={busy || selected.status === "awaiting_proof"} 
                      onClick={() => verify("reject")} 
                      className="flex-1 px-4 py-3 rounded-xl border-2 border-red-200 hover:bg-red-50 text-red-700 font-black text-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4"/>
                      <span>Reject</span>
                    </button>

                    <button 
                      disabled={busy || selected.status === "awaiting_proof"} 
                      onClick={() => verify("confirm")} 
                      className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4"/>
                      <span>{busy ? "Processing…" : "Confirm & Post"}</span>
                    </button>
                  </div>
                )}

                {selected.status === "awaiting_proof" && (
                  <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-medium">
                    ⚠️ The tenant initiated this payment session but has not yet submitted their reference number or screenshot.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

