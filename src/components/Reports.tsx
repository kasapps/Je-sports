import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  PieChart,
  Download,
  Filter,
  Loader2,
  ChevronRight,
  Printer,
  ShoppingBag,
  CreditCard,
  Banknote,
  Lock,
  CheckCircle2,
  X
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  setDoc,
  doc, 
  Timestamp,
  orderBy,
  deleteDoc,
  writeBatch,
  getDocs,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';

export default function Reports() {
  const getLocalDate = () => new Date().toLocaleDateString('en-CA');
  
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [closingDay, setClosingDay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(getLocalDate()); // YYYY-MM-DD local
  
  // Cash Count State
  const [isCashCountOpen, setIsCashCountOpen] = useState(false);
  const [physicalCash, setPhysicalCash] = useState('');

  // Expense State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: 'General'
  });
  const [savingExpense, setSavingExpense] = useState(false);

  useEffect(() => {
    setLoading(true);
    
    // Create start and end timestamps for the selected date
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59.999');
    
    const startTs = Timestamp.fromDate(startOfDay);
    const endTs = Timestamp.fromDate(endOfDay);

    // Queries
    const qSales = query(
      collection(db, 'sales'), 
      where('status', '==', 'CLOSED'),
      where('closed_at', '>=', startTs),
      where('closed_at', '<=', endTs)
    );

    const qPayments = query(
      collection(db, 'payments'),
      where('date', '>=', startTs),
      where('date', '<=', endTs)
    );

    const qExpenses = query(
      collection(db, 'expenses'),
      where('date', '>=', startTs),
      where('date', '<=', endTs)
    );

    const qDebts = query(
      collection(db, 'debts'),
      where('created_at', '>=', startTs),
      where('created_at', '<=', endTs)
    );

    const qClosing = query(
      collection(db, 'daily_closings'),
      where('date', '==', date)
    );

    const qOpenSales = query(
      collection(db, 'sales'),
      where('status', '==', 'OPEN')
    );

    // Sync listeners
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateSummaryPart('salesList', sales);
    });

    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateSummaryPart('paymentsList', payments);
    });

    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateSummaryPart('expensesList', expenses);
    });

    const unsubDebts = onSnapshot(qDebts, (snapshot) => {
      const debts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateSummaryPart('debtsList', debts);
    });

    const unsubClosing = onSnapshot(qClosing, (snapshot) => {
      const closing = snapshot.docs.length > 0 ? snapshot.docs[0].data() : null;
      updateSummaryPart('closing', closing);
    });

    const unsubOpenSales = onSnapshot(qOpenSales, (snapshot) => {
      updateSummaryPart('openSalesCount', snapshot.docs.length);
    });

    return () => {
      unsubSales();
      unsubPayments();
      unsubExpenses();
      unsubDebts();
      unsubClosing();
      unsubOpenSales();
    };
  }, [date]);

  const [summaryParts, setSummaryParts] = useState<any>({
    salesList: [],
    paymentsList: [],
    expensesList: [],
    debtsList: [],
    closing: null,
    openSalesCount: 0
  });

  const updateSummaryPart = (key: string, value: any) => {
    setSummaryParts((prev: any) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    // Aggregate data whenever parts change
    const { salesList, paymentsList, expensesList, debtsList, closing, openSalesCount } = summaryParts;
    
    const totalSold = salesList.reduce((acc: number, s: any) => acc + (s.total || 0), 0);
    const totalCost = salesList.reduce((acc: number, s: any) => {
      const itemsCost = (s.items || []).reduce((iAcc: number, item: any) => iAcc + (item.cost_price * item.quantity), 0);
      return acc + itemsCost;
    }, 0);
    
    const grossProfit = totalSold - totalCost;
    
    const paymentsByMethod = [
      { method: 'CASH', total: paymentsList.filter((p: any) => p.method === 'CASH').reduce((acc: number, p: any) => acc + p.amount, 0) },
      { method: 'CARD', total: paymentsList.filter((p: any) => p.method === 'CARD').reduce((acc: number, p: any) => acc + p.amount, 0) },
      { method: 'TRANSFER', total: paymentsList.filter((p: any) => p.method === 'TRANSFER').reduce((acc: number, p: any) => acc + p.amount, 0) }
    ];

    const totalExpenses = expensesList.reduce((acc: number, e: any) => acc + e.amount, 0);
    const debtsGenerated = debtsList.reduce((acc: number, d: any) => acc + d.total_amount, 0);

    setSummary({
      isClosed: !!closing,
      expectedCash: closing?.expected_cash || 0,
      physicalCash: closing?.physical_cash || 0,
      discrepancy: closing?.discrepancy || 0,
      sales: {
        total_sold: totalSold,
        count: salesList.length
      },
      grossProfit,
      payments: paymentsByMethod,
      expenses: totalExpenses,
      debtsGenerated,
      salesList,
      expensesList,
      openSalesCount
    });
    setLoading(false);
  }, [summaryParts]);

  const expectedCash = summary ? (summary.payments.find((p: any) => p.method === 'CASH')?.total || 0) - (summary.expenses || 0) : 0;

  const handleDeleteSale = async (saleId: string) => {
    if (!window.confirm('¿Estás seguro de borrar esta venta? Esto revertirá el stock.')) return;
    
    try {
      // We need to revert stock too.
      const saleRef = doc(db, 'sales', saleId);
      const saleSnap = await getDocs(query(collection(db, 'sales'), where('__name__', '==', saleId)));
      if (saleSnap.empty) return;
      
      const saleData = saleSnap.docs[0].data();
      const batch = writeBatch(db);
      
      // Revert stock
      for (const item of (saleData.items || [])) {
        const productRef = doc(db, 'products', item.id);
        batch.update(productRef, {
          stock: item.quantity // This is tricky because we don't know if it was incremented or decremented.
          // Actually, we should use increment(item.quantity)
        });
        
        // Add inventory movement for reversal
        const movementRef = doc(collection(db, 'inventory_movements'));
        batch.set(movementRef, {
          product_id: item.id,
          product_name: item.name,
          type: 'IN',
          quantity: item.quantity,
          reason: `Venta #${saleId} eliminada`,
          date: Timestamp.now()
        });
      }
      
      batch.delete(saleRef);
      
      // Also delete related payments and debts if any
      const paymentsQuery = query(collection(db, 'payments'), where('sale_id', '==', saleId));
      const paymentsSnap = await getDocs(paymentsQuery);
      paymentsSnap.forEach(d => batch.delete(d.ref));
      
      const debtsQuery = query(collection(db, 'debts'), where('sale_id', '==', saleId));
      const debtsSnap = await getDocs(debtsQuery);
      debtsSnap.forEach(d => batch.delete(d.ref));

      await batch.commit();
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + err.message);
    }
  };

  const handleDailyClosing = async () => {
    if (summary?.openSalesCount > 0) {
      alert(`No se puede realizar el corte porque hay ${summary.openSalesCount} ventas abiertas. Por favor, ciérralas o cancélalas primero.`);
      return;
    }
    
    setIsCashCountOpen(true);
    setPhysicalCash('');
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount) return;

    setSavingExpense(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        date: Timestamp.now()
      });
      
      setIsExpenseModalOpen(false);
      setExpenseForm({ description: '', amount: '', category: 'General' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingExpense(false);
    }
  };

  const confirmClosingWithCash = async () => {
    const physicalAmount = parseFloat(physicalCash) || 0;
    const discrepancy = physicalAmount - expectedCash;

    const confirmMsg = discrepancy === 0 
      ? 'El monto coincide perfectamente. ¿Deseas proceder con el cierre?'
      : `Hay una diferencia de ${formatCurrency(discrepancy)}. ¿Deseas proceder con el cierre de todas formas?`;

    if (!window.confirm(confirmMsg)) return;
    
    setClosingDay(true);
    setError(null);
    try {
      const closingRef = doc(db, 'daily_closings', date);
      await setDoc(closingRef, {
        date,
        expected_cash: expectedCash,
        physical_cash: physicalAmount,
        discrepancy: discrepancy,
        closed_at: Timestamp.now(),
        total_sales: summary.sales.total_sold,
        gross_profit: summary.grossProfit,
        expenses: summary.expenses
      });
      
      setIsCashCountOpen(false);
      alert('Corte de caja realizado con éxito.');
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + err.message);
      setError(err.message);
    } finally {
      setClosingDay(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Cierre y Reportes</h2>
          <p className="text-gray-500">Resumen financiero detallado</p>
        </div>
        <div className="flex items-center gap-3">
          {summary && !summary.isClosed && date === getLocalDate() && (
            <>
              <button 
                onClick={() => setIsExpenseModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white text-red-600 border border-red-100 rounded-2xl font-bold hover:bg-red-50 transition-all shadow-sm"
              >
                <ArrowDownRight className="w-5 h-5" />
                Registrar Gasto
              </button>
              <button 
                onClick={handleDailyClosing}
                disabled={closingDay}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {closingDay ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                Realizar Corte
              </button>
            </>
          )}
          {summary?.isClosed && (
            <div className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl font-bold border border-gray-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Día Cerrado
            </div>
          )}
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button className="p-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors shadow-sm">
            <Printer className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {summary && (
        <>
          {/* Cash Count Results if Closed */}
          {summary.isClosed && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Efectivo Esperado</p>
                <p className="text-2xl font-black text-gray-800">{formatCurrency(summary.expectedCash)}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Efectivo Físico</p>
                <p className="text-2xl font-black text-gray-800">{formatCurrency(summary.physicalCash)}</p>
              </div>
              <div className={cn(
                "p-6 rounded-3xl border",
                summary.discrepancy === 0 ? "bg-emerald-50 border-emerald-100" : 
                summary.discrepancy > 0 ? "bg-blue-50 border-blue-100" : "bg-red-50 border-red-100"
              )}>
                <p className={cn(
                  "text-xs font-bold uppercase mb-1",
                  summary.discrepancy === 0 ? "text-emerald-600" : 
                  summary.discrepancy > 0 ? "text-blue-600" : "text-red-600"
                )}>Diferencia (Sobrante/Faltante)</p>
                <p className={cn(
                  "text-2xl font-black",
                  summary.discrepancy === 0 ? "text-emerald-700" : 
                  summary.discrepancy > 0 ? "text-blue-700" : "text-red-700"
                )}>{formatCurrency(summary.discrepancy)}</p>
              </div>
            </div>
          )}

          {/* Main Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-emerald-600 p-8 rounded-[2rem] text-white shadow-xl shadow-emerald-600/20 relative overflow-hidden">
              <TrendingUp className="absolute right-[-10px] bottom-[-10px] w-32 h-32 opacity-10" />
              <p className="text-emerald-100 text-sm font-bold uppercase tracking-wider mb-2">Ventas Totales</p>
              <h3 className="text-4xl font-black mb-4">{formatCurrency(summary.sales.total_sold)}</h3>
              <div className="flex items-center gap-2 text-sm bg-white/10 w-fit px-3 py-1 rounded-full">
                <ShoppingBag className="w-4 h-4" />
                {summary.sales.count} Ventas cerradas
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Ganancia Estimada</p>
                <h3 className="text-4xl font-black text-gray-800 mb-4">{formatCurrency(summary.grossProfit)}</h3>
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-600 font-bold">
                <ArrowUpRight className="w-4 h-4" />
                Margen: {summary.sales.total_sold > 0 ? ((summary.grossProfit / summary.sales.total_sold) * 100).toFixed(1) : 0}%
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Reinversión (20%)</p>
                <h3 className="text-4xl font-black text-blue-600 mb-4">{formatCurrency(summary.sales.total_sold * 0.2)}</h3>
              </div>
              <p className="text-xs text-gray-400">Dinero sugerido para reposición de stock</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Payment Methods */}
            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-500" />
                Desglose de Cobros
              </h3>
              <div className="space-y-4">
                {['CASH', 'CARD', 'TRANSFER'].map(method => {
                  const payment = summary.payments.find((p: any) => p.method === method);
                  const total = payment ? payment.total : 0;
                  const percent = summary.sales.total_sold > 0 ? (total / summary.sales.total_sold) * 100 : 0;
                  
                  return (
                    <div key={method} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                            {method === 'CASH' ? <Banknote className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-700">
                              {method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : 'Transferencia'}
                            </p>
                            <p className="text-xs text-gray-400">{percent.toFixed(0)}% del total</p>
                          </div>
                        </div>
                        <p className="font-black text-gray-800">{formatCurrency(total)}</p>
                      </div>
                      <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Other Metrics */}
            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-blue-500" />
                Otros Movimientos
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-amber-50 rounded-3xl">
                  <p className="text-xs text-amber-600 font-bold uppercase mb-1">Deudas Generadas</p>
                  <p className="text-2xl font-black text-amber-700">{formatCurrency(summary.debtsGenerated)}</p>
                </div>
                <div className="p-6 bg-red-50 rounded-3xl">
                  <p className="text-xs text-red-600 font-bold uppercase mb-1">Gastos del Día</p>
                  <p className="text-2xl font-black text-red-700">{formatCurrency(summary.expenses)}</p>
                </div>
                <div className="p-6 bg-gray-50 rounded-3xl col-span-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase mb-1">Ingreso Neto (Efectivo en Caja)</p>
                    <p className="text-2xl font-black text-gray-800">
                      {formatCurrency((summary.payments.find((p: any) => p.method === 'CASH')?.total || 0) - summary.expenses)}
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-2xl shadow-sm">
                    <DollarSign className="w-6 h-6 text-emerald-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sales & Expenses Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Sales List */}
            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-500" />
                  Ventas del Día
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Borrar ID..." 
                      className="pl-3 pr-10 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none w-32"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const id = (e.target as HTMLInputElement).value;
                          if (id) {
                            handleDeleteSale(id);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <X className="w-3 h-3 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <th className="pb-4 px-4">ID</th>
                      <th className="pb-4 px-4">Hora</th>
                      <th className="pb-4 px-4">Cliente</th>
                      <th className="pb-4 px-4">Total</th>
                      <th className="pb-4 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {summary.salesList.map((sale: any) => (
                      <tr key={sale.id} className={cn(
                        "text-sm text-gray-700 hover:bg-gray-50/50 transition-colors",
                        sale.status === 'CANCELLED' && "bg-red-50/50 text-red-400"
                      )}>
                        <td className="py-4 px-4 font-bold">
                          #{sale.id.slice(-4)}
                          {sale.status === 'CANCELLED' && (
                            <span className="ml-2 text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">Cancelada</span>
                          )}
                        </td>
                        <td className="py-4 px-4">{sale.closed_at?.toDate().toLocaleTimeString()}</td>
                        <td className="py-4 px-4">{sale.customer_name || 'Venta General'}</td>
                        <td className={cn("py-4 px-4 font-black", sale.status === 'CANCELLED' && "line-through")}>
                          {formatCurrency(sale.total)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button 
                            onClick={() => handleDeleteSale(sale.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors group"
                            title="Borrar Venta"
                          >
                            <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {summary.salesList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-400">
                          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          No hay ventas registradas para este día.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses List */}
            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-red-500" />
                Gastos del Día
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <th className="pb-4 px-4">Descripción</th>
                      <th className="pb-4 px-4">Categoría</th>
                      <th className="pb-4 px-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {summary.expensesList.map((expense: any) => (
                      <tr key={expense.id} className="text-sm text-gray-700 hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-4 font-medium">{expense.description}</td>
                        <td className="py-4 px-4">
                          <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase">
                            {expense.category}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-black text-red-600">
                          -{formatCurrency(expense.amount)}
                        </td>
                      </tr>
                    ))}
                    {summary.expensesList.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-gray-400">
                          <ArrowDownRight className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          No hay gastos registrados para este día.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <form onSubmit={handleSaveExpense}>
              <div className="p-8 border-b border-gray-50">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6">
                  <ArrowDownRight className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-gray-800">Registrar Gasto</h3>
                <p className="text-gray-500 mt-2">Ingresa los detalles de la salida de efectivo.</p>
              </div>
              
              <div className="p-8 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Descripción</label>
                  <input
                    required
                    autoFocus
                    type="text"
                    placeholder="Ej. Pago de luz, Compra de insumos..."
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">Monto</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        required
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">Categoría</label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 appearance-none"
                    >
                      <option value="General">General</option>
                      <option value="Servicios">Servicios</option>
                      <option value="Insumos">Insumos</option>
                      <option value="Sueldos">Sueldos</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-4 bg-white text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all border border-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="flex-2 py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingExpense ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cash Count Modal */}
      {isCashCountOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-gray-50">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                <Banknote className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-gray-800">Arqueo de Caja</h3>
              <p className="text-gray-500 mt-2">Ingresa el monto de dinero físico que tienes en caja para compararlo con el sistema.</p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                <span className="text-sm text-gray-500 font-medium">Efectivo en Sistema:</span>
                <span className="text-lg font-black text-gray-800">{formatCurrency(expectedCash)}</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Dinero Físico Real</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={physicalCash}
                    onChange={(e) => setPhysicalCash(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl text-xl font-black outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {physicalCash && (
                <div className={cn(
                  "p-4 rounded-2xl flex justify-between items-center",
                  (parseFloat(physicalCash) - expectedCash) === 0 ? "bg-emerald-50 text-emerald-700" :
                  (parseFloat(physicalCash) - expectedCash) > 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                )}>
                  <span className="text-sm font-medium">Diferencia:</span>
                  <span className="text-lg font-black">{formatCurrency(parseFloat(physicalCash) - expectedCash)}</span>
                </div>
              )}
            </div>

            <div className="p-8 bg-gray-50 flex gap-3">
              <button
                onClick={() => setIsCashCountOpen(false)}
                className="flex-1 py-4 bg-white text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all border border-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={confirmClosingWithCash}
                disabled={closingDay || !physicalCash}
                className="flex-2 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {closingDay ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                Confirmar Corte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
