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
      <div className="empty-state-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 7h16M4 12h10M4 17h6" strokeLinecap="round" />
        </svg>
      </div>
      <p className="empty-state-title">{message}</p>
      <span className="empty-state-desc">{subMessage}</span>
    </div>
  );
}
