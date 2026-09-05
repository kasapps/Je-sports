import React, { useState } from 'react';
import { Lock, Loader2, Mail, KeyRound, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';

export default function Login() {
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Error Google OAuth:', err);
      setError(err.message || 'Error al iniciar sesión con Google. Si no está configurado en Supabase, utiliza inicio de sesión por correo.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor ingresa correo y contraseña.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: username || email.split('@')[0],
            },
          },
        });
        if (error) throw error;
        if (data?.session) {
          setMessage('Cuenta creada e iniciada con éxito.');
        } else {
          setMessage('Registro recibido. Revisa tu correo electrónico para confirmar la cuenta o inicia sesión.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Error al autenticar usuario.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
          <div className="p-8 bg-emerald-600 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">KAS SPORT</h1>
            <p className="text-emerald-100 text-sm mt-1">Punto de Venta e Inventario (Supabase)</p>
          </div>

          <div className="p-8 space-y-6">
            {!isSupabaseConfigured && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">Configuración de Supabase</p>
                  <p>Asegúrate de configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tus variables de entorno.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                {error}
              </div>
            )}

            {message && (
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium border border-emerald-100">
                {message}
              </div>
            )}

            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              type="button"
              className="w-full py-4 bg-white border-2 border-gray-100 hover:border-emerald-500 text-gray-700 rounded-2xl font-bold shadow-sm transition-all flex items-center justify-center gap-3 group"
            >
              {loading && !isEmailMode ? (
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              ) : (
                <>
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  <span>Continuar con Google</span>
                </>
              )}
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-gray-200 w-full"></div>
              <span className="bg-white px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">o</span>
              <div className="border-t border-gray-200 w-full"></div>
            </div>

            {/* Email Form Toggle */}
            {!isEmailMode ? (
              <button
                type="button"
                onClick={() => setIsEmailMode(true)}
                className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm transition-all border border-slate-200"
              >
                Acceder con Correo y Contraseña
              </button>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Tu nombre o negocio"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Correo Electrónico</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@kassport.com"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Contraseña</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isSignUp ? (
                    'Crear Cuenta'
                  ) : (
                    'Iniciar Sesión'
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-emerald-600 hover:underline font-semibold"
                  >
                    {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEmailMode(false)}
                    className="hover:underline text-gray-400"
                  >
                    Volver a Google
                  </button>
                </div>
              </form>
            )}

            <div className="text-center pt-2">
              <p className="text-xs text-gray-400">
                Acceso exclusivo para personal autorizado de KAS SPORT.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
