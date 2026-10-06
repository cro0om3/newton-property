export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden="true">
        <rect width="40" height="40" rx="10" fill="#0b245c" />
        <path d="M8 28V14.5L20 8l12 6.5V28" fill="none" stroke="#ffffff" strokeWidth="2.2" />
        <path d="M16 28v-7h8v7" fill="none" stroke="#ffffff" strokeWidth="2.2" />
      </svg>
      <span className="leading-tight">
        <span className={`block text-sm font-semibold tracking-tight ${light ? "text-ink" : "text-white"}`}>
          Newton Property
        </span>
        <span className={`block text-[11px] ${light ? "text-muted" : "text-white/65"}`}>Broker desk</span>
      </span>
    </span>
  );
}
