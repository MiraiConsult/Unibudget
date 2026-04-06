import React, { useState } from 'react';
import { supabase } from './services/supabaseClient';
import { X, Loader } from 'lucide-react';

interface AuthPageProps {
  onClose: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onClose }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLoginView) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // The onAuthStateChange listener will handle closing the modal by re-rendering AuthManager
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            }
          }
        });
        if (error) throw error;
        if (data.user) {
            setMessage('Conta criada! Verifique seu e-mail para confirmar e poder fazer o login.');
        }
      }
    } catch (err: any) {
      setError(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
          <X size={24} />
        </button>
        <div className="p-8">
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
            {isLoginView ? 'Bem-vindo de volta!' : 'Crie sua conta'}
          </h2>
          <p className="text-center text-slate-500 mb-6 text-sm">
            {isLoginView ? 'Acesse sua conta para continuar.' : 'Preencha os dados para começar.'}
          </p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLoginView && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="fullName">Nome Completo</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Seu nome"
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="voce@exemplo.com"
                className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            {error && <p className="text-danger-600 text-sm text-center">{error}</p>}
            {message && <p className="text-success-600 text-sm text-center">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white font-semibold py-3 rounded-lg hover:bg-primary-700 transition-colors disabled:bg-slate-400 flex justify-center items-center"
            >
              {loading ? <Loader className="animate-spin" /> : (isLoginView ? 'Entrar' : 'Criar conta')}
            </button>
          </form>

          <div className="text-center mt-6">
            <button
              onClick={() => {
                setIsLoginView(!isLoginView);
                setError(null);
                setMessage(null);
              }}
              className="text-sm text-primary-600 hover:underline font-medium"
            >
              {isLoginView ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
