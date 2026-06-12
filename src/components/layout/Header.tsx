import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { userEmail, signOut } = useAuth();

  return (
    <header className="header">
      <h2 className="header-title">{title}</h2>
      <div className="header-user">
        <span>{userEmail}</span>
        <button className="btn btn-secondary btn-sm" onClick={() => signOut()}>
          로그아웃
        </button>
      </div>
    </header>
  );
}
