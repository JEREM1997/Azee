import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminProvider } from './context/AdminContext';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import AuthGuard from './components/AuthGuard';
import Navbar from './components/Navbar';

// Lazy load pages
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProductionPage = React.lazy(() => import('./pages/ProductionPage'));
const DeliveryPage = React.lazy(() => import('./pages/DeliveryPage'));
const OrdersPage = React.lazy(() => import('./pages/OrdersPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const UsersPage = React.lazy(() => import('./pages/UsersPage'));
const CreateUserPage = React.lazy(() => import('./pages/CreateUserPage'));
const StatsPage = React.lazy(() => import('./pages/StatsPage'));
const PlansPage = React.lazy(() => import('./pages/PlansPage'));
const AuditPage = React.lazy(() => import('./pages/AuditPage'));

function DefaultLanding() {
  const { isAdmin, isProduction } = useAuth();

  if (isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isProduction) {
    return <Navigate to="/plans" replace />;
  }

  return <Navigate to="/orders" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <AdminProvider>
            <div className="min-h-screen bg-gray-50">
              <Suspense fallback={<LoadingSpinner fullScreen message="Loading application..." />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />

                  <Route element={<AuthGuard />}>
                    <Route element={<Navbar />}>
                      <Route path="/" element={<DefaultLanding />} />
                      <Route path="/order" element={<Navigate to="/orders" replace />} />
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/production" element={<ProductionPage />} />
                      <Route path="/orders" element={<OrdersPage />} />
                      <Route path="/delivery" element={<DeliveryPage />} />
                      <Route path="/admin" element={<AdminPage />} />
                      <Route path="/users" element={<UsersPage />} />
                      <Route path="/users/create" element={<CreateUserPage />} />
                      <Route path="/stats" element={<StatsPage />} />
                      <Route path="/plans" element={<PlansPage />} />
                      <Route path="/audit" element={<AuditPage />} />
                    </Route>
                  </Route>

                  <Route
                    path="*"
                    element={
                      <div className="min-h-screen flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <h1 className="text-4xl font-bold text-gray-900">404</h1>
                          <p className="mt-2 text-lg text-gray-600">Page not found</p>
                          <div className="mt-6">
                            <a
                              href="/"
                              className="text-base font-medium text-krispy-green hover:text-krispy-green-dark"
                            >
                              Go back home<span aria-hidden="true"> &rarr;</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    }
                  />
                </Routes>
              </Suspense>
            </div>
          </AdminProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

