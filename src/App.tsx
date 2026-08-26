import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminProvider } from './context/AdminContext';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import AuthGuard from './components/AuthGuard';
import Navbar from './components/Navbar';
import { ArrowLeft, MapPinOff } from 'lucide-react';

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
            <div className="app-shell min-h-screen">
              <Suspense fallback={<LoadingSpinner fullScreen size="large" message="Préparation de votre espace…" />}>
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
                      <div className="min-h-screen flex items-center justify-center bg-[#f3f7f4] p-5">
                        <div className="surface-card max-w-lg px-7 py-14 text-center sm:px-14">
                          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-krispy-green"><MapPinOff className="h-8 w-8" /></span>
                          <p className="eyebrow mt-6">Erreur 404</p>
                          <h1 className="page-heading mt-2">Cette page n’existe pas</h1>
                          <p className="page-description mx-auto">Le lien a peut-être changé. Revenez à votre espace pour poursuivre vos opérations.</p>
                          <a href="/" className="btn-primary mt-7"><ArrowLeft className="h-4 w-4" />Retour à mon espace</a>
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
