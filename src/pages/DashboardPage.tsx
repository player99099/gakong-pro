import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchDashboardLists,
  fetchDashboardStats,
} from '../services/dashboard';
import type { DashboardLists, DashboardStats } from '../types';
import { OrderStatusBadge, ProcessStatusBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

type KpiTone =
  | 'blue'
  | 'amber'
  | 'red'
  | 'indigo'
  | 'teal'
  | 'cyan'
  | 'green'
  | 'slate';

const KPI_CARDS: {
  key: keyof DashboardStats;
  label: string;
  desc: string;
  tone: KpiTone;
}[] = [
  { key: 'totalOrders', label: '전체 수주', desc: '등록된 전체 수주 건', tone: 'blue' },
  { key: 'dueSoon', label: '납기 임박', desc: '7일 이내 납기 도래', tone: 'amber' },
  { key: 'overdue', label: '납기 지연', desc: '납기일 경과 수주', tone: 'red' },
  { key: 'inProduction', label: '생산중', desc: '공정 생산 진행 중', tone: 'indigo' },
  { key: 'readyToShip', label: '출하대기', desc: '출하 대기 수주', tone: 'teal' },
  { key: 'partialDelivery', label: '부분납품', desc: '부분 납품 진행 중', tone: 'cyan' },
  { key: 'todayDeliveries', label: '오늘 납품', desc: '오늘 등록된 납품', tone: 'green' },
  { key: 'todayProductionLogs', label: '오늘 생산일보', desc: '오늘 등록된 일보', tone: 'slate' },
];

export function DashboardPage() {
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

  return (
    <div className="dashboard-page">
      {error && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon" aria-hidden="true">!</span>
          <span className="alert-text">{error}</span>
        </div>
      )}

      <div className="stats-grid stats-grid--dashboard">
        {KPI_CARDS.map((card) => (
          <div key={card.key} className={`kpi-card kpi-card--${card.tone}`}>
            <div className="kpi-card-top">
              <span className="kpi-card-label">{card.label}</span>
              <span className="kpi-card-dot" aria-hidden="true" />
            </div>
            <div className="kpi-card-value">{stats?.[card.key] ?? 0}</div>
            <div className="kpi-card-desc">{card.desc}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <DashboardPanel
          title="납기 임박 수주"
          linkTo="/orders"
          emptyMessage="납기 임박 수주가 없습니다."
          emptySubMessage="수주관리에서 새 항목을 등록해 주세요."
        >
          {lists?.dueSoonOrders.length ? (
            <OrderMiniTable orders={lists.dueSoonOrders} />
          ) : null}
        </DashboardPanel>

        <DashboardPanel
          title="생산중 수주"
          linkTo="/production"
          emptyMessage="생산중인 수주가 없습니다."
          emptySubMessage="생산관리에서 공정 상태를 확인해 주세요."
        >
          {lists?.inProductionOrders.length ? (
            <OrderMiniTable orders={lists.inProductionOrders} />
          ) : null}
        </DashboardPanel>

        <DashboardPanel
          title="출하대기 수주"
          linkTo="/delivery"
          emptyMessage="출하대기 수주가 없습니다."
          emptySubMessage="생산관리에서 출하대기로 전환해 주세요."
        >
          {lists?.readyToShipOrders.length ? (
            <OrderMiniTable orders={lists.readyToShipOrders} />
          ) : null}
        </DashboardPanel>

        <DashboardPanel
          title="최근 생산일보"
          linkTo="/production-log"
          emptyMessage="등록된 생산일보가 없습니다."
          emptySubMessage="생산일보에서 작업 실적을 입력해 주세요."
        >
          {lists?.recentProductionLogs.length ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>작업일</th>
                    <th>작업자</th>
                    <th>고객사</th>
                    <th>도번</th>
                    <th>생산</th>
                    <th>불량</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.recentProductionLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.work_date}</td>
                      <td>{log.worker_name}</td>
                      <td>{log.customer_name ?? '-'}</td>
                      <td>{log.drawing_no ?? '-'}</td>
                      <td>{Number(log.production_quantity)}</td>
                      <td>{Number(log.defect_quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </DashboardPanel>

        <DashboardPanel
          title="최근 납품"
          linkTo="/delivery"
          emptyMessage="등록된 납품이 없습니다."
          emptySubMessage="납품관리에서 납품을 등록해 주세요."
        >
          {lists?.recentDeliveries.length ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>납품일</th>
                    <th>고객사</th>
                    <th>발주번호</th>
                    <th>품목수</th>
                    <th className="text-right">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.recentDeliveries.map((d) => (
                    <tr key={d.id}>
                      <td>{d.delivery_date}</td>
                      <td>{d.customers?.customer_name ?? '-'}</td>
                      <td>{d.order_no}</td>
                      <td>{d.item_count ?? 0}</td>
                      <td className="text-right">
                        {Number(d.total_amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </DashboardPanel>
      </div>
    </div>
  );
}

function DashboardPanel({
  title,
  linkTo,
  emptyMessage,
  emptySubMessage,
  children,
}: {
  title: string;
  linkTo: string;
  emptyMessage: string;
  emptySubMessage: string;
  children: ReactNode;
}) {
  const hasContent = !!children;

  return (
    <div className="card panel-card">
      <div className="card-header panel-card-header">
        <div className="panel-card-title">
          <span className="panel-card-accent" aria-hidden="true" />
          {title}
        </div>
        <Link to={linkTo} className="panel-card-link">
          전체보기
        </Link>
      </div>
      <div className="card-body panel-card-body">
        {hasContent ? (
          children
        ) : (
          <EmptyState message={emptyMessage} subMessage={emptySubMessage} />
        )}
      </div>
    </div>
  );
}

function OrderMiniTable({
  orders,
}: {
  orders: DashboardLists['dueSoonOrders'];
}) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>상태</th>
            <th>공정</th>
            <th>거래처</th>
            <th>발주번호</th>
            <th>도번</th>
            <th>품명</th>
            <th>납기일</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
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
              <td>{order.due_date ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
