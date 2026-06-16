import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { SubNav } from './SubNav';

export function AppLayout() {
  return (
    <div className="app-layout">
      <TopNav />
      <SubNav />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
