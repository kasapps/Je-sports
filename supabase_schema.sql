-- =====================================================
-- KAS SPORT - SUPABASE POSTGRESQL SCHEMA
-- Ejecuta este script en el Editor SQL de tu proyecto en Supabase
-- =====================================================

-- 1. Categorías
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Clientes
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    current_debt NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Productos
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT DEFAULT '',
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name TEXT DEFAULT 'General',
    sale_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    min_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unit TEXT DEFAULT 'pieza',
    description TEXT DEFAULT '',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ventas
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT DEFAULT 'Cliente General',
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'CLOSED', -- 'OPEN', 'CLOSED', 'CANCELLED'
    payment_method TEXT DEFAULT 'EFECTIVO', -- 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO'
    items JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Items de Ventas
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    sku TEXT DEFAULT '',
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Deudas / Cuentas por Cobrar
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAID'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sale_date TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Pagos / Abonos a Deudas
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID REFERENCES public.debts(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'EFECTIVO',
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Gastos
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category TEXT DEFAULT 'General',
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Cortes Diarios / Cierre de Caja
CREATE TABLE IF NOT EXISTS public.daily_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE DEFAULT CURRENT_DATE,
    initial_cash NUMERIC(12, 2) DEFAULT 0,
    total_sales NUMERIC(12, 2) DEFAULT 0,
    total_expenses NUMERIC(12, 2) DEFAULT 0,
    cash_in_drawer NUMERIC(12, 2) DEFAULT 0,
    difference NUMERIC(12, 2) DEFAULT 0,
    notes TEXT DEFAULT '',
    closed_by TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Movimientos de Inventario (Kardex)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'IN', 'OUT', 'ADJUST'
    quantity NUMERIC(12, 2) NOT NULL,
    previous_stock NUMERIC(12, 2) NOT NULL,
    new_stock NUMERIC(12, 2) NOT NULL,
    reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Habilitar Row Level Security (RLS) y Políticas Públicas/Autenticadas
-- =====================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura y escritura para usuarios autenticados / anon key
CREATE POLICY "Permitir acceso completo a categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso completo a customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso completo a products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso completo a sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso completo a sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso completo a debts" ON public.debts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso completo a payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso completo a expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso completo a daily_closings" ON public.daily_closings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso completo a inventory_movements" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime para tablas principales (opcional pero recomendado)
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
