import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { User, AuthState, AppError } from '../types';
import { AppErrorHandler, ErrorCodes } from '../utils/errorHandling';

// URL des Edge Functions Supabase
const FUNCTIONS_URL =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ??
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const navigate = useNavigate();

  // Initialisation de l'auth au chargement
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          // Rôle par défaut depuis les métadonnées
          let dbRole = session.user.user_metadata?.role || 'store';
          let dbStoreIds: string[] =
            session.user.user_metadata?.store_ids || [];

          // On essaie de surcharger avec la table user_roles
          try {
            const { data: roleRow, error: roleErr } = await supabase
              .from('user_roles')
              .select('role, store_ids')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!roleErr && roleRow) {
              dbRole = (roleRow as any).role || dbRole;
              dbStoreIds = (roleRow as any).store_ids || dbStoreIds;
            }
          } catch {
            // si ça échoue on garde les metadata
          }

          const user: User = {
            id: session.user.id,
            email: session.user.email!,
            role: dbRole,
            storeIds: dbStoreIds,
            fullName:
              session.user.user_metadata?.full_name ||
              session.user.email!,
          };

          setState({ user, loading: false, error: null });
        } else {
          setState({ user: null, loading: false, error: null });
        }

        // Écoute des changements d'état d'auth Supabase
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
   * LOGIN avec filtrage IP via l’Edge Function ip-restricted-login
   */
  const login = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // 1️⃣ Vérification IP AVANT le login Supabase
      try {
        const response = await fetch(
          `${FUNCTIONS_URL}/ip-restricted-login`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
          }
        );

        const data = await response.json().catch(() => null);

        // Cas : l’Edge Function décide que cet email n’a pas le droit
        // depuis cette IP → on bloque le login ici.
        if (
          response.ok &&
          data &&
          data.allowed === false
        ) {
          const ipError: AppError = {
            code: 'IP_NOT_ALLOWED' as any,
            // message générique comme à l’origine
            message:
              data.message ||
              'You are not authorized to perform this action',
          };

          setState(prev => ({
            ...prev,
            loading: false,
            error: ipError,
          }));
          return; // on NE tente PAS le signInWithPassword
        }

        // Si la réponse n’est pas ok mais que ce n’est pas explicitement
        // un refus d’IP, on log l’erreur et on continue quand même
        if (!response.ok) {
          console.warn(
            'IP check returned non-ok status, continuing login',
            await response.text()
          );
        }
      } catch (e) {
        // Si la vérification IP plante (réseau, etc.), on ne bloque pas le login
        console.error('IP check failed, continuing login', e);
      }

      // 2️⃣ IP OK (ou check en erreur) → login Supabase classique
      const { data, error } = await supabase.auth.signInWithPassword(
        {
          email,
          password,
        }
      );

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
      throw error; // pour que le composant Login puisse réagir
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

      // Appel de l’Edge Function auth-role
      const { data, error } = await supabase.functions.invoke(
        'auth-role',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error as any;

      // Refresh de session pour récupérer le nouveau rôle
      await supabase.auth.refreshSession();

      // Mise à jour de l’état local
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
