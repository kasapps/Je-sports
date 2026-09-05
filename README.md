# KAS SPORT - Sistema de Punto de Venta e Inventario

Sistema integral para gestión de negocios con control de inventario, ventas, clientes, cuentas por cobrar (deudas) y reportes financieros.

---

## 🚀 Despliegue y Conexión con Supabase

### 1. Crear las Tablas en Supabase
1. Ingresa a tu panel en [Supabase](https://supabase.com) y entra a tu proyecto.
2. Ve a la sección **SQL Editor** en la barra lateral izquierda.
3. Abre y copia todo el contenido del archivo `supabase_schema.sql` incluido en este repositorio.
4. Pégalo en el editor y haz clic en **Run**. Esto creará automáticamente todas las tablas (`categories`, `products`, `customers`, `sales`, `debts`, `expenses`, etc.) junto con sus políticas de seguridad (RLS) y soporte de tiempo real.

### 2. Configurar Variables de Entorno
Copia o crea tu archivo `.env` basado en `.env.example`:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

Encontrarás estos valores en tu panel de Supabase:
👉 **Project Settings** > **API** > **Project URL** y **Project API Keys (anon public)**.

---

## 📦 Publicar en GitHub

### Opción A: Desde Google AI Studio (Recomendado - 1 Clic)
1. En la esquina superior de la interfaz de AI Studio, haz clic en el menú o en **Settings / Export**.
2. Selecciona **Export to GitHub** (o **Push to GitHub**).
3. Conecta o autoriza tu cuenta de GitHub y confirma el nombre del repositorio. ¡El código se subirá automáticamente!

### Opción B: Mediante Git en tu Computadora (o descargando el ZIP)
Si descargas el proyecto como archivo ZIP o lo tienes en local:

```bash
# 1. Inicializar git
git init

# 2. Agregar todos los archivos
git add .

# 3. Primer commit
git commit -m "Initial commit - KAS SPORT POS"

# 4. Crear tu repositorio en github.com y vincularlo:
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git

# 5. Subir a GitHub
git push -u origin main
```

---

## 🛠️ Ejecución Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```
La aplicación se ejecutará en `http://localhost:3000`.
