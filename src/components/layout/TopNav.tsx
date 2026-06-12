import { NavLink } from 'react-router-dom';
import { ROUTES, SIDEBAR_SECTIONS } from '../../lib/constants';
import { useAuth } from '../../contexts/AuthContext';
import { NavIcon } from './NavIcon';

const routeMap = new Map(ROUTES.map((r) => [r.path, r]));

export function TopNav() {
  const { userEmail, signOut } = useAuth();

  return (
    <header className="top-nav">
      <div className="top-nav-brand">
        <h1>가공관리 Pro</h1>
        <span className="top-nav-brand-sub">금속가공 ERP</span>
      </div>

      <nav className="top-nav-menu" aria-label="주 메뉴">
        {SIDEBAR_SECTIONS.map((section, sectionIndex) => (
          <div key={section.label} className="top-nav-section">
            {sectionIndex > 0 && (
              <span className="top-nav-divider" aria-hidden="true" />
            )}
            <span className="top-nav-section-label">{section.label}</span>
            {section.paths.map((path) => {
              const item = routeMap.get(path);
              if (!item) return null;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `top-nav-link${isActive ? ' active' : ''}`
                  }
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="top-nav-actions">
        <span className="top-nav-version">v0.3 MVP</span>
        <span className="top-nav-user-pill" title={userEmail ?? undefined}>
          {userEmail}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm top-nav-logout"
          onClick={() => signOut()}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
