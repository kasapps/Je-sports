import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Package, 
  CreditCard, 
  ArrowUpRight, 
  ShoppingCart, 
  Clock, 
  AlertTriangle 
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { formatCurrency } from '../lib/utils';
import { supabase } from '../supabase';

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

  const fetchDashboardData = async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;

    try {
      // 1. Sales today
      const { data: salesTodayData } = await supabase
        .from('sales')
        .select('total')
        .eq('status', 'CLOSED')
        .gte('closed_at', startOfDay)
        .lte('closed_at', endOfDay);

      const salesToday = (salesTodayData || []).reduce((acc, s) => acc + (Number(s.total) || 0), 0);

      // 2. Open sales count
      const { count: openSalesCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'OPEN');

      // 3. Active debts total
      const { data: debtsData } = await supabase
        .from('debts')
        .select('remaining_amount')
        .eq('status', 'ACTIVE');

      const activeDebts = (debtsData || []).reduce((acc, d) => acc + (Number(d.remaining_amount) || 0), 0);

      // 4. Products low stock
      const { data: productsData } = await supabase
        .from('products')
        .select('stock, min_stock')
        .eq('active', true);

      const lowStock = (productsData || []).filter(p => Number(p.stock) <= Number(p.min_stock)).length;

      // 5. Daily closing check
      const { data: closingData } = await supabase
        .from('daily_closings')
        .select('discrepancy')
        .eq('date', today)
        .maybeSingle();

      setStats({
        salesToday,
        activeDebts,
        lowStock,
        openSales: openSalesCount || 0,
        isClosed: Boolean(closingData),
        discrepancy: closingData?.discrepancy || 0
      });

      // 6. Weekly chart data
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

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const chartStart = `${sevenDaysAgo.toLocaleDateString('en-CA')}T00:00:00.000Z`;

      const { data: weeklySales } = await supabase
        .from('sales')
        .select('total, closed_at, created_at')
        .eq('status', 'CLOSED')
        .gte('closed_at', chartStart);

      (weeklySales || []).forEach(sale => {
        const dt = new Date(sale.closed_at || sale.created_at);
        const dateStr = dt.toLocaleDateString('en-CA');
        const dayEntry = last7Days.find(d => d.dateStr === dateStr);
        if (dayEntry) {
          dayEntry.ventas += Number(sale.total) || 0;
        }
      });

      setChartData(last7Days);
    } catch (e) {
      console.error('Error fetching dashboard metrics from Supabase:', e);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const channel = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debts' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_closings' }, () => fetchDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
          En tiempo real
        </div>
      </div>
      <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold mt-1 text-gray-800">{value}</p>
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
                El sistema ha registrado el cierre de hoy. 
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
            className="px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all text-sm"
          >
            Ver Reporte
          </button>
        </div>
      )}

      {/* Grid de Métricas */}
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
          title="Notas Abiertas en Caja" 
          value={stats.openSales} 
          icon={ShoppingCart} 
          color="bg-blue-500"
          onClick={() => setActiveTab('pos')}
        />
        <StatCard 
          title="Stock Bajo o Agotado" 
          value={stats.lowStock} 
          icon={AlertTriangle} 
          color="bg-red-500"
          onClick={() => setActiveTab('inventory')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico de Ventas de la Semana */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Ventas de la Semana</h3>
              <p className="text-sm text-gray-500">Resumen de ingresos diarios</p>
            </div>
            <span className="text-xs text-gray-400 font-semibold bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
              Últimos 7 días
            </span>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => `$${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [formatCurrency(Number(value)), 'Ventas']}
                />
                <Area type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-6">Acciones Rápidas</h3>
            <div className="space-y-4">
              <button 
                onClick={() => setActiveTab('pos')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors group"
              >
                <div className="p-2.5 bg-white rounded-xl shadow-sm group-hover:scale-105 transition-transform">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Nueva Venta (POS)</p>
                  <p className="text-xs opacity-70">Cobrar productos y registrar nota</p>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('products')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors group"
              >
                <div className="p-2.5 bg-white rounded-xl shadow-sm group-hover:scale-105 transition-transform">
                  <Package className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Agregar Producto</p>
                  <p className="text-xs opacity-70">Actualizar catálogo o existencias</p>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('debts')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors group"
              >
                <div className="p-2.5 bg-white rounded-xl shadow-sm group-hover:scale-105 transition-transform">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Cobrar Crédito</p>
                  <p className="text-xs opacity-70">Registrar abono de cliente</p>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">Base de Datos</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                Supabase Conectado
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
