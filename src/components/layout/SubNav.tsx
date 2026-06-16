import { useNavigate, useLocation } from 'react-router-dom';
import { GNB_GROUPS, ROUTES } from '../../lib/constants';

export function SubNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeGroup = GNB_GROUPS.find((g) =>
    g.subRoutes.some((r) =>
      r === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(r),
    ),
  );

  if (!activeGroup || activeGroup.subRoutes.length <= 1) return null;

  return (
    <nav className="sub-nav" aria-label="서브 메뉴">
      {activeGroup.subRoutes.map((path) => {
        const route = ROUTES.find((r) => r.path === path);
        if (!route) return null;
        const isActive =
          path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);
        return (
          <div
            key={path}
            className={`sub-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(path);
              }
            }}
            role="button"
            tabIndex={0}
          >
            {route.label}
          </div>
        );
      })}
    </nav>
  );
}
