interface EmptyStateProps {
  message?: string;
  subMessage?: string;
}

export function EmptyState({
  message = '등록된 데이터가 없습니다.',
  subMessage = '새 항목을 등록해 주세요.',
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      <span>{subMessage}</span>
    </div>
  );
}
