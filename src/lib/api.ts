import { Apartment, Room, Tenant, BillingRecord, Notification, Inquiry, MaintenanceRequest, Announcement, Rule, DepositLedgerEntry, TransactionLog } from "../types";

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
  // Fetch full state
  async getDB(): Promise<DBState> {
    const res = await fetch("/api/db");
    if (!res.ok) throw new Error("Failed to fetch database state");
    return res.json();
  },

  // Auth login
  async login(username: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      const err: any = new Error(data.message || "Login failed");
      err.data = data;
      throw err;
    }
    return data;
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
    const res = await fetch("/api/apartments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateApartment(id: string, data: Partial<Apartment>): Promise<Apartment> {
    const res = await fetch(`/api/apartments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Rooms CRUD
  async createRoom(data: Partial<Room>): Promise<Room> {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateRoom(id: string, data: Partial<Room>): Promise<Room> {
    const res = await fetch(`/api/rooms/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Tenants CRUD
  async createTenant(data: Partial<Tenant>): Promise<Tenant> {
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant> {
    const res = await fetch(`/api/tenants/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async moveOutTenant(id: string): Promise<Tenant> {
    const res = await fetch(`/api/tenants/${id}/move-out`, {
      method: "POST"
    });
    return res.json();
  },

  // Billing CRUD
  async createBilling(data: Partial<BillingRecord>): Promise<BillingRecord> {
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateBilling(id: string, data: Partial<BillingRecord>): Promise<BillingRecord> {
    const res = await fetch(`/api/billing/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async payBilling(id: string): Promise<BillingRecord> {
    const res = await fetch(`/api/billing/${id}/pay`, {
      method: "POST"
    });
    return res.json();
  },

  // Inquiries CRUD
  async createInquiry(data: Partial<Inquiry>): Promise<Inquiry> {
    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateInquiry(id: string, data: Partial<Inquiry>): Promise<Inquiry> {
    const res = await fetch(`/api/inquiries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // File upload
  async uploadFile(name: string, base64: string): Promise<{ url: string }> {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, base64 })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to upload file");
    }
    return res.json();
  },

  // Maintenance Requests CRUD
  async createMaintenanceRequest(data: Partial<MaintenanceRequest>): Promise<MaintenanceRequest> {
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create maintenance request");
    return res.json();
  },

  async updateMaintenanceRequest(id: string, data: Partial<MaintenanceRequest>): Promise<MaintenanceRequest> {
    const res = await fetch(`/api/maintenance/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update maintenance request");
    return res.json();
  },

  // Announcements CRUD
  async createAnnouncement(data: Partial<Announcement>): Promise<Announcement> {
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create announcement");
    return res.json();
  },

  async deleteAnnouncement(id: string): Promise<any> {
    const res = await fetch(`/api/announcements/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete announcement");
    return res.json();
  },

  // Rules CRUD
  async createRule(data: Partial<Rule>): Promise<Rule> {
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create rule");
    return res.json();
  },

  async deleteRule(id: string): Promise<any> {
    const res = await fetch(`/api/rules/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete rule");
    return res.json();
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
    const res = await fetch("/api/chatbot/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, tenantId, history })
    });
    if (!res.ok) throw new Error("Chatbot failed to respond");
    return res.json();
  },

  // Record Deposit/Advance transaction ledger entry
  async recordTenantLedger(id: string, data: { type: string; amount: number; description: string }): Promise<any> {
    const res = await fetch(`/api/tenants/${id}/ledger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to record ledger transaction");
    }
    return res.json();
  },

  // Get all ledger entries
  async getLedger(): Promise<any[]> {
    const res = await fetch("/api/ledger");
    if (!res.ok) throw new Error("Failed to fetch ledger");
    return res.json();
  },

  // Update ledger description
  async updateLedger(id: string, description: string): Promise<any> {
    const res = await fetch(`/api/ledger/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description })
    });
    if (!res.ok) throw new Error("Failed to update ledger entry");
    return res.json();
  },

  // Delete/reverse a ledger entry
  async deleteLedger(id: string): Promise<any> {
    const res = await fetch(`/api/ledger/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete ledger entry");
    return res.json();
  },

  // Clear transaction logs
  async clearLogs(): Promise<any> {
    const res = await fetch("/api/logs/clear", {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to clear logs");
    return res.json();
  }
};

