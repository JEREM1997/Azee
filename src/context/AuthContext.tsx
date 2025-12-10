import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { User, AuthState } from '../types';
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

// ✅ Emails soumis au filtrage IP
const MIGROS_IP_PROTECTED_EMAILS = [
  'migrosyverdon@krispykreme.internal',
  'migrosrenens@krispykreme.internal',
  'migrosmontreux@krispykreme.internal',
  'migroscrissier@krispykreme.internal',
  'migroschablais@krispykreme.internal',
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });
  const navigate = useNavigate();

  // Initialise l’état d’auth
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          let dbRole = session.user.user_metadata?.role || 'store';
          let dbStoreIds: string[] = session.user.user_metadata?.store_ids || [];

          try {
            const { data: roleRow, error: roleErr } = await supabase
              .from('user_roles')
              .select('role, store_ids')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!roleErr && roleRow) {
              dbRole = roleRow.role || dbRole;
              dbStoreIds = roleRow.store_ids || dbStoreIds;
            }
          } catch {
            // ignore, fallback metadata
          }

          const user: User = {
            id: session.user.id,
            email: session.user.email!,
            role: dbRole,
            storeIds: dbStoreIds,
            fullName: session.user.user_metadata?.full_name || session.user.email!,
          };
          setState({ user, loading: false, error: null });
        } else {
          setState({ user: null, loading: false, error: null });
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
              const user: User = {
                id: session.user.id,
                email: session.user.email!,
                role: session.user.user_metadata?.role || 'store',
                storeIds: session.user.user_metadata?.store_ids || [],
                fullName: session.user.user_metadata?.full_name || session.user.email!,
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

  const login = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // ✅ 1. Si email Migros → check IP via Edge Function
      if (MIGROS_IP_PROTECTED_EMAILS.includes(email.toLowerCase())) {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('ip-restricted-login', {
          body: { email },
        });

        if (fnError) {
          console.error('ip-restricted-login error:', fnError);
          throw fnError;
        }

        const result = fnData as any;

        if (!result?.allowed) {
          const msg =
            result?.message ||
            "Cet utilisateur ne peut se connecter qu'à partir du réseau Migros (IP not allowed for this account).";
          // 🔴 ici on enlève AppError → Error classique
          throw new Error(msg);
        }
      }

      // ✅ 2. Login normal Supabase
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
          fullName: data.user.user_metadata?.full_name || data.user.email!,
        };
        setState({ user, loading: false, error: null });
        navigate('/');
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: AppErrorHandler.handleAuthError('No user returned after signIn'),
        }));
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

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('No active session');

      const { data, error } = await supabase.functions.invoke('auth-role', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
