import React, { useState, useEffect } from 'react';
import { 
  Search, 
  CreditCard, 
  User, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Clock,
  ArrowRight,
  X,
  Loader2,
  Filter
} from 'lucide-react';
import { Debt } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';

export default function Debts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');

  useEffect(() => {
    const q = query(collection(db, 'debts'), where('status', '==', 'ACTIVE'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDebts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;

    const amount = Number(paymentAmount);
    const newRemaining = selectedDebt.remaining_amount - amount;

    try {
      const batch = writeBatch(db);

      // 1. Create Payment record
      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, {
        debt_id: selectedDebt.id,
        sale_id: selectedDebt.sale_id,
        amount: amount,
        method: paymentMethod,
        date: new Date().toISOString(),
        notes: `Abono a deuda de ${selectedDebt.customer_name}`
      });

      // 2. Update Debt
      const debtRef = doc(db, 'debts', selectedDebt.id);
      batch.update(debtRef, {
        remaining_amount: newRemaining,
        status: newRemaining <= 0 ? 'PAID' : 'ACTIVE',
        updated_at: new Date().toISOString()
      });

      await batch.commit();
      
      setSelectedDebt(null);
      setPaymentAmount('');
    } catch (err) {
      console.error('Error registering payment:', err);
      alert('Error al registrar el pago');
    }
  };

  const filteredDebts = debts.filter(d => 
    d.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre de cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDebts.map((debt) => (
            <div key={debt.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 font-bold text-xl">
                  {debt.customer_name[0].toUpperCase()}
                </div>
                <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Pendiente
                </span>
              </div>
              
              <h3 className="text-lg font-bold mb-1">{debt.customer_name}</h3>
              <p className="text-xs text-gray-400 flex items-center gap-1 mb-4">
                <Calendar className="w-3 h-3" />
                Venta #{debt.sale_id?.slice(-4)} • {formatDate(debt.created_at)}
              </p>

              <div className="grid grid-cols-2 gap-4 mt-6 p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400">Total Original</p>
                  <p className="text-sm font-bold text-gray-600">{formatCurrency(debt.total_amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400">Saldo Pendiente</p>
                  <p className="text-lg font-black text-red-500">{formatCurrency(debt.remaining_amount)}</p>
                </div>
              </div>

              <button 
                onClick={() => {
                  setSelectedDebt(debt);
                  setPaymentAmount(String(debt.remaining_amount));
                }}
                className="w-full mt-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10"
              >
                Registrar Abono
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
          {filteredDebts.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">No hay deudas activas</h3>
              <p className="text-gray-500">¡Todos tus clientes están al día!</p>
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {selectedDebt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-emerald-600 text-white flex items-center justify-between">
              <h3 className="text-xl font-bold">Registrar Abono</h3>
              <button onClick={() => setSelectedDebt(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handlePayment} className="p-8 space-y-6">
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500 font-bold uppercase">Cliente</p>
                <p className="text-xl font-bold text-gray-800">{selectedDebt.customer_name}</p>
                <div className="mt-4 p-4 bg-red-50 rounded-2xl">
                  <p className="text-xs text-red-600 font-bold uppercase">Saldo Pendiente</p>
                  <p className="text-3xl font-black text-red-600">{formatCurrency(selectedDebt.remaining_amount)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-bold text-gray-700">Monto del Abono</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-bold text-gray-700">Método de Pago</label>
                <div className="grid grid-cols-3 gap-3">
                  {['CASH', 'CARD', 'TRANSFER'].map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method as any)}
                      className={cn(
                        "py-3 rounded-xl border-2 font-bold text-xs transition-all",
                        paymentMethod === method 
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                          : "border-gray-100 text-gray-400 hover:border-gray-200"
                      )}
                    >
                      {method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : 'Transf.'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
              >
                Confirmar Pago
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
