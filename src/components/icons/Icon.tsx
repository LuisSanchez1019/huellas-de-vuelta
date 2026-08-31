type IconProps = {
  size?: number;
  className?: string;
};

export function PawIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="7" cy="9" r="2.1" />
      <circle cx="12" cy="6.3" r="2.1" />
      <circle cx="17" cy="9" r="2.1" />
      <circle cx="19.2" cy="14" r="2.1" />
      <path d="M12 12c-3.1 0-6.3 2.3-6.3 5.4 0 1.8 1.5 2.9 3.1 2.4.9-.3 1.9-.3 2.9 0l.3.1.3-.1c1-.3 2-.3 2.9 0 1.6.5 3.1-.6 3.1-2.4C18.3 14.3 15.1 12 12 12z" />
    </svg>
  );
}

export function PinIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 21s7-6.7 7-11.8A7 7 0 0 0 5 9.2C5 14.3 12 21 12 21z" />
      <circle cx="12" cy="9.3" r="2.3" />
    </svg>
  );
}

export function LockIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2.2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function SearchIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function MapIcon({ size = 26, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

export function ChatIcon({ size = 26, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </svg>
  );
}

export function FacebookIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.3-1.5 1.6-1.5h1.7V3.7C15.9 3.6 14.9 3.5 13.8 3.5c-2.5 0-4.2 1.5-4.2 4.3v2.1H7v3.1h2.6V21h3.9Z" />
    </svg>
  );
}

export function InstagramIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="16.6" cy="7.4" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3Zm0 16.4a7.3 7.3 0 0 1-3.7-1l-.3-.2-2.7.7.7-2.6-.2-.3A7.4 7.4 0 1 1 19.4 12 7.4 7.4 0 0 1 12 19.4Zm4-5.5c-.2-.1-1.3-.6-1.5-.7s-.4-.1-.5.1-.6.7-.7.9-.3.2-.5.1a6 6 0 0 1-1.8-1.1 6.7 6.7 0 0 1-1.2-1.5c-.1-.2 0-.3.1-.4l.4-.4.2-.4a.4.4 0 0 0 0-.4c-.1-.1-.5-1.2-.7-1.6s-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.8 2 4.7 4.7 0 0 0 1 2.5 10.7 10.7 0 0 0 4.1 3.6c.6.3 1 .4 1.4.5a3.3 3.3 0 0 0 1.5.1 2.5 2.5 0 0 0 1.6-1.1 1.9 1.9 0 0 0 .1-1.1c-.1-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}
