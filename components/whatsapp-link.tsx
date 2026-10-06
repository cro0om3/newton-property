import { whatsappHref } from "@/lib/format";

export function WhatsAppLink({ phone, label }: { phone: string | null; label?: string }) {
  const href = whatsappHref(phone);
  if (!href) return <span className="text-xs text-muted">No mobile number</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="relative z-10 inline-flex items-center gap-1.5 rounded-lg bg-[#128C7E] px-2 py-1 text-xs font-semibold text-white"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3zm0 2a7 7 0 0 1 6 10.6l-.2.4.7 2.6-2.7-.7-.4.2A7 7 0 1 1 12 5zm-2.2 3.2c-.2 0-.5.1-.7.4-.2.3-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.7 2.7.6.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.6-.3l-1.4-.7c-.2-.1-.4 0-.6.2l-.6.7c-.1.1-.3.2-.5.1s-1-.4-1.9-1.2-1.3-1.6-1.5-1.9.1-.4.2-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.6c-.2-.4-.4-.4-.6-.4z" />
      </svg>
      {label || phone}
    </a>
  );
}
