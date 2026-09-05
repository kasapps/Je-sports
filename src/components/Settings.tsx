import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Lock, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Tag,
  Shield
} from 'lucide-react';
import { Category } from '../types';
import { cn } from '../lib/utils';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';

export default function Settings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryStatus, setCategoryStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'categories'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
        setCategories(cats);
        setLoading(false);
      } catch (err) {
        console.error("Error processing categories snapshot:", err);
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching categories:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    setSavingCategory(true);
    setCategoryStatus(null);
    try {
      console.log("Adding category:", newCategory.trim());
      const docRef = await addDoc(collection(db, 'categories'), {
        name: newCategory.trim()
      });
      console.log("Category added with ID:", docRef.id);
      
      setNewCategory('');
      setCategoryStatus({ type: 'success', message: 'Categoría agregada correctamente.' });
      setTimeout(() => setCategoryStatus(null), 3000);
    } catch (err: any) {
      console.error("Error adding category:", err);
      setCategoryStatus({ type: 'error', message: err.message || 'Error desconocido al agregar categoría' });
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar esta categoría?')) return;
    
    setDeletingId(id);
    setCategoryStatus(null);
    try {
      await deleteDoc(doc(db, 'categories', id));
      setCategoryStatus({ type: 'success', message: 'Categoría eliminada correctamente.' });
      setTimeout(() => setCategoryStatus(null), 3000);
    } catch (err: any) {
      setCategoryStatus({ type: 'error', message: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  console.log("Settings rendering, categories:", categories.length, "status:", categoryStatus);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Configuración</h1>
          <p className="text-gray-500 mt-1">Administra las preferencias del sistema y seguridad.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Categories Management */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <Tag className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Categorías</h2>
              <p className="text-sm text-gray-500">Gestiona las categorías de productos.</p>
            </div>
          </div>

          <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nueva categoría..."
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={savingCategory || !newCategory.trim()}
              className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {savingCategory ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              Agregar
            </button>
          </form>

          {categoryStatus && (
            <div className={cn(
              "p-4 rounded-2xl flex items-center gap-3 text-sm font-medium mb-6",
              categoryStatus.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}>
              {categoryStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {categoryStatus.message}
            </div>
          )}

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              <div className="py-12 text-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                Cargando categorías...
              </div>
            ) : categories.length === 0 ? (
              <div className="py-12 text-center text-gray-400 bg-gray-50 rounded-3xl">
                No hay categorías registradas.
              </div>
            ) : (
              categories.map((category) => (
                <div 
                  key={category.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-gray-100 transition-all"
                >
                  <span className="font-semibold text-gray-700">{category.name}</span>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    disabled={deletingId === category.id}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  >
                    {deletingId === category.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Seguridad y Acceso</h2>
              <p className="text-sm text-gray-500">Información sobre el acceso al sistema.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100">
              <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Autenticación con Google
              </h3>
              <p className="text-sm text-blue-700 leading-relaxed">
                El sistema utiliza Google Authentication para garantizar la máxima seguridad. 
                No es necesario gestionar contraseñas locales.
              </p>
            </div>

            <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-2">Roles de Usuario</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5" />
                  <span><strong>Administrador:</strong> Acceso total a reportes, inventario y configuración.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5" />
                  <span><strong>Vendedor:</strong> Acceso a POS, clientes y consulta de productos.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
