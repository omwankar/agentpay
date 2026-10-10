export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M16 3.6 27 8v8.6c0 6.6-4.4 11-11 13.2C9.4 27.6 5 23.2 5 16.6V8L16 3.6z"
        fill="currentColor"
      />
      <circle cx="16" cy="15.4" r="3.7" fill="#F6C453" />
    </svg>
  );
}
