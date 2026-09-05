-- ==============================================================================
-- KAS SPORT - MIGRACIÓN CANÓNICA COMPLETA PARA SUPABASE POSTGRESQL
-- Script idempotente y seguro: crea perfiles, alinea columnas, crea funciones RPC
-- atómicas, activa RLS estricto (sin acceso anónimo) y habilita Realtime.
-- ==============================================================================

-- 0. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA PROFILES (Vinculada a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    username TEXT,
    role TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('admin', 'seller')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    current_debt NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA PRODUCTS
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

-- 5. TABLA SALES
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT DEFAULT 'Público General',
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    payment_method TEXT DEFAULT 'CASH',
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    seller_name TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 6. TABLA SALE_ITEMS
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

-- 7. TABLA DEBTS (Cuentas por cobrar)
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAID', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sale_date TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLA PAYMENTS (Abonos y cobros)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    method TEXT DEFAULT 'CASH',
    payment_method TEXT DEFAULT 'CASH',
    notes TEXT DEFAULT '',
    note TEXT DEFAULT '',
    date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABLA EXPENSES (Gastos de operación)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category TEXT DEFAULT 'General',
    date TIMESTAMPTZ DEFAULT NOW(),
    registered_by TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABLA DAILY_CLOSINGS (Cortes diarios de caja)
CREATE TABLE IF NOT EXISTS public.daily_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT NOT NULL,
    expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    physical_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discrepancy NUMERIC(12, 2) NOT NULL DEFAULT 0,
    initial_cash NUMERIC(12, 2) DEFAULT 0,
    total_sales NUMERIC(12, 2) DEFAULT 0,
    total_expenses NUMERIC(12, 2) DEFAULT 0,
    cash_in_drawer NUMERIC(12, 2) DEFAULT 0,
    difference NUMERIC(12, 2) DEFAULT 0,
    notes TEXT DEFAULT '',
    closed_by TEXT DEFAULT '',
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABLA INVENTORY_MOVEMENTS (Kardex)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT DEFAULT '',
    type TEXT NOT NULL, -- 'IN', 'OUT', 'SALE', 'ADJUST', 'CANCEL_SALE'
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    previous_stock NUMERIC(12, 2) DEFAULT 0,
    new_stock NUMERIC(12, 2) DEFAULT 0,
    reference_id UUID DEFAULT NULL,
    reason TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- MIGRACIÓN DE COLUMNAS IDEMPOTENTE (Garantiza columnas requeridas sin romper datos)
-- ==============================================================================
DO $$ 
BEGIN
    -- Customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='current_debt') THEN
        ALTER TABLE public.customers ADD COLUMN current_debt NUMERIC(12, 2) DEFAULT 0;
    END IF;

    -- Products
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sku') THEN
        ALTER TABLE public.products ADD COLUMN sku TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sale_price') THEN
        ALTER TABLE public.products ADD COLUMN sale_price NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='cost_price') THEN
        ALTER TABLE public.products ADD COLUMN cost_price NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='stock') THEN
        ALTER TABLE public.products ADD COLUMN stock NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='min_stock') THEN
        ALTER TABLE public.products ADD COLUMN min_stock NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='unit') THEN
        ALTER TABLE public.products ADD COLUMN unit TEXT DEFAULT 'PZA';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='barcode') THEN
        ALTER TABLE public.products ADD COLUMN barcode TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_name') THEN
        ALTER TABLE public.products ADD COLUMN category_name TEXT DEFAULT 'General';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='active') THEN
        ALTER TABLE public.products ADD COLUMN active BOOLEAN DEFAULT TRUE;
    END IF;

    -- Sales
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='items') THEN
        ALTER TABLE public.sales ADD COLUMN items JSONB DEFAULT '[]'::JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='subtotal') THEN
        ALTER TABLE public.sales ADD COLUMN subtotal NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='discount') THEN
        ALTER TABLE public.sales ADD COLUMN discount NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='payment_method') THEN
        ALTER TABLE public.sales ADD COLUMN payment_method TEXT DEFAULT 'CASH';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='seller_id') THEN
        ALTER TABLE public.sales ADD COLUMN seller_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='seller_name') THEN
        ALTER TABLE public.sales ADD COLUMN seller_name TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='closed_at') THEN
        ALTER TABLE public.sales ADD COLUMN closed_at TIMESTAMPTZ;
    END IF;

    -- Debts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='sale_date') THEN
        ALTER TABLE public.debts ADD COLUMN sale_date TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='updated_at') THEN
        ALTER TABLE public.debts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Payments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='method') THEN
        ALTER TABLE public.payments ADD COLUMN method TEXT DEFAULT 'CASH';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='payment_method') THEN
        ALTER TABLE public.payments ADD COLUMN payment_method TEXT DEFAULT 'CASH';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='date') THEN
        ALTER TABLE public.payments ADD COLUMN date TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='notes') THEN
        ALTER TABLE public.payments ADD COLUMN notes TEXT DEFAULT '';
    END IF;

    -- Expenses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='date') THEN
        ALTER TABLE public.expenses ADD COLUMN date TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='category') THEN
        ALTER TABLE public.expenses ADD COLUMN category TEXT DEFAULT 'General';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='registered_by') THEN
        ALTER TABLE public.expenses ADD COLUMN registered_by TEXT DEFAULT '';
    END IF;

    -- Daily Closings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_closings' AND column_name='date') THEN
        ALTER TABLE public.daily_closings ADD COLUMN date TEXT DEFAULT CURRENT_DATE::text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_closings' AND column_name='expected_cash') THEN
        ALTER TABLE public.daily_closings ADD COLUMN expected_cash NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_closings' AND column_name='physical_cash') THEN
        ALTER TABLE public.daily_closings ADD COLUMN physical_cash NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_closings' AND column_name='discrepancy') THEN
        ALTER TABLE public.daily_closings ADD COLUMN discrepancy NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_closings' AND column_name='closed_by') THEN
        ALTER TABLE public.daily_closings ADD COLUMN closed_by TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_closings' AND column_name='closed_at') THEN
        ALTER TABLE public.daily_closings ADD COLUMN closed_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Inventory Movements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='reference_id') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN reference_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='notes') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN notes TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='date') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN date TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- ==============================================================================
