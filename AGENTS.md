# Guía del Repositorio y Arquitectura para Agentes LLM (AGENTS.md)

Este documento sirve como manual de referencia técnica, directrices de arquitectura y reglas de negocio para cualquier modelo de lenguaje (LLM), agente autónomo o desarrollador que trabaje en el repositorio **KAS SPORT**.

---

## 1. Visión General del Proyecto

**KAS SPORT** es una aplicación web empresarial integral para Punto de Venta (POS), Control de Inventario, Gestión de Clientes, Cuentas por Cobrar (Créditos/Deudas) y Reportes Financieros / Cierre de Caja.

- **Idioma de la interfaz:** Español (nombres, etiquetas, mensajes de confirmación y reportes).
- **Moneda:** Formato estándar monetario (`$0.00`) con soporte para pesos/dólares.
- **Formato de fechas:** `DD/MM/YYYY` o `DD/MM/YYYY HH:mm`.

---

## 2. Stack Tecnológico

- **Frontend:** React 19 / 18+ (Hooks funcionales), TypeScript (modo estricto).
- **Empaquetador:** Vite con soporte SPA.
- **Estilos:** Tailwind CSS con tema moderno y limpio (diseño responsivo móvil y escritorio).
- **Iconografía:** `lucide-react` únicamente.
- **Animaciones:** `motion/react`.
- **Persistencia y Base de Datos Activa:** Supabase Client (`@supabase/supabase-js`) sobre PostgreSQL.
- **Esquema canónico y RPCs:** Definidos en `supabase_schema.sql`.

---

## 3. Arquitectura de Base de Datos (Supabase PostgreSQL)

### Configuración Activa
- **Cliente:** Inicializado en `src/supabase.ts` consumiendo `import.meta.env.VITE_SUPABASE_URL` y `import.meta.env.VITE_SUPABASE_ANON_KEY`.
- **Canales en Tiempo Real:** `supabase.channel` escuchando cambios `postgres_changes` en las tablas `products`, `customers`, `sales`, `debts`, `payments`, `expenses`, `daily_closings` e `inventory_movements`.
- **Operaciones Atómicas (RPC):** Para evitar condiciones de carrera en inventario y deudas, se ejecutan funciones almacenadas en PostgreSQL:
  1. `close_sale_rpc`: Registra la venta, descuenta el stock de cada ítem, inserta los movimientos en `inventory_movements`, genera el pago en `payments` o la deuda en `debts` y actualiza el saldo del cliente de manera atómica.
  2. `cancel_sale_rpc`: Marca la venta como `CANCELLED`, revierte las cantidades vendidas al stock de cada producto y crea los movimientos de reversión en `inventory_movements`.
  3. `record_debt_payment_rpc`: Inserta el abono en `payments`, descuenta `remaining_amount` en `debts`, actualiza el estado de la deuda (`PAID` o `ACTIVE`) y disminuye `current_debt` en `customers`.
  4. `adjust_inventory_rpc`: Ajusta el stock de un producto y genera el registro en `inventory_movements` con el motivo especificado.

### Tablas Principales y Esquema

1. **`profiles`**
   - `id` (UUID): ID de usuario vinculado a `auth.users.id`.
   - `email` (TEXT): Correo electrónico.
   - `name` (TEXT): Nombre para mostrar.
   - `role` ('admin' | 'seller'): El correo `farmacia.soluciones.5@gmail.com` es automáticamente administrador.

2. **`categories`**
   - `id` (TEXT / UUID): ID único.
   - `name` (TEXT): Nombre de la categoría.

3. **`products`**
   - `id` (TEXT / UUID): ID del producto.
   - `name` (TEXT): Nombre descriptivo.
   - `barcode` (TEXT, opcional): Código de barras.
   - `category_id` (TEXT, opcional): Categoría asociada.
   - `sale_price` (NUMERIC): Precio al público (>= 0).
   - `cost_price` (NUMERIC): Costo de compra (>= 0).
   - `stock` (NUMERIC): Existencia actual.
   - `min_stock` (NUMERIC): Nivel de alerta mínima.
   - `unit` (TEXT): Unidad ('PZA', 'PAR', 'CAJA', etc.).
   - `active` (BOOLEAN): Estado activo para venta.

