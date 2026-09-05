import React, { useState, useEffect } from 'react';
import { 
  Search, 
  TrendingUp, 
  ArrowUp, 
  ArrowDown, 
  Package, 
  History, 
  AlertTriangle,
  Loader2,
  Sliders,
  X,
  Clock
} from 'lucide-react';
import { Product, InventoryMovement } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { supabase } from '../supabase';

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock');

  // Modal ajuste
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [newStockInput, setNewStockInput] = useState('');
  const [adjustReason, setAdjustReason] = useState('Ajuste de inventario físico');
  const [adjusting, setAdjusting] = useState(false);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  const fetchMovements = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .order('date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMovements((data || []) as InventoryMovement[]);
    } catch (e) {
      console.error('Error fetching movements:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchMovements();

    const channel = supabase
      .channel('inventory_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_movements' }, () => {
        fetchMovements();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const parsedStock = Number(newStockInput);
    if (isNaN(parsedStock) || parsedStock < 0) {
      alert('Ingresa una cantidad válida de stock (mayor o igual a 0).');
      return;
    }

    setAdjusting(true);
    try {
      // Función RPC atómica en PostgreSQL
      const { data, error } = await supabase.rpc('adjust_inventory_rpc', {
        p_product_id: adjustingProduct.id,
        p_new_stock: parsedStock,
        p_reason: adjustReason.trim() || 'Ajuste manual'
      });

      if (error) throw error;

      setAdjustingProduct(null);
      setNewStockInput('');
      setAdjustReason('Ajuste de inventario físico');
      await Promise.all([fetchProducts(), fetchMovements()]);
    } catch (err: any) {
      console.error('Error adjusting stock:', err);
      alert('Error al ajustar el stock: ' + (err.message || 'Error en base de datos'));
    } finally {
      setAdjusting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const inventoryValue = products.reduce((acc, p) => acc + (p.stock * p.cost_price), 0);
  const potentialValue = products.reduce((acc, p) => acc + (p.stock * p.sale_price), 0);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tarjetas de estadísticas de inventario */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Valor del Inventario (Costo)</p>
          <h3 className="text-2xl font-black text-gray-800">{formatCurrency(inventoryValue)}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Valor de Venta Estimado</p>
          <h3 className="text-2xl font-black text-emerald-600">{formatCurrency(potentialValue)}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Margen Estimado</p>
          <h3 className="text-2xl font-black text-blue-600">{formatCurrency(potentialValue - inventoryValue)}</h3>
        </div>
      </div>

      {/* Selector de Pestañas y Búsqueda */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>
        <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab('stock')}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-xs transition-all",
              activeTab === 'stock' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Estado de Stock
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5",
              activeTab === 'movements' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <History className="w-3.5 h-3.5" />
            <span>Kardex / Movimientos</span>
          </button>
        </div>
      </div>

      {activeTab === 'stock' ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">Existencias Actuales</h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                {products.filter(p => p.stock <= p.min_stock).length} Críticos
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Actual</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Mínimo</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Valorización</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Ajuste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-800">{product.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{product.sku || 'SIN SKU'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "font-bold",
                        product.stock <= product.min_stock ? "text-red-500" : "text-gray-700"
                      )}>
                        {product.stock} {product.unit || 'pieza'}s
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">{product.min_stock} {product.unit || 'pieza'}s</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-800">{formatCurrency(product.stock * product.cost_price)}</p>
                      <p className="text-[10px] text-gray-400">Venta: {formatCurrency(product.stock * product.sale_price)}</p>
                    </td>
                    <td className="px-6 py-4">
                      {product.stock <= 0 ? (
                        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold uppercase">Agotado</span>
                      ) : product.stock <= product.min_stock ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">Bajo</span>
                      ) : (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Óptimo</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setAdjustingProduct(product);
                          setNewStockInput(String(product.stock));
                        }}
                        className="px-3 py-1.5 bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-emerald-600 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1"
                        title="Ajustar stock"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Ajustar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Kardex / Movimientos */
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">Historial de Movimientos de Inventario</h3>
            <span className="text-xs text-gray-400">Últimos 50 movimientos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cantidad</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Resultante</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No hay movimientos registrados en el kardex.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(mov.date || mov.created_at || '')}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-800 text-sm">{mov.product_name || 'Producto'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                          mov.type === 'IN' ? "bg-emerald-50 text-emerald-700" :
                          mov.type === 'SALE' ? "bg-blue-50 text-blue-700" :
                          mov.type === 'ADJUST' ? "bg-purple-50 text-purple-700" :
                          mov.type === 'CANCEL_SALE' ? "bg-amber-50 text-amber-700" :
                          "bg-gray-100 text-gray-700"
                        )}>
                          {mov.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "font-bold text-sm",
                          Number(mov.quantity) > 0 ? "text-emerald-600" : "text-red-500"
                        )}>
                          {Number(mov.quantity) > 0 ? `+${mov.quantity}` : mov.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                        {mov.new_stock !== undefined ? mov.new_stock : '-'}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {mov.reason || mov.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Ajuste Manual de Stock */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-emerald-600 text-white flex items-center justify-between">
              <h3 className="text-xl font-bold">Ajuste de Stock</h3>
              <button onClick={() => setAdjustingProduct(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAdjustStock} className="p-8 space-y-6">
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Producto</p>
                <h4 className="text-lg font-bold text-gray-800 mt-1">{adjustingProduct.name}</h4>
                <p className="text-sm text-gray-500 mt-1">Stock actual registrado: <strong className="text-gray-800">{adjustingProduct.stock} {adjustingProduct.unit || 'pieza'}s</strong></p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Nuevo Stock Real</label>
                <input
                  type="number"
                  step="1"
                  required
                  min="0"
                  value={newStockInput}
                  onChange={(e) => setNewStockInput(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xl font-bold text-center"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Motivo del Ajuste</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ej. Conteo físico, merma, rotura, devolución"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all text-sm flex items-center justify-center gap-2"
                >
                  {adjusting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    'Aplicar Ajuste'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
