interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="placeholder-page">
      <div className="icon">🚧</div>
      <h2>{title}</h2>
      <p>다음 단계에서 구현 예정입니다.</p>
    </div>
  );
}