4. **`customers`**
   - `id` (TEXT / UUID): ID del cliente.
   - `name` (TEXT): Nombre completo.
   - `phone` (TEXT, opcional): Teléfono.
   - `email` (TEXT, opcional): Correo.
   - `address` (TEXT, opcional): Dirección.
   - `current_debt` (NUMERIC): Saldo acumulado por cobrar.

5. **`sales`**
   - `id` (TEXT / UUID): ID de la venta.
   - `customer_id` (TEXT, opcional): ID del cliente.
   - `customer_name` (TEXT): Nombre del cliente o 'Público General'.
   - `total` (NUMERIC): Importe total.
   - `payment_method` ('CASH' | 'CARD' | 'TRANSFER' | 'CREDIT'): Forma de pago.
   - `status` ('OPEN' | 'CLOSED' | 'CANCELLED'): Estado del ticket.
   - `items` (JSONB): Detalle de artículos vendidos.
   - `seller_name` (TEXT): Nombre del cajero.
   - `created_at` (TIMESTAMPTZ): Creación.
   - `closed_at` (TIMESTAMPTZ, opcional): Cierre de venta.

6. **`sale_items`**
   - `id` (TEXT / UUID): ID del ítem.
   - `sale_id` (TEXT / UUID): Venta padre.
   - `product_id` (TEXT / UUID): Producto.
   - `product_name` (TEXT): Nombre registrado.
   - `quantity` (NUMERIC): Cantidad.
   - `unit_price` (NUMERIC): Precio cobrado.
   - `subtotal` (NUMERIC): Total de línea.

7. **`debts` (Cuentas por cobrar / Fiados)**
   - `id` (TEXT / UUID): ID del crédito.
   - `customer_id` (TEXT): Cliente deudor.
   - `customer_name` (TEXT): Nombre del cliente.
   - `sale_id` (TEXT, opcional): Ticket origen.
   - `total_amount` (NUMERIC): Monto total prestado.
   - `remaining_amount` (NUMERIC): Saldo pendiente.
   - `status` ('ACTIVE' | 'PAID'): Estado.
   - `created_at` (TIMESTAMPTZ): Emisión.

8. **`payments` (Abonos y Cobros)**
   - `id` (TEXT / UUID): ID del abono.
   - `debt_id` (TEXT, opcional): Deuda asociada.
   - `sale_id` (TEXT, opcional): Venta asociada si fue contado.
   - `customer_id` (TEXT, opcional): Cliente.
   - `amount` (NUMERIC): Monto cobrado.
   - `method` ('CASH' | 'CARD' | 'TRANSFER'): Medio de pago.
   - `date` (TIMESTAMPTZ): Momento del cobro.

9. **`expenses` (Gastos de operación)**
   - `id` (TEXT / UUID): ID del gasto.
   - `description` (TEXT): Concepto.
   - `amount` (NUMERIC): Importe.
   - `category` (TEXT): Rubro.
   - `date` (TIMESTAMPTZ): Fecha y hora.
   - `registered_by` (TEXT, opcional): UID del usuario.

10. **`daily_closings` (Cierres de Caja / Cortes diarios)**
    - `id` (TEXT / UUID): ID del corte.
    - `date` (DATE): Fecha del corte (`YYYY-MM-DD`).
    - `total_sales` (NUMERIC): Ventas acumuladas.
    - `gross_profit` (NUMERIC): Ganancia bruta.
    - `expenses` (NUMERIC): Gastos deducidos.
    - `expected_cash` (NUMERIC): Efectivo calculado por sistema.
    - `physical_cash` (NUMERIC): Efectivo contado físicamente.
    - `discrepancy` (NUMERIC): Diferencia sobrante/faltante.
    - `closed_at` (TIMESTAMPTZ): Hora de cierre.
    - `closed_by` (TEXT, opcional): Usuario responsable.

