export function Logo({ className = "h-16 w-auto max-w-full", src = "/newton-logo.png", alt = "Newton Property" }: { className?: string; src?: string; alt?: string }) {
  return <img src={src} alt={alt} className={`object-contain ${className}`} />;
}
