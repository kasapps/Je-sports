import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  CreditCard, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  AlertCircle, 
  TrendingUp, 
  Wallet, 
  Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import Products from './components/Products';
import POS from './components/POS';
import Debts from './components/Debts';
import Reports from './components/Reports';
import Inventory from './components/Inventory';
import Login from './components/Login';
import SettingsView from './components/Settings';
import { User } from './types';
import { supabase } from './supabase';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-red-100 max-w-md w-full text-center">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">Algo salió mal</h3>
            <p className="text-gray-500 mb-6">Ha ocurrido un error inesperado en la aplicación.</p>
            <div className="bg-gray-50 p-4 rounded-2xl text-left mb-8 overflow-auto max-h-40">
              <p className="text-xs font-mono text-red-600">{this.state.error?.toString()}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-md"
            >
              Reiniciar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authUser: any) => {
    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      // Buscar perfil en tabla public.profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profile) {
        setUser({
          id: profile.id,
          email: profile.email || authUser.email,
          username: profile.username || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuario',
          role: profile.role || (authUser.email === 'farmacia.soluciones.5@gmail.com' ? 'admin' : 'seller'),
        });
      } else {
        // Crear perfil si aún no existe
        const defaultRole = authUser.email === 'farmacia.soluciones.5@gmail.com' ? 'admin' : 'seller';
        const defaultName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario';
        
        const newProfile = {
          id: authUser.id,
          email: authUser.email,
          username: defaultName,
          role: defaultRole,
        };

        const { error: insertError } = await supabase
          .from('profiles')
          .insert(newProfile);

        if (insertError) {
          console.warn("Could not insert profile (RLS or trigger handled it):", insertError);
        }

        setUser({
          id: authUser.id,
          email: authUser.email,
          username: defaultName,
          role: defaultRole,
        });
      }
    } catch (err) {
      console.error("Error loading user profile:", err);
      // Fallback seguro usando datos de authUser
      setUser({
        id: authUser.id,
        email: authUser.email,
        username: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuario',
        role: authUser.email === 'farmacia.soluciones.5@gmail.com' ? 'admin' : 'seller',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // 2. Suscribirse a cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchUserProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard },
    { id: 'pos', label: 'Ventas / Caja', icon: ShoppingCart },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'products', label: 'Productos', icon: Package },
    { id: 'inventory', label: 'Inventario', icon: TrendingUp },
    { id: 'debts', label: 'Deudas y Pagos', icon: CreditCard },
    { id: 'reports', label: 'Reportes y Cierre', icon: BarChart3 },
    ...(user?.role === 'admin' ? [{ id: 'settings', label: 'Configuración', icon: Settings }] : []),
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard setActiveTab={setActiveTab} />;
      case 'customers': return <Customers />;
      case 'products': return <Products />;
      case 'pos': return <POS />;
      case 'debts': return <Debts />;
      case 'reports': return <Reports />;
      case 'inventory': return <Inventory />;
      case 'settings': return <SettingsView />;
      default: return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans overflow-hidden">
        {/* Sidebar */}
        <motion.aside 
          initial={false}
          animate={{ width: isSidebarOpen ? 280 : 80 }}
          className="bg-[#151619] text-white flex flex-col shadow-2xl z-20 shrink-0"
        >
          <div className="p-6 flex items-center justify-between">
            <AnimatePresence mode="wait">
              {isSidebarOpen && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-xl tracking-tight">KAS SPORT</span>
                </motion.div>
              )}
            </AnimatePresence>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  activeTab === item.id 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.id ? 'text-white' : 'group-hover:text-white'}`} />
                {isSidebarOpen && <span className="font-medium whitespace-nowrap">{item.label}</span>}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isSidebarOpen ? 'bg-white/5' : ''}`}>
              <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 font-bold">
                {user.username ? user.username[0].toUpperCase() : 'U'}
              </div>
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user.username}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
              )}
              <button 
                onClick={handleLogout}
                title="Cerrar sesión"
                className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Header */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10">
            <h2 className="text-lg font-semibold text-gray-800">
              {navItems.find(i => i.id === activeTab)?.label}
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full text-emerald-700 text-sm font-medium">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span>Supabase Conectado</span>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-7xl mx-auto"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
