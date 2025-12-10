import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { User, AuthState, AppError } from '../types';
import { AppErrorHandler } from '../utils/errorHandling';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserRole: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isProduction: boolean;
  isStore: boolean;
  currentUser: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ✅ Emails Migros soumis au filtrage IP
const MIGROS_IP_PROTECTED_EMAILS = [
  'migrosyverdon@krispykreme.internal',
  'migrosrenens@krispykreme.internal',
  'migrosmontreux@krispykreme.internal',
  'migroscrissier@krispykreme.internal',
  'migroschablais@krispykreme.internal',
].map(e => e.toLowerCase());

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const navigate = useNavigate();

  // 🔹 Initialisation de la session au chargement
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          // ➜ On prend le rôle & les stores depuis les metadata
          const user: User = {
            id: session.user.id,
            email: session.user.email!,
            role: session.user.user_metadata?.role || 'store',
            storeIds: session.user.user_metadata?.store_ids || [],
            fullName:
              session.user.user_metadata?.full_name ||
              session.user.email!,
          };

          setState({ user, loading: false, error: null });
        } else {
          setState({ user: null, loading: false, error: null });
        }

        // 🔹 Abonnement aux changements d’auth
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
              const user: User = {
                id: session.user.id,
                email: session.user.email!,
                role: session.user.user_metadata?.role || 'store',
                storeIds:
                  session.user.user_metadata?.store_ids || [],
                fullName:
                  session.user.user_metadata?.full_name ||
                  session.user.email!,
              };
              setState({ user, loading: false, error: null });
            } else if (event === 'SIGNED_OUT') {
              setState({ user: null, loading: false, error: null });
              navigate('/login');
            } else if (event === 'TOKEN_REFRESHED') {
              console.log('Token refreshed');
            }
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        setState({
          user: null,
          loading: false,
          error: AppErrorHandler.handleAuthError(error),
        });
      }
    };

    initializeAuth();
  }, [navigate]);

  /**
   * LOGIN avec filtrage IP pour les emails Migros
   */
  const login = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const normalizedEmail = email.toLowerCase().trim();
      const isMigros = MIGROS_IP_PROTECTED_EMAILS.includes(normalizedEmail);

      // 1️⃣ Si email Migros → on DOIT passer par l'edge function
      if (isMigros) {
        try {
          const { data: fnData, error: fnError } =
            await supabase.functions.invoke('ip-restricted-login', {
              body: { email: normalizedEmail },
            });

          if (fnError) {
            console.error('ip-restricted-login error:', fnError);
            const ipError: AppError = {
              code: 'IP_NOT_ALLOWED' as any,
              message: 'Veuillez vous connecter depuis le réseau Migros.',
            };
            setState(prev => ({
              ...prev,
              loading: false,
              error: ipError,
            }));
            return;
          }

          const result = fnData as any;

          // Si la fonction ne renvoie pas allowed === true → on bloque
          if (!result || result.allowed !== true) {
            const ipError: AppError = {
              code: 'IP_NOT_ALLOWED' as any,
              message: 'Veuillez vous connecter depuis le réseau Migros.',
            };
            setState(prev => ({
              ...prev,
              loading: false,
              error: ipError,
            }));
            return;
          }

          // Sinon (allowed === true) → on continue vers le login Supabase
        } catch (e) {
          console.error('ip-restricted-login invoke failed:', e);
          const ipError: AppError = {
            code: 'IP_NOT_ALLOWED' as any,
            message: 'Veuillez vous connecter depuis le réseau Migros.',
          };
          setState(prev => ({
            ...prev,
            loading: false,
            error: ipError,
          }));
          return;
        }
      }

      // 2️⃣ Login Supabase classique
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email!,
          role: data.user.user_metadata?.role || 'store',
          storeIds: data.user.user_metadata?.store_ids || [],
          fullName:
            data.user.user_metadata?.full_name ||
            data.user.email!,
        };
        setState({ user, loading: false, error: null });
        navigate('/');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: AppErrorHandler.handleAuthError(error),
      }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setState({ user: null, loading: false, error: null });
      navigate('/login');
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: AppErrorHandler.handleAuthError(error),
      }));
    }
  };

  const updateUserRole = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('No active session');

      const { data, error } = await supabase.functions.invoke('auth-role', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error as any;

      // ➜ la fonction met à jour les metadata, on rafraîchit la session
      await supabase.auth.refreshSession();

      if (state.user) {
        setState({
          user: {
            ...state.user,
            role: (data as any).role,
            storeIds: (data as any).store_ids || [],
          },
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: AppErrorHandler.handleAuthError(error),
      }));
    }
  };

  const value: AuthContextType = {
    ...state,
    currentUser: state.user,
    login,
    logout,
    updateUserRole,
    isAuthenticated: !!state.user,
    isAdmin: state.user?.role === 'admin',
    isProduction: state.user?.role === 'production',
    isStore: state.user?.role === 'store',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

