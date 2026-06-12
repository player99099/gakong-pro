import type { NavIconName } from '../../lib/constants';

interface NavIconProps {
  name: NavIconName;
  className?: string;
}

export function NavIcon({ name, className = '' }: NavIconProps) {
  const props = {
    className: `nav-icon-svg ${className}`.trim(),
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...props}>
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      );
    case 'orders':
      return (
        <svg {...props}>
          <path d="M4 3h8v10H4z" />
          <path d="M6 6h4M6 8.5h4M6 11h2.5" />
        </svg>
      );
    case 'work-orders':
      return (
        <svg {...props}>
          <path d="M3 4h10v8H3z" />
          <path d="M5.5 7h5M5.5 9.5h3.5" />
        </svg>
      );
    case 'production':
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="5" />
          <path d="M8 5v3l2 1.5" />
        </svg>
      );
    case 'production-log':
      return (
        <svg {...props}>
          <path d="M4 2.5h8v11H4z" />
          <path d="M6 6h4M6 8.5h4M6 11h2.5" />
        </svg>
      );
    case 'delivery':
      return (
        <svg {...props}>
          <path d="M2 4h7v6H2z" />
          <path d="M9 6h3l2 2v2H9z" />
          <circle cx="5" cy="11.5" r="1" />
          <circle cx="12" cy="11.5" r="1" />
        </svg>
      );
    case 'customers':
      return (
        <svg {...props}>
          <path d="M3 13V6l5-3 5 3v7" />
          <path d="M6 13v-4h4v4" />
        </svg>
      );
    case 'vendors':
      return (
        <svg {...props}>
          <path d="M2 13V5l6-3 6 3v8" />
          <path d="M6 13V9h4v4" />
        </svg>
      );
    case 'items':
      return (
        <svg {...props}>
          <path d="M3 5l5-2.5L13 5v6l-5 2.5L3 11V5z" />
          <path d="M8 2.5v11" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="2" />
          <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M3.8 12.2l1-1M11.2 4.8l1-1" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="4" />
        </svg>
      );
  }
}
