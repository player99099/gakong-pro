import { useEffect, useState } from 'react';
import {
  fetchDashboardStats,
  fetchRecentOrders,
} from '../services/dashboard';
import type { DashboardStats, Order } from '../types';
import { OrderStatusBadge, ProcessStatusBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [s, orders] = await Promise.all([
          fetchDashboardStats(),
          fetchRecentOrders(),
        ]);
        setStats(s);
        setRecentOrders(orders);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.',
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="loading-spinner">로딩 중...</div>;

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-label">전체 수주</div>
          <div className="stat-value">{stats?.totalOrders ?? 0}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">납기 임박 (7일 이내)</div>
          <div className="stat-value">{stats?.dueSoon ?? 0}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">납기 지연</div>
          <div className="stat-value">{stats?.overdue ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">출하대기</div>
          <div className="stat-value">{stats?.readyToShip ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">부분납품</div>
          <div className="stat-value">{stats?.partialDelivery ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">최근 수주 목록</div>
        <div className="card-body" style={{ padding: 0 }}>
          {recentOrders.length === 0 ? (
            <EmptyState message="등록된 수주가 없습니다." />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>공정상태</th>
                    <th>거래처</th>
                    <th>발주번호</th>
                    <th>도번</th>
                    <th>품명</th>
                    <th>수량</th>
                    <th>납기일</th>
                    <th className="text-right">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <OrderStatusBadge status={order.order_status} />
                      </td>
                      <td>
                        <ProcessStatusBadge status={order.process_status} />
                      </td>
                      <td>{order.customers?.customer_name ?? '-'}</td>
                      <td>{order.order_no ?? '-'}</td>
                      <td>{order.drawing_no ?? '-'}</td>
                      <td>{order.item_name ?? '-'}</td>
                      <td>{order.order_quantity}</td>
                      <td>{order.due_date ?? '-'}</td>
                      <td className="text-right">
                        {order.total_amount?.toLocaleString() ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