11. **`inventory_movements` (Kardex / Historial)**
    - `id` (TEXT / UUID): ID del movimiento.
    - `product_id` (TEXT): Producto.
    - `product_name` (TEXT): Nombre del producto.
    - `type` ('IN' | 'OUT' | 'ADJUST'): Tipo de movimiento.
    - `quantity` (NUMERIC): Unidades afectadas.
    - `previous_stock` (NUMERIC): Stock previo.
    - `new_stock` (NUMERIC): Stock posterior.
    - `reason` (TEXT): Motivo (Venta, Devolución, Ajuste, Compra).
    - `created_at` (TIMESTAMPTZ): Fecha de registro.

---

## 4. Reglas de Negocio e Invariantes Críticas

1. **Descuento de Inventario en Ventas:**
   - Cada vez que se procesa una venta, se invoca la RPC `close_sale_rpc` que descuenta el stock y genera el movimiento de salida en `inventory_movements`.

2. **Ventas a Crédito:**
   - Si `payment_method === 'CREDIT'`, la venta debe tener un cliente registrado. La RPC crea la deuda en `debts` y actualiza `current_debt` en `customers`.

3. **Abonos a Deudas:**
   - El cobro de abonos se ejecuta con la RPC `record_debt_payment_rpc` que disminuye `remaining_amount`, actualiza el estado a `PAID` si llega a 0, y descuenta `customer.current_debt`.

4. **Roles y Privilegios:**
   - **Admin:** Acceso total a reportes, eliminación de productos, categorías, corte de caja y auditoría. El correo `farmacia.soluciones.5@gmail.com` es Administrador.
   - **Vendedor (Seller):** Acceso a POS, inventario (consulta y creación básica), registro de clientes y abonos.

5. **Evitar Datos Simulados (No Mock Data):**
   - Toda la interfaz consume y persiste directamente en Supabase con sincronización en tiempo real vía WebSocket (`supabase.channel`).

---

## 5. Estructura de Directorios

```
/
├── .env.example              # Variables de entorno documentadas
├── AGENTS.md                 # Este documento de arquitectura para agentes
├── README.md                 # Documentación para usuarios y despliegue
├── supabase_schema.sql       # Script SQL DDL y funciones RPC en Supabase
├── package.json              # Dependencias y scripts de construcción
├── tsconfig.json             # Configuración TypeScript
├── vite.config.ts            # Configuración de Vite
├── src/
│   ├── main.tsx              # Punto de entrada de React
│   ├── App.tsx               # Componente raíz, autenticación Supabase, enrutamiento
│   ├── supabase.ts           # Inicialización del cliente Supabase
│   ├── types.ts              # Interfaces y tipos de TypeScript compartidos
│   ├── index.css             # Estilos globales con Tailwind CSS
│   ├── vite-env.d.ts         # Definición de tipos de variables de entorno de Vite
│   ├── lib/
│   │   └── utils.ts          # Formatos de moneda ($0.00), fechas y utilidades
│   └── components/           # Módulos y vistas principales
│       ├── Dashboard.tsx     # Métricas en tiempo real, accesos rápidos y gráficas
│       ├── POS.tsx           # Punto de venta, búsqueda, notas, cobro y ticket
│       ├── Products.tsx      # Catálogo, alta/edición de productos y categorías
│       ├── Customers.tsx     # Directorio de clientes e historial de compras/deudas
│       ├── Debts.tsx         # Cuentas por cobrar y registro de abonos
│       ├── Inventory.tsx     # Control de stock, alertas y kardex de movimientos
│       ├── Reports.tsx       # Reportes de ventas, gastos y arqueo de caja
│       ├── Login.tsx         # Acceso con Supabase Auth (Email / Password y Google)
│       └── Settings.tsx      # Categorías, estado de Supabase y perfiles
```

---

## 6. Comandos de Verificación

- **Validación de Tipos y Sintaxis:**
  ```bash
  npm run lint
  # Ejecuta tsc --noEmit
  ```

- **Compilación de Producción:**
  ```bash
  npm run build
  # Ejecuta vite build
  ```
