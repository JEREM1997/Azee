import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminProvider } from './context/AdminContext';
import AuthGuard from './components/AuthGuard';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductionPage from './pages/ProductionPage';
import PlansPage from './pages/PlansPage';
import DeliveryPage from './pages/DeliveryPage';
import StatsPage from './pages/StatsPage';
import AdminPage from './pages/AdminPage';
import UsersPage from './pages/UsersPage';
import CreateUserPage from './pages/CreateUserPage';

// Component to handle global authentication errors
function AuthErrorHandler({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();

  useEffect(() => {
    // Listen for authentication errors globally
    const handleAuthError = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.error?.includes('Invalid token') || 
          customEvent.detail?.error?.includes('Session expired') ||
          customEvent.detail?.error?.includes('Authentication required')) {
        console.warn('Authentication error detected, logging out user');
        logout();
        window.location.href = '/login';
      }
    };

    // Listen for fetch errors that might indicate token issues
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (response.status === 401 || 
            (response.status === 400 && response.url.includes('supabase'))) {
          const text = await response.clone().text();
          if (text.includes('Invalid token') || text.includes('Session expired')) {
            console.warn('Invalid token detected in API response, redirecting to login');
            logout();
            window.location.href = '/login';
            return response;
          }
        }
        return response;
      } catch (error) {
        console.error('Fetch error:', error);
        throw error;
      }
    };

    window.addEventListener('auth-error', handleAuthError);

    return () => {
      window.removeEventListener('auth-error', handleAuthError);
      window.fetch = originalFetch;
    };
  }, [logout]);

  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AuthErrorHandler>
          <AdminProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<AuthGuard />}>
                <Route
                  path="/"
                  element={
                    <>
                      <Navbar />
                      <DashboardPage />
                    </>
                  }
                />
                <Route
                  path="/production"
                  element={
                    <>
                      <Navbar />
                      <ProductionPage />
                    </>
                  }
                />
                <Route
                  path="/plans"
                  element={
                    <>
                      <Navbar />
                      <PlansPage />
                    </>
                  }
                />
                <Route
                  path="/livraisons"
                  element={
                    <>
                      <Navbar />
                      <DeliveryPage />
                    </>
                  }
                />
                <Route
                  path="/statistiques"
                  element={
                    <>
                      <Navbar />
                      <StatsPage />
                    </>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <>
                      <Navbar />
                      <AdminPage />
                    </>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <>
                      <Navbar />
                      <UsersPage />
                    </>
                  }
                />
                <Route
                  path="/users/create"
                  element={
                    <>
                      <Navbar />
                      <CreateUserPage />
                    </>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </AdminProvider>
        </AuthErrorHandler>
      </AuthProvider>
    </Router>
  );
}

export default App;