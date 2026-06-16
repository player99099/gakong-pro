import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { GNB_GROUPS } from '../../lib/constants';

export function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userEmail, signOut, skipAuth, devAuthError } = useAuth();

  const activeGroup = GNB_GROUPS.find((g) =>
    g.subRoutes.some((r) =>
      r === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(r),
    ),
  )?.id;

  return (
    <header className="top-nav">
      <div className="top-nav-brand">
        <h1>가공관리 Pro</h1>
        <span className="top-nav-brand-sub">금속가공 ERP</span>
      </div>

      <nav className="top-nav-gnb" aria-label="주 메뉴">
        {GNB_GROUPS.map((group) => (
          <div
            key={group.id}
            className={`gnb-item ${activeGroup === group.id ? 'active' : ''}`}
            onClick={() => navigate(group.subRoutes[0])}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(group.subRoutes[0]);
              }
            }}
            role="button"
            tabIndex={0}
          >
            {group.label}
          </div>
        ))}
      </nav>

      <div className="top-nav-actions">
        {devAuthError && (
          <span className="top-nav-dev-warn" title={devAuthError}>
            로그인 실패
          </span>
        )}
        <span className="top-nav-user-pill" title={userEmail ?? undefined}>
          {skipAuth ? '개발 모드' : userEmail}
        </span>
        {!skipAuth && (
          <button type="button" className="top-nav-logout" onClick={() => signOut()}>
            로그아웃
          </button>
        )}
      </div>
    </header>
  );
}
