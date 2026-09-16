export interface Apartment {
  id: string;
  name: string;
  address: string;
  total_floors: number;
  description: string;
  status: 'active' | 'inactive';
}

export interface Room {
  id: string;
  apartment_id: string;
  room_number: string;
  floor: number;
  status: 'vacant' | 'occupied' | 'maintenance';
  tenant_id?: string;
  rent_amount: number;
  room_type: 'studio' | '1BR' | '2BR' | '3BR';
  description: string;
  amenities: string; // comma-separated string
  image_url: string;
  is_newly_available: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  contact: string;
  email: string;
  room_id: string;
  apartment_id: string;
  rent_amount: number;
  deposit: number;
  advance_payment?: number;
  deposit_balance?: number;
  advance_balance?: number;
  messenger_psid: string;
  facebook_psid?: string;
  status: 'active' | 'inactive' | 'moved_out';
  move_in_date: string;
}

export interface BillingRecord {
  id: string;
  tenant_id: string;
  tenant_name: string;
  room_id: string;
  room_number: string;
  apartment_id: string;
  rent_amount: number;
  electricity_amount: number;
  electricity_usage: number; // in kWh
  water_amount?: number;
  water_usage?: number; // in cubic meters (m³)
  total_amount: number;
  billing_month: string; // e.g., "June 2026"
  due_date: string;
  payment_status: 'unpaid' | 'paid' | 'overdue' | 'partial';
  bill_image_url?: string;
  notes: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  tenant_name: string;
  billing_id?: string;
  message: string;
  type: 'billing' | 'reminder' | 'overdue' | 'general';
  status: 'sent' | 'pending' | 'failed';
  channel: 'in_app' | 'email' | 'messenger';
  created_at: string;
}

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  room_id: string;
  room_number: string;
  apartment_name: string;
  message: string;
  preferred_visit_date: string;
  status: 'new' | 'contacted' | 'closed';
  created_at: string;
}

export interface MaintenanceRequest {
  id: string;
  room_id?: string;
  room_number?: string;
  tenant_id?: string;
  tenant_name?: string;
  issue_description: string;
  category: 'Plumbing' | 'Electrical' | 'Internet' | 'Air Conditioning' | 'Furniture' | 'Cleaning' | 'Other';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  photo_url?: string;
  occurred_at?: string;
  location?: string;
  messenger_psid?: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface Rule {
  id: string;
  rule_text: string;
  category?: string;
}

export interface DepositLedgerEntry {
  id: string;
  tenant_id: string;
  tenant_name: string;
  type: 'deposit_payment' | 'deposit_refund' | 'deposit_deduction' | 'advance_payment' | 'advance_use' | 'advance_refund';
  amount: number;
  description: string;
  created_at: string;
}

export interface TransactionLog {
  id: string;
  timestamp: string;
  category: 'payment' | 'billing' | 'deposit' | 'tenant' | 'room' | 'apartment' | 'maintenance' | 'system';
  action?: 'create' | 'update' | 'delete' | 'payment' | 'move_in' | 'move_out' | 'status_change';
  title: string;
  details: string;
  amount?: number;
  tenant_id?: string;
  tenant_name?: string;
  room_number?: string;
  performed_by: string;
}



