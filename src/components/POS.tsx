import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  User, 
  CreditCard, 
  Banknote, 
  ArrowRight,
  ShoppingCart,
  X,
  PlusCircle,
  Loader2,
  Tag,
  Package,
  Lock
} from 'lucide-react';
import { Product, Customer, Sale, SaleItem } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  getDocs,
  serverTimestamp,
  increment,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function POS() {
  const [openSales, setOpenSales] = useState<Sale[]>([]);
  const [activeSaleId, setActiveSaleId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isDayClosed, setIsDayClosed] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);

  // Checkout state
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [discount, setDiscount] = useState('0');

  useEffect(() => {
    // Listen for products
    const qProducts = query(collection(db, 'products'), where('active', '==', true));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    // Listen for customers
    const qCustomers = query(collection(db, 'customers'), orderBy('name'));
    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    // Listen for open sales
    const qOpenSales = query(collection(db, 'sales'), where('status', '==', 'OPEN'), orderBy('created_at', 'desc'));
    const unsubscribeOpenSales = onSnapshot(qOpenSales, (snapshot) => {
      const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      setOpenSales(sales);
      setLoading(false);
    });

    // Listen for last closed sale
    const qLastSale = query(
      collection(db, 'sales'), 
      where('status', '==', 'CLOSED'), 
      orderBy('closed_at', 'desc'), 
      limit(1)
    );
    const unsubscribeLastSale = onSnapshot(qLastSale, (snapshot) => {
      if (!snapshot.empty) {
        setLastSale({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Sale);
      } else {
        setLastSale(null);
      }
    });

    // Check if day is closed
    const today = new Date().toISOString().split('T')[0];
    const qClosing = query(collection(db, 'daily_closings'), where('date', '==', today));
    const unsubscribeClosing = onSnapshot(qClosing, (snapshot) => {
      setIsDayClosed(!snapshot.empty);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeCustomers();
      unsubscribeOpenSales();
      unsubscribeLastSale();
      unsubscribeClosing();
    };
  }, []);

  const createNewSale = async (customerId?: string) => {
    try {
      const customer = customerId ? customers.find(c => c.id === customerId) : null;
      const newSale = {
        customer_id: customerId || null,
        customer_name: customer ? customer.name : 'Público General',
        total: 0,
        subtotal: 0,
        discount: 0,
        status: 'OPEN',
        created_at: new Date().toISOString(),
        items: []
      };
      const docRef = await addDoc(collection(db, 'sales'), newSale);
      setActiveSaleId(docRef.id);
    } catch (err) {
      console.error('Error creating sale:', err);
    }
  };

  const deleteSale = async (e: React.MouseEvent, saleId: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'sales', saleId));
      if (activeSaleId === saleId) {
        setActiveSaleId(null);
      }
    } catch (err) {
      console.error('Error deleting sale:', err);
    }
  };

  const addItemToSale = async (product: Product) => {
    if (!activeSaleId) return;
    
    const activeSale = openSales.find(s => s.id === activeSaleId);
    if (!activeSale) return;

    const items = [...(activeSale.items || [])];
    const existingItemIndex = items.findIndex(i => i.product_id === product.id);

    if (existingItemIndex > -1) {
      items[existingItemIndex].quantity += 1;
    } else {
      items.push({
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        price: product.sale_price,
        cost: product.cost_price
      });
    }

    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const total = subtotal - (activeSale.discount || 0);

    try {
      await updateDoc(doc(db, 'sales', activeSaleId), {
        items,
        subtotal,
        total
      });
    } catch (err) {
      console.error('Error adding item:', err);
    }
  };

  const removeItemFromSale = async (productId: string) => {
    if (!activeSaleId) return;
    
    const activeSale = openSales.find(s => s.id === activeSaleId);
    if (!activeSale) return;

    const items = (activeSale.items || []).filter(i => i.product_id !== productId);
    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const total = subtotal - (activeSale.discount || 0);

    try {
      await updateDoc(doc(db, 'sales', activeSaleId), {
        items,
        subtotal,
        total
      });
    } catch (err) {
      console.error('Error removing item:', err);
    }
  };

  const updateSaleCustomer = async (customerId: string | null) => {
    if (!activeSaleId) return;
    const customer = customerId ? customers.find(c => c.id === customerId) : null;
    
    try {
      await updateDoc(doc(db, 'sales', activeSaleId), {
        customer_id: customerId,
        customer_name: customer ? customer.name : 'Público General'
      });
    } catch (err) {
      console.error('Error updating customer:', err);
    }
  };

  const closeSale = async () => {
    const activeSale = openSales.find(s => s.id === activeSaleId);
    if (!activeSale || !activeSaleId) return;

    const paid = Number(amountPaid) || activeSale.total;
    const discountVal = Number(discount);
    const total = activeSale.subtotal - discountVal;
    const debtAmount = total > paid ? total - paid : 0;

    try {
      const batch = writeBatch(db);

      // 1. Update Sale status
      const saleRef = doc(db, 'sales', activeSaleId);
      batch.update(saleRef, {
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
        discount: discountVal,
        total: total
      });

      // 2. Update Product Stock and create Inventory Movements
      for (const item of activeSale.items) {
        const productRef = doc(db, 'products', item.product_id);
        batch.update(productRef, {
          stock: increment(-item.quantity)
        });

        const movementRef = doc(collection(db, 'inventory_movements'));
        batch.set(movementRef, {
          product_id: item.product_id,
          type: 'SALE',
          quantity: -item.quantity,
          reference_id: activeSaleId,
          date: new Date().toISOString(),
          notes: `Venta #${activeSaleId}`
        });
      }

      // 3. Create Payment
      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, {
        sale_id: activeSaleId,
        amount: paid,
        method: paymentMethod,
        date: new Date().toISOString()
      });

      // 4. Create Debt if needed
      if (debtAmount > 0 && activeSale.customer_id) {
        const debtRef = doc(collection(db, 'debts'));
        batch.set(debtRef, {
          customer_id: activeSale.customer_id,
          customer_name: activeSale.customer_name,
          sale_id: activeSaleId,
          total_amount: total,
          remaining_amount: debtAmount,
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        });
      }

      await batch.commit();

      setIsCheckoutOpen(false);
      setAmountPaid('');
      setDiscount('0');
      setActiveSaleId(null);
    } catch (err) {
      console.error('Error closing sale:', err);
      alert('Error al cerrar la venta. Por favor intente de nuevo.');
    }
  };

  const handleDeleteLastSale = async () => {
    if (!lastSale) return;

    if (!confirm('¿Está seguro de que desea borrar la última venta? Esto revertirá el stock.')) return;

    try {
      const batch = writeBatch(db);

      // 1. Cancel Sale
      batch.update(doc(db, 'sales', lastSale.id), {
        status: 'CANCELLED'
      });

      // 2. Revert Stock
      for (const item of lastSale.items) {
        batch.update(doc(db, 'products', item.product_id), {
          stock: increment(item.quantity)
        });
      }

      // 3. Delete related payments and debts (simplified: just cancel/mark)
      // In a real app we might want to find and delete them, but for now let's just revert stock
      
      await batch.commit();
      setLastSale(null);
    } catch (err: any) {
      console.error(err);
      alert('Error al borrar la venta');
    }
  };

  const activeSale = openSales.find(s => s.id === activeSaleId);
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex gap-8 relative">
      {isDayClosed && (
        <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex items-center justify-center rounded-[3rem]">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 text-center max-w-md animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">Caja Cerrada</h3>
            <p className="text-gray-500 mb-8">El corte del día ya ha sido realizado. No se pueden procesar más ventas hasta el día de mañana.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all"
            >
              Actualizar Estado
            </button>
          </div>
        </div>
      )}
      {/* Products Selection */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar producto por nombre o SKU..."
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addItemToSale(product)}
                disabled={!activeSaleId || product.stock <= 0 || isDayClosed}
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="aspect-square bg-gray-50 rounded-xl mb-3 flex items-center justify-center text-gray-400 group-hover:text-emerald-500 transition-colors">
                  <Package className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-sm line-clamp-2 h-10">{product.name}</h4>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-emerald-600 font-bold">{formatCurrency(product.sale_price)}</span>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    product.stock <= product.min_stock ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"
                  )}>
                    Stock: {product.stock}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart / Active Sale */}
      <div className="w-[400px] flex flex-col bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        {/* Sale Tabs */}
        <div className="bg-gray-50 p-2 flex gap-2 overflow-x-auto border-b border-gray-100">
          {openSales.map(sale => (
            <div key={sale.id} className="relative group/tab">
              <button
                onClick={() => setActiveSaleId(sale.id)}
                className={cn(
                  "px-4 py-2 pr-10 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                  activeSaleId === sale.id 
                    ? "bg-white text-emerald-600 shadow-sm" 
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                Nota #{sale.id.slice(-4)} {sale.customer_name ? `(${sale.customer_name})` : ''}
              </button>
              <button
                onClick={(e) => deleteSale(e, sale.id)}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors",
                  activeSaleId === sale.id 
                    ? "text-gray-300 hover:text-red-500 opacity-100" 
                    : "text-gray-200 hover:text-red-500 opacity-0 group-hover/tab:opacity-100"
                )}
                title="Quitar Nota"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button 
            onClick={() => createNewSale()}
            disabled={isDayClosed}
            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors disabled:opacity-50"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
        </div>

        {activeSale ? (
          <>
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">Nota de Venta #{activeSale.id.slice(-4)}</h3>
                  <button 
                    onClick={(e) => deleteSale(e, activeSale.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Quitar Nota"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-1 relative">
                  <button 
                    onClick={() => {
                      setIsCustomerDropdownOpen(!isCustomerDropdownOpen);
                      setCustomerSearch('');
                    }}
                    className="flex items-center gap-2 text-xs text-gray-500 hover:text-emerald-600 transition-colors outline-none"
                  >
                    <User className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">
                      {activeSale.customer_name || 'Público General'}
                    </span>
                  </button>

                  {isCustomerDropdownOpen && (
                    <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-3 border-b border-gray-50">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Buscar cliente..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border-none rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <button
                          onClick={() => {
                            updateSaleCustomer(null);
                            setIsCustomerDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center justify-between"
                        >
                          <span>Público General</span>
                          {!activeSale.customer_id && <Plus className="w-3 h-3" />}
                        </button>
                        {filteredCustomers.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              updateSaleCustomer(c.id);
                              setIsCustomerDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center justify-between"
                          >
                            <span className="truncate">{c.name}</span>
                            {activeSale.customer_id === c.id && <Plus className="w-3 h-3" />}
                          </button>
                        ))}
                        {filteredCustomers.length === 0 && customerSearch && (
                          <div className="px-4 py-3 text-center text-[10px] text-gray-400">
                            No se encontraron clientes
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right ml-4">
                <p className="text-[10px] uppercase font-bold text-gray-400">Total</p>
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(activeSale.total)}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeSale.items?.map(item => (
                <div key={item.product_id} className="flex items-center gap-4 group">
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{item.quantity} x {formatCurrency(item.price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(item.quantity * item.price)}</p>
                    <button 
                      onClick={() => removeItemFromSale(item.product_id)}
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(!activeSale.items || activeSale.items.length === 0) && (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 py-20">
                  <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">La nota está vacía</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-bold">{formatCurrency(activeSale.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Descuento</span>
                <span className="text-red-500 font-bold">-{formatCurrency(activeSale.discount)}</span>
              </div>
              <div className="pt-4 border-t border-gray-200 flex justify-between items-end">
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase">Total a Pagar</p>
                  <p className="text-3xl font-black text-gray-800">{formatCurrency(activeSale.total)}</p>
                </div>
                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  disabled={!activeSale.items || activeSale.items.length === 0 || isDayClosed}
                  className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isDayClosed ? 'Día Cerrado' : 'Cobrar'}
                  {!isDayClosed && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-300 mb-6">
              <ShoppingCart className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No hay notas abiertas</h3>
            <p className="text-gray-500 text-sm mb-8">Crea una nueva nota para comenzar a registrar productos.</p>
            <button 
              onClick={() => createNewSale()}
              className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
            >
              Nueva Venta
            </button>

            {lastSale && !isDayClosed && (
              <div className="mt-12 p-6 bg-gray-50 rounded-[2rem] border border-gray-100 max-w-xs w-full">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Última Venta Realizada</p>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-sm font-bold text-gray-700">#{lastSale.id.slice(-4)}</p>
                    <p className="text-xs text-gray-400">{new Date(lastSale.closed_at || '').toLocaleTimeString()}</p>
                  </div>
                  <p className="text-lg font-black text-emerald-600">{formatCurrency(lastSale.total)}</p>
                </div>
                <button 
                  onClick={handleDeleteLastSale}
                  className="w-full py-3 bg-white text-red-500 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Borrar esta venta
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-emerald-600 text-white flex items-center justify-between">
              <h3 className="text-xl font-bold">Finalizar Venta</h3>
              <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total a Cobrar</p>
                <p className="text-5xl font-black text-gray-800 mt-2">{formatCurrency(activeSale?.total || 0)}</p>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-bold text-gray-700">Método de Pago</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'CASH', label: 'Efectivo', icon: Banknote },
                    { id: 'CARD', label: 'Tarjeta', icon: CreditCard },
                    { id: 'TRANSFER', label: 'Transf.', icon: ArrowRight }
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id as any)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                        paymentMethod === method.id 
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                          : "border-gray-100 text-gray-400 hover:border-gray-200"
                      )}
                    >
                      <method.icon className="w-6 h-6" />
                      <span className="text-xs font-bold">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-gray-700">Monto Recibido</label>
                  <button 
                    onClick={() => setAmountPaid(String(activeSale?.total))}
                    className="text-xs text-emerald-600 font-bold hover:underline"
                  >
                    Pago Exacto
                  </button>
                </div>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={String(activeSale?.total)}
                  className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-2xl font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {Number(amountPaid) > (activeSale?.total || 0) && (
                <div className="p-4 bg-blue-50 rounded-2xl flex items-center justify-between">
                  <span className="text-sm text-blue-700 font-bold">Cambio:</span>
                  <span className="text-xl font-black text-blue-700">
                    {formatCurrency(Number(amountPaid) - (activeSale?.total || 0))}
                  </span>
                </div>
              )}

              {Number(amountPaid) < (activeSale?.total || 0) && Number(amountPaid) > 0 && activeSale?.customer_id && (
                <div className="p-4 bg-amber-50 rounded-2xl flex items-center justify-between">
                  <span className="text-sm text-amber-700 font-bold">Saldo a Deuda:</span>
                  <span className="text-xl font-black text-amber-700">
                    {formatCurrency((activeSale?.total || 0) - Number(amountPaid))}
                  </span>
                </div>
              )}

              <button
                onClick={closeSale}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
              >
                Confirmar y Cerrar Venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
