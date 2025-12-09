import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { User, AuthState, AppError } from '../types';
import { AppErrorHandler, ErrorCodes } from '../utils/errorHandling';

const FUNCTIONS_URL =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ??
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const RESTRICTED_EMAILS = [
  'migrosyverdon@krispykreme.internal',
  'migrosrenens@krispykreme.internal',
  'migrosmontreux@krispykreme.internal',
  'migroscrissier@krispykreme.internal',
  'migroschablais@krispykreme.internal',
].map(e => e.toLowerCase());

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });
  const navigate = useNavigate();

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check for existing session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          // Fetch authoritative role & store ids from user_roles (fallback to metadata)
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
          } catch (_) {
            /* ignore – default to metadata */
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

        // Listen for auth changes
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
              // Handle token refresh
              console.log('Token refreshed');
            }
          }
        );

        // Cleanup subscription
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

      const normalizedEmail = email.toLowerCase();
      const isRestricted = RESTRICTED_EMAILS.includes(normalizedEmail);

      // 🔹 CAS 1 : emails Migros → on passe par la Edge Function (filtrage IP)
      if (isRestricted) {
        const response = await fetch(`${FUNCTIONS_URL}/ip-restricted-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({ email, password }),
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.error || 'LOGIN_FAILED');
        }

        const { session, user } = body;

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        if (sessionError) throw sessionError;

        if (user) {
          const appUser: User = {
            id: user.id,
            email: user.email!,
            role: user.user_metadata?.role || 'store',
            storeIds: user.user_metadata?.store_ids || [],
            fullName: user.user_metadata?.full_name || user.email!,
          };

          setState({ user: appUser, loading: false, error: null });
          navigate('/');
          return;
        }

        setState({ user: null, loading: false, error: null });
        return;
      }

      // 🔹 CAS 2 : tous les autres emails → login normal Supabase (comme avant)
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
        setState({ user: null, loading: false, error: null });
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

      // Call the auth-role Edge Function
      const { data, error } = await supabase.functions.invoke('auth-role', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Force session refresh to get new role
      await supabase.auth.refreshSession();

      // Update local state with new role
      if (state.user) {
        setState({
          user: {
            ...state.user,
            role: data.role,
            storeIds: data.store_ids || [],
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
