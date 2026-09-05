import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Tag, 
  Shield,
  Database,
  Users
} from 'lucide-react';
import { Category, User as AppUser } from '../types';
import { cn } from '../lib/utils';
import { supabase } from '../supabase';

export default function Settings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryStatus, setCategoryStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Profiles list
  const [profiles, setProfiles] = useState<AppUser[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories((data || []) as Category[]);
    } catch (err: any) {
      console.error('Error fetching categories from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Profiles table note:', error.message);
      } else {
        setProfiles((data || []) as AppUser[]);
      }
    } catch (err) {
      console.error('Error fetching profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchProfiles();

    const channel = supabase
      .channel('settings_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchCategories())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchProfiles())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    setSavingCategory(true);
    setCategoryStatus(null);
    try {
      const { error } = await supabase
        .from('categories')
        .insert({ name: newCategory.trim() });

      if (error) throw error;
      
      setNewCategory('');
      setCategoryStatus({ type: 'success', message: 'Categoría agregada correctamente.' });
      setTimeout(() => setCategoryStatus(null), 3000);
      await fetchCategories();
    } catch (err: any) {
      console.error('Error adding category:', err);
      setCategoryStatus({ type: 'error', message: err.message || 'Error al agregar categoría' });
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar esta categoría?')) return;
    
    setDeletingId(id);
    setCategoryStatus(null);
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCategoryStatus({ type: 'success', message: 'Categoría eliminada correctamente.' });
      setTimeout(() => setCategoryStatus(null), 3000);
      await fetchCategories();
    } catch (err: any) {
      setCategoryStatus({ type: 'error', message: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Configuración</h1>
          <p className="text-gray-500 mt-1">Administra las preferencias de la tienda, categorías y base de datos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gestión de Categorías */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <Tag className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Categorías de Productos</h2>
              <p className="text-sm text-gray-500">Gestiona las clasificaciones del inventario.</p>
            </div>
          </div>

          <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nueva categoría (ej. Calzado, Ropa, Balones)..."
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
            />
            <button
              type="submit"
              disabled={savingCategory || !newCategory.trim()}
              className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2 text-sm shadow-md shadow-emerald-600/20"
            >
              {savingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar
            </button>
          </form>

          {categoryStatus && (
            <div className={cn(
              "p-4 rounded-2xl flex items-center gap-3 text-sm font-medium mb-6",
              categoryStatus.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}>
              {categoryStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span>{categoryStatus.message}</span>
            </div>
          )}

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {loading ? (
              <div className="py-12 text-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-500" />
                Cargando categorías desde Supabase...
              </div>
            ) : categories.length === 0 ? (
              <div className="py-12 text-center text-gray-400 bg-gray-50 rounded-3xl">
                No hay categorías registradas aún.
              </div>
            ) : (
              categories.map((category) => (
                <div 
                  key={category.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-gray-100 transition-all"
                >
                  <span className="font-semibold text-gray-700 text-sm">{category.name}</span>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    disabled={deletingId === category.id}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    title="Eliminar categoría"
                  >
                    {deletingId === category.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sección de Conexión y Seguridad */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <Database className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Base de Datos Activa</h2>
                <p className="text-sm text-gray-500">Supabase PostgreSQL</p>
              </div>
            </div>

            <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Estado de Conexión</span>
                <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Conectado
                </span>
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                KAS SPORT está conectado exclusivamente a Supabase. Las tablas de productos, ventas, deudas, inventario y cortes diarios se actualizan en tiempo real mediante canales WebSocket.
              </p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Seguridad y Roles</h2>
                <p className="text-sm text-gray-500">Control de permisos por rol.</p>
              </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-2.5">
                <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 shrink-0" />
                <span><strong>Administrador:</strong> Acceso total a reportes, corte de caja diario, auditoría de kardex y configuración de categorías.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0" />
                <span><strong>Vendedor:</strong> Acceso a Punto de Venta (POS), clientes, catálogo y registro de abonos.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
