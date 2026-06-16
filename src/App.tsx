import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SKIP_AUTH } from './lib/authConfig';
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
import { PrintTemplatesPage } from './pages/PrintTemplatesPage';
import { PrintTemplateEditorPage } from './pages/PrintTemplateEditorPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {!SKIP_AUTH && <Route path="/login" element={<LoginPage />} />}
          {SKIP_AUTH && <Route path="/login" element={<Navigate to="/" replace />} />}
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
            <Route path="settings/print-templates" element={<PrintTemplatesPage />} />
            <Route path="settings/print-templates/:id" element={<PrintTemplateEditorPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
