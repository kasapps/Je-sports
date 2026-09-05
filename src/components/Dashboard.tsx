import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Package, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight,
  ShoppingCart,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { formatCurrency } from '../lib/utils';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';

export default function Dashboard({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const [stats, setStats] = useState({
    salesToday: 0,
    activeDebts: 0,
    lowStock: 0,
    openSales: 0,
    isClosed: false,
    discrepancy: 0
  });

  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA');
    const startOfDay = new Date(today + 'T00:00:00');
    const endOfDay = new Date(today + 'T23:59:59.999');
    const startTs = Timestamp.fromDate(startOfDay);
    const endTs = Timestamp.fromDate(endOfDay);
    
    // Real-time stats from Firestore
    const unsubSalesToday = onSnapshot(query(
      collection(db, 'sales'), 
      where('status', '==', 'CLOSED'),
      where('closed_at', '>=', startTs),
      where('closed_at', '<=', endTs)
    ), (snapshot) => {
      const total = snapshot.docs.reduce((acc, doc) => acc + (doc.data().total || 0), 0);
      setStats(prev => ({ ...prev, salesToday: total }));
    });

    const unsubOpenSales = onSnapshot(query(collection(db, 'sales'), where('status', '==', 'OPEN')), (snapshot) => {
      setStats(prev => ({ ...prev, openSales: snapshot.docs.length }));
    });

    const unsubDebts = onSnapshot(query(collection(db, 'debts'), where('status', '==', 'ACTIVE')), (snapshot) => {
      const totalDebt = snapshot.docs.reduce((acc, doc) => acc + (doc.data().remaining_amount || 0), 0);
      setStats(prev => ({ ...prev, activeDebts: totalDebt }));
    });

    const unsubProducts = onSnapshot(query(collection(db, 'products'), where('active', '==', true)), (snapshot) => {
      const lowStockCount = snapshot.docs.filter(doc => doc.data().stock <= doc.data().min_stock).length;
      setStats(prev => ({ ...prev, lowStock: lowStockCount }));
    });

    const unsubClosing = onSnapshot(query(collection(db, 'daily_closings'), where('date', '==', today)), (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setStats(prev => ({ ...prev, isClosed: true, discrepancy: data.discrepancy }));
      } else {
        setStats(prev => ({ ...prev, isClosed: false, discrepancy: 0 }));
      }
    });

    // Weekly Chart Data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const chartStartTs = Timestamp.fromDate(sevenDaysAgo);

    const unsubChart = onSnapshot(query(
      collection(db, 'sales'),
      where('status', '==', 'CLOSED'),
      where('closed_at', '>=', chartStartTs)
    ), (snapshot) => {
      const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          name: days[d.getDay()],
          dateStr: d.toLocaleDateString('en-CA'),
          ventas: 0
        };
      });

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const saleDate = data.closed_at?.toDate().toLocaleDateString('en-CA');
        const dayEntry = last7Days.find(d => d.dateStr === saleDate);
        if (dayEntry) {
          dayEntry.ventas += (data.total || 0);
        }
      });

      setChartData(last7Days);
    });

    return () => {
      unsubSalesToday();
      unsubOpenSales();
      unsubDebts();
      unsubProducts();
      unsubClosing();
      unsubChart();
    };
  }, []);

  const data = [
    { name: 'Lun', ventas: 4000 },
    { name: 'Mar', ventas: 3000 },
    { name: 'Mie', ventas: 2000 },
    { name: 'Jue', ventas: 2780 },
    { name: 'Vie', ventas: 1890 },
    { name: 'Sab', ventas: 2390 },
    { name: 'Dom', ventas: 3490 },
  ];

  const StatCard = ({ title, value, icon: Icon, color, onClick }: any) => (
    <div 
      onClick={onClick}
      className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${color} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
          <ArrowUpRight className="w-4 h-4" />
          +12%
        </div>
      </div>
      <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );

  return (
    <div className="space-y-8">
      {stats.isClosed && (
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900">Corte del día realizado</h4>
              <p className="text-sm text-amber-700">
                El sistema está en modo lectura. 
                {stats.discrepancy !== 0 && (
                  <span className={`ml-1 font-bold ${stats.discrepancy > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    Diferencia en caja: {formatCurrency(stats.discrepancy)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('reports')}
            className="px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all"
          >
            Ver Reporte
          </button>
        </div>
      )}
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Ventas de Hoy" 
          value={formatCurrency(stats.salesToday)} 
          icon={TrendingUp} 
          color="bg-emerald-500"
          onClick={() => setActiveTab('reports')}
        />
        <StatCard 
          title="Deudas Pendientes" 
          value={formatCurrency(stats.activeDebts)} 
          icon={CreditCard} 
          color="bg-amber-500"
          onClick={() => setActiveTab('debts')}
        />
        <StatCard 
          title="Cuentas Abiertas" 
          value={stats.openSales} 
          icon={ShoppingCart} 
          color="bg-blue-500"
          onClick={() => setActiveTab('pos')}
        />
        <StatCard 
          title="Stock Bajo" 
          value={stats.lowStock} 
          icon={AlertTriangle} 
          color="bg-red-500"
          onClick={() => setActiveTab('inventory')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold">Ventas de la Semana</h3>
              <p className="text-sm text-gray-500">Resumen de ingresos diarios</p>
            </div>
            <select className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
              <option>Últimos 7 días</option>
              <option>Últimos 30 días</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => `$${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Area type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity / Quick Actions */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6">Acciones Rápidas</h3>
          <div className="space-y-4">
            <button 
              onClick={() => setActiveTab('pos')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors group"
            >
              <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Nueva Venta</p>
                <p className="text-xs opacity-70">Abrir ticket de compra</p>
              </div>
            </button>

            <button 
              onClick={() => setActiveTab('products')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors group"
            >
              <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                <Package className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Agregar Producto</p>
                <p className="text-xs opacity-70">Actualizar catálogo</p>
              </div>
            </button>

            <button 
              onClick={() => setActiveTab('debts')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors group"
            >
              <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Cobrar Deuda</p>
                <p className="text-xs opacity-70">Registrar abonos</p>
              </div>
            </button>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-sm">Estado de Caja</h4>
              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded">Abierta</span>
            </div>
            <div className="flex items-center gap-3 text-gray-500 text-sm">
              <Clock className="w-4 h-4" />
              <span>Último cierre: Ayer 20:30</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
