import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { VendorsPage } from './pages/VendorsPage';
import { ItemsPage } from './pages/ItemsPage';
import { OrdersPage } from './pages/OrdersPage';
import { DeliveryPage } from './pages/DeliveryPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { ProductionPage } from './pages/ProductionPage';
import { ProductionLogPage } from './pages/ProductionLogPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="work-orders" element={<WorkOrdersPage />} />
            <Route path="production" element={<ProductionPage />} />
            <Route path="production-log" element={<ProductionLogPage />} />
            <Route path="delivery" element={<DeliveryPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="vendors" element={<VendorsPage />} />
            <Route path="items" element={<ItemsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
