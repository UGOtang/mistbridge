import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "dashboard"
  | "devices"
  | "tunnel"
  | "users"
  | "audit"
  | "settings"
  | "profile"
  | "logout"
  | "plus"
  | "search"
  | "copy"
  | "download"
  | "refresh"
  | "trash"
  | "edit"
  | "key"
  | "shield"
  | "check"
  | "alert"
  | "clock"
  | "globe"
  | "monitor"
  | "menu"
  | "close"
  | "chevronRight"
  | "chevronDown"
  | "eye"
  | "eyeOff"
  | "lock"
  | "qr"
  | "external"
  | "terminal"
  | "sparkles"
  | "activity"
  | "arrowUpRight"
  | "arrowLeft"
  | "more"
  | "server"
  | "route"
  | "link"
  | "checkCircle"
  | "xCircle"
  | "info";

const paths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
    </>
  ),
  devices: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 20.5h8M12 17v3.5" />
    </>
  ),
  tunnel: (
    <>
      <path d="M4 20c0-5.5 3.6-10 8-10s8 4.5 8 10" />
      <path d="M8 20c0-3.3 1.8-6 4-6s4 2.7 4 6" />
      <path d="M2.5 20h19" />
      <circle cx="12" cy="4.5" r="1.8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20c.5-3.4 3-5.4 6.2-5.4s5.7 2 6.2 5.4" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6.2M17.4 14.8c2.3.6 3.6 2.4 4 5.2" />
    </>
  ),
  audit: (
    <>
      <path d="M5 3.5h11l3 3V20.5H5z" />
      <path d="M16 3.5v4h3M8 11h8M8 14.5h8M8 18h5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.9 1.9-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.7v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.9-1.9.06-.06A1.7 1.7 0 0 0 7.7 15a1.7 1.7 0 0 0-1.56-1.03H6v-2.7h.14A1.7 1.7 0 0 0 7.7 10.2a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.9-1.9.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 12.17 5.2V5h2.7v.2a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.9 1.9-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H21v2.7h-.1A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20.5c.6-4 3.6-6.2 8-6.2s7.4 2.2 8 6.2" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H4.5v16H10M15 8l4 4-4 4M8 12h11" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.4 15.4 5.1 5.1" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v12M7.5 11l4.5 4.5 4.5-4.5M4.5 20.5h15" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" />
    </>
  ),
  trash: (
    <>
      <path d="M3.5 6.5h17M9 3.5h6l1 3H8zM6 6.5l.8 14h10.4l.8-14M10 10v7M14 10v7" />
    </>
  ),
  edit: (
    <>
      <path d="m14.5 5 4.5 4.5L8 20.5H3.5V16z" />
      <path d="m12.5 7 4.5 4.5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15.5" r="4" />
      <path d="m11 12.5 8.5-8.5M16 7l2.5 2.5M18.5 4.5l2 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.5 20 6v6.2c0 4.6-3.2 7.8-8 9.3-4.8-1.5-8-4.7-8-9.3V6z" />
      <path d="m8.5 12 2.4 2.4 4.6-5" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  alert: (
    <>
      <path d="M12 3.5 22 21H2z" />
      <path d="M12 9v5M12 17.5v.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.4 4 5.4 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.4-4-9s1.4-6.6 4-9Z" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
      <path d="M8 20.5h8M12 16.5v4" />
    </>
  ),
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  close: <path d="m5 5 14 14M19 5 5 19" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  eye: (
    <>
      <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18M10.6 5.7A11 11 0 0 1 12 5.5c6.2 0 10 6.5 10 6.5a17 17 0 0 1-3.2 4M6.1 6.9A17.3 17.3 0 0 0 2 12s3.8 6.5 10 6.5c1.2 0 2.3-.2 3.3-.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14.5v2" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="15" width="6" height="6" rx="1" />
      <path d="M15 15h2v2h-2zM19 15h2v4h-4v2h-2M15 21h.01M21 21h.01" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4 10 14" />
      <path d="M18 13v6.5H4.5V6H10" />
    </>
  ),
  terminal: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="m7 9 3 3-3 3M13 15h4" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.6 1.4L7 16l-1.4.6L5 18l-.6-1.4L3 16l1.4-.6z" />
    </>
  ),
  activity: <path d="M3 12h4l2.2-6 4.2 12 2.2-6H21" />,
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
  arrowLeft: <path d="M20 12H4M10 6l-6 6 6 6" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="3" width="18" height="7" rx="2" />
      <rect x="3" y="14" width="18" height="7" rx="2" />
      <path d="M7 6.5h.01M7 17.5h.01M11 6.5h5M11 17.5h5" />
    </>
  ),
  route: (
    <>
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="6" r="2.5" />
      <path d="M7.5 18h3a2 2 0 0 0 2-2V8a2 2 0 0 1 2-2h2" />
    </>
  ),
  link: (
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M7.5 17.5 5.8 19.2a3.5 3.5 0 0 1-5-5L3 12M16.5 6.5l1.7-1.7a3.5 3.5 0 0 1 5 5L21 12" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.7 2.7L16.5 9" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5V17M12 7.2v.1" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="mb-mark" x1="5" y1="4" x2="35" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8be0cf" />
          <stop offset="1" stopColor="#2aa79a" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="#0a3439" />
      <path d="M9 27c0-6.2 4.9-11 11-11s11 4.8 11 11" stroke="url(#mb-mark)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M14.5 27c0-3.1 2.5-5.7 5.5-5.7s5.5 2.6 5.5 5.7" stroke="#d8fff7" strokeWidth="1.8" opacity=".82" strokeLinecap="round" />
      <path d="M7.5 27h25" stroke="url(#mb-mark)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="10.5" r="2.2" fill="#d8fff7" />
    </svg>
  );
}
