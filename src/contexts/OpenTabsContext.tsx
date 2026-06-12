import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  OPEN_TABS_STORAGE_KEY,
  ROUTES,
  createDefaultDashboardTab,
  getRouteByPath,
  type ModuleGroupId,
} from '../lib/constants';

export interface OpenTab {
  path: string;
  label: string;
  group: ModuleGroupId;
  closable: boolean;
}

interface OpenTabsContextValue {
  tabs: OpenTab[];
  activePath: string;
  openTab: (path: string) => void;
  closeTab: (path: string) => void;
}

const OpenTabsContext = createContext<OpenTabsContextValue | null>(null);

function routeToTab(path: string): OpenTab | null {
  const route = getRouteByPath(path);
  if (!route) return null;
  return {
    path: route.path,
    label: route.label,
    group: route.group,
    closable: route.path !== '/',
  };
}

function loadTabsFromStorage(): OpenTab[] {
  try {
    const raw = localStorage.getItem(OPEN_TABS_STORAGE_KEY);
    if (!raw) return [createDefaultDashboardTab()];

    const parsed = JSON.parse(raw) as OpenTab[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createDefaultDashboardTab()];
    }

    const validPaths = new Set(ROUTES.map((r) => r.path));
    const restored = parsed
      .filter((t) => validPaths.has(t.path))
      .map((t) => ({
        ...t,
        closable: t.path !== '/',
        label: getRouteByPath(t.path)?.label ?? t.label,
        group: getRouteByPath(t.path)?.group ?? t.group,
      }));

    if (!restored.some((t) => t.path === '/')) {
      restored.unshift(createDefaultDashboardTab());
    }

    return restored;
  } catch {
    return [createDefaultDashboardTab()];
  }
}

function saveTabsToStorage(tabs: OpenTab[]) {
  localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify(tabs));
}

export function OpenTabsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<OpenTab[]>(loadTabsFromStorage);

  const activePath = location.pathname || '/';

  const openTab = useCallback((path: string) => {
    const tab = routeToTab(path);
    if (!tab) return;

    setTabs((prev) => {
      if (prev.some((t) => t.path === tab.path)) return prev;
      return [...prev, tab];
    });
  }, []);

  const closeTab = useCallback(
    (path: string) => {
      if (path === '/') return;

      setTabs((prev) => {
        const index = prev.findIndex((t) => t.path === path);
        if (index < 0) return prev;

        const next = prev.filter((t) => t.path !== path);

        if (activePath === path) {
          const prevIndex = Math.max(0, index - 1);
          const fallback = next[prevIndex] ?? next[0];
          navigate(fallback?.path ?? '/');
        }

        if (!next.some((t) => t.path === '/')) {
          next.unshift(createDefaultDashboardTab());
        }

        return next;
      });
    },
    [activePath, navigate],
  );

  useEffect(() => {
    const tab = routeToTab(activePath);
    if (!tab) return;

    setTabs((prev) => {
      if (prev.some((t) => t.path === tab.path)) return prev;
      return [...prev, tab];
    });
  }, [activePath]);

  useEffect(() => {
    saveTabsToStorage(tabs);
  }, [tabs]);

  const value = useMemo(
    () => ({ tabs, activePath, openTab, closeTab }),
    [tabs, activePath, openTab, closeTab],
  );

  return (
    <OpenTabsContext.Provider value={value}>{children}</OpenTabsContext.Provider>
  );
}

export function useOpenTabs() {
  const ctx = useContext(OpenTabsContext);
  if (!ctx) {
    throw new Error('useOpenTabs must be used within OpenTabsProvider');
  }
  return ctx;
}
