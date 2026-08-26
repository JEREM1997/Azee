import React, { useState } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AppErrorHandler } from '../utils/errorHandling';
import krispyKremeOpsLogo from '../assets/krispy-kreme-ops-logo.png';
import doughnutsBackground from '../assets/doughnuts-background.jpg.jpg';
import KrispyKremeLoader from '../components/KrispyKremeLoader';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔹 On récupère aussi l'erreur gérée par AuthContext (pour IP Migros)
  const { login, error: authError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      // Login successful - navigation is handled in AuthContext
    } catch (error) {
      // Erreurs classiques (mauvais mot de passe, etc.)
      const appError = AppErrorHandler.handleAuthError(error);
      setError(appError.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-8 sm:px-6"
      style={{
        backgroundImage: `url(${doughnutsBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Background overlay for better readability */}
      <div className="absolute inset-0 bg-slate-950/55"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-emerald-950/20" />

      {/* Content container */}
      <main className="relative z-10 w-full max-w-[420px]">
        {/* White card background for the form */}
        <div className="rounded-2xl border border-white/60 bg-white p-5 shadow-2xl shadow-slate-950/25 sm:p-8">
          <div className="flex justify-center border-b border-slate-100 pb-5">
            <div className="flex justify-center">
              <img
                src={krispyKremeOpsLogo}
                alt="Krispy Kreme OPS"
                className="h-24 w-auto object-contain sm:h-28"
              />
            </div>
          </div>
          <div className="pt-6 text-center">
            <h1 className="text-2xl font-bold text-slate-900">Bienvenue</h1>
            <p className="mt-1 text-sm text-slate-500">Connectez-vous à votre espace opérations</p>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email-address" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Adresse e-mail
                </label>
                <div className="relative">
                <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-3 text-base text-slate-900 placeholder-slate-400 transition-colors hover:border-slate-400 focus:border-krispy-green focus:outline-none focus:ring-2 focus:ring-krispy-green/15"
                  placeholder="prenom.nom@entreprise.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Mot de passe
                </label>
                <div className="relative">
                <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-3 text-base text-slate-900 placeholder-slate-400 transition-colors hover:border-slate-400 focus:border-krispy-green focus:outline-none focus:ring-2 focus:ring-krispy-green/15"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                </div>
              </div>
            </div>

            {/* 🔴 Bloc d’erreur : combine l’erreur locale + l’erreur du AuthContext */}
            {(error || authError) && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4" role="alert" aria-live="assertive">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {authError?.code === 'IP_NOT_ALLOWED'
                        ? 'Veuillez vous connecter depuis le réseau Migros.'
                        : error || authError?.message}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`group relative flex min-h-12 w-full items-center justify-center rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-white shadow-sm transition duration-150 ${
                  isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-krispy-green hover:-translate-y-0.5 hover:bg-krispy-green-dark hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green active:translate-y-0'
                }`}
              >
                {isLoading && <KrispyKremeLoader size="sm" inline />}
                {isLoading ? 'Connexion en cours…' : 'Se connecter'}
              </button>
            </div>
          </form>
        </div>
        <p className="mt-5 text-center text-xs font-medium text-white/75">Portail interne sécurisé Krispy Kreme Operations</p>
      </main>
    </div>
  );
};

export default LoginPage;