-- ÍNDICES PARA RENDIMIENTO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_customer ON public.debts(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_closings_date ON public.daily_closings(date);

-- ==============================================================================
-- FUNCIONES RPC TRANSACCIONALES ATÓMICAS (CERO ESCRITURAS INCONSISTENTES)
-- ==============================================================================

-- 1. Cerrar Venta Atómicamente (descuenta stock, genera kardex, registra pago y deuda)
CREATE OR REPLACE FUNCTION public.close_sale_rpc(
    p_sale_id UUID,
    p_amount_paid NUMERIC,
    p_payment_method TEXT,
    p_discount NUMERIC,
    p_total NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale RECORD;
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC;
    v_price NUMERIC;
    v_cost NUMERIC;
    v_prod_name TEXT;
    v_old_stock NUMERIC;
    v_new_stock NUMERIC;
    v_debt_amount NUMERIC := 0;
BEGIN
    -- Validar que la venta exista y esté ABIERTA
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La venta con ID % no existe.', p_sale_id;
    END IF;

    IF v_sale.status != 'OPEN' THEN
        RAISE EXCEPTION 'La venta ya fue cerrada o cancelada previamente.';
    END IF;

    -- Calcular deuda restante si aplica
    IF p_total > p_amount_paid THEN
        v_debt_amount := p_total - p_amount_paid;
    END IF;

    -- 1. Actualizar estado de la venta
    UPDATE public.sales
    SET status = 'CLOSED',
        total = p_total,
        discount = p_discount,
        payment_method = p_payment_method,
        closed_at = NOW()
    WHERE id = p_sale_id;

    -- 2. Procesar ítems, descontar stock y generar movimientos de inventario
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_sale.items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_qty := COALESCE((v_item->>'quantity')::NUMERIC, 1);
        v_price := COALESCE((v_item->>'price')::NUMERIC, 0);
        v_cost := COALESCE((v_item->>'cost')::NUMERIC, 0);
        v_prod_name := COALESCE(v_item->>'product_name', 'Producto');

        -- Obtener y actualizar stock del producto
        SELECT stock INTO v_old_stock FROM public.products WHERE id = v_prod_id FOR UPDATE;
        IF FOUND THEN
            v_new_stock := v_old_stock - v_qty;
            UPDATE public.products
            SET stock = v_new_stock,
                updated_at = NOW()
            WHERE id = v_prod_id;

            -- Registrar movimiento en kardex
            INSERT INTO public.inventory_movements (
                product_id,
                product_name,
                type,
                quantity,
                previous_stock,
                new_stock,
                reference_id,
                reason,
                notes,
                date
            ) VALUES (
                v_prod_id,
                v_prod_name,
                'SALE',
                -v_qty,
                v_old_stock,
                v_new_stock,
                p_sale_id,
                'Venta en POS',
                'Ticket #' || p_sale_id::text,
                NOW()
            );

            -- Sincronizar sale_items relacional
            INSERT INTO public.sale_items (
                sale_id,
                product_id,
                product_name,
                quantity,
                price,
                cost,
                created_at
            ) VALUES (
                p_sale_id,
                v_prod_id,
                v_prod_name,
                v_qty,
                v_price,
                v_cost,
                NOW()
            );
        END IF;
    END LOOP;

    -- 3. Registrar el pago si hubo importe abonado
    IF p_amount_paid > 0 THEN
        INSERT INTO public.payments (
            sale_id,
            customer_id,
            amount,
            method,
            payment_method,
            notes,
            date,
            created_at
        ) VALUES (
            p_sale_id,
            v_sale.customer_id,
            p_amount_paid,
            p_payment_method,
            p_payment_method,
            'Cobro de venta #' || p_sale_id::text,
            NOW(),
            NOW()
        );
    END IF;

    -- 4. Registrar deuda si hubo saldo pendiente y cliente asociado
    IF v_debt_amount > 0 AND v_sale.customer_id IS NOT NULL THEN
        INSERT INTO public.debts (
            customer_id,
            customer_name,
            sale_id,
            total_amount,
            remaining_amount,
            status,
            created_at,
            sale_date,
            updated_at
        ) VALUES (
            v_sale.customer_id,
            COALESCE(v_sale.customer_name, 'Cliente'),
            p_sale_id,
            p_total,
            v_debt_amount,
            'ACTIVE',
            NOW(),
            NOW(),
            NOW()
        );

        -- Actualizar saldo deudor acumulado del cliente
        UPDATE public.customers
        SET current_debt = COALESCE(current_debt, 0) + v_debt_amount
        WHERE id = v_sale.customer_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', p_sale_id,
        'total', p_total,
        'amount_paid', p_amount_paid,
        'debt_amount', v_debt_amount
    );
END;
$$;

-- 2. Cancelar Venta Atómicamente (revierte stock, kardex y deuda)
CREATE OR REPLACE FUNCTION public.cancel_sale_rpc(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale RECORD;
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC;
    v_prod_name TEXT;
    v_old_stock NUMERIC;
    v_new_stock NUMERIC;
    v_debt RECORD;
BEGIN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta % no encontrada', p_sale_id;
    END IF;

    IF v_sale.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'La venta ya se encuentra cancelada.';
    END IF;

    -- Marcar venta como cancelada
    UPDATE public.sales SET status = 'CANCELLED' WHERE id = p_sale_id;

    -- Revertir stock de cada producto si la venta estaba cerrada
    IF v_sale.status = 'CLOSED' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_sale.items)
        LOOP
            v_prod_id := (v_item->>'product_id')::UUID;
            v_qty := COALESCE((v_item->>'quantity')::NUMERIC, 1);
            v_prod_name := COALESCE(v_item->>'product_name', 'Producto');

            SELECT stock INTO v_old_stock FROM public.products WHERE id = v_prod_id FOR UPDATE;
            IF FOUND THEN
                v_new_stock := v_old_stock + v_qty;
                UPDATE public.products
                SET stock = v_new_stock,
                    updated_at = NOW()
                WHERE id = v_prod_id;

                INSERT INTO public.inventory_movements (
                    product_id,
                    product_name,
                    type,
                    quantity,
                    previous_stock,
                    new_stock,
                    reference_id,
                    reason,
                    notes,
                    date
                ) VALUES (
                    v_prod_id,
                    v_prod_name,
                    'CANCEL_SALE',
                    v_qty,
                    v_old_stock,
                    v_new_stock,
                    p_sale_id,
                    'Venta cancelada',
                    'Reverso de venta #' || p_sale_id::text,
                    NOW()
                );
            END IF;
        END LOOP;

        -- Cancelar deudas vinculadas y ajustar saldo deudor del cliente
        FOR v_debt IN SELECT * FROM public.debts WHERE sale_id = p_sale_id AND status = 'ACTIVE' FOR UPDATE
        LOOP
            UPDATE public.customers
            SET current_debt = GREATEST(0, COALESCE(current_debt, 0) - v_debt.remaining_amount)
            WHERE id = v_debt.customer_id;

            UPDATE public.debts
            SET status = 'CANCELLED',
                remaining_amount = 0,
                updated_at = NOW()
            WHERE id = v_debt.id;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'sale_id', p_sale_id);
