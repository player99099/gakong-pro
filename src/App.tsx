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
import { PlaceholderPage } from './pages/PlaceholderPage';

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
            <Route
              path="work-orders"
              element={<PlaceholderPage title="작업지시" />}
            />
            <Route
              path="production"
              element={<PlaceholderPage title="생산관리" />}
            />
            <Route
              path="production-log"
              element={<PlaceholderPage title="생산일보" />}
            />
            <Route
              path="delivery"
              element={<PlaceholderPage title="납품관리" />}
            />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="vendors" element={<VendorsPage />} />
            <Route path="items" element={<ItemsPage />} />
            <Route
              path="settings"
              element={<PlaceholderPage title="설정" />}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
