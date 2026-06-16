import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, skipAuth } = useAuth();

  if (loading) {
    return <div className="loading-spinner">로딩 중...</div>;
  }

  if (!skipAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
