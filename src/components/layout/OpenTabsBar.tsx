import { useNavigate } from 'react-router-dom';
import { useOpenTabs } from '../../contexts/OpenTabsContext';

export function OpenTabsBar() {
  const { tabs, activePath, closeTab } = useOpenTabs();
  const navigate = useNavigate();

  if (tabs.length === 0) return null;

  return (
    <div className="open-tabs-bar" role="tablist" aria-label="열린 화면">
      <div className="open-tabs-scroll">
        {tabs.map((tab) => {
          const isActive = tab.path === activePath;
          return (
            <div
              key={tab.path}
              role="tab"
              aria-selected={isActive}
              className={`open-tab${isActive ? ' active' : ''}`}
              onClick={() => navigate(tab.path)}
            >
              <span className="open-tab-label">{tab.label}</span>
              {tab.closable && (
                <button
                  type="button"
                  className="open-tab-close"
                  aria-label={`${tab.label} 탭 닫기`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.path);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
