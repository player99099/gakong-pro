import { Outlet } from 'react-router-dom';
import { OpenTabsProvider } from '../../contexts/OpenTabsContext';
import { TopNav } from './TopNav';
import { OpenTabsBar } from './OpenTabsBar';

function AppLayoutContent() {
  return (
    <div className="app-layout">
      <TopNav />
      <OpenTabsBar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export function AppLayout() {
  return (
    <OpenTabsProvider>
      <AppLayoutContent />
    </OpenTabsProvider>
  );
}
