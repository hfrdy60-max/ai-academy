import type { ReactNode } from "react";
import type { IconName } from "../types/nav";

// Simple stroke icons (24x24). Inline SVG: no extra dependency, works offline.
const PATHS: Record<IconName, ReactNode> = {
  home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>,
  book: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></>,
  sparkles: <><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="m19 15 .7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" /></>,
  chat: <><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /></>,
  gamepad: <><path d="M6 12h4M8 10v4" /><path d="M15 13h.01M18 11h.01" /><rect width="20" height="12" x="2" y="6" rx="2" /></>,
  exam: <><rect width="8" height="4" x="8" y="2" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>,
  settings: <><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  more: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" /></>,
  cap: <><path d="M22 10 12 5 2 10l10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></>,
  play: <><path d="m6 3 14 9-14 9z" /></>,
  check: <><path d="m5 13 4 4L19 7" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
  up: <><path d="m6 15 6-6 6 6" /></>,
  down: <><path d="m6 9 6 6 6-6" /></>,
  download: <><path d="M12 3v12m0 0-4-4m4 4 4-4" /><path d="M4 21h16" /></>,
  upload: <><path d="M12 15V3m0 0-4 4m4-4 4 4" /><path d="M4 21h16" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  back: <><path d="m9 18 6-6-6-6" /></>,
  trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16M10 14.7V17M14 14.7V17" /><path d="M18 2H6v7a6 6 0 0 0 12 0z" /></>
};

export default function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className={className}
         aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
