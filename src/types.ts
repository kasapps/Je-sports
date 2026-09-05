export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  current_debt?: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category_id: string;
  category_name?: string;
  sale_price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  unit: string;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
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
  customer_id?: string;
  customer_name?: string;
  total: number;
  subtotal: number;
  discount: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  created_at: string;
  closed_at?: string;
  items?: SaleItem[];
}

export interface Debt {
  id: string;
  customer_id: string;
  customer_name: string;
  sale_id: string;
  total_amount: number;
  remaining_amount: number;
  status: 'ACTIVE' | 'PAID';
  created_at: string;
  sale_date: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'seller';
}
