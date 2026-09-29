import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink, Image as ImageIcon, RefreshCw, Search, XCircle, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";

interface Props { token: string; onRefresh?: () => Promise<void> | void; }

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

  const load = async () => {
    setLoading(true);
    try { setItems(await api.getPaymentSubmissions(token)); }
    catch (e: any) { setMessage(e?.message || "Unable to load payment submissions."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const pending = useMemo(() => items.filter(x => ["awaiting_proof", "pending_verification"].includes(x.status)), [items]);
  const filtered = useMemo(() => pending.filter(x => `${x.tenant_name} ${x.room_number} ${x.reference} ${x.method}`.toLowerCase().includes(query.toLowerCase())), [pending, query]);

  const openItem = async (item: any) => {
    setSelected(item); setAmount(String(item.amount_due || "")); setNote(""); setMessage(""); setReceiptSrc("");
    if (item.receipt_url) {
      try {
        const res = await fetch(item.receipt_url, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const blob = await res.blob(); setReceiptSrc(URL.createObjectURL(blob)); }
      } catch { /* receipt preview remains unavailable */ }
    }
  };

  const verify = async (action: "confirm" | "reject") => {
    if (!selected) return;
    if (selected.status !== "pending_verification") { setMessage("This payment is waiting for the tenant to submit a reference number or receipt."); return; }
    const parsed = Number(amount);
    if (action === "confirm" && (!Number.isFinite(parsed) || parsed <= 0)) { setMessage("Enter a valid received amount before confirming."); return; }
    setBusy(true); setMessage("");
    try {
      await api.verifyPayment(token, selected.id, action === "confirm" ? parsed : 0, action, note);
      if (receiptSrc) URL.revokeObjectURL(receiptSrc);
      setSelected(null);
      setReceiptSrc("");
      await load();
      if (onRefresh) await onRefresh();
    } catch (e: any) { setMessage(e?.message || "Verification failed."); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div><h2 className="text-2xl font-black text-slate-950">Payment Verification</h2><p className="text-sm text-slate-600 mt-1">Review tenant payment references and receipts before posting a payment.</p></div>
      <button onClick={load} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm font-bold text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4"/>Refresh</button>
    </div>
    <div className="flex flex-col md:flex-row md:items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4"><ShieldCheck className="w-5 h-5 text-amber-700"/><span className="text-sm font-semibold text-amber-900">Payment requests appear here immediately after the tenant chooses GCash/Bank. They become verifiable after a reference number or receipt is submitted.</span><span className="md:ml-auto font-black text-amber-800 whitespace-nowrap">{pending.length} active</span></div>
    <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tenant, room, reference, or method" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white"/></div>
    {message && !selected && <div className="p-3 rounded-xl bg-red-50 text-red-800 text-sm font-semibold">{message}</div>}
    {loading ? <div className="py-16 text-center text-slate-500">Loading payment submissions…</div> : filtered.length === 0 ? <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl"><CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2"/><p className="font-bold text-slate-800">No pending payment submissions</p></div> :
      <div className="grid gap-4">{filtered.map(item => <div key={item.id} className="bg-white border-2 border-amber-100 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center"><Clock3 className="w-7 h-7 text-amber-600"/></div>
        <div className="flex-1"><div className="flex flex-wrap gap-2 items-center"><h3 className="font-black text-slate-950">{item.tenant_name || "Tenant"}</h3><span className="px-2 py-1 text-xs rounded-full bg-slate-100 font-bold">Room {item.room_number || "—"}</span><span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 font-bold">{item.method === "GCASH" ? "GCash" : "Bank Transfer"}</span></div><p className="text-sm text-slate-600 mt-1">Reference: <b>{item.reference || "Not provided"}</b> · Claimed amount: <b>₱{Number(item.amount_due || 0).toLocaleString()}</b></p><p className="text-xs text-slate-400 mt-1"><span className={`font-black ${item.status === "awaiting_proof" ? "text-amber-700" : "text-blue-700"}`}>{item.status === "awaiting_proof" ? "Awaiting receipt/reference" : "Pending verification"}</span> · Submitted {item.submitted_at ? new Date(item.submitted_at).toLocaleString("en-PH") : "—"}</p></div>
        {item.receipt_url && <span className="text-xs font-bold text-emerald-700 flex items-center gap-1"><ImageIcon className="w-4 h-4"/> Receipt attached</span>}
        <button onClick={()=>openItem(item)} className="px-4 py-2.5 rounded-xl bg-[#8B2626] text-white font-black text-sm">Review Payment</button>
      </div>)}</div>}

    {selected && <div className="fixed inset-0 z-[100] bg-black/60 p-4 flex items-center justify-center" onMouseDown={e=>{if(e.target===e.currentTarget) setSelected(null)}}>
      <div className="bg-white w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-white border-b p-5 flex items-center justify-between"><div><h3 className="text-xl font-black">Review Payment</h3><p className="text-sm text-slate-500">{selected.tenant_name} · Room {selected.room_number}</p></div><button onClick={()=>setSelected(null)}><XCircle className="w-7 h-7 text-slate-500"/></button></div>
        <div className="p-5 grid lg:grid-cols-2 gap-6">
          <div className="space-y-3"><div className="grid grid-cols-2 gap-3 text-sm"><div className="bg-slate-50 p-3 rounded-xl"><b>Method</b><br/>{selected.method === "GCASH" ? "GCash" : "Bank Transfer"}</div><div className="bg-slate-50 p-3 rounded-xl"><b>Reference</b><br/>{selected.reference || "Not provided"}</div></div>
            {selected.receipt_url ? <div><p className="font-bold mb-2">Tenant Receipt</p><a href={receiptSrc || selected.receipt_url} target="_blank" rel="noreferrer"><img src={receiptSrc || selected.receipt_url} alt="Tenant payment receipt" className="w-full max-h-[520px] object-contain rounded-xl border bg-slate-50"/></a><a href={receiptSrc || selected.receipt_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-blue-700">Open full image <ExternalLink className="w-4 h-4"/></a></div> : <div className="p-8 bg-slate-50 rounded-xl text-center text-slate-500">No receipt image was attached.</div>}
          </div>
          <div className="space-y-4"><div className="bg-blue-50 border border-blue-100 rounded-xl p-4"><p className="font-black text-blue-900">Verification checklist</p><ul className="text-sm text-blue-900 mt-2 list-disc ml-5 space-y-1"><li>Check the reference in GCash/bank records.</li><li>Confirm the recipient and amount.</li><li>Only confirm after the money is actually received.</li></ul></div>
            <label className="block text-sm font-bold">Verified received amount<input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full border rounded-xl px-3 py-3"/></label>
            <label className="block text-sm font-bold">Admin note (optional)<textarea value={note} onChange={e=>setNote(e.target.value.slice(0,300))} className="mt-1 w-full border rounded-xl px-3 py-3" rows={3} placeholder="e.g. Verified in GCash transaction history"/></label>
            {message && <div className="p-3 rounded-xl bg-red-50 text-red-800 text-sm font-semibold">{message}</div>}
            <div className="flex gap-3 pt-2"><button disabled={busy || selected.status !== "pending_verification"} onClick={()=>verify("reject")} className="flex-1 px-4 py-3 rounded-xl border-2 border-red-200 text-red-700 font-black"><XCircle className="inline w-4 h-4 mr-1"/>Reject</button><button disabled={busy || selected.status !== "pending_verification"} onClick={()=>verify("confirm")} className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-black"><CheckCircle2 className="inline w-4 h-4 mr-1"/>{busy ? "Processing…" : "Confirm Payment"}</button></div>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}
