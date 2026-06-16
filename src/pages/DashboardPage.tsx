import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatNumber } from '../lib/formatNumber';
import {
  fetchDashboardLists,
  fetchDashboardStats,
} from '../services/dashboard';
import type { DashboardLists, DashboardStats, Order, ProductionLog } from '../types';
import { OrderStatusBadge, ProcessStatusBadge } from '../components/ui/Badge';

const STAT_CARDS = [
  { key: 'totalOrders' as const, label: '전체 수주', sub: '등록된 전체 수주 건', color: 'blue' },
  { key: 'dueSoon' as const, label: '납기 임박', sub: '7일 이내 납기 도래', color: 'orange' },
  { key: 'overdue' as const, label: '납기 지연', sub: '납기일 경과 수주', color: 'red' },
  { key: 'inProduction' as const, label: '생산중', sub: '공정 생산 진행 중', color: 'green' },
  { key: 'readyToShip' as const, label: '출하대기', sub: '출하 대기 수주', color: 'teal' },
  { key: 'partialDelivery' as const, label: '부분납품', sub: '부분 납품 진행 중', color: 'purple' },
  { key: 'todayDeliveries' as const, label: '오늘 납품', sub: '오늘 등록된 납품', color: 'indigo' },
  { key: 'todayProductionLogs' as const, label: '오늘 생산일보', sub: '오늘 등록된 일보', color: 'gray' },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lists, setLists] = useState<DashboardLists | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [s, l] = await Promise.all([
          fetchDashboardStats(),
          fetchDashboardLists(),
        ]);
        setStats(s);
        setLists(l);
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

  const dueSoonOrders = lists?.dueSoonOrders ?? [];
  const inProdOrders = lists?.inProductionOrders ?? [];
  const readyShipOrders = lists?.readyToShipOrders ?? [];
  const recentLogs = lists?.recentProductionLogs ?? [];

  return (
    <div className="dashboard-page">
      {error && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon" aria-hidden="true">!</span>
          <span className="alert-text">{error}</span>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">대시보드</h1>
          <p className="page-sub">금속가공 생산 현황 한눈에 보기</p>
        </div>
      </div>

      <div className="stats-grid-2x4">
        {STAT_CARDS.slice(0, 4).map((card) => (
          <div key={card.key} className={`stat-card stat-card--${card.color}`}>
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{formatNumber(stats?.[card.key] ?? 0)}</div>
            <div className="stat-sub">{card.sub}</div>
            <div className="mini-bars">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="mini-bar" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="stats-grid-2x4">
        {STAT_CARDS.slice(4).map((card) => (
          <div key={card.key} className={`stat-card stat-card--${card.color}`}>
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{formatNumber(stats?.[card.key] ?? 0)}</div>
            <div className="stat-sub">{card.sub}</div>
            <div className="mini-bars">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="mini-bar" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-panels">
        <div className="dash-panel">
          <div className="dash-panel-head">
            <span className="dash-panel-title">납기 임박 수주</span>
            <span className="dash-panel-more" onClick={() => navigate('/orders')}>
              전체보기 →
            </span>
          </div>
          <div>
            {dueSoonOrders.length === 0 ? (
              <div className="dash-panel-empty">납기 임박 수주가 없습니다.</div>
            ) : (
              dueSoonOrders.map((o) => (
                <OrderPanelRow key={o.id} order={o} />
              ))
            )}
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <span className="dash-panel-title">생산중 수주</span>
            <span className="dash-panel-more" onClick={() => navigate('/production')}>
              전체보기 →
            </span>
          </div>
          <div>
            {inProdOrders.length === 0 ? (
              <div className="dash-panel-empty">생산중인 수주가 없습니다.</div>
            ) : (
              inProdOrders.map((o) => (
                <OrderPanelRow key={o.id} order={o} />
              ))
            )}
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <span className="dash-panel-title">출하대기 수주</span>
            <span className="dash-panel-more" onClick={() => navigate('/orders')}>
              전체보기 →
            </span>
          </div>
          <div>
            {readyShipOrders.length === 0 ? (
              <div className="dash-panel-empty">출하대기 수주가 없습니다.</div>
            ) : (
              readyShipOrders.map((o) => (
                <OrderPanelRow key={o.id} order={o} />
              ))
            )}
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <span className="dash-panel-title">최근 생산일보</span>
            <span
              className="dash-panel-more"
              onClick={() => navigate('/production-log')}
            >
              전체보기 →
            </span>
          </div>
          <div>
            {recentLogs.length === 0 ? (
              <div className="dash-panel-empty">등록된 생산일보가 없습니다.</div>
            ) : (
              recentLogs.map((l) => (
                <ProductionLogPanelRow key={l.id} log={l} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderPanelRow({ order }: { order: Order }) {
  return (
    <div className="dash-panel-row">
      <OrderStatusBadge status={order.order_status} />
      <ProcessStatusBadge status={order.process_status} />
      <span>{order.customers?.customer_name ?? '-'}</span>
      <span>{order.order_no ?? '-'}</span>
      <span>{order.drawing_no ?? '-'}</span>
      <span className="text-muted">{order.due_date ?? '-'}</span>
    </div>
  );
}

function ProductionLogPanelRow({ log }: { log: ProductionLog }) {
  return (
    <div className="dash-panel-row">
      <span>{log.work_date}</span>
      <span>{log.worker_name}</span>
      <span>{log.customer_name ?? '-'}</span>
      <span>{log.drawing_no ?? '-'}</span>
      <span>생산 {formatNumber(log.production_quantity)}</span>
      <span className="text-muted">불량 {formatNumber(log.defect_quantity)}</span>
    </div>
  );
}
