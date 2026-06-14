export type EstimateStatus = "draft" | "approved" | "rejected" | "released";
export type JobOrderStatus = "pending" | "ongoing" | "completed" | "released";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "check" | "other";
export type InventoryTransactionType = "stock_in" | "stock_out" | "adjustment";
export type UnitCategory = "pms" | "minor_repair" | "general_repair" | "body_repair_paint";
export type ExpenseCategory =
  | "shop_expenses" | "food" | "kitchen_supplies" | "electricity" | "water"
  | "internet" | "rent" | "salary_expenses" | "weekly_salary" | "monthly_salary" | "yearly_salary";
export type SaleType = "parts" | "materials" | "labor";
export type RoleName = "owner" | "service_advisor" | "technician" | "cashier";

export interface Shop {
  id: string;
  shop_name: string;
  owner_name: string;
  contact_number: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  shop_id: string | null;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  shop_id: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  shop_id: string;
  customer_number: string;
  full_name: string;
  contact_number: string | null;
  address: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  shop_id: string;
  customer_id: string;
  plate_number: string;
  brand: string;
  unit: string | null;
  model: string;
  year_model: number | null;
  chassis_number: string | null;
  engine_number: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  customers?: Customer;
}

export interface RepairEstimate {
  id: string;
  shop_id: string;
  estimate_number: string;
  estimate_date: string;
  customer_id: string;
  vehicle_id: string;
  chassis_number: string | null;
  engine_number: string | null;
  problem_description: string | null;
  repair_description: string | null;
  recommendation: string | null;
  technician_name: string | null;
  labor_cost: number;
  parts_cost: number;
  total_cost: number;
  status: EstimateStatus;
  created_at: string;
  updated_at: string;
  customers?: Customer;
  vehicles?: Vehicle;
  repair_estimate_items?: RepairEstimateItem[];
}

export interface RepairEstimateItem {
  id: string;
  shop_id: string;
  estimate_id: string;
  part_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  inventory_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobOrder {
  id: string;
  shop_id: string;
  job_order_number: string;
  estimate_id: string | null;
  customer_id: string;
  vehicle_id: string;
  assigned_technician: string | null;
  date_started: string | null;
  date_completed: string | null;
  status: JobOrderStatus;
  repair_description: string | null;
  created_at: string;
  updated_at: string;
  customers?: Customer;
  vehicles?: Vehicle;
  repair_estimates?: RepairEstimate | null;
  job_order_parts?: JobOrderPart[];
}

export interface JobOrderPart {
  id: string;
  shop_id: string;
  job_order_id: string;
  inventory_item_id: string | null;
  part_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  shop_id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  vehicle_id: string;
  job_order_id: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  repair_description: string | null;
  recommendation: string | null;
  parts_used: string | null;
  labor_cost: number;
  parts_cost: number;
  total_amount: number;
  amount_paid: number;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  technician_name: string | null;
  verification_code: string;
  created_at: string;
  updated_at: string;
  customers?: Customer;
  vehicles?: Vehicle;
  invoice_items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  shop_id: string;
  invoice_id: string;
  inventory_item_id: string | null;
  part_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  shop_id: string;
  part_number: string;
  part_name: string;
  category: string | null;
  quantity: number;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  supplier: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  shop_id: string;
  inventory_item_id: string;
  transaction_type: InventoryTransactionType;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  inventory_items?: InventoryItem;
}

export interface UnitReceived {
  id: string;
  shop_id: string;
  received_date: string;
  category: UnitCategory;
  customer_id: string | null;
  vehicle_id: string | null;
  job_order_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  shop_id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesRecord {
  id: string;
  shop_id: string;
  sale_date: string;
  sale_type: SaleType;
  description: string | null;
  amount: number;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  dailyUnitsReceived: number;
  monthlyUnitsReceived: number;
  activeRepairs: number;
  pendingEstimates: number;
  pendingInvoices: number;
  lowStockItems: number;
  dailySales: number;
  monthlySales: number;
  monthlyExpenses: number;
  netProfit: number;
}

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      shops: TableDef<Shop>;
      roles: TableDef<Role>;
      profiles: TableDef<Profile>;
      user_roles: TableDef<UserRole>;
      customers: TableDef<Customer>;
      vehicles: TableDef<Vehicle>;
      repair_estimates: TableDef<RepairEstimate>;
      repair_estimate_items: TableDef<RepairEstimateItem>;
      job_orders: TableDef<JobOrder>;
      job_order_parts: TableDef<JobOrderPart>;
      invoices: TableDef<Invoice>;
      invoice_items: TableDef<InvoiceItem>;
      inventory_items: TableDef<InventoryItem>;
      inventory_transactions: TableDef<InventoryTransaction>;
      units_received: TableDef<UnitReceived>;
      expenses: TableDef<Expense>;
      sales_records: TableDef<SalesRecord>;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
