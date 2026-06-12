import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MENU_ITEMS } from '../../lib/constants';

export function AppLayout() {
  const location = useLocation();
  const currentMenu = MENU_ITEMS.find(
    (m) =>
      m.path === location.pathname ||
      (m.path !== '/' && location.pathname.startsWith(m.path)),
  );

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <Header title={currentMenu?.label ?? '가공관리 Pro'} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
