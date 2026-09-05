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
  Filter,
  ArrowRightLeft
} from 'lucide-react';
import { Product } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Listen for products
    const qProducts = query(collection(db, 'products'), where('active', '==', true));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    });

    // Listen for recent movements
    const qMovements = query(
      collection(db, 'inventory_movements'), 
      orderBy('date', 'desc'), 
      limit(50)
    );
    const unsubscribeMovements = onSnapshot(qMovements, (snapshot) => {
      setMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeProducts();
      unsubscribeMovements();
    };
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const inventoryValue = products.reduce((acc, p) => acc + (p.stock * p.cost_price), 0);
  const potentialValue = products.reduce((acc, p) => acc + (p.stock * p.sale_price), 0);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Inventory Stats */}
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
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Margen Potencial</p>
          <h3 className="text-2xl font-black text-blue-600">{formatCurrency(potentialValue - inventoryValue)}</h3>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Estado de Stock Actual</h3>
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
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Actual</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Mínimo</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Valorización</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-800">{product.name}</p>
                    <p className="text-xs text-gray-400">{product.sku}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-gray-700">{product.stock} {product.unit}s</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500">{product.min_stock} {product.unit}s</span>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
