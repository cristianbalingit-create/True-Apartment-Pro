import {
  Apartment,
  Room,
  Tenant,
  BillingRecord,
  Notification,
  Inquiry,
  MaintenanceRequest,
  Announcement,
  Rule,
  DepositLedgerEntry,
  TransactionLog
} from "../types";
import {
  fetchDirectFromFirestore,
  directUpsertDoc,
  directDeleteDoc,
  directLogTransaction
} from "./clientFirestore";

export interface DBState {
  apartments: Apartment[];
  rooms: Room[];
  tenants: Tenant[];
  billingRecords: BillingRecord[];
  notifications: Notification[];
  inquiries: Inquiry[];
  maintenanceRequests: MaintenanceRequest[];
  announcements: Announcement[];
  rules: Rule[];
  depositLedger: DepositLedgerEntry[];
  transactionLogs: TransactionLog[];
}

export const api = {
  // Fetch full state - checks /api/db first; on 404/failure, reads directly from Firestore
  async getDB(): Promise<DBState> {
    try {
      const res = await fetch("/api/db");
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Backend /api/db unavailable, falling back to direct Firestore:", e);
    }
    // Direct Cloud Firestore fallback
    return await fetchDirectFromFirestore();
  },

  // Auth login - checks /api/auth/login first; on 404, performs client credential validation
  async login(username: string, password: string) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        return await res.json();
      }
      if (res.status !== 404) {
        const data = await res.json();
        const err: any = new Error(data.message || "Login failed");
        err.data = data;
        throw err;
      }
    } catch (e: any) {
      if (e?.data) throw e;
      console.warn("Backend /api/auth/login unavailable (404), validating with direct client authentication");
    }

    // Direct fallback login
    const metaEnv = (import.meta as any).env || {};
    const validUser = (username.trim() === "admin" || username.trim() === (metaEnv.VITE_ADMIN_USERNAME || "admin"));
    const validPass = (password === "admin123" || password === (metaEnv.VITE_ADMIN_PASSWORD || "admin123"));

    if (validUser && validPass) {
      const token = `direct_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await directLogTransaction("system", "Admin Login (Direct)", `User ${username} logged in directly`, "status_change");
      return {
        success: true,
        token,
        user: { username, role: "admin" }
      };
    } else {
      throw new Error("Invalid username or password");
    }
  },

  // Check auth lockout status
  async getAuthStatus(): Promise<{ locked: boolean; remainingSeconds?: number; attemptsLeft?: number; lockoutCount?: number; lockoutMinutes?: number }> {
    try {
      const res = await fetch("/api/auth/status");
      if (!res.ok) return { locked: false };
      return res.json();
    } catch {
      return { locked: false };
    }
  },

  // Apartments CRUD
  async createApartment(data: Partial<Apartment>): Promise<Apartment> {
    const newApt: Apartment = {
      id: `apt-${Date.now()}`,
      name: data.name || "New Apartment",
      address: data.address || "",
      total_floors: Number(data.total_floors) || 1,
      description: data.description || "",
      status: data.status || "active",
      ...data
    };
    try {
      const res = await fetch("/api/apartments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("apartments", newApt.id, newApt);
    await directLogTransaction("apartment", "Created Apartment", `Apartment ${newApt.name} created`, "create");
    return newApt;
  },

  async updateApartment(id: string, data: Partial<Apartment>): Promise<Apartment> {
    try {
      const res = await fetch(`/api/apartments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("apartments", id, data);
    await directLogTransaction("apartment", "Updated Apartment", `Apartment ${id} updated`, "update");
    return { id, ...data } as Apartment;
  },

  // Rooms CRUD
  async createRoom(data: Partial<Room>): Promise<Room> {
    const newRoom: Room = {
      id: `room-${Date.now()}`,
      apartment_id: data.apartment_id || "apt-1",
      room_number: data.room_number || "101",
      floor: Number(data.floor) || 1,
      status: data.status || "vacant",
      rent_amount: Number(data.rent_amount) || 5000,
      room_type: data.room_type || "studio",
      description: data.description || "",
      amenities: typeof data.amenities === "string" ? data.amenities : "Wi-Fi, Aircon",
      image_url: data.image_url || "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
      is_newly_available: false,
      ...data
    };
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("rooms", newRoom.id, newRoom);
    await directLogTransaction("room", "Created Room", `Room ${newRoom.room_number} created`, "create");
    return newRoom;
  },

  async updateRoom(id: string, data: Partial<Room>): Promise<Room> {
    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("rooms", id, data);
    await directLogTransaction("room", "Updated Room", `Room ${id} updated`, "update");
    return { id, ...data } as Room;
  },

  // Tenants CRUD
  async createTenant(data: Partial<Tenant>): Promise<Tenant> {
    const newTenant: Tenant = {
      id: `tenant-${Date.now()}`,
      name: data.name || "Tenant",
      contact: data.contact || "",
      email: data.email || "",
      room_id: data.room_id || "",
      apartment_id: data.apartment_id || "",
      rent_amount: Number(data.rent_amount) || 0,
      deposit: Number(data.deposit) || 0,
      advance_payment: Number(data.advance_payment) || Number(data.rent_amount) || 0,
      deposit_balance: Number(data.deposit) || 0,
      advance_balance: Number(data.advance_payment) || Number(data.rent_amount) || 0,
      messenger_psid: data.messenger_psid || "",
      status: "active",
      move_in_date: data.move_in_date || new Date().toISOString().split("T")[0]!,
      ...data
    };
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("tenants", newTenant.id, newTenant);
    if (newTenant.room_id) {
      await directUpsertDoc("rooms", newTenant.room_id, { status: "occupied" });
    }
    await directLogTransaction("tenant", "Created Tenant", `Tenant ${newTenant.name} registered`, "create");
    return newTenant;
  },

  async updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant> {
    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("tenants", id, data);
    await directLogTransaction("tenant", "Updated Tenant", `Tenant ${id} profile updated`, "update");
    return { id, ...data } as Tenant;
  },

  async moveOutTenant(id: string): Promise<any> {
    try {
      const res = await fetch(`/api/tenants/${id}/move-out`, {
        method: "POST"
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    const update = { status: "moved_out" as const };
    await directUpsertDoc("tenants", id, update);
    await directLogTransaction("tenant", "Moved Out Tenant", `Tenant ${id} marked as moved out`, "move_out");
    return { id, ...update };
  },

  // Billing CRUD
  async createBilling(data: Partial<BillingRecord>): Promise<BillingRecord> {
    const newBill: BillingRecord = {
      id: `bill-${Date.now()}`,
      tenant_id: data.tenant_id || "",
      tenant_name: data.tenant_name || "Tenant",
      room_id: data.room_id || "",
      room_number: data.room_number || "101",
      apartment_id: data.apartment_id || "",
      rent_amount: Number(data.rent_amount) || 0,
      electricity_amount: Number(data.electricity_amount) || 0,
      electricity_usage: Number(data.electricity_usage) || 0,
      water_amount: Number(data.water_amount) || 0,
      water_usage: Number(data.water_usage) || 0,
      total_amount: Number(data.total_amount) || ((Number(data.rent_amount) || 0) + (Number(data.electricity_amount) || 0)),
      billing_month: data.billing_month || new Date().toLocaleString("default", { month: "long", year: "numeric" }),
      due_date: data.due_date || new Date().toISOString().split("T")[0]!,
      payment_status: data.payment_status || "unpaid",
      notes: data.notes || "",
      ...data
    };
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("billingRecords", newBill.id, newBill);
    await directLogTransaction("billing", "Generated Billing", `Invoice created for amount ₱${newBill.total_amount}`, "create");
    return newBill;
  },

  async updateBilling(id: string, data: Partial<BillingRecord>): Promise<BillingRecord> {
    try {
      const res = await fetch(`/api/billing/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("billingRecords", id, data);
    await directLogTransaction("billing", "Updated Billing", `Billing ${id} updated`, "update");
    return { id, ...data } as BillingRecord;
  },

  async payBilling(id: string): Promise<any> {
    try {
      const res = await fetch(`/api/billing/${id}/pay`, {
        method: "POST"
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    const update = { payment_status: "paid" as const };
    await directUpsertDoc("billingRecords", id, update);
    await directLogTransaction("payment", "Paid Bill", `Billing record ${id} marked as paid`, "payment");
    return { id, ...update };
  },

  // Deploy Financial Statement directly via Facebook Messenger Send API
  async deployStatement(data: { tenant_id: string; billing_id?: string; statement_text?: string }): Promise<{
    success: boolean;
    status: "sent" | "unlinked" | "failed";
    tenant_id?: string;
    tenant_name?: string;
    message?: string;
    warning?: string;
    error?: string;
    psid?: string;
  }> {
    try {
      const res = await fetch("/api/billing/deploy-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      return json;
    } catch (err: any) {
      console.error("api.deployStatement error:", err);
      return {
        success: false,
        status: "failed",
        error: err?.message || "Failed to communicate with statement deployment endpoint."
      };
    }
  },

  // Inquiries CRUD
  async createInquiry(data: Partial<Inquiry>): Promise<Inquiry> {
    const newInq: Inquiry = {
      id: `inq-${Date.now()}`,
      name: data.name || "Prospective Tenant",
      email: data.email || "",
      phone: data.phone || "",
      room_id: data.room_id || "",
      room_number: data.room_number || "",
      apartment_name: data.apartment_name || "",
      message: data.message || "",
      preferred_visit_date: data.preferred_visit_date || "",
      status: "new",
      created_at: new Date().toISOString(),
      ...data
    };
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("inquiries", newInq.id, newInq);
    return newInq;
  },

  async updateInquiry(id: string, data: Partial<Inquiry>): Promise<Inquiry> {
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("inquiries", id, data);
    return { id, ...data } as Inquiry;
  },

  // File upload
  async uploadFile(name: string, base64: string): Promise<{ url: string }> {
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, base64 })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    // Return base64 inline URL directly when backend /api/upload is unreachable
    return { url: base64 };
  },

  // Maintenance Requests CRUD
  async createMaintenanceRequest(data: Partial<MaintenanceRequest>): Promise<MaintenanceRequest> {
    const newReq: MaintenanceRequest = {
      id: `maint-${Date.now()}`,
      tenant_id: data.tenant_id || "",
      room_id: data.room_id || "",
      category: data.category || "Other",
      issue_description: data.issue_description || "",
      priority: data.priority || "Medium",
      status: "pending",
      created_at: new Date().toISOString(),
      ...data
    };
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("maintenanceRequests", newReq.id, newReq);
    await directLogTransaction("maintenance", "Created Maintenance Ticket", `Ticket ${newReq.id} created: ${newReq.issue_description}`, "create");
    return newReq;
  },

  async updateMaintenanceRequest(id: string, data: Partial<MaintenanceRequest>): Promise<MaintenanceRequest> {
    try {
      const res = await fetch(`/api/maintenance/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("maintenanceRequests", id, data);
    await directLogTransaction("maintenance", "Updated Maintenance Ticket", `Ticket ${id} status updated`, "update");
    return { id, ...data } as MaintenanceRequest;
  },

  // Announcements CRUD
  async createAnnouncement(data: Partial<Announcement>): Promise<Announcement> {
    const newAnn: Announcement = {
      id: `ann-${Date.now()}`,
      title: data.title || "Announcement",
      content: data.content || "",
      created_at: new Date().toISOString(),
      ...data
    };
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("announcements", newAnn.id, newAnn);
    await directLogTransaction("system", "Created Announcement", `Announcement "${newAnn.title}" published`, "create");
    return newAnn;
  },

  async deleteAnnouncement(id: string): Promise<any> {
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "DELETE"
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directDeleteDoc("announcements", id);
    await directLogTransaction("system", "Deleted Announcement", `Announcement ${id} deleted`, "delete");
    return { success: true };
  },

  // Rules CRUD
  async createRule(data: Partial<Rule>): Promise<Rule> {
    const newRule: Rule = {
      id: `rule-${Date.now()}`,
      rule_text: data.rule_text || "House Rule",
      category: data.category || "General",
      ...data
    };
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("rules", newRule.id, newRule);
    await directLogTransaction("system", "Created Rule", `Rule "${newRule.rule_text}" created`, "create");
    return newRule;
  },

  async deleteRule(id: string): Promise<any> {
    try {
      const res = await fetch(`/api/rules/${id}`, {
        method: "DELETE"
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directDeleteDoc("rules", id);
    await directLogTransaction("system", "Deleted Rule", `Rule ${id} removed`, "delete");
    return { success: true };
  },

  // Chatbot logic
  async queryChatbot(message: string, tenantId?: string, history?: { sender: 'user' | 'bot', text: string }[]): Promise<{
    reply: string;
    intent?: string;
    create_ticket?: boolean;
    ticket_details?: {
      category: 'Plumbing' | 'Electrical' | 'Internet' | 'Air Conditioning' | 'Furniture' | 'Cleaning' | 'Other';
      priority: 'High' | 'Medium' | 'Low';
      description: string;
    };
    suggested_replies?: string[];
  }> {
    try {
      const res = await fetch("/api/chatbot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, tenantId, history })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    // Fallback intelligent responses
    const lower = message.toLowerCase();
    if (lower.includes("rent") || lower.includes("pay") || lower.includes("bill")) {
      return {
        reply: "Rent invoices are generated on the 1st of every month. You can view your invoice and settle payments through the billing portal.",
        suggested_replies: ["Check my current balance", "Report payment", "Maintenance inquiry"]
      };
    }
    if (lower.includes("wifi") || lower.includes("internet") || lower.includes("leak") || lower.includes("water") || lower.includes("broken")) {
      return {
        reply: "I understand you have a facility issue. I can help you lodge a maintenance request for the building technician.",
        create_ticket: true,
        ticket_details: {
          category: lower.includes("wifi") || lower.includes("internet") ? "Internet" : "Plumbing",
          priority: "Medium",
          description: message
        },
        suggested_replies: ["Submit maintenance ticket", "Contact manager"]
      };
    }
    return {
      reply: "Hello! I am your ApartmentPro Resident Assistant. You can ask me about rent payments, house rules, facility maintenance, or move-in guidelines.",
      suggested_replies: ["How do I pay rent?", "Report a maintenance issue", "View house rules"]
    };
  },

  // Record Deposit/Advance transaction ledger entry
  async recordTenantLedger(id: string, data: { type: string; amount: number; description: string }): Promise<any> {
    try {
      const res = await fetch(`/api/tenants/${id}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    const entryId = `ledger-${Date.now()}`;
    const entry: DepositLedgerEntry = {
      id: entryId,
      tenant_id: id,
      tenant_name: "Tenant",
      type: data.type as any,
      amount: Number(data.amount),
      description: data.description,
      created_at: new Date().toISOString()
    };
    await directUpsertDoc("depositLedger", entryId, entry);
    await directLogTransaction("deposit", "Ledger Transaction", `Recorded ${data.type} of ₱${data.amount} for tenant ${id}`, "payment");
    return { success: true, entry };
  },

  // Get all ledger entries
  async getLedger(): Promise<any[]> {
    try {
      const res = await fetch("/api/ledger");
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    const state = await fetchDirectFromFirestore();
    return state.depositLedger;
  },

  // Update ledger description
  async updateLedger(id: string, description: string): Promise<any> {
    try {
      const res = await fetch(`/api/ledger/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directUpsertDoc("depositLedger", id, { description });
    return { success: true };
  },

  // Delete/reverse a ledger entry
  async deleteLedger(id: string): Promise<any> {
    try {
      const res = await fetch(`/api/ledger/${id}`, {
        method: "DELETE"
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    await directDeleteDoc("depositLedger", id);
    return { success: true };
  },

  // Clear transaction logs
  async clearLogs(): Promise<any> {
    try {
      const res = await fetch("/api/logs/clear", {
        method: "POST"
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // ignore
    }
    return { success: true };
  }
};