END;
$$;

-- 3. Registrar Abono a Deuda Atómicamente
CREATE OR REPLACE FUNCTION public.record_debt_payment_rpc(
    p_debt_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_debt RECORD;
    v_new_remaining NUMERIC;
    v_new_status TEXT;
BEGIN
    SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deuda % no encontrada', p_debt_id;
    END IF;

    IF v_debt.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'La deuda ya está pagada o cancelada.';
    END IF;

    v_new_remaining := GREATEST(0, v_debt.remaining_amount - p_amount);
    v_new_status := CASE WHEN v_new_remaining <= 0 THEN 'PAID' ELSE 'ACTIVE' END;

    -- Actualizar deuda
    UPDATE public.debts
    SET remaining_amount = v_new_remaining,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_debt_id;

    -- Reducir saldo deudor del cliente
    UPDATE public.customers
    SET current_debt = GREATEST(0, COALESCE(current_debt, 0) - p_amount)
    WHERE id = v_debt.customer_id;

    -- Registrar recibo de pago
    INSERT INTO public.payments (
        debt_id,
        sale_id,
        customer_id,
        amount,
        method,
        payment_method,
        notes,
        note,
        date,
        created_at
    ) VALUES (
        p_debt_id,
        v_debt.sale_id,
        v_debt.customer_id,
        p_amount,
        p_payment_method,
        p_payment_method,
        p_notes,
        p_notes,
        NOW(),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'debt_id', p_debt_id,
        'amount_paid', p_amount,
        'remaining_amount', v_new_remaining,
        'status', v_new_status
    );
END;
$$;

-- 4. Ajustar Inventario Atómicamente
CREATE OR REPLACE FUNCTION public.adjust_inventory_rpc(
    p_product_id UUID,
    p_new_stock NUMERIC,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_stock NUMERIC;
    v_prod_name TEXT;
    v_diff NUMERIC;
BEGIN
    SELECT stock, name INTO v_old_stock, v_prod_name FROM public.products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado', p_product_id;
    END IF;

    v_diff := p_new_stock - v_old_stock;

    UPDATE public.products
    SET stock = p_new_stock,
        updated_at = NOW()
    WHERE id = p_product_id;

    INSERT INTO public.inventory_movements (
        product_id,
        product_name,
        type,
        quantity,
        previous_stock,
        new_stock,
        reason,
        notes,
        date
    ) VALUES (
        p_product_id,
        v_prod_name,
        'ADJUST',
        v_diff,
        v_old_stock,
        p_new_stock,
        p_reason,
        'Ajuste manual de inventario',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'product_id', p_product_id,
        'previous_stock', v_old_stock,
        'new_stock', p_new_stock,
        'diff', v_diff
    );
END;
$$;

-- ==============================================================================
-- TRIGGER PARA SINCRONIZAR AUTOMÁTICAMENTE PERFILES DESDE AUTH.USERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, username, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1),
            'Usuario'
        ),
        CASE 
            WHEN NEW.email = 'farmacia.soluciones.5@gmail.com' THEN 'admin'
            ELSE 'seller'
        END
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = CASE 
            WHEN EXCLUDED.email = 'farmacia.soluciones.5@gmail.com' THEN 'admin'
            ELSE public.profiles.role 
        END,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- POLÍTICAS ROW LEVEL SECURITY (RLS) - CERO ACCESO ANÓNIMO
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
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

