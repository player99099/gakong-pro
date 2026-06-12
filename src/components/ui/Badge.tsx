import type { OrderStatus, ProcessStatus } from '../../types';

interface BadgeProps {
  status: string;
  type?: 'order' | 'process' | 'default';
}

function getBadgeClass(status: string, type?: string): string {
  if (type === 'order') {
    switch (status) {
      case '접수':
        return 'badge-primary';
      case '보류':
        return 'badge-default';
      case '취소':
        return 'badge-default';
      case '부분납품':
        return 'badge-warning';
      case '납기지연':
        return 'badge-danger';
      case '출하대기':
        return 'badge-teal';
      case '납품완료':
        return 'badge-success';
      default:
        return 'badge-default';
    }
  }
  if (type === 'process') {
    return 'badge-teal';
  }
  return 'badge-default';
}

export function Badge({ status, type = 'default' }: BadgeProps) {
  return (
    <span className={`badge ${getBadgeClass(status, type)}`}>{status}</span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus | string }) {
  return <Badge status={status} type="order" />;
}

export function ProcessStatusBadge({
  status,
}: {
  status: ProcessStatus | string;
}) {
  return <Badge status={status} type="process" />;
}
