import type { ReactNode } from "react";

export type IconName =
  | "bed"
  | "bath"
  | "size"
  | "pin"
  | "car"
  | "eye"
  | "sofa"
  | "calendar"
  | "building"
  | "home"
  | "land"
  | "chat"
  | "phone"
  | "download"
  | "file"
  | "grid"
  | "inbox"
  | "check"
  | "tag"
  | "layers"
  | "search"
  | "sheet"
  | "user";

const PATHS: Record<IconName, ReactNode> = {
  bed: (
    <>
      <path d="M3 19V8" />
      <path d="M3 15h18v4" />
      <path d="M21 19v-6a2 2 0 0 0-2-2H9" />
      <circle cx="7" cy="8" r="2" />
    </>
  ),
  bath: (
    <>
      <path d="M4 13h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M6 13V7a2 2 0 0 1 2-2h1" />
      <path d="M9 5h2" />
    </>
  ),
  size: (
    <>
      <path d="M4 8V4h4" />
      <path d="M20 8V4h-4" />
      <path d="M4 16v4h4" />
      <path d="M20 16v4h-4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  car: (
    <>
      <path d="M4 16h16v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M5 16l1.5-5h11L19 16" />
      <circle cx="7.5" cy="16.5" r="1" />
      <circle cx="16.5" cy="16.5" r="1" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  sofa: (
    <>
      <path d="M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
      <path d="M3 12h18v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M7 18v2" />
      <path d="M17 18v2" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 10h16" />
    </>
  ),
  building: (
    <>
      <path d="M5 20V6l7-3 7 3v14" />
      <path d="M10 20v-5h4v5" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
      <path d="M9 13h.01" />
      <path d="M15 13h.01" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10.5V20h12v-9.5" />
    </>
  ),
  land: (
    <>
      <path d="M3 17h18" />
      <path d="M5 17l3-6 4 3 3-5 4 8" />
    </>
  ),
  chat: (
    <>
      <path d="M5 17.5 3 21l4.2-1.4A9 9 0 1 0 5 17.5z" />
    </>
  ),
  phone: (
    <>
      <path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M11 18h2" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  file: (
    <>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v6h6" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13h4l2 2h4l2-2h4" />
      <path d="M5 6h14l1 13H4z" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12.5 11 15l4.5-5" />
    </>
  ),
  tag: (
    <>
      <path d="M4 12V5h7l9 9-7 7z" />
      <circle cx="8.5" cy="8.5" r="1" />
    </>
  ),
  layers: (
    <>
      <path d="M12 4 3 9l9 5 9-5z" />
      <path d="M3 14l9 5 9-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19c1.5-3 3.8-4.5 7-4.5S17.5 16 19 19" />
    </>
  ),
  sheet: (
    <>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
    </>
  ),
};

export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function IconBadge({ name }: { name: IconName }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sand text-pine">
      <Icon name={name} className="h-4 w-4" />
    </span>
  );
}