-- Limpiar políticas anteriores para evitar duplicados
DROP POLICY IF EXISTS "profiles_select_auth" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_owner" ON public.profiles;
DROP POLICY IF EXISTS "categories_auth_all" ON public.categories;
DROP POLICY IF EXISTS "customers_auth_all" ON public.customers;
DROP POLICY IF EXISTS "products_auth_all" ON public.products;
DROP POLICY IF EXISTS "sales_auth_all" ON public.sales;
DROP POLICY IF EXISTS "sale_items_auth_all" ON public.sale_items;
DROP POLICY IF EXISTS "debts_auth_all" ON public.debts;
DROP POLICY IF EXISTS "payments_auth_all" ON public.payments;
DROP POLICY IF EXISTS "expenses_auth_all" ON public.expenses;
DROP POLICY IF EXISTS "daily_closings_auth_all" ON public.daily_closings;
DROP POLICY IF EXISTS "inventory_movements_auth_all" ON public.inventory_movements;

-- Políticas de perfiles
CREATE POLICY "profiles_select_auth" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_owner" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    WITH CHECK (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Políticas de datos operacionales para usuarios autenticados
CREATE POLICY "categories_auth_all" ON public.categories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "customers_auth_all" ON public.customers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "products_auth_all" ON public.products
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sales_auth_all" ON public.sales
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "sale_items_auth_all" ON public.sale_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "debts_auth_all" ON public.debts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "payments_auth_all" ON public.payments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "expenses_auth_all" ON public.expenses
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "daily_closings_auth_all" ON public.daily_closings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "inventory_movements_auth_all" ON public.inventory_movements
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- PUBLICACIÓN DE TABLAS EN SUPABASE REALTIME
-- ==============================================================================
DO $$ 
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.debts;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_closings;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;
