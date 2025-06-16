import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isProduction: boolean;
  isStore: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setCurrentUser(null);
          setIsLoading(false);
          return;
        }

        // Get user role from metadata first
        const role = session.user.user_metadata?.role || 'store';
        
        setCurrentUser({
          id: session.user.id,
          email: session.user.email || '',
          fullName: session.user.user_metadata?.full_name || session.user.email || '',
          role: role,
          storeIds: session.user.user_metadata?.store_ids || (session.user.user_metadata?.store_id ? [session.user.user_metadata.store_id] : [])
        });
      } catch (error) {
        console.error('Error checking user:', error);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null);
        navigate('/login');
        return;
      }

      if (session) {
        const role = session.user.user_metadata?.role || 'store';
        
        setCurrentUser({
          id: session.user.id,
          email: session.user.email || '',
          fullName: session.user.user_metadata?.full_name || session.user.email || '',
          role: role,
          storeIds: session.user.user_metadata?.store_ids || (session.user.user_metadata?.store_id ? [session.user.user_metadata.store_id] : [])
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isLoading,
      isAuthenticated: !!currentUser,
      isAdmin: currentUser?.role === 'admin',
      isProduction: currentUser?.role === 'production',
      isStore: currentUser?.role === 'store',
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};