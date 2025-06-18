import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import krispyKremeOpsLogo from '../assets/krispy-kreme-ops-logo.png';
import doughnutsBackground from '../assets/doughnuts-background.jpg.jpg';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const maxRetries = 3;

  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate('/');
        }
      } catch (error) {
        console.error('Auth check error:', error);
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLoginError = (error: any) => {
    console.error('Login error details:', JSON.stringify(error, null, 2));
    
    if (error.status === 503 || error.message?.includes('connect error')) {
      return 'Impossible de se connecter au serveur. Veuillez réessayer dans quelques instants.';
    }
    
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Nom d\'utilisateur ou mot de passe incorrect. Veuillez vérifier vos informations.';
      case 'Email not confirmed':
        return 'Votre compte n\'a pas encore été activé. Veuillez contacter votre administrateur.';
      case 'Too many requests':
        return 'Trop de tentatives de connexion. Veuillez réessayer plus tard.';
      default:
        return 'Une erreur est survenue lors de la connexion. Veuillez réessayer.';
    }
  };

  const attemptLogin = async (email: string, password: string) => {
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) throw signInError;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isAdminLogin = username.includes('@');
      const email = isAdminLogin ? username : `${username}@krispykreme.internal`;

      let loginResult;
      let currentRetry = 0;

      do {
        loginResult = await attemptLogin(email, password);
        
        if (loginResult.error) {
          if (loginResult.error.status === 503 && currentRetry < maxRetries) {
            currentRetry++;
            setRetryCount(currentRetry);
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, currentRetry) * 1000));
            continue;
          }
          throw loginResult.error;
        }

        break;
      } while (currentRetry < maxRetries);

      if (loginResult.data?.session) {
        navigate('/');
      } else {
        throw new Error('No session returned after successful login');
      }
    } catch (error: any) {
      setError(handleLoginError(error));
    } finally {
      setLoading(false);
      setRetryCount(0);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative"
      style={{
        backgroundImage: `url(${doughnutsBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Background overlay for better readability */}
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>
      
      {/* Content container */}
      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* White card background for the form */}
        <div className="bg-white rounded-xl shadow-2xl p-8 backdrop-blur-sm">
          <div className="-mt-20">
            <div className="flex justify-center">
              <img 
                src={krispyKremeOpsLogo}
                alt="Krispy Kreme OPS"
                className="h-72 w-auto"
              />
            </div>
          </div>
          
          <form className="-mt-6 space-y-6" onSubmit={handleLogin}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="username" className="sr-only">Nom d'utilisateur</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-krispy-green focus:border-krispy-green focus:z-10 sm:text-sm"
                  placeholder="Nom d'utilisateur"
                  autoComplete="username"
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">Mot de passe</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-krispy-green focus:border-krispy-green focus:z-10 sm:text-sm"
                  placeholder="Mot de passe"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {retryCount > 0 && (
              <div className="text-sm text-gray-600 text-center">
                Tentative de reconnexion ({retryCount}/{maxRetries})...
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
              >
                {loading ? (
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <div className="h-5 w-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                  </span>
                ) : null}
                Se connecter
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;