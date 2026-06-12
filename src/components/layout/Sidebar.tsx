import { NavLink } from 'react-router-dom';
import { MENU_ITEMS } from '../../lib/constants';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>가공관리 Pro</h1>
        <p>금속가공 미니 ERP</p>
      </div>
      <nav className="sidebar-nav">
        {MENU_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
