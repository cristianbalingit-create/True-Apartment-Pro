import React, { useState } from "react";
import { DBState, api } from "../lib/api";
import { Tenant, Room, Apartment } from "../types";
import { Users, Search, Plus, Edit2, LogOut, Mail, Phone, Calendar, DollarSign, X, Check, Eye, Receipt, Printer, FileText, MessageCircle, CheckCircle2, Copy, ExternalLink, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TenantsProps {
  db: DBState;
  onRefresh: () => void;
}

export default function Tenants({ db, onRefresh }: TenantsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Dialog States
  const [showAddEditDialog, setShowAddEditDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null); // Null means ADD mode
  const [checkoutReceiptTenant, setCheckoutReceiptTenant] = useState<Tenant | null>(null);
  const [useAdvanceForSettlement, setUseAdvanceForSettlement] = useState(true);
  const [advanceIsConsumed, setAdvanceIsConsumed] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  // Ledger Dialog States
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [ledgerTenant, setLedgerTenant] = useState<Tenant | null>(null);
  const [ledgerType, setLedgerType] = useState<"deposit_payment" | "deposit_refund" | "deposit_deduction" | "advance_payment" | "advance_use" | "advance_refund">("deposit_deduction");
  const [ledgerAmount, setLedgerAmount] = useState("");
  const [ledgerDescription, setLedgerDescription] = useState("");

  // Messenger Modal States
  const [showMessengerModal, setShowMessengerModal] = useState(false);
  const [messengerSummaryText, setMessengerSummaryText] = useState("");
  const [messengerTenantName, setMessengerTenantName] = useState("");
  const [messengerCopySuccess, setMessengerCopySuccess] = useState(false);
  const [messengerUrl, setMessengerUrl] = useState("https://www.messenger.com");

  // Form States
  const [formName, setFormName] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRoomId, setFormRoomId] = useState("");
  const [formRentAmount, setFormRentAmount] = useState(0);
  const [formDeposit, setFormDeposit] = useState(0);
  const [formAdvancePayment, setFormAdvancePayment] = useState(0);
  const [formMoveInDate, setFormMoveInDate] = useState("");
  const [formMessengerPsid, setFormMessengerPsid] = useState("");

  const handleOpenAdd = () => {
    setSelectedTenant(null);
    setFormName("");
    setFormContact("");
    setFormEmail("");
    
    // Default to the first vacant room if available
    const vacant = db.rooms.filter((r) => r.status === "vacant");
    if (vacant.length > 0) {
      setFormRoomId(vacant[0].id);
      setFormRentAmount(vacant[0].rent_amount);
      setFormDeposit(vacant[0].rent_amount * 2); // default 2 months deposit
      setFormAdvancePayment(vacant[0].rent_amount); // default 1 month advance
    } else {
      setFormRoomId("");
      setFormRentAmount(0);
      setFormDeposit(0);
      setFormAdvancePayment(0);
    }
    
    setFormMoveInDate(new Date().toISOString().split("T")[0]);
    setFormMessengerPsid("");
    setShowAddEditDialog(true);
  };

  const handleOpenEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormName(tenant.name);
    setFormContact(tenant.contact);
    setFormEmail(tenant.email);
    setFormRoomId(tenant.room_id);
    setFormRentAmount(tenant.rent_amount);
    setFormDeposit(tenant.deposit);
    setFormAdvancePayment(tenant.advance_payment !== undefined ? tenant.advance_payment : tenant.rent_amount || 0);
    setFormMoveInDate(tenant.move_in_date);
    setFormMessengerPsid(tenant.messenger_psid);
    setShowAddEditDialog(true);
  };

  const handleRoomChange = (roomId: string) => {
    setFormRoomId(roomId);
    const room = db.rooms.find((r) => r.id === roomId);
    if (room) {
      setFormRentAmount(room.rent_amount);
      setFormDeposit(room.rent_amount * 2);
      setFormAdvancePayment(room.rent_amount);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const selectedRoom = db.rooms.find((r) => r.id === formRoomId);
    const apartmentId = selectedRoom ? selectedRoom.apartment_id : "";

    const payload = {
      name: formName,
      contact: formContact,
      email: formEmail,
      room_id: formRoomId,
      apartment_id: apartmentId,
      rent_amount: Number(formRentAmount),
      deposit: Number(formDeposit),
      advance_payment: Number(formAdvancePayment),
      messenger_psid: formMessengerPsid || `${formName.toLowerCase().replace(/\s+/g, ".")}.fb`,
      move_in_date: formMoveInDate,
    };

    try {
      if (selectedTenant) {
        // Edit Mode
        await api.updateTenant(selectedTenant.id, payload);
      } else {
        // Add Mode
        await api.createTenant(payload);
      }
      setShowAddEditDialog(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving tenant information.");
    } finally {
      setLoading(false);
    }
  };

  const handleSettleReceipt = async () => {
    if (!checkoutReceiptTenant) return;
    setIsSettling(true);
    try {
      const tenant = checkoutReceiptTenant;
      const depBal = tenant.deposit_balance !== undefined ? tenant.deposit_balance : tenant.deposit;
      const advBal = tenant.advance_balance !== undefined ? tenant.advance_balance : (tenant.advance_payment || tenant.rent_amount || 0);
      
      const tenantBills = db.billingRecords.filter(
        (b) => b.tenant_id === tenant.id && (b.payment_status === "unpaid" || b.payment_status === "overdue")
      );
      
      let remainingDep = depBal;
      let remainingAdv = advBal;

      // 1. Pay off bills using Security Deposit first
      for (const bill of tenantBills) {
        const billAmount = bill.total_amount;
        let billPaid = false;

        // Try paying from deposit first
        if (remainingDep >= billAmount) {
          remainingDep -= billAmount;
          await api.recordTenantLedger(tenant.id, {
            type: "deposit_deduction",
            amount: billAmount,
            description: `Deducted from security deposit to pay Bill #${bill.id}`
          });
          await api.payBilling(bill.id);
          billPaid = true;
        } else if (remainingDep > 0) {
          const deductAmt = remainingDep;
          const remainingBillAmt = billAmount - deductAmt;
          remainingDep = 0;
          await api.recordTenantLedger(tenant.id, {
            type: "deposit_deduction",
            amount: deductAmt,
            description: `Deducted remaining security deposit of ₱${deductAmt.toLocaleString()} to Bill #${bill.id}`
          });
          
          // Deduct the rest from advance rent if the user wants to use advance
          if (useAdvanceForSettlement && remainingAdv > 0) {
            if (remainingAdv >= remainingBillAmt) {
              remainingAdv -= remainingBillAmt;
              await api.recordTenantLedger(tenant.id, {
                type: "advance_use",
                amount: remainingBillAmt,
                description: `Applied advance rent to cover remaining Bill #${bill.id} balance`
              });
              await api.payBilling(bill.id);
              billPaid = true;
            } else {
              const useAmt = remainingAdv;
              remainingAdv = 0;
              await api.recordTenantLedger(tenant.id, {
                type: "advance_use",
                amount: useAmt,
                description: `Applied remaining advance rent of ₱${useAmt.toLocaleString()} to cover Bill #${bill.id}`
              });
              await api.payBilling(bill.id);
              billPaid = true;
            }
          }
        } else {
          // No deposit left. Try paying from advance if selected
          if (useAdvanceForSettlement && remainingAdv > 0) {
            if (remainingAdv >= billAmount) {
              remainingAdv -= billAmount;
              await api.recordTenantLedger(tenant.id, {
                type: "advance_use",
                amount: billAmount,
                description: `Applied advance rent to pay Bill #${bill.id}`
              });
              await api.payBilling(bill.id);
              billPaid = true;
            } else {
              const useAmt = remainingAdv;
              remainingAdv = 0;
              await api.recordTenantLedger(tenant.id, {
                type: "advance_use",
                amount: useAmt,
                description: `Applied remaining advance rent of ₱${useAmt.toLocaleString()} to Bill #${bill.id}`
              });
              await api.payBilling(bill.id);
              billPaid = true;
            }
          }
        }
      }

      // Calculate final refundable value of Advance Rent
      const finalRefundAdv = advanceIsConsumed ? 0 : remainingAdv;

      // 2. Refund remaining balances
      if (remainingDep > 0) {
        await api.recordTenantLedger(tenant.id, {
          type: "deposit_refund",
          amount: remainingDep,
          description: "Move-out refund of remaining security deposit balance"
        });
      }
      if (finalRefundAdv > 0) {
        await api.recordTenantLedger(tenant.id, {
          type: "advance_refund",
          amount: finalRefundAdv,
          description: useAdvanceForSettlement 
            ? "Move-out refund of remaining advance rent balance"
            : "Move-out refund of advance rent balance (unapplied to bills)"
        });
      }

      // If advance was consumed/used for stay, record that ledger entry too
      if (advanceIsConsumed && remainingAdv > 0) {
        await api.recordTenantLedger(tenant.id, {
          type: "advance_use",
          amount: remainingAdv,
          description: "Advance rent consumed/applied to active stay (not refunded)"
        });
      }

      // Mark tenant as moved out and release the room
      await api.moveOutTenant(tenant.id);

      alert("Lease checkout completed successfully! Remaining balances have been settled and the tenant status is set to Moved Out.");
      setCheckoutReceiptTenant(null);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to complete settlement.");
    } finally {
      setIsSettling(false);
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

  const handlePostLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerTenant || !ledgerAmount || isNaN(Number(ledgerAmount)) || Number(ledgerAmount) <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }
    setLoading(true);
    try {
      const result = await api.recordTenantLedger(ledgerTenant.id, {
        type: ledgerType,
        amount: Number(ledgerAmount),
        description: ledgerDescription,
      });
      // Retrieve updated tenant with new balances
      const updatedTenants = db.tenants.map(t => t.id === result.tenant.id ? { ...t, ...result.tenant } : t);
      const matchedTenant = updatedTenants.find(t => t.id === result.tenant.id) || result.tenant;
      setLedgerTenant(matchedTenant);
      setLedgerAmount("");
      setLedgerDescription("");
      onRefresh();

      // Trigger automatic Messenger dispatch & copy
      if (result.messenger_text) {
        setMessengerSummaryText(result.messenger_text);
        setMessengerTenantName(matchedTenant.name);
        setMessengerUrl(result.messenger_url || "https://www.messenger.com");
        setShowMessengerModal(true);
        setMessengerCopySuccess(false);
        try {
          navigator.clipboard.writeText(result.messenger_text);
          setMessengerCopySuccess(true);
        } catch (err) {
          console.error(err);
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to record transaction.");
    } finally {
      setLoading(false);
    }
  };

  // Filter vacant rooms. However, also include the tenant's current room in options if in edit mode!
  const availableRooms = db.rooms.filter((r) => {
    if (r.status === "vacant") return true;
    if (selectedTenant && r.id === selectedTenant.room_id) return true;
    return false;
  });

  const getApartmentName = (id: string) => {
    return db.apartments.find((a) => a.id === id)?.name || "ApartmentPro Plaza";
  };

  const getRoomNumber = (id: string) => {
    return db.rooms.find((r) => r.id === id)?.room_number || "N/A";
  };

  // Search filter
  const filteredTenants = db.tenants.filter((tenant) => {
    const aptName = getApartmentName(tenant.apartment_id);
    const roomNum = getRoomNumber(tenant.room_id);
    const matchesSearch =
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.contact.includes(searchQuery) ||
      aptName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      roomNum.includes(searchQuery);

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tenant Directories</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Review rental accounts, configure lease properties, and record checkouts.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange text-white font-bold text-sm rounded-xl shadow-md hover:bg-orange-600 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Tenant</span>
        </button>
      </div>

      {/* Table search filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
          <input
            type="text"
            placeholder="Search tenant name, email, phone, room number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange focus:bg-white transition-all text-sm font-medium text-slate-800"
          />
        </div>
      </div>

      {/* Tenants Table Grid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-4 px-6">Tenant Information</th>
                <th className="py-4 px-6">Assigned Space</th>
                <th className="py-4 px-6">Move-In Details</th>
                <th className="py-4 px-6">Billing Terms</th>
                <th className="py-4 px-6">Lease Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="font-bold">No Tenants Recorded</p>
                    <p className="text-xs mt-1 text-slate-400 font-light">No records matching query.</p>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-extrabold text-slate-900">{tenant.name}</div>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> {tenant.email}
                      </div>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {tenant.contact}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-700">Room {getRoomNumber(tenant.room_id)}</div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">{getApartmentName(tenant.apartment_id)}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{tenant.move_in_date}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1 block">FB PSID: {tenant.messenger_psid}</span>
                    </td>
                     <td className="py-4 px-6">
                      <div className="font-extrabold text-brand-orange">₱{Number(tenant.rent_amount).toLocaleString()}/mo</div>
                      <div className="space-y-0.5 mt-1">
                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 font-semibold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          <span>Deposit Bal:</span>
                          <span className="font-bold text-slate-700">₱{Number(tenant.deposit_balance !== undefined ? tenant.deposit_balance : tenant.deposit).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 font-semibold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          <span>Advance Bal:</span>
                          <span className="font-bold text-slate-700">₱{Number(tenant.advance_balance !== undefined ? tenant.advance_balance : (tenant.advance_payment || tenant.rent_amount)).toLocaleString()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {tenant.status === "active" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100">
                          Active Lease
                        </span>
                      ) : tenant.status === "inactive" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-100">
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200">
                          Moved Out
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => {
                            setLedgerTenant(tenant);
                            setLedgerAmount("");
                            setLedgerDescription("");
                            setLedgerType("deposit_deduction");
                            setShowLedgerDialog(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all"
                          title="Manage Advance & Security Deposit Ledger"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(tenant)}
                          className="p-2 text-slate-500 hover:text-brand-orange hover:bg-slate-100 rounded-xl transition-all"
                          title="Edit Tenant"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {tenant.status === "active" && (
                          <button
                            onClick={() => {
                              setUseAdvanceForSettlement(true);
                              setCheckoutReceiptTenant(tenant);
                            }}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                            title="Register Move-Out"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <AnimatePresence>
        {showAddEditDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddEditDialog(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 z-10 overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
                <h3 className="text-lg font-black text-slate-900">
                  {selectedTenant ? "Edit Lease Account" : "Assign New Lease Account"}
                </h3>
                <button
                  onClick={() => setShowAddEditDialog(false)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      required
                      value={formContact}
                      onChange={(e) => setFormContact(e.target.value)}
                      placeholder="e.g. 09171234567"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="e.g. john@example.com"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Room Assignment</label>
                    <select
                      value={formRoomId}
                      onChange={(e) => handleRoomChange(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    >
                      {availableRooms.length === 0 ? (
                        <option value="">No Available Rooms</option>
                      ) : (
                        availableRooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            Rm {r.room_number} ({getApartmentName(r.apartment_id)})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Move-In Date</label>
                    <input
                      type="date"
                      required
                      value={formMoveInDate}
                      onChange={(e) => setFormMoveInDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1 text-sm">Rent Amount (₱)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                      <input
                        type="number"
                        required
                        value={formRentAmount || ""}
                        onChange={(e) => setFormRentAmount(Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1 text-sm">Sec Deposit (₱)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                      <input
                        type="number"
                        required
                        value={formDeposit || ""}
                        onChange={(e) => setFormDeposit(Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1 text-sm">Advance Pay (₱)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                      <input
                        type="number"
                        required
                        value={formAdvancePayment || ""}
                        onChange={(e) => setFormAdvancePayment(Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Facebook Messenger PSID / Username</label>
                  <input
                    type="text"
                    value={formMessengerPsid}
                    onChange={(e) => setFormMessengerPsid(e.target.value)}
                    placeholder="e.g. john.doe.facebook"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange font-medium text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Used to establish direct communication links with the tenant via the system.</span>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddEditDialog(false)}
                    className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all active:scale-98"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : selectedTenant ? "Update Tenant" : "Assign Tenant"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* Deposit & Advance Ledger Dialog */}
      <AnimatePresence>
        {showLedgerDialog && ledgerTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowLedgerDialog(false);
                setLedgerTenant(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl z-10 flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-brand-orange" />
                    <span>Advance & Security Deposit Ledger</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Manage financial deductions, refunds, and advance adjustments for <span className="font-extrabold text-slate-700">{ledgerTenant.name}</span> (Room {getRoomNumber(ledgerTenant.room_id)})
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowLedgerDialog(false);
                    setLedgerTenant(null);
                  }}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Balances Summary Cards */}
              <div className="grid grid-cols-2 gap-4 p-6 bg-slate-50/50 border-b border-slate-100">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Security Deposit Balance</span>
                    <span className="text-2xl font-black text-slate-800">
                      ₱{Number(ledgerTenant.deposit_balance !== undefined ? ledgerTenant.deposit_balance : ledgerTenant.deposit).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium mt-0.5">Initial: ₱{Number(ledgerTenant.deposit).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Advance Rent Balance</span>
                    <span className="text-2xl font-black text-slate-800">
                      ₱{Number(ledgerTenant.advance_balance !== undefined ? ledgerTenant.advance_balance : (ledgerTenant.advance_payment || ledgerTenant.rent_amount)).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium mt-0.5">Initial: ₱{Number(ledgerTenant.advance_payment !== undefined ? ledgerTenant.advance_payment : (ledgerTenant.rent_amount || 0)).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Main Content Pane */}
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-5 gap-6">
                
                {/* Form column (cols-2) */}
                <form onSubmit={handlePostLedger} className="md:col-span-2 space-y-4 border-r border-slate-100 pr-6">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Record New Transaction</h4>
                  
                  <div>
                    <label className="block text-slate-600 text-xs font-semibold mb-1">Transaction Type</label>
                    <select
                      value={ledgerType}
                      onChange={(e) => setLedgerType(e.target.value as any)}
                      className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm font-medium text-slate-800"
                    >
                      <option value="deposit_deduction">💰 Security Deposit Deduction (Damages/Fines)</option>
                      <option value="advance_use">📅 Use Advance Rent (Apply to unpaid bill/rent)</option>
                      <option value="deposit_refund">💸 Refund Security Deposit (Checkout release)</option>
                      <option value="advance_refund">↩️ Refund Advance Payment (Checkout release)</option>
                      <option value="deposit_payment">📥 Receive Additional Deposit (Top-up)</option>
                      <option value="advance_payment">📥 Receive Additional Advance Payment</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 text-xs font-semibold mb-1">Amount (₱)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₱</span>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="0.00"
                        value={ledgerAmount}
                        onChange={(e) => setLedgerAmount(e.target.value)}
                        className="w-full pl-7 pr-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm font-semibold text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 text-xs font-semibold mb-1">Reason / Description</label>
                    <textarea
                      required
                      placeholder="Explain the reason for this adjustment (e.g. Damage to wall in bathroom, applied advance to final rent month...)"
                      value={ledgerDescription}
                      onChange={(e) => setLedgerDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange text-xs font-medium text-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !ledgerAmount}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {loading ? "Posting..." : "Post Ledger Transaction"}
                  </button>
                </form>

                {/* History list column (cols-3) */}
                <div className="md:col-span-3 flex flex-col h-full min-h-[300px]">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Ledger Transaction History</h4>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 max-h-[350px] pr-2">
                    {(!db.depositLedger || db.depositLedger.filter(e => e.tenant_id === ledgerTenant.id).length === 0) ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        <DollarSign className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-xs text-slate-400 font-bold">No transactions recorded yet</p>
                        <p className="text-[10px] text-slate-400 mt-1">Deductions and refunds will show up here chronologically.</p>
                      </div>
                    ) : (
                      db.depositLedger
                        .filter(e => e.tenant_id === ledgerTenant.id)
                        .slice()
                        .reverse()
                        .map((entry) => {
                          const isNegative = ["deposit_deduction", "advance_use", "deposit_refund", "advance_refund"].includes(entry.type);
                          return (
                            <div key={entry.id} className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-all flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${
                                  entry.type.startsWith("deposit") ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                                }`}>
                                  {entry.type.replace("_", " ")}
                                </span>
                                <p className="text-xs text-slate-700 font-bold leading-tight">{entry.description}</p>
                                <span className="text-[10px] text-slate-400 font-semibold block">
                                  {new Date(entry.created_at).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <div className={`font-mono text-xs font-black ${isNegative ? "text-rose-600" : "text-emerald-600"}`}>
                                  {isNegative ? "-" : "+"} ₱{entry.amount.toLocaleString()}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleShareLedgerToMessenger(entry, ledgerTenant)}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-2xs border border-blue-200/50"
                                  title="Send Transaction Receipt to Tenant's Messenger"
                                >
                                  <MessageCircle className="w-3 h-3 fill-blue-600 text-white" />
                                  <span>Messenger</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowLedgerDialog(false);
                    setLedgerTenant(null);
                  }}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Close Manager
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Move Out Settlement & Receipt Dialog */}
      <AnimatePresence>
        {checkoutReceiptTenant && (() => {
          const tenant = checkoutReceiptTenant;
          const depBal = tenant.deposit_balance !== undefined ? tenant.deposit_balance : tenant.deposit;
          const advBal = tenant.advance_balance !== undefined ? tenant.advance_balance : (tenant.advance_payment || tenant.rent_amount || 0);
          
          const tenantBills = db.billingRecords.filter(
            (b) => b.tenant_id === tenant.id && (b.payment_status === "unpaid" || b.payment_status === "overdue")
          );
          const totalUnpaidBills = tenantBills.reduce((sum, b) => sum + b.total_amount, 0);
          
          // 1. Outstanding bills are deducted from Security Deposit first
          const deductedFromDeposit = Math.min(depBal, totalUnpaidBills);
          const remainingDeposit = depBal - deductedFromDeposit;
          const remainingBills = totalUnpaidBills - deductedFromDeposit;

          // 2. Deduct remaining bills from Advance Rent if they want to use advance rent to offset
          const deductedFromAdvance = useAdvanceForSettlement ? Math.min(advBal, remainingBills) : 0;
          const remainingAdvance = advBal - deductedFromAdvance;

          // 3. Outstanding amount still unpaid (uncovered bills)
          const remainingBillsUnpaid = remainingBills - deductedFromAdvance;

          // 4. Refundable values
          const refundableDeposit = remainingDeposit;
          const refundableAdvance = advanceIsConsumed ? 0 : remainingAdvance;
          const totalRefund = refundableDeposit + refundableAdvance;

          // Net settlement
          const netSettlement = totalRefund - remainingBillsUnpaid;
          
          const roomNum = getRoomNumber(tenant.room_id);
          const aptName = getApartmentName(tenant.apartment_id);
          const receiptNo = `AP-MO-${tenant.id.split("-")[1] || Date.now()}`;
          const currentDate = new Date().toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden border border-slate-150 my-8"
              >
                {/* Print target */}
                <div id="checkout-receipt-print" className="p-8 space-y-6 bg-white text-slate-800 overflow-y-auto max-h-[70vh]">
                  {/* Branding Header */}
                  <div className="text-center border-b border-dashed border-slate-200 pb-6">
                    <div className="inline-flex p-3 rounded-2xl bg-amber-500 bg-opacity-10 text-amber-500 mb-2">
                      <Receipt className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-wide">ApartmentPro Plaza</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Move-Out Settlement Statement</p>
                    <div className="mt-4 flex justify-between text-left text-xs text-slate-500 font-medium max-w-xs mx-auto">
                      <div>
                        <div><strong>Receipt No:</strong> {receiptNo}</div>
                        <div><strong>Date issued:</strong> {currentDate}</div>
                      </div>
                      <div className="text-right">
                        <div><strong>Term Status:</strong> <span className="text-rose-500 font-bold uppercase">Lease Ended</span></div>
                        <div><strong>Room:</strong> {roomNum}</div>
                      </div>
                    </div>
                  </div>

                  {/* Tenant Details */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Leaseholder Information</h4>
                    <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Tenant Name</span>
                        <span className="font-extrabold text-slate-800">{tenant.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Assigned Space</span>
                        <span className="font-bold text-slate-700">{aptName}, Room {roomNum}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Move-In Date</span>
                        <span className="font-medium text-slate-600">{tenant.move_in_date}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Move-Out Date</span>
                        <span className="font-medium text-slate-600">{new Date().toISOString().split("T")[0]}</span>
                      </div>
                    </div>
                  </div>

                  {/* Admin Settlement Question (Bypass during print check) */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-4 print:hidden">
                    <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-amber-600" />
                      <span>Settlement & Advance Rent Options</span>
                    </h4>

                    {/* Deposit Deductions Notice */}
                    <div className="text-[11px] text-slate-600 font-medium bg-white/60 p-2.5 rounded-lg border border-amber-100">
                      <strong>Auto-Deduction:</strong> Outstanding statement bills (₱{totalUnpaidBills.toLocaleString()}) are automatically deducted first from the Security Deposit (₱{depBal.toLocaleString()}).
                    </div>
                    
                    {remainingBills > 0 && (
                      <div className="flex items-start gap-2.5 border-t border-dashed border-amber-200 pt-3">
                        <input
                          id="use-advance-checkbox"
                          type="checkbox"
                          checked={useAdvanceForSettlement}
                          onChange={(e) => setUseAdvanceForSettlement(e.target.checked)}
                          className="mt-1 h-4.5 w-4.5 rounded border-slate-300 text-brand-orange focus:ring-brand-orange cursor-pointer"
                        />
                        <label htmlFor="use-advance-checkbox" className="text-xs text-slate-700 font-bold leading-tight cursor-pointer">
                          Use Advance Rent to offset remaining bills?
                          <span className="block font-medium text-slate-500 text-[10px] mt-1 normal-case leading-relaxed font-normal">
                            Security deposit is exhausted. Checking this applies ₱{Math.min(advBal, remainingBills).toLocaleString()} of the Advance Rent to pay off the leftover bill balance.
                          </span>
                        </label>
                      </div>
                    )}

                    <div className="flex items-start gap-2.5 border-t border-dashed border-amber-200 pt-3">
                      <input
                        id="advance-consumed-checkbox"
                        type="checkbox"
                        checked={advanceIsConsumed}
                        onChange={(e) => setAdvanceIsConsumed(e.target.checked)}
                        className="mt-1 h-4.5 w-4.5 rounded border-slate-300 text-brand-orange focus:ring-brand-orange cursor-pointer"
                      />
                      <label htmlFor="advance-consumed-checkbox" className="text-xs text-slate-700 font-bold leading-tight cursor-pointer">
                        Mark Advance Rent as consumed/used for last month's stay?
                        <span className="block font-medium text-slate-500 text-[10px] mt-1 normal-case leading-relaxed font-normal">
                          If checked, the advance rent of ₱{advBal.toLocaleString()} is marked as used for rent stay, and is **deducted from the net settlement refund**.
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Print-only settlement state feedback */}
                  <div className="hidden print:block text-[10px] space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div><strong>Bill Deduction Plan:</strong> Paid ₱{deductedFromDeposit.toLocaleString()} from Security Deposit first.</div>
                    {remainingBills > 0 && (
                      <div><strong>Leftover Bills:</strong> ₱{remainingBills.toLocaleString()} {useAdvanceForSettlement ? `(Covered with ₱${deductedFromAdvance.toLocaleString()} Advance Rent)` : "(Owed separately)"}</div>
                    )}
                    <div><strong>Advance Rent Treatment:</strong> {advanceIsConsumed ? "Consumed for Stay (Deducted from Refund)" : `Refundable to Tenant (₱${remainingAdvance.toLocaleString()})`}</div>
                  </div>

                  {/* Escrow Accounts Ledger */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Escrow Account Application</h4>
                    <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100 text-xs space-y-3">
                      
                      {/* Security Deposit Block */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center font-bold text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            Security Deposit Held
                          </span>
                          <span>₱{depBal.toLocaleString()}</span>
                        </div>
                        {deductedFromDeposit > 0 && (
                          <div className="pl-4 flex justify-between items-center text-[11px] text-rose-600 font-medium">
                            <span>Deducted for bills (First Priority)</span>
                            <span>- ₱{deductedFromDeposit.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="pl-4 flex justify-between items-center text-[11px] text-emerald-600 font-bold border-t border-slate-200/60 pt-1">
                          <span>Refundable Deposit Portion</span>
                          <span>₱{refundableDeposit.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Advance Rent Block */}
                      <div className="space-y-1.5 border-t border-slate-150 pt-2.5">
                        <div className="flex justify-between items-center font-bold text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            Advance Rent Held
                          </span>
                          <span>₱{advBal.toLocaleString()}</span>
                        </div>
                        {deductedFromAdvance > 0 && (
                          <div className="pl-4 flex justify-between items-center text-[11px] text-rose-600 font-medium">
                            <span>Deducted for leftover bills</span>
                            <span>- ₱{deductedFromAdvance.toLocaleString()}</span>
                          </div>
                        )}
                        {advanceIsConsumed && remainingAdvance > 0 && (
                          <div className="pl-4 flex justify-between items-center text-[11px] text-amber-600 font-medium">
                            <span>Consumed for rent stay (Deducted)</span>
                            <span>- ₱{remainingAdvance.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="pl-4 flex justify-between items-center text-[11px] text-blue-600 font-bold border-t border-slate-200/60 pt-1">
                          <span>Refundable Advance Portion</span>
                          <span>₱{refundableAdvance.toLocaleString()}</span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Detailed Ledger Transaction History */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Deposit & Advance Ledger Transactions</h4>
                    <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100 text-xs space-y-3">
                      {/* Existing Transactions */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Historical Ledger Log</span>
                        {(!db.depositLedger || db.depositLedger.filter(e => e.tenant_id === tenant.id).length === 0) ? (
                          <div className="text-slate-400 font-medium italic text-[11px] pl-2">No historical ledger adjustments recorded.</div>
                        ) : (
                          <div className="space-y-2 divide-y divide-slate-100">
                            {db.depositLedger
                              .filter(e => e.tenant_id === tenant.id)
                              .map((entry) => {
                                const isNegative = ["deposit_deduction", "advance_use", "deposit_refund", "advance_refund"].includes(entry.type);
                                return (
                                  <div key={entry.id} className="pt-2 first:pt-0 flex justify-between items-start gap-2 text-[11px]">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`inline-flex px-1 py-0.2 text-[8px] font-bold rounded uppercase tracking-wide ${
                                          entry.type.startsWith("deposit") ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-blue-50 text-blue-700 border border-blue-100"
                                        }`}>
                                          {entry.type.replace("_", " ")}
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-medium">
                                          {new Date(entry.created_at).toLocaleDateString("en-PH")}
                                        </span>
                                      </div>
                                      <p className="text-slate-600 font-medium leading-normal">{entry.description}</p>
                                    </div>
                                    <span className={`font-mono font-bold ${isNegative ? "text-rose-600" : "text-emerald-600"}`}>
                                      {isNegative ? "-" : "+"} ₱{entry.amount.toLocaleString()}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      {/* Current Settlement Transactions */}
                      <div className="space-y-2 border-t border-dashed border-slate-200 pt-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Proposed Settlement Actions</span>
                        <div className="space-y-2 text-[11px]">
                          {deductedFromDeposit > 0 && (
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-0.5">
                                <span className="inline-flex px-1 py-0.2 text-[8px] font-bold rounded uppercase tracking-wide bg-rose-50 text-rose-700 border border-rose-100">
                                  deposit deduction
                                </span>
                                <p className="text-slate-600 font-medium">Deducted from security deposit to pay outstanding statement bills</p>
                              </div>
                              <span className="font-mono font-bold text-rose-600">- ₱{deductedFromDeposit.toLocaleString()}</span>
                            </div>
                          )}
                          {deductedFromAdvance > 0 && (
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-0.5">
                                <span className="inline-flex px-1 py-0.2 text-[8px] font-bold rounded uppercase tracking-wide bg-rose-50 text-rose-700 border border-rose-100">
                                  advance use
                                </span>
                                <p className="text-slate-600 font-medium">Applied advance rent to cover leftover statement bills</p>
                              </div>
                              <span className="font-mono font-bold text-rose-600">- ₱{deductedFromAdvance.toLocaleString()}</span>
                            </div>
                          )}
                          {advanceIsConsumed && remainingAdvance > 0 && (
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-0.5">
                                <span className="inline-flex px-1 py-0.2 text-[8px] font-bold rounded uppercase tracking-wide bg-rose-50 text-rose-700 border border-rose-100">
                                  advance use
                                </span>
                                <p className="text-slate-600 font-medium">Advance rent consumed for active stay (not refunded)</p>
                              </div>
                              <span className="font-mono font-bold text-rose-600">- ₱{remainingAdvance.toLocaleString()}</span>
                            </div>
                          )}
                          {refundableDeposit > 0 && (
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-0.5">
                                <span className="inline-flex px-1 py-0.2 text-[8px] font-bold rounded uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  deposit refund
                                </span>
                                <p className="text-slate-600 font-medium">Proposed Security Deposit refund to tenant upon move out</p>
                              </div>
                              <span className="font-mono font-bold text-emerald-600">+ ₱{refundableDeposit.toLocaleString()}</span>
                            </div>
                          )}
                          {refundableAdvance > 0 && (
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-0.5">
                                <span className="inline-flex px-1 py-0.2 text-[8px] font-bold rounded uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-100">
                                  advance refund
                                </span>
                                <p className="text-slate-600 font-medium">Proposed Advance Rent refund to tenant upon move out</p>
                              </div>
                              <span className="font-mono font-bold text-blue-600">+ ₱{refundableAdvance.toLocaleString()}</span>
                            </div>
                          )}
                          {deductedFromDeposit === 0 && deductedFromAdvance === 0 && !(advanceIsConsumed && remainingAdvance > 0) && refundableDeposit === 0 && refundableAdvance === 0 && (
                            <p className="text-slate-400 italic text-[11px] pl-2">No settlement adjustments required.</p>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Outstanding Liabilities */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Liabilities Summary</h4>
                    {tenantBills.length === 0 ? (
                      <div className="p-3 bg-emerald-50/50 text-emerald-700 rounded-xl border border-emerald-100 text-xs font-semibold flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>No outstanding statement bills.</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 bg-slate-50/70 rounded-2xl p-4 border border-slate-100 text-xs">
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Total Dues Detected</span>
                          <span className="font-bold">₱{totalUnpaidBills.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-emerald-600">
                          <span>Paid from Security Deposit</span>
                          <span className="font-medium">- ₱{deductedFromDeposit.toLocaleString()}</span>
                        </div>
                        {deductedFromAdvance > 0 && (
                          <div className="flex justify-between items-center text-blue-600">
                            <span>Paid from Advance Rent</span>
                            <span className="font-medium">- ₱{deductedFromAdvance.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center font-bold border-t border-slate-200/65 pt-1.5 text-slate-800">
                          <span>Remaining Unpaid Liability</span>
                          <span className={remainingBillsUnpaid > 0 ? "text-rose-600" : "text-emerald-600"}>
                            ₱{remainingBillsUnpaid.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Settle Summary Callout */}
                  <div className="pt-2 text-xs">
                    {netSettlement >= 0 ? (
                      <div className="bg-emerald-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-md">
                        <div>
                          <span className="text-[9px] uppercase font-black tracking-widest opacity-85 block">Net Settlement Refund</span>
                          <span className="text-2xl font-black">₱{netSettlement.toLocaleString()}</span>
                          <span className="text-[10px] opacity-80 block font-light mt-0.5">Total refundable payout to tenant</span>
                        </div>
                        <div className="p-3 bg-white/10 rounded-xl">
                          <DollarSign className="w-6 h-6" />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-rose-500 text-white p-4 rounded-2xl flex items-center justify-between shadow-md">
                        <div>
                          <span className="text-[9px] uppercase font-black tracking-widest opacity-85 block">Net Outstanding Owed</span>
                          <span className="text-2xl font-black">₱{Math.abs(netSettlement).toLocaleString()}</span>
                          <span className="text-[10px] opacity-80 block font-light mt-0.5">Owed by tenant to landlord</span>
                        </div>
                        <div className="p-3 bg-white/10 rounded-xl">
                          <DollarSign className="w-6 h-6" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-8 pt-8 border-t border-dashed border-slate-200 text-center text-[10px] text-slate-400 font-bold">
                    <div className="space-y-12">
                      <div className="border-b border-slate-200 w-full mx-auto max-w-[140px]" />
                      <div className="uppercase">Property Manager</div>
                    </div>
                    <div className="space-y-12">
                      <div className="border-b border-slate-200 w-full mx-auto max-w-[140px]" />
                      <div className="uppercase">Tenant</div>
                    </div>
                  </div>
                </div>

                {/* Receipt Actions Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => {
                      const printContent = document.getElementById("checkout-receipt-print");
                      const printWindow = window.open("about:blank", "_blank", "left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0");
                      if (printWindow && printContent) {
                        const htmlContent = "<html><head><title>Move-Out Settlement Statement</title>" +
                          "<link href='https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css' rel='stylesheet'>" +
                          "<style>body { font-family: sans-serif; } @media print { body { padding: 0; margin: 0; } }</style></head>" +
                          "<body class='bg-white p-8'><div class='max-w-md mx-auto'>" +
                          printContent.innerHTML +
                          "</div><script>setTimeout(() => { window.print(); window.close(); }, 500);</script></body></html>";
                        printWindow.document.write(htmlContent);
                        printWindow.document.close();
                      } else {
                        window.print();
                      }
                    }}
                    className="flex-1 py-2.5 px-3 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Statement</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const msgText = `📜 MOVE-OUT SETTLEMENT STATEMENT\n` +
                        `🏢 ${aptName} (Room ${roomNum})\n` +
                        `👤 Tenant: ${tenant.name}\n` +
                        `📅 Date: ${currentDate}\n` +
                        `-----------------------------------\n` +
                        `🛡️ Security Deposit Held: ₱${depBal.toLocaleString()}\n` +
                        (deductedFromDeposit > 0 ? `🔻 Unpaid Bills Deducted: -₱${deductedFromDeposit.toLocaleString()}\n` : '') +
                        `💳 Advance Rent Held: ₱${advBal.toLocaleString()}\n` +
                        (deductedFromAdvance > 0 ? `🔻 Bills Deducted from Advance: -₱${deductedFromAdvance.toLocaleString()}\n` : '') +
                        (advanceIsConsumed ? `🔻 Advance Consumed for Stay: -₱${remainingAdvance.toLocaleString()}\n` : '') +
                        `-----------------------------------\n` +
                        `💰 NET SETTLEMENT AMOUNT: ${netSettlement >= 0 ? `₱${netSettlement.toLocaleString()} (Refund to Tenant)` : `₱${Math.abs(netSettlement).toLocaleString()} (Due from Tenant)`}\n\n` +
                        `Official Lease Closure Statement. Thank you!`;
                      setMessengerSummaryText(msgText);
                      setMessengerTenantName(tenant.name);
                      const mUrl = tenant.messenger_psid 
                        ? (tenant.messenger_psid.startsWith("http") ? tenant.messenger_psid : `https://www.messenger.com/t/${tenant.messenger_psid}`)
                        : "https://www.messenger.com";
                      setMessengerUrl(mUrl);
                      setShowMessengerModal(true);
                      setMessengerCopySuccess(false);
                      try {
                        navigator.clipboard.writeText(msgText);
                        setMessengerCopySuccess(true);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4 fill-white text-blue-600" />
                    <span>Send to Messenger</span>
                  </button>
                  
                  <button
                    onClick={handleSettleReceipt}
                    disabled={isSettling}
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSettling ? "Settling..." : "Settle & Move Out"}</span>
                  </button>

                  <button
                    onClick={() => setCheckoutReceiptTenant(null)}
                    className="py-2.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Messenger Share Modal */}
      <AnimatePresence>
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
                    <h3 className="font-extrabold text-slate-900 text-base">Send Transaction to Messenger</h3>
                    <p className="text-xs text-slate-500">Ledger receipt generated for {messengerTenantName}</p>
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
                  <span>Transaction receipt copied to clipboard! Paste directly into the tenant's Messenger chat.</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1">Prepared Ledger Receipt Message</label>
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
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(messengerSummaryText);
                      setMessengerCopySuccess(true);
                      setTimeout(() => setMessengerCopySuccess(false), 3000);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>{messengerCopySuccess ? "Copied Again!" : "Copy Text"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.open(messengerUrl, "_blank", "noopener,noreferrer");
                  }}
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Messenger</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
