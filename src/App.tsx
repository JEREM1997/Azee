import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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

function App() {
  return (
    <Router>
      <AuthProvider>
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
      </AuthProvider>
    </Router>
  );
}

export default App;