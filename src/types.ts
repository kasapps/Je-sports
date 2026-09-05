export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  current_debt: number;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category_id?: string;
  category_name?: string;
  sale_price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  unit: string;
  description?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface SaleItem {
  id?: string;
  sale_id?: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity: number;
  price: number;
  cost: number;
}

export interface Sale {
  id: string;
  customer_id?: string | null;
  customer_name?: string;
  total: number;
  subtotal: number;
  discount: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  payment_method?: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT' | string;
  items: SaleItem[];
  seller_id?: string;
  seller_name?: string;
  notes?: string;
  created_at: string;
  closed_at?: string | null;
}

export interface Debt {
  id: string;
  customer_id: string;
  customer_name: string;
  sale_id?: string;
  total_amount: number;
  remaining_amount: number;
  status: 'ACTIVE' | 'PAID' | 'CANCELLED';
  created_at: string;
  sale_date?: string;
  updated_at?: string;
}

export interface Payment {
  id: string;
  debt_id?: string;
  sale_id?: string;
  customer_id?: string;
  amount: number;
  method?: string;
  payment_method?: string;
  notes?: string;
  note?: string;
  date: string;
  created_at?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  registered_by?: string;
  created_at?: string;
}

export interface DailyClosing {
  id: string;
  date: string;
  expected_cash: number;
  physical_cash: number;
  discrepancy: number;
  initial_cash?: number;
  total_sales?: number;
  total_expenses?: number;
  cash_in_drawer?: number;
  difference?: number;
  notes?: string;
  closed_by?: string;
  closed_at?: string;
  created_at?: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name?: string;
  type: 'IN' | 'OUT' | 'SALE' | 'ADJUST' | 'CANCEL_SALE' | string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_id?: string;
  reason?: string;
  notes?: string;
  date: string;
  created_at?: string;
}

export interface User {
  id: string;
  email?: string;
  username: string;
  role: 'admin' | 'seller';
}

export type Profile = User;
